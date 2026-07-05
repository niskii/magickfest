import logger from "../../logger";
import { SetInfoFetcher, type SetInfo } from "./set-info-fetcher";
import { socket } from "./socket";
import { type PlayerState } from "@shared/types/player-state";

import { reactive, ref } from "vue";

export const playerState = ref<PlayerState>(null);

interface Store {
  isConnected: boolean;
  authToggle: boolean;
  alreadyConnected: boolean;
  setInformation: SetInfo;
}

const fetcher = new SetInfoFetcher(socket);

export const socketStore: Store = reactive({
  isConnected: socket.connected,
  setInformation: {},
  authToggle: false,
  alreadyConnected: false,
});

function onConnect() {
  socketStore.isConnected = true;
  fetchInfo();
  socket.emit("getPlayerState");

  socket.on("newSet", newSetEvent);
  socket.on("currentPlayerState", currentPlayerState);
}

function onDisconnect() {
  socket.off("newSet", newSetEvent);
  socket.off("currentPlayerState", currentPlayerState);
  playerState.value = null;
  socketStore.authToggle = false;
  socketStore.alreadyConnected = false;
  socketStore.isConnected = false;
}

function onConnectError(err: Error) {
  socket.disconnect();
  socketStore.isConnected = false;
  switch (err.message) {
    case "unauthorized": {
      socketStore.authToggle = true;
      break;
    }
    case "already_connected": {
      socketStore.alreadyConnected = true;
      break;
    }
    default: {
      setTimeout(() => {
        connect();
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

export function connect() {
  try {
    socket.connect();
  } catch (error) {
    logger.warn("Error connecting to server!");
  }
}

export function disconnect() {
  socket.removeAllListeners();
  socket.disconnect();
  socketStore.isConnected = false;
}

async function fetchInfo() {
  socketStore.setInformation = await fetcher.fetchInformation();
}

function currentPlayerState(state: PlayerState) {
  playerState.value = state;
}

function newSetEvent() {
  if (socketStore.isConnected) {
    fetchInfo();
  }
}
