# Locomotion Animation System

## Goals

The locomotion layer keeps both fighters alive between attacks without changing their established proportions, clothing, stance, or line-art style. Every modern cycle has exactly 10 frames and every character owns an independent copy of every movement.

## Movement map

| Runtime state | Movement ID | Playback |
| --- | --- | --- |
| Stationary, no guard | `idleBreathing` | 1.8-second code-driven knee flex on a planted pose |
| Advancing, no guard | `footworkForward` | Forward loop at 11 fps |
| Retreating, no guard | `footworkBackward` | Forward loop at 11 fps |
| Stationary high guard | `guardHigh` | Guard transition and hold |
| Moving high guard | `guardHighFootwork` | 10 fps; reversed when retreating |
| Stationary low guard | `guardLow` | Guard transition and hold |
| Moving low guard | `guardLowFootwork` | 10 fps; reversed when retreating |

The movement-speed threshold is shared by normal and guarded locomotion. A guard locomotion cycle starts only after the guard transition is at least 92% complete, preventing the arms from snapping directly into a moving pose. Idle stance motion eases into a 1.5% knee flex around the floor anchor, then returns to the starting posture, so the feet never slide or lift.

## Art contract

- Each source sheet is a 5 × 2 grid containing exactly 10 isolated frames.
- Canonical artwork faces screen-right; runtime mirroring handles the opposite side.
- The fighter is normalized into a 330 × 310 presentation box on a common baseline.
- Both feet, hips, torso, gloves, shorts, and head must remain anatomically coherent through the complete loop.
- All ten idle cells share the exact same planted silhouette. Runtime applies a subtle floor-anchored athletic flex and return; feet and stance width never change.
- Normal footwork keeps a loose combat guard. It must not look like a casual walk or a full blocking guard.
- Guard footwork must keep the declared high or low coverage while the legs visibly advance or retreat.
- The final stationary low guard remains approximately 79% as tall as the standing silhouette because of the crouch, and moving low guard remains approximately 80%. The entry frame starts at standing scale, preserving anatomical size through the transition.
- Frame 1 and frame 10 must connect cleanly so the loop does not pop.

## Source and runtime locations

Normalized source sheets are preserved under:

```text
public/assets/characters/prototype-fighter/source-archive/original-assets/animations/support/
```

Rook and Vex runtime movements live independently under:

```text
public/assets/characters/<characterId>/animations/locomotion/
public/assets/characters/<characterId>/animations/defense/
```

Each runtime movement contains `movement.json`, `sheet.png`, and 10 editable PNG files in `frames/`.

## Import and verification

Normalize a reviewed transparent 5 × 2 source grid with:

```bash
npm run sprites:import -- <transparent-grid.png> <normalized-sheet.png>
```

After registering or replacing the movement, rebuild its runtime sheet and verify the complete library:

```bash
npm run sprites:build -- <characterId> <movementId>
npm run check
npm test
npm run build
```
