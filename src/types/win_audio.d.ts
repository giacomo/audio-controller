declare module 'win_audio' {
  export function getSpeakerVolume(): number;
  export function setSpeakerVolume(v: number): void;
  export function muteSpeaker(): void;
  export function unmuteSpeaker(): void;
  export function isSpeakerMuted(): boolean;

  export function getMicVolume(): number;
  export function setMicVolume(v: number): void;
  export function muteMic(): void;
  export function unmuteMic(): void;
  export function isMicMuted(): boolean;
}

// Also allow requiring the built .node directly
declare module '*win_audio.node' {
  const anyExport: any;
  export = anyExport;
}
