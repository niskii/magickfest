import { useEffect, useState } from "react";
import { socket } from "../socket";
import { AudioStreamPlayer } from "../audio/audio-stream-player";

export function Player() {
  const [audioStreamPlayer, setAudioStreamPlayer] =
    useState<AudioStreamPlayer>(null);
  const [stateInterval, setStateInterval] = useState<NodeJS.Timeout>(null);
  const [playState, setPlayState] = useState([0, 0]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    function newSetEvent() {
      console.log("hallo!", isConnected);
      if (isConnected) {
        audioStreamPlayer.reset();
        audioStreamPlayer.start();
      }
    }

    socket.on("newSet", newSetEvent);

    return () => {
      socket.off("newSet", newSetEvent);
    };
  }, [isConnected]);

  async function connect() {
    if (!isConnected) {
      console.log("Joining audio!");
      socket.connect();

      const player = new AudioStreamPlayer(socket, 10, "OPUS");
      player.reset();
      player.start();
      setAudioStreamPlayer(player);

      setStateInterval(
        setInterval(() => {
          setPlayState([
            player.getCurrentPlayPosition(),
            player.getTotalDuration(),
          ]);
        }, 1000),
      );

      setIsConnected(true);
    }
  }

  async function disconnect() {
    console.log(isConnected);
    if (isConnected) {
      clearInterval(stateInterval);
      setStateInterval(null);

      audioStreamPlayer.close();
      setAudioStreamPlayer(null);

      socket.removeAllListeners();
      socket.disconnect();

      setIsConnected(false);
    }
  }

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
