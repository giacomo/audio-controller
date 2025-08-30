// Entry point and platform dispatcher for audio-controller

interface DeviceControl {
  get(): Promise<number>;
  set(volume: number): Promise<void>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): Promise<boolean>;
}

interface AudioController {
  speaker: DeviceControl;
  mic: DeviceControl;
}

import os from 'os';

const platform = os.platform();

let audio: AudioController;

if (platform === 'win32') {
  // Windows implementation
  const win = await import('./platforms/windows.js');
  audio = {
    speaker: win.speaker,
    mic: win.mic
  } as AudioController;
} else if (platform === 'darwin') {
  const mac = await import('./platforms/macos.js');
  audio = { speaker: mac.speaker, mic: mac.mic } as AudioController;
} else if (platform === 'linux') {
  const linux = await import('./platforms/linux.js');
  audio = { speaker: linux.speaker, mic: linux.mic } as AudioController;
} else {
  // Placeholder for other non-implemented platforms
  const notImpl = () => Promise.reject(new Error('Not implemented on this platform'));
  const device: DeviceControl = {
    get: notImpl as any,
    set: notImpl as any,
    mute: notImpl as any,
    unmute: notImpl as any,
    isMuted: notImpl as any
  };
  audio = { speaker: device, mic: device };
}

export default audio;
