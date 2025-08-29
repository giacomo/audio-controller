// Example usage for audio-controller
// This file is compiled by `tsc` and run via `node dist/example.js` (see package.json scripts)

import audio from './index.js';

function wait(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

async function main() {
  console.log('Audio controller example — platform:', process.platform);

  // Read initial state
  const initialSpeaker = await audio.speaker.get();
  const initialSpeakerMuted = await audio.speaker.isMuted();
  const initialMic = await audio.mic.get();
  const initialMicMuted = await audio.mic.isMuted();

  console.log('Initial speaker:', initialSpeaker, 'muted?', initialSpeakerMuted);
  console.log('Initial mic:', initialMic, 'muted?', initialMicMuted);

  try {
    console.log('\n--- Speaker: set to 75 (wait 3s) ---');
    await audio.speaker.set(75);
    console.log('Now:', await audio.speaker.get());
    await wait(3000);

    console.log('Muting speaker (wait 3s)');
    await audio.speaker.mute();
    console.log('Muted?', await audio.speaker.isMuted());
    await wait(3000);

    console.log('Unmuting and set to 30 (wait 3s)');
    await audio.speaker.unmute();
    await audio.speaker.set(30);
    console.log('Now:', await audio.speaker.get());
    await wait(3000);

    console.log('\n--- Microphone: increase then mute ---');
    await audio.mic.set(Math.min(100, initialMic + 10));
    console.log('Mic now:', await audio.mic.get());
    await wait(3000);

    console.log('Muting mic (wait 3s)');
    await audio.mic.mute();
    console.log('Mic muted?', await audio.mic.isMuted());
    await wait(3000);

  } catch (err) {
    console.error('Example actions failed:', err);
  } finally {
    // Restore original values
    console.log('\nRestoring original speaker/mic values...');
    try {
      if (initialSpeakerMuted) await audio.speaker.mute(); else await audio.speaker.unmute();
      await audio.speaker.set(initialSpeaker);

      if (initialMicMuted) await audio.mic.mute(); else await audio.mic.unmute();
      await audio.mic.set(initialMic);

      console.log('Restored original speaker/mic values.');
    } catch (restoreErr) {
      console.error('Failed to restore original values:', restoreErr);
    }
  }
}

main().catch(err => {
  console.error('Example failed:', err);
  process.exitCode = 1;
});
