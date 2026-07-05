<script setup lang="ts">
import { Bitrate } from '@shared/types/audio-transfer';
import { onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import config from "../config/client.json";
import { AudioStreamPlayer } from "../scripts/audio/audio-stream-player";
import { socket } from "../scripts/socket/socket";
import ListDropdown from './ListDropdown.vue';
import Button from './Button.vue';
import RadioInput from './RadioInput.vue';

import Visualiser from "./Visualiser.vue";
import * as SocketManager from '../scripts/socket/manager';
import { playerState, socketStore } from '../scripts/socket/manager';
import NumberInput from './NumberInput.vue';
import ColorInput from './ColorInput.vue';
import StatusIndicator from './StatusIndicator.vue';
import { PlaybackState } from '@shared/types/player-state'
import Mute from './Mute.vue';
import logger from '../logger';

type visualiserType = InstanceType<typeof Visualiser>;

// other
const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
const stateInterval = ref<NodeJS.Timeout>(null);
const playState = ref<[number, number, number]>([0, 0, 0]);
const isPaused = ref(false)
const setIndex = ref(0)
const startPaused = ref(true)

const overlayToggle = ref<boolean>(true);
const visualiserRef = useTemplateRef<visualiserType>("visualiser");
const visualiserOn = ref<boolean>(true);
const bitratesShown = ref<boolean>(false);
const settingsShown = ref<boolean>(false);
const mobileBitratesShown = ref<boolean>(false);

// SETTINGS VARS (should autosave)
const visualizerFFTSize = ref<number>(12);
const visualizerFPSLimit = ref<number>(60);
const visualizerColor = ref<string>("#bb7755");
const visualizerWidth = ref<number>(1.5);
const bitrate = ref(Bitrate.High);
const volume = ref<number>(75);
const muted = ref<boolean>(false);
const altIcons = ref<boolean>(false);

// GUI
// const isEmbedded = ref<boolean>(true);
// const titleRender = ref(null);
// const setInfo = ref(null);
// const titleFontSize = ref<number>(null);

onMounted(() => {
    (localStorage.getItem('visualizerFFTSize')) ? visualizerFFTSize.value = parseInt(localStorage.getItem('visualizerFFTSize')) : null;
    (localStorage.getItem('visualizerFPSLimit')) ? visualizerFPSLimit.value = parseInt(localStorage.getItem('visualizerFPSLimit')) : null;
    (localStorage.getItem('visualizerWidth')) ? visualizerWidth.value = parseFloat(localStorage.getItem('visualizerWidth')) : null;
    (localStorage.getItem('visualizerColor')) ? visualizerColor.value = localStorage.getItem('visualizerColor') : null;
    (localStorage.getItem('bitrate')) ? bitrate.value = parseInt(localStorage.getItem('bitrate')) : null;
    (localStorage.getItem('volume')) ? volume.value = parseInt(localStorage.getItem('volume')) : null;
    (localStorage.getItem('muted')) ? muted.value = (localStorage.getItem('muted') == 'true') : null;
    (localStorage.getItem('altIcons')) ? altIcons.value = (localStorage.getItem('altIcons') == 'true') : null;
    (localStorage.getItem('visualiserOn')) ? visualiserOn.value = (localStorage.getItem('visualiserOn') == 'true') : !isMobile();

    (isMobile()) ? volume.value = 100 : null;

    const player = new AudioStreamPlayer(
        socket,
        bitrate.value,
        volume.value / 100,
    );

    audioStreamPlayer.value = player;

    clearInterval(stateInterval.value)
    stateInterval.value = setInterval(() => {
        playState.value = [
            player.getCurrentPlayPosition(),
            player.getTotalDuration(),
            player.getDownloadedAudioTime(),
        ];
    }, config.UpdateInterval);

    // isEmbedded.value = window.self !== window.top;

    SocketManager.setupSocket();

    onUnmounted(() => {
        SocketManager.shutdownSocket()
        disconnect();
    });
});

watch(altIcons, () => {
    localStorage.setItem('altIcons', altIcons.value.toString());
})

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
    localStorage.setItem('visualiserOn', visualiserOn.value.toString());

    if (visualiserOn.value && playerState.value && playerState.value.state == PlaybackState.Running) {
        visualiserRef.value.resume()
    } else {
        visualiserRef.value.pause()
    }
})

watch(playerState, () => {
    if (socketStore.isConnected) {
        switch (playerState.value.state) {
            case PlaybackState.Stopped:
                audioStreamPlayer.value.reset();
                visualiserRef.value.pause();
                break;

            case PlaybackState.Running:
                if (isPaused.value && setIndex.value == playerState.value.setIndex) {
                    audioStreamPlayer.value.resume();
                } else {
                    playerStart()
                    setIndex.value = playerState.value.setIndex
                }
                isPaused.value = false
                break;

            case PlaybackState.Paused:
                if (startPaused.value) {
                    playerStart();
                }
                audioStreamPlayer.value.pause();
                isPaused.value = true
                break;


            default:
                break;
        }

        startPaused.value = false
    }
})

function playerStart() {
    audioStreamPlayer.value.reset();
    audioStreamPlayer.value.start();
    setVisualiser();
}

function setVisualiser() {
    visualiserRef.value.setAnalyser(audioStreamPlayer.value.getAnalyzer());
    if (visualiserOn.value) {
        visualiserRef.value.resume();
    }
}

async function connect() {
    if (!socketStore.isConnected) {
        SocketManager.connect()
        logger.info("Joining audio!");
    }
}

async function disconnect() {
    if (socketStore.isConnected) {
        clearInterval(stateInterval.value);
        stateInterval.value = null;

        audioStreamPlayer.value.close();
        audioStreamPlayer.value = null;

        SocketManager.disconnect()
    }
}

function isMobile() {
    return (screen.width <= 760 && screen.height > 400);
};

function isMinimized() {
    return (window.innerHeight <= 400);
};

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

function mute() {
    muted.value = !muted.value
}

const getTextWidth = (text: String) => {
    const widths = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2796875, 0.2765625, 0.3546875, 0.5546875, 0.5546875, 0.8890625, 0.665625, 0.190625, 0.3328125, 0.3328125, 0.3890625, 0.5828125, 0.2765625, 0.3328125, 0.2765625, 0.3015625, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.2765625, 0.2765625, 0.584375, 0.5828125, 0.584375, 0.5546875, 1.0140625, 0.665625, 0.665625, 0.721875, 0.721875, 0.665625, 0.609375, 0.7765625, 0.721875, 0.2765625, 0.5, 0.665625, 0.5546875, 0.8328125, 0.721875, 0.7765625, 0.665625, 0.7765625, 0.721875, 0.665625, 0.609375, 0.721875, 0.665625, 0.94375, 0.665625, 0.665625, 0.609375, 0.2765625, 0.3546875, 0.2765625, 0.4765625, 0.5546875, 0.3328125, 0.5546875, 0.5546875, 0.5, 0.5546875, 0.5546875, 0.2765625, 0.5546875, 0.5546875, 0.221875, 0.240625, 0.5, 0.221875, 0.8328125, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.3328125, 0.5, 0.2765625, 0.5546875, 0.5, 0.721875, 0.5, 0.5, 0.5, 0.3546875, 0.259375, 0.353125, 0.5890625]
    const avg = 0.5279276315789471

    if (text && playerState.value && playerState.value.state != PlaybackState.Stopped) {
        return Array.from(text).reduce((acc, cur) => acc + (widths[cur.charCodeAt(0)] ?? avg), 0)
    } else {
        return 99999999
    }
}

const getViewportFontSize = (isAuthor: Boolean) => {
    if (isMobile()) {
        return (isAuthor) ? 2.5 : 5;
    } else if (isMinimized()) {
        return (isAuthor) ? 3 : 5;
    } else {
        return (isAuthor) ? 1.5 : 3;
    }
}

const renderStreamInfoPerStatus = (isRunningWithData: string, isRunningNoData: string, isNotRunning: string, prefix: string = "") => {
    if (playerState.value && playerState.value.state != PlaybackState.Stopped) {
        return (isRunningWithData) ? prefix + isRunningWithData : prefix + isRunningNoData;
    } else {
        return isNotRunning;
    }
}

</script>

<template>
<div class="overlay" v-show="overlayToggle">
    <img src="/src/assets/magickfestlogo.gif" style="width: 100%; max-width: 700px;">
    <img src="/src/assets/connect_icon.png" style="width: 200px; margin-top: 4vh; height: auto; cursor: pointer;"
        class="hoverBtn" @click="overlayClick" />
</div>
<div class="overlay" v-show="socketStore.authToggle">
    <h1>browser mode - authenticate through discord</h1>
    <a href="https://localhost:8080/api/auth/login">authenticate here</a>
</div>
<div class="overlay" v-show="socketStore.alreadyConnected">
    <h1>you're already connected elsewhere</h1>
</div>
<div class="overlay" v-show="settingsShown">
    <h1>settings</h1>
    <h2>visualizer FFT size: </h2>
    <NumberInput v-model="visualizerFFTSize" min="5" max="15"></NumberInput>
    <h2>visualizer FPS limit: </h2>
    <NumberInput v-model="visualizerFPSLimit" min="1" max="60"></NumberInput>
    <h2>visualizer line width: </h2>
    <NumberInput v-model="visualizerWidth" min="1" max="10" step="0.5"></NumberInput>
    <h2>visualizer color: </h2>
    <ColorInput v-model="visualizerColor"></ColorInput>
    <h2>alternative volume icon: </h2>
    <input type="checkbox" v-model="altIcons">
    <br>
    <Button :text="'close'" :bgColor="'#4a4a4a'" :func="() => { settingsShown = false }" />
</div>
<div class="overlay" v-show="mobileBitratesShown">
    <h1>select bitrate</h1>
    <RadioInput :elements="['128kbps', '96kbps', '64kbps']" :funcs="[switchQuality, switchQuality, switchQuality]"
        :disabled-indices="['128kbps', '96kbps', '64kbps'].filter(e => e == bitrate.toString() + 'kbps')">
    </RadioInput>
    <Button :text="'close'" :bgColor="'#4a4a4a'" :func="() => { mobileBitratesShown = false }" />
</div>
<div id="main">
    <StatusIndicator :status="playerState" v-show="!isMobile()"></StatusIndicator>
    <img id="cover"
        :src="renderStreamInfoPerStatus(socketStore.setInformation.coverURL, '/src/assets/noartwork.png', '/src/assets/nostream.png')"
        alt="cover artwork for set" />
    <div id="setInfo">
        <h1 :style="{
            fontSize: `min(${getViewportFontSize(false)}vmax, ${(getTextWidth(socketStore.setInformation.title) > 9.984375) ? getViewportFontSize(false) * (getTextWidth(socketStore.setInformation.title) / 20) : getViewportFontSize(false)}vmax)`
        }">
            {{
                renderStreamInfoPerStatus(socketStore.setInformation.title, '[untitled]', 'no set available')
            }}
        </h1>
        <h2 :style="{
            fontSize: `min(${getViewportFontSize(true)}vmax, ${(getTextWidth(socketStore.setInformation.author) > 17.5) ? getViewportFontSize(true) * (getTextWidth(socketStore.setInformation.author) / 20) : getViewportFontSize(true)}vmax)`
        }">
            {{
                renderStreamInfoPerStatus(socketStore.setInformation.author, '[unknown author]', null, "by ")
            }}
        </h2>
        <Visualiser v-show="visualiserOn" ref="visualiser" class="visualiser" :fftSize="visualizerFFTSize"
            :fpsLimit="visualizerFPSLimit" :lineWidth="visualizerWidth" :lineColor="visualizerColor"
            backgroundColor="#0c0c11">
        </Visualiser>
        <h3 v-show="!visualiserOn && isMobile()" class="visualiser">[visualizer is off]</h3>
    </div>
</div>

<div id="bottomBar">
    <div style="min-width: 140px; width: 25%; padding: 0 2em" class="fullOnly">
        <Mute :muted="muted" :volume="parseInt(volume.toString())" :alt="altIcons" @click="mute()"></Mute>
        <div id="volumeSlider">
            <input v-model="volume" type="range" min="0" max="100" />
            <div :style="{ width: volume + '%' }"></div>
        </div>
    </div>
    <div style="width: 100%; flex-direction: column" class="alwaysVisible">
        <div style="display: flex; flex-direction: row !important;">
            <StatusIndicator :status="playerState" v-show="isMobile()"></StatusIndicator>
            {{ timeConverter(playState[0]) }} / {{ timeConverter(playState[1]) }}
        </div>
        <div id="progressbar">
            <div id="buffered" :style="{
                width: ((playState[0] + playState[2]) / playState[1]) * 100 + '%',
            }"></div>
            <div id="filled" :style="{ width: (playState[0] / playState[1]) * 100 + '%' }"></div>
        </div>
    </div>

    <div id="settings-panel">
        <img id="visualiser-button" :src="'/src/assets/visualizer_icon' + (visualiserOn ? '' : '_disabled') + '.png'"
            alt="visualizer icon" @click="
                () => {
                    visualiserOn = !visualiserOn;
                }
            " />
        <div id="quality-button">
            <img :src="'/src/assets/quality_' + bitrate + '.png'" :alt="'quality: ' + bitrate + 'kbps'"
                style="height: 6vh;" @click="() => {
                    if (isMobile()) {
                        mobileBitratesShown = !mobileBitratesShown;
                    } else {
                        bitratesShown = !bitratesShown;
                    }
                }">
            <img class="fullOnly" src="/src/assets/dropdown_arrow.png" alt=""
                :style="{ height: '2vh', marginLeft: '0.3vw', transform: (bitratesShown) ? 'rotate(180deg)' : '' }" />
            <ListDropdown :elements="['128kbps', '96kbps', '64kbps']"
                :funcs="[switchQuality, switchQuality, switchQuality]"
                :disabled-indices="['128kbps', '96kbps', '64kbps'].filter(e => e == bitrate.toString() + 'kbps')"
                :visible="bitratesShown">
            </ListDropdown>
        </div>
        <img id="settings-button" src="/src/assets/settings_icon.png" alt="settings"
            @click="() => { settingsShown = !settingsShown }">
    </div>
</div>
</template>
