"""M04: comparable annual useful-power service. Inputs are illustrative.
A kW is average useful power at a stipulated common bus, not peak panel output.
"""
from dataclasses import dataclass,asdict,replace
from math import pi
SIGMA=5.670374419e-8
@dataclass(frozen=True)
class Parameters:
    years:int=15
    demand_kw:float=10000.
    demand_growth:float=.05
    discount:float=.08
    degradation:float=.03
    launch_per_kg:float=5000.
    earth_hardware_per_kw:float=1500.
    earth_mass_kg_per_kw:float=5.
    factory_capex:float=50000000.
    factory_seed_kg:float=12000.
    factory_start_year:int=2
    factory_capacity_kw_per_year:float=8000.
    local_cost_per_kw:float=500.
    critical_import_kg_per_kw:float=.3
    fabrication_kwh_per_kw:float=1000.
    factory_overhead_kw:float=100.
    earth_om_per_kw_year:float=15.
    factory_om_per_year:float=1000000.
    def validate(self):
        if self.years<1 or self.demand_kw<=0:raise ValueError('positive service horizon and demand')
        if not 0<=self.degradation<1 or self.discount<0:raise ValueError('invalid rate')
        if not 0<=self.fabrication_kwh_per_kw<8760:raise ValueError('simplified cycle requires annual net-positive fabrication')
        for k,v in asdict(self).items():
            if k not in ('demand_growth',) and v<0:raise ValueError(k)
        if self.demand_growth<=-1:raise ValueError('growth>-1')

def simulate(p=Parameters(),local=False):
    p.validate();earth=0.;loc=0.;rows=[];total=0.
    seed=p.factory_capex+p.factory_seed_kg*p.launch_per_kg if local else 0.
    total+=seed
    unit_earth=p.earth_hardware_per_kw+p.earth_mass_kg_per_kw*p.launch_per_kg
    for t in range(p.years):
        earth*=1-p.degradation;loc*=1-p.degradation
        demand=p.demand_kw*(1+p.demand_growth)**t
        overhead=p.factory_overhead_kw if local else 0.
        gap=max(0.,demand+overhead-earth-loc)
        q=0.
        if local and t>=p.factory_start_year:
            q=min(p.factory_capacity_kw_per_year,gap/(1-p.fabrication_kwh_per_kw/8760.))
        factory_load=q*p.fabrication_kwh_per_kw/8760.
        add_earth=max(0.,demand+overhead+factory_load-earth-loc-q)
        earth+=add_earth;loc+=q
        served=earth+loc-overhead-factory_load
        cost=add_earth*unit_earth+q*(p.local_cost_per_kw+p.critical_import_kg_per_kw*p.launch_per_kg)
        cost+=earth*p.earth_om_per_kw_year+(p.factory_om_per_year if local else 0.)
        discounted=cost/(1+p.discount)**t;total+=discounted
        rows.append(dict(year=t,demand_kw=demand,served_kw=served,earth_add_kw=add_earth,local_add_kw=q,
                         earth_capacity_kw=earth,local_capacity_kw=loc,factory_load_kw=factory_load,
                         cash_cost=cost,discounted_cost=discounted))
    return dict(strategy='local' if local else 'earth',parameters=asdict(p),seed_cost=seed,npv_cost=total,years=rows)

def radiator_area(power_w,temperature_k,emissivity=.9,background_k=3.):
    if power_w<0 or temperature_k<=background_k or not 0<emissivity<=1:raise ValueError('invalid radiator inputs')
    return power_w/(emissivity*SIGMA*(temperature_k**4-background_k**4))

def compare(launch_per_kg):
    p=replace(Parameters(),launch_per_kg=launch_per_kg)
    e,l=simulate(p),simulate(p,True)
    return dict(launch_per_kg=launch_per_kg,earth_npv=e['npv_cost'],local_npv=l['npv_cost'],
                saving_local=e['npv_cost']-l['npv_cost'],preferred='local' if l['npv_cost']<e['npv_cost'] else 'earth')
