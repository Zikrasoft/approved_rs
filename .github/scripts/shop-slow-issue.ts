import { spawnSync } from 'node:child_process';

const TITLE = 'Shop slow specs failed on main';
const gh = process.env.GH || 'gh';
const runUrl = process.argv[2];

if (!runUrl) {
  console.error('usage: shop-slow-issue.ts <run-url>');
  process.exit(1);
}

function call(args: string[]) {
  const result = spawnSync(gh, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`gh ${args[0]} ${args[1]} failed`);
    process.exit(1);
  }
  return result.stdout;
}

const existing = call([
  'issue',
  'list',
  '--state',
  'open',
  '--label',
  'bug',
  '--search',
  `"${TITLE}" in:title`,
  '--json',
  'number,title',
  '--jq',
  `map(select(.title == "${TITLE}")) | first | .number // empty`,
]).trim();
const body = `The slow specs failed: ${runUrl}`;
if (existing) {
  call(['issue', 'comment', existing, '--body', body]);
} else {
  call(['issue', 'create', '--title', TITLE, '--label', 'bug', '--body', body]);
}
