import { io } from "socket.io-client";

export const socket = io({
  extraHeaders: {
    authentication: "1234",
  },
  withCredentials: true,

  autoConnect: false,
  timeout: 20000,
});
