import { exec } from 'child_process';
import { promisify } from 'util';

const execP = promisify(exec);

function runOsascript(line: string): Promise<string> {
  // Wrap the AppleScript line in quotes safely
  return execP(`osascript -e ${JSON.stringify(line)}`).then(r => r.stdout.trim());
}

const speaker = {
  async get(): Promise<number> {
    try {
      const out = await runOsascript('output volume of (get volume settings)');
      const v = parseInt(out, 10);
      if (Number.isNaN(v)) throw new Error('Failed to parse volume');
      return Math.max(0, Math.min(100, v));
    } catch (err) {
      throw new Error('Failed to get speaker volume: ' + (err && (err as Error).message));
    }
  },

  async set(volume: number): Promise<void> {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) throw new TypeError('volume must be a number');
    const v = Math.max(0, Math.min(100, Math.round(volume)));
    await runOsascript(`set volume output volume ${v}`);
  },

  async mute(): Promise<void> {
    await runOsascript('set volume output muted true');
  },

  async unmute(): Promise<void> {
    await runOsascript('set volume output muted false');
  },

  async isMuted(): Promise<boolean> {
    try {
      const out = await runOsascript('output muted of (get volume settings)');
      const norm = out.trim().toLowerCase();
      return norm === 'true' || norm === 'yes';
    } catch (err) {
      throw new Error('Failed to get speaker mute state: ' + (err && (err as Error).message));
    }
  }
};

  // Allow test injection: set globalThis.__MAC_AUDIO_NATIVE = { ... } before importing this module
  let native: any = null;
  if ((globalThis as any).__MAC_AUDIO_NATIVE) {
    native = (globalThis as any).__MAC_AUDIO_NATIVE;
  } else {
    try {
      // prefer top-level build output
      native = require('../../build/Release/mac_audio.node');
    } catch (_) {
      try {
        native = require('bindings')('mac_audio');
      } catch (_) {
        native = null;
      }
    }
  }

const mic = native
  ? {
      async get(): Promise<number> {
  let v = Number(native.getMicVolume());
  if (Number.isFinite(v) && v <= 1) v = v * 100; // accept 0..1 scalar or 0..100
  return Math.max(0, Math.min(100, Math.round(v || 0)));
      },
      async set(v: number): Promise<void> {
        native.setMicVolume(Math.max(0, Math.min(100, Math.round(v))));
      },
      async mute(): Promise<void> {
        native.muteMic();
      },
      async unmute(): Promise<void> {
        native.unmuteMic();
      },
      async isMuted(): Promise<boolean> {
        return Boolean(native.isMicMuted());
      }
    }
  : {
      async get(): Promise<number> {
        throw new Error('Microphone volume control is not implemented on macOS in this build. Build the native mac_audio addon.');
      },
      async set(_v: number): Promise<void> {
        throw new Error('Microphone volume control is not implemented on macOS in this build. Build the native mac_audio addon.');
      },
      async mute(): Promise<void> {
        throw new Error('Microphone mute is not implemented on macOS in this build. Build the native mac_audio addon.');
      },
      async unmute(): Promise<void> {
        throw new Error('Microphone mute is not implemented on macOS in this build. Build the native mac_audio addon.');
      },
      async isMuted(): Promise<boolean> {
        throw new Error('Microphone mute is not implemented on macOS in this build. Build the native mac_audio addon.');
      }
    };

export { speaker, mic };
