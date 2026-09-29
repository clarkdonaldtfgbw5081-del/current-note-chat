// One-time user-requested cleanup. All identities and replacement assets are
// verified before the first delete; unknown releases/tags are never selected.
const fs = require('node:fs');

module.exports = async function cleanup({ github, context, core, spec, version }) {
  version ??= JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version;
  if (version !== '1.0.0') { core.notice('First-release cleanup does not apply to this version.'); return; }
  spec ??= JSON.parse(fs.readFileSync('.github/first-release-cleanup.json', 'utf8'));
  const repos = github.rest.repos;
  const git = github.rest.git;
  const { data: replacement } = await repos.getReleaseByTag({ ...context.repo, tag: '1.0.0' });
  if (replacement.draft || replacement.prerelease || replacement.tag_name !== '1.0.0') throw new Error('Replacement must be the public stable first release.');
  for (const expected of spec.expected) {
    const asset = replacement.assets.find(item => item.name === expected.name);
    if (!asset || asset.size !== expected.size || asset.digest !== expected.digest) throw new Error(`Unverified replacement asset: ${expected.name}`);
  }
  for (const name of ['current-note-chat-plugin-1.0.0.zip', 'current-note-chat-source-1.0.0.zip', 'SHA256SUMS.txt']) {
    if (!replacement.assets.some(item => item.name === name && item.size > 0)) throw new Error(`Missing replacement package: ${name}`);
  }
  const { data: firstTag } = await git.getRef({ ...context.repo, ref: 'tags/1.0.0' });
  if (firstTag.object.type !== 'commit' || spec.tags.some(item => item.sha === firstTag.object.sha)) throw new Error('Replacement tag points to a retired version.');

  const releasePlan = [];
  const tagPlan = [];
  for (const expected of spec.releases) {
    try {
      const { data: old } = await repos.getRelease({ ...context.repo, release_id: expected.id });
      if (old.id !== expected.id || old.tag_name !== expected.tag || old.id === replacement.id) throw new Error('Old release identity changed; refusing deletion.');
      releasePlan.push(expected);
    } catch (error) { if (error.status !== 404) throw error; }
  }
  for (const expected of spec.tags) {
    try {
      const { data: old } = await git.getRef({ ...context.repo, ref: expected.ref });
      if (old.ref !== `refs/${expected.ref}` || old.object.type !== 'commit' || old.object.sha !== expected.sha || expected.ref === 'tags/1.0.0') throw new Error('Old tag identity changed; refusing deletion.');
      tagPlan.push(expected);
    } catch (error) { if (error.status !== 404) throw error; }
  }
  for (const item of releasePlan) {
    await repos.deleteRelease({ ...context.repo, release_id: item.id });
    core.notice(`Removed superseded release ${item.tag}.`);
  }
  for (const item of tagPlan) {
    await git.deleteRef({ ...context.repo, ref: item.ref });
    core.notice(`Removed superseded tag ${item.ref}; development commits retained.`);
  }
  await core.summary.addHeading('First release cleanup complete').addRaw(`Removed ${releasePlan.length} old releases and ${tagPlan.length} old version tags. Version 1.0.0 and its checked installation/video assets remain public. Development commits are retained.`).write();
};
