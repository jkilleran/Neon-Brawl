# Neon Brawl MMA

Neon Brawl is a lightweight browser MMA game built with Canvas and plain JavaScript. It combines arcade presentation with tactical distance, two-layer stamina, separate head/body health, guards, critical counters, knockdowns, knockouts, three-round scoring, practice mode, and a testable online arena.

## Run locally in Visual Studio Code

```bash
git clone https://github.com/jkilleran/Neon-Brawl.git
cd Neon-Brawl
npm install
npm run dev
```

Open the address printed by Vite, normally `http://localhost:5173`.

To test the complete online stack in two browser tabs:

```bash
npm run dev:online
```

Open `http://localhost:3000` in both tabs, enter two different fighter names, and challenge one session from the other.

## Controls

Open Settings directly from the main menu, the header gear, or the local pause screen. The panel is organized into General, Keyboard, Gamepad, and Touch categories. It identifies the last input method used by each player and, when opened from a paused fight, jumps directly to that method's mapping. Keyboard, gamepad, and all ten touch actions can be reassigned. Touch buttons can also be dragged to custom screen positions. Mappings and positions persist in the current browser. If a replacement is already in use by that player or layout, the two actions swap safely.

| Action | Player 1 / Rook | Player 2 / Vex |
| --- | --- | --- |
| Advance | `D` | `←` |
| Retreat | `A` | `→` |
| High guard | `W` | `↑` |
| Low guard | `S` | `↓` |
| Left punch | `T` | `I` |
| Right punch | `Y` | `O` |
| Left kick | `G` | `K` |
| Right kick | `H` | `L` |
| Body modifier | Hold `Space` + strike | Hold `Shift` + strike |
| Evade | `E` | `P` |
| Pause | `Esc` | `Esc` |

Without a modifier, strikes target the head. Hold that player's modifier while pressing a strike key to use the body variant.

Takedowns and ground control remain disabled. Their prototype logic and legacy sprites are preserved for a future grappling animation pass.

In Online Arena, both players use the Player 1 keyboard layout on their own computer. Online matches cannot be paused.

Standard Xbox- and PlayStation-style controllers are detected automatically. The first connected controller controls Player 1 and the second controls Player 2 in Local Sparring. By default, `RT / R2` holds high guard, `LT / L2` modifies strikes to the body, and holding both triggers produces low guard. Face buttons throw the four strikes; `LB / L1`, `RB / R1`, and evade remain unassigned until the player maps them. Direct actions are remappable per player, Delete clears the selected assignment, and low guard always follows the assigned High Guard + Body Modifier chord. The left stick always moves and Menu / Options remains reserved for pause.

Optional touch controls can be set to Auto, Visible, or Hidden. Their ten gameplay actions can be reassigned while preserving one button per action, and every button can be repositioned through the graphical drag-and-drop editor. The default Body Modifier sits on the left side, the four strikes form a compact two-by-two quadrant, and dragging from either guard onto a movement button keeps the guard held while moving. Touch controls do not change Canvas resolution or gameplay timing. See [Universal Input and Settings](docs/input-system.md) for the complete mapping and architecture.

## Online Arena

The first online version includes:

- live presence count for players currently searching;
- a lobby roster with direct challenge buttons;
- accept and decline controls for incoming challenges;
- neutral server-authoritative gameplay for equal challenger and challenged-player timing;
- visible server round-trip latency with connection-quality grading;
- explicit connected and outgoing-challenge states in the lobby;
- immediate action delivery from both players to a fixed 60 Hz server simulation;
- 30 Hz authoritative snapshots sent from the same server frame to both players;
- identical local prediction for each player's movement, guard changes, and strike animation startup;
- non-rewinding guard transitions with frame-count-aware interpolation for local and remote fighters;
- stable strike-to-guard recovery even when the authoritative attack snapshot arrives late;
- per-player input acknowledgements, bounded motion extrapolation, and smooth reconciliation;
- screen-direction WASD online movement (`A` left, `D` right), including the right-side fighter;
- defensive snapshot validation and visual fallbacks so malformed remote state cannot hide a fighter;
- a two-player ready barrier and server clock that continues when either browser is hidden;
- stale-snapshot shedding when a slow connection starts buffering;
- browser-side snapshot coalescing and one-time server serialization for lower render and server overhead;
- automatic WebSocket keepalive and reconnect attempts;
- automatic return to the lobby when an opponent leaves;
- one Node service serving both the Vite build and `/ws` WebSocket endpoint.

The lobby is intentionally ephemeral and in-memory. Deploy exactly one Render instance for this test version. See [Online Mode and Render Deployment](docs/online-mode.md).

## Character sprite libraries

Rook and Vex now have independent, self-contained sprite libraries:

```text
public/assets/characters/
├── rook/
│   ├── character.json
│   ├── movement-list.json
│   └── animations/...
├── vex/
│   ├── character.json
│   ├── movement-list.json
│   └── animations/...
└── prototype-fighter/source-archive/original-assets/...
```

Each movement folder contains `movement.json`, the runtime `sheet.png`, and a `frames/` directory with individually named PNGs. This makes it possible to replace one frame or one complete movement for only one character.

Rook and Vex retain their approved classic sheets. New characters use the `production15` animation profile: 15 labeled frames per movement in a 5 × 3 atlas. The runtime supports both profiles in the same match without duplicating legacy frames.

See [Character Sprite Library](docs/character-sprite-library.md) for maintenance workflows and [Animation Catalog](docs/animation-catalog.md) for the complete movement inventory.

## Sprite commands

```bash
npm run sprites:list
npm run sprites:validate
npm run sprites:build -- rook leftPunchHead
npm run sprites:catalog -- rook
```

After replacing an individual frame, rebuild only that movement with `sprites:build`, then run the project validation commands.

## Validation

```bash
npm run check
npm test
npm run build
```

`npm run check` verifies the manifest, per-character catalogs, atlas dimensions, frame dimensions, alpha isolation, canonical facing, and movement continuity metadata.

## Gameplay highlights

- Two-level mode selection that cleanly separates Local and Online play
- Competitive HUD with condition-based head/body icons and one layered stamina meter
- Dedicated Neon MMA arena plate with reference-aligned fighter placement and dual-foot contact shadows
- Fixed transparent cage and floor over a 2.1-second low/takeoff/jump-apex crowd loop with no procedural lighting pass
- Aspect-safe 16:9 viewport, fullscreen letterboxing, high-density Canvas rendering up to 2×, and container-responsive menus
- Context-aware Settings with active-device detection, trigger-chord gamepad defense, persistent remapping, and a draggable performance-safe touch overlay
- Quick Fight, Local Sparring, and infinite-time Practice Lab
- Three 3-minute rounds with 10-9 scoring
- Separate head and body damage
- Short-term stamina plus a recoverable long-term cap
- Extra stamina cost for misses and blocked strikes
- Clean, blocked, and critical visual reactions
- Movement counters and round-dependent vulnerability criticals
- Five head and five body knockdown variants
- Four head and four body knockout variants
- Minimum fighter spacing and assisted contact at valid strike distance
- No automatic TKO based on accumulated knockdown count
- Per-round scorecards with strikes thrown, landed, missed, blocked, accuracy, damage, and 10-point scoring
- Online lobby, direct challenges, and synchronized friend matches

Exact balance values are documented in [Gameplay Rules](docs/gameplay-rules.md).
HUD presentation and health-state thresholds are documented in [Competitive HUD](docs/competitive-hud.md).
Arena composition, fighter placement, and dynamic shadows are documented in [Arena System](docs/arena-system.md).
Responsive behavior and compact menu layouts are documented in [Responsive Interface](docs/responsive-interface.md).

## Local ZIP updates

Local releases are delivered as cumulative ZIP installers containing a Git bundle. Extract the ZIP and run its `install.sh` against the local repository. The installer imports the release commit, applies it to the current working branch, and runs validation. This workflow does not require a pull request or a change to `main`.

## Technology

- Canvas 2D
- Web Audio API
- Plain JavaScript
- Vite

## License

MIT
