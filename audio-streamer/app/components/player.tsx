import { useEffect, useState } from "react";
import { socket } from "../socket";
import { AudioStreamPlayer } from "../audio/audio-stream-player";
import { SetInfoFetcher } from "../set-info-fetcher";


export function Player() {
  const [audioStreamPlayer, setAudioStreamPlayer] =
    useState<AudioStreamPlayer>(null);
    const [stateInterval, setStateInterval] = useState<NodeJS.Timeout>(null);
    const [playState, setPlayState] = useState([0, 0]);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [coverImage, setCoverImage] = useState(null)
    
    const setInformation = new SetInfoFetcher(socket)

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
        setInformation.fetchInformation().then((info) => {
          setCoverImage(URL.createObjectURL(info.cover))
        })
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

  async function getInfo() {
    setInformation.fetchInformation().then((info) => {
      console.log(info)
      setCoverImage(URL.createObjectURL(info.cover))
    })
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
      <button onClick={getInfo}>work</button>
      <div>
        Playing: {playState[0]} / {playState[1]}
      </div>

      <img src={coverImage} width={"300px"}></img>
    </div>
  );
}
