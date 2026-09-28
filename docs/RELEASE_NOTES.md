# Screen and File QA 0.13.6

Fixes synchronization markers appearing as visible text in generated notes and improves note typography.

- Internal markers use unused standard Markdown reference definitions, with blank lines separating them from questions and answers. Both HTML and percent-comment markers migrate when an existing conversation is saved.
- Questions appear in a subtle card; AI answer labels are compact. Model headings stay below the note title, with fenced code unchanged.
- Generated notes opt into theme-aware typography, readable spacing and horizontally scrollable display formulas through a CSS class. Other notes keep their theme styles.
- Mathematical notation is normalized before saving. Handwritten edits remain protected.
- Adds tests of rendered Markdown, marker migration, code preservation and answer retries.

Requires Obsidian 1.13.0 or newer on desktop. Reload the plugin after updating, then use **View note** to migrate a saved conversation. Internal reference definitions are still visible in source mode, as expected for Markdown; reading view should contain only the note content.

For manual installation, copy main.js, manifest.json and styles.css into .obsidian/plugins/current-note-chat/. AI providers may require separate accounts and charge for requests. Screen questions require an image-capable provider/model.

Release publication requires Windows, macOS and Linux checks, 72 automated regressions, the three-asset PDF smoke test and build attestations. Actual Obsidian rendering under every theme and cross-platform screen capture still need real-world verification. Superseded Release entries are removed after this version publishes; source history and tags are retained.
