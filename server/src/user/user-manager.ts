import { Socket } from "socket.io";
import { User, UserType } from "./user";

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
    setUser(user: UserType, socket: Socket) {
        this.#connectedUsers.set(user.Id, new User(socket));
    }

    /**
     *
     * @param `User` from the session
     */
    removeUser(user: UserType) {
        this.#connectedUsers.delete(user.Id);
    }

    /**
     *
     * @param `User` from the session
     */
    isConnected(user: UserType) {
        return this.#connectedUsers.has(user.Id);
    }

    getUser(user: UserType) {
        return this.#connectedUsers.get(user.Id);
    }

    getSize() {
        return this.#connectedUsers.size
    }
}
