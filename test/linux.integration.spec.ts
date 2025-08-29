import { describe, it, expect } from 'vitest';

describe('linux integration', () => {
  it('backend should be available on real linux', async () => {
    if (process.platform !== 'linux') {
      // Skip on non-linux platforms
      return;
    }
    const mod = await import('../src/platforms/linux');
    // backendName should be 'pactl' or 'amixer' when a backend is installed
    // This test verifies CI installed pactl or amixer correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend: any = (mod as any).backendName;
    expect(['pactl', 'amixer']).toContain(backend);
  });
});
