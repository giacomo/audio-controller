#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Detect platform-specific native module path candidates
const repoRoot = path.resolve(__dirname, '..');
// Add common candidate locations for .node modules across platforms and build types
const candidates = [
  // Top-level build outputs (common names)
  path.join(repoRoot, 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'build', 'Debug', 'win_audio.node'),
  path.join(repoRoot, 'build', 'Release', 'mac_audio.node'),

  // Native subproject build outputs
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Release', 'win_audio.node'),
  path.join(repoRoot, 'native', 'win-audio', 'build', 'Debug', 'win_audio.node'),
  path.join(repoRoot, 'native', 'macos', 'build', 'Release', 'mac_audio.node'),

  // Other possible names
  path.join(repoRoot, 'build', 'Release', 'libwin_audio.node'),

  // dist or packaged locations (sometimes built into package-specific folders)
  path.join(repoRoot, 'dist', 'native', 'win_audio.node'),
  path.join(repoRoot, 'dist', 'native', 'mac_audio.node'),
];

function existsAny(paths) {
  // Return true if any explicit candidate exists
  if (paths.some(p => fs.existsSync(p))) return true;

  // Additionally, accept any .node file inside dist/native (handles prefixed or platform-specific names)
  try {
    const distNative = path.join(repoRoot, 'dist', 'native');
    if (fs.existsSync(distNative) && fs.statSync(distNative).isDirectory()) {
      const files = fs.readdirSync(distNative);
      if (files.some(f => f.endsWith('.node'))) return true;
    }
  } catch (e) {
    // ignore
  }

  // Also accept any .node in top-level build/Release or native/*/build/Release
  try {
    const buildRelease = path.join(repoRoot, 'build', 'Release');
    if (fs.existsSync(buildRelease) && fs.statSync(buildRelease).isDirectory()) {
      const files = fs.readdirSync(buildRelease);
      if (files.some(f => f.endsWith('.node'))) return true;
    }
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
  // After successful build, try to find any generated .node and copy them into dist/native
  const foundNodes = [];
  try {
    const top = path.join(repoRoot, 'build', 'Release');
    if (fs.existsSync(top) && fs.statSync(top).isDirectory()) {
      for (const f of fs.readdirSync(top)) if (f.endsWith('.node')) foundNodes.push(path.join(top, f));
    }

    const nativeDir = path.join(repoRoot, 'native');
    if (fs.existsSync(nativeDir) && fs.statSync(nativeDir).isDirectory()) {
      for (const s of fs.readdirSync(nativeDir)) {
        const d = path.join(nativeDir, s, 'build', 'Release');
        if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
          for (const f of fs.readdirSync(d)) if (f.endsWith('.node')) foundNodes.push(path.join(d, f));
        }
      }
    }
  } catch (e) {
    // ignore scan errors
  }

  if (foundNodes.length > 0) {
    const destDir = path.join(repoRoot, 'dist', 'native');
    fs.mkdirSync(destDir, { recursive: true });
    for (const found of foundNodes) {
      const dest = path.join(destDir, path.basename(found));
      try {
        fs.copyFileSync(found, dest);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
          console.log('Prebuild: copied native addon to', dest);
        }
      } catch (copyErr) {
        console.warn('Prebuild: failed to copy built .node into dist/native:', copyErr.message || copyErr);
      }
    }
  }

  process.exit(0);
} catch (err) {
  console.error('Prebuild: failed to build native addon:', err.message || err);
  process.exit(err.status || 1);
}
