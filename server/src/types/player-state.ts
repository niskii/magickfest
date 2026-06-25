export enum PlaybackState {
    Stopped,
    Running,
    Paused,
}

export interface PlayerState {
    id: string,
    setIndex: number,
    startTime: number,
    forwarded: number,
    state: PlaybackState,
}