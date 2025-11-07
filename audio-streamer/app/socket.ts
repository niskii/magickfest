import { io } from "socket.io-client";

export const socket = io(":8080", { autoConnect: false });
