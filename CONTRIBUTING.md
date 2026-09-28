# Contributing

Use Node.js 22.13 or newer and npm. Start from the source repository, not an installed runtime folder.

```sh
npm ci --ignore-scripts
npm run check
```

`src/main.js` coordinates the plugin. Request handling, task lifetimes, context retrieval, file parsing, screenshots, sessions and UI live in separate modules. Message and request contracts are described in `src/types.d.ts`.

Use `npm run dev` while developing and reload the plugin in a disposable Obsidian vault. The worker module is generated from the locked PDF.js dependency and must not be edited. A normal `npm run build` also embeds complete dependency licenses; watch builds are for local development only.

For behavior changes, add meaningful regression tests using synthetic documents and mock providers. Run the manual checks in `docs/RELEASE_CHECKLIST.md` for changes involving Obsidian UI, screen permissions or platform behavior. Never use real API keys or private notes in test fixtures, screenshots, issues or commits.

Run `npm run package` to produce explicit allowlist-based source and installation archives. Local settings, histories, backups, caches and dependencies are excluded. The source ZIP can be extracted as a standalone GitHub repository.
