import { SetInfoFetcher } from "./set-info-fetcher";
import { socket } from "./socket";
import { type PlayerState } from '@shared/types/player-state';

import { ref } from "vue";

export const isConnected = ref(socket.connected);
export const setInformation = new SetInfoFetcher(socket);
export const playerState = ref<PlayerState>(null);
export const authToggle = ref<boolean>(false);
export const alreadyConnected = ref<boolean>(false);

function onConnect() {
  isConnected.value = true;
  fetchInfo();
  socket.emit("getPlayerState");

  socket.on("newSet", newSetEvent);
  socket.on("currentPlayerState", currentPlayerState);
}

function onDisconnect() {
  socket.off("newSet", newSetEvent);
  socket.off("currentPlayerState", currentPlayerState);
  playerState.value = null;
  authToggle.value = false;
  alreadyConnected.value = false;
  isConnected.value = false;
}

function onConnectError(err: Error) {
  socket.disconnect();
  isConnected.value = false;
  switch (err.message) {
    case "unauthorized": {
      authToggle.value = true;
      break;
    }
    case "already_connected": {
      alreadyConnected.value = true;
      break;
    }
    default: {
      setTimeout(() => {
        socket.connect();
      }, 10000);
    }
  }
}

export function setupSocket() {
  socket.on("connect", onConnect);
  socket.on("connect_error", onConnectError);
  socket.on("disconnect", onDisconnect);
}

export function shutdownSocket() {
  socket.off("connect", onConnect);
  socket.off("connect_error", onConnectError);
  socket.off("disconnect", onDisconnect);
}

function fetchInfo() {
  setInformation.fetchInformation();
}

function currentPlayerState(state: PlayerState) {
  playerState.value = state;
}

function newSetEvent() {
  if (isConnected.value) {
    fetchInfo();
  }
}
