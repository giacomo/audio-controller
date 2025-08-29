declare module 'mac_audio' {
  export function getMicVolume(): number;
  export function setMicVolume(v: number): void;
  export function muteMic(): void;
  export function unmuteMic(): void;
  export function isMicMuted(): boolean;
}
