export enum PlaybackState {
    Stopped,
    Running,
    Paused,
}

export type PlayerState = {
    id: string,
    setIndex: number,
    startTime: number,
    initialStartTime: number,
    forwarded: number,
    state: PlaybackState,
}