import math, random, statistics

# ---------------- XP ECONOMY ----------------
CORE = {  # quest_id: (xp, category)
    "dsa_block":   (100, "MIND"),
    "build_block": (100, "CRAFT"),
    "train":       (100, "BODY"),
    "sleep_window":( 75, "RECOVERY"),
    "fuel":        ( 60, "FUEL"),
    "attention":   ( 65, "ATTENTION"),
}
CORE_TOTAL = sum(v[0] for v in CORE.values())

CATEGORY_CAP = {"MIND":200, "CRAFT":200, "BODY":150, "RECOVERY":75, "FUEL":60, "ATTENTION":65}
DAILY_CAP = 700

def level_req(n):
    """XP required to go from level n to n+1."""
    return int(round((200 + 62 * (n ** 0.98)) / 10.0) * 10)

def cum_xp(level):
    """Total XP to reach `level` from level 1."""
    return sum(level_req(n) for n in range(1, level))

def level_at(total_xp):
    lvl, spent = 1, 0
    while spent + level_req(lvl) <= total_xp:
        spent += level_req(lvl); lvl += 1
    return lvl, total_xp - spent, level_req(lvl)

# ---------------- SIMULATE AN ARC ----------------
def simulate(days=120, p_core=0.85, bonus_mean=55, seed=7):
    """p_core = probability each core quest completes on a given day."""
    rng = random.Random(seed)
    total, series = 0, []
    for d in range(1, days+1):
        day_xp = 0
        for q,(xp,cat) in CORE.items():
            if rng.random() < p_core:
                day_xp += xp
        # bonus xp (extra problems, weekly quest payouts amortised), capped
        day_xp += min(rng.gauss(bonus_mean, 25), DAILY_CAP - day_xp) if rng.random()<0.6 else 0
        day_xp = max(0, min(DAILY_CAP, int(day_xp)))
        total += day_xp
        series.append((d, day_xp, total))
    return series

print("=== LEVEL REQUIREMENTS ===")
for n in [1,2,3,5,10,15,20,25,30,35,40,45,50]:
    print(f"  L{n:>2} -> L{n+1:<2}: {level_req(n):>5} XP   (cumulative to reach L{n}: {cum_xp(n):>7})")

print("\n=== ARC OUTCOMES AT DIFFERENT PERFORMANCE LEVELS ===")
print(f"{'perf':>6} {'avg xp/day':>11} {'total XP':>9} {'L@30':>5} {'L@60':>5} {'L@90':>5} {'L@120':>6}")
for p in [0.50, 0.60, 0.70, 0.85, 0.95, 1.00]:
    runs = []
    for s in range(40):
        ser = simulate(p_core=p, seed=s)
        cum = {d:t for d,x,t in ser}
        runs.append((cum[30], cum[60], cum[90], cum[120]))
    m = [statistics.mean(r[i] for r in runs) for i in range(4)]
    lv = [level_at(x)[0] for x in m]
    print(f"{p:>6.0%} {m[3]/120:>11.0f} {m[3]:>9.0f} {lv[0]:>5} {lv[1]:>5} {lv[2]:>5} {lv[3]:>6}")

print("\n=== DAYS-PER-LEVEL AT 85% PERFORMANCE (avg ~470 xp/day) ===")
rate = 470
for band in [(1,5),(5,10),(10,15),(15,20),(20,25),(25,30),(30,35),(35,40)]:
    a,b = band
    xp = cum_xp(b) - cum_xp(a)
    print(f"  L{a}->L{b}: {xp:>6} XP = {xp/rate:>5.1f} days  ({xp/rate/(b-a):.1f} days per level)")

print("\n=== FIRST WEEK RAMP (perfect play, 500/day) ===")
t = 0
for d in range(1, 8):
    t += 500
    l, into, need = level_at(t)
    print(f"  Day {d}: total {t:>5} XP -> Level {l} ({into}/{need} into next)")

print("\n=== ANTI-GAMING: max theoretical vs honest day ===")
print(f"  Honest full day (all 6 core):        {CORE_TOTAL} XP")
print(f"  Hard daily cap:                      {DAILY_CAP} XP  (ratio {DAILY_CAP/CORE_TOTAL:.2f}x)")
print(f"  Sum of category caps:                {sum(CATEGORY_CAP.values())} XP (daily cap binds first)")
print(f"  Max grind advantage over honest day:  +{DAILY_CAP-CORE_TOTAL} XP ({(DAILY_CAP/CORE_TOTAL-1):.0%})")
print(f"  Days a grinder gains over 120 days:  {(DAILY_CAP-CORE_TOTAL)*120/ (CORE_TOTAL):.1f} equivalent days")

print("\n=== MVD (minimum viable day) FLOOR ===")
MVD = 10+10+15  # token xp for floor actions
print(f"  MVD XP: {MVD} (deliberately tiny: it protects the streak, it does not build the level)")
print(f"  MVD as % of full day: {MVD/CORE_TOTAL:.1%}  -> cannot be farmed to progress")

# ---- attribute window check ----
print("\n=== ATTRIBUTE ROLLING WINDOW SENSITIVITY (28d) ===")
for miss_days in [0,3,7,14]:
    val = 100 * (28-miss_days)/28
    print(f"  {miss_days:>2} missed days in last 28 -> attribute ~{val:.0f}/100")
