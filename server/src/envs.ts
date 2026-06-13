export const getDiscordEnvironment = () => {
  const env = process.env;

  if (
    !env.DiscordClientID ||
    !env.DiscordClientSecret ||
    !env.DiscordAppToken ||
    !env.DiscordGuildID ||
    !env.DiscordAdminRole ||
    !env.DiscordRedirectUrl
  ) {
    throw new Error("You must set all the environment variables!");
  }

  return {
    DiscordClientID: env.DiscordClientID,
    DiscordClientSecret: env.DiscordClientSecret,
    DiscordAppToken: env.DiscordAppToken,
    DiscordGuildID: env.DiscordGuildID,
    DiscordAdminRole: env.DiscordAdminRole,
    DiscordRedirectUrl: env.DiscordRedirectUrl,
    DiscordURL: new URL(`https://${env.DiscordClientID}.discordsays.com`),
  };
};
