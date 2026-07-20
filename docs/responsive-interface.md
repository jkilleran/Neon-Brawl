# Responsive Interface

## One shared viewport

The Canvas, HUD, main menu, online lobby, pause dialog, round messages, and result scorecard all live inside `#game-viewport`. That container always keeps a 16:9 aspect ratio, so the arena plate, fighters, effects, hit positions, and interface cannot scale at different rates.

Fullscreen mode centers the same viewport and adds natural letterboxing on screens that are wider, taller, or portrait-oriented. The logical game resolution remains 1280 × 720 while the Canvas backing store scales up to 2× on high-density displays.

## Container breakpoints

Menu adaptation is based on the rendered game viewport instead of the browser window. This is important when the game is embedded, displayed beside development tools, or letterboxed in fullscreen.

- Above 1000 px: full competitive presentation with fighter card and complete labels.
- 1000 px and below: compressed navigation, dialogs, lobby rows, pause controls, and scorecards.
- 720 px and below: single-column main menu, hidden decorative fighter card, compact actions, and edge-safe dialogs.
- 520 px and below: essential labels only, vertically scrollable dialogs, compact online controls, and horizontally scrollable score tables.

The scorecard keeps its complete statistics at small sizes through local horizontal scrolling instead of deleting match information. The pause and online panels use bounded vertical scrolling so every action remains reachable.

## Arena image behavior

Responsive rules do not resize or crop the arena independently. The source plate is first cropped into the fixed 1280 × 720 logical composition, then the complete game viewport is uniformly scaled. This prevents stretching on phones, tablets, ultrawide displays, and televisions.

## Fighter grounding

Standing fighters use a broad ambient shadow plus two compact contact ellipses placed below the left and right foot. The contact points mirror with fighter direction. They also compensate for transparent padding inside the normalized sprite frames, which prevents the characters from appearing to float above the floor.
