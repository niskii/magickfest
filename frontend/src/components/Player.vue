<script setup lang="ts">
import { Bitrate } from "@shared/types/audio-transfer";
import { onBeforeMount, onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import config from "../config/client.json";
import { AudioStreamPlayer } from "../scripts/audio/audio-stream-player";
import { socket } from "../scripts/socket/socket";
import Button from "./Button.vue";
import ListDropdown from "./ListDropdown.vue";
import RadioInput from "./RadioInput.vue";

import { PlaybackState } from "@shared/types/player-state";
import logger from "../logger";
import * as SocketManager from "../scripts/socket/manager";
import { playerState, socketStore } from "../scripts/socket/manager";
import * as storage from "../scripts/stored-references";
import ColorInput from "./ColorInput.vue";
import Mute from "./Mute.vue";
import NumberInput from "./NumberInput.vue";
import StatusIndicator from "./StatusIndicator.vue";
import Visualiser from "./Visualiser.vue";

import { Viewport } from "../scripts/enum/Viewport";
import watchers from "../scripts/watchers";

type visualiserType = InstanceType<typeof Visualiser>;

// other
const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
const visualiserRef = useTemplateRef<visualiserType>("visualiser");

const stateInterval = ref<NodeJS.Timeout>(null);
const playState = ref<[number, number, number]>([0, 0, 0]);
const isPaused = ref(false);
const setIndex = ref(0);
const startPaused = ref(true);
const wasDisconnected = ref(false);
const isConnecting = ref(false);

const overlayToggle = ref<boolean>(true);
const bitratesShown = ref<boolean>(false);
const settingsShown = ref<boolean>(false);
const mobileBitratesShown = ref<boolean>(false);

const versionName = import.meta.env.VITE_SHOW_VERSION == "true" ? import.meta.env.VITE_VERSION_NAME : null;

onBeforeMount(() => {
    const player = new AudioStreamPlayer(socket, storage.bitrate.value, storage.volume.value / 100);
    audioStreamPlayer.value = player;
    
    clearInterval(stateInterval.value);
    stateInterval.value = setInterval(() => {
        playState.value = [player.getCurrentPlayPosition(), player.getTotalDuration(), player.getDownloadedAudioTime()];
    }, config.UpdateInterval);
})

onMounted(() => {
    getScreenViewport() == Viewport.Mobile ? (storage.volume.value = 100) : null;

    (localStorage.getItem('visualiserOn')) ? storage.visualiserOn.value = (localStorage.getItem('visualiserOn') == 'true') : getScreenViewport() != Viewport.Mobile;

    storage.load()
    watchers(audioStreamPlayer, visualiserRef);

    SocketManager.setupSocket();

    window.addEventListener("beforeunload", () => {
        SocketManager.shutdownSocket();
        disconnect();
    });

    onUnmounted(() => {
        SocketManager.shutdownSocket();
        disconnect();
    });
});

watch(playerState, () => {
    if (socketStore.isConnected) {
        switch (playerState.value.state) {
            case PlaybackState.Stopped:
                audioStreamPlayer.value.reset();
                visualiserRef.value.pause();
                isConnecting.value = false;
                break;

            case PlaybackState.Running:
                if (isPaused.value && setIndex.value == playerState.value.setIndex) {
                    audioStreamPlayer.value.resume();
                } else {
                    playerStart();
                    setIndex.value = playerState.value.setIndex;
                    isConnecting.value = false;
                }
                isPaused.value = false;
                break;

            case PlaybackState.Paused:
                if (startPaused.value) {
                    playerStart();
                }
                audioStreamPlayer.value.pause();
                isPaused.value = true;
                isConnecting.value = false;
                break;

            default:
                break;
        }

        startPaused.value = false;
    } else {
        logger.info("disconnected");

        audioStreamPlayer.value.pause();

        wasDisconnected.value = true;
        overlayToggle.value = true;
    }
});

function playerStart() {
    audioStreamPlayer.value.reset();
    audioStreamPlayer.value.start();
    setVisualiser();
}

function setVisualiser() {
    visualiserRef.value.setAnalyser(audioStreamPlayer.value.getAnalyzer());
    if (storage.visualiserOn.value) {
        visualiserRef.value.resume();
    }
}

async function connect() {
    if (!socketStore.isConnected) {
        SocketManager.connect();
        if (wasDisconnected) {
            playerStart();
            audioStreamPlayer.value.resume();
        }
        wasDisconnected.value = false;
        isConnecting.value = true;
        logger.info("Joining audio!");
    }
}

async function disconnect() {
    if (socketStore.isConnected) {
        clearInterval(stateInterval.value);
        stateInterval.value = null;

        audioStreamPlayer.value.close();
        audioStreamPlayer.value = null;

        SocketManager.disconnect();
    }
}

function getScreenViewport() {
    if (window.innerWidth <= 500 && window.innerHeight > 400) return Viewport.Mobile;
    if (window.innerHeight <= 400) {
        if (window.innerWidth / window.innerHeight >= 7 / 3) {
            return Viewport.WideMinimized;
        } else {
            return Viewport.Minimized;
        }
    }
    return Viewport.Desktop;
}

function timeConverter (time: number) {
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
    storage.bitrate.value = parseInt(el.innerHTML.replace("kbps", ""));
};

function overlayClick() {
    connect();
    overlayToggle.value = false;
}

function mute() {
    storage.muted.value = !storage.muted.value;
}

const getTextWidth = (text: String) => {
    const widths = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2796875, 0.2765625, 0.3546875, 0.5546875, 0.5546875,
        0.8890625, 0.665625, 0.190625, 0.3328125, 0.3328125, 0.3890625, 0.5828125, 0.2765625, 0.3328125, 0.2765625, 0.3015625, 0.5546875, 0.5546875, 0.5546875,
        0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.2765625, 0.2765625, 0.584375, 0.5828125, 0.584375, 0.5546875, 1.0140625,
        0.665625, 0.665625, 0.721875, 0.721875, 0.665625, 0.609375, 0.7765625, 0.721875, 0.2765625, 0.5, 0.665625, 0.5546875, 0.8328125, 0.721875, 0.7765625,
        0.665625, 0.7765625, 0.721875, 0.665625, 0.609375, 0.721875, 0.665625, 0.94375, 0.665625, 0.665625, 0.609375, 0.2765625, 0.3546875, 0.2765625,
        0.4765625, 0.5546875, 0.3328125, 0.5546875, 0.5546875, 0.5, 0.5546875, 0.5546875, 0.2765625, 0.5546875, 0.5546875, 0.221875, 0.240625, 0.5, 0.221875,
        0.8328125, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.3328125, 0.5, 0.2765625, 0.5546875, 0.5, 0.721875, 0.5, 0.5, 0.5, 0.3546875, 0.259375,
        0.353125, 0.5890625,
    ];
    const avg = 0.5279276315789471;

    if (text) {
        return Array.from(text).reduce((acc, cur) => acc + (widths[cur.charCodeAt(0)] ?? avg), 0);
    } else {
        return 0;
    }
};

const getViewportFontSize = (isAuthor: Boolean) => {
    switch (getScreenViewport()) {
        case Viewport.Mobile:
            return isAuthor ? 2.5 : 5;
        case Viewport.Minimized:
            return isAuthor ? 3 : 5;
        default:
            return isAuthor ? 1.5 : 3;
    }
};

const renderStreamInfoPerStatus = (
    isRunningWithData: string,
    isRunningNoData: string,
    isNotRunning: string,
    isRunningSoon: string,
    isAuthor: boolean,
    prefix: string = "",
) => {
    if (playerState.value && playerState.value.startTime != 0) {
        if (playerState.value.state == PlaybackState.Stopped && Date.now() < playerState.value.startTime) {
            let finalString: string;
            if (isRunningSoon) finalString = isRunningSoon.replace("%time%", String(timeConverter((playerState.value.startTime - Date.now()) / 1000)));
            return finalString;
        }
        return isRunningWithData ? truncateSetInfo(prefix + isRunningWithData, isAuthor) : prefix + isRunningNoData;
    } else {
        return isNotRunning;
    }
};

const adjustSizePerSetInfo = (setInfo: string, isAuthor: boolean) => {
    let fullSizeThreshold = 30;

    switch (getScreenViewport()) {
        case Viewport.Mobile:
            fullSizeThreshold = 30.75;
            break;
        case Viewport.Minimized:
            fullSizeThreshold = 35;
            break;
        case Viewport.WideMinimized:
            fullSizeThreshold = 20;
            break;
        default:
            fullSizeThreshold = 30;
            break;
    }

    return getViewportFontSize(isAuthor) * getTextWidth(setInfo) > fullSizeThreshold && playerState.value && playerState.value.state != PlaybackState.Stopped
        ? fullSizeThreshold / getTextWidth(setInfo)
        : getViewportFontSize(isAuthor);
};

const truncateSetInfo = (setInfo: string, isAuthor: boolean) => {
    let maxWidth = 20;

    if (!setInfo) return setInfo;

    switch (getScreenViewport()) {
        case Viewport.Mobile:
            maxWidth = 11;
            break;
        case Viewport.Minimized:
            maxWidth = 12;
            break;
        case Viewport.WideMinimized:
            maxWidth = 10;
            break;
        default:
            maxWidth = 20;
            break;
    }

    if (getTextWidth(setInfo) > maxWidth) {
        let truncatedString: string;
        for (let i = 0; i < setInfo.length; i++) {
            let testString = setInfo.substring(0, setInfo.length - i - 1) + "...";
            if (getTextWidth(testString) <= maxWidth * (isAuthor ? 2 : 1)) {
                truncatedString = testString;
                break;
            }
        }

        return truncatedString;
    } else {
        return setInfo;
    }
};

const renderCoverImage = (coverImage: string) => {
    if (playerState.value) {
        if (playerState.value.state != PlaybackState.Stopped) {
            if (coverImage) {
                return coverImage;
            } else {
                return "/noartwork.webp";
            }
        } else {
            if (playerState.value.startTime > 0) {
                return "/startingsoon.webp";
            } else {
                return "/nostream.webp";
            }
        }
    } else {
        return "/nostream.webp";
    }
};

const displayBitrate = (q: Bitrate) => {
    switch (q) {
        case Bitrate.High:
            return "/quality_128.webp";
        case Bitrate.Medium:
            return "/quality_96.webp";
        case Bitrate.Low:
        default:
            return "/quality_64.webp";
    }
};
</script>

<template>
    <div class="overlay" v-show="overlayToggle">
        <h2 v-show="wasDisconnected">you have been disconnected</h2>
        <img src="/magickfestlogo.gif" style="width: 100%; max-width: 700px" />
        <img src="/connect_icon.webp" style="width: 200px; margin-top: 4vh; height: auto; cursor: pointer" class="hoverBtn" @click="overlayClick" />
    </div>
    <div class="overlay" v-show="socketStore.authToggle">
        <h1>browser mode - authenticate through discord</h1>
        <a :href="`/api/auth/login`"><img src="/authorize_icon.webp" style="width: 250px" class="hoverBtn" /></a>
    </div>
    <div class="overlay" v-show="socketStore.alreadyConnected">
        <h1>you're already connected elsewhere</h1>
    </div>
    <div class="overlay" style="z-index: 9998" v-show="isConnecting">
        <h1>connecting...</h1>
    </div>
    <div class="overlay" v-show="settingsShown">
        <h1>settings</h1>
        <h2>visualizer FFT size:</h2>
        <NumberInput v-model="storage.visualizerFFTSize.value" min="5" max="15"></NumberInput>
        <h2>visualizer FPS limit:</h2>
        <NumberInput v-model="storage.visualizerFPSLimit.value" min="1" max="60"></NumberInput>
        <h2>visualizer line width:</h2>
        <NumberInput v-model="storage.visualizerWidth.value" min="1" max="10" step="0.5"></NumberInput>
        <h2>visualizer color:</h2>
        <ColorInput v-model="storage.visualizerColor.value"></ColorInput>
        <h2 v-show="getScreenViewport() != Viewport.Mobile">alternative volume icon:</h2>
        <input v-show="getScreenViewport() != Viewport.Mobile" type="checkbox" v-model="storage.altIcons.value" />
        <br />
        <Button
            :text="'close'"
            :bgColor="'#4a4a4a'"
            :func="
                () => {
                    settingsShown = false;
                }
            "
        />
    </div>
    <div class="overlay" v-show="mobileBitratesShown">
        <h1>select bitrate</h1>
        <RadioInput
            :elements="['128kbps', '96kbps', '64kbps']"
            :funcs="[switchQuality, switchQuality, switchQuality]"
            :disabled-indices="['128kbps', '96kbps', '64kbps'].filter((e) => e == storage.bitrate.value.toString() + 'kbps')"
        >
        </RadioInput>
        <Button
            :text="'close'"
            :bgColor="'#4a4a4a'"
            :func="
                () => {
                    mobileBitratesShown = false;
                }
            "
        />
    </div>
    <div class="flex center flex-responsive" id="main">
        <div id="statusInfo">
            <StatusIndicator class="flex center" :status="playerState" v-show="getScreenViewport() != Viewport.Mobile"> </StatusIndicator>
            <div id="connectedInfo" v-show="getScreenViewport() != Viewport.Mobile">
                <h4>{{ socketStore.numberOfUsers }}</h4>
                <img src="/originals/viewers_icon.png" />
            </div>
        </div>
        <p id="versionIndicator">{{ versionName }}</p>
        <img id="cover" :src="renderCoverImage(socketStore.setInformation.coverURL)" alt="cover artwork for set" />
        <div id="setInfo">
            <h1
                :style="{
                    fontSize: `min(${getViewportFontSize(false)}vmax, ${adjustSizePerSetInfo(truncateSetInfo(socketStore.setInformation.title, false), false)}vmax)`,
                }"
            >
                {{ renderStreamInfoPerStatus(socketStore.setInformation.title, "[untitled]", "no set available", `starting in %time%`, false) }}
            </h1>
            <h2
                :style="{
                    fontSize: `min(${getViewportFontSize(true)}vmax, ${adjustSizePerSetInfo(truncateSetInfo('by ' + socketStore.setInformation.author, true), true)}vmax)`,
                }"
            >
                {{ renderStreamInfoPerStatus(socketStore.setInformation.author, "[unknown author]", null, null, true, "by ") }}
            </h2>
            <Visualiser
                v-show="storage.visualiserOn.value"
                ref="visualiser"
                class="visualiser"
                :fftSize="storage.visualizerFFTSize.value"
                :fpsLimit="storage.visualizerFPSLimit.value"
                :lineWidth="storage.visualizerWidth.value"
                :lineColor="storage.visualizerColor.value"
                backgroundColor="#0c0c11"
            >
            </Visualiser>
            <h3 v-show="!storage.visualiserOn.value && getScreenViewport() == Viewport.Mobile" class="visualiser">[visualizer is off]</h3>
        </div>
    </div>

    <div class="flex flex-responsive responsive-center" id="bottomBar">
        <div style="min-width: 140px; width: 25%; padding: 0 2em" class="fullOnly">
            <Mute :muted="storage.muted.value" :volume="parseInt(storage.volume.value.toString())" :alt="storage.altIcons.value" @click="mute()"></Mute>
            <div class="flex center" id="volumeSlider">
                <input v-model="storage.volume.value" type="range" min="0" max="100" />
                <div :style="{ width: storage.volume.value + '%' }"></div>
            </div>
        </div>
        <div style="width: 100%; flex-direction: column" class="alwaysVisible">
            <div style="display: flex; flex-direction: row !important">
                <div id="connectedInfo" v-show="getScreenViewport() == Viewport.Mobile">
                    <h4>{{ socketStore.numberOfUsers }}</h4>
                    <img src="/originals/viewers_icon.png" />
                </div>
                f
                <StatusIndicator
                    class="flex center"
                    :status="playerState"
                    v-show="getScreenViewport() == Viewport.Mobile"
                    :hide-status-text="true"
                ></StatusIndicator>
                {{ timeConverter(playState[0]) }} /
                {{ timeConverter(playState[1]) }}
            </div>
            <div id="progressbar">
                <div
                    id="buffered"
                    :style="{
                        width: ((playState[0] + playState[2]) / playState[1]) * 100 + '%',
                    }"
                ></div>
                <div
                    id="filled"
                    :style="{
                        width: (playState[0] / playState[1]) * 100 + '%',
                    }"
                ></div>
            </div>
        </div>

        <div id="settings-panel">
            <img
                id="visualiser-button"
                :src="storage.visualiserOn.value ? '/visualizer_icon.webp' : '/visualizer_disabled_icon.webp'"
                alt="visualizer icon"
                @click="
                    () => {
                        storage.visualiserOn.value = !storage.visualiserOn.value;
                    }
                "
            />
            <div id="quality-button">
                <img
                    :src="displayBitrate(storage.bitrate.value)"
                    :alt="'quality: ' + storage.bitrate.value + 'kbps'"
                    style="height: 6vh"
                    @click="
                        () => {
                            if (getScreenViewport() == Viewport.Mobile) {
                                mobileBitratesShown = !mobileBitratesShown;
                            } else {
                                bitratesShown = !bitratesShown;
                            }
                        }
                    "
                />
                <img
                    class="fullOnly"
                    src="/dropdown_arrow.webp"
                    alt=""
                    :style="{
                        height: '2vh',
                        marginLeft: '0.3vw',
                        transform: bitratesShown ? 'rotate(180deg)' : '',
                    }"
                />
                <ListDropdown
                    :elements="['128kbps', '96kbps', '64kbps']"
                    :funcs="[switchQuality, switchQuality, switchQuality]"
                    :disabled-indices="['128kbps', '96kbps', '64kbps'].filter((e) => e == storage.bitrate.value.toString() + 'kbps')"
                    :visible="bitratesShown"
                >
                </ListDropdown>
            </div>
            <img
                id="settings-button"
                src="/settings_icon.webp"
                alt="settings"
                @click="
                    () => {
                        settingsShown = !settingsShown;
                    }
                "
            />
        </div>
    </div>
</template>
