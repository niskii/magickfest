import { HeaderObject, Page } from "./metadata";

export interface OpusSplitter {
    audioPageBoundaries: Array<Number> | null;
    pages: Array<Page>;
    header: HeaderObject;
    preskip: number;
    sliceByPage: (begin: number, end: number) => Uint8Array<ArrayBuffer> | null;
}
