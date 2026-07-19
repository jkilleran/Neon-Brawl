# Neon Brawl MMA

Neon Brawl is a lightweight browser MMA game built with Canvas and plain JavaScript. It combines arcade presentation with tactical distance, two-layer stamina, separate head/body health, guards, critical counters, knockdowns, knockouts, three-round scoring, and a practice mode.

## Run locally in Visual Studio Code

```bash
git clone https://github.com/jkilleran/Neon-Brawl.git
cd Neon-Brawl
npm install
npm run dev
```

Open the address printed by Vite, normally `http://localhost:5173`.

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

Exact balance values are documented in [Gameplay Rules](docs/gameplay-rules.md).

## Local ZIP updates

Local releases may be delivered as a ZIP containing numbered Git patches. Extract the package, apply the patches in order with `git am --3way` on `agent/mma-light-gameplay-v2`, run validation, and push that same branch. This workflow does not require a pull request or a change to `main`.

## Technology

- Canvas 2D
- Web Audio API
- Plain JavaScript
- Vite

## License

MIT
