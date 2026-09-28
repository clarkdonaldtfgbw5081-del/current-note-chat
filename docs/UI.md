# Floating panel components

The panel uses Obsidian theme tokens for surfaces, borders, accent, text and focus. All rules are scoped to `current-note-chat`; the vault theme and note typography stay independent. The interface language comes from `getLanguage()`, independently of the date locale.

| Component | Layout and behavior |
| --- | --- |
| Header | Brand, title and subtitle; named icon buttons for New chat/topic, View note/Export, settings and collapse. |
| Source | Compact Screen/File buttons with `aria-pressed`; changes are disabled during a request. |
| Activity | Q&A and Feynman learning tabs; accent underline and `aria-pressed` identify the active choice. |
| Context | Visible screenshot privacy hint or current file path; full text is available in the tooltip. |
| Learning progress | Scrollable theme surface with accent edge, current stage, gaps and hint/review actions. |
| Conversation | Right-aligned user bubbles; assistant cards with copy action, bounded heading sizes and horizontally scrollable formulas/code. |
| Composer | Labelled textarea, provider/save status, keyboard hint, revise and send/stop actions. |

The panel is at most 460 × 660 CSS pixels and shrinks with the viewport. Message history scrolls independently; compact heights and narrow-screen rules preserve the composer. Text is 13 pixels in controls and 14 pixels in answers, with headings between 14 and 18 pixels. Icon buttons have native SVGs, visible focus rings and accessible names/tooltips. Busy states disable conflicting actions, while Stop remains available. Controls use no layout animations.

Verify the panel in a Chinese app with an English date locale, both light/dark themes, a narrow window and a short viewport. Inspect math overflow, keyboard focus, long file paths, completed-learning state and stream/cancel/retry behavior. Use synthetic notes for screenshots intended for publication.
