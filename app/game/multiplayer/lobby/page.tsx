'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSocket, { RoomInfo } from '../../../lib/useSocket';

export default function MultiplayerLobby() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, roomInfo, createRoom, joinRoom, toggleReady, startGame, leaveRoom } = useSocket();

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

  // Handle creating a new room
  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

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

    try {
      setIsJoining(true);
      const result = await joinRoom(roomCode, username);
      if (result.success) {
        // Joined room successfully
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
      setError(null);
      await toggleReady();
    } catch (err) {
      console.error('Error toggling ready status', err);
      setError('Failed to update ready status');
    }
  };

  // Handle starting the game (host only)
  const handleStartGame = () => {
    setError(null);
    
    // Check if we can start the game
    if (!roomInfo || roomInfo.players.length < 2) {
      setError('Need at least 2 players to start');
      return;
    }
    
    if (!roomInfo.players.every(p => p.isReady)) {
      setError('All players must be ready to start');
      return;
    }
    
    setIsStarting(true);
    try {
      console.log('Requesting game start');
      startGame();
      // No need for the timeout - it's causing false negatives
      // The useEffect for roomInfo.gameState will handle the redirect
    } catch (err) {
      console.error('Error starting game', err);
      setError('Failed to start game');
      setIsStarting(false);
    }
  };

  // Handle leaving the current room
  const handleLeaveRoom = () => {
    leaveRoom();
  };

  // Check if current user is the host
  const isHost = roomInfo?.players.find(p => p.isHost)?.id === 
    roomInfo?.players.find(p => p.username === username)?.id;

  // Check if all players are ready
  const allPlayersReady = roomInfo?.players.every(p => p.isReady);

  // Redirect to game if the game has started
  useEffect(() => {
    if (roomInfo?.gameState === 'playing') {
      console.log('Game state changed to playing, redirecting to game room:', roomInfo.roomCode);
      setIsStarting(false); // Reset starting state before navigating
      router.push(`/game/multiplayer/${roomInfo.roomCode}`);
    }
  }, [roomInfo?.gameState, roomInfo?.roomCode, router]);
  
  // Effect to clear the starting state if it's been too long
  useEffect(() => {
    if (isStarting) {
      const timer = setTimeout(() => {
        setIsStarting(false);
      }, 10000); // Reset after 10 seconds if not redirected
      
      return () => clearTimeout(timer);
    }
  }, [isStarting]);

  // Render Start Game button
  const renderStartButton = () => {
    if (!isHost) return null;
    
    const disabled = roomInfo!.players.length < 2 || !allPlayersReady || isStarting;
    let buttonText = 'Start Game';
    
    if (isStarting) {
      buttonText = 'Starting...';
    } else if (roomInfo!.players.length < 2) {
      buttonText = 'Need More Players';
    } else if (!allPlayersReady) {
      buttonText = 'Waiting for Ready';
    }
    
    return (
      <button
        onClick={handleStartGame}
        disabled={disabled}
        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {buttonText}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">BlockBlast Multiplayer</h1>
      
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-md p-3 mb-6 w-full max-w-md">
          <p className="text-red-300">{error}</p>
        </div>
      )}
      
      {!isConnected ? (
        <div className="text-center">
          <p className="mb-4">Connecting to server...</p>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : !roomInfo ? (
        <div className="w-full max-w-md space-y-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium mb-1">
                Your Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-md border border-gray-600 text-white"
                placeholder="Enter your username"
              />
            </div>
            
            <button
              onClick={handleCreateRoom}
              className="w-full py-2 px-4 mb-3 bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Create New Game
            </button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 bg-gray-800 text-gray-400 text-sm">or join existing</span>
              </div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="roomCode" className="block text-sm font-medium mb-1">
                Room Code
              </label>
              <input
                type="text"
                id="roomCode"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 bg-gray-700 rounded-md border border-gray-600 text-white"
                placeholder="Enter room code"
              />
            </div>
            
            <button
              onClick={handleJoinRoom}
              disabled={isJoining}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </button>
          </div>
          
          <Link href="/" className="block text-center text-gray-400 hover:text-white">
            Back to Main Menu
          </Link>
        </div>
      ) : (
        <div className="w-full max-w-md bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Room: {roomInfo.roomCode}</h2>
            <p className="text-gray-400">Share this code with your opponent</p>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Players:</h3>
            <ul className="space-y-2">
              {roomInfo.players.map((player) => (
                <li key={player.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                  <div className="flex items-center space-x-2">
                    <span>{player.username}</span>
                    {player.isHost && (
                      <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded-full">Host</span>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded ${player.isReady ? 'bg-green-600' : 'bg-gray-600'}`}>
                    {player.isReady ? 'Ready' : 'Not Ready'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleToggleReady}
              disabled={isStarting}
              className={`flex-1 py-2 px-4 rounded-md ${
                roomInfo.players.find(p => p.username === username)?.isReady
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              } ${isStarting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {roomInfo.players.find(p => p.username === username)?.isReady
                ? 'Cancel Ready'
                : 'Ready Up'}
            </button>
            
            {renderStartButton()}
          </div>
          
          <button
            onClick={handleLeaveRoom}
            disabled={isStarting}
            className={`w-full mt-4 py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded-md ${
              isStarting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
} 