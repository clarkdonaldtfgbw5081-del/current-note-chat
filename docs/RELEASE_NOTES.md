# Screen and File QA 0.15.0

Make knowledge archiving recoverable and protect handwritten edits. Add review plans, classification request controls and explicit knowledge-consolidation previews.

- Save the conversation before automatic classification. Recover unfinished saves and prepared writes from a bounded local journal; a write completed before a crash is recognized without appending it twice. Uncertain paid requests pause until you explicitly retry.
- Keep archive identities stable when source files/folders move, and share one identity between automatic and manual Feynman report archiving.
- Search only the configured **AI Knowledge / AI 知识库** folder. Use question and answer terms, bilingual concepts and local aliases to rank existing topics. Classification still receives only candidate titles/paths, not their bodies.
- Use clearer knowledge-note headings, skip identical summary text and preserve provenance links. The new consolidation command shows a semantic-edit preview before application. Task history can undo an unchanged archive addition; concurrent or subsequent handwritten edits are protected.
- Choose a separate classification API model and a daily extra-request limit. Open the archive task panel to see usage, errors, cancellation, save recovery or explicit retry. Counts are request reservations, not provider billing.
- Choose one of three application difficulties. Completed Feynman learning can create a local 1/3/7/14-day review plan; early practice does not count as delayed retention evidence. A narrow, source-grounded probability check can reject contradictory independence answers.
- Refresh archive status without rebuilding the whole chat, and improve narrow-panel spacing and task/review controls.

Classification and explicit consolidation may incur provider charges. Recovery tasks and review plans are unencrypted local plugin data and may sync with your vault. Automatic tasks are cancelled when classification/automatic saving is disabled or the knowledge folder changes. Review plans do not send background AI requests or create system notifications.

These improvements do not establish real-provider classification accuracy or long-term mastery. Semantic consolidation requires reviewing the preview, and the numeric check is not a general mathematical verifier. See the [implementation record](OPTIMIZATION_PROGRESS.zh-CN.md) for remaining work. Three new synthetic 0.15.0 walkthroughs accompany the earlier version-labelled 0.14.0 images in the [illustrated guide](SCREENSHOTS.md).

Restart Obsidian or reload the plugin after updating. Requires Obsidian 1.13.0 or newer on desktop. Manual installation uses main.js, manifest.json and styles.css in .obsidian/plugins/current-note-chat/.

Local validation passed 114 automated tests, lint/build/release checks and the three-asset PDF installation smoke test. The release workflow runs Windows/macOS/Linux checks and generates GitHub attestations before publishing. Real-provider quality and native Obsidian UI/platform behavior still require manual verification.
