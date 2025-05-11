'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSocket from '../../../lib/useSocket';

export default function MultiplayerLobby() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected, isConnecting, roomInfo, error: socketError, createRoom, joinRoom, toggleReady, startGame, leaveRoom } = useSocket();

  // Check for username in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUsername = localStorage.getItem('blockBlastUsername');
      if (savedUsername) {
        setUsername(savedUsername);
      }
    }
  }, []);

  // Save username to localStorage when it changes
  useEffect(() => {
    if (username && typeof window !== 'undefined') {
      localStorage.setItem('blockBlastUsername', username);
    }
  }, [username]);

  // Update local error state when socket error changes
  useEffect(() => {
    if (socketError) {
      setError(socketError);
    }
  }, [socketError]);

  // Handle creating a new room
  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!isConnected) {
      setError('Not connected to the server. Please try again.');
      return;
    }

    setError(null);
    setIsJoining(true);

    try {
      const result = await createRoom(username);
      if (result.success && result.roomCode) {
        // Room created successfully
        setError(null);
      } else {
        setError(result.error || 'Failed to create room');
      }
    } catch (err) {
      setError('Error creating room');
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  // Handle joining an existing room
  const handleJoinRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    if (!isConnected) {
      setError('Not connected to the server. Please try again.');
      return;
    }

    setError(null);
    setIsJoining(true);

    try {
      const result = await joinRoom(roomCode, username);
      if (result.success) {
        // Room joined successfully
        setError(null);
      } else {
        setError(result.error || 'Failed to join room');
      }
    } catch (err) {
      setError('Error joining room');
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  // Handle toggling ready status
  const handleToggleReady = async () => {
    try {
      const result = await toggleReady();
      if (!result.success) {
        setError('Failed to update ready status');
      }
    } catch (err) {
      setError('Error updating ready status');
      console.error(err);
    }
  };

  // Handle starting the game (host only)
  const handleStartGame = () => {
    setIsStarting(true);
    if (!startGame()) {
      setError('Failed to start the game');
      setIsStarting(false);
    }
  };

  // Handle leaving the room
  const handleLeaveRoom = () => {
    leaveRoom();
  };

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (isConnecting) {
      return <div className="text-yellow-500">Connecting to server...</div>;
    } else if (isConnected) {
      return <div className="text-green-500">Connected to server</div>;
    } else {
      return <div className="text-red-500">Not connected to server</div>;
    }
  };

  // Main lobby content
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Multiplayer Lobby</h1>
      
      {renderConnectionStatus()}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Room display or join/create form */}
      {roomInfo ? (
        <div className="bg-gray-100 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Room: {roomInfo.roomCode}</h2>
          
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">Players:</h3>
            <ul className="space-y-2">
              {roomInfo.players.map((player) => (
                <li key={player.id} className="flex items-center justify-between">
                  <div>
                    {player.username} {player.isHost && <span className="text-blue-500">(Host)</span>}
                  </div>
                  <div>
                    {player.isReady ? 
                      <span className="text-green-500">Ready</span> : 
                      <span className="text-red-500">Not Ready</span>
                    }
                  </div>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            {/* Show ready/unready button to all players */}
            <button
              onClick={handleToggleReady}
              className={`px-4 py-2 rounded ${
                roomInfo.players.find(p => p.id === socket?.id)?.isReady
                  ? 'bg-yellow-500 hover:bg-yellow-600'
                  : 'bg-green-500 hover:bg-green-600'
              } text-white font-semibold`}
              disabled={roomInfo.gameState !== 'waiting'}
            >
              {roomInfo.players.find(p => p.id === socket?.id)?.isReady ? 'Not Ready' : 'Ready'}
            </button>
            
            {/* Show start game button only to host */}
            {roomInfo.players.find(p => p.id === socket?.id)?.isHost && (
              <button
                onClick={handleStartGame}
                className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                disabled={
                  isStarting ||
                  roomInfo.gameState !== 'waiting' ||
                  roomInfo.players.length < 2 ||
                  !roomInfo.players.every(p => p.isReady)
                }
              >
                {isStarting ? 'Starting...' : 'Start Game'}
              </button>
            )}
            
            {/* Leave room button */}
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              Leave Room
            </button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Create room form */}
          <div className="bg-gray-100 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Create a Room</h2>
            <div className="mb-4">
              <label htmlFor="createUsername" className="block mb-2 font-medium">
                Your Username
              </label>
              <input
                id="createUsername"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                disabled={isJoining || !isConnected}
              />
            </div>
            <button
              onClick={handleCreateRoom}
              className="w-full px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-semibold"
              disabled={isJoining || !isConnected}
            >
              {isJoining ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          {/* Join room form */}
          <div className="bg-gray-100 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Join a Room</h2>
            <div className="mb-4">
              <label htmlFor="joinUsername" className="block mb-2 font-medium">
                Your Username
              </label>
              <input
                id="joinUsername"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                disabled={isJoining || !isConnected}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="roomCode" className="block mb-2 font-medium">
                Room Code
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter room code"
                maxLength={4}
                disabled={isJoining || !isConnected}
              />
            </div>
            <button
              onClick={handleJoinRoom}
              className="w-full px-4 py-2 rounded bg-green-500 hover:bg-green-600 text-white font-semibold"
              disabled={isJoining || !isConnected}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Home
        </Link>
      </div>
    </div>
  );
} 