# Animation Catalog

This document is the human-readable inventory for art, gameplay, and tests. `animation-manifest.js` is the executable source of truth. Generated copies of the same metadata live in each character's `movement-list.json` and each movement's `movement.json`.

## Catalog summary

Each character currently owns 36 independent movements:

| Category | Count | Purpose |
| --- | ---: | --- |
| Strikes | 8 | Left/right punches and kicks, each with head/body variants |
| Knockdowns | 10 | Five head and five body recoverable falls |
| Knockouts | 8 | Four head and four body finishes |
| Locomotion | 3 | Idle breathing plus forward and backward combat footwork |
| Defense | 4 | Stationary high/low guards plus moving high/low guard shuffles |
| Reactions | 2 | Clean head and body hit reactions |
| Legacy | 1 | Disabled prototype ground sequence |

Rook and Vex contain the same approved art at this checkpoint, but they load different file paths. Either library can therefore diverge without changing the other fighter.

## Production rules

- A modern movement uses exactly 10 frames.
- Source art faces screen-right. Runtime mirroring handles a fighter facing left.
- An attack locks its facing when it starts, preventing a mid-animation direction flip.
- Every frame has an English phase label and a stable one-based number.
- Runtime cells retain at least 6 transparent pixels around visible art.
- A kick declares both the striking leg and the opposite support leg.
- The same striking limb must remain consistent through load, contact, recoil, and recovery.
- Frame 6 is the contact frame for punches and the approved right kicks. `leftKickHead` keeps its earlier contact at frame 4.
- `sheet.png` is consumed by the game; the PNGs in `frames/` are the editable source for future frame replacement.

## Standard strike phases

| Frame | Label | Function |
| ---: | --- | --- |
| 1 | `guard` | Neutral fighting guard |
| 2 | `anticipation` | Initial tell and weight shift |
| 3 | `load` | Limb and body load |
| 4 | `extension-1` | Early extension |
| 5 | `extension-2` | Pre-contact extension |
| 6 | `contact` | Visual and gameplay contact |
| 7 | `recoil-1` | Initial withdrawal |
| 8 | `recoil-2` | Continued withdrawal |
| 9 | `recovery` | Balance recovery |
| 10 | `guard-return` | Return to neutral guard |

The early-contact left head kick uses `contact` at frame 4 and follow-through labels for frames 5–6.

## Strike list

Paths below are relative to `public/assets/characters/<characterId>/`.

| Movement ID | Limb | Target | Contact | P1 | P2 | Movement folder |
| --- | --- | --- | ---: | --- | --- | --- |
| `leftPunchHead` | Left hand | Head | 6 | `T` | `I` | `animations/strikes/head/left-punch/` |
| `rightPunchHead` | Right hand | Head | 6 | `Y` | `O` | `animations/strikes/head/right-punch/` |
| `leftPunchBody` | Left hand | Body | 6 | `Space + T` | `Shift + I` | `animations/strikes/body/left-punch/` |
| `rightPunchBody` | Right hand | Body | 6 | `Space + Y` | `Shift + O` | `animations/strikes/body/right-punch/` |
| `leftKickHead` | Left leg; right support | Head | 4 | `G` | `K` | `animations/strikes/head/left-kick/` |
| `rightKickHead` | Right leg; left support | Head | 6 | `H` | `L` | `animations/strikes/head/right-kick/` |
| `leftKickBody` | Left leg; right support | Body | 6 | `Space + G` | `Shift + K` | `animations/strikes/body/left-kick/` |
| `rightKickBody` | Right leg; left support | Body | 6 | `Space + H` | `Shift + L` | `animations/strikes/body/right-kick/` |

The approved v5 right head kick and right body kick keep the left foot planted through frame 6. The approved v5 left body punch keeps the left hand as the striking limb and the right glove protecting the face.

## Knockdown list

All knockdowns use the general sequence guard, impact, balance break, fall, mat contact, stunned state, brace, rise, and guard return.

| Movement ID | Zone | Variant | Movement folder |
| --- | --- | --- | --- |
| `headKnockdown` | Head | Backward side fall | `animations/knockdowns/head/backward-side-fall/` |
| `headKnockdownForward` | Head | Forward hands and knee | `animations/knockdowns/head/forward-hands-and-knee/` |
| `headKnockdownSeated` | Head | Rotational seated recovery | `animations/knockdowns/head/rotational-seated/` |
| `headKnockdownShoulderRoll` | Head | Corkscrew shoulder roll | `animations/knockdowns/head/corkscrew-shoulder-roll/` |
| `headKnockdownKneeDrop` | Head | Delayed one-knee recovery | `animations/knockdowns/head/delayed-one-knee/` |
| `bodyKnockdown` | Body | Side roll recovery | `animations/knockdowns/body/side-roll-recovery/` |
| `bodyKnockdownKneel` | Body | Double-knee solar plexus | `animations/knockdowns/body/double-knee-solar-plexus/` |
| `bodyKnockdownSeated` | Body | Backward seated recovery | `animations/knockdowns/body/backward-seated/` |
| `bodyKnockdownElbowFold` | Body | Compact liver elbow/hip fall | `animations/knockdowns/body/compact-liver-elbow-hip/` |
| `bodyKnockdownThreePoint` | Body | Solar-plexus three-point fall | `animations/knockdowns/body/solar-plexus-three-point/` |

## Knockout list

Knockout frames progress from guard to decisive impact, collapse, mat contact, settling, and a stable final pose.

| Movement ID | Zone | Variant | Movement folder |
| --- | --- | --- | --- |
| `headKnockout` | Head | Supine finish | `animations/knockouts/head/supine-finish/` |
| `headKnockoutProne` | Head | Forward prone finish | `animations/knockouts/head/forward-prone-finish/` |
| `headKnockoutSide` | Head | Spinning side finish | `animations/knockouts/head/spinning-side-finish/` |
| `headKnockoutKneeCollapse` | Head | Delayed double-knee side finish | `animations/knockouts/head/delayed-double-knee-side/` |
| `bodyKnockout` | Body | Curled side finish | `animations/knockouts/body/curled-side-finish/` |
| `bodyKnockoutProne` | Body | Kneeling prone finish | `animations/knockouts/body/kneeling-prone-finish/` |
| `bodyKnockoutSupine` | Body | Backward supine finish | `animations/knockouts/body/backward-supine-finish/` |
| `bodyKnockoutSeatedSlump` | Body | Seated side slump | `animations/knockouts/body/seated-side-slump/` |

## Support and legacy movements

Every support action is an independent 10-frame movement. Forward and backward movement now use dedicated fluid cycles, while guard transitions remain separate from guard locomotion so neither the torso nor the legs freeze.

| Movement ID | Purpose | Movement folder |
| --- | --- | --- |
| `idleBreathing` | Subtle combat-ready breathing while stationary | `animations/locomotion/idle-breathing/` |
| `footworkForward` | Forward step | `animations/locomotion/forward-step/` |
| `footworkBackward` | Backward step and evade pose source | `animations/locomotion/backward-step/` |
| `guardHigh` | High guard and high block reaction | `animations/defense/high-guard/` |
| `guardLow` | Low guard and low block reaction | `animations/defense/low-guard/` |
| `guardHighFootwork` | High guard with animated advancing/retreating legs | `animations/defense/high-guard-footwork/` |
| `guardLowFootwork` | Low guard with animated advancing/retreating legs | `animations/defense/low-guard-footwork/` |
| `hitReactionHead` | Clean/critical head recoil | `animations/reactions/head-hit/` |
| `hitReactionBody` | Clean/critical body recoil | `animations/reactions/body-hit/` |
| `legacyGround` | Preserved disabled grappling prototype | `animations/legacy/ground-sequence/` |

## Runtime selection

`game.js` assigns `characterId: "rook"` to Player 1 and `characterId: "vex"` to Player 2. The renderer selects `ANIMATIONS[characterId][movementId]`. Both libraries use canonical right-facing artwork, and `facing` mirrors the selected frame toward the opponent.

At runtime, stationary fighters use a two-second floor-anchored breathing transform over an identical planted pose. Normal footwork loops at 11 fps. Guard footwork loops at 10 fps and reverses the same coherent sequence when retreating, keeping the library compact without sacrificing directional motion.

## Verification

Run:

```bash
npm run sprites:validate
npm run check
npm test
```

Validation checks all character/movement mappings, metadata files, frame files, atlas dimensions, alpha channels, grid capacity, empty reserved cells, cell padding, source facing, limb locks, and labeled contact frames.
