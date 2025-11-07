import { Socket } from "socket.io-client"
import ss from "socket.io-stream"
import { Duplex } from "stream"

export class SetInfoFetcher {
  #socket: Socket
  cover: Blob
  title: string
  author: string

  constructor(socket: Socket) {
    this.#socket = socket;
  }

  async fetchInformation() {
    return new Promise<any>((resolve, reject) => {
      this.#socket.emit("fetchSetInformation")
  
      let fileBuffer = []
      let bufferLength = 0;
  
      ss(this.#socket).once('setInformation', (stream: Duplex, info) => {
        this.title = info.title
        this.author = info.author
  
        stream.on("data", (data) => {
          fileBuffer.push(data);
          bufferLength += data.length
        })

        stream.on("end", () => {
          let filedata = new Uint8Array(bufferLength), i = 0;
          fileBuffer.forEach(function (buffer) {
            for (var j = 0; j < buffer.length; j++) {
              filedata[i] = buffer[j];
              i++;
            }
          });
          this.cover = new Blob([filedata], {type: info.fileMimeType})
          resolve({title: this.title, author: this.author, cover: this.cover})
        })

        stream.on("error", (err) => {
          reject(err)
        })
      });
    })
  }
}
