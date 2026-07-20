# Arena System

## Neon MMA Octagon

The runtime arena is stored as an independent asset at:

```text
public/assets/arenas/neon-octagon/
├── crowd/
│   ├── frame-01.webp
│   ├── frame-02.webp
│   └── frame-03.webp
├── arena-foreground-v2.png
├── arena.json
└── arena.png
```

`arena-foreground-v2.png` is a transparent foreground containing the unchanged floor, cage mesh, rails, and posts. The three WebP files contain only the audience behind the fence. `arena.png` is the original complete plate and remains the loading/error fallback. `arena.json` records every layer, source dimension, viewport crop, fighter layout, and shadow configuration.

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

## Layered audience animation

The arena uses a fixed-over-moving layer stack:

1. two adjacent crowd frames are drawn behind the cage with a smooth eased crossfade;
2. the same transparent arena foreground is drawn over them every frame;
3. fighters, particles, and the HUD are drawn over the completed fixed arena.

Only the audience changes. The floor, center logo, cage geometry, posts, mesh, camera, and arena illumination come from one immutable foreground, preventing the vibration that occurs when complete generated arena images are alternated. Each audience state lasts `2` seconds: it remains fully visible for the first 72% and crossfades during the final 28%. This makes the changed poses readable while preventing a hard cut. The complete three-state loop lasts six seconds. The compressed crowd payload is approximately 198 KB. When reduced motion is requested, the first crowd image remains static.

The three crowd frames are decoded once and use the same 1536 × 1024 crop as the fixed foreground. Canvas draws only one crowd bitmap during the 72% hold and temporarily draws the adjacent image during the short crossfade. There are no videos, animated GIFs, procedural light beams, audience sparkles, rail sweeps, per-pixel effects, or gameplay/network synchronization. This makes the crowd swap the only animated background work.

The previous cyan upper-left and magenta lower-right viewport brackets were removed. They were interface decoration rather than part of the octagon artwork and could appear as disconnected corner pieces at some sizes.

## Fighter shadows

Every fighter renders a three-part contact shadow before its sprite:

1. a soft radial falloff for the broad floor shadow;
2. a darker blurred core below the fighter's stance;
3. two compact contact ellipses aligned independently with the planted feet.

The normalized sprite cells retain approximately eight transparent pixels below the visible feet. Standing shadows compensate for that padding with a `-7` logical-pixel baseline offset. Their contact ellipses sit at `-76` and `+62` logical pixels from the fighter center and mirror with the fighter's facing direction. This preserves contact under both feet instead of placing one detached oval between them. The shadow moves with the fighter and automatically widens for attacks, knockdowns, and knockout poses. It is presentation-only and never participates in collision or network state.

## Fallback

The original complete `arena.png` is drawn until both the transparent foreground and at least one crowd image are ready. The previous procedural arena remains available as `drawLegacyOctagon` if that fallback also fails.
