# Screen and File QA 0.13.3

Addresses the community review's CSS warnings and adds verifiable build provenance for the three installation assets.

- Remove the duplicate background declaration in user messages.
- Preserve horizontally scrolling display math with a scoped attribute selector.
- Generate GitHub artifact attestations for `main.js`, `manifest.json` and `styles.css` before publishing.
- Explain why the optional Codex backend uses filesystem/process access, why Copy writes the clipboard, and why PDF.js may produce a dynamic-code recommendation. PDF-generated function compilation remains disabled.

Screen/file Q&A, guided Feynman learning and one-note-per-conversation saving are unchanged. Review notices are documented in `docs/COMMUNITY_REVIEW.md`, README and SECURITY.md.

Requires Obsidian 1.13.0 or newer on desktop. The plugin is free; AI providers may require separate accounts and charge for requests. Screen questions require a provider/model that accepts images. See the README for setup and network use.

For manual installation, place `main.js`, `manifest.json` and `styles.css` in `.obsidian/plugins/current-note-chat/` and enable **Screen and File QA**. Additional ZIPs, license notices and checksums are for manual installation and development; Obsidian downloads only the three standard assets.

The release workflow requires Windows, macOS and Linux checks and the attestation step to pass. The checks include 66 automated regressions and a three-asset PDF installation smoke test. Broader end-to-end provider/learning/saving checks and macOS/Linux screen capture still need real-world testing.

The community listing has been published, but the automated review is still in progress. Marketplace installation availability depends on the directory's review result.
