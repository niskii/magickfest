// big-endian Ogg page markers. see https://tools.ietf.org/html/rfc3533#page-10
const pageMarker = new DataView(
    new TextEncoder().encode("OggS").buffer,
).getUint32(0);
const IdHeaderMarker = new DataView(
    new TextEncoder().encode("OpusHead").buffer,
).getBigUint64(0);
const CommentHeaderMarker = new DataView(
    new TextEncoder().encode("OpusTags").buffer,
).getBigUint64(0);

export class Page {
    readonly offset: number;
    readonly position: bigint;
    readonly length: number;

    constructor(offset: number, position: bigint, length: number) {
        this.offset = offset;
        this.position = position;
        this.length = length;
    }
}

export class OpusTags {
    readonly vendorLength: number;
    readonly vendorString: string;
    readonly commentsLength: number;
    readonly comments: Array<string>;

    constructor(
        vendorLength: number,
        vendorString: string,
        commentLengths: number,
        comments: Array<string>,
    ) {
        this.vendorLength = vendorLength;
        this.vendorString = vendorString;
        this.commentsLength = commentLengths;
        this.comments = comments;
    }
}

export class HeaderObject {
    preskipGranule: number;
    channels: number;
    PCMLength: bigint;
    audioPageDuration: number;
    firstAudioPageIndex: number;

    constructor() {
        this.preskipGranule = 0;
        this.channels = 0;
        this.PCMLength = 0n;
        this.audioPageDuration = 0;
        this.firstAudioPageIndex = 0;
    }
}

export function calculateDuration(granuleStart: bigint, granuleEnd: bigint) {
    return Number(((granuleEnd - granuleStart) * 100n) / 48000n) / 100;
}

export function isPageMarker(Uint32: number) {
    return pageMarker === Uint32;
}

export function isIdHeaderMarker(Uint32: bigint) {
    return IdHeaderMarker === Uint32;
}

export function isCommentMarker(Uint32: bigint) {
    return CommentHeaderMarker === Uint32;
}
