# Changelog

## 0.16.0

- Bind screen questions to the note selected at submission/queueing, including cached retries. Follow source/queue renames and drop deleted or replaced targets. Pause pending questions after Stop or provider errors until explicit resume; preserve drafts and keep Feynman stage submissions locked while busy.
- Validate screenshot attachment paths, use a real fallback attachment when configuration cannot be read, recheck write settings after asynchronous work, report failed source appends and retain the generated per-answer note link. Empty notes start with a question callout rather than an unterminated frontmatter delimiter.
- Validate the complete transcript → source append → scoped knowledge archive flow and the new boundary cases with 136 automated tests, lint, production build and three-asset PDF installation checks.

- Append finished questions to the asked-about Markdown note (on by default): file Q&A writes back to the file being asked, screen Q&A to the currently open Markdown note. Screenshot questions are saved as vault attachments using Obsidian's attachment settings and embedded before the question text. Notes inside the AI Q&A and knowledge folders are never modified, retried answers never append twice, and the conversation link is included when a transcript exists.
- Add a separate toggle to record questions without the AI answer; the full answer still lives in the conversation note.
- Queue follow-up questions while an answer is still streaming: the composer stays editable, pressing Enter queues up to five pending questions as visible tasks, and they run automatically in order when the conversation is idle again. Queued items can be removed, follow their own file when you switch notes, and are dropped if their source disappears. Screenshot context is captured when a queued question runs, not when it was typed.
- Remove the unused legacy streaming wrapper from the plugin core.

## 0.15.0

- Require a saved conversation before automatic classification. Persist bounded recovery tasks, classification plans and write journals; recover completed writes without duplicate appends, and pause uncertain paid requests until explicit retry.
- Use message-based archive identities across source renames and share the same Feynman report identity for manual/automatic archiving. Migrate existing bindings and update conversation, learning and review sources when folders move.
- Traverse only the configured knowledge folder. Rank candidates using both question and answer, bilingual concept terms and local aliases; send only candidate titles/paths.
- Remove repeated concept headings, avoid identical summary text and retain new provenance links. Add explicit knowledge-consolidation previews and safe undo for verified archive additions; preserve concurrent handwritten changes.
- Add a classification-specific API model, daily extra-request limit, content reuse and an archive task/usage panel with recovery, cancellation and recent undo actions.
- Add three application difficulties and local 1/3/7/14-day Feynman review plans. Early practice does not advance the schedule. Veto contradictory independence answers only when the source formula and numeric evidence are fully supported.
- Update archive status without rebuilding chat, add accessible task/review controls and compact narrow-panel spacing. Document remaining real-provider, native UI and learning-quality validation.
- Pass 114 automated regressions, lint, build/release checks and the three-asset PDF installation smoke test locally; GitHub CI also checks Windows/macOS/Linux before release.

## 0.14.0

- Add AI classification and knowledge archiving, enabled alongside automatic note saving. Restrict candidate selection and writes to a configurable knowledge folder and its subfolders.
- Append summaries to a clearly matching existing topic or create a categorized concept note, keeping original transcripts and handwritten content. Link to the full conversation and source when available.
- Put uncertain classifications in Inbox; retain original answers there on request/format/path failures. Never classify stopped or failed Q&A responses.
- Archive Feynman learning reports only after completion. Add a manual archive command and visible classification status with a link to the knowledge note.
- Bound request sizes, candidates, queue length and persisted duplicate-prevention records. Cancel active and queued work on setting changes/unload; cancelled jobs cannot revive on rapid re-enabling.
- Explain the additional provider request/charges, titles-only candidate selection, partial summaries for long answers and model classification limits in both READMEs and security documentation.

## 0.13.7

- Remove internal conversation/message/end markers entirely from generated Markdown, including source mode. Store block positions and hashes in plugin data instead.
- Remove legacy HTML, percent-comment and reference-definition markers when saving an existing conversation; keep the same note and protect handwritten changes.
- Preserve retry updates and history retention without embedding opaque IDs in note content or frontmatter. When edits shift a saved block, preserve it instead of guessing which text to replace.

## 0.13.6

- Replace synchronization comments with invisible standard Markdown reference definitions, separated from callouts and prose by blank lines. Migrate both older HTML and percent-comment markers.
- Give generated notes a scoped, theme-aware layout with smaller headings, a neutral question card, comfortable spacing and scrollable display math. Keep model headings below the note title and leave fenced code unchanged.
- Verify actual rendered Markdown output in automated tests, including legacy migrations and answer retries.
- Publish the checked version before removing superseded GitHub Release entries; retain tags and commit history.

## 0.13.5

- Preserve a generated turn that the user edited by hand when migrating an existing conversation note to the new 0.13.4 formatting.

## 0.13.4

- Format questions as native Obsidian callouts and use concise headings for AI answers and Feynman feedback.
- Convert `\\(...\\)` and `\\[...\\]` model output to Obsidian-compatible math delimiters before writing notes, while leaving code spans and code blocks unchanged.
- Replace visible HTML synchronization markers with native Obsidian comments. Existing conversation notes migrate automatically on their next save.
- Apply the same readable formatting to one-note-per-answer and manual transcript exports.

## 0.13.3

- Remove the duplicate user-message background declaration and use an attribute selector for display math, addressing the community CSS warnings.
- Generate GitHub build provenance attestations for the three installation assets before publishing releases.
- Explain the community scanner's filesystem, process, clipboard and PDF dependency notices in the English/Chinese README and security documentation.

## 0.13.2

- Prepare the first public release with the directory-compatible name Screen and File QA, maintainer information, provider disclosures and a synthetic interface preview.
- Keep Chinese panel labels while using the English name required by the community directory.
- Rename the opening command ID to `open-chat` to avoid duplicating the plugin ID in commands. Reassign an existing shortcut for the old command if needed.
- Add a checked release workflow that can publish from a version change on the default branch or an exact version tag.

## 0.13.1

- Read the Obsidian interface language instead of the date locale, fixing English controls in a Chinese interface.
- Add a bilingual installed-plugin name so Chinese and English searches can find the plugin.
- Refresh the floating panel with a compact icon toolbar, source selector, learning tabs, theme colors and consistent answer typography.
- Add a direct settings shortcut, visible auto-save status and accessible names for icon buttons.

## 0.13.0

- Automatically save each conversation to one Markdown note by default, updating it from the first message through subsequent Q&A, Feynman hints, progress and reviews. View note opens it without a manual export step.
- Add settings for one note per conversation, one note per successful answer, or no automatic note saving, alongside the destination folder.
- Preserve the note association after restart and rename. New chat or New topic leaves the old note in place and starts a fresh one.
- Keep earlier saved turns after in-memory history is trimmed; update retried answers at their original position. Preserve handwritten additions and edits to unchanged turns.
- Serialize note writes, exclude streaming fragments, label interrupted responses, and create a fresh note if the original was deleted or repurposed. Preserve a previously disabled auto-save setting during migration.

## 0.12.0

- Add Feynman learning alongside ordinary screen/file Q&A: choose a concept, explain it, solve a transfer problem and teach it back with an example and limitations.
- Advance only when the tutor's source-grounded assessment includes evidence from the learner's actual answer. Hints, uncertain judgments, invalid feedback and stopped requests do not count as passes.
- Add targeted gaps, small hints, progress restoration, stage-bound retries, review rounds and learning report export. Optionally save a report after a completed round.
- Freeze file excerpts throughout a round. Reuse a reviewed screenshot within the bounded ten-minute memory cache; require a new topic when the image expires or the plugin restarts. Screenshots are never written into learning progress.
- Keep learning transcripts separate from Q&A and bound saved learning topics to twenty. Describe a pass as this round's AI assessment, with a recommendation to review the next day.

## 0.11.0

- Restore modular source, a locked npm build, linting, regression tests and CI for Windows, macOS and Linux.
- Embed the PDF worker in `main.js`; installation requires only the three standard Obsidian assets.
- Reject missing display matches instead of capturing another monitor. Preview screenshots before sending by default.
- Add a Stop button, API deadlines and cleanup of child processes and pending work on unload.
- Handle SSE error events, UTF-8 boundaries, final lines and completion markers. Incomplete answers are never auto-saved as successful Q&A notes.
- Restrict automatic fallback to explicit unsupported-streaming responses. Authentication and ambiguous network errors are never resent automatically.
- Bind retries to the selected question and reuse short-lived in-memory request snapshots.
- Bound chat history in memory, migrate legacy history without removing the original file, and serialize persistence through Obsidian plugin data APIs.
- Cache PDF/Word text with file-change invalidation; select PDF context within pages while preserving page labels.
- Update only the streaming answer and preserve the reader's scroll position.
- Separate text and image capability checks. Vision checks verify a synthetic letter image.
- Include complete bundled dependency notices, source and installation ZIPs, and checksums.

## 0.10.0

Existing installed version: screen/file Q&A, note revision previews, local chat history and Q&A note export.
