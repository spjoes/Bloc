import type { NextApiRequest, NextApiResponse } from 'next';
import { NextResponse } from 'next/server';
import { Server as SocketIO } from 'socket.io';

// Store for global socket instance - needed because Vercel's serverless functions
// won't keep in-memory state between invocations
let io: SocketIO | null = null;
// Global Map to store rooms - this is reset on Vercel's serverless environment on each deployment!
// For production, you would need to use a database or Redis to persist this data
const rooms = new Map();

export async function GET(req: Request) {
  // Return a simple status for health checks
  if (!io) {
    return new NextResponse('Socket.io server not initialized yet. Use POST to initialize.', { 
      status: 200
    });
  }
  
  return new NextResponse('Socket.io server is running', { status: 200 });
}

// This endpoint is used to initialize the Socket.IO server
export async function POST(req: Request) {
  try {
    // For App Router in Next.js 13/14, we need a different approach with socket.io
    // In a serverless environment like Vercel, this will be recreated on each request
    
    // We'll setup the socket server if it's not already set up
    if (!io) {
      console.log('Initializing new Socket.IO server');
      
      // Create socket.io instance with appropriate CORS
      io = new SocketIO({
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
          credentials: true
        },
        path: '/api/socket/io',
        // Add these options to help with Vercel's environment
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
      });
      
      // Initialize the socket server - add all event handlers
      initSocketServer(io);
      
      console.log('Socket.IO server initialized successfully');
    } else {
      console.log('Using existing Socket.IO server instance');
    }
    
    // Return a simple 200 response to indicate the socket server is running
    return new NextResponse(JSON.stringify({ 
      success: true, 
      message: 'Socket.IO server initialized',
      timestamp: new Date().toISOString()
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Socket initialization error:', err);
    return new NextResponse(JSON.stringify({ 
      success: false, 
      message: 'Error initializing Socket.IO server',
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

function initSocketServer(io: SocketIO) {
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
  
  // Define standard Tetris-like pieces with consistent structure
  const shapes = [
    { shape: [[1,1,1], [0,1,0]], color: 'purple' }, // T shape
    { shape: [[1,1], [1,1]], color: 'yellow' }, // Square
    { shape: [[1,1,1,1]], color: 'cyan' }, // Line
    { shape: [[1,1,0], [0,1,1]], color: 'red' }, // Z shape
    { shape: [[0,1,1], [1,1,0]], color: 'green' }, // S shape
    { shape: [[1,0], [1,0], [1,1]], color: 'orange' }, // L shape
    { shape: [[0,1], [0,1], [1,1]], color: 'blue' }, // J shape
    { shape: [[1]], color: 'teal' }, // 1x1 piece
    { shape: [[1,1]], color: 'pink' }, // 2x1 horizontal piece
    { shape: [[1],[1]], color: 'brown' } // 2x1 vertical piece
  ];
  
  for (let i = 0; i < count; i++) {
    // Select a random piece from the predefined shapes
    const randomPiece = shapes[Math.floor(Math.random() * shapes.length)];
    
    pieces.push({
      id: Date.now() + i, // Ensure unique IDs
      shape: randomPiece.shape,
      color: randomPiece.color
    });
  }
  
  return pieces;
} 