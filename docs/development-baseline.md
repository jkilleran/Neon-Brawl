# Current Development Line

The historical Neon Brawl gameplay baseline was version 0.24.0 at commit:

```text
620f5e6bbd0c3ef261c4bd6b23d1c997283268af
```

That reference is retained only for historical recovery. Normal development now proceeds from the latest accepted commit on `agent/mma-light-gameplay-v2`; routine releases do not return to or revalidate the old baseline.

Version 0.32.0 resumed normal sequential releases with contextual Settings. Version 0.33.0 added the draggable touch layout and trigger-chord controller scheme. Version 0.34.0 finalized that scheme with free shoulder buttons and unassigned evade. Version 0.35.0 swaps the default trigger roles and adds the approved guard-to-movement touch gesture with the compact strike layout. Future work continues from the latest accepted release as v0.36.0, v0.37.0, and so on.

The historical commit should only be inspected when explicitly recovering or comparing an older behavior:

```bash
git merge-base --is-ancestor 620f5e6bbd0c3ef261c4bd6b23d1c997283268af HEAD
```

This ancestry command is not part of the normal release checklist anymore.
