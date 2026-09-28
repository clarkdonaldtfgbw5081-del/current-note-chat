# Community review notices

The directory reports errors, warnings, recommendations and passes separately. Its [official guide](https://docs.obsidian.md/community-directory/manage-entry) says warnings do not block submissions. A pending review is incomplete and does not establish that the release has passed. A live listing is also separate from installation eligibility.

## Runtime capabilities

| Notice | Actual use and limits |
| --- | --- |
| Direct filesystem access | The optional Codex backend finds an installed executable and creates/removes temporary screenshot files outside the vault. Other file context and conversation notes use Obsidian's vault APIs. Codex read-only mode restricts writes, not all external reads. |
| Shell execution / child processes | The Codex backend starts the configured CLI and stops its process tree on cancellation. Arguments are passed as an array; shell mode is not enabled. Prompts use stdin. AI answers are not executed as shell commands. |
| Clipboard access | The Copy answer button writes the selected answer. The plugin's own code does not read the clipboard. |
| Dynamic code execution | PDF.js includes Function constructors for probes, compatibility fallbacks and optional compilation. The parser uses `isEvalSupported: false`, disabling PDF-generated function compilation. Constructors remain in the dependency and can still be detected; AI answers are not evaluated as code. |

These capabilities are disclosed rather than hidden from the scanner. Removing the Codex modules or the PDF dependency would remove existing features.

## Release assets

Starting with 0.13.3, the release workflow uses GitHub's official `actions/attest@v4` action to attest `main.js`, `manifest.json` and `styles.css` after the build. The release is published only after the three desktop platform checks and the attestation step succeed.

Obsidian downloads only those three installation assets. Plugin/source ZIPs, license notices and checksums are additional downloads for manual installation, developers and license verification. An extra-file recommendation does not mean Obsidian needs those files installed.

## CSS

0.13.3 removes the duplicate background declaration. Display math uses a scoped `[display="true"]` selector, preserving horizontal scrolling for MathJax output without an unknown custom-element type selector.

## Current review

The 0.13.2 entry was published on 2026-09-28 and was still being reviewed when these notices were inspected. After publishing 0.13.3, use **Check for new releases** in the entry manager and inspect the new review. Treat any reported error as work to resolve before claiming marketplace installation is available.
