import { io } from "socket.io-client";
import { bootstrap } from "../../bootstrap";
import { getCSRFToken } from "../../csrftoken";

export const socket = io({
    auth: async (cb) => {
        const csrfToken = await getCSRFToken();
        cb({
            csrftoken: csrfToken,
            authorization: `Bearer ${bootstrap.auth?.access_token}`,
        });
    },
    withCredentials: true,
    autoConnect: false,
    timeout: 20000,
});
