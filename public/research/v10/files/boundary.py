"""M03: abstract strategic non-interference; no operational conflict modelling."""
from dataclasses import dataclass
from itertools import product
@dataclass(frozen=True)
class Boundary:
    resource_gain: tuple=(6.,7.)
    conversion_cost: tuple=(3.,3.)
    outside_opportunity: tuple=(4.,5.)
    verifiable_forfeiture: tuple=(1.,1.)
    damage_to_other: tuple=(4.,4.)
    mutual_escalation: float=2.
    def payoff(self,p):
        if len(p)!=2 or any(x not in (0,1) for x in p):raise ValueError('two binary actions')
        out=[]
        for i in range(2):
            j=1-i
            breach=self.resource_gain[i]-self.conversion_cost[i]-self.outside_opportunity[i]-self.verifiable_forfeiture[i]
            out.append(p[i]*breach-p[j]*self.damage_to_other[i]-p[i]*p[j]*self.mutual_escalation)
        return tuple(out)
    def equilibria(self):
        result=[]
        for p in product((0,1),repeat=2):
            u=self.payoff(p);best=True
            for i in range(2):
                q=list(p);q[i]=1-q[i]
                if self.payoff(tuple(q))[i]>u[i]+1e-9:best=False
            if best:result.append(p)
        return result
    def respect_margins(self):
        return tuple(self.conversion_cost[i]+self.outside_opportunity[i]+self.verifiable_forfeiture[i]-self.resource_gain[i] for i in range(2))
