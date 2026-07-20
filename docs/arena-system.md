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

The complete game viewport always remains 16:9. Regular layouts scale the viewport uniformly, and fullscreen centers the same 16:9 surface with letterboxing when the physical screen has a different aspect ratio. The background, HUD, fighters, effects, and menus therefore cannot stretch independently. The Canvas backing resolution scales up to 2× for high-density displays while all gameplay continues to use the fixed 1280 × 720 logical coordinate system.

The approved photograph is safe for phones, tablets, laptops, TVs, ultrawide monitors, and portrait displays because its crop is calculated inside the logical Canvas and never from the physical screen ratio. The 1536 × 1024 source may look softer when enlarged to extreme 4K output, but it will not deform. A future higher-resolution arena can replace `arena.png` without changing the renderer or gameplay coordinates.

## Living arena lighting

The arena remains one static bitmap. A lightweight procedural pass is drawn immediately after the background and before fighters, particles, and the HUD. It adds four restrained ambient layers:

1. slow cyan and magenta side-light breathing;
2. a two-pixel cage-rail glow;
3. twelve tiny audience lights with independent phases;
4. one translucent floor reflection crossing the mat every 14 seconds.

This avoids additional network downloads, multi-frame image decoding, texture swaps, and frame synchronization. The existing Canvas already redraws for gameplay, so the animation adds only a small number of gradients and primitive shapes behind the fighters. When the operating system requests reduced motion, the light sweep is disabled and all ambient lighting becomes static.

The previous cyan upper-left and magenta lower-right viewport brackets were removed. They were interface decoration rather than part of the octagon artwork and could appear as disconnected corner pieces at some sizes.

## Fighter shadows

Every fighter renders a three-part contact shadow before its sprite:

1. a soft radial falloff for the broad floor shadow;
2. a darker blurred core below the fighter's stance;
3. two compact contact ellipses aligned independently with the planted feet.

The normalized sprite cells retain approximately eight transparent pixels below the visible feet. Standing shadows compensate for that padding with a `-7` logical-pixel baseline offset. Their contact ellipses sit at `-76` and `+62` logical pixels from the fighter center and mirror with the fighter's facing direction. This preserves contact under both feet instead of placing one detached oval between them. The shadow moves with the fighter and automatically widens for attacks, knockdowns, and knockout poses. It is presentation-only and never participates in collision or network state.

## Fallback

The previous procedural arena remains available as `drawLegacyOctagon`. It is drawn only while the arena image is unavailable or has failed to load.
