import { Socket } from "socket.io-client";
import { Duplex } from "stream";
import socketStream from "socket.io-stream";
import { type SocketSetInfo } from "@shared/types/set";

export type SetInfo = {
  coverURL?: string;
  coverBlob?: Blob;
  title?: string;
  author?: string;
};

export class SetInfoFetcher {
  #socket: Socket;
  setInfo: SetInfo;

  constructor(socket: Socket) {
    this.#socket = socket;
    this.setInfo = {};
  }

  async fetchInformation() {
    return new Promise<SetInfo>((resolve, reject) => {
      this.#socket.emit("fetchSetInformation");

      const fileBuffer: Array<Uint8Array> = [];
      let bufferLength = 0;

      socketStream(this.#socket).once(
        "setInformation",
        (stream: Duplex, info: SocketSetInfo) => {
          this.setInfo.title = info.Title;
          this.setInfo.author = info.Author;

          stream.on("data", (data) => {
            fileBuffer.push(data);
            bufferLength += data.length;
          });

          stream.on("end", () => {
            const filedata = new Uint8Array(bufferLength);
            let i = 0;

            fileBuffer.forEach(function (buffer) {
              filedata.set(buffer, i);
              i += buffer.length;
            });

            this.setInfo.coverBlob = new Blob([filedata], {
              type: info.ImageMimeType,
            });
            this.setInfo.coverURL = URL.createObjectURL(this.setInfo.coverBlob);

            resolve(this.setInfo);
          });

          stream.on("error", (err) => {
            reject(err);
          });
        },
      );

      this.#socket.once("setInformation", (info: SocketSetInfo) => {
        this.setInfo.title = info.Title;
        this.setInfo.author = info.Author;
        resolve(this.setInfo);
      });
    }).finally(() => this.#socket.removeListener("setInformation"));
  }
}
