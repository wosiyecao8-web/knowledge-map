# Permanent development workflow

This folder is the permanent working copy for Knowledge Map.

## Distribution rule

After this bootstrap archive, do **not** distribute a new full ZIP for ordinary updates. Future changes should be committed to the same GitHub repository. The player updates with `更新并启动.bat`.

## User workflow

- Play: double-click `启动游戏.bat`.
- First GitHub setup: double-click `连接GitHub-只需一次.bat`.
- Pull future changes and play: double-click `更新并启动.bat`.

## AI/developer rules

1. Preserve the data-driven architecture described in `ARCHITECTURE.md`.
2. Prefer data additions over content-specific code.
3. Keep permanent IDs stable.
4. Preserve save compatibility or add migrations.
5. Do not overwrite browser/local player content unnecessarily.
6. Keep the project runnable with the two double-click scripts.
7. Update documentation when architecture changes.
8. Before changing a shared system, consider Producer, Skill, Effect, Condition, Event, graph layout, editor, and save implications.
9. Ordinary updates go through GitHub; do not create another full-package release unless explicitly requested for backup/recovery.
