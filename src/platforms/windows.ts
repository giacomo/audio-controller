import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

type NativeWinAudio = any;
let native: NativeWinAudio | null = null;

// Use a require function compatible with ESM runtime
const req = createRequire(import.meta.url);

// Compute dirname for ESM (replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow injection for tests: set globalThis.__WIN_AUDIO_NATIVE = { ... } before importing this module
if ((globalThis as any).__WIN_AUDIO_NATIVE) {
  native = (globalThis as any).__WIN_AUDIO_NATIVE as NativeWinAudio;
} else {
  // Candidate paths where the built addon may reside
  const candidates = [
    path.join(__dirname, '..', '..', 'build', 'Release', 'win_audio.node'),
    path.join(__dirname, '..', '..', 'native', 'win-audio', 'build', 'Release', 'win_audio.node'),
    path.join(__dirname, '..', '..', 'native', 'win-audio', 'build', 'Debug', 'win_audio.node'),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        native = req(p);
        break;
      }
    } catch (e) {
      // continue trying other candidates
    }
  }

  if (!native) {
    try {
      // Try bindings() as a last resort
      const bindings = req('bindings');
      native = bindings('win_audio');
    } catch (err) {
      native = null;
    }
  }
}

function ensureNative() {
  if (!native) throw new Error('Native win_audio module not loaded. Build with node-gyp (see README).');
}

export const speaker = {
  get: async (): Promise<number> => {
    ensureNative();
  let v = Number(native.getSpeakerVolume());
  if (Number.isFinite(v) && v <= 1) v = v * 100; // accept 0..1 scalar or 0..100
  return Math.max(0, Math.min(100, Math.round(v || 0)));
  },
  set: async (volume: number): Promise<void> => {
    ensureNative();
    const vol = Math.max(0, Math.min(100, Math.round(volume)));
    native.setSpeakerVolume(vol);
  },
  mute: async (): Promise<void> => {
    ensureNative();
    native.muteSpeaker();
  },
  unmute: async (): Promise<void> => {
    ensureNative();
    native.unmuteSpeaker();
  },
  isMuted: async (): Promise<boolean> => {
    ensureNative();
    return !!native.isSpeakerMuted();
  }
};

export const mic = {
  get: async (): Promise<number> => {
    ensureNative();
  let v = Number(native.getMicVolume());
  if (Number.isFinite(v) && v <= 1) v = v * 100;
  return Math.max(0, Math.min(100, Math.round(v || 0)));
  },
  set: async (volume: number): Promise<void> => {
    ensureNative();
    const vol = Math.max(0, Math.min(100, Math.round(volume)));
    native.setMicVolume(vol);
  },
  mute: async (): Promise<void> => {
    ensureNative();
    native.muteMic();
  },
  unmute: async (): Promise<void> => {
    ensureNative();
    native.unmuteMic();
  },
  isMuted: async (): Promise<boolean> => {
    ensureNative();
    return !!native.isMicMuted();
  }
};

export default { speaker, mic };
