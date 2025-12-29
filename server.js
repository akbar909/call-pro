const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// Serve static files (your HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Store active rooms and users
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-room', (roomId, userId, userName) => {
        console.log(`User ${userName} (${userId}) joining room ${roomId}`);
        
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        
        const room = rooms.get(roomId);
        room.set(userId, { id: userId, name: userName, socketId: socket.id });
        
        const existingUsers = Array.from(room.values()).filter(user => user.id !== userId);
        socket.emit('existing-users', existingUsers);
        
        socket.to(roomId).emit('user-connected', userId, userName);
        
        console.log(`Room ${roomId} now has ${room.size} users`);
    });

    socket.on('signal', (data) => {
        console.log(`Signaling from ${socket.id} to ${data.to}, type: ${data.type}`);
        io.to(data.to).emit('signal', {
            from: socket.id,
            type: data.type,
            offer: data.offer,
            answer: data.answer,
            candidate: data.candidate
        });
    });

    socket.on('chat-message', (roomId, message, senderName) => {
        console.log(`Chat message in room ${roomId} from ${senderName}: ${message}`);
        socket.to(roomId).emit('chat-message', message, senderName);
    });

    socket.on('typing', (roomId, userId, isTyping) => {
        socket.to(roomId).emit('typing', userId, isTyping);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        rooms.forEach((room, roomId) => {
            room.forEach((user, userId) => {
                if (user.socketId === socket.id) {
                    room.delete(userId);
                    socket.to(roomId).emit('user-disconnected', userId);
                    console.log(`User ${userId} disconnected from room ${roomId}`);
                    
                    if (room.size === 0) {
                        rooms.delete(roomId);
                        console.log(`Room ${roomId} is now empty and removed`);
                    }
                }
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
