const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

var userCount = 0; // number of users that have connected to the server since server started
const users = {}; // mapping between socket id and username
const rooms = io.of("/").adapter.rooms; // mapping between room name and set of socket ids
const sids = io.of("/").adapter.sids; // mapping between socket id and room name

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {

  //server assigns a username to the new user
  userCount++;
  var defaultUserName = `user${userCount}`;
  console.log(`${defaultUserName} connected.`);

  //welcome message: server should send a welcome message to the user
  socket.emit('chat message', `Welcome ${defaultUserName}. Pick a username and chat room to start chatting!`);

  //Join: server joins the client to the room and sends notifcation all connected clients in the room
  socket.on('join', (message) => {
    const [username, room] = message.split(",");

    if (sids.get(socket.id).has(socket.id)) { // leave default room socket.id
      socket.leave(socket.id);
    }

    if (sids.get(socket.id).size == 1) { // user is already in a room
      var previousRoom = sids.get(socket.id).values().next().value

      if (previousRoom === room && users[socket.id]["username"] === username) {
        return;
      }

      if (previousRoom === room && users[socket.id]["username"] !== username) {
        socket.emit('chat message', `NOTIFICATION: you changed your username from ${users[socket.id]["username"]} to ${username}.`); // send notification to client
        socket.to(room).emit('chat message', `NOTIFICATION: ${users[socket.id]["username"]} username is changed to ${username}.`); // send notification to all clients in room
        users[socket.id]["username"] = username
        return;
      }

      if (previousRoom !== room && users[socket.id]["username"] !== username) {
        socket.emit('chat message', `NOTIFICATION: you changed your username from ${users[socket.id]["username"]} to ${username}.`); // send notification to client
        users[socket.id]["username"] = username
      }

      socket.leave(previousRoom);
      socket.to(previousRoom).emit('chat message', `NOTIFICATION: ${users[socket.id]["username"]} has left the chat.`);
      socket.emit('chat message', `NOTIFICATION: ${username}, you have left ${previousRoom}.`); // send notification to client
    }

    // join new room
    socket.join(room);
    users[socket.id] = { "username": username, "room": room };
    socket.emit('chat message', `NOTIFICATION: ${username}, you have joined ${room}.`); // send notification to client
    io.to(room).emit('chat message', `NOTIFICATION: ${username} has joined the chat room.`); // send notification to all clients in room
    io.to(room).emit('chat message', getActiveUsersInTheRoom(room)); // send notification to all clients in room

    console.log(`${username} joined ${room}`);
  });

  //Disconnect: server sends a message to all connected clients in the room when a user disconnects from that room
  socket.on('disconnect', () => {
    if (users[socket.id] != undefined && rooms.has(users[socket.id]["room"])) {
      var room = users[socket.id]["room"];
      io.to(room).emit('chat message', `NOTIFICATION: ${users[socket.id]["username"]} has left the chat room.`);
      io.to(room).emit('chat message', getActiveUsersInTheRoom(room));
      delete users[socket.id];
    }
  });

  //Chat Message: server broadcast the message from a client to all connected clients in the room
  socket.on("chat message", (message) => {
    if (users[socket.id] != undefined) {
      var room = sids.get(socket.id).values().next().value;
      var username = users[socket.id]["username"];
      io.to(room).emit('chat message', `[${room}] ${username}: ${message}`);
    }
  });

});


function getActiveUsersInTheRoom(room) {
  const userItems = [];

  for (const key of rooms.get(room)) {
    userItems.push(`${users[key]["username"]}`);
  }

  return `NOTIFICATION: ${rooms.get(room).size} Active User(s) in ${room}: ` + userItems.join(",");
}

server.listen(3000, () => {
  console.log('listening on *:3000');
});