import { reactive } from "vue";
import { getCTRFToken } from "./csrftoken";
import logger from "./logger";

export const bootstrap = reactive({
    status: "loading" as "loading" | "ready" | "error",
    step: "starting...",
    error: null as string,
    auth: null as any,
    layout: 0 as number,
    platform: null as string,
});

export async function bootstrapDiscord() {
    const clientID = import.meta.env.VITE_DISCORD_CLIENT_ID;
    const isOnDiscord = window.location.hostname.includes(clientID);
    let auth;

    if (!isOnDiscord) {
        bootstrap.status = "ready";
        bootstrap.auth = null;
        return;
    }

    bootstrap.step = "loading Discord SDK...";
    const DiscordSDK = await import("@discord/embedded-app-sdk").catch(
        (err) => {
            throw new Error(`could not load the SDK dynamically: ${err}`);
        },
    );

    // Instantiate the SDK
    bootstrap.step = "connecting to Discord...";
    const discordSdk = new DiscordSDK.DiscordSDK(clientID);

    await setupDiscordSdk();
    logger.info("Discord SDK is ready");

    bootstrap.status = "ready";
    bootstrap.auth = auth;

    async function setupDiscordSdk() {
        bootstrap.step = "setting up Discord SDK...";
        await discordSdk.ready().catch((err: Error) => {
            throw new Error(`the sdk could not setup: ${err}`);
        });

        // Authorize with Discord Client
        bootstrap.step = "authorizing...";
        const { code } = await discordSdk.commands
            .authorize({
                client_id: clientID,
                response_type: "code",
                state: "",
                prompt: "none",
                scope: ["identify", "guilds", "guilds.members.read"],
            })
            .catch((err: Error) => {
                throw new Error(`could not authorize at Discord's end: ${err}`);
            });

        // Retrieve an access_token from your activity's server
        bootstrap.step = "retrieving access token...";
        let response = await fetch("/api/auth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-csrf-token": await getCTRFToken(),
            },
            body: JSON.stringify({
                code,
            }),
        }).catch((err) => {
            bootstrap.status = "error";
            throw new Error(
                `the backend server could not authenticate the user with the provided code: ${err}`,
            );
        });

        if (response && !response.ok) {
            const text = await response.text();
            throw new Error(
                `the backend server could not authenticate the user with the provided code: ${text}`,
            );
        }

        const { access_token } = await response.json().catch((err: Error) => {
            throw new Error(
                `could not parse the token provided from the server: ${err}`,
            );
        });

        // Authenticate with Discord client (using the access_token)
        bootstrap.step = "authenticating...";
        auth = await discordSdk.commands
            .authenticate({
                access_token,
            })
            .catch((err: Error) => {
                throw new Error(
                    `the token provided from the server isn't accepted by Discord: ${err}`,
                );
            });

        if (auth == null) {
            throw new Error(`Authenticate command failed`);
        }

        bootstrap.step = "starting session...";
        response = await fetch("/api/auth/startsession", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "x-csrf-token": await getCTRFToken(),
            },
            body: JSON.stringify({
                access_token,
            }),
        }).catch((err) => {
            throw new Error(err);
        });

        if (response && !response.ok) {
            const text = await response.text();
            throw new Error(
                `Not member of group, discord error or couldn't save cookie: ${text}`,
            );
        }

        bootstrap.platform = discordSdk.platform;
        discordSdk.subscribe("ACTIVITY_LAYOUT_MODE_UPDATE", (event) => {
            bootstrap.layout = event.layout_mode;
        });
    }
}
