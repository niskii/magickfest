import { type SocketSetInfo } from "@shared/types/set";
import EventEmitter from "node:events";
import { Socket } from "socket.io-client";
import socketStream from "socket.io-stream";
import { Duplex } from "stream";
import logger from "../../logger";

export type SetInfo = {
    coverURL?: string;
    coverBlob?: Blob;
    title?: string;
    author?: string;
};

export class SetInfoFetcher {
    #socket: Socket;
    #events: EventEmitter;
    setInfo: SetInfo;

    constructor(socket: Socket) {
        this.#socket = socket;
        this.#events = new EventEmitter();
        this.setInfo = {};

        socketStream(this.#socket).on(
            "setInformationStream",
            (stream: Duplex, info: SocketSetInfo) => {

                const fileBuffer: Array<Uint8Array> = [];
                let bufferLength = 0;

                this.setInfo.title = info.Title;
                this.setInfo.author = info.Author;

                stream.on("data", (data) => {
                    logger.info("data!")
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
                    this.setInfo.coverURL = URL.createObjectURL(
                        this.setInfo.coverBlob,
                    );

                    this.#events.emit("done")
                });

                stream.on("error", (err) => {
                    logger.error(err)
                });
            },
        );

        this.#socket.on("setInformation", (info: SocketSetInfo) => {
            this.setInfo.title = info.Title;
            this.setInfo.author = info.Author;
            this.setInfo.coverURL = null;
            this.setInfo.coverBlob = null;

            this.#events.emit("done")
        });
    }

    fetchInformation() {
        this.#socket.emit("fetchSetInformation");

        return new Promise<SetInfo>((resolve, reject) => {
            this.#events.once("done", () => {
                console.log("done!")
                resolve(this.setInfo)
            })
        })
    };
}
