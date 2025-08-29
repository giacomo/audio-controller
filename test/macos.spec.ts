import { describe, it, expect, vi } from 'vitest';

// Mock child_process.exec used by the macos speaker implementation
vi.mock('child_process', () => {
  return {
    exec: (cmd: string, cb: Function) => {
      // simple parsing for our test cases
      if (cmd.includes('output volume of')) {
        cb(null, { stdout: '42\n' }, '');
      } else if (cmd.includes('output muted of')) {
        cb(null, { stdout: 'true\n' }, '');
      } else if (cmd.includes('set volume output volume')) {
        cb(null, { stdout: '' }, '');
      } else {
        cb(new Error('unexpected'), null, '');
      }
    }
  };
});

import { speaker } from '../src/platforms/macos';

describe('macos platform wrapper', () => {
  it('speaker.get and speaker.set and mute/unmute should work (mocked)', async () => {
    const v = await speaker.get();
    expect(v).toBe(42);
    await speaker.set(55);
    const muted = await speaker.isMuted();
    expect(muted).toBe(true);
  });
});
