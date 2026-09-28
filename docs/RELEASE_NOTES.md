# Screen and File QA 0.14.0

Automatically organize completed answers into reusable knowledge notes while keeping the full conversation. AI classification is enabled by default alongside automatic note saving.

- Restrict candidate selection and writes to **AI Knowledge** (**AI 知识库** in a Chinese interface), or the configured knowledge folder and its subfolders. Only candidate titles/paths are sent; existing note contents are not read for classification.
- Append a summary to a clearly matching topic note, or create a categorized note. Preserve handwritten content and link back to the full conversation and source when available.
- Send uncertain results to **Inbox / 待整理**. When classification fails, retain the original answer there. Stopped or failed Q&A answers never trigger classification.
- Archive completed Feynman reports; hints and unfinished stages remain in their conversation. Add a manual archive command and a status/link in the chat panel.
- Prevent duplicate automatic writes after retries/restarts within the bounded archive history, and cancel active/queued work when settings change or the plugin unloads.
- Keep generated notes free of opaque synchronization IDs, with native math and subordinate summary headings.

Classification makes an extra request to your configured AI provider and may incur charges. It is a model suggestion and should be reviewed. Requests include up to 8,000 question characters, 24,000 answer characters and 120 candidate names/paths, so long-answer summaries may be partial. Existing answers are not retroactively processed. Disable classification or change its folder in settings; turning off automatic saving stops automatic classification too. The Codex backend retains the documented filesystem-read limitations.

Restart Obsidian or reload the plugin after updating. Requires Obsidian 1.13.0 or newer on desktop. For manual installation, copy main.js, manifest.json and styles.css into .obsidian/plugins/current-note-chat/.

Release checks include 93 automated regressions, a three-asset PDF smoke test, Windows/macOS/Linux CI and GitHub artifact attestations. Real-provider classification quality and Obsidian UI behavior still need manual verification.
