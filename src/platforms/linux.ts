import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execP = promisify(exec as any);

// Detect available backend at module load time. Prefer pactl (PulseAudio/PipeWire),
// fall back to amixer (ALSA) if pactl is not present. If none are available, backend='none'.
// Allow test injection: set globalThis.__LINUX_AUDIO_BACKEND = 'pactl'|'amixer'|'none' before importing
let backend = 'none';
if ((globalThis as any).__LINUX_AUDIO_BACKEND) {
  backend = (globalThis as any).__LINUX_AUDIO_BACKEND;
} else {
  try {
    execSync('pactl --version', { stdio: 'ignore' });
    backend = 'pactl';
  } catch (_) {
    try {
      execSync('amixer --version', { stdio: 'ignore' });
      backend = 'amixer';
    } catch (_) {
      backend = 'none';
    }
  }
}

export const backendName = backend;

// Allow injection of a native-like object for tests: globalThis.__LINUX_AUDIO_NATIVE
const injectedNative = (globalThis as any).__LINUX_AUDIO_NATIVE || null;


async function runCmd(cmd: string): Promise<string> {
  try {
    const r = await execP(cmd);
    return (r && (r as any).stdout) || '';
  } catch (err: any) {
    throw new Error(`Failed to run command: ${cmd} -> ${(err && err.message) || err}`);
  }
}

function parseVolume(output: string): number {
  const m = output.match(/(\d+)%/);
  if (m) return Math.max(0, Math.min(100, Number(m[1])));
  const n = Number(output.trim());
  if (!Number.isNaN(n)) return Math.max(0, Math.min(100, Math.round(n)));
  throw new Error('Failed to parse volume from output: ' + output);
}

const speaker = {
  async get(): Promise<number> {
    if (injectedNative && typeof injectedNative.getSpeakerVolume === 'function') {
      let v = Number(injectedNative.getSpeakerVolume());
      if (Number.isFinite(v) && v <= 1) v = v * 100;
      return Math.max(0, Math.min(100, Math.round(v || 0)));
    }
    if (backend === 'pactl') {
      const out = await runCmd('pactl get-sink-volume @DEFAULT_SINK@');
      return parseVolume(out);
    }
    if (backend === 'amixer') {
      const out = await runCmd("amixer get Master");
      return parseVolume(out);
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async set(volume: number): Promise<void> {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) throw new TypeError('volume must be a number');
    const v = Math.max(0, Math.min(100, Math.round(volume)));
    if (injectedNative && typeof injectedNative.setSpeakerVolume === 'function') {
      injectedNative.setSpeakerVolume(v);
      return;
    }
    if (backend === 'pactl') {
      await runCmd(`pactl set-sink-volume @DEFAULT_SINK@ ${v}%`);
      return;
    }
    if (backend === 'amixer') {
      await runCmd(`amixer set Master ${v}%`);
      return;
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async mute(): Promise<void> {
    if (injectedNative && typeof injectedNative.muteSpeaker === 'function') {
      injectedNative.muteSpeaker();
      return;
    }
    if (backend === 'pactl') {
      await runCmd('pactl set-sink-mute @DEFAULT_SINK@ 1');
      return;
    }
    if (backend === 'amixer') {
      await runCmd('amixer set Master mute');
      return;
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async unmute(): Promise<void> {
    if (injectedNative && typeof injectedNative.unmuteSpeaker === 'function') {
      injectedNative.unmuteSpeaker();
      return;
    }
    if (backend === 'pactl') {
      await runCmd('pactl set-sink-mute @DEFAULT_SINK@ 0');
      return;
    }
    if (backend === 'amixer') {
      await runCmd('amixer set Master unmute');
      return;
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async isMuted(): Promise<boolean> {
    if (injectedNative && typeof injectedNative.isSpeakerMuted === 'function') {
      return Boolean(injectedNative.isSpeakerMuted());
    }
    if (backend === 'pactl') {
      const out = await runCmd('pactl get-sink-mute @DEFAULT_SINK@');
      return /yes|true/i.test(out);
    }
    if (backend === 'amixer') {
      const out = await runCmd('amixer get Master');
      return /\[off\]|\[mute\]/i.test(out);
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  }
};

const mic = {
  async get(): Promise<number> {
    if (injectedNative && typeof injectedNative.getMicVolume === 'function') {
      let v = Number(injectedNative.getMicVolume());
      if (Number.isFinite(v) && v <= 1) v = v * 100;
      return Math.max(0, Math.min(100, Math.round(v || 0)));
    }
    if (backend === 'pactl') {
      const out = await runCmd('pactl get-source-volume @DEFAULT_SOURCE@');
      return parseVolume(out);
    }
    if (backend === 'amixer') {
      const out = await runCmd('amixer get Capture');
      return parseVolume(out);
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async set(volume: number): Promise<void> {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) throw new TypeError('volume must be a number');
    const v = Math.max(0, Math.min(100, Math.round(volume)));
    if (injectedNative && typeof injectedNative.setMicVolume === 'function') {
      injectedNative.setMicVolume(v);
      return;
    }
    if (backend === 'pactl') {
      await runCmd(`pactl set-source-volume @DEFAULT_SOURCE@ ${v}%`);
      return;
    }
    if (backend === 'amixer') {
      await runCmd(`amixer set Capture ${v}%`);
      return;
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async mute(): Promise<void> {
    if (injectedNative && typeof injectedNative.muteMic === 'function') {
      injectedNative.muteMic();
      return;
    }
    if (backend === 'pactl') {
      await runCmd('pactl set-source-mute @DEFAULT_SOURCE@ 1');
      return;
    }
    if (backend === 'amixer') {
      await runCmd('amixer set Capture cap');
      return;
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async unmute(): Promise<void> {
    if (injectedNative && typeof injectedNative.unmuteMic === 'function') {
      injectedNative.unmuteMic();
      return;
    }
    if (backend === 'pactl') {
      await runCmd('pactl set-source-mute @DEFAULT_SOURCE@ 0');
      return;
    }
    if (backend === 'amixer') {
      await runCmd('amixer set Capture uncap');
      return;
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  },
  async isMuted(): Promise<boolean> {
    if (injectedNative && typeof injectedNative.isMicMuted === 'function') {
      return Boolean(injectedNative.isMicMuted());
    }
    if (backend === 'pactl') {
      const out = await runCmd('pactl get-source-mute @DEFAULT_SOURCE@');
      return /yes|true/i.test(out);
    }
    if (backend === 'amixer') {
      const out = await runCmd('amixer get Capture');
      return /\[off\]|\[mute\]/i.test(out);
    }
    throw new Error('No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils).');
  }
};

export { speaker, mic };
export default { speaker, mic };
