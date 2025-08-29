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
  process.exit(0);
} catch (err) {
  console.error('Prebuild: failed to build native addon:', err.message || err);
  process.exit(err.status || 1);
}
