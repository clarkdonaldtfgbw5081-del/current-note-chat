# Screen and File QA 0.13.4

Makes generated conversation notes cleaner and ensures mathematical notation renders correctly in Obsidian.

- Questions now appear as native Obsidian callouts, with concise headings for AI answers and Feynman feedback.
- Model output using `\\(...\\)` or `\\[...\\]` is converted to Obsidian's `$...$` and `$$...$$` notation before saving. Code spans and code blocks remain unchanged.
- Internal synchronization markers now use hidden Obsidian comments instead of HTML comments that some editor modes or themes can expose.
- Existing conversation notes migrate to the new marker and content format on their next automatic save or when opened through **View note**.
- Per-answer notes and manual transcript exports use the same formatting.

Screen/file Q&A, guided Feynman learning and one-note-per-conversation saving behavior are unchanged.

Requires Obsidian 1.13.0 or newer on desktop. The plugin is free; AI providers may require separate accounts and charge for requests. Screen questions require a provider/model that accepts images. See the README for setup and network use.

For manual installation, place `main.js`, `manifest.json` and `styles.css` in `.obsidian/plugins/current-note-chat/` and enable **Screen and File QA**. Additional ZIPs, license notices and checksums are for manual installation and development; Obsidian downloads only the three standard assets.

The release workflow requires Windows, macOS and Linux checks and the attestation step to pass. The checks include 68 automated regressions and a three-asset PDF installation smoke test. Broader end-to-end provider/learning/saving checks and macOS/Linux screen capture still need real-world testing.

The community listing and official Obsidian plugin catalog entry are live. Directory clients may take a short time to detect a newly published version.
