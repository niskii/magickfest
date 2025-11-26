import { User } from "./user";

export class UserManager {
  #connectedUsers;

  constructor() {
    this.#connectedUsers = new Map<number, User>();
  }

  setUser(user: User) {
    this.#connectedUsers.set(user.Id, user);
  }

  removeUser(user: User) {
    this.#connectedUsers.delete(user.Id);
  }

  isConnected(user: User) {
    return this.#connectedUsers.has(user.Id);
  }
}
