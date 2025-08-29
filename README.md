# audio-controller

Cross-platform TypeScript library for controlling system speaker and microphone volume and mute state. Designed to be published to npm and usable in Electron apps (renderer via a secure preload bridge).

This README documents the public API, TypeScript contract, implementation strategies per platform (Windows / macOS / Linux), Electron integration notes, dev setup using yarn + TypeScript, tests and publishing guidance.

## Goals / Requirements

- Works on Windows, macOS and Linux (implementation details differ per-OS).
- Clean, usable and understandable API (promise-based, TypeScript-first).
- Exposes the following functions for speakers and microphone:

  - `audio.speaker.get()`      // current speaker volume (0-100)
  - `audio.speaker.set(50)`    // set speaker volume (0-100)
  - `audio.speaker.mute()`     // mute speakers
  - `audio.speaker.unmute()`   // unmute speakers
  - `audio.speaker.isMuted()`  // check speaker mute state (boolean)

  - `audio.mic.get()`          // current mic volume (0-100)
  - `audio.mic.set(70)`        // set mic volume (0-100)
  - `audio.mic.mute()`         // mute mic
  - `audio.mic.unmute()`       // unmute mic
  - `audio.mic.isMuted()`      // check mic mute state (boolean)

All functions return Promises and reject on error.

## Public API (TypeScript)

This is the canonical TypeScript contract for the package.

```ts
export interface DeviceControl {
  /** Get current volume as integer 0-100 */
  get(): Promise<number>;

  /** Set volume (0-100) */
  set(volume: number): Promise<void>;

  /** Mute device */
  mute(): Promise<void>;

  /** Unmute device */
  unmute(): Promise<void>;

  /** Returns true if muted */
  isMuted(): Promise<boolean>;
}

export interface AudioController {
  speaker: DeviceControl;
  mic: DeviceControl;
}

declare const audio: AudioController;
export default audio;
```

Usage (ESM / CommonJS compatible):

```ts
import audio from 'audio-controller';

const vol = await audio.speaker.get();
await audio.speaker.set(50);
await audio.mic.mute();
const muted = await audio.mic.isMuted();
```

## Contract & Behavior

- Volume is normalized to integers 0..100. Implementations should clamp values outside range.
- `get()` returns a number in 0..100. If the OS reports a different scale, convert it.
- `isMuted()` should reflect the OS mute state for the device (true/false).
- All methods should reject with a descriptive Error when they fail (command missing, permission denied, no default device, unsupported platform feature).
- Non-blocking: operations should be implemented asynchronously and not block the event loop.

## Edge cases & notes

- No default sink/source: reject with an Error mentioning "no default device".
- Permission restrictions: on macOS, microphone access may require user permission; document this and provide guidance in your app.
- Multiple devices: this API targets the system default devices; adding device enumeration is a follow-up feature.
- Precision: some OS APIs only support integer steps or non-linear ranges; normalize to 0..100.

## Implementation approaches (recommended)

There are two practical approaches:

1. Use battle-tested native/node modules (preferred when available).
   - Pros: fewer platform-specific commands to maintain; often robust.
   - Cons: native modules may need rebuilding for Electron / specific Node versions and may have licensing differences.

2. Use small platform-specific CLI tools or OS commands invoked with `child_process`.
   - Pros: easy to implement and inspect; no native add-ons.
   - Cons: requires those CLI tools to be present on the host or bundled, and some OS features (like mic input volume on macOS) are not exposed via simple CLIs.

Below are practical examples per-OS to guide an implementation. Use these as starting points, not final copy-paste in production—test each command and handle errors.

### Linux (recommended: PulseAudio / PipeWire via pactl)

- Speaker (default sink)
  - get: `pactl get-sink-volume @DEFAULT_SINK@` and parse the percentage for the front-left or average channels.
  - set: `pactl set-sink-volume @DEFAULT_SINK@ 50%`
  - mute: `pactl set-sink-mute @DEFAULT_SINK@ 1`
  - unmute: `pactl set-sink-mute @DEFAULT_SINK@ 0`
  - isMuted: `pactl get-sink-mute @DEFAULT_SINK@` (look for "yes"/"no").

- Microphone (default source)
  - same as above but use `@DEFAULT_SOURCE@` and `set-source-volume` / `set-source-mute` and `get-source-mute`.

Notes: many modern distros use PipeWire which provides the same `pactl` interface. Ensure `pactl` is available or detect and fail with a helpful message.

### macOS (CoreAudio)

- Speaker (output)
  - Common approach: call `osascript` (AppleScript) to get/set the output volume for the system. Example: run `osascript -e 'output volume of (get volume settings)'` to read and `osascript -e 'set volume output volume 50'` to set.
  - Mute/unmute can be toggled with AppleScript as well (implementation detail varies by macOS version).

- Microphone (input)
  - macOS does not provide a trivial built-in CLI to set input device volume. Typical solutions:
    - Use a native CoreAudio helper (C/C++/Objective-C) exposed through a small native Node add-on.
    - Use third-party CLIs / tools (if available) that wrap CoreAudio.

Notes: For macOS mic control you will likely need a native module or helper app. Also, apps that access the microphone in macOS may need to declare appropriate entitlements and request permission from the user.

#### macOS native addon (microphone)

This repository includes a prototype native addon at `native/macos/mic_audio.mm` and a `binding.gyp` under `native/macos/` that builds the `mac_audio` addon.

Build instructions (macOS machine):

```bash
# from the repo root
cd native/macos
node-gyp rebuild
```

If you prefer to build from the repo root you can also run `node-gyp rebuild` inside the `native/macos` folder in your CI script. The addon exports the following functions which the TypeScript mac adapter will use when present:

- `getMicVolume(): number` (0..100)
- `setMicVolume(v: number): void`
- `muteMic(): void`
- `unmuteMic(): void`
- `isMicMuted(): boolean`

Permissions and entitlements:

- macOS requires user permission (TCC) to access the microphone. When your app needs to read or change mic settings, ensure the app requests microphone access and include appropriate usage strings in your app's Info.plist (for example `NSMicrophoneUsageDescription`).
- If shipping as a sandboxed app or the app is signed/notarized, add the required entitlements. Changing system audio programmatically may also require running helper tooling or privileged components in some environments.

Testing the mac adapter:

- Unit tests in this repo mock `child_process.exec` (used by the AppleScript-based speaker control). The test that covers the mac adapter is at `test/macos.spec.ts` and uses Vitest. These tests do not require a macOS machine because they mock the child process calls.
- To run the tests locally: `yarn unit`.

## audio-controller
### Windows
Cross-platform TypeScript library for controlling system speaker and microphone volume and mute state.
- Windows has limited built-in CLI tools for volume. Common strategies:
This README documents the public API implemented by this repository, local dev scripts, test guidance, and a few platform notes. The library exposes a small, promise-based API for the system default speaker (output) and microphone (input).
  - Use a small helper binary such as NirCmd or SoundVolumeView (third-party). For example, NirCmd exposes `nircmd setsysvolume <value>` where `<value>` is 0..65535; convert 0..100 to that range.
## Quick checklist
Examples (conceptual):
- `audio.speaker.get()` → Promise<number> (0..100)
- `audio.speaker.set(percent: number)` → Promise<void>
- `audio.speaker.mute()` → Promise<void>

- `audio.speaker.isMuted()` → Promise<boolean>
- same methods available under `audio.mic` for the microphone (input)
Notes: Shipping third-party binaries requires attention to licensing and notarization on macOS and antivirus/SMB policies on Windows. Prefer native Node modules where licensing is compatible.
All methods are asynchronous and will reject with an Error on failure.
## Electron integration
## TypeScript contract
Recommended pattern: implement audio logic in a compiled Node module or in the main process, then expose a small, secure API to the renderer using a preload script and Electron's `contextBridge`.
```ts
# audio-controller

Small, cross-platform TypeScript library to read and change the system default speaker (output) and microphone (input) volume and mute state.

This project exposes a stable, promise-based API for speakers and microphones on Windows, macOS and Linux. Platform implementations differ under the hood, but the public API is identical and normalized:

- audio.speaker.get(): Promise<number> // integer 0..100
- audio.speaker.set(percent: number): Promise<void>
- audio.speaker.mute(): Promise<void>
- audio.speaker.unmute(): Promise<void>
- audio.speaker.isMuted(): Promise<boolean>

- audio.mic.* same shape as speaker

All methods return Promises and will reject with a descriptive Error on failure.

## Quick reference (TypeScript)

```ts
export interface DeviceControl {
  get(): Promise<number>;
  set(volume: number): Promise<void>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): Promise<boolean>;
}

export interface AudioController {
  speaker: DeviceControl;
  mic: DeviceControl;
}

declare const audio: AudioController;
export default audio;
```

Usage example (ESM):

```ts
import audio from 'audio-controller';

const v = await audio.speaker.get(); // 0..100
await audio.speaker.set(50);
await audio.mic.mute();
```

## Contract & behavior

- All volumes are presented to callers as integers 0..100. Implementations clamp out-of-range values.
- `get()` returns an integer 0..100. Implementations convert other native scales (e.g. 0..1) to 0..100.
- `set()` accepts numeric input; implementations round and clamp to 0..100.
- `isMuted()` returns boolean reflecting OS mute state.
- Methods are asynchronous and non-blocking.

## Platform notes

The repository includes per-platform adapters. The API surface is consistent across platforms; differences are in implementation details and runtime requirements.

- Windows: native N-API addon (WASAPI) provides speaker/mic control. The TypeScript wrapper accepts injection for tests.
- macOS: speaker control uses `osascript` (AppleScript); mic control relies on an optional native CoreAudio addon (`native/macos`) if built.
- Linux: prefers `pactl` (PulseAudio / PipeWire). Falls back to `amixer` (ALSA) when available.

### Linux backends

- At load time the adapter autodetects `pactl` or `amixer`.
- Exported symbol: `backendName` (either `'pactl' | 'amixer' | 'none'`).
- For tests you can override detection by setting `globalThis.__LINUX_AUDIO_BACKEND = 'pactl'|'amixer'|'none'` before importing `src/platforms/linux`.

### macOS native addon (microphone)

The repository contains a prototype native addon under `native/macos`. To build on macOS:

```bash
cd native/macos
node-gyp rebuild
```

When built the mac adapter will use the native addon for mic get/set/mute/unmute/isMuted.

## Test injection & mocking

Unit tests should not change system audio. The adapters support test injection so unit tests can run safely:

- Windows: set `globalThis.__WIN_AUDIO_NATIVE = { ... }` before importing `src/platforms/windows`.
- macOS: set `globalThis.__MAC_AUDIO_NATIVE = { ... }` before importing `src/platforms/macos`.
- Linux: set `globalThis.__LINUX_AUDIO_BACKEND = 'pactl'|'amixer'|'none'` before importing `src/platforms/linux` to control backend selection. You can also mock `child_process.exec` in tests to simulate backend outputs.

Example (Windows-style injection):

```ts
globalThis.__WIN_AUDIO_NATIVE = {
  getSpeakerVolume: () => 0.42, // or 42 — wrapper accepts both
  setSpeakerVolume: (v: number) => { /* record */ },
  muteSpeaker: () => {},
  unmuteSpeaker: () => {},
  isSpeakerMuted: () => false,
  // same shape for mic
};

const win = await import('../src/platforms/windows');
await win.speaker.get();
```

## Scripts & local development

- `yarn build` — runs `scripts/prebuild.cjs` and `tsc`.
- `yarn unit` — runs unit tests (Vitest) once.
- `yarn gyp-rebuild` — helper to rebuild native addons via node-gyp.

Run tests:

```pwsh
Set-Location -LiteralPath 'C:\Projects\audio-controller'
yarn unit
```

## CI

This repo includes a GitHub Actions workflow that runs unit tests on Windows and Ubuntu and a Linux integration job that attempts to install `pactl` (`pulseaudio-utils`/`pipewire-utils`) and asserts a backend is available.

Notes:
- The integration job installs `pulseaudio-utils` / `pipewire-utils` on the Ubuntu runner. If you prefer a different package or distro, adjust the workflow accordingly.
- Native builds (macOS or Windows) should be tested on runners with the appropriate toolchains; consider adding separate jobs that run `node-gyp rebuild` when you want to validate native compilation.

## Electron integration

Best practice: keep this code in the main process or a trusted preload and expose a minimal, typed API to the renderer via `contextBridge`. If you ship native modules, document `electron-rebuild` steps or provide prebuilds for Electron ABIs.

## Troubleshooting

- If a backend is missing on Linux, the adapter throws a clear Error: "No supported audio backend found. Install pactl (pulseaudio-utils) or amixer (alsa-utils)."
- macOS mic control requires the native addon; if not built the mac mic methods will throw an informative Error explaining how to build it.

## Contribution & next steps

- Add more unit tests for error paths and edge cases (no default device, malformed output, permission denied).
- Add CI jobs to run native builds on platform-specific runners (Windows/macOS) to detect build regressions early.
- Consider publishing prebuilds for native addons to ease installation in Electron apps.

If you'd like, I can also add a short `CONTRIBUTING.md` and a small Electron sample showing the preload wiring.

## Interactive example (wait & restore)

The example below shows a short script that demonstrates speaker/mic control in a visible way:
- It reads the current values first.
- It performs actions with a minimum 3 second pause after each action so you can notice the change.
- At the end it restores the original values and mute state it read at the start.

Note: run this on a real machine (not in unit tests) and ensure you have the required permissions and backends for your OS.

```ts
import audio from 'audio-controller';

function wait(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

async function demo() {
  // Read initial state
  const initialSpeaker = await audio.speaker.get();
  const initialSpeakerMuted = await audio.speaker.isMuted();
  const initialMic = await audio.mic.get();
  const initialMicMuted = await audio.mic.isMuted();

  console.log('Initial speaker:', initialSpeaker, 'muted?', initialSpeakerMuted);
  console.log('Initial mic:', initialMic, 'muted?', initialMicMuted);

  try {
    // Set speaker to 75 and wait 3s for visibility
    await audio.speaker.set(75);
    console.log('Speaker set to 75 — waiting 3s');
    await wait(3000);

    // Mute speaker and wait 3s
    await audio.speaker.mute();
    console.log('Speaker muted — waiting 3s');
    await wait(3000);

    // Unmute and restore a different value (30) then wait
    await audio.speaker.unmute();
    await audio.speaker.set(30);
    console.log('Speaker unmuted and set to 30 — waiting 3s');
    await wait(3000);

    // Mic: increase then mute
    await audio.mic.set(Math.min(100, initialMic + 10));
    console.log('Mic increased slightly — waiting 3s');
    await wait(3000);

    await audio.mic.mute();
    console.log('Mic muted — waiting 3s');
    await wait(3000);

  } finally {
    // Restore original values
    if (initialSpeakerMuted) await audio.speaker.mute(); else await audio.speaker.unmute();
    await audio.speaker.set(initialSpeaker);

    if (initialMicMuted) await audio.mic.mute(); else await audio.mic.unmute();
    await audio.mic.set(initialMic);

    console.log('Restored original speaker/mic values.');
  }
}

demo().catch(err => console.error('Demo failed:', err));
```
