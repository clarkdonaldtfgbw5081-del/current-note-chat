# Screen and File QA 0.13.2

First public release of the desktop screen/file assistant with guided Feynman learning and automatic conversation notes.

- Ask AI about the selected display or the current Markdown, PDF, Word or text file.
- Learn one concept by explaining it in your own words, solving an application problem and teaching it back. Feedback identifies gaps and records progress.
- Automatically update one Markdown note per conversation. Settings can switch to separate notes per answer or turn saving off.
- Review screenshots and proposed note revisions before sending/applying; stop requests and retry individual failures.
- Use Codex CLI, OpenAI, DeepSeek or a compatible Chat Completions endpoint. The floating panel supports Chinese/English and Obsidian theme colors.

Requires Obsidian 1.13.0 or newer on desktop. The plugin is free; AI providers may require separate accounts and charge for requests. Screen questions require a provider/model that accepts images. Refer to the README and SECURITY.md for network use and local data storage.

For manual installation, place `main.js`, `manifest.json` and `styles.css` in `.obsidian/plugins/current-note-chat/` and enable **Screen and File QA**. The plugin ZIP contains the runtime assets and notices. The source ZIP is for development.

Validation includes 66 automated regressions, a clean source build and a three-asset PDF installation smoke test. The release workflow requires Windows, macOS and Linux checks to pass before publication. The panel was loaded and inspected in Obsidian 1.13.7 on Windows. End-to-end provider/learning/saving checks and multi-display screenshot behavior still need broader real-world testing; macOS/Linux screen capture has not been manually verified. The README image is a design preview with synthetic content.

This release is prepared for community-directory submission. Marketplace availability depends on Obsidian's review and publication; a GitHub release alone does not add the plugin to the directory.

The opening command is now `current-note-chat:open-chat`. If you assigned a shortcut to the previous local command, assign it again using **Open Screen & File Q&A**.
