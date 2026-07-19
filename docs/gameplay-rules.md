# Gameplay Rules

This document records the current Neon Brawl balance. Executable values live in `GAMEPLAY_RULES` inside `game.js`.

## Match format

- A regulation match has three rounds.
- Each round lasts 180 seconds (`3:00`).
- Decisions use the existing 10-9 scoring system.
- Accumulated knockdown count is a statistic and scoring input; it never triggers an automatic TKO.

## Post-fight scorecard

Every completed CPU, local, or online match stores a separate record for each round. The final screen displays, for both fighters:

- judge score for the round;
- strikes thrown;
- clean/critical strikes landed;
- strikes missed or evaded;
- strikes absorbed by the matching guard;
- landing accuracy;
- total damage;
- round result or finish method.

Blocked strikes are tracked independently and do not count as landed. A strike interrupted before contact counts as missed. Decision rounds preserve the current 10-9 scoring rule. A finish round is recorded as 10-8 for summary purposes and retains the actual KO method in the result column.

## Practice Lab

- Practice has no time limit and cannot end through KO/TKO.
- Every impact displays final damage to two decimal places at the contact point.
- Indicators distinguish `BLOCK` and `CRIT` results.
- Depleting head or body health schedules a short automatic dummy reset.

## Damage and stamina cost

- A normal standing strike uses `0.40375 ×` base damage.
- Critical strikes preserve `0.425 ×` base damage before the critical multiplier.
- Body strikes receive an additional `0.85 ×` multiplier.
- A clean or critical strike costs `1.0 ×` its base stamina value.
- A missed, evaded, or blocked strike costs `1.5 ×` total: the normal initial cost plus a `0.5 ×` inefficiency penalty.
- Final damage also considers range, current stamina, long-term stamina capacity, and counter conditions.

## Two-layer stamina

One bar displays two related values:

- Bright segment: immediately available stamina.
- Dim segment: the long-term cap that short-term stamina can recover to.
- Dark segment: long-term stamina already lost.

Every strike slightly lowers the cap. Throwing below 35% of the current reserve accelerates long-term loss, and fully emptying the bar adds an immediate penalty. The long-term cap cannot fall below 35%. A fighter recovers four cap points between rounds; the cap does not automatically return to 100.

## Critical hits

An unblocked impact becomes critical through either route below.

### Movement counter

Both conditions must be true:

1. The attacker begins the strike nearly stationary (`≤ 38 px/s`).
2. The target is moving at impact (`≥ 70 px/s`).

### Health vulnerability

- Only the health bar targeted by the strike is checked.
- The required threshold changes by round: below `45%` in round 1, `65%` in round 2, and `75%` in round 3.
- Below the applicable threshold, the strike has a `1 / 3.5` chance (`2 / 7`, about `28.57%`) to become critical even without the movement-counter condition.
- Low body health cannot make a head strike vulnerable-critical, and low head health cannot affect a body strike.
- Thresholds are strict. Exactly `45%`, `65%`, or `75%` does not enable that round's vulnerability roll.

A critical multiplies damage by `1.75`, applies one second of stun, and increases knockback, particles, hit-stop, flash, and camera movement.

Each unblocked critical then performs one knockdown roll at `1 / 2.2` (`5 / 11`, about `45.45%`). A successful roll uniformly selects one of the five knockdown movements for the impacted zone. Practice mode does not interrupt the session with a knockdown.

## Distance and contact

- Fighter centers remain at least `168 px` apart to prevent visual overlap.
- All standing strikes can connect with the correct anatomical zone at `178 px` or less during active frames.
- At `179 px` or more, a strike misses and receives the stamina inefficiency penalty.
- Contact assistance only decides whether a hit exists; impact markers and damage values use the resolved head/body surface point.

## Knockdowns and knockouts

- Five recoverable head knockdowns and five recoverable body knockdowns are selected uniformly by zone.
- Four head knockout finishes and four body knockout finishes are selected uniformly by zone.
- A body finish uses the `BODY K.O.` presentation.
- The result banner waits `1.15 s`, allowing the fall to play before the result appears.
- The final result screen appears after the finish sequence.
- There is no maximum number of knockdowns before a damage-based finish.

The complete visual variant list is maintained in [Animation Catalog](animation-catalog.md).

## Impact readability

- `BLOCKED`: short guard recoil, minimal particles, and minimal camera response.
- `CLEAN HIT`: zone-specific reaction with medium effects.
- `CRITICAL HIT`: prolonged reaction, added displacement/rotation, white flash, and maximum effects.
