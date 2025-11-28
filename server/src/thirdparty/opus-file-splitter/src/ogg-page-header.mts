export class OggPageHeader {
  /**
   * View of the byte buffer.
   */
  #view;

  /**
   * Offset pointing to where the page starts in the buffer.
   */
  offset;

  /**
   * Is Ogg id page.
   */
  isIdPage;

  /**
   * Is Ogg comment page.
   */
  isCommentPage;

  /**
   * Is Ogg audio page.
   */
  isAudioPage;

  /**
   * Number of segments in the page.
   */
  pageSegments;

  /**
   * Size in bytes of Ogg the header.
   */
  headerSize;

  /**
   * Size in bytes of thte full page.
   */
  pageSize;

  /**
   * Ogg version. Always 1.
   */
  version;

  /**
   * Is the page a starting continuing or ending of a given type. I.e. comment pages.
   */
  type;

  /**
   * Ogg serial number.
   */
  serial;

  /**
   * Checksum of the page.
   */
  checksum;

  constructor(view: DataView, offset: number) {
    this.#view = view;
    this.offset = offset;
    this.isIdPage = false;
    this.isCommentPage = false;
    this.isAudioPage = false;
    this.pageSegments = view.getUint8(offset + 26);
    this.headerSize = 27 + this.pageSegments;

    // add sum of lacing values to get total page size
    this.pageSize = 0;
    const lacingValues = [];
    for (let i = 0; i < this.pageSegments; i++) {
      this.pageSize += view.getUint8(offset + 27 + i);
    }

    this.version = view.getUint8(offset + 4);
    this.type = {
      continuedPage: view.getUint8(offset + 5) & (1 << 0),
      firstPage: view.getUint8(offset + 5) & (1 << 1),
      lastPage: view.getUint8(offset + 5) & (1 << 2),
    };
    this.serial = view.getUint32(offset + 14, true).toString(16);
    this.checksum = view.getUint32(offset + 22, true).toString(16);
  }

  get preskip() {
    console.log(this.#view.getUint32(this.offset + 2, true).toString(16));
    return this.#view.getUint16(this.offset + 4, true);
  }

  get granulePosition() {
    return this.#view.getBigInt64(this.offset + 6, true);
  }
  set granulePosition(value) {
    this.#view.setBigInt64(this.offset + 6, value, true);
  }

  get pageSequence() {
    return this.#view.getInt32(this.offset + 18, true);
  }
  set pageSequence(value) {
    this.#view.setInt32(this.offset + 18, value, true);
  }

  get isFirstPage() {
    return this.type.firstPage != 0;
  }

  set isFirstPage(truthy) {
    // set first bit
    let bit = this.#view.getUint8(this.offset + 5);
    if (truthy) bit |= 1 << 1;
    else bit &= ~(1 << 1);
    this.#view.setUint8(this.offset + 5, bit);
    this.type.firstPage = this.#view.getUint8(this.offset + 5) & (1 << 1);
  }

  get isContinuedPage() {
    return this.type.continuedPage != 0;
  }

  get isLastPage() {
    return this.type.lastPage != 0;
  }

  set isLastPage(truthy) {
    // set third bit
    let bit = this.#view.getUint8(this.offset + 5);
    if (truthy) bit |= 1 << 2;
    else bit &= ~(1 << 2);
    this.#view.setUint8(this.offset + 5, bit);
    this.type.lastPage = this.#view.getUint8(this.offset + 5) & (1 << 2);
  }
}
