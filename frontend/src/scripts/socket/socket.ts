import { io } from "socket.io-client";
import token from "../../csrftoken";

export const socket = io({
    withCredentials: true,
    autoConnect: false,
    timeout: 20000,
    extraHeaders: {
        csrftoken: token,
        authorization: null,
    },
});
