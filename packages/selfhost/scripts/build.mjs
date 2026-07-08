/**
 * Assemble the publishable @alacrity-ai/kbrelay package (KBR-120).
 *
 * Runs the monorepo builds (SPA + self-host Node bundle) and copies the three
 * artifact trees this package ships — dist-node/, web/, migrations/ — into the
 * package dir. Wired as `prepublishOnly`, so `npm publish` from packages/selfhost
 * always publishes freshly-built artifacts. Must run from a repo checkout (the
 * published tarball doesn't include this script's inputs).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgDir, '..', '..');
const apiDir = join(repoRoot, 'apps', 'api');
const webDist = join(repoRoot, 'apps', 'web', 'dist');

if (!existsSync(join(repoRoot, 'pnpm-workspace.yaml'))) {
  console.error('✗ build.mjs must run from inside the kbRelay repo checkout.');
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
run('pnpm --filter @kbrelay/web run build');
run('pnpm --filter @kbrelay/api run build:node');

for (const [src, dest] of [
  [join(apiDir, 'dist-node'), join(pkgDir, 'dist-node')],
  [join(apiDir, 'migrations'), join(pkgDir, 'migrations')],
  [webDist, join(pkgDir, 'web')],
]) {
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[selfhost build] copied ${src} → ${dest}`);
}
console.log('[selfhost build] package assembled — ready to pack/publish');
