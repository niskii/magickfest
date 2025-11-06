import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { AudioStreamPlayer } from "../audio/audio-stream-player";


export function Player() {
  const [audioStreamPlayer, setAudioStreamPlayer] = useState<AudioStreamPlayer>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [stateInterval, setStateInterval] = useState<NodeJS.Timeout>(null)
  const [playState, setPlayState] = useState([0, 0])
  let socket: Socket;
  
  async function connect() {
    if (!isConnected) {
      console.log("Joining audio!");

      socket.connect()
      socket.on("newSet", () => {
        if (isConnected) {
          console.log("hallo!");
          audioStreamPlayer.reset();
          audioStreamPlayer.start();
        }
      });
  
      const player = new AudioStreamPlayer(socket, 10, "OPUS")
      player.reset();
      player.start();
      setAudioStreamPlayer(player);

      setStateInterval(setInterval(() => {
        setPlayState([player.getCurrentPlayPosition(), player.getTotalDuration()])
      }, 1000))
  
      setIsConnected(true);
    }
  }
  
  async function disconnect() {
    if (isConnected) {
      clearInterval(stateInterval);
      setStateInterval(null)

      audioStreamPlayer.close();
      setAudioStreamPlayer(null);
      
      socket.disconnect();
      
      setIsConnected(false)
    }
  }

  useEffect(function mount() {
    socket = io(":8080", {autoConnect: false})
  });

  return (
    <div>
      Playing
      <button onClick={connect}>connect</button>
      <button onClick={disconnect}>disconnect</button>
      <div>
        Playing: {playState[0]} / {playState[1]}
      </div>
    </div>
  );
}
