import { io } from "socket.io-client";

export const socket = io("https://localhost:8080", {
  withCredentials: true,
  autoConnect: false,
  timeout: 20000,
});
