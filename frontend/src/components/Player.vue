<script setup lang="ts">
import { Bitrate } from '@shared/types/audio-transfer';
import { computed, onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import config from "../config/client.json";
import { AudioStreamPlayer } from "../scripts/audio/audio-stream-player";
import { socket } from "../scripts/socket/socket";
import ListDropdown from './ListDropdown.vue';

import Visualiser from "./Visualiser.vue";
import { alreadyConnected, authToggle, isConnected, playerState, setInformation, setupSocket, shutdownSocket } from '../scripts/socket/manager';
import NumberInput from './NumberInput.vue';
import ColorInput from './ColorInput.vue';
type visualiserType = InstanceType<typeof Visualiser>;

// other
const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
const stateInterval = ref<NodeJS.Timeout>(null);
const playState = ref<[number, number, number]>([0, 0, 0]);

const overlayToggle = ref<boolean>(true);
const visualiserRef = useTemplateRef<visualiserType>("visualiser");
const visualiserOn = ref<boolean>(true);
const bitratesShown = ref<boolean>(false);
const settingsShown = ref<boolean>(false);

// SETTINGS VARS (should autosave)
const visualizerFFTSize = ref<number>(12);
const visualizerFPSLimit = ref<number>(60);
const visualizerColor = ref<string>("#bb7755");
const visualizerWidth = ref<number>(1.5);
const bitrate = ref(Bitrate.High);
const volume = ref<number>(75);
const muted = ref<boolean>(false);

// GUI
const isEmbedded = ref<boolean>(true);

const isMobile = computed(() => {
    return screen.width <= 760;
});

onMounted(() => {
    (localStorage.getItem('visualizerFFTSize')) ? visualizerFFTSize.value = parseInt(localStorage.getItem('visualizerFFTSize')) : null;
    (localStorage.getItem('visualizerFPSLimit')) ? visualizerFPSLimit.value = parseInt(localStorage.getItem('visualizerFPSLimit')) : null;
    (localStorage.getItem('visualizerWidth')) ? visualizerWidth.value = parseFloat(localStorage.getItem('visualizerWidth')) : null;
    (localStorage.getItem('visualizerColor')) ? visualizerColor.value = localStorage.getItem('visualizerColor') : null;
    (localStorage.getItem('bitrate')) ? bitrate.value = parseInt(localStorage.getItem('bitrate')) : null;
    (localStorage.getItem('volume')) ? volume.value = parseInt(localStorage.getItem('volume')) : null;
    (localStorage.getItem('muted')) ? muted.value = (localStorage.getItem('muted') == 'true') : null;

    const player = new AudioStreamPlayer(
        socket,
        bitrate.value,
        volume.value / 100,
    );

    visualiserOn.value = !isMobile.value

    audioStreamPlayer.value = player;

    clearInterval(stateInterval.value)
    stateInterval.value = setInterval(() => {
        playState.value = [
            player.getCurrentPlayPosition(),
            player.getTotalDuration(),
            player.getDownloadedAudioTime(),
        ];
    }, config.UpdateInterval);

    isEmbedded.value = window.self !== window.top;

    setupSocket();

    onUnmounted(() => {
        shutdownSocket()
        disconnect();
    });
});

watch(bitrate, () => {
    localStorage.setItem('bitrate', bitrate.value.toString());

    if (audioStreamPlayer.value !== null) {
        audioStreamPlayer.value.setBitrate(Number(bitrate.value));
    }
});

watch([volume, muted], () => {
    localStorage.setItem('volume', volume.value.toString());
    localStorage.setItem('muted', muted.value.toString());

    if (audioStreamPlayer.value !== null) {
        audioStreamPlayer.value.setVolume(
            muted.value ? 0.0 : Number(volume.value / 100),
        );
    }
});

watch([visualizerColor, visualizerFFTSize, visualizerFPSLimit, visualizerWidth], () => {
    localStorage.setItem('visualizerFFTSize', visualizerFFTSize.value.toString());
    localStorage.setItem('visualizerFPSLimit', visualizerFPSLimit.value.toString());
    localStorage.setItem('visualizerWidth', visualizerWidth.value.toString());
    localStorage.setItem('visualizerColor', visualizerColor.value.toString());
})

watch(visualiserOn, () => {
    if (visualiserOn.value) {
        visualiserRef.value.resume()
    } else {
        visualiserRef.value.pause()
    }
})

watch(playerState, () => {
    if (isConnected.value) {
        if (playerState.value.state == 0) {
            audioStreamPlayer.value.reset();
            visualiserRef.value.pause();
        } else {
            audioStreamPlayer.value.reset();
            audioStreamPlayer.value.start();
            visualiserRef.value.setAnalyser(audioStreamPlayer.value.getAnalyzer());
            visualiserRef.value.resume();
        }
    }
})

async function connect() {
    if (!isConnected.value) {
        console.log("Joining audio!");
        socket.connect();
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
            <img src="/src/assets/magickfestlogo.gif" style="width: 100%; max-width: 700px;">
            <img src="/src/assets/connect_icon.png"
                style="width: 200px; margin-top: 4vh; height: auto; cursor: pointer;" class="hoverBtn"
                @click="overlayClick" />
        </div>
        <div class="overlay" v-show="authToggle">
            <h1>browser mode - authenticate through discord</h1>
            <a href="https://localhost:8080/api/auth/login">authenticate here</a>
        </div>
        <div class="overlay" v-show="alreadyConnected">
            <h1>you're already connected elsewhere</h1>
        </div>
        <div class="overlay" v-show="settingsShown">
            <h1>settings</h1>
            <h2>visualizer FFT size: </h2>
            <NumberInput v-model="visualizerFFTSize" min="5" max="15"></NumberInput>
            <h2>visualizer FPS limit: </h2>
            <NumberInput v-model="visualizerFPSLimit" min="1" max="60"></NumberInput>
            <h2>visualizer color: </h2>
            <ColorInput v-model="visualizerColor"></ColorInput>
            <h2>visualizer line width: </h2>
            <NumberInput v-model="visualizerWidth" min="1" max="10" step="0.5"></NumberInput>
            <br>
            <button @click="() => { settingsShown = false }">close</button>
        </div>
        <img id="cover"
            :src="setInformation.setInfo.coverURL ? setInformation.setInfo.coverURL : '/src/assets/noartwork.png'"
            alt="cover artwork for set" />
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
        <div style="min-width: 140px; width: 20em; padding: 0 2em" class="fullOnly">
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
        <div style="width: 100%; flex-direction: column" class="alwaysVisible">
            {{ timeConverter(playState[0]) }} / {{ timeConverter(playState[1]) }}
            <div id="progressbar">
                <div id="buffered" :style="{
                    width: ((playState[0] + playState[2]) / playState[1]) * 100 + '%',
                }"></div>
                <div id="filled" :style="{ width: (playState[0] / playState[1]) * 100 + '%' }"></div>
            </div>
        </div>
        <div style="gap: 1em; padding: 0 2em; font-size: 1.6vmax" class="fullOnly">
            <img :src="'/src/assets/visualizer_icon' + (visualiserOn ? '' : '_disabled') + '.png'" alt="visualizer icon"
                style="height: 6vh; cursor: pointer" @click="
                    () => {
                        visualiserOn = !visualiserOn;
                    }
                " />
            <div style="cursor: pointer; position: relative; display: flex; align-items: center;">
                <img :src="'/src/assets/quality_' + bitrate + '.png'" :alt="'quality: ' + bitrate + 'kbps'"
                    style="height: 6vh; " @click="() => { bitratesShown = !bitratesShown }">
                <img src="/src/assets/dropdown_arrow.png" alt=""
                    :style="{ height: '2vh', transform: (bitratesShown) ? 'rotate(180deg)' : '' }"
                    @click="() => { bitratesShown = !bitratesShown }" />
                <ListDropdown :elements="['128kbps', '96kbps', '64kbps']"
                    :funcs="[switchQuality, switchQuality, switchQuality]"
                    :disabled-indices="['128kbps', '96kbps', '64kbps'].filter(e => e == bitrate.toString() + 'kbps')"
                    :visible="bitratesShown">
                </ListDropdown>
            </div>

            <img src="/src/assets/settings_icon.png" alt="settings" style="height: 6vh; cursor: pointer"
                @click="() => { settingsShown = !settingsShown }">
        </div>
    </div>
</template>
