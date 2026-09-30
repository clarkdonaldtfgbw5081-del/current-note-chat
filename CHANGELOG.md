# Changelog

## 1.1.0

- Add a learner profile: on first panel open a 30-second wizard asks for the learner's level, preferred answer style and optional background. Ordinary Q&A (screen and file) then tailors explanations to that profile — the direct answer still comes first.
- Add "explain principles in depth": after the direct answer, the reasoning behind the result is laid out step by step so follow-up questions are unnecessary.
- Add "worked examples": answers can end with 2-3 examples of increasing difficulty on the same knowledge point, each with a brief solution; examples beyond the source are clearly marked and factual answers remain source-grounded.
- Everything is editable later in settings (Learner profile section, including a wizard button). Skipping the wizard or leaving the level unset keeps the historical concise behavior. Feynman learning and note revision are unaffected.

## 1.0.1

- Explain question write-back skips instead of failing silently: when a finished question is not appended to a note, a notice states whether the asked file is not Markdown or no Markdown note was open when asking a screen question.

## 1.0.0 — First release

- Ask AI about the selected display or current file, stream answers, stop requests and retry specific questions. Preview screenshots before sending by default.
- Queue up to five follow-up questions during ordinary Q&A. Stop or provider errors pause the queue until explicit resume; preserve drafts and track source renames/deletions.
- Automatically save each conversation to one Markdown note. Append questions, optional answers and conversation links to the source note; save screenshot questions as vault PNG attachments.
- Organize completed answers into topic notes inside the configured AI knowledge directory. Preserve handwritten content, route uncertain matches to Inbox, recover journalled archive writes and preview consolidation before applying it.
- Practise concepts with Feynman explanation, application and teach-back stages, then record learning reports and local 1/3/7/14-day reviews.
- Review Markdown revisions before applying them. Support desktop themes, Chinese/English controls and Obsidian math formatting without visible synchronization IDs.
- Connect OpenAI, DeepSeek, a compatible endpoint or the optional signed-in Codex CLI. Providers may charge for requests.
- Validate with 136 automated regressions, lint, production packaging, three-asset PDF extraction and Windows/macOS/Linux release checks.

This is the first numbered public edition of the current implementation. Earlier development releases are superseded; development commits remain available in Git history.
