import { parseFile } from 'music-metadata';
import express from "express"
import Throttle from 'throttle';
import Fs from 'fs'
import { PassThrough } from 'stream'
const app = express();
let filePath = "./test.mp3"; // put your favorite audio file
let bitRate = 0;
const streams = new Map()
app.use(express.static('public'));


app.get("/stream", (req, res) => {
    const { id, stream } = generateStream() // We create a new stream for each new client
    res.setHeader("Content-Type", "audio/mpeg")
    stream.pipe(res) // the client stream is pipe to the response
    res.on('close', () => { streams.delete(id) })
})


const init = async () => {
    const fileInfo = await parseFile(filePath)
    bitRate = fileInfo.format.bitrate / 8
}

const playFile = (filePath) => {
    const songReadable = Fs.createReadStream(filePath);
    const throttleTransformable = new Throttle(bitRate);
    songReadable.pipe(throttleTransformable);
    throttleTransformable.on('data', (chunk) => { broadcastToEveryStreams(chunk) });
    throttleTransformable.on('error', (e) => console.log(e))

}
const broadcastToEveryStreams = (chunk) => {
    for (let [, stream] of streams) {
        stream.write(chunk) // We write to the client stream the new chunck of data
    }
}

const generateStream = () => {
    const id = Math.random().toString(36).slice(2);
    const stream = new PassThrough()
    streams.set(id, stream)
    return { id, stream }
}

init()
    .then(() => app.listen(3000))
    .then(() => playFile(filePath))
    .then(console.log('app listening on port 3000'))