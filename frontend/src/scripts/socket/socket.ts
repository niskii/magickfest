import { io } from "socket.io-client";
import { bootstrap } from "../../bootstrap";
import token from "../../csrftoken";

export const socket = io({
    auth: (cb) => {
        cb({ 
            csrftoken: token,
            authorization: `Bearer ${bootstrap.auth?.access_token}` 
        })
    },
    withCredentials: true,
    autoConnect: false,
    timeout: 20000,
});
