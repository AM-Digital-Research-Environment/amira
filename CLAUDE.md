# WissKI Dashboard — Claude Code instructions

## Design priorities

**Modularity and maintainability are top priorities.** When adding
features — especially anything that varies per collection, data source,
or section — design for extension rather than baking the special case
into a shared component:

- Add an opt-in flag to `FeaturedCollection` (see `dedupePhotos`,
  `views.map`) and resolve the behavior at the page that composes the
  shared components, instead of branching on a slug or identifier
  inside the shared UI.
- Put parsing / derivation helpers (e.g. extracting volume/issue from
  a DOI) in a dedicated module under `src/lib/utils/` or
  `src/lib/components/<area>/*Helpers.ts` so they're reusable and
  testable, not buried inline in a Svelte component.
- New visual variants with substantially different layouts get their
  own component — don't bolt mode switches onto an existing one.
- Pass labels / overrides via maps the page constructs and threads
  through props; shared components shouldn't reach into registry data
  themselves.
- The moment you're about to write logic that mirrors something in
  another file, pause and refactor it into a shared helper or
  component — don't ship the duplicate.

## Pre-commit checks

Always run `npm run format:check` before committing. CI fails the build on
unformatted files, so any unformatted file blocks the deploy. If it reports
issues, fix them with `npm run format` (or `npx prettier --write <files>`)
and re-run the check.

Also worth running before pushing:

- `npm run check` — svelte-check / TypeScript
- `npm run lint` — ESLint
- `npm run build` — full production build (catches Vite/Rollup issues)
