# Canonical Development Baseline

The canonical Neon Brawl baseline is version 0.24.0 at commit:

```text
620f5e6bbd0c3ef261c4bd6b23d1c997283268af
```

This commit is the ancestry anchor for current and future iterations on `agent/mma-light-gameplay-v2`. New features must be implemented as descendants of this commit rather than by returning to an older gameplay, arena, animation, or network revision.

Version 0.25.0 adds the universal input layer and complete remapping directly above that baseline. Version 0.32.0 reorganizes Settings, adds active-input detection and contextual in-match configuration, and introduces presentation preferences. Neither version changes combat balance, animation timing, server authority, matchmaking, arena rendering, or the version 0.24.0 online simulation. Future releases continue sequentially from v0.32.0.

Before preparing a release, verify the relationship with:

```bash
git merge-base --is-ancestor 620f5e6bbd0c3ef261c4bd6b23d1c997283268af HEAD
```

An exit status of zero confirms that the release descends from the approved baseline.
