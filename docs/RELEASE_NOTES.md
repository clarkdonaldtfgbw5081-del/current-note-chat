# Screen and File QA 0.13.7

Removes internal synchronization IDs from generated notes entirely. Notes contain only their metadata, title, questions and answers, in both reading and source views.

- Synchronization positions and hashes are stored in plugin data, not Markdown.
- Existing HTML, percent-comment and reference-definition markers migrate out of saved conversations without creating another note.
- Same-note automatic saving, answer retries and history retention continue to work. Handwritten changes are preserved. If edits shift a generated block, the plugin leaves that block alone rather than guessing which text to replace; new turns still append safely.
- Keeps the scoped note typography, question cards and normalized mathematical notation.

Restart Obsidian or reload the plugin after updating. Use **View note** to migrate an existing active conversation. Archived notes can be cleaned locally without regenerating their answers.

Requires Obsidian 1.13.0 or newer on desktop. For manual installation, copy main.js, manifest.json and styles.css into .obsidian/plugins/current-note-chat/. AI providers may charge for requests; screen questions require an image-capable model.

Release checks include 74 automated regressions, a three-asset PDF smoke test, Windows/macOS/Linux validation and GitHub artifact attestations. End-to-end provider behavior and every Obsidian theme still require real-world verification.
