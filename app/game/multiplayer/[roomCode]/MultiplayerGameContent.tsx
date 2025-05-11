'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GameBoard from '../../../components/GameBoard';
import GamePiece, { PieceType } from '../../../components/GamePiece';
import { 
  generateRandomPieces, 
  createEmptyBoard, 
  canPlacePiece, 
  placePiece,
  checkCompletedLines,
  calculateScore,
  canMakeAnyMove
} from '../../../lib/pieces';
import useSocket from '../../../lib/useSocket';

type GameStatus = 'waiting' | 'playing' | 'gameOver' | 'disconnected';

interface MultiplayerGameContentProps {
  roomCode: string;
}

export default function MultiplayerGameContent({ roomCode }: MultiplayerGameContentProps) {
  const router = useRouter();
  const { isConnected, roomInfo, socket, updateGameState, signalGameOver, leaveRoom } = useSocket();
  
  const [board, setBoard] = useState<(number | null)[][]>(createEmptyBoard());
  const [pieces, setPieces] = useState<PieceType[]>([]);
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(null);
  const [, setDraggedPieceIndex] = useState<number | null>(null);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<PieceType | null>(null);
  const [grabOffsetX, setGrabOffsetX] = useState<number>(0);
  const [grabOffsetY, setGrabOffsetY] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [comboCount, setComboCount] = useState<number>(0);
  const [showCombo, setShowCombo] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [opponentBoard, setOpponentBoard] = useState<(number | null)[][]>(createEmptyBoard());
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [initialPieces, setInitialPieces] = useState<PieceType[]>([]);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Effect to handle game start
  useEffect(() => {
    if (!socket) return;
    
    function onGameStarted({ initialPieces }: { roomInfo: Record<string, unknown>, initialPieces: PieceType[] }) {
      setGameStatus('playing');
      // Use the same pieces for all players
      if (initialPieces && initialPieces.length > 0) {
        setInitialPieces(initialPieces);
      } else {
        // If no pieces provided, generate our own
        setPieces(generateRandomPieces());
      }
    }
    
    function onOpponentUpdated({ playerId, board, score }: { playerId: string, board: (number | null)[][], score: number }) {
      if (socket && playerId !== socket.id) {
        setOpponentBoard(board);
        setOpponentScore(score);
      }
    }
    
    function onGameFinished({ winnerName }: { winnerId: string, winnerName: string }) {
      setGameStatus('gameOver');
      setWinnerName(winnerName);
    }
    
    function onGameAborted({ reason }: { reason: string }) {
      setErrorMessage(reason || 'Game was aborted');
      setGameStatus('disconnected');
    }
    
    // Set up event listeners
    socket.on('gameStarted', onGameStarted);
    socket.on('opponentUpdated', onOpponentUpdated);
    socket.on('gameFinished', onGameFinished);
    socket.on('gameAborted', onGameAborted);
    
    // Clean up event listeners
    return () => {
      socket.off('gameStarted', onGameStarted);
      socket.off('opponentUpdated', onOpponentUpdated);
      socket.off('gameFinished', onGameFinished);
      socket.off('gameAborted', onGameAborted);
    };
  }, [socket]);
  
  // Effect to initialize game when started
  useEffect(() => {
    if (gameStatus === 'playing' && initialPieces.length > 0) {
      setPieces(initialPieces);
    }
  }, [gameStatus, initialPieces]);
  
  // Effect to manage combo display animation
  useEffect(() => {
    if (comboCount > 1) {
      setShowCombo(true);
      const timer = setTimeout(() => {
        setShowCombo(false);
      }, 1500); // Hide combo display after 1.5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [comboCount]);
  
  // Helper to find current player in room
  const currentPlayer = roomInfo?.players.find(
    p => p.id === socket?.id
  );
  
  // Helper to find opponent in room
  const opponent = roomInfo?.players.find(
    p => p.id !== socket?.id
  );
  
  // Handle piece drag start
  const handlePieceDragStart = (piece: PieceType, offsetX: number, offsetY: number) => {
    const index = pieces.findIndex(p => p.id === piece.id);
    setDraggedPieceIndex(index);
    setCurrentDraggedPiece(piece);
    setGrabOffsetX(offsetX);
    setGrabOffsetY(offsetY);
  };

  // Add event listener for drag end
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setCurrentDraggedPiece(null);
    };
    
    window.addEventListener('dragend', handleGlobalDragEnd);
    
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);

  // Handle piece drop on the board
  const handlePieceDrop = (pieceId: number, row: number, col: number) => {
    if (gameStatus !== 'playing') return;
    
    const pieceIndex = pieces.findIndex(p => p.id === pieceId);
    if (pieceIndex === -1) return;
    
    const piece = pieces[pieceIndex];
    
    if (canPlacePiece(board, piece, row, col)) {
      // Place the piece on the board
      const updatedBoard = placePiece(board, piece, row, col);
      
      // Check for completed lines
      const { clearedBoard, linesCleared } = checkCompletedLines(updatedBoard);
      
      // Update combo counter
      if (linesCleared > 0) {
        setComboCount(prev => prev + 1);
      } else {
        setComboCount(0);
      }
      
      // Calculate points earned with combo multiplier
      const pointsEarned = calculateScore(linesCleared, linesCleared > 0 ? comboCount + 1 : 0);
      
      // Update the board
      setBoard(clearedBoard);
      
      // Remove the used piece
      const updatedPieces = [...pieces];
      updatedPieces.splice(pieceIndex, 1);
      
      // If no pieces left, generate new ones
      if (updatedPieces.length === 0) {
        const newPieces = generateRandomPieces();
        setPieces(newPieces);
        
        // Check if game is over with new pieces
        if (!canMakeAnyMove(clearedBoard, newPieces)) {
          setGameStatus('gameOver');
          signalGameOver();
        }
      } else {
        setPieces(updatedPieces);
        
        // Check if game is over with remaining pieces
        if (!canMakeAnyMove(clearedBoard, updatedPieces)) {
          setGameStatus('gameOver');
          signalGameOver();
        }
      }
      
      // Reset selected piece
      setSelectedPieceIndex(null);
      setDraggedPieceIndex(null);
      setCurrentDraggedPiece(null);
      
      // Update score
      const newScore = score + pointsEarned;
      setScore(newScore);
      
      // Send update to server
      updateGameState(clearedBoard, newScore, [piece.id]);
    }
  };
  
  // Handle piece selection using click
  const handlePieceClick = (index: number) => {
    if (gameStatus !== 'playing') return;
    setSelectedPieceIndex(index);
  };
  
  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (selectedPieceIndex === null || gameStatus !== 'playing') return;
    
    const selectedPiece = pieces[selectedPieceIndex];
    
    if (canPlacePiece(board, selectedPiece, row, col)) {
      // Place the piece on the board
      const updatedBoard = placePiece(board, selectedPiece, row, col);
      
      // Check for completed lines
      const { clearedBoard, linesCleared } = checkCompletedLines(updatedBoard);
      
      // Update combo counter
      if (linesCleared > 0) {
        setComboCount(prev => prev + 1);
      } else {
        setComboCount(0);
      }
      
      // Calculate points earned with combo multiplier
      const pointsEarned = calculateScore(linesCleared, linesCleared > 0 ? comboCount + 1 : 0);
      
      // Update the board
      setBoard(clearedBoard);
      
      // Remove the used piece
      const updatedPieces = [...pieces];
      updatedPieces.splice(selectedPieceIndex, 1);
      
      // If no pieces left, generate new ones
      if (updatedPieces.length === 0) {
        const newPieces = generateRandomPieces();
        setPieces(newPieces);
        
        // Check if game is over with new pieces
        if (!canMakeAnyMove(clearedBoard, newPieces)) {
          setGameStatus('gameOver');
          signalGameOver();
        }
      } else {
        setPieces(updatedPieces);
        
        // Check if game is over with remaining pieces
        if (!canMakeAnyMove(clearedBoard, updatedPieces)) {
          setGameStatus('gameOver');
          signalGameOver();
        }
      }
      
      // Reset selected piece
      setSelectedPieceIndex(null);
      
      // Update score
      const newScore = score + pointsEarned;
      setScore(newScore);
      
      // Send update to server
      updateGameState(clearedBoard, newScore, [selectedPiece.id]);
    }
  };
  
  // Handle returning to the lobby
  const handleReturnToLobby = () => {
    leaveRoom();
    router.push('/game/multiplayer/lobby');
  };
  
  // Helper to get combo multiplier text
  const getComboMultiplier = () => {
    if (comboCount <= 1) return '';
    return `x${comboCount}`;
  };
  
  // If not connected to socket or no room info, show loading
  if (!isConnected || !roomInfo) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connecting to game...</h1>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }
  
  // If waiting for game to start
  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Waiting for game to start...</h1>
          <p className="mb-4">Room code: {roomCode}</p>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }
  
  // If disconnected or error
  if (gameStatus === 'disconnected') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Game Disconnected</h1>
          <p className="mb-6 text-red-400">{errorMessage || 'Connection to the game was lost.'}</p>
          <button 
            onClick={handleReturnToLobby}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">BlockBlast - Multiplayer</h1>
            <p className="text-gray-400">Room: {roomCode}</p>
          </div>
          <button
            onClick={handleReturnToLobby}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md"
          >
            Leave Game
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Your board */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{currentPlayer?.username || 'You'}</h2>
              <div className="bg-blue-900/50 px-4 py-1 rounded-md">
                Score: {score}
              </div>
            </div>
            
            <div className="relative">
              <GameBoard 
                board={board} 
                onCellClick={handleCellClick}
                onPieceDrop={handlePieceDrop}
                highlightDropZone={true}
                currentDraggedPiece={currentDraggedPiece}
                grabOffsetX={grabOffsetX}
                grabOffsetY={grabOffsetY}
                canPlacePieceCheck={canPlacePiece}
                placePieceFunc={placePiece}
                checkCompletedLinesFunc={(board) => {
                  const { rowsCleared, colsCleared } = checkCompletedLines(board);
                  return {
                    linesCleared: rowsCleared.length + colsCleared.length,
                    rowsCleared,
                    colsCleared
                  };
                }}
              />
              
              {showCombo && comboCount > 1 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-black text-2xl font-bold px-6 py-3 rounded-lg animate-bounce">
                  {getComboMultiplier()} COMBO!
                </div>
              )}
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Your Pieces:</h3>
              <div className="flex justify-center space-x-4">
                {pieces.map((piece, index) => (
                  <div 
                    key={piece.id} 
                    className={`cursor-pointer p-2 rounded-md ${selectedPieceIndex === index ? 'bg-blue-900/50' : ''}`}
                    onClick={() => handlePieceClick(index)}
                  >
                    <GamePiece 
                      piece={piece} 
                      onDragStart={handlePieceDragStart}
                      draggable={gameStatus === 'playing'}
                      isSelected={selectedPieceIndex === index}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Opponent's board */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{opponent?.username || 'Opponent'}</h2>
              <div className="bg-red-900/50 px-4 py-1 rounded-md">
                Score: {opponentScore}
              </div>
            </div>
            
            <GameBoard 
              board={opponentBoard} 
              onCellClick={() => {}}
            />
          </div>
        </div>
        
        {/* Game over overlay */}
        {gameStatus === 'gameOver' && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4 text-center">
                {winnerName ? `${winnerName} Wins!` : 'Game Over'}
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-700 p-4 rounded-md text-center">
                  <p className="text-sm text-gray-400">Your Score</p>
                  <p className="text-2xl font-bold">{score}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-md text-center">
                  <p className="text-sm text-gray-400">Opponent&apos;s Score</p>
                  <p className="text-2xl font-bold">{opponentScore}</p>
                </div>
              </div>
              
              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleReturnToLobby}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Return to Lobby
                </button>
                <Link href="/" className="text-center py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-md">
                  Main Menu
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 