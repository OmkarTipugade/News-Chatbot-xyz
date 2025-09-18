// services/socket.service.js
const { Server } = require("socket.io");
const Actions = require("../utils/actions");

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTED_URL, // frontend
      methods: ["GET", "POST"],
    },
  });

  io.on(Actions.CONNECTION, (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Example event
    socket.on("message", (msg) => {
      console.log("Received:", msg);
      io.emit("message", `Server received: ${msg}`);
    });

    socket.emit("message", "Welcome to the WebSocket server!");
    socket.on('replay', (msg) => {
      console.log("Client says:", msg);
    });
    socket.emit('message', 'Hello How are hou?');
    socket.on('replay',(msg)=>{
        console.log("Client says:",msg);
    })
    socket.emit("message", "What is your name?");
});}

module.exports = { initializeSocket }
