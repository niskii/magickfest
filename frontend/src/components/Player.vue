<script setup lang="ts">
    import { shallowRef, ref, onMounted, onBeforeUnmount } from "vue";
    import { io, Socket } from "socket.io-client";
    import { AudioStreamPlayer } from "../../../audio-streamer/app/audio/audio-stream-player";

    const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
    const isConnected = ref(false);
    const playState = ref<[number, number]>([0, 0]);
    const stateInterval = ref<NodeJS.Timeout>(null);
    let socket: Socket;

    async function connect() {
        if (!isConnected.value) {
            console.log("Joining audio!");

            const player = new AudioStreamPlayer(socket, 10, "OPUS");
            player.reset();
            player.start();
            audioStreamPlayer.value = player;

            socket.connect();

            socket.on("newSet", () => {
                console.log("hallo!");
                player.reset();
                player.start();
            });

            stateInterval.value = setInterval(() => {
                playState.value = [player.getCurrentPlayPosition(), player.getTotalDuration()];
            }, 1000);

            isConnected.value = true;
        }
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

    onMounted(() => {
        socket = io(":8080", { autoConnect: false });
    });

    onBeforeUnmount(() => {
        disconnect();
    });
</script>

<template>
    <div>
        <p>Playing</p>
        <button @click="connect">connect</button>
        <button @click="disconnect">disconnect</button>
        <div>
            Playing: {{ playState[0] }} / {{ playState[1] }}
        </div>
    </div>
</template>
