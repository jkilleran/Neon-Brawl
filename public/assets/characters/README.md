# Character Assets

Runtime sprites are separated by character. `rook/` and `vex/` each contain a complete movement library with generated JSON catalogs, one atlas per movement, and individually editable frame PNGs.

Do not load files from `prototype-fighter/source-archive/` in game code. That directory preserves only canonical source sheets referenced by movement metadata. Superseded revisions without an `archiveSource` reference are intentionally removed.

Common commands from the repository root:

```bash
npm run sprites:list
npm run sprites:validate
npm run sprites:build -- <characterId> <movementId>
npm run sprites:catalog -- <characterId>
```

See `docs/character-sprite-library.md` for the full editing, replacement, addition, and removal workflow.
