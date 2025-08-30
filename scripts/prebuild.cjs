#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Detect platform-specific native module path candidates
const repoRoot = path.resolve(__dirname, '..');
// Add common candidate locations for .node modules across platforms and build types
const candidates = [
  // Top-level build outputs
  path.join(repoRoot, 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'build', 'Debug', 'win_audio.node'),

  // Native subproject build outputs (Windows)
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Debug', 'win_audio.node'),

  // macOS / Linux typical outputs (node addons are still .node files)
  path.join(repoRoot, 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'build', 'Release', 'libwin_audio.node'),
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Release', 'libwin_audio.node'),

  // dist or packaged locations (sometimes built into package-specific folders)
  path.join(repoRoot, 'dist', 'native', 'win_audio.node'),
];

function existsAny(paths) {
  return paths.some(p => fs.existsSync(p));
}

try {
  // Parse CLI flags: support --force or -f to force a rebuild
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');

  if (existsAny(candidates)) {
    if (!force) {
      console.log('Prebuild: native addon already built — skipping node-gyp rebuild.');
      process.exit(0);
    }
    console.log('Prebuild: --force provided — forcing node-gyp rebuild despite existing artifacts.');
  }

  console.log('Prebuild: running `node-gyp rebuild`...');
  execSync('node-gyp rebuild', { stdio: 'inherit' });
  // After successful build, try to find the generated .node and copy it into dist/native
  const outCandidates = [
    path.join(repoRoot, 'build', 'Release', 'win_audio.node'),
    path.join(repoRoot, 'native', 'win-audio', 'build', 'Release', 'win_audio.node'),
  ];

  const found = outCandidates.find(p => fs.existsSync(p));
  if (found) {
    const destDir = path.join(repoRoot, 'dist', 'native');
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, path.basename(found));
    try {
      // copyFile with COPYFILE_FICLONE may create reflinks on some FS; use default copy to be safe
      fs.copyFileSync(found, dest);
      // ensure copied file has non-zero size
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        console.log('Prebuild: copied native addon to', dest);
      }
    } catch (copyErr) {
      console.warn('Prebuild: failed to copy built .node into dist/native:', copyErr.message || copyErr);
    }
  }

  process.exit(0);
} catch (err) {
  console.error('Prebuild: failed to build native addon:', err.message || err);
  process.exit(err.status || 1);
}
