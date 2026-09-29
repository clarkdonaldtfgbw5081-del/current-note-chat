# Screen and File QA 0.16.0

Keep finished questions beside their source, and queue follow-up questions while an answer streams.

- **Write back to the asked note:** append a question callout, an optional AI answer and a conversation link. Screen questions bind to the Markdown note open when submitted or queued; switching notes while waiting cannot redirect the write. Screenshot questions become PNG vault attachments using Obsidian's attachment settings. The source-write toggle is independent of conversation auto-save; turn it off to stop both source appends and their screenshot attachments.
- **Question queue:** Enter queues up to five removable questions during ordinary Q&A. Questions execute in order within their source conversation when that source is active. File and folder renames preserve queued questions; deleted or replaced files drop them. Screenshots are captured when the queued question executes. Stop or provider failure pauses the remaining queue until Resume or a new explicit submission. Queues are held in memory and cleared on unload.
- **Write protection:** AI Q&A and knowledge folders are excluded; disabling source writes, unloading or deleting/moving a target during attachment saving prevents a late append. Unsafe attachment paths are rejected. Unavailable attachment configuration uses an actual fallback PNG. Source-write failures are reported while the answer remains in the chat. Per-answer mode includes its generated note link, and empty notes do not acquire a stray frontmatter delimiter.
- Keep Feynman submissions locked during assessment; ordinary Q&A remains editable. Remove the unused legacy streaming wrapper.

This release retains the 0.15.0 scoped classification, recovery journals, consolidation previews and local 1/3/7/14-day review plans. Source appends retain 200 recent question IDs for duplicate prevention; this is separate from the recoverable knowledge-archive journal and does not guarantee deduplication across crashes or older evicted IDs. PNG attachments persist in the vault and may sync or be backed up. Generated answers and summaries still require checking.

Local validation: 136 automated regressions, lint, production build, release checks and PDF extraction using only the three installation assets. The release workflow checks Windows/macOS/Linux before publication. Real-provider response quality, native Obsidian themes, screen-recording permissions and multi-device conflicts still require manual verification.

Restart Obsidian or reload the plugin after updating. Desktop Obsidian 1.13.0 or newer is required. Manual installation uses `main.js`, `manifest.json` and `styles.css` in `.obsidian/plugins/current-note-chat/`.

See [CHANGELOG.md](../CHANGELOG.md) for earlier releases and the [flow audit](FLOW_AUDIT_0.16.0.zh-CN.md) for detailed verification and remaining work.
