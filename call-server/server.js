const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for testing
    methods: ["GET", "POST"]
  }
});

// Store active rooms and users
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Join a room
  socket.on('join-room', (roomId, userId, userName) => {
    console.log(`${userName} (${socket.id}) joining room: ${roomId}`);
    
    socket.join(roomId);
    
    // Add user to room tracking - Use Map instead of Set
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket.id, { name: userName });
    
    // Notify others in the room - send socket.id as userId
    socket.to(roomId).emit('user-connected', socket.id, userName);
    
    // Send list of existing users to the new user
    const existingUsers = [];
    rooms.get(roomId).forEach((user, socketId) => {
      if (socketId !== socket.id) {
        existingUsers.push({ id: socketId, name: user.name });
      }
    });
    
    socket.emit('existing-users', existingUsers);
  });
  
  // Relay WebRTC signaling messages
  socket.on('signal', (data) => {
    console.log('Relaying signal from', socket.id, 'to', data.to, 'type:', data.type);
    io.to(data.to).emit('signal', {
      type: data.type,
      from: socket.id,
      offer: data.offer,
      answer: data.answer,
      candidate: data.candidate
    });
  });
  
  // Handle chat messages
  socket.on('chat-message', (roomId, message, userName) => {
    socket.to(roomId).emit('chat-message', message, userName);
  });
  
  // Handle typing indicator
  socket.on('typing', (roomId, userId, isTyping) => {
    socket.to(roomId).emit('typing', userId, isTyping);
  });
  
  // Handle disconnection at root level
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from all rooms
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(roomId).emit('user-disconnected', socket.id);
        
        // Delete room if empty
        if (users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Signaling server running on port ${PORT}`);
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`📡 Network: http://192.168.18.4:${PORT}`);
  console.log(`🌐 Access from other devices using your network IP`);
});