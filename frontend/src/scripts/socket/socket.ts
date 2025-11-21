import { io } from "socket.io-client";

export const socket = io("https://localhost:8080", {
  extraHeaders: {
    authentication: "1234",
  },
  withCredentials: true,

  autoConnect: false,
  timeout: 20000,
});

socket.on("connect_error", () => {
  socket.disconnect();
});
