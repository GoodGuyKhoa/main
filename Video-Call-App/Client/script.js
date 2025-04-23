const socket = io();
const roomId = "demo-room"; // Replace with dynamic later

socket.emit('join-room', roomId);
