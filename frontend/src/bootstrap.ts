import logger from "./logger";
import { reactive } from "vue";

export const bootstrap = reactive({
  status: "loading" as "loading" | "ready" | "error",
  step: "starting...",
  error: null as Error | null,
  auth: null as any,
});

export async function bootstrapDiscord() {
  const clientID = import.meta.env.VITE_DISCORD_CLIENT_ID;
  const isOnDiscord = window.location.hostname.includes(clientID);
  let auth;

  if (!isOnDiscord) {
    bootstrap.status = "ready";
    bootstrap.auth = null;
  }

  bootstrap.step = "loading Discord SDK...";
  const DiscordSDK = await import("@discord/embedded-app-sdk").catch((err) => {
    // TODO: Could not load the sdk dynamically
    bootstrap.status = "error";
    bootstrap.error = `could not load the SDK dynamically: ${err}`;
  });
  // Instantiate the SDK
  bootstrap.step = "connecting to Discord...";
  const discordSdk = new DiscordSDK.DiscordSDK(clientID);

  await setupDiscordSdk();
  logger.info("Discord SDK is ready");

  bootstrap.status = "ready";
  bootstrap.auth = auth;

  async function setupDiscordSdk() {
    bootstrap.step = "setting up Discord SDK...";
    await discordSdk.ready().catch((err) => {
      // TODO: The sdk could not setup
      bootstrap.status = "error";
      bootstrap.error = `the sdk could not setup: ${err}`;
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
      .catch((err) => {
        // TODO: could not authorize at Discord's end (most likely wrong activity id)
        bootstrap.status = "error";
        bootstrap.error = `could not authorize at Discord's end: ${err}`;
      });

    // Retrieve an access_token from your activity's server
    bootstrap.step = "retrieving access token...";
    const response = await fetch("/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
      }),
    }).catch((err) => {
      // TODO: the backend server could not authenticate the user with the provided code.
      bootstrap.status = "error";
      bootstrap.error = `the backend server could not authenticate the user with the provided code: ${err}`;
    });

    const { access_token } = await response.json().catch((err) => {
      // TODO: could not parse the token provided from the server
      bootstrap.status = "error";
      bootstrap.error = `could not parse the token provided from the server: ${err}`;
    });

    // Authenticate with Discord client (using the access_token)
    bootstrap.step = "authenticating...";
    auth = await discordSdk.commands
      .authenticate({
        access_token,
      })
      .catch((err) => {
        // TODO: the token provided from the server isn't accepted by Discord.
        // throw new Error(err);
        bootstrap.status = "error";
        bootstrap.error = `the token provided from the server isn't accepted by Discord: ${err}`;
      });

    if (auth == null) {
    //   throw new Error("Authenticate command failed");
        bootstrap.status = "error";
        bootstrap.error = `Authenticate command failed`;
    }

    bootstrap.step = "starting session...";
    await fetch("/api/auth/startsession", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token,
      }),
    }).catch((err) => {
      // TODO: Not member of group, discord error or couldn't save cookie!
      // throw new Error(err);
      bootstrap.status = "error";
      bootstrap.error = `Not member of group, discord error or couldn't save cookie: ${err}`;
    });
  }
}