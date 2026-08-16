import { type PlayerState } from "@shared/types/player-state";
import logger from "../../logger";
import { SetInfoFetcher, type SetInfo } from "./set-info-fetcher";
import { socket } from "./socket";

import { reactive, ref } from "vue";
import { bootstrap } from "../../bootstrap";

export const playerState = ref<PlayerState>(null);

interface Store {
  isConnected: boolean;
  isReconnecting: boolean;
  authToggle: boolean;
  alreadyConnected: boolean;
  setInformation: SetInfo;
  numberOfUsers: number;
}

const fetcher = new SetInfoFetcher(socket);

export const socketStore: Store = reactive({
  isConnected: socket.connected,
  isReconnecting: false,
  setInformation: {},
  authToggle: false,
  alreadyConnected: false,
  numberOfUsers: 0,
});

function onConnect() {
  socketStore.isConnected = true;
  socketStore.isReconnecting = false;
  fetchInfo();
  socket.emit("getPlayerState");

  socket.on("newSet", newSetEvent);
  socket.on("currentPlayerState", currentPlayerState);
  socket.on("numberOfUsers", numberOfUsers)
}

function onDisconnect(reason: string) {
  logger.info("onDisconnect", reason)
  if (socket.active) {
    // temporary disconnection, the socket will automatically try to reconnect
    socketStore.isReconnecting = true;
  } else {
    // the connection was forcefully closed by the server or the client itself
    // in that case, `socket.connect()` must be manually called in order to reconnect
    socket.off("newSet", newSetEvent);
    socket.off("currentPlayerState", currentPlayerState);
    socket.off("numberOfUsers", numberOfUsers)
    socketStore.isConnected = false;
    socketStore.isReconnecting = false;
    playerState.value = null;
    socketStore.authToggle = false;
    socketStore.alreadyConnected = false;
  }
}

function onConnectError(err: Error) {
  logger.info(err)
  if (socket.active) {
    // socket.io will try to reconnect
    socketStore.isReconnecting = true;
    logger.info("Will attempt to reconnect")
  } else {
    logger.info("big ewwor")
    // forced
    socketStore.isConnected = false
    switch (err.message) {
      case "unauthorized": {
        socketStore.authToggle = true;
        break;
      }
      case "already_connected": {
        socketStore.alreadyConnected = true;
        break;
      }
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
    socket.io.opts.extraHeaders.authorization = `Bearer ${bootstrap.auth?.access_token}`
    socket.connect();
  } catch (error) {
    logger.warn("Error connecting to server!", error);
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

function numberOfUsers(size: number) {
  socketStore.numberOfUsers = size;
}
