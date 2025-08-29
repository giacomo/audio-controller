import { describe, it, expect, vi, beforeAll } from 'vitest';

// We'll mock child_process.exec and execSync to simulate pactl presence and outputs
const execMock = vi.fn();
const execSyncMock = vi.fn((cmd: string) => {
  if (typeof cmd === 'string' && cmd.includes('pactl')) return 'pactl 1.0';
  if (typeof cmd === 'string' && cmd.includes('amixer')) return 'amixer 1.0';
  throw new Error('command not found');
});
vi.mock('child_process', () => ({
  exec: execMock,
  execSync: execSyncMock
}));

// Provide fake implementations for promisified exec (returns { stdout })
execMock.mockImplementation((cmd: string, cb?: any) => {
  // If callback form is used, call cb(null, { stdout: '...' })
  if (cb) {
    let out = '';
    if (cmd.includes('get-sink-volume')) out = 'Volume: front-left: 65536 / 100% / 0.00 dB';
    else if (cmd.includes('get-source-volume')) out = 'Volume: front-left: 32768 / 50% / -6.00 dB';
    else if (cmd.includes('get-sink-mute')) out = 'Mute: yes';
    else if (cmd.includes('get-source-mute')) out = 'Mute: no';
    cb(null, { stdout: out, stderr: '' });
    return {} as any;
  }
  // For promise style, return an object similar to util.promisify(exec)
  let out = '';
  if (cmd.includes('get-sink-volume')) out = 'Volume: front-left: 65536 / 100% / 0.00 dB';
  else if (cmd.includes('get-source-volume')) out = 'Volume: front-left: 32768 / 50% / -6.00 dB';
  else if (cmd.includes('get-sink-mute')) out = 'Mute: yes';
  else if (cmd.includes('get-source-mute')) out = 'Mute: no';
  return Promise.resolve({ stdout: out, stderr: '' });
});

let platform: any;
beforeAll(async () => {
  platform = await import('../src/platforms/linux');
});

describe('linux pactl adapter (mocked)', () => {
  it('speaker.get parses 100% to 100', async () => {
    const v = await platform.speaker.get();
    expect(v).toBe(100);
  });

  it('mic.get parses 50% to 50', async () => {
    const v = await platform.mic.get();
    expect(v).toBe(50);
  });

  it('speaker.set/mic.set and mute/unmute proxy to pactl', async () => {
    // Clear mock history
    execMock.mockClear();

    await platform.speaker.set(45.2);
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('pactl set-sink-volume'), expect.any(Function));

    await platform.mic.set(12);
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('pactl set-source-volume'), expect.any(Function));

    await platform.speaker.mute();
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('pactl set-sink-mute'), expect.any(Function));

    await platform.speaker.unmute();
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('pactl set-sink-mute'), expect.any(Function));

    await platform.mic.mute();
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('pactl set-source-mute'), expect.any(Function));

    await platform.mic.unmute();
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('pactl set-source-mute'), expect.any(Function));
  });

  it('isMuted reads correct boolean', async () => {
    const s = await platform.speaker.isMuted();
    expect(s).toBe(true);
    const m = await platform.mic.isMuted();
    expect(m).toBe(false);
  });
});
