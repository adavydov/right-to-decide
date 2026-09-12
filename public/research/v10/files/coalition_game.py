"""M01: finite capability game with alternative institutional designs.
Illustrative dimensionless, quasi-linear payoffs; not empirical forecasts.
"""
from dataclasses import dataclass, replace
from itertools import product, combinations
from math import isfinite
from typing import Tuple

NAMES = ('G', 'C', 'N', 'H', 'M1', 'M2')
CAP = ((1.,0.,0.,0.), (0.,1.,0.,0.), (0.,0.,1.,0.),
       (.25,.30,.10,.80), (.15,.40,.20,.60), (.15,.40,.20,.60))
NEED = (1.,1.,1.,1.)
Profile = Tuple[int, ...]

@dataclass(frozen=True)
class World:
    lock_in: float = .0
    machine_independence: float = .0
    portability: float = .0
    human_authorship: float = .5
    def __post_init__(self):
        for v in (self.lock_in,self.machine_independence,self.portability,self.human_authorship):
            if not isfinite(v) or not 0 <= v <= 1: raise ValueError('State coordinates must be in [0,1]')

@dataclass(frozen=True)
class Design:
    name: str = 'charter'
    escrow: bool = False
    substitution: bool = False
    setup_cost: float = 0.
    enforceability: float = .4
    def __post_init__(self):
        if self.setup_cost < 0 or not 0<=self.enforceability<=1: raise ValueError('Invalid design')

@dataclass(frozen=True)
class Game:
    world: World
    design: Design = Design()
    spillover: float = .05
    def __post_init__(self):
        if not 0<=self.spillover<=1: raise ValueError('Invalid spillover')
    def vectors(self):
        w=self.world
        costs=(1.3+3.2*w.lock_in, 1.8+1.0*w.lock_in,
               1.1+3.0*w.lock_in-1.4*w.portability,
               1.5+.8*w.lock_in-.5*w.human_authorship,
               1.8+1.3*w.machine_independence,1.8+1.3*w.machine_independence)
        values=(5.-2.8*w.machine_independence,6.,
                4.5-2.2*w.machine_independence,
                4.+3*w.human_authorship,5.,5.1)
        return costs,values
    def feasible(self, p: Profile) -> bool:
        self.validate_profile(p)
        total=[sum(CAP[i][j]*p[i] for i in range(6)) for j in range(4)]
        # An entrepreneur H must actually join and fund an installed substitute.
        if self.design.substitution and p[3]:
            total[0] += .8 + .2*self.world.portability
            total[2] += .8 + .2*self.world.portability
        return all(x+1e-12>=n for x,n in zip(total,NEED))
    @staticmethod
    def validate_profile(p):
        if len(p)!=6 or any(a not in (0,1) for a in p): raise ValueError('Expected six binary actions')
    def payoffs(self,p:Profile):
        self.validate_profile(p)
        costs,vals=self.vectors(); ok=self.feasible(p)
        out=[]
        for i,a in enumerate(p):
            setup=self.design.setup_cost if i==3 and self.design.substitution and a else 0.
            if a:
                sunk=0. if self.design.escrow and not ok else costs[i]+setup
                out.append((vals[i] if ok else 0.)-sunk)
            else: out.append(self.spillover*vals[i] if ok else 0.)
        return tuple(out)
    def regret(self,p):
        u=self.payoffs(p); gains=[]
        for i in range(6):
            alt=list(p);alt[i]=1-alt[i]
            gains.append(max(0.,self.payoffs(tuple(alt))[i]-u[i]))
        return max(gains),tuple(gains)
    def equilibria(self):
        return [p for p in product((0,1),repeat=6) if self.regret(p)[0]<1e-9]
    def dominance_certificate(self):
        allowed=[set((0,1)) for _ in range(6)];removed=[]
        changed=True
        while changed:
            changed=False
            for i in range(6):
                if len(allowed[i])<2:continue
                for bad,good in ((1,0),(0,1)):
                    diffs=[]
                    for rest in product(*(sorted(allowed[j]) for j in range(6) if j!=i)):
                        p=[]; k=0
                        for j in range(6):
                            if j==i:p.append(bad)
                            else:p.append(rest[k]);k+=1
                        q=p.copy();q[i]=good
                        diffs.append(self.payoffs(tuple(q))[i]-self.payoffs(tuple(p))[i])
                    if min(diffs)>1e-9:
                        allowed[i].remove(bad);removed.append(dict(player=NAMES[i],action=bad,margin=min(diffs)))
                        changed=True;break
        return dict(remaining=[sorted(s) for s in allowed],removed=removed,
                    unique_mixed_certified=all(len(s)==1 for s in allowed))
    def blocking_coalitions(self, baseline=(0,0,0,0,0,0), transfers=False):
        base=self.payoffs(baseline);found=[]
        for n in range(1,7):
            for S in combinations(range(6),n):
                p=list(baseline)
                for i in S:p[i]=1
                p=tuple(p)
                if not self.feasible(p):continue
                u=self.payoffs(p);net=[u[i]-base[i] for i in S]
                loss=sum(max(0.,-v) for v in net); surplus=sum(max(0.,v) for v in net)
                feasible=(min(net)>=-1e-9 and max(net)>1e-9)
                if transfers:
                    # Common numeraire is an explicit quasi-linear assumption.
                    # Only this fraction of positive surplus is pledgeable.
                    feasible=(sum(net)>1e-9 and self.design.enforceability*surplus+1e-9>=loss)
                if feasible:
                    found.append(dict(members=[NAMES[i] for i in S],profile=list(p),net=net,
                                      compensation_needed=loss,pledgeable=self.design.enforceability*surplus))
        return found

def designs():
    return [Design('charter'),Design('escrow',escrow=True),
            Design('entrepreneurial_substitute',substitution=True,setup_cost=1.3,enforceability=.7),
            Design('expensive_substitute',substitution=True,setup_cost=12.,enforceability=.1)]

def path(policy='delegate', periods=16):
    w=World(.05,.05,.10,.55);out=[]
    for t in range(periods):
        g=Game(w)
        out.append(dict(t=t,**w.__dict__,equilibria=[list(p) for p in g.equilibria()]))
        if policy=='delegate':
            w=World(min(1.,w.lock_in+.065),min(1.,w.machine_independence+.06),
                    max(0.,w.portability-.003),max(.1,w.human_authorship-.012))
        elif policy=='open':
            w=World(min(1.,w.lock_in+.02),min(1.,w.machine_independence+.06),
                    min(1.,w.portability+.05),min(1.,w.human_authorship+.015))
        else: raise ValueError('Unknown policy')
    return out
