# Release checklist

## Automated checks

- Run `npm ci --ignore-scripts` in a fresh source checkout.
- Run `npm run package`. This includes linting, regressions, a production build and release validation.
- Review `npm audit`, bundled dependency notices and ZIP contents.
- Confirm package version, manifest version, tag and `versions.json` agree. Tags use `1.0.0`, without a `v` prefix.
- CI covers Windows, macOS and Linux with Node.js 22. CI results appear only after the source is pushed to GitHub.

## Obsidian smoke tests

- Install **only** `main.js`, `manifest.json` and `styles.css` in a disposable vault. Verify PDF and DOCX extraction without `node_modules` or a worker sidecar.
- Check the ribbon, floating button, command palette, keyboard entry, Stop button and disabled-launcher option.
- Search for `Screen and File QA` in the installed-plugin list. Verify that Chinese panel labels follow the app language even when its date locale is English. Check icon tooltips, keyboard focus, the settings shortcut and compact answer headings.
- Test source/live-preview/reading modes, selected-text edits, undo, note switching and intervening modifications.
- Test screenshot preview/send/cancel, mismatched displays, mixed-DPI displays and screen-recording permission denial.
- Check macOS screen-recording permissions, Windows multi-monitor behavior and Linux X11/Wayland separately. A matching display ID is required.
- Test a text-only API in File Q&A and a vision-capable API in Screen Q&A. Inspect connection, text and image diagnostics separately.
- Test a slow provider, stream failure, a blocked browser request, non-streaming mode, retrying an older question and disabling the plugin during a request.
- Verify legacy history migration, restart, clear-history behavior, auto-save folder paths and manual transcript export.
- Verify the default writes one note per conversation from the first message, View note opens it, restarting reuses it and New chat retains it while creating a new note. Test per-answer and off modes, folder changes, note rename/delete, handwritten additions, failed writes and a conversation exceeding eighty messages.
- Verify source-note appends independently of conversation auto-save: screen target binding across note switches/retries, per-answer links, question-only mode, empty notes, attachment root/relative/fallback settings, failed writes and disabling/unloading during attachment saving. Check original handwritten content and protected AI folders.
- Queue ordinary follow-ups, preserve unsent drafts, remove an item, rename/delete the source and switch between conversations. Stop and provider failures must pause further sends until Resume or another explicit submission; Feynman assessment must keep its composer locked.
- Test automatic classification with synthetic answers: new topics, existing-topic append, uncertain Inbox results, invalid JSON, unavailable provider, folder changes, duplicate queueing/restart, cancellation and rapid disable/re-enable. Confirm only configured knowledge-folder names/paths are sent; check full conversation/source links, manual archiving, and original handwritten content.
- Verify successful answers in conversation and per-answer saving modes, Off preventing automatic requests, and Feynman hints/intermediate stages not being archived before completion. Check Chinese/English folder defaults, classification status and View knowledge note.
- Test Feynman learning with a synthetic concept: a wrong explanation stays in place, a hint preserves the draft, a correct explanation opens a transfer problem, and a reasoned application plus fresh teach-back completes the round.
- Stop or interrupt learning feedback, retry the current attempt, and confirm earlier attempts cannot change a later stage. Inspect automatic transcript/progress updates through hints and reviews, plus per-answer saving and manual export when selected.
- Restart a file lesson and verify frozen excerpts and progress. Restart a screen lesson or expire its image cache and verify that New topic is required. Confirm New topic leaves ordinary Q&A intact; test file rename/delete during learning.
- Capture screenshots or a short demo using synthetic notes and no private windows. Check light/dark themes and narrow Obsidian windows.

## Publish

- Confirm maintainer attribution and plugin ID availability. Directory names must use Basic Latin; localize the panel rather than the manifest name.
- Extract the source ZIP as the repository root or push the source tree with its `.gitignore` rules.
- Review `docs/RELEASE_NOTES.md` and the final package before pushing a version change on `main` or the exact version tag. The workflow validates every platform and publishes the release with standard assets, ZIPs and checksums. A previously published version is skipped.
- Follow the current [official submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin): sign into the community directory with an Obsidian account, connect GitHub, add the repository, review the developer policies and maintenance commitment, then submit.
- Keep public release notes accurate about which platforms were manually tested.
