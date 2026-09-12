"""M02: scenario dynamics of choices/preferences, NOT a solved mean-field game.
Interventions are abstract scenario effects, not estimates of medical treatments.
"""
from dataclasses import dataclass, replace
from math import exp
@dataclass(frozen=True)
class Group:
    share: float
    authorship: float
    comfort: float
    status: float
    capability: float

def softmax(values,tau=.4):
    if tau<=0:raise ValueError('tau>0')
    m=max(values);e=[exp((x-m)/tau) for x in values];z=sum(e)
    return tuple(x/z for x in e)

def intervention(g:Group, mode:str, strength=.2):
    if not 0<=strength<=1:raise ValueError('strength in [0,1]')
    clamp=lambda x:min(2.,max(.05,x))
    if mode=='none':return g
    if mode=='self_authored':
        return Group(g.share,clamp(g.authorship+strength),g.comfort,g.status,clamp(g.capability+strength))
    if mode=='normalizing':
        return Group(g.share,clamp(g.authorship-strength),clamp(g.comfort+strength),g.status,clamp(g.capability+.4*strength))
    if mode=='curiosity':
        return Group(g.share,clamp(g.authorship+.4*strength),g.comfort,g.status,clamp(g.capability+1.4*strength))
    raise ValueError('Unknown mode')

def scores(g,access=.5,service=1.,status_return=.8):
    return (g.authorship*g.capability*access-.25,
            g.comfort*service-.08,
            g.status*status_return-.12)

def appraisal_scores(current, value_weights, access=.5, service=1., status_return=.8):
    """Evaluate current opportunities with another set of value weights.

    Capability is an outcome of the current history, not a preference to freeze.
    """
    evaluator=replace(current,authorship=value_weights.authorship,
                      comfort=value_weights.comfort,status=value_weights.status)
    return scores(evaluator,access=access,service=service,status_return=status_return)

def run(mode='none', periods=40,access=.65,learning=.025):
    groups=[Group(.4,1.2,.7,.5,.7),Group(.4,.6,1.1,.5,.6),Group(.2,.7,.7,1.3,.8)]
    baseline=groups.copy(); rows=[]
    for t in range(periods):
        if t==5:groups=[intervention(g,mode) for g in groups]
        ps=[softmax(scores(g,access=access)) for g in groups]
        aggregate=tuple(sum(g.share*p[j] for g,p in zip(groups,ps)) for j in range(3))
        # Keep old-self and current-self appraisals separate.
        exante=sum(g.share*sum(p[j]*appraisal_scores(g,old,access=access)[j] for j in range(3)) for g,old,p in zip(groups,baseline,ps))
        expost=sum(g.share*sum(p[j]*scores(g,access=access)[j] for j in range(3)) for g,p in zip(groups,ps))
        rows.append(dict(t=t,create=aggregate[0],delegate=aggregate[1],compete=aggregate[2],
                         old_weights_value=exante,current_weights_value=expost,
                         average_capability=sum(g.share*g.capability for g in groups),
                         average_authorship=sum(g.share*g.authorship for g in groups)))
        updated=[]
        for g,p in zip(groups,ps):
            # Modest experience feedback, reversible in this reduced model.
            a=min(2.,max(.05,g.authorship+learning*(p[0]-.35*p[1])))
            k=min(2.,max(.05,g.capability+learning*(p[0]-.2*p[1])))
            updated.append(Group(g.share,a,g.comfort,g.status,k))
        groups=updated
    return rows
