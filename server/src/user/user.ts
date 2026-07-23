import { Socket } from "socket.io";
import { BufferingBalancer } from "../player/buffering-balancer";

export type UserType = {
    Name: string;
    Id: number;
    IsAdmin: boolean;
};

export class User {
    #socket: Socket;
    #bufferingBalancer: BufferingBalancer;

    constructor(socket: Socket) {
        this.#socket = socket;
        this.#bufferingBalancer = new BufferingBalancer();
    }

    getSocket() {
        return this.#socket;
    }

    getBufferingBalancer() {
        return this.#bufferingBalancer;
    }
}
