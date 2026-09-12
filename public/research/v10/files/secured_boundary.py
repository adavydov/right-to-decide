"""M03 extension: one bounded, pre-funded claim and a guarantor's private choice.

Conditional common-value accounting units, complete-information case analysis.
No empirical calibration, moral utility, force model, general equilibrium or
unlimited indemnity. Original boundary.py is intentionally independent.
"""
from dataclasses import asdict, dataclass, fields
from math import isfinite

EPS = 1e-9


@dataclass(frozen=True)
class SecuredContract:
    earth_bond: float = 12.0
    coverage_limit: float = 10.0
    operator_collateral: float = 10.0
    earth_control: float = 1.0
    collateral_access: float = 1.0
    verification_cost: float = 1.0
    execution_cost: float = 1.0
    continuation_margin: float = 2.0
    operator_continuation_value: float = 0.0
    guarantor_cash: float = 4.0
    operator_cash: float = 12.0
    fee: float = 1.0
    guarantor_capital_charge: float = 1.0
    operator_capital_charge: float = 0.5

    def __post_init__(self):
        for field in fields(self):
            value = getattr(self, field.name)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or value < 0:
                raise ValueError('Finite nonnegative parameter required: ' + field.name)
        if self.earth_control > 1 or self.collateral_access > 1:
            raise ValueError('Control/access fractions must be between zero and one')
        if self.fee > self.operator_cash:
            raise ValueError('Operator must fund the fee without withdrawing pledged collateral')


@dataclass(frozen=True)
class ClaimEvent:
    repair_loss: float = 8.0
    covered_event: bool = True
    independent_trigger: bool = True
    attributable: bool = True

    def __post_init__(self):
        if isinstance(self.repair_loss, bool) or not isinstance(self.repair_loss, (int, float)) or not isfinite(self.repair_loss) or self.repair_loss < 0:
            raise ValueError('Finite nonnegative repair loss required')
        if any(type(getattr(self, k)) is not bool for k in ('covered_event', 'independent_trigger', 'attributable')):
            raise ValueError('Event flags must be Boolean')


def amounts(contract, event):
    payout = min(event.repair_loss, contract.coverage_limit, contract.earth_bond * contract.earth_control) if event.covered_event and event.independent_trigger else 0.0
    recovery = min(payout, contract.operator_collateral * contract.collateral_access) if event.attributable else 0.0
    return payout, recovery


def settle(contract, event, action, side_payment=0.0):
    """A feasible realized path. Owner accounts distinguish custody from title.

    ignore: do not investigate; verify_only: pay for proof but do not collect;
    enforce: prove and collect; settlement: prove, take an explicit side payment
    and release accessible collateral. The latter is an action supplied for
    comparison, not a derived bargaining solution.
    """
    if action not in ('ignore', 'verify_only', 'enforce', 'settlement'):
        raise ValueError('Unknown action')
    if isinstance(side_payment, bool) or not isfinite(side_payment) or side_payment < 0:
        raise ValueError('Invalid side payment')
    if action != 'settlement' and side_payment:
        raise ValueError('Side payment belongs only to settlement')
    payout, recovery = amounts(contract, event)
    if action in ('enforce', 'settlement') and (not event.attributable or payout <= 0):
        raise ValueError('No attributable covered claim supports collection/settlement')
    if action == 'settlement' and side_payment > contract.operator_cash - contract.fee + EPS:
        raise ValueError('Side payment exceeds unpledged operator cash')
    cost = (contract.verification_cost if action != 'ignore' else 0.0) + (contract.execution_cost if action == 'enforce' else 0.0)
    if cost > contract.guarantor_cash + contract.fee + EPS:
        raise ValueError('Verification/execution must be funded before recovery')
    accounts = {'earth': 0.0, 'guarantor_free': contract.earth_bond + contract.guarantor_cash,
                'guarantor_bond_in_earth_custody': 0.0, 'operator_free': contract.operator_collateral + contract.operator_cash,
                'operator_collateral_in_guarantor_custody': 0.0, 'verification_provider': 0.0, 'execution_provider': 0.0}
    initial = dict(accounts)
    transfers = []
    def transfer(state, origin, target, amount):
        if amount < -EPS or amount > accounts[origin] + EPS:
            raise ValueError('Unfunded asset transfer')
        if amount <= 0: return
        accounts[origin] -= amount; accounts[target] += amount
        transfers.append({'state': state, 'from': origin, 'to': target, 'amount': amount})
    transfer('funding', 'guarantor_free', 'guarantor_bond_in_earth_custody', contract.earth_bond)
    transfer('funding', 'operator_free', 'operator_collateral_in_guarantor_custody', contract.operator_collateral)
    transfer('funding', 'operator_free', 'guarantor_free', contract.fee)
    transfer('independent_claim', 'guarantor_bond_in_earth_custody', 'earth', payout)
    if action != 'ignore': transfer('verification', 'guarantor_free', 'verification_provider', contract.verification_cost)
    if action == 'enforce':
        transfer('execution', 'guarantor_free', 'execution_provider', contract.execution_cost)
        transfer('recovery', 'operator_collateral_in_guarantor_custody', 'guarantor_free', recovery)
    elif action == 'settlement':
        transfer('bilateral_settlement', 'operator_free', 'guarantor_free', side_payment)
    # Only accessible residual assets can leave custody. Unavailable collateral
    # is still shown as encumbered property, never conjured into liquid cash.
    transfer('close_one_claim', 'guarantor_bond_in_earth_custody', 'guarantor_free', contract.earth_bond * contract.earth_control - payout)
    transfer('close_one_claim', 'operator_collateral_in_guarantor_custody', 'operator_free', contract.operator_collateral * contract.collateral_access - (recovery if action == 'enforce' else 0.0))
    guarantor_asset_delta = accounts['guarantor_free'] + accounts['guarantor_bond_in_earth_custody'] - initial['guarantor_free']
    operator_asset_delta = accounts['operator_free'] + accounts['operator_collateral_in_guarantor_custody'] - initial['operator_free']
    retained_margin = 0.0 if action == 'enforce' else contract.continuation_margin
    operator_payment = recovery if action == 'enforce' else side_payment if action == 'settlement' else 0.0
    return {'action': action, 'payout_to_earth': payout, 'uncovered_repair_loss': event.repair_loss - payout,
            'recoverable_collateral': recovery, 'operator_payment_after_breach': operator_payment,
            'guarantor_asset_delta': guarantor_asset_delta, 'operator_asset_delta': operator_asset_delta,
            'verification_and_execution_cost': cost,
            'guarantor_payoff': guarantor_asset_delta + retained_margin - contract.guarantor_capital_charge,
            'operator_additional_breach_cost': operator_payment + (contract.operator_continuation_value if action == 'enforce' else 0.0),
            'accounts': accounts, 'initial_accounts': initial, 'transfers': transfers,
            'asset_balance_error': sum(accounts.values()) - sum(initial.values()),
            'future_margin_is_not_an_asset_transfer': True,
            'coverage_renewed': False}


def evaluate(contract=SecuredContract(), event=ClaimEvent(), side_payment_offer=None):
    """Compare a specified offer and feasible private responses; preserve ties."""
    paths, unavailable = {}, {}
    for action in ('ignore', 'verify_only', 'enforce'):
        try: paths[action] = settle(contract, event, action)
        except ValueError as error: unavailable[action] = str(error)
    if side_payment_offer is not None:
        try: paths['settlement'] = settle(contract, event, 'settlement', side_payment_offer)
        except ValueError as error: unavailable['settlement'] = str(error)
    best_value = max(p['guarantor_payoff'] for p in paths.values())
    best = [action for action, p in paths.items() if abs(p['guarantor_payoff'] - best_value) <= EPS]
    payout, recovery = amounts(contract, event)
    enforce_advantage = paths['enforce']['guarantor_payoff'] - paths['ignore']['guarantor_payoff'] if 'enforce' in paths else None
    return {'contract': asdict(contract), 'event': asdict(event), 'paths': paths, 'unavailable': unavailable,
            'best_responses': best, 'enforce_advantage_over_inaction': enforce_advantage,
            'execution_advantage_after_verification': recovery - contract.execution_cost - contract.continuation_margin if 'enforce' in paths else None,
            'payout_to_earth': payout,
            'conditional_operator_costs_at_best_responses': sorted(set(paths[a]['operator_additional_breach_cost'] for a in best)),
            'side_payment_audit': side_payment_window(contract, event),
            'scope': 'One specified claim, complete-information cases, no automatic transfer into original M03'}


def side_payment_window(contract, event):
    """After proof: interval of mutually improving cash offers versus collection.

    Verification is already sunk here. This is a deviation test, not a price
    or a unique bargaining equilibrium. No side deal can undo Earth's payout.
    """
    payout, recovery = amounts(contract, event)
    threat = (payout > 0 and event.attributable and
              contract.verification_cost + contract.execution_cost <= contract.guarantor_cash + contract.fee + EPS)
    lower = recovery - contract.execution_cost - contract.continuation_margin
    upper = min(contract.operator_cash - contract.fee, recovery + contract.operator_continuation_value)
    credible = threat and lower > EPS
    return {'credible_collection_after_proof': credible,
            'guarantor_indifference_payment': lower if credible else None,
            'operator_maximum_payment': upper,
            'strictly_mutually_profitable_interval': [lower, upper] if credible and upper > lower + EPS else None,
            'verification_cost_is_sunk_here': True,
            'earth_payout_cannot_be_reversed_by_this_settlement': True,
            'bargaining_price_determined': False}


def participation(contract, event, breach_frequency, operator_contract_surplus, action='enforce', side_payment=0.0):
    """One-period financial scenario, not an empirical or equilibrium frequency.

    Surplus is the operator's incremental value of access relative to staying
    out, including continuation value. Fees transfer value; capital charges
    and foregone margins are opportunity costs, not extra compensation assets.
    """
    if contract.earth_control != 1 or contract.collateral_access != 1:
        raise ValueError('Entry valuation of persistently inaccessible assets is outside this one-period underwriting calculation')
    if isinstance(breach_frequency, bool) or not isfinite(breach_frequency) or not 0 <= breach_frequency <= 1 or not isfinite(operator_contract_surplus):
        raise ValueError('Invalid underwriting scenario')
    outcome = settle(contract, event, action, side_payment)
    q = breach_frequency
    normal_guarantor = contract.fee + contract.continuation_margin - contract.guarantor_capital_charge
    expected_guarantor = (1-q)*normal_guarantor + q*outcome['guarantor_payoff']
    expected_operator = operator_contract_surplus - contract.fee - contract.operator_capital_charge - q*outcome['operator_additional_breach_cost']
    fee_min = contract.fee - expected_guarantor
    fee_max = contract.fee + expected_operator
    return {'frequency_is_scenario_input': True, 'breach_frequency': q, 'operator_contract_surplus': operator_contract_surplus,
            'specified_response': action, 'guarantor_expected_increment': expected_guarantor,
            'operator_expected_increment': expected_operator,
            'guarantor_participates_weakly': expected_guarantor >= -EPS,
            'operator_participates_weakly': expected_operator >= -EPS,
            'zero_profit_fee_interval_before_liquidity_recheck': [max(0.0, fee_min), min(contract.operator_cash, fee_max)],
            'nonnegative_fee_interval_exists': max(0.0, fee_min) <= min(contract.operator_cash, fee_max) + EPS,
            'response_optimality_and_cash_must_be_rechecked_if_fee_changes': True}


def breach_incentive(net_gain_without_this_contract, outcome):
    """A conditional comparison, not a right to cause the priced damage."""
    if not isfinite(net_gain_without_this_contract): raise ValueError('Finite gain required')
    margin = net_gain_without_this_contract - outcome['operator_additional_breach_cost']
    return {'net_gain_after_response': margin, 'breach_strictly_profitable': margin > EPS,
            'indifferent': abs(margin) <= EPS, 'response_assumed': outcome['action'], 'permission_to_harm_implied': False}
