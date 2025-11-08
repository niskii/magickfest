import { useEffect, useState } from "react";
import { socket } from "../socket/socket";
import { AudioStreamPlayer } from "../audio/audio-stream-player";
import { SetInfoFetcher } from "../socket/set-info-fetcher";
import config from "../../config/client.json";

export function Player() {
  const [audioStreamPlayer, setAudioStreamPlayer] =
    useState<AudioStreamPlayer>(null);
  const [stateInterval, setStateInterval] = useState<NodeJS.Timeout>(null);
  const [playState, setPlayState] = useState([0, 0]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [coverImage, setCoverImage] = useState(null);

  const setInformation = new SetInfoFetcher(socket);

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
      if (isConnected) {
        audioStreamPlayer.reset();
        audioStreamPlayer.start();
        fetchInfo();
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

      fetchInfo();

      const player = new AudioStreamPlayer(socket, "OPUS");
      player.reset();
      player.start();
      setAudioStreamPlayer(player);

      setStateInterval(
        setInterval(() => {
          setPlayState([
            player.getCurrentPlayPosition(),
            player.getTotalDuration(),
          ]);
        }, config.UpdateInterval),
      );

      setIsConnected(true);
    }
  }

  function fetchInfo() {
    setInformation.fetchInformation().then((info) => {
      setCoverImage(info.coverURL);
    });
  }

  async function disconnect() {
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
      <button onClick={fetchInfo}>work</button>
      <div>
        Playing: {playState[0].toFixed(2)} / {playState[1].toFixed(2)}
      </div>
      <img src={coverImage} width={"300px"}></img>
    </div>
  );
}
