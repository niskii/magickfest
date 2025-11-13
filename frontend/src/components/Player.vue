<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import config from "../config/client.json";
import { AudioStreamPlayer } from "../scripts/audio/audio-stream-player";
import { SetInfoFetcher } from "../scripts/socket/set-info-fetcher";
import { socket } from "../scripts/socket/socket";
import Overlay from "./Overlay.vue";

const audioStreamPlayer = shallowRef<AudioStreamPlayer>(null);
const stateInterval = ref<NodeJS.Timeout>(null);
const playState = ref<[number, number, number]>([0, 0, 0]);
const isConnected = ref(socket.connected);
const coverImage = ref(null);
const setInformation = new SetInfoFetcher(socket);
const bitrate = ref(128);

const overlayToggle = ref<boolean>(true);
const volume = ref<number>(75);
const muted = ref<boolean>(false);

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
    }
  }

  socket.on("newSet", newSetEvent);
  socket.on("changedState", changedStateEvent);

  return () => {
    socket.off("newSet", newSetEvent);
  };
});

async function connect() {
  if (!isConnected.value) {
    console.log("Joining audio!");
    socket.connect();

    fetchInfo();

    const player = new AudioStreamPlayer(
      socket,
      bitrate.value,
      volume.value / 100,
    );
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

// redundant because react

// const changeHandler = (event: Event & { target: HTMLInputElement }) => {
//     if (event.target.type === "radio") {
//         bitrate.value = Number(event.target.value);
//     }
// };

const timeConverter = (time: number) => {
  time = Math.round(time);
  return (
    Math.round(time / 60 / 60)
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
  <Overlay msg="in order to listen, press 'connect'" :func="overlayClick" btn-content="connect"
    :visible="overlayToggle"></Overlay>
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
    <!-- <h3 style="color: white;">temp shit</h3>
            <button @click="connect">connect</button>
            <button @click="disconnect">disconnect</button>
            <button @click="fetchInfo">work</button> -->
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
  <div style="width: 20%; font-size: 1.65vmax" class="fullOnly">
    quality:
    <div id="dropdownBtn">
      <text id="dropdownBtnText">{{ bitrate }}kbps &nbsp;▴</text>
      <div id="dropdown">
        <div :class="bitrate == 64 ? 'dropdownSelected' : null" @click="switchQuality">
          64kbps
        </div>
        <div :class="bitrate == 96 ? 'dropdownSelected' : null" @click="switchQuality">
          96kbps
        </div>
        <div :class="bitrate == 128 ? 'dropdownSelected' : null" @click="switchQuality">
          128kbps
        </div>
      </div>
    </div>
  </div>
</div>
</template>
