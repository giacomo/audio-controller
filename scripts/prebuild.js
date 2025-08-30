#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Detect platform-specific native module path candidates
const repoRoot = path.resolve(__dirname, '..');
const candidates = [
  path.join(repoRoot, 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'build', 'Release', 'mac_audio.node'),
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'native', 'macos', 'build', 'Release', 'mac_audio.node'),
];

function existsAny(paths) {
  if (paths.some(p => fs.existsSync(p))) return true;

  // Also accept any .node inside native/*/build/Release
  try {
    const nativeDir = path.join(repoRoot, 'native');
    if (fs.existsSync(nativeDir) && fs.statSync(nativeDir).isDirectory()) {
      const subs = fs.readdirSync(nativeDir);
      for (const s of subs) {
        const d = path.join(nativeDir, s, 'build', 'Release');
        if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
          const files = fs.readdirSync(d);
          if (files.some(f => f.endsWith('.node'))) return true;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return false;
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
