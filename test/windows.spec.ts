import { describe, it, expect, beforeEach } from 'vitest';

// Clear TS module cache between tests by using import() dynamically

async function loadWindowsModuleWithMock(mock: any) {
  // inject global
  (globalThis as any).__WIN_AUDIO_NATIVE = mock;
  // import a fresh copy
  const mod = await import('../dist/platforms/windows.js');
  return mod;
}

describe('windows platform wrapper', () => {
  it('calls native functions and normalizes values', async () => {
  const mock: any = {
      getSpeakerVolume: () => 0.42,
      setSpeakerVolume: (v: number) => { mock._lastSetSpeaker = v; },
      muteSpeaker: () => { mock._mutedSpeaker = true; },
      unmuteSpeaker: () => { mock._mutedSpeaker = false; },
      isSpeakerMuted: () => !!mock._mutedSpeaker,

      getMicVolume: () => 0.73,
      setMicVolume: (v: number) => { mock._lastSetMic = v; },
      muteMic: () => { mock._mutedMic = true; },
      unmuteMic: () => { mock._mutedMic = false; },
      isMicMuted: () => !!mock._mutedMic,
    };

  const mod = await loadWindowsModuleWithMock(mock);
    const speakerVol = await mod.speaker.get();
    expect(typeof speakerVol).toBe('number');
    expect(speakerVol).toBe(Math.round(0.42 * 100));

    await mod.speaker.set(55);
    expect(mock._lastSetSpeaker).toBe(55);

    await mod.speaker.mute();
    expect(mock._mutedSpeaker).toBe(true);

    await mod.speaker.unmute();
    expect(mock._mutedSpeaker).toBe(false);

    const micVol = await mod.mic.get();
    expect(micVol).toBe(Math.round(0.73 * 100));

    await mod.mic.set(70);
    expect(mock._lastSetMic).toBe(70);

    await mod.mic.mute();
    expect(mock._mutedMic).toBe(true);

    await mod.mic.unmute();
    expect(mock._mutedMic).toBe(false);
  });
});
