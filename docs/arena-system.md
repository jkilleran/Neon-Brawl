# Arena System

## Neon MMA Octagon

The runtime arena is stored as an independent asset at:

```text
public/assets/arenas/neon-octagon/
├── arena.json
└── arena.png
```

`arena.png` is the clean arena plate without fighters or HUD elements. `arena.json` records its source dimensions, viewport crop, fighter layout, and shadow configuration so the background can be replaced without searching through gameplay code.

## Viewport composition

The source plate is 1536 × 1024 while the game Canvas is 1280 × 720. The renderer keeps the complete horizontal composition and crops the vertical excess with a `0.35` top-weighted anchor. For this source image, the effective crop is:

```text
x: 0, y: 56, width: 1536, height: 864
```

This aligns the reference composition with the existing gameplay coordinates:

- Rook spawn: `x = 380`;
- Vex spawn: `x = 900`;
- shared floor: `y = 604`;
- fighter render height: `350`.

The gameplay coordinates, hit zones, strike reach, minimum distance, and online snapshots therefore remain unchanged.

## Fighter shadows

Every fighter renders a two-layer contact shadow before its sprite:

1. a soft radial falloff for the broad floor shadow;
2. a darker blurred core directly below the planted feet.

The shadow moves with the fighter and automatically widens for attacks, knockdowns, and knockout poses. It is presentation-only and never participates in collision or network state.

## Fallback

The previous procedural arena remains available as `drawLegacyOctagon`. It is drawn only while the arena image is unavailable or has failed to load.
