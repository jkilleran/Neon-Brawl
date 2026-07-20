# Competitive HUD

## Design goal

The combat HUD communicates tactical condition without exposing exact head or body health percentages. The underlying gameplay values remain unchanged; only their presentation is abstracted into readable condition states.

The visual language intentionally follows the cel-shaded fighters: rounded dark cards, bold outlines, flat accent colors, and circular condition badges. Angular sci-fi polygons and hard segmented meters are avoided so the interface belongs to the same illustrated world as the character sprites.

## Layout

Each fighter panel contains:

- fighter name and style;
- a head-condition icon;
- a body-condition icon;
- one continuous stamina meter;
- round-win indicators.

The center module contains the round clock, current round, game mode, and online latency when applicable.

## Health condition states

Head and body use their independently smoothed display values. Both icons follow the same four states:

| Display health | State | Color | Presentation |
| --- | --- | --- | --- |
| 70–100 | Stable | Mint | Calm glow |
| 45–69 | Worn | Yellow | Increased glow |
| 20–44 | Danger | Orange | Strong glow |
| 0–19 | Critical | Red | Strong glow and subtle pulse |

No percentage, numeric value, or health bar is shown during combat. Head and body remain mechanically separate for damage, vulnerability criticals, knockdowns, knockouts, stamina capacity, scoring, and practice resets.

## Stamina meter

Stamina is the only continuous fighter meter:

- the bright section is current short-term stamina;
- the translucent section is the long-term recoverable capacity;
- the amber marker identifies the current long-term cap;
- fill direction mirrors for the right-side fighter;
- meter color follows the fighter's cyan or magenta identity;
- the meter uses one continuous clipped fill without an additional outer capsule or double border.

## Maintenance

The thresholds are defined in `HUD_HEALTH_STATES` in `game.js`. Icon geometry is isolated in `drawHeadHealthGlyph` and `drawBodyHealthGlyph`; rounded panel geometry is shared through `traceRoundedRect`; panel composition is isolated in `drawHudFrame`, `drawFighterHud`, `drawHealthStatusIcon`, and `drawStaminaBar`. These presentation functions do not modify combat state.
