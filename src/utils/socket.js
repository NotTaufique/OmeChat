import {io} from "socket.io-client";

const socket = io('https://maskchat.onrender.com', {
    secure: true,
    path: '/socket.io/',
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});
