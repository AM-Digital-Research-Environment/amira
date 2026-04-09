# WissKI Dashboard — Claude Code instructions

## Pre-commit checks

Always run `npm run format:check` before committing. CI fails the build on
unformatted files, so any unformatted file blocks the deploy. If it reports
issues, fix them with `npm run format` (or `npx prettier --write <files>`)
and re-run the check.

Also worth running before pushing:

- `npm run check` — svelte-check / TypeScript
- `npm run lint` — ESLint
- `npm run build` — full production build (catches Vite/Rollup issues)
