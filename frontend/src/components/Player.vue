<script setup lang="ts">
    import { shallowRef, ref, onMounted, onUnmounted, watch } from "vue";
    import { socket } from "../../../audio-streamer/app/socket/socket";
    import { AudioStreamPlayer } from "../../../audio-streamer/app/audio/audio-stream-player";
    import { SetInfoFetcher } from "../../../audio-streamer/app/socket/set-info-fetcher";
    import config from "../../../audio-streamer/config/client.json";

    const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
    const stateInterval = ref<NodeJS.Timeout>(null);
    const playState = ref<[number, number, number]>([0, 0, 0]);
    const isConnected = ref(socket.connected);
    const coverImage = ref(null);
    const setInformation = new SetInfoFetcher(socket);
    const bitrate = ref(128);

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

    watch(bitrate, () => {
        if (audioStreamPlayer.value !== null) {
            audioStreamPlayer.value.setBitrate(Number(bitrate.value));
        }
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

            const player = new AudioStreamPlayer(socket, bitrate.value);
            player.reset();
            player.start();
            audioStreamPlayer.value = player;

            stateInterval.value = setInterval(() => {
                playState.value = [
                    player.getCurrentPlayPosition(),
                    player.getTotalDuration(),
                    player.getDownloadedAudioTime(),
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

    // redundant because react sucks and vue is better (v-model)

    // const changeHandler = (event: Event & { target: HTMLInputElement }) => {
    //     if (event.target.type === "radio") {
    //         bitrate.value = Number(event.target.value);
    //     }
    // };

    const timeConverter = (time: number) => {
        time = Math.round(time);
        return Math.round(time / 60 / 60).toString().padStart(2, "0") + ':' + (Math.floor(time / 60) % 60).toString().padStart(2, "0") + ':' + (Math.floor(time) % 60).toString().padStart(2, "0");
    }

    const switchQuality = (e: Event) => {
        const el = e.target as HTMLDivElement;
        bitrate.value = parseInt(el.innerHTML.replace('kbps', ''));
    }
</script>

<template>
    <div id="main">
        <img :src="coverImage" alt="cover artwork for set"> <!-- borken here -->
        <div>
            <h1>{{ setInformation.setInfo.title }}</h1>
            <h2>by {{ setInformation.setInfo.author }}</h2>
            <h3 style="color: white;">temp shit</h3>
            <button @click="connect">connect</button>
            <button @click="disconnect">disconnect</button>
            <button @click="fetchInfo">work</button>
        </div>
    </div>
    <div id="bottomBar">
        <div style="width: 20%" class="fullOnly">
            <img src="../assets/volume_icon.png" alt="volume icon"
                style="height: 5vh; width: 4.5vh; filter: invert() opacity(0.8);">
            <div id="volumeSlider">
                <div id="draggable" style="left: 75%"></div>
            </div>
        </div>
        <div style="width: 60%; flex-direction: column;" class="alwaysVisible">
            {{ timeConverter(playState[0]) }} / {{ timeConverter(playState[1]) }}
            <div id="progressbar">
                <div id="buffered" :style="{ width: (((playState[0] + playState[2]) / playState[1]) * 100) + '%'}"></div>
                <div id="filled" :style="{ width: (playState[0] / playState[1] * 100) + '%'}"></div>
            </div>
        </div>
        <div style="width: 20%; font-size: 1.65vmax;" class="fullOnly">
            quality:
            <div id="dropdownBtn">
                <text id="dropdownBtnText">{{ bitrate }}kbps &nbsp;▴</text>
                <div id="dropdown">
                    <div :class="(bitrate == 64 ? 'dropdownSelected' : null)" @click="switchQuality">64kbps</div>
                    <div :class="(bitrate == 96 ? 'dropdownSelected' : null)" @click="switchQuality">96kbps</div>
                    <div :class="(bitrate == 128 ? 'dropdownSelected' : null)" @click="switchQuality">128kbps</div>
                </div>
            </div>
        </div>
    </div>
</template>
