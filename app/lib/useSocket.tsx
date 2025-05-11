'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { PieceType } from '../components/GamePiece';

// Create a persistent socket instance outside the hook to prevent recreation
let socket: Socket | null = null;
// Also keep room info in a global variable to persist between page navigations
let globalRoomInfo: RoomInfo | null = null;
// Track if we've tried to initialize the socket server
let serverInitialized = false;

export type Player = {
  id: string;
  username: string;
  isReady: boolean;
  isHost: boolean;
  score?: number;
  board?: (number | null)[][];
};

export type RoomInfo = {
  roomCode: string;
  players: Player[];
  gameState: 'waiting' | 'playing' | 'finished';
};

export default function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(globalRoomInfo);
  const [error, setError] = useState<string | null>(null);

  // Helper to update both local and global room info
  const updateRoomInfo = useCallback((newRoomInfo: RoomInfo | null) => {
    console.log('Updating room info:', newRoomInfo);
    globalRoomInfo = newRoomInfo;
    setRoomInfo(newRoomInfo);
  }, []);

  // Function to initialize the socket server
  const initializeSocketServer = useCallback(async () => {
    try {
      setIsConnecting(true);
      console.log('Initializing socket server...');
      
      const res = await fetch('/api/socket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Add cache control to prevent caching
        cache: 'no-store'
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Failed to initialize socket server:', res.status, errorData);
        throw new Error(errorData.message || `Server returned ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Socket server initialization status:', data);
      serverInitialized = true;
      return true;
    } catch (err) {
      console.error('Failed to initialize socket server:', err);
      setError('Failed to connect to multiplayer server. Please try again later.');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    // Initialize socket connection if not already connected
    const setupSocket = async () => {
      if (socket) return; // Already have a socket instance
      
      try {
        // Get the appropriate socket URL based on environment
        const socketUrl = process.env.NODE_ENV === 'production' 
          ? window.location.origin
          : 'http://localhost:3000';
        
        console.log('Connecting to socket at:', socketUrl);
        
        // Configure socket with reconnection options
        socket = io(socketUrl, {
          path: '/api/socket/io',
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          autoConnect: false, // We'll connect manually after server init
          transports: ['polling', 'websocket'] // Prioritize polling on Vercel
        });

        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
          if (socket && !socket.connected) {
            console.warn('Socket connection timeout after 15 seconds');
            setError('Connection timeout. Please refresh the page and try again.');
          }
        }, 15000);

        // Initialize the socket server if not already done
        if (!serverInitialized) {
          const success = await initializeSocketServer();
          if (!success) {
            console.error('Failed to initialize socket server, not connecting socket');
            return;
          }
        }
        
        // Now connect the socket
        socket.connect();

        // Clear timeout when component unmounts
        return () => clearTimeout(connectionTimeout);
      } catch (err) {
        console.error('Error setting up socket:', err);
        setError('Failed to setup socket connection');
      }
    };
    
    setupSocket();

    // Set up event listeners if socket exists
    if (socket) {
      // Socket connection handlers
      function onConnect() {
        console.log('Socket connected');
        setIsConnected(true);
        setError(null);
      }

      function onDisconnect(reason: string) {
        console.log('Socket disconnected:', reason);
        // Only clear room info if it's a final disconnect
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          setIsConnected(false);
          updateRoomInfo(null);
        }
      }

      function onConnectError(err: Error) {
        console.error('Connection error:', err);
        setIsConnected(false);
        setError(`Connection error: ${err.message}`);
      }

      function onReconnectAttempt(attemptNumber: number) {
        console.log(`Socket reconnection attempt #${attemptNumber}`);
      }

      function onReconnect() {
        console.log('Socket reconnected');
        setIsConnected(true);
        setError(null);
      }

      function onReconnectError(error: Error) {
        console.error('Socket reconnection error:', error);
        setError('Failed to reconnect to the server. Please refresh the page.');
      }

      // Game event handlers
      function onRoomUpdated(updatedRoomInfo: RoomInfo) {
        console.log('Room updated:', updatedRoomInfo);
        updateRoomInfo(updatedRoomInfo);
      }

      function onPlayerLeft({ roomInfo }: { playerId: string, roomInfo: RoomInfo }) {
        console.log('Player left, new room info:', roomInfo);
        updateRoomInfo(roomInfo);
      }

      function onGameAborted({ reason }: { reason: string }) {
        console.log('Game aborted:', reason);
        setError(`Game aborted. ${reason}`);
      }
      
      function onGameStarted({ roomInfo, initialPieces }: { roomInfo: RoomInfo, initialPieces: PieceType[] }) {
        console.log('Game started event received in useSocket hook:', roomInfo);
        console.log('Initial pieces:', initialPieces);
        
        // Update the room info with the playing state
        if (roomInfo) {
          updateRoomInfo(roomInfo);
          
          // If we're on the lobby page, redirect to the game page
          if (typeof window !== 'undefined' && window.location.pathname.includes('/lobby')) {
            window.location.href = `/game/multiplayer/${roomInfo.roomCode}`;
          }
        }
      }

      // Subscribe to events
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('reconnect_attempt', onReconnectAttempt);
      socket.on('reconnect', onReconnect);
      socket.on('reconnect_error', onReconnectError);
      socket.on('roomUpdated', onRoomUpdated);
      socket.on('playerLeft', onPlayerLeft);
      socket.on('gameAborted', onGameAborted);
      socket.on('gameStarted', onGameStarted);
      
      // Check connection status immediately
      setIsConnected(socket.connected);

      // Cleanup function
      return () => {
        socket?.off('connect', onConnect);
        socket?.off('disconnect', onDisconnect);
        socket?.off('connect_error', onConnectError);
        socket?.off('reconnect_attempt', onReconnectAttempt);
        socket?.off('reconnect', onReconnect);
        socket?.off('reconnect_error', onReconnectError);
        socket?.off('roomUpdated', onRoomUpdated);
        socket?.off('playerLeft', onPlayerLeft);
        socket?.off('gameAborted', onGameAborted);
        socket?.off('gameStarted', onGameStarted);
      };
    }
  }, [updateRoomInfo, initializeSocketServer]);

  // Function to create a new game room
  const createRoom = useCallback((username: string) => {
    return new Promise<{ success: boolean, roomCode?: string, error?: string }>((resolve) => {
      if (!socket || !socket.connected) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }

      socket.emit('createRoom', { username }, (response: { success: boolean, roomCode?: string, error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // Function to join an existing room
  const joinRoom = useCallback((roomCode: string, username: string) => {
    return new Promise<{ success: boolean, roomCode?: string, error?: string }>((resolve) => {
      if (!socket || !socket.connected) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }

      socket.emit('joinRoom', { roomCode, username }, (response: { success: boolean, roomCode?: string, error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // Function to toggle ready status
  const toggleReady = useCallback(() => {
    return new Promise<{ success: boolean, isReady?: boolean }>((resolve) => {
      if (!socket || !socket.connected) {
        resolve({ success: false });
        return;
      }

      socket.emit('toggleReady', (response: { success: boolean, isReady?: boolean }) => {
        resolve(response);
      });
    });
  }, []);

  // Function to start the game (host only)
  const startGame = useCallback(() => {
    if (!socket || !socket.connected) {
      console.error('Cannot start game: Socket not connected');
      return false;
    }
    
    console.log('Emitting startGame event');
    socket.emit('startGame');
    return true;
  }, []);

  // Function to update game state after piece placement
  const updateGameState = useCallback((board: (number | null)[][], score: number, piecesUsed: number[]) => {
    if (!socket || !socket.connected) return;
    socket.emit('updateGameState', { board, score, piecesUsed });
  }, []);

  // Function to signal game over
  const signalGameOver = useCallback(() => {
    if (!socket || !socket.connected) return;
    socket.emit('gameOver');
  }, []);

  // Function to leave the current room
  const leaveRoom = useCallback(() => {
    if (!socket || !socket.connected) return;
    socket.emit('leaveRoom');
    updateRoomInfo(null);
  }, [updateRoomInfo]);

  // Function to reconnect to a specific room (used after page navigation)
  const reconnectToRoom = useCallback((roomCode: string) => {
    if (!socket || !socket.connected) {
      console.error('Cannot reconnect: Socket not connected');
      return false;
    }
    
    console.log(`Requesting current room info for ${roomCode}`);
    socket.emit('getRoomInfo', { roomCode }, (response: { success: boolean, roomInfo?: RoomInfo }) => {
      if (response.success && response.roomInfo) {
        console.log('Received room info on reconnect:', response.roomInfo);
        updateRoomInfo(response.roomInfo);
      } else {
        console.error('Failed to get room info');
      }
    });
    
    return true;
  }, [updateRoomInfo]);

  return {
    socket,
    isConnected,
    isConnecting,
    roomInfo,
    error,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    updateGameState,
    signalGameOver,
    leaveRoom,
    reconnectToRoom
  };
} 