import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { AudioStreamPlayer } from "../audio/audio-stream-player";

let socket: Socket;
let audioStreamPlayer: AudioStreamPlayer;
let isConnected = false;
let stateInterval: NodeJS.Timeout;

async function connect() {
  if (!isConnected) {
    console.log("Joining audio!");
    socket = io(":8080");

    socket.on("newSet", () => {
      if (isConnected) {
        console.log("hallo!");
        audioStreamPlayer.reset();
        audioStreamPlayer.start();
      }
    });

    audioStreamPlayer = new AudioStreamPlayer(socket, 10, "OPUS");

    audioStreamPlayer.reset();
    audioStreamPlayer.start();
    isConnected = true;
  }
}

async function disconnect() {
  if (isConnected) {
    clearInterval(stateInterval);
    audioStreamPlayer.close();
    audioStreamPlayer = null;
    socket.disconnect();
    isConnected = false;
  }
}

export function Player() {
  useEffect(function mount() {});

  return (
    <div>
      Playing
      <button onClick={connect}>connect</button>
      <button onClick={disconnect}>disconnect</button>
    </div>
  );
}
