// import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createApp } from "vue";
import App from "./App.vue";
import logger from "./logger";
import "./style.css";

const clientID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const isOnDiscord = window.location.hostname.includes(clientID);
let auth;

if (isOnDiscord) {
  const DiscordSDK = await import("@discord/embedded-app-sdk").catch((err) => {
    // TODO: Could not load the sdk dynamically
    throw new Error(err);
  });
  // Instantiate the SDK
  const discordSdk = new DiscordSDK.DiscordSDK(clientID);

  await setupDiscordSdk();
  logger.info("Discord SDK is ready");

  async function setupDiscordSdk() {
    await discordSdk.ready().catch((err) => {
      // TODO: The sdk could not setup
      throw new Error(err);
    });

    // Authorize with Discord Client
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
        throw new Error(err);
      });

    // Retrieve an access_token from your activity's server
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
      throw new Error(err);
    });

    const { access_token } = await response.json().catch((err) => {
      // TODO: could not parse the token provided from the server
      throw new Error(err);
    });

    // Authenticate with Discord client (using the access_token)
    auth = await discordSdk.commands
      .authenticate({
        access_token,
      })
      .catch((err) => {
        // TODO: the token provided from the server isn't accepted by Discord.
        throw new Error(err);
      });

    if (auth == null) {
      throw new Error("Authenticate command failed");
    }

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
      throw new Error(err);
    });
  }
}

createApp(App).mount("#app");
