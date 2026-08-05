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
    return;
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
    await discordSdk.ready().catch((err: Error) => {
      // TODO: The sdk could not setup
      bootstrap.status = "error";
      bootstrap.error = `the sdk could not setup: ${err}`;
      throw('error');
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
        // TODO: could not authorize at Discord's end (most likely wrong activity id)
        bootstrap.status = "error";
        bootstrap.error = `could not authorize at Discord's end: ${err}`;
        throw('error');
      });

    // Retrieve an access_token from your activity's server
    bootstrap.step = "retrieving access token...";
    let response = await fetch("/api/auth/token", {
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
      throw('error');
    });

    if (response && !response.ok) {
        const text = await response.text()
        bootstrap.status = "error";
        bootstrap.error = `the backend server could not authenticate the user with the provided code: ${text}`;
        throw('error');
    }

    const { access_token } = await response.json().catch((err: Error) => {
      // TODO: could not parse the token provided from the server
      bootstrap.status = "error";
      bootstrap.error = `could not parse the token provided from the server: ${err}`;
      throw('error');
    });

    // Authenticate with Discord client (using the access_token)
    bootstrap.step = "authenticating...";
    auth = await discordSdk.commands
      .authenticate({
        access_token,
      })
      .catch((err: Error) => {
        // TODO: the token provided from the server isn't accepted by Discord.
        // throw new Error(err);
        bootstrap.status = "error";
        bootstrap.error = `the token provided from the server isn't accepted by Discord: ${err}`;
        throw('error');
      });

    if (auth == null) {
    //   throw new Error("Authenticate command failed");
        bootstrap.status = "error";
        bootstrap.error = `Authenticate command failed`;
        throw('error');
    }

    bootstrap.step = "starting session...";
    response = await fetch("/api/auth/startsession", {
    method: "POST",
    credentials: "include",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        access_token,
    }),
    }).catch((err) => {
        // throw new Error(err);
        bootstrap.status = "error";
        bootstrap.error = err
        throw('error');
    });

    if (response && !response.ok) {
        // TODO: Not member of group, discord error or couldn't save cookie!
        const text = await response.text()
        bootstrap.status = "error";
        bootstrap.error = `Not member of group, discord error or couldn't save cookie: ${text}`;
        throw('error');
    }
  }
}