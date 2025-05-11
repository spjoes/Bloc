const http = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;

// Game rooms storage
const gameRooms = new Map();

// Helper function to generate room codes
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper to get room info (for sending to clients)
function getRoomInfo(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return null;
  
  return {
    roomCode,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      isReady: p.isReady,
      isHost: p.isHost,
    })),
    gameState: room.gameState,
  };
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server);
  
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Create a new game room
    socket.on('createRoom', ({ username }, callback) => {
      const roomCode = generateRoomCode();
      
      gameRooms.set(roomCode, {
        players: [{
          id: socket.id,
          username,
          isReady: false,
          isHost: true,
          board: null,
          score: 0,
          pieces: []
        }],
        gameState: 'waiting', // waiting, playing, finished
        currentPieces: null
      });
      
      socket.join(roomCode);
      socket.roomCode = roomCode;
      
      callback({ success: true, roomCode });
      
      io.to(roomCode).emit('roomUpdated', getRoomInfo(roomCode));
      console.log(`Room ${roomCode} created by ${username}`);
    });
    
    // Join an existing room
    socket.on('joinRoom', ({ roomCode, username }, callback) => {
      const normalizedRoomCode = roomCode.toUpperCase();
      const room = gameRooms.get(normalizedRoomCode);
      
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }
      
      if (room.gameState !== 'waiting') {
        callback({ success: false, error: 'Game already in progress' });
        return;
      }
      
      if (room.players.length >= 2) {
        callback({ success: false, error: 'Room is full' });
        return;
      }
      
      room.players.push({
        id: socket.id,
        username,
        isReady: false,
        isHost: false,
        board: null,
        score: 0,
        pieces: []
      });
      
      socket.join(normalizedRoomCode);
      socket.roomCode = normalizedRoomCode;
      
      callback({ success: true, roomCode: normalizedRoomCode });
      
      io.to(normalizedRoomCode).emit('roomUpdated', getRoomInfo(normalizedRoomCode));
      console.log(`${username} joined room ${normalizedRoomCode}`);
    });
    
    // Player ready status toggle
    socket.on('toggleReady', (callback) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !gameRooms.has(roomCode)) {
        callback({ success: false });
        return;
      }
      
      const room = gameRooms.get(roomCode);
      const player = room.players.find(p => p.id === socket.id);
      
      if (player) {
        // Toggle ready status
        player.isReady = !player.isReady;
        callback({ success: true, isReady: player.isReady });
        
        // Always update room info when ready status changes
        io.to(roomCode).emit('roomUpdated', getRoomInfo(roomCode));
      }
    });
    
    // Start the game (host only)
    socket.on('startGame', () => {
      const roomCode = socket.roomCode;
      if (!roomCode || !gameRooms.has(roomCode)) {
        console.log(`Failed to start game: Invalid room code ${roomCode}`);
        return;
      }
      
      const room = gameRooms.get(roomCode);
      const player = room.players.find(p => p.id === socket.id);
      
      console.log(`Start game requested by ${player?.username} for room ${roomCode}`);
      console.log(`Host check: ${player?.isHost}, Players: ${room.players.length}, All ready: ${room.players.every(p => p.isReady)}`);
      
      if (player && player.isHost && room.players.length > 1 && room.players.every(p => p.isReady)) {
        startGame(roomCode);
      } else {
        console.log('Start game conditions not met');
      }
    });
    
    // Update game state after piece placement
    socket.on('updateGameState', ({ board, score, piecesUsed }) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !gameRooms.has(roomCode)) return;
      
      const room = gameRooms.get(roomCode);
      const player = room.players.find(p => p.id === socket.id);
      
      if (player && room.gameState === 'playing') {
        player.board = board;
        player.score = score;
        
        // Update other players
        io.to(roomCode).emit('opponentUpdated', {
          playerId: socket.id,
          board,
          score
        });
      }
    });
    
    // Handle game over for a player
    socket.on('gameOver', () => {
      const roomCode = socket.roomCode;
      if (!roomCode || !gameRooms.has(roomCode)) return;
      
      const room = gameRooms.get(roomCode);
      const player = room.players.find(p => p.id === socket.id);
      
      if (player) {
        player.gameOver = true;
        
        // Check if all players are done
        if (room.players.every(p => p.gameOver)) {
          room.gameState = 'finished';
          
          // Determine winner
          const winner = [...room.players].sort((a, b) => b.score - a.score)[0];
          
          io.to(roomCode).emit('gameFinished', {
            winnerId: winner.id,
            winnerName: winner.username,
            players: room.players.map(p => ({
              id: p.id,
              username: p.username,
              score: p.score
            }))
          });
        }
      }
    });
    
    // Leave room
    socket.on('leaveRoom', () => {
      handlePlayerDisconnect(socket);
    });
    
    // Get room info
    socket.on('getRoomInfo', ({ roomCode }, callback) => {
      console.log(`Room info requested for ${roomCode}`);
      const normalizedRoomCode = roomCode.toUpperCase();
      const roomInfo = getRoomInfo(normalizedRoomCode);
      
      // Check if player is part of this room
      const isPlayerInRoom = roomInfo?.players.some(p => p.id === socket.id);
      
      if (roomInfo && isPlayerInRoom) {
        // If player is part of the room but socket.roomCode isn't set correctly, fix it
        if (socket.roomCode !== normalizedRoomCode) {
          socket.roomCode = normalizedRoomCode;
          socket.join(normalizedRoomCode);
          console.log(`Reconnected player ${socket.id} to room ${normalizedRoomCode}`);
        }
        
        callback({ success: true, roomInfo });
      } else {
        console.log(`Room info request failed: room ${normalizedRoomCode} not found or player not in room`);
        callback({ success: false });
      }
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      handlePlayerDisconnect(socket);
    });
  });
  
  // Function to start a game
  function startGame(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) {
      console.log(`Cannot start game: room ${roomCode} not found`);
      return;
    }
    
    console.log(`Starting game in room ${roomCode}`);
    room.gameState = 'playing';
    
    // Generate random pieces - create actual pieces instead of empty array
    let sharedPieces = generateInitialPieces();
    room.currentPieces = sharedPieces; // Store pieces in room state
    
    console.log(`Game started in room ${roomCode} with ${sharedPieces.length} pieces`);
    
    // Validate pieces before sending
    if (!sharedPieces || sharedPieces.length === 0) {
      console.log('Warning: No pieces generated, falling back to default piece set');
      // Use a default piece set if generation failed
      sharedPieces = [
        {
          id: Date.now(),
          shape: [[1,1], [1,1]], // Simple square
          color: 'blue'
        },
        {
          id: Date.now() + 1,
          shape: [[1,1,1], [0,1,0]], // T shape
          color: 'green'
        },
        {
          id: Date.now() + 2,
          shape: [[1,1,1,1]], // Line
          color: 'red'
        }
      ];
    }
    
    // Get updated room info to send with the event
    const updatedRoomInfo = getRoomInfo(roomCode);
    
    // Notify all players that game has started and send initial pieces
    io.to(roomCode).emit('gameStarted', {
      roomInfo: updatedRoomInfo,
      initialPieces: sharedPieces
    });
    
    // Also emit a roomUpdated event to ensure clients update their state
    io.to(roomCode).emit('roomUpdated', updatedRoomInfo);
    
    // Log for debugging
    console.log('Emitted gameStarted event with roomInfo:', 
      JSON.stringify({ roomCode, gameState: updatedRoomInfo.gameState }),
      'and pieces:', 
      JSON.stringify(sharedPieces.map(p => ({ id: p.id, shape: p.shape.length + 'x' + p.shape[0].length })))
    );
  }
  
  // Helper function to generate initial game pieces
  function generateInitialPieces() {
    // Generate 3 random pieces
    const pieces = [];
    for (let i = 0; i < 3; i++) {
      const shapes = [
        [[1,1,1], [0,1,0]], // T shape
        [[1,1], [1,1]], // Square
        [[1,1,1,1]], // Line
        [[1,1,0], [0,1,1]], // Z shape
        [[0,1,1], [1,1,0]], // S shape
        [[1,0], [1,0], [1,1]], // L shape
        [[0,1], [0,1], [1,1]] // J shape
      ];
      
      const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
      const colors = ['blue', 'green', 'red', 'purple', 'orange', 'teal', 'yellow'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      pieces.push({
        id: Date.now() + i,
        shape: randomShape,
        color: randomColor
      });
    }
    return pieces;
  }
  
  // Handle player disconnect or leaving
  function handlePlayerDisconnect(socket) {
    const roomCode = socket.roomCode;
    if (!roomCode || !gameRooms.has(roomCode)) return;
    
    const room = gameRooms.get(roomCode);
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    
    if (playerIndex !== -1) {
      const isHost = room.players[playerIndex].isHost;
      const disconnectedPlayerName = room.players[playerIndex].username;
      room.players.splice(playerIndex, 1);
      
      // If there are no players left, delete the room
      if (room.players.length === 0) {
        gameRooms.delete(roomCode);
      } else {
        // If the host left, assign a new host
        if (isHost && room.players.length > 0) {
          room.players[0].isHost = true;
        }
        
        // If game was in progress, abort it
        if (room.gameState === 'playing') {
          room.gameState = 'waiting';
          io.to(roomCode).emit('gameAborted', {
            reason: `${disconnectedPlayerName} disconnected`
          });
        }
        
        // Notify remaining players
        io.to(roomCode).emit('playerLeft', {
          playerId: socket.id,
          roomInfo: getRoomInfo(roomCode)
        });
      }
    }
    
    // Leave the socket.io room
    socket.leave(roomCode);
    socket.roomCode = null;
  }
  
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
}); 