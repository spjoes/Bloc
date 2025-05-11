import { NextApiRequest, NextApiResponse } from 'next';
import { Server as ServerIO } from 'socket.io';
import { NextApiResponseServerIO } from '../../../types/socket';

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO & NextApiResponse) {
  if (res.socket.server.io) {
    console.log('Socket is already running');
    res.status(200).json({ success: true, message: 'Socket is already running' });
    return;
  }
  
  console.log('Setting up Socket.IO server...');
  const io = new ServerIO(res.socket.server, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  
  res.socket.server.io = io;
  
  // Store room information
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle creating a new room
    socket.on('createRoom', ({ username }, callback) => {
      try {
        // Generate random room code
        const roomCode = generateRoomCode();
        
        // Create new room data
        const roomData = {
          roomCode,
          players: [{
            id: socket.id,
            username,
            isReady: false,
            isHost: true
          }],
          gameState: 'waiting'
        };
        
        // Store room data
        rooms.set(roomCode, roomData);
        
        // Join the socket room
        socket.join(roomCode);
        
        // Set roomCode on socket for easy reference
        socket.data.roomCode = roomCode;
        
        // Send room data to client
        io.to(roomCode).emit('roomUpdated', roomData);
        
        // Return success to caller
        callback({
          success: true,
          roomCode
        });
      } catch (err) {
        console.error('Error creating room:', err);
        callback({
          success: false,
          error: 'Failed to create room'
        });
      }
    });

    // Handle joining an existing room
    socket.on('joinRoom', ({ roomCode, username }, callback) => {
      try {
        // Check if room exists
        if (!rooms.has(roomCode)) {
          return callback({
            success: false,
            error: 'Room not found'
          });
        }
        
        // Get room data
        const roomData = rooms.get(roomCode);
        
        // Check if game is already in progress
        if (roomData.gameState === 'playing') {
          return callback({
            success: false,
            error: 'Game already in progress'
          });
        }
        
        // Check if room is full
        if (roomData.players.length >= 2) {
          return callback({
            success: false,
            error: 'Room is full'
          });
        }
        
        // Add player to room
        roomData.players.push({
          id: socket.id,
          username,
          isReady: false,
          isHost: false
        });
        
        // Update room data
        rooms.set(roomCode, roomData);
        
        // Join the socket room
        socket.join(roomCode);
        
        // Set roomCode on socket for easy reference
        socket.data.roomCode = roomCode;
        
        // Send updated room data to all clients in room
        io.to(roomCode).emit('roomUpdated', roomData);
        
        // Return success to caller
        callback({
          success: true,
          roomCode
        });
      } catch (err) {
        console.error('Error joining room:', err);
        callback({
          success: false,
          error: 'Failed to join room'
        });
      }
    });

    // Handle toggling ready status
    socket.on('toggleReady', (callback) => {
      try {
        // Get current room
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) {
          return callback({
            success: false,
            error: 'Room not found'
          });
        }
        
        // Get room data
        const roomData = rooms.get(roomCode);
        
        // Find player in room
        const player = roomData.players.find((p: any) => p.id === socket.id);
        if (!player) {
          return callback({
            success: false,
            error: 'Player not found in room'
          });
        }
        
        // Toggle ready status
        player.isReady = !player.isReady;
        
        // Update room data
        rooms.set(roomCode, roomData);
        
        // Send updated room data to all clients in room
        io.to(roomCode).emit('roomUpdated', roomData);
        
        // Return success to caller
        callback({
          success: true,
          isReady: player.isReady
        });
      } catch (err) {
        console.error('Error toggling ready:', err);
        callback({
          success: false,
          error: 'Failed to update ready status'
        });
      }
    });

    // Handle starting the game
    socket.on('startGame', () => {
      try {
        // Get current room
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;
        
        // Get room data
        const roomData = rooms.get(roomCode);
        
        // Check if player is host
        const player = roomData.players.find((p: any) => p.id === socket.id);
        if (!player || !player.isHost) return;
        
        // Check if all players are ready
        if (!roomData.players.every((p: any) => p.isReady)) return;
        
        // Update game state
        roomData.gameState = 'playing';
        rooms.set(roomCode, roomData);
        
        // Generate random pieces for all players
        const initialPieces = generateRandomPieces();
        
        // Send game started event to all clients in room
        io.to(roomCode).emit('gameStarted', {
          roomInfo: roomData,
          initialPieces
        });
      } catch (err) {
        console.error('Error starting game:', err);
      }
    });

    // Handle updating game state
    socket.on('updateGameState', ({ board, score, piecesUsed }) => {
      try {
        // Get current room
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;
        
        // Send update to other players in room
        socket.to(roomCode).emit('opponentUpdated', {
          playerId: socket.id,
          board,
          score
        });
      } catch (err) {
        console.error('Error updating game state:', err);
      }
    });

    // Handle game over
    socket.on('gameOver', () => {
      try {
        // Get current room
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;
        
        // Get room data
        const roomData = rooms.get(roomCode);
        
        // Find player who ended the game
        const player = roomData.players.find((p: any) => p.id === socket.id);
        if (!player) return;
        
        // Update game state
        roomData.gameState = 'finished';
        rooms.set(roomCode, roomData);
        
        // Send game over event to all clients in room
        io.to(roomCode).emit('gameFinished', {
          winnerId: player.id,
          winnerName: player.username
        });
      } catch (err) {
        console.error('Error handling game over:', err);
      }
    });

    // Handle leaving a room
    socket.on('leaveRoom', () => {
      try {
        // Get current room
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;
        
        handlePlayerDisconnect(socket);
      } catch (err) {
        console.error('Error leaving room:', err);
      }
    });

    // Handle getting room info
    socket.on('getRoomInfo', ({ roomCode }, callback) => {
      try {
        // Check if room exists
        if (!rooms.has(roomCode)) {
          return callback({
            success: false,
            error: 'Room not found'
          });
        }
        
        // Get room data
        const roomData = rooms.get(roomCode);
        
        // Join the socket room
        socket.join(roomCode);
        
        // Set roomCode on socket for easy reference
        socket.data.roomCode = roomCode;
        
        // Return room data to caller
        callback({
          success: true,
          roomInfo: roomData
        });
      } catch (err) {
        console.error('Error getting room info:', err);
        callback({
          success: false,
          error: 'Failed to get room info'
        });
      }
    });

    // Handle socket disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      handlePlayerDisconnect(socket);
    });

    // Helper function to handle player disconnect/leave
    function handlePlayerDisconnect(socket: any) {
      const roomCode = socket.data.roomCode;
      if (!roomCode || !rooms.has(roomCode)) return;
      
      // Get room data
      const roomData = rooms.get(roomCode);
      
      // Remove player from room
      const playerIndex = roomData.players.findIndex((p: any) => p.id === socket.id);
      if (playerIndex === -1) return;
      
      const isHost = roomData.players[playerIndex].isHost;
      roomData.players.splice(playerIndex, 1);
      
      // Leave the socket room
      socket.leave(roomCode);
      
      // Clear room reference from socket
      socket.data.roomCode = null;
      
      // If no players left, delete room
      if (roomData.players.length === 0) {
        rooms.delete(roomCode);
        return;
      }
      
      // If host left, assign new host
      if (isHost && roomData.players.length > 0) {
        roomData.players[0].isHost = true;
      }
      
      // Update room data
      rooms.set(roomCode, roomData);
      
      // Send updated room data to all clients in room
      io.to(roomCode).emit('playerLeft', {
        playerId: socket.id,
        roomInfo: roomData
      });
      
      // If game was in progress, abort it
      if (roomData.gameState === 'playing') {
        roomData.gameState = 'waiting';
        rooms.set(roomCode, roomData);
        
        io.to(roomCode).emit('gameAborted', {
          reason: 'A player disconnected'
        });
      }
    }
  });

  res.status(200).json({ success: true, message: 'Socket initialized' });
}

// Helper Functions
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomPieces(count = 3) {
  const pieces = [];
  
  for (let i = 0; i < count; i++) {
    const shapes = [
      [[1,1,1], [0,1,0]], // T shape
      [[1,1], [1,1]], // Square
      [[1,1,1,1]], // Line
      [[1,1,0], [0,1,1]], // Z shape
      [[0,1,1], [1,1,0]], // S shape
      [[1,0], [1,0], [1,1]], // L shape
      [[0,1], [0,1], [1,1]], // J shape
      [[1]], // 1x1 piece
      [[1,1]], // 2x1 horizontal piece
      [[1],[1]] // 2x1 vertical piece
    ];
    
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    const colors = ['blue', 'green', 'red', 'purple', 'orange', 'teal', 'yellow'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    pieces.push({
      id: Date.now() + i, // Ensure unique IDs
      shape: randomShape,
      color: randomColor
    });
  }
  
  return pieces;
} 