import { Socket } from "socket.io";
import { User } from "./user";

/**
 * Simple class to keep track of users.
 */
export class UserManager {
    #connectedUsers;
    #userSocket;

    constructor() {
        this.#connectedUsers = new Map<number, User>();
        this.#userSocket = new Map<number, Socket>();
    }

    /**
     *
     * @param `User` from the session
     */
    setUser(user: User, socket: Socket) {
        this.#connectedUsers.set(user.Id, user);
        this.#userSocket.set(user.Id, socket)
    }

    /**
     *
     * @param `User` from the session
     */
    removeUser(user: User) {
        this.#connectedUsers.delete(user.Id);
        this.#userSocket.delete(user.Id);
    }

    /**
     *
     * @param `User` from the session
     */
    isConnected(user: User) {
        return this.#connectedUsers.has(user.Id);
    }

    getSocket(userId: number) {
        return this.#userSocket.get(userId);
    }
}
