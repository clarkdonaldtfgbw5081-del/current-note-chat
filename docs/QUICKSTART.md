# From a question to a review: 1.0.0 quick start

[Project home](../README.md) · [Illustrated workflow](SCREENSHOTS.md) · [中文指南](QUICKSTART.zh-CN.md) · [Download](https://github.com/clarkdonaldtfgbw5081-del/current-note-chat/releases/tag/1.0.0)

## 1. Install and connect a provider

Use desktop Obsidian 1.13.0+. Search community plugins for **Screen and File QA**, or extract `current-note-chat-plugin-1.0.0.zip` into your vault configuration directory's `plugins/current-note-chat/`. The installation folder must directly contain `main.js`, `manifest.json` and `styles.css`. The source ZIP is for development.

In the plugin settings, configure a signed-in local Codex CLI, an OpenAI/DeepSeek model and SecretStorage key, or a compatible HTTPS Chat Completions endpoint. Test File Q&A first. Test Screen Q&A separately if your provider supports images. Diagnostics may incur AI usage; the image diagnostic uses a generated test image rather than your actual display.

## 2. Ask a concrete question

Open a learning note and the chat panel. Choose **File** and ask something specific, such as:

> Explain independence with an everyday example and compare it with mutually exclusive events.

Choose **Screen** for a displayed exercise or page. Review the capture before sending; other application windows may appear in it. File Q&A supports Markdown, PDF, DOC/DOCX and several text formats. Long documents use relevant excerpts.

![File and screen Q&A](images/first-release-02-qa.png)

*The illustrations use fictional Chinese learning content and a simplified rendered UI. They are not native Obsidian screenshots.*

## 3. Queue follow-ups

While an ordinary answer streams, keep typing and press Enter to queue the next question. Up to five pending questions are visible and removable. Questions run in order in their source conversation when it is active; screen captures happen when a queued item executes.

Stop or provider errors pause remaining sends until explicit resume. Queues are kept in memory and cleared on unload. Feynman assessment waits for the current stage instead of using this queue.

![Visible follow-up queue](images/first-release-03-queue.png)

## 4. Find your saved notes

**View note** opens the automatically saved conversation. New chat retains the previous note and starts another one.

| Record | Default destination and purpose |
| --- | --- |
| Full conversation | `AI Q&A`, updated for the same conversation |
| Source append | The asked-about Markdown note: question, optional answer and transcript link |
| Topic knowledge | `AI Knowledge`; from 1.0.2, new entries include the typed question, topic summary and provenance |
| Screenshot | PNG following Obsidian attachment settings, with an `images` fallback under the Q&A folder |

Chinese UI uses `AI 问答` and `AI 知识库`. A screen question is bound to the Markdown note selected when it is submitted or queued, even if you switch notes while waiting. Existing handwritten content is retained; Q&A and knowledge folders are excluded from source appends.

![Questions and attachments beside the original note](images/first-release-04-source.png)

## 5. Organize knowledge by topic

After the complete conversation is saved, classification searches only the configured knowledge folder and subfolders. Candidate names/paths are supplied to the model; candidate bodies are not additionally sent for routing.

A clear match appends to the existing topic, a new topic creates a categorized note, and uncertain results go to Inbox. Sources link back to the original conversation. Classification may add an AI request; configure its model or daily limit, or disable **AI classification and archiving**. The default daily limit is unlimited. Turning off conversation auto-save also stops automatic classification; source appends have an independent switch.

![Topic notes with provenance](images/first-release-05-knowledge.png)

## 6. Practise with Feynman learning

Choose a specific concept and work through **explanation → application → teach-back**. Explain in your own words, solve a fresh application with reasoning, then teach a beginner using a new example and relevant limits.

Hints help thinking and never count as passing a stage. Check the AI's feedback against your material; completing the workflow does not establish lasting mastery.

![Three Feynman stages and feedback](images/first-release-06-feynman.png)

## 7. Review later

Completed learning produces feedback and a local 1/3/7/14-day review plan. Select a topic and practise again when due. Early practice does not advance the due review count. Plans do not automatically make AI requests; practice begins when you choose it.

![Learning report and local review plan](images/first-release-07-reviews.png)

## Adjust the defaults

| Preference | Setting |
| --- | --- |
| One note for each conversation | Automatic note saving → One note per conversation |
| One note for each answer | Automatic note saving → One note per answer |
| Keep transcripts without changing source notes | Disable Append questions to the asked note |
| Record only questions in the source | Disable Include the AI answer when appending |
| Organize topics yourself | Disable AI classification and archiving |
| Bound additional classification usage | Set Daily classification request limit |

The plugin is free and open source; providers may charge. Questions, recent conversation and screenshots/file excerpts go to the configured provider. Vault notes and attachments may sync or be backed up. See [privacy and security](../SECURITY.md).
