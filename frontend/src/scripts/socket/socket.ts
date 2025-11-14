import { io } from "socket.io-client";

export const socket = io("https://localhost:8080", {
  extraHeaders: {
    authentication: "1234",
  },
  autoConnect: false,
  timeout: 20000,
});
