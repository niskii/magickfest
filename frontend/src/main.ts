// import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createApp } from "vue";
import App from "./App.vue";
import logger from "./logger";
import "./style.css";

const clientID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const isOnDiscord = window.location.hostname.includes(clientID);
let auth;

if (isOnDiscord) {
  try {
    const DiscordSDK = await import("@discord/embedded-app-sdk");
    // Instantiate the SDK
    const discordSdk = new DiscordSDK.DiscordSDK(clientID);

    await setupDiscordSdk();
    logger.info("Discord SDK is ready");

    async function setupDiscordSdk() {
      await discordSdk.ready();

      // Authorize with Discord Client
      const { code } = await discordSdk.commands.authorize({
        client_id: clientID,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify", "guilds", "guilds.members.read"],
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
      }).then();

      const { access_token } = await response.json();

      // Authenticate with Discord client (using the access_token)
      auth = await discordSdk.commands.authenticate({
        access_token,
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
      });
    }
  } catch (err) {
    logger.info("Could not authenticate!", err);
    // TODO: Display fatal error and require retry.
  }
}

createApp(App).mount("#app");
