export interface MediaReader {
    getChunkAtTime: (start: number, numberOfPages: number) => {};
    getNextChunk: (
        pageNumber: number,
        numberOfPages: number,
        timeOverride: number,
    ) => {};
    getTotalDuration: () => number;
}
