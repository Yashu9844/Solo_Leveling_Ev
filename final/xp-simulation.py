import random, statistics

# FINAL ECONOMY — now including uncapped grants (weekly / boss / recovery),
# which the earlier simulation omitted. See CLARIFICATIONS C-3.
CORE = {"career":(100,"CAREER"),"dsa":(100,"MIND"),"build":(100,"CRAFT"),
        "training":(100,"BODY"),"sleep":(60,"SLEEP"),"attention":(40,"ATTENTION")}
CORE_TOTAL = sum(v[0] for v in CORE.values())
CATEGORY_CAP = {"CAREER":140,"MIND":200,"CRAFT":200,"BODY":150,
                "SLEEP":60,"ATTENTION":40,"LEARN":75,"MAINT":20}
DAILY_CAP = 700   # applies to capped categories only

def req(n, c=75): return int(round((200 + c*(n**0.98))/10.0)*10)
def cum(l, c=75): return sum(req(n,c) for n in range(1,l))
def level_at(x, c=75):
    l,s=1,0
    while s+req(l,c)<=x: s+=req(l,c); l+=1
    return l

def day_xp(rng, p):
    cat={k:0 for k in CATEGORY_CAP}
    for q,(xp,c) in CORE.items():
        if rng.random()<p: cat[c]+=xp
    if cat["MIND"]:
        for _ in range(rng.choice([0,1,1,2,2,3])): cat["MIND"]+=rng.choice([15,25,25,40])
        if rng.random()<0.35: cat["MIND"]+=20
    if cat["CRAFT"] and rng.random()<0.30: cat["CRAFT"]+=50
    if cat["CAREER"]: cat["CAREER"]+=10*rng.choice([0,0,1,2,3,4])
    if cat["BODY"] and rng.random()<0.55: cat["BODY"]+=20
    if rng.random()<p*0.8: cat["LEARN"]+=25*rng.choice([0,1,1,2])
    if rng.random()<p: cat["MAINT"]+=20
    capped = min(sum(min(v,CATEGORY_CAP[k]) for k,v in cat.items()), DAILY_CAP)

    # UNCAPPED grants — exempt from category caps AND the daily cap,
    # because each is frequency-limited rather than volume-limited.
    uncapped = 0
    if rng.random() < (1-p)*0.45: uncapped += 40          # recovery quest
    return capped, uncapped

def simulate(days=120, p=0.85, seed=1, coeff=75):
    rng=random.Random(seed); tot=0; series=[]
    for d in range(1,days+1):
        c,u = day_xp(rng,p); tot += c+u
        if d % 7 == 0:                                     # weekly quest payouts
            tot += sum(200 for _ in range(2) if rng.random()<p)
        if d in (32,68,92,118):                             # boss windows
            if rng.random() < p+0.10: tot += 500
        series.append((d,tot))
    return dict(series)

for coeff in [75, 80, 84]:
    print(f"=== coefficient {coeff} ===")
    print(f"{'perf':>6} {'total':>7} {'xp/day':>7} {'L@30':>5} {'L@60':>5} {'L@90':>5} {'L@120':>6}")
    for p in [0.50,0.60,0.70,0.85,0.95,1.00]:
        runs=[simulate(p=p,seed=s) for s in range(60)]
        m=[statistics.mean(r[d] for r in runs) for d in (30,60,90,120)]
        lv=[level_at(x,coeff) for x in m]
        print(f"{p:>6.0%} {m[3]:>7.0f} {m[3]/120:>7.0f} {lv[0]:>5} {lv[1]:>5} {lv[2]:>5} {lv[3]:>6}")
    print()
