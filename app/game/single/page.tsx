'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GameBoard from '../../components/GameBoard';
import GamePiece, { PieceType } from '../../components/GamePiece';
import { 
  generateRandomPieces, 
  createEmptyBoard, 
  canPlacePiece, 
  placePiece,
  checkCompletedLines,
  calculateScore,
  canMakeAnyMove
} from '../../lib/pieces';

export default function SinglePlayerGame() {
  const router = useRouter();
  const [board, setBoard] = useState<(number | null)[][]>([]);
  const [pieces, setPieces] = useState<PieceType[]>([]);
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(null);
  const [draggedPieceIndex, setDraggedPieceIndex] = useState<number | null>(null);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<PieceType | null>(null);
  const [grabOffsetX, setGrabOffsetX] = useState<number>(0);
  const [grabOffsetY, setGrabOffsetY] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [comboCount, setComboCount] = useState<number>(0);
  const [showCombo, setShowCombo] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Load best score from localStorage
  const loadBestScore = () => {
    if (typeof window !== 'undefined') {
      const savedBestScore = localStorage.getItem('blockBlastBestScore');
      if (savedBestScore) {
        return parseInt(savedBestScore, 10);
      }
    }
    return 0;
  };
  
  // Save best score to localStorage
  const saveBestScore = (newScore: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('blockBlastBestScore', newScore.toString());
    }
  };
  
  // Initialize game state only on client side
  useEffect(() => {
    // Create initial game state
    setBoard(createEmptyBoard(8, 8));
    
    // Generate initial pieces and check them in console
    const initialPieces = generateRandomPieces();
    console.log('Generated initial pieces:', initialPieces);
    setPieces(initialPieces);
    
    // Load saved score
    const savedBestScore = loadBestScore();
    setBestScore(savedBestScore);
    setIsInitialized(true);
  }, []);
  
  // Update best score when current score exceeds it
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      saveBestScore(score);
    }
  }, [score, bestScore]);
  
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
  
  // Handle drag start for a piece
  const handlePieceDragStart = (piece: PieceType, offsetX: number, offsetY: number) => {
    const index = pieces.findIndex(p => p.id === piece.id);
    setDraggedPieceIndex(index);
    setCurrentDraggedPiece(piece);
    setGrabOffsetX(offsetX);
    setGrabOffsetY(offsetY);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setCurrentDraggedPiece(null);
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
    if (gameOver) return;
    
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
          setGameOver(true);
        }
      } else {
        setPieces(updatedPieces);
        
        // Check if game is over with remaining pieces
        if (!canMakeAnyMove(clearedBoard, updatedPieces)) {
          setGameOver(true);
        }
      }
      
      // Reset selected piece
      setSelectedPieceIndex(null);
      setDraggedPieceIndex(null);
      setCurrentDraggedPiece(null);
      
      // Update score
      setScore(prevScore => prevScore + pointsEarned);
    }
  };
  
  // Handle piece placement using click (original method)
  const handleCellClick = (row: number, col: number) => {
    if (selectedPieceIndex === null || gameOver) return;
    
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
      
      // Update score with combo multiplier
      const pointsEarned = calculateScore(linesCleared, linesCleared > 0 ? comboCount + 1 : 0);
      
      // Update the board and remove the piece from available pieces
      setBoard(clearedBoard);
      
      // Create a copy of the pieces array
      const updatedPieces = [...pieces];
      // Remove the selected piece
      updatedPieces.splice(selectedPieceIndex, 1);
      
      // If no pieces left, generate new ones
      if (updatedPieces.length === 0) {
        const newPieces = generateRandomPieces();
        setPieces(newPieces);
        
        // Check if game is over with new pieces
        if (!canMakeAnyMove(clearedBoard, newPieces)) {
          setGameOver(true);
        }
      } else {
        setPieces(updatedPieces);
        
        // Check if game is over with remaining pieces
        if (!canMakeAnyMove(clearedBoard, updatedPieces)) {
          setGameOver(true);
        }
      }
      
      // Reset selected piece
      setSelectedPieceIndex(null);
      
      // Update score
      setScore(prevScore => prevScore + pointsEarned);
    }
  };
  
  // Reset the game
  const resetGame = () => {
    setBoard(createEmptyBoard(8, 8));
    setPieces(generateRandomPieces());
    setSelectedPieceIndex(null);
    setDraggedPieceIndex(null);
    setCurrentDraggedPiece(null);
    setGrabOffsetX(0);
    setGrabOffsetY(0);
    setScore(0);
    setComboCount(0);
    setShowCombo(false);
    setGameOver(false);
    setShowGameOverModal(true);
    // Note: We don't reset bestScore as it should persist across games
  };
  
  // Toggle game over modal visibility
  const toggleGameOverModal = () => {
    setShowGameOverModal(!showGameOverModal);
  };
  
  // Show loading state before client-side initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black text-white">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }
  
  // Calculate combo multiplier text and styles
  const getComboMultiplier = () => {
    if (comboCount <= 1) return "";
    return `${(1 + (comboCount - 1) * 0.5).toFixed(1)}x`;
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">BlockBlast</h1>
          <div className="bg-gray-800 px-4 py-2 rounded-lg">
            <div>
              <span className="font-bold mr-2">Score:</span>{score}
            </div>
            <div className="text-sm text-gray-400">
              <span className="font-bold mr-2">Best:</span>{bestScore}
            </div>
            {showCombo && comboCount > 1 && (
              <div className="text-sm text-yellow-400 font-bold animate-pulse mt-1">
                COMBO x{comboCount} ({getComboMultiplier()})
              </div>
            )}
          </div>
        </div>
        
        {/* Game Over Banner (when modal is hidden) */}
        {gameOver && !showGameOverModal && (
          <div className="bg-red-800 bg-opacity-90 text-white py-2 px-4 rounded-lg mb-4 flex justify-between items-center">
            <span className="font-bold">Game Over! Score: {score}</span>
            <button 
              onClick={toggleGameOverModal}
              className="bg-gray-700 hover:bg-gray-600 text-sm px-3 py-1 rounded ml-4"
            >
              View Results
            </button>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
          {/* Game board */}
          <div className="order-2 md:order-1">
            <GameBoard 
              board={board} 
              onCellClick={handleCellClick}
              onPieceDrop={handlePieceDrop}
              highlightDropZone={draggedPieceIndex !== null}
              currentDraggedPiece={currentDraggedPiece}
              grabOffsetX={grabOffsetX}
              grabOffsetY={grabOffsetY}
              canPlacePieceCheck={canPlacePiece}
              placePieceFunc={placePiece}
              checkCompletedLinesFunc={checkCompletedLines}
            />
          </div>
          
          {/* Game controls and pieces */}
          <div className="order-1 md:order-2 w-full md:w-auto flex flex-col gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3">Available Pieces</h2>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                {pieces.map((piece, index) => (
                  <div key={piece.id} className="text-center">
                    <GamePiece 
                      piece={piece} 
                      isSelected={selectedPieceIndex === index}
                      onClick={() => setSelectedPieceIndex(index)}
                      size="large"
                      draggable={true}
                      onDragStart={handlePieceDragStart}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3">Controls</h2>
              <div className="space-y-2">
                <p className="text-sm">1. Drag a piece to the board or click to select it</p>
                <p className="text-sm">2. Place it on the board by dropping or clicking</p>
                <p className="text-sm">3. Clear lines to score points</p>
                <p className="text-sm">4. Chain clears for combo multipliers!</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={resetGame}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                New Game
              </button>
              <Link
                href="/"
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-center transition-colors"
              >
                Back to Menu
              </Link>
            </div>
          </div>
        </div>
        
        {/* Game over modal */}
        {gameOver && showGameOverModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full text-center">
              <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
              <p className="mb-2">Your score: <span className="font-bold text-xl">{score}</span></p>
              <p className="mb-6">Best score: <span className="font-bold text-xl">{bestScore}</span></p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={resetGame}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Play Again
                </button>
                <button 
                  onClick={toggleGameOverModal}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  View Final Board
                </button>
                <Link
                  href="/"
                  className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-center transition-colors"
                >
                  Back to Menu
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 