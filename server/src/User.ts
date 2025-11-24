export interface User {
  Name: string;
  Id: number;
  IsAdmin: boolean;
  Token: string | null;
}

function isUserAdmin(userRoles: string[]) {
  return userRoles.includes("892525015147380767");
}

export function createUserFromGuildMemberObject(guildUserData: any): User {
  return {
    Id: guildUserData.user.id,
    Name: guildUserData.user.username,
    IsAdmin: isUserAdmin(guildUserData.roles),
    Token: null,
  };
}
