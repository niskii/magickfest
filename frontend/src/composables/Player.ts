import { shallowRef, ref, onMounted, onUnmounted, watch } from "vue";
import { socket } from "../../../audio-streamer/app/socket/socket";
import { AudioStreamPlayer } from "../../../audio-streamer/app/audio/audio-stream-player";
import { SetInfoFetcher } from "../../../audio-streamer/app/socket/set-info-fetcher";
import config from "../../../audio-streamer/config/client.json";

export function usePlayer() {
    const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
    const stateInterval = ref<NodeJS.Timeout>(null);
    const playState = ref<[number, number]>([0, 0]);
    const isConnected = ref(socket.connected);
    const coverImage = ref(null);
    const setInformation = new SetInfoFetcher(socket);

    onMounted(() => {
        function onConnect() {
            isConnected.value = true;
        }

        function onDisconnect() {
            isConnected.value = false;
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        onUnmounted(() => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            disconnect();
        });
    })

    watch(isConnected, () => {
        function newSetEvent() {
            if (isConnected.value) {
                audioStreamPlayer.value.reset();
                audioStreamPlayer.value.start();
                fetchInfo();
            }
        }

        socket.on("newSet", newSetEvent);

        return () => {
            socket.off("newSet", newSetEvent);
        };
    })

    async function connect() {
        if (!isConnected.value) {
            console.log("Joining audio!");
            socket.connect();

            fetchInfo();

            const player = new AudioStreamPlayer(socket, "OPUS");
            player.reset();
            player.start();
            audioStreamPlayer.value = player;

            stateInterval.value = setInterval(() => {
                playState.value = [
                    player.getCurrentPlayPosition(),
                    player.getTotalDuration(),
                ];
            }, config.UpdateInterval);

            isConnected.value = true;
        }
    }

    function fetchInfo() {
        setInformation.fetchInformation().then((info) => {
            coverImage.value = info.coverURL;
        });
    }

    async function disconnect() {
        if (isConnected.value) {
            clearInterval(stateInterval.value);
            stateInterval.value = null;

            audioStreamPlayer.value.close();
            audioStreamPlayer.value = null;

            socket.removeAllListeners();
            socket.disconnect();

            isConnected.value = false;
        }
    }

    return { disconnect, connect, fetchInfo, playState, isConnected, coverImage, setInformation }
}