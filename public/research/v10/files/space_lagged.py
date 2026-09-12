"""M04 timing sensitivity: one whole annual step from fabrication to service.

The original annual-aggregate comparator is preserved in space_economics.py.
Here today's factory output cannot power today's factory or today's customer.
This is a specified supply strategy, not a globally optimized mission.
"""
from dataclasses import asdict, replace
from space_economics import Parameters


def simulate_lagged(p=Parameters(), local=False):
    p.validate()
    earth = loc = pending = 0.0
    rows = []
    seed = p.factory_capex + p.factory_seed_kg*p.launch_per_kg if local else 0.0
    total = seed
    unit_earth = p.earth_hardware_per_kw + p.earth_mass_kg_per_kw*p.launch_per_kg
    energy_fraction = p.fabrication_kwh_per_kw/8760.0
    retention = 1-p.degradation
    for t in range(p.years):
        earth *= retention
        loc = loc*retention + pending
        commissioned = pending
        pending = 0.0
        demand = p.demand_kw*(1+p.demand_growth)**t
        overhead = p.factory_overhead_kw if local else 0.0
        need = demand + overhead
        old_capacity = earth + loc
        q = 0.0
        if local and t >= p.factory_start_year and t < p.years-1:
            next_need = demand*(1+p.demand_growth) + overhead

            def next_capacity(output):
                # Imports installed at the beginning of this period power
                # this period's service AND fabrication. Output arrives next period.
                current_imports = max(0.0, need + energy_fraction*output-old_capacity)
                return (old_capacity+current_imports)*retention + output

            if next_capacity(0.0) < next_need:
                lo, hi = 0.0, p.factory_capacity_kw_per_year
                if next_capacity(hi) <= next_need:
                    q = hi
                else:
                    for _ in range(60):
                        middle = (lo+hi)/2
                        if next_capacity(middle) < next_need:
                            lo = middle
                        else:
                            hi = middle
                    q = hi
        factory_load = q*energy_fraction
        add_earth = max(0.0, need+factory_load-old_capacity)
        earth += add_earth
        available = earth+loc-overhead-factory_load
        served = min(demand, available)
        curtailed = max(0.0, available-demand)
        pending = q
        cost = add_earth*unit_earth + q*(p.local_cost_per_kw + p.critical_import_kg_per_kw*p.launch_per_kg)
        cost += earth*p.earth_om_per_kw_year + (p.factory_om_per_year if local else 0.0)
        discounted = cost/(1+p.discount)**t
        total += discounted
        rows.append(dict(year=t, demand_kw=demand, served_kw=served,
                         curtailed_kw=curtailed, earth_add_kw=add_earth,
                         local_fabricated_kw=q, local_commissioned_kw=commissioned,
                         earth_capacity_kw=earth, local_capacity_kw=loc,
                         factory_load_kw=factory_load, overhead_kw=overhead,
                         cash_cost=cost, discounted_cost=discounted))
    return dict(strategy='local_lagged' if local else 'earth_lagged',
                parameters=asdict(p), seed_cost=seed, npv_cost=total, years=rows,
                timing='fabricated in year t; first useful service in year t+1')


def compare_lagged(launch_per_kg, **changes):
    p = replace(Parameters(), launch_per_kg=launch_per_kg, **changes)
    earth, local = simulate_lagged(p), simulate_lagged(p, True)
    return dict(launch_per_kg=launch_per_kg, earth_npv=earth['npv_cost'],
                local_npv=local['npv_cost'], saving_local=earth['npv_cost']-local['npv_cost'],
                preferred='local' if local['npv_cost'] < earth['npv_cost'] else 'earth')
