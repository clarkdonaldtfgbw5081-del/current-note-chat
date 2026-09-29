# Community review notices

The directory reports errors, warnings, recommendations and passes separately. Its [official guide](https://docs.obsidian.md/community-directory/manage-entry) says warnings do not block submissions. A pending review is incomplete and does not establish that the release has passed. A live listing is also separate from installation eligibility.

## Runtime capabilities

| Notice | Actual use and limits |
| --- | --- |
| Direct filesystem access | The optional Codex backend finds an installed executable and creates/removes temporary screenshot files outside the vault. Other file context and conversation notes use Obsidian's vault APIs. Codex read-only mode restricts writes, not all external reads. |
| Shell execution / child processes | The Codex backend starts the configured CLI and stops its process tree on cancellation. Arguments are passed as an array; shell mode is not enabled. Prompts use stdin. AI answers are not executed as shell commands. |
| Clipboard access | The Copy answer button writes the selected answer. The plugin's own code does not read the clipboard. |
| Dynamic code execution | PDF.js includes Function constructors for probes, compatibility fallbacks and optional compilation. The parser uses `isEvalSupported: false`, disabling PDF-generated function compilation. Constructors remain in the dependency and can still be detected; AI answers are not evaluated as code. |
| Vault enumeration | Candidate retrieval walks only the configured knowledge folder through its children. It does not call `getMarkdownFiles()`. Local aliases help ranking but are not sent to the model. Candidate bodies are not read for routing; the chosen destination is read locally to journal an append. Manual knowledge consolidation explicitly sends a note or selection for a reviewed revision. |

These capabilities are disclosed rather than hidden from the scanner. Removing the Codex modules or the PDF dependency would remove existing features.

## Release assets

The release workflow uses GitHub's official `actions/attest@v4` action to attest `main.js`, `manifest.json` and `styles.css` after the build. The release is published only after the three desktop platform checks and the attestation step succeed.

Obsidian downloads only those three installation assets. Plugin/source ZIPs, license notices and checksums are additional downloads for manual installation, developers and license verification. An extra-file recommendation does not mean Obsidian needs those files installed.

## CSS

The stylesheet avoids duplicate background declarations. Display math uses a scoped `[display="true"]` selector, preserving horizontal scrolling for MathJax output without an unknown custom-element type selector.

## First-release review

Version 1.0.0 requires its own community-directory release review. The GitHub release and its passing checks do not establish that the directory has reviewed or synchronized this version. Verify the current status on the [official plugin page](https://community.obsidian.md/plugins/current-note-chat).

The [illustrated workflow guide](SCREENSHOTS.md) uses simulated content. The [first-release flow audit](FLOW_AUDIT_1.0.0.zh-CN.md) records automated evidence and remaining manual work.
