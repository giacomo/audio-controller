import { describe, it, expect, beforeAll } from 'vitest';

// Create a fake native addon for Windows
const calls: any = { speakerSet: null, micSet: null, speakerMuted: false, micMuted: false };
const fakeNative = {
  getSpeakerVolume: () => 0.55, // scalar 0..1
  setSpeakerVolume: (v: number) => { calls.speakerSet = v; },
  muteSpeaker: () => { calls.speakerMuted = true; },
  unmuteSpeaker: () => { calls.speakerMuted = false; },
  isSpeakerMuted: () => calls.speakerMuted,

  getMicVolume: () => 77, // already 0..100
  setMicVolume: (v: number) => { calls.micSet = v; },
  muteMic: () => { calls.micMuted = true; },
  unmuteMic: () => { calls.micMuted = false; },
  isMicMuted: () => calls.micMuted,
};

// Inject before module import
(globalThis as any).__WIN_AUDIO_NATIVE = fakeNative;

let platform: any;
beforeAll(async () => {
  platform = await import('../src/platforms/windows');
});

describe('windows native addon (mocked)', () => {
  it('speaker.get normalizes 0..1 scalar', async () => {
    const v = await platform.speaker.get();
    expect(v).toBe(55);
  });

  it('mic.get reads 0..100 value', async () => {
    const v = await platform.mic.get();
    expect(v).toBe(77);
  });

  it('speaker.set/mic.set and mute/unmute proxy to native', async () => {
    await platform.speaker.set(33.9);
    expect(calls.speakerSet).toBe(34);

    await platform.mic.set(12.3);
    expect(calls.micSet).toBe(12);

    await platform.speaker.mute();
    expect(calls.speakerMuted).toBe(true);
    await platform.speaker.unmute();
    expect(calls.speakerMuted).toBe(false);

    await platform.mic.mute();
    expect(calls.micMuted).toBe(true);
    await platform.mic.unmute();
    expect(calls.micMuted).toBe(false);
  });
});
