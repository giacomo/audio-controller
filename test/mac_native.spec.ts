import { describe, it, expect, vi, beforeAll } from 'vitest';

// Prepare a fake native addon to be returned by `bindings('mac_audio')`
const calls: any = { lastSet: null, muted: false };
const fakeNative = {
  getMicVolume: () => 0.42, // return scalar 0..1 to test normalization
  setMicVolume: (v: number) => { calls.lastSet = v; },
  muteMic: () => { calls.muted = true; },
  unmuteMic: () => { calls.muted = false; },
  isMicMuted: () => calls.muted,
};

// Inject the fake native into global before importing the mac adapter so the
// adapter picks up the test double instead of trying to require a built addon.
(globalThis as any).__MAC_AUDIO_NATIVE = fakeNative;

let mic: any;
beforeAll(async () => {
  const mod = await import('../src/platforms/macos');
  mic = mod.mic;
});

describe('mac native addon (mocked)', () => {
  it('mic.get normalizes scalar 0..1 to 0..100', async () => {
    const v = await mic.get();
    // fakeNative returns 0.42 -> normalized should be 42
    expect(v).toBe(42);
  });

  it('mic.set calls native with clamped integer', async () => {
    await mic.set(55.7);
    expect(calls.lastSet).toBe(56);

    await mic.set(200);
    expect(calls.lastSet).toBe(100);

    await mic.set(-5);
    expect(calls.lastSet).toBe(0);
  });

  it('mic.mute / mic.unmute / isMuted proxy to native', async () => {
    await mic.mute();
    expect(calls.muted).toBe(true);
    let muted = await mic.isMuted();
    expect(muted).toBe(true);

    await mic.unmute();
    expect(calls.muted).toBe(false);
    muted = await mic.isMuted();
    expect(muted).toBe(false);
  });
});
