# Security

Do not include API keys, actual screenshots, private notes or chat histories in public reports. For a suspected vulnerability, use the repository's GitHub **Security → Report a vulnerability** feature if enabled. Otherwise contact the maintainer privately before sharing exploitable details publicly.

The plugin sends the selected file excerpts, question, recent conversation and/or reviewed screenshot to the configured AI provider. Provider retention policies apply. SecretStorage references are stored in plugin settings; secret values are retrieved only when a request is built.

Screen capture targets a matching display ID and fails if the display cannot be identified. Screenshot previews are enabled by default. Screenshot retry snapshots exist only in memory, expire after ten minutes, are bounded, and are cleared when the plugin unloads. Codex needs a temporary PNG file; it is removed after the process exits. An OS or application crash can leave that temporary file behind.

Codex runs in an ephemeral read-only sandbox. By default it ignores the local user configuration while retaining the local login. Read-only does not mean filesystem read isolation; it restricts writes. Turning off configuration isolation enables local configured services and tools. The plugin never installs Codex or logs the user in automatically.

Chat history is persisted locally through Obsidian plugin data storage. It is not encrypted. Vault sync or backups may copy these files. Auto-saved Q&A notes are regular vault notes. Clear a conversation with **New chat** and delete exported notes separately if needed. The original legacy `sessions.json` is preserved after migration; remove it manually if you intend to erase that backup too.

By default, each conversation automatically updates one local Markdown note starting with the first message. This includes learner answers, hints and incomplete-response labels, but excludes streaming fragments. **New chat** or **New topic** retains that note; erasing plugin history does not erase saved notes. Set **Automatic note saving** to Off if you do not want this additional local copy. Per-answer saving and folder selection are also available. Note paths and bounded turn fingerprints are stored in plugin data to restore the association and preserve handwritten changes to unchanged turns.

Feynman learning saves topics, frozen file excerpts, gaps and accepted answer evidence in the same local plugin data. Learning screenshots are not persisted; subsequent turns resend the same approved image while the bounded cache remains available. **New topic** clears learning progress and its transcript for the current source; ordinary Q&A and exported notes remain separate. A pass represents model assessment of the submitted answers and should not be interpreted as a guarantee of mastery.

Streaming fetch requests are aborted on cancellation or timeout. Obsidian's non-streaming `requestUrl` does not expose transport cancellation: the plugin ignores late responses, but an upstream request may continue and incur charges. Stopping a Codex process likewise cannot undo a request already accepted by a provider. Interrupted answers are not automatically saved as successful notes.

Rendered answers use Obsidian Markdown rendering. External images or content referenced in generated Markdown can cause additional network requests when rendered. Review generated content before applying or sharing it.
