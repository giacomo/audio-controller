#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Detect platform-specific native module path candidates
const repoRoot = path.resolve(__dirname, '..');
const candidates = [
  path.join(repoRoot, 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Release', 'win_audio.node'),
];

function existsAny(paths) {
  return paths.some(p => fs.existsSync(p));
}

try {
  if (existsAny(candidates)) {
    console.log('Prebuild: native addon already built — skipping node-gyp rebuild.');
    process.exit(0);
  }

  console.log('Prebuild: native addon not found — running `node-gyp rebuild`...');
  execSync('node-gyp rebuild', { stdio: 'inherit' });
  process.exit(0);
} catch (err) {
  console.error('Prebuild: failed to build native addon:', err.message || err);
  process.exit(err.status || 1);
}
