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

## Online Arena

The first online version includes:

- live presence count for players currently searching;
- a lobby roster with direct challenge buttons;
- accept and decline controls for incoming challenges;
- host-authoritative gameplay to keep damage, criticals, knockdowns, and scoring synchronized;
- visible server round-trip latency with connection-quality grading;
- explicit connected and outgoing-challenge states in the lobby;
- immediate guest action delivery and 45 Hz authoritative state snapshots;
- guest-side prediction for movement, guard changes, and strike animation startup;
- input acknowledgements, bounded motion extrapolation, and smooth authoritative reconciliation;
- screen-direction WASD online movement (`A` left, `D` right), including the right-side fighter;
- defensive snapshot validation and visual fallbacks so malformed remote state cannot hide a fighter;
- an explicit guest-ready handshake and background host clock for reliable two-tab testing;
- stale-snapshot shedding when a slow connection starts buffering;
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

## Local ZIP updates

Local releases are delivered as cumulative ZIP installers containing a Git bundle. Extract the ZIP and run its `install.sh` against the local repository. The installer imports the release commit, applies it to the current working branch, and runs validation. This workflow does not require a pull request or a change to `main`.

## Technology

- Canvas 2D
- Web Audio API
- Plain JavaScript
- Vite

## License

MIT
