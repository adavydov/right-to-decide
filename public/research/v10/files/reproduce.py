"""Public M01-M04 reproduction. Python >=3.10, standard library only.

Place the six model modules beside this file. Outputs go to public-results.
All parameters are illustrative; no empirical forecasts or external actions.
"""
import csv
from dataclasses import replace
import json
from pathlib import Path
from coalition_game import World, Game, designs, path
from preferences import run
from boundary import Boundary
from secured_boundary import SecuredContract, ClaimEvent, evaluate, participation
from space_economics import Parameters, compare, radiator_area
from space_lagged import simulate_lagged, compare_lagged

OUT = Path(__file__).resolve().parent / 'public-results'

def write_json(name, value):
    (OUT / name).write_bytes((json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))

def write_csv(name, rows):
    with (OUT / name).open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)

def main():
    OUT.mkdir(exist_ok=True)
    coalition = []
    for label, world in [('early', World(.1,.1,.2,.6)), ('late', World(.95,.95,.05,.4)), ('portable', World(.8,.9,.95,.8))]:
        for design in designs():
            game = Game(world, design)
            coalition.append(dict(world=label, parameters=world.__dict__, design=design.__dict__,
                costs=game.vectors()[0], values=game.vectors()[1], pure_nash=game.equilibria(),
                dominance=game.dominance_certificate(),
                blocking_without_transfers=game.blocking_coalitions(),
                blocking_with_bounded_transfers=game.blocking_coalitions(transfers=True)))
    write_json('M01-results.json', {'games':coalition, 'specified_paths':{p:path(p) for p in ('delegate','open')}})
    for mode in ('none','self_authored','normalizing','curiosity'):
        write_csv('M02-'+mode+'.csv', run(mode))
    write_json('M03-boundary.json', {name:{'parameters':model.__dict__, 'margins':model.respect_margins(), 'pure_nash':model.equilibria()} for name,model in [('central',Boundary()),('profitable_breach',Boundary(resource_gain=(14.,7.))) ]})
    base = SecuredContract(); event = ClaimEvent()
    cases = [('funded_recovery',base,event,None),
        ('expensive_verification',replace(base,verification_cost=7,guarantor_cash=10),event,None),
        ('valuable_continuation',replace(base,continuation_margin=9),event,None),
        ('inaccessible_operator_collateral',replace(base,collateral_access=.25),event,None),
        ('small_coverage',replace(base,coverage_limit=2),event,None),
        ('no_execution_liquidity',replace(base,guarantor_cash=0),event,None),
        ('no_attribution',base,replace(event,attributable=False),None),
        ('failed_independent_trigger',base,replace(event,independent_trigger=False),None),
        ('earth_control_lost',replace(base,earth_control=0),event,None),
        ('side_payment_six',base,event,6),
        ('loss_beyond_coverage',base,replace(event,repair_loss=50),None),
        ('tie_is_not_security',replace(base,continuation_margin=6),event,None)]
    write_json('M03-secured-results.json', {'units':'illustrative common asset-value units',
        'cases':[{'case':name,**evaluate(contract,claim,offer)} for name,contract,claim,offer in cases],
        'participation':[{'case':'moderate_claim_frequency',**participation(base,event,.25,4)},
            {'case':'frequent_claims_no_price_interval',**participation(base,event,.75,4)},
            {'case':'specified_side_payment',**participation(base,event,.25,4,'settlement',6)}]})
    write_csv('M04-comparison-lagged.csv',[compare_lagged(p) for p in (100,500,1000,2500,5000,10000,20000)])
    write_csv('M04-comparison-annual.csv',[compare(p) for p in (100,500,1000,2500,5000,10000,20000)])
    sensitivity = []
    for start in (0,2,5,8):
        for mass in (.3,2.,4.):
            for price in (1000,2500,5000):
                sensitivity.append(dict(factory_start_year=start,critical_import_kg_per_kw=mass,
                    **compare_lagged(price,factory_start_year=start,critical_import_kg_per_kw=mass)))
    write_csv('M04-sensitivity.csv',sensitivity)
    for price in (2500,5000):
        for local in (False,True):
            result = simulate_lagged(replace(Parameters(),launch_per_kg=price), local)
            write_csv(f'M04-{price}-'+('local' if local else 'earth')+'.csv',result['years'])
    write_json('M04-parameters.json', {'defaults':Parameters().__dict__, 'radiator_only':{
        'power_w':1e9,'emissivity':.9,'background_k':3.,
        'area_m2_at_300K':radiator_area(1e9,300.),'area_m2_at_500K':radiator_area(1e9,500.)},
        'radiator_mass_and_cost_included_in_npv':False,'global_optimization':False})
    print('Four models reproduced in public-results; inputs are illustrative.')

if __name__ == '__main__': main()
