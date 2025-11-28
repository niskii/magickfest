import { User } from "./user";

/**
 * Simple class to keep track of users.
 */
export class UserManager {
  #connectedUsers;

  constructor() {
    this.#connectedUsers = new Map<number, User>();
  }

  /**
   *
   * @param `User` from the session
   */
  setUser(user: User) {
    this.#connectedUsers.set(user.Id, user);
  }

  /**
   *
   * @param `User` from the session
   */
  removeUser(user: User) {
    this.#connectedUsers.delete(user.Id);
  }

  /**
   *
   * @param `User` from the session
   */
  isConnected(user: User) {
    return this.#connectedUsers.has(user.Id);
  }
}
