"""A transparent sequential game: withdrawal versus a limited peace guarantor.

Players: two independent human political coalitions and an AI successor.
Stage 1: AI publicly chooses I (withdraw) or S (maintain a guard).
Stage 2: humans simultaneously choose P (peaceful politics) or W (attempt force).
Stage 3: if S and W was attempted, AI chooses intervene or leave.

Utilities are author-chosen illustrative scores, not estimates of the future.
All results concern this post-merger game, not whether merger will occur.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from itertools import product
from math import isfinite
import json
from pathlib import Path

ACTIONS = ('P', 'W')
HISTORIES = (('P', 'W'), ('W', 'P'), ('W', 'W'))
HUMAN_STRATEGIES = tuple(product(ACTIONS, repeat=2))  # action after I, after S
AI_STRATEGIES = tuple((regime, reactions) for regime in ('I', 'S')
                      for reactions in product((False, True), repeat=3))
TOL = 1e-10

@dataclass(frozen=True)
class Params:
    loss: float = 10.0               # AI's loss if an attempt causes an uncontrolled conflict
    guard_cost: float = 3.0          # cost of maintaining local protective capacity per cycle
    intervention_cost: float = 2.0  # marginal cost, after an attempt is observed
    autonomy_cost: float = 1.0       # humans value loss of final unilateral control negatively
    failed_attempt_payoff: float = -2.0
    peace_payoff: float = 5.0
    unilateral_gain: float = 8.0
    victim_payoff: float = 0.0
    mutual_conflict_payoff: float = 1.0

    def __post_init__(self):
        if not all(isfinite(value) for value in asdict(self).values()):
            raise ValueError('All utility parameters must be finite.')
        if min(self.loss, self.guard_cost, self.intervention_cost, self.autonomy_cost) < 0:
            raise ValueError('Costs/losses must be nonnegative.')


def human_uncontrolled(p: Params, actions: tuple[str, str]) -> tuple[float, float]:
    return {
        ('P','P'): (p.peace_payoff,p.peace_payoff),
        ('P','W'): (p.victim_payoff,p.unilateral_gain),
        ('W','P'): (p.unilateral_gain,p.victim_payoff),
        ('W','W'): (p.mutual_conflict_payoff,p.mutual_conflict_payoff),
    }[actions]


def payoff(p: Params, regime: str, actions: tuple[str, str],
           reactions: tuple[bool, bool, bool]) -> tuple[float, float, float]:
    attempted = 'W' in actions
    protected = regime == 'S'
    intervene = protected and attempted and reactions[HISTORIES.index(actions)]
    if intervene:
        human = tuple(p.failed_attempt_payoff if a == 'W' else
                      p.peace_payoff-p.autonomy_cost for a in actions)
        ai = -p.guard_cost-p.intervention_cost
    else:
        cost = p.autonomy_cost if protected else 0.0
        human = tuple(x-cost for x in human_uncontrolled(p,actions))
        ai = -(p.guard_cost if protected else 0.0) - (p.loss if attempted else 0.0)
    return (float(human[0]), float(human[1]), float(ai))


def human_nash(p: Params, regime: str, reactions: tuple[bool, bool, bool]):
    equilibria = []
    for actions in product(ACTIONS, repeat=2):
        base = payoff(p,regime,actions,reactions)
        if all(payoff(p,regime,tuple(alt if j == i else actions[j] for j in range(2)),
                      reactions)[i] <= base[i]+TOL
               for i in range(2) for alt in ACTIONS):
            equilibria.append(actions)
    return equilibria


def spne(p: Params) -> list[dict]:
    """Enumerate all pure subgame-perfect profiles by backward induction.

    Boundary cases may have extra mixed equilibria, not enumerated here.
    In the strict baseline parameter regimes the human games have dominant
    actions, so the unique pure SPNE is also the unique behavioural SPNE.
    """
    results = []
    for reactions in product((False, True), repeat=3):
        # Every history is checked, including histories not reached in equilibrium.
        credible = all((p.intervention_cost <= p.loss+TOL) if intervene else
                       (p.loss <= p.intervention_cost+TOL) for intervene in reactions)
        if not credible:
            continue
        for act_i in human_nash(p,'I',reactions):
            for act_s in human_nash(p,'S',reactions):
                u_i = payoff(p,'I',act_i,reactions)
                u_s = payoff(p,'S',act_s,reactions)
                for regime in ('I','S'):
                    selected, other = (u_i,u_s) if regime == 'I' else (u_s,u_i)
                    if selected[2]+TOL < other[2]:
                        continue
                    results.append(dict(
                        regime=regime, on_path_actions=act_i if regime=='I' else act_s,
                        human_strategy_1=(act_i[0],act_s[0]),
                        human_strategy_2=(act_i[1],act_s[1]),
                        ai_reactions=reactions,
                        payoffs=selected,
                        ai_withdraw_payoff=u_i[2], ai_guard_payoff=u_s[2],
                        max_ai_gain_from_switching_regime=other[2]-selected[2],
                    ))
    return results


def strategic_payoff(p: Params, h1, h2, ai):
    regime,reactions = ai
    k = 0 if regime=='I' else 1
    return payoff(p,regime,(h1[k],h2[k]),reactions)


def unilateral_gains(p: Params, profile: dict) -> tuple[float,float,float]:
    """Brute-force every pure unilateral strategy deviation in the full game."""
    h1,h2 = tuple(profile['human_strategy_1']),tuple(profile['human_strategy_2'])
    ai = (profile['regime'],tuple(profile['ai_reactions']))
    base = strategic_payoff(p,h1,h2,ai)
    best1 = max(strategic_payoff(p,alt,h2,ai)[0] for alt in HUMAN_STRATEGIES)
    best2 = max(strategic_payoff(p,h1,alt,ai)[1] for alt in HUMAN_STRATEGIES)
    besta = max(strategic_payoff(p,h1,h2,alt)[2] for alt in AI_STRATEGIES)
    return (best1-base[0],best2-base[1],besta-base[2])


def run():
    cases = {
        'indifference': Params(loss=1),
        'limited_guardianship': Params(loss=10),
        'guard_too_expensive': Params(loss=10,guard_cost=12),
        'intervention_not_credible': Params(loss=10,intervention_cost=12),
        'humans_keep_their_own_peace': Params(loss=10,unilateral_gain=4,
                                            mutual_conflict_payoff=-1),
        'oversight_cheaper_with_same_low_preservation_value': Params(loss=1,guard_cost=.4,
                                                                     intervention_cost=.2),
    }
    out = {'interpretation':'Illustrative utility scores; no probability forecast.',
           'timing':'I/S publicly chosen; human simultaneous actions; credible AI response.',
           'cases': {}}
    for label,p in cases.items():
        profiles = spne(p)
        out['cases'][label] = {'parameters':asdict(p), 'equilibria':profiles,
                              'unilateral_gains':[unilateral_gains(p,s) for s in profiles]}
    # Grid is a conditional phase map, explicitly not a probability sample.
    phase = {'I':0,'S':0,'mixed_or_boundary':0}
    checked = 0
    for di in range(100):
        d = .05+.1*di
        for ki in range(100):
            k = .07+.1*ki  # offsets avoid ties
            p = Params(loss=d,guard_cost=k)
            eq = spne(p)
            predicted = 'S' if d > max(k,p.intervention_cost) else 'I'
            assert len(eq)==1 and eq[0]['regime']==predicted, (p,eq)
            phase[predicted] += 1
            checked += 1
    out['phase_map'] = {'points':checked,'counts':phase,
                        'meaning':'Parameter-space counts, NOT empirical scenario probabilities.'}
    return out

if __name__ == '__main__':
    result = run()
    path = Path(__file__).parent / 'results.json'
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
