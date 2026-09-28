# Changelog

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
