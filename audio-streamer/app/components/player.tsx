import { useEffect } from "react";
import { io } from "socket.io-client";
import { AudioStreamPlayer } from "../audio/audio-stream-player";
import ss from "socket.io-stream";

// const decoder = new OpusDecoder();

const socket = io(":8080");
let isConnected = false;

const audioStreamPlayer: AudioStreamPlayer = new AudioStreamPlayer(
  socket,
  1024,
  "OPUS",
);

// ss(socket).on('audio-stream', function(stream, data) {
//     stream.on('data', function(chunk) {
//         ap.addAudio(data.header, chunk);
//     });
//     stream.on('end', function () {
//     });
// });

socket.on("newSet", () => {
  if (isConnected) {
    console.log("hallo!");
    audioStreamPlayer._reset();
    audioStreamPlayer.start();
  }
});

async function playSound() {
  console.log("Joining audio!");

  isConnected = true;

  audioStreamPlayer._reset();
  audioStreamPlayer.start();
}

export function Player() {
  useEffect(function mount() {});

  return (
    <div>
      Playing
      <button onClick={playSound}>El button</button>
    </div>
  );
}
