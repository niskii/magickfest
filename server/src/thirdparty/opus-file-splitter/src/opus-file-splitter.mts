import { OggPageHeader } from "./ogg-page-header.mjs";

export class Page {
  offset: number;
  position: bigint;
  length: number;

  constructor(offset: number, position: bigint, length: number) {
    this.offset = offset;
    this.position = position;
    this.length = length;
  }
}

class OpusTags {
  vendorLength: number;
  vendorString: string;
  commentsLength: number;
  comments: Array<string>;

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
  audioPageSize: number;
  firstAudioPageIndex: number;

  constructor() {
    this.preskipGranule = 0;
    this.channels = 0;
    this.PCMLength = 0n;
    this.audioPageSize = 0;
    this.firstAudioPageIndex = 0;
  }
}

export class OpusFileSplitter {
  #bytes: Uint8Array | null = null;
  #headerBytes: Uint8Array | null = null;
  #pages: Array<Page> = [];
  #audioPageBoundaries: Array<Number> | null = null;
  #preskipSeconds: number = 0;

  #headerObject: HeaderObject = new HeaderObject();

  constructor(buffer: ArrayBufferLike) {
    this.parseFile(buffer);
  }

  get audioPageBoundaries() {
    return this.#audioPageBoundaries;
  }

  get pages() {
    return this.#pages;
  }

  get headerObject() {
    return this.#headerObject;
  }

  get headByteLength() {
    return this.#headerBytes!.length;
  }

  get preSkipSeconds() {
    return this.#preskipSeconds;
  }

  calculateDurationSeconds(granuleStart: bigint, granuleEnd: bigint) {
    return Number(((granuleEnd - granuleStart) * 100n) / 48000n) / 100;
  }

  // scans file and executes callback when a page is found. ({ pageHeader }) =>
  #scanPages(buffer: ArrayBufferLike, cb: (a: OggPageHeader) => void) {
    // Does not work for comments spanning multiple pages.
    function readOpusTags(opustagsOffset: number) {
      let position = opustagsOffset + 8;
      const decoder = new TextDecoder();

      let vendorLength = view.getUint32(position, true);
      position += 4;
      let vendorString = decoder.decode(
        new Uint8Array(view.buffer.slice(position, position + vendorLength)),
      );
      position += vendorLength;
      let commentsLength = view.getUint32(position, true);
      position += 4;

      let totalLength = 0;
      let n = commentsLength;
      let comments = [];

      for (let i = 0; i < n; i++) {
        const length = view.getUint32(position, true);
        position += 4;
        totalLength += length;
        comments.push(
          decoder.decode(
            new Uint8Array(view.buffer.slice(position, position + length)),
          ),
        );
        position += length;
      }

      return new OpusTags(vendorLength, vendorString, commentsLength, comments);
    }

    function printBytes(start: number, length: number) {
      console.log(new Uint8Array(view.buffer.slice(start, start + length)));
    }

    // big-endian Ogg page markers. see https://tools.ietf.org/html/rfc3533#page-10
    const pageMarker = new DataView(
      new TextEncoder().encode("OggS").buffer,
    ).getUint32(0);
    const opusIdHeaderMarker = new DataView(
      new TextEncoder().encode("OpusHead").buffer,
    ).getBigUint64(0);
    const opusCommentHeaderMarker = new DataView(
      new TextEncoder().encode("OpusTags").buffer,
    ).getBigUint64(0);

    const view = new DataView(buffer);
    const scanTo = buffer.byteLength - Uint32Array.BYTES_PER_ELEMENT;

    let idPageFound = false;
    let commentPageFound = false;
    let continuedCommentPages = false;

    let pageNumber = 0;
    let tempGranulePosition = 0n;

    for (let i = 0; i < scanTo; i++) {
      if (pageMarker !== view.getUint32(i)) continue;

      const pageHeader = new OggPageHeader(view, i);

      if (
        continuedCommentPages &&
        commentPageFound &&
        pageHeader.type.continuedPage == 0
      ) {
        continuedCommentPages = false;
      }

      const opusOffset = i + pageHeader.headerSize;
      if (!idPageFound) {
        if (opusIdHeaderMarker === view.getBigUint64(opusOffset)) {
          pageHeader.isIdPage = true;
          idPageFound = true;
          this.#headerObject.preskipGranule = view.getUint16(opusOffset + 10);
          this.#headerObject.channels = view.getUint8(opusOffset + 9);

          if (pageHeader.type.firstPage != 0) {
            continuedCommentPages = true;
          }
        }
      } else if (!commentPageFound) {
        if (opusCommentHeaderMarker === view.getBigUint64(opusOffset)) {
          pageHeader.isCommentPage = true;
          commentPageFound = true;

          this.#headerBytes = new Uint8Array(buffer, 0, pageHeader.offset);
        }
      } else if (continuedCommentPages) {
        pageHeader.isCommentPage = true;
      } else {
        pageHeader.isAudioPage = true;
        if (this.#headerObject.firstAudioPageIndex === 0) {
          this.#headerObject.firstAudioPageIndex = pageNumber;
          tempGranulePosition = pageHeader.granulePosition;
        }
        if (pageNumber === this.#headerObject.firstAudioPageIndex + 1) {
          this.#headerObject.audioPageSize = this.calculateDurationSeconds(
            tempGranulePosition,
            pageHeader.granulePosition,
          );
        }
      }

      // const { isIdPage, isCommentPage, isAudioPage, isFirstPage, isLastPage, pageSequence, granulePosition} = pageHeader;
      // console.log({
      //               id: Number(isIdPage),
      //               comment: Number(isCommentPage),
      //               audio: Number(isAudioPage),
      //               first: Number(isFirstPage),
      //               last: Number(isLastPage),
      //               page: pageSequence, pos: granulePosition
      //             });

      // skip ahead to next page
      if (pageHeader.pageSize) {
        i += pageHeader.pageSize - 1; // offset for i++
      }

      if (pageHeader.isLastPage) {
        this.#headerObject.PCMLength =
          pageHeader.granulePosition + BigInt(pageHeader.pageSize);
      }

      pageNumber++;

      cb.call(null, pageHeader);
    }
  }

  parseFile(buffer: ArrayBufferLike) {
    const pages: Array<Page> = [];
    const audioPages: Array<number> = [];

    this.#scanPages(buffer, onPage);

    if (!audioPages.length) {
      throw Error("Invalid Ogg Opus file.  No audio pages found");
    }

    this.#bytes = new Uint8Array(buffer);

    if (this.#headerBytes == null) {
      this.#headerBytes = new Uint8Array(buffer, 0, audioPages[0]);
    }

    this.#audioPageBoundaries = audioPages;
    this.#pages = pages;
    this.#preskipSeconds = this.calculateDurationSeconds(
      0n,
      BigInt(this.#headerObject.preskipGranule),
    );

    function onPage(pageHeader: OggPageHeader) {
      if (pageHeader.isAudioPage) {
        audioPages.push(pageHeader.offset);
        pages.push(
          new Page(
            pageHeader.offset,
            pageHeader.granulePosition,
            pageHeader.pageSize,
          ),
        );
      }
    }
  }

  // slice Ogg Opus file by audio pages. Mimic prototype of ArrayBuffer.slice(start, end);
  sliceByPage(begin: number, end: number) {
    const boundaries = this.#pages;
    if (
      boundaries === null ||
      this.#bytes === null ||
      this.#headerBytes === null
    )
      return null;

    const bytesStart = boundaries.hasOwnProperty(begin)
      ? boundaries[begin].offset
      : this.#bytes.byteLength;
    const bytesEnd = boundaries.hasOwnProperty(end)
      ? boundaries[end].offset
      : this.#bytes.byteLength;

    // create bytes with header size plus audio pages' size
    const bytes = new Uint8Array(
      bytesEnd - bytesStart + this.#headerBytes.byteLength,
    );

    // add header and audio bytes
    bytes.set(this.#headerBytes, 0);
    bytes.set(
      this.#bytes.slice(bytesStart, bytesEnd),
      this.#headerBytes.byteLength,
    );

    return bytes;
  }

  sliceByPercentage(begin: number, end: number) {}
  sliceByByte(begin: number, end: number) {}
}
