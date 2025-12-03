import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

import { DiscordSDK } from "@discord/embedded-app-sdk";

let auth;

try {
  // Instantiate the SDK
  const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

  setupDiscordSdk().then(() => {
    console.log("Discord SDK is ready");
  });

  async function setupDiscordSdk() {
    await discordSdk.ready();

    // Authorize with Discord Client
    const { code } = await discordSdk.commands.authorize({
      client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
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
    });

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token,
      }),
    });
  }
} catch (err) {
  console.log("Discord is not detected!");
}

createApp(App).mount("#app");
