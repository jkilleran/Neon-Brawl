# Character Sprite Library

## Purpose

The character sprite library separates runtime art by character, category, movement, and individual frame. Its goals are to make the following operations predictable:

- replace one frame without manually rebuilding a full atlas;
- replace one complete movement for one fighter;
- add or remove a movement with an explicit manifest change;
- give a fighter unique art without affecting the opponent;
- trace every runtime movement back to the preserved original asset;
- validate naming, dimensions, frame count, padding, facing, and metadata automatically.

## Directory structure

```text
public/assets/characters/
├── README.md
├── rook/
│   ├── character.json
│   ├── movement-list.json
│   └── animations/
│       ├── strikes/{head,body}/{left-punch,right-punch,left-kick,right-kick}/
│       ├── knockdowns/{head,body}/<variant>/
│       ├── knockouts/{head,body}/<variant>/
│       ├── locomotion/{idle-breathing,forward-step,backward-step}/
│       ├── defense/{high-guard,low-guard,high-guard-footwork,low-guard-footwork}/
│       ├── reactions/{head-hit,body-hit}/
│       └── legacy/ground-sequence/
├── vex/
│   └── ...same schema, independent files...
└── prototype-fighter/
    └── source-archive/original-assets/
        └── ...all pre-migration source sheets and deprecated revisions...
```

Every movement directory has the same internal contract:

```text
<movement>/
├── movement.json
├── sheet.png
└── frames/
    ├── frame-01-guard.png
    ├── frame-02-anticipation.png
    ├── ...
    └── frame-10-guard-return.png
```

## Source of truth

The files have distinct responsibilities:

| File | Responsibility | Edit directly? |
| --- | --- | --- |
| `animation-manifest.js` | Global movement IDs, grids, labels, gameplay inputs, character registrations, and runtime URLs | Yes, for schema/catalog changes |
| `<character>/character.json` | Generated character identity and catalog pointer | No; regenerate |
| `<character>/movement-list.json` | Generated full movement inventory for one character | No; regenerate |
| `<movement>/movement.json` | Generated local metadata and exact frame list | No; regenerate |
| `<movement>/frames/*.png` | Editable individual frame artwork | Yes |
| `<movement>/sheet.png` | Runtime atlas built from the frame PNGs | Do not hand-edit when frames are authoritative |
| `source-archive/original-assets/` | Canonical pre-migration sheets referenced by movement metadata | Preserve referenced sources; remove superseded unreferenced revisions |

`animation-manifest.js` plus the editable frame PNGs are the maintained source. JSON catalogs and runtime atlases are reproducible outputs.

## Character and movement IDs

Current character IDs are `rook` and `vex`. IDs are lowercase and filesystem-safe. Movement IDs use stable camelCase names such as `leftPunchBody`, `guardHigh`, and `headKnockdownForward`.

Do not rename an ID only to improve wording. An ID is referenced by gameplay logic, tests, file generation, and saved review history. Use `label`, `variant`, and folder names for descriptive language.

## Inspect the library

```bash
npm run sprites:list
npm run sprites:validate
```

`sprites:list` prints registered characters and movement paths. `sprites:validate` checks all metadata, runtime sheets, and individual frames.

Atlas extraction and rebuilding require ImageMagick (`magick` or `convert`). Validation, gameplay, tests, and normal development do not require it. On macOS, a maintainer can install the optional art tool with `brew install imagemagick`.

Generated 5 × 2 transparent grids can be normalized to the canonical 1920 × 682 layout with:

```bash
npm run sprites:import -- <transparent-grid.png> <normalized-sheet.png>
```

The importer isolates all ten cells, trims transparent space, limits each fighter to a 330 × 310 presentation box, and aligns every pose to the shared baseline before the sheet is added to a movement folder.

Use `--scale=<ratio>` when a generated pose must fit a known fraction of the standing presentation box. Use `--multiply=<ratio>` to preserve every existing frame's relative size while uniformly enlarging or reducing an already-normalized sequence. Use `--repeat-first` only for a code-driven idle stance where an identical planted pose is required in all ten catalog cells.

## Replace one frame

Example: replace Rook's right body kick contact frame.

1. Locate the frame:

   `public/assets/characters/rook/animations/strikes/body/right-kick/frames/frame-06-contact.png`

2. Preserve its exact pixel dimensions. The dimensions are recorded in `movement.json` through the movement grid.
3. Keep a transparent background and enough padding so visible pixels do not touch a cell edge.
4. Keep the character facing screen-right. The right leg must strike and the left leg must remain the support leg.
5. Rebuild only that atlas:

```bash
npm run sprites:build -- rook rightKickBody
npm run check
npm test
```

Vex remains unchanged because it owns a separate frame and atlas.

## Replace a complete movement

To replace a full movement for one character:

1. Replace all PNGs inside that movement's `frames/` directory.
2. Keep the existing filenames, count, dimensions, canonical facing, and semantic order.
3. Rebuild the selected movement.
4. Run validation and test the animation in Practice Lab.

```bash
npm run sprites:build -- vex leftPunchHead
npm run check
npm test
npm run dev
```

If a new atlas is supplied instead of individual frames, place it temporarily as `sheet.png`, then extract its cells:

```bash
npm run sprites:extract -- vex leftPunchHead --force
npm run sprites:build -- vex leftPunchHead
```

Review the extracted frame PNGs before committing them.

## Add a movement

1. Add one movement definition to the appropriate collection in `animation-manifest.js`.
2. Choose a unique movement ID and a category-based folder.
3. Define frame labels, grid dimensions, canonical facing, and required combat metadata.
4. Add approved source art to the archive only if migration provenance is needed.
5. Create the same movement directory for every character that should support it.
6. Place individual frames and run `sprites:build` once per character.
7. Regenerate catalogs and validate:

```bash
npm run sprites:catalog
npm run sprites:validate
npm test
```

8. Connect the new movement ID in `game.js` only after all required character sheets exist.

## Remove a movement

Before removing files, search for its ID in gameplay and tests:

```bash
rg "movementIdHere" . --glob '!public/assets/characters/**/frames/**'
```

Remove runtime references first, then remove the manifest entry and its character directories. Regenerate both catalogs and run validation. Keep historical source artwork in the archive unless there is an explicit decision to delete it.

## Add a character

1. Choose a stable lowercase `characterId`.
2. Copy an existing character directory as a structural template.
3. Replace frames and rebuild movements as the new art becomes available.
4. Register the character in `animation-manifest.js`.
5. Run `npm run sprites:catalog -- <characterId>`.
6. Assign the new `characterId` to a `Fighter` configuration in `game.js`.
7. Validate and test both facing directions.

A registered character must currently provide all 36 movement IDs. This strict rule prevents a missing animation from appearing only during a rare outcome.

## Regenerate metadata

After any manifest metadata change:

```bash
npm run sprites:catalog
```

To regenerate only Rook's catalogs:

```bash
npm run sprites:catalog -- rook
```

Catalog generation does not overwrite frames or runtime sheets.

## Archive and migration commands

`seed` is an initial migration/recovery command used by maintainers. It copies or splits archived sheets into character movement folders and extracts individual frames.

```bash
node scripts/manage-character-sprites.cjs seed rook rightPunchHead
```

Use `--force` only when intentionally discarding the current frames for that movement. Normal day-to-day editing should use `sprites:build`, not `seed`.

`scripts/normalize-support-sheets.cjs` now targets the archived prototype sources. It is retained for provenance and should not be part of routine character editing.

## Review checklist

Before accepting a movement change, confirm:

- exactly 10 modern frames exist;
- the intended hand or leg remains consistent in every frame;
- the support leg remains anatomically consistent for kicks;
- the target height is visibly head or body as declared;
- contact occurs on the labeled contact frame;
- the character stays within the same scale and anchor region;
- no body part crosses a frame boundary;
- recovery returns smoothly to the same guard used at frame 1;
- screen-right source art looks correct when mirrored for screen-left facing;
- `npm run check`, `npm test`, and `npm run build` pass.

## Generated metadata schema

Every `movement.json` records:

- stable `id`, label, category, target/result/variant;
- striking and support limb where applicable;
- player inputs and body modifier;
- runtime sheet path and frame count;
- contact frame;
- canonical source facing and mirror policy;
- atlas grid dimensions;
- provenance and verification status;
- archived source path;
- ordered frame index, semantic label, and frame PNG path.

This metadata is deliberately redundant with the central manifest so artists can inspect one movement folder without reading application code.
