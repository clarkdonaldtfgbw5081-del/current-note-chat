# Community review notices

The directory reports errors, warnings, recommendations and passes separately. Its [official guide](https://docs.obsidian.md/community-directory/manage-entry) says warnings do not block submissions. A pending review is incomplete and does not establish that the release has passed. A live listing is also separate from installation eligibility.

## Runtime capabilities

| Notice | Actual use and limits |
| --- | --- |
| Direct filesystem access | The optional Codex backend finds an installed executable and creates/removes temporary screenshot files outside the vault. Other file context and conversation notes use Obsidian's vault APIs. Codex read-only mode restricts writes, not all external reads. |
| Shell execution / child processes | The Codex backend starts the configured CLI and stops its process tree on cancellation. Arguments are passed as an array; shell mode is not enabled. Prompts use stdin. AI answers are not executed as shell commands. |
| Clipboard access | The Copy answer button writes the selected answer. The plugin's own code does not read the clipboard. |
| Dynamic code execution | PDF.js includes Function constructors for probes, compatibility fallbacks and optional compilation. The parser uses `isEvalSupported: false`, disabling PDF-generated function compilation. Constructors remain in the dependency and can still be detected; AI answers are not evaluated as code. |
| Vault enumeration | Starting in 0.15.0, candidate retrieval walks only the configured knowledge folder through its children. It does not call `getMarkdownFiles()`. Local aliases help ranking but are not sent to the model. Candidate bodies are not read for routing; the chosen destination is read locally to journal an append. Manual knowledge consolidation explicitly sends a note or selection for a reviewed revision. The new release needs its own scan; the 0.14.0 notice below is historical. |

These capabilities are disclosed rather than hidden from the scanner. Removing the Codex modules or the PDF dependency would remove existing features.

## Release assets

Starting with 0.13.3, the release workflow uses GitHub's official `actions/attest@v4` action to attest `main.js`, `manifest.json` and `styles.css` after the build. The release is published only after the three desktop platform checks and the attestation step succeed.

Obsidian downloads only those three installation assets. Plugin/source ZIPs, license notices and checksums are additional downloads for manual installation, developers and license verification. An extra-file recommendation does not mean Obsidian needs those files installed.

## CSS

0.13.3 removes the duplicate background declaration. Display math uses a scoped `[display="true"]` selector, preserving horizontal scrolling for MathJax output without an unknown custom-element type selector.

## Current review

Verified on 2026-09-29: the public [plugin page](https://community.obsidian.md/plugins/current-note-chat) shows version **0.14.0** and offers **Add to Obsidian**. The entry manager shows the automated review for release commit `2259d16` as **Completed**. The public scorecard reports **Excellent** health and **Satisfactory** review.

The review reports verified artifact attestations, no vulnerable dependencies and a reproduced build matching the release `main.js` byte for byte. Capability notices described above remain, including the vault-enumeration recommendation introduced by automatic classification. It also recommends removing unsupported extra release files, which Obsidian does not download. Completed means the checks finished, not that every category is a pass.

These results describe 0.14.0 at the date checked. Future releases need their own review. Illustrated workflows are available in the [screenshot guide](SCREENSHOTS.md); pending product improvements are listed in the [Chinese roadmap](OPTIMIZATION_ROADMAP.zh-CN.md).
