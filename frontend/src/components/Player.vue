<script setup lang="ts">
import { Bitrate } from '@shared/types/audio-transfer';
import { onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import config from "../config/client.json";
import { AudioStreamPlayer } from "../scripts/audio/audio-stream-player";
import { SetInfoFetcher } from "../scripts/socket/set-info-fetcher";
import { socket } from "../scripts/socket/socket";
import ListDropdown from './ListDropdown.vue';

import Visualiser from "./Visualiser.vue";
type visualiserType = InstanceType<typeof Visualiser>;

const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
const stateInterval = ref<NodeJS.Timeout>(null);
const playState = ref<[number, number, number]>([0, 0, 0]);
const isConnected = ref(socket.connected);
const coverImage = ref(null);
const setInformation = new SetInfoFetcher(socket);
const bitrate = ref(Bitrate.High);
const overlayToggle = ref<boolean>(true);
const volume = ref<number>(75);
const muted = ref<boolean>(false);
const visualiserRef = useTemplateRef<visualiserType>("visualiser");
const visualiserOn = ref<boolean>(true);
const bitratesShown = ref<boolean>(false);
const settingsShown = ref<boolean>(false);

const visualizerFFTSize = ref<number>(12);
const visualizerFPSLimit = ref<number>(60);
const visualizerColor = ref<String>("#bb7755");
const visualizerWidth = ref<number>(1);

const isEmbedded = ref<boolean>(true);
const authToggle = ref<boolean>(false);

onMounted(() => {
    function onConnect() {
        isConnected.value = true;

        fetchInfo();

        const player = new AudioStreamPlayer(
            socket,
            bitrate.value,
            volume.value / 100,
        );

        player.reset();
        player.start();
        audioStreamPlayer.value = player;

        clearInterval(stateInterval.value)
        stateInterval.value = setInterval(() => {
            playState.value = [
                player.getCurrentPlayPosition(),
                player.getTotalDuration(),
                player.getDownloadedAudioTime(),
            ];
        }, config.UpdateInterval);

        visualiserRef.value.setAnalyser(player.getAnalyzer())
        visualiserRef.value.resume()

        isConnected.value = true;
    }

    function onDisconnect() {
        isConnected.value = false;
    }

    function onConnectError(err: Error) {
        socket.disconnect();
        isConnected.value = false
        switch (err.message) {
            case 'unauthorized': {
                // TODO: Show a modal about logging in.
                authToggle.value = true;
                break;
            }
            case 'already_connected': {
                // TODO: Show a modal for this.
                console.log("You are connected already!")
                break;
            }
            default: {
                setTimeout(() => {
                    connect();
                }, 10000)
            }
        }
    }

    isEmbedded.value = window.self !== window.top;

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError)
    socket.on("disconnect", onDisconnect);

    onUnmounted(() => {
        socket.off("connect", onConnect);
        socket.off("connect_error", onConnectError);
        socket.off("disconnect", onDisconnect);
        disconnect();
    });
});

watch(bitrate, () => {
    if (audioStreamPlayer.value !== null) {
        audioStreamPlayer.value.setBitrate(Number(bitrate.value));
    }
});

watch([volume, muted], () => {
    if (audioStreamPlayer.value !== null) {
        audioStreamPlayer.value.setVolume(
            muted.value ? 0.0 : Number(volume.value / 100),
        );
    }
});

watch(isConnected, () => {
    function newSetEvent() {
        if (isConnected.value) {
            fetchInfo();
        }
    }

    function changedStateEvent() {
        if (isConnected.value) {
            audioStreamPlayer.value.reset();
            audioStreamPlayer.value.start();
            visualiserRef.value.setAnalyser(audioStreamPlayer.value.getAnalyzer())
        }
    }

    socket.on("newSet", newSetEvent);
    socket.on("changedState", changedStateEvent);

    return () => {
        socket.off("newSet", newSetEvent);
        socket.off("changedState", changedStateEvent);
    };
});

async function connect() {
    if (!isConnected.value) {
        console.log("Joining audio!");
        socket.connect();
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

const timeConverter = (time: number) => {
    time = Math.round(time);
    return (
        Math.floor(time / 60 / 60)
            .toString()
            .padStart(2, "0") +
        ":" +
        (Math.floor(time / 60) % 60).toString().padStart(2, "0") +
        ":" +
        (Math.floor(time) % 60).toString().padStart(2, "0")
    );
};

const switchQuality = (e: Event) => {
    const el = e.target as HTMLDivElement;
    bitrate.value = parseInt(el.innerHTML.replace("kbps", ""));
};

function overlayClick() {
    connect();
    overlayToggle.value = false;
}
</script>

<template>
    <div id="main">
        <div class="overlay" v-show="overlayToggle">
            <h1>connect/reconnect to stream</h1>
            <button @click="overlayClick">connect</button>
        </div>
        <div class="overlay" v-show="authToggle">
            <h1>couldn't find existing session - authenticate through discord</h1>
            <a href="https://localhost:8080/api/auth/login">authenticate here</a>
        </div>
        <div class="overlay" v-show="settingsShown">
            <h1>settings</h1>
            <h2>visualizer FFT size: </h2><input type="number" v-model="visualizerFFTSize">
            <h2>visualizer FPS limit: </h2><input type="number" v-model="visualizerFPSLimit">
            <h2>visualizer color: </h2><input type="color" v-model="visualizerColor">
            <h2>visualizer line width: </h2><input type="number" v-model="visualizerWidth">
            <br>
            <button @click="() => { settingsShown = false }">close</button>
        </div>
        <img :src="coverImage ? coverImage : '/src/assets/nostream.png'" alt="cover artwork for set" />
        <div>
            <h1>
                {{
                    setInformation.setInfo.title
                        ? setInformation.setInfo.title
                        : "no set avilable"
                }}
            </h1>
            <h2>
                {{
                    setInformation.setInfo.author
                        ? "by " + setInformation.setInfo.author
                        : null
                }}
            </h2>
            <Visualiser v-show="visualiserOn" ref="visualiser" class="visualiser" :fftSize="visualizerFFTSize"
                :fpsLimit="visualizerFPSLimit" :lineWidth="visualizerWidth" :lineColor="visualizerColor"
                backgroundColor="#0c0c11">
            </Visualiser>
        </div>
    </div>
    <div id="bottomBar">
        <select class="mobileOnly" v-model="bitrate">
            <option value="128">128kbps</option>
            <option value="96">96kbps</option>
            <option value="64">64kbps</option>
        </select>
        <div style="width: 20%" class="fullOnly">
            <img :src="'/src/assets/volume_icon' + (muted ? '_muted' : '') + '.png'" alt="volume icon"
                style="height: 5vh; cursor: pointer" @click="
                    () => {
                        muted = !muted;
                    }
                " />
            <div id="volumeSlider">
                <input v-model="volume" type="range" min="0" max="100" />
                <div :style="{ width: volume + '%' }"></div>
            </div>
        </div>
        <div style="width: 60%; flex-direction: column" class="alwaysVisible">
            {{ timeConverter(playState[0]) }} / {{ timeConverter(playState[1]) }}
            <div id="progressbar">
                <div id="buffered" :style="{
                    width: ((playState[0] + playState[2]) / playState[1]) * 100 + '%',
                }"></div>
                <div id="filled" :style="{ width: (playState[0] / playState[1]) * 100 + '%' }"></div>
            </div>
        </div>
        <div style="width: 20%; font-size: 1.6vmax" class="fullOnly">
            <img :src="'/src/assets/visualizer_icon' + (visualiserOn ? '' : '_disabled') + '.png'" alt="visualizer icon"
                style="height: 6vh; cursor: pointer" @click="
                    () => {
                        visualiserOn = !visualiserOn;
                    }
                " />
            <div style="margin-left: 2vw; cursor: pointer; position: relative;">
                <img :src="'/src/assets/quality_' + bitrate + '.png'" :alt="'quality: ' + bitrate + 'kbps'"
                    style="height: 6vh; " @click="() => { bitratesShown = !bitratesShown }">
                <img src="/src/assets/dropdown_arrow.png" alt=""
                    :style="{ height: '2vh', marginBottom: '1.5vh', marginLeft: '0.25vw', transform: (bitratesShown) ? 'rotate(180deg)' : '' }"
                    @click="() => { bitratesShown = !bitratesShown }" />
                <ListDropdown :elements="['128kbps', '96kbps', '64kbps']"
                    :funcs="[switchQuality, switchQuality, switchQuality]"
                    :disabled-indices="['128kbps', '96kbps', '64kbps'].filter(e => e == bitrate.toString() + 'kbps')"
                    :visible="bitratesShown">
                </ListDropdown>
            </div>

            <img src="/src/assets/settings_icon.png" alt="settings"
                style="margin-left: 2vw; height: 6vh; cursor: pointer"
                @click="() => { settingsShown = !settingsShown }">
        </div>
    </div>
</template>
