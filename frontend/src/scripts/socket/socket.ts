import { io } from "socket.io-client";
import { bootstrap } from "../../bootstrap";
import { getCTRFToken } from "../../csrftoken";

export const socket = io({
    auth: async (cb) => {
        cb({
            csrftoken: await getCTRFToken(),
            authorization: `Bearer ${bootstrap.auth?.access_token}`,
        });
    },
    withCredentials: true,
    autoConnect: false,
    timeout: 20000,
});
