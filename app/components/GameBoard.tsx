import React, { useState, useRef } from 'react';
import { PieceType } from './GamePiece';

interface GameBoardProps {
  board: (number | null)[][];
  onCellClick?: (row: number, col: number) => void;
  onPieceDrop?: (pieceId: number, row: number, col: number) => void;
  highlightDropZone?: boolean;
  currentDraggedPiece?: PieceType | null;
  grabOffsetX?: number;
  grabOffsetY?: number;
  canPlacePieceCheck?: (board: (number | null)[][], piece: PieceType, row: number, col: number) => boolean;
  checkCompletedLinesFunc?: (board: (number | null)[][]) => { 
    linesCleared: number;
    rowsCleared: number[];
    colsCleared: number[];
  };
  placePieceFunc?: (board: (number | null)[][], piece: PieceType, row: number, col: number) => (number | null)[][];
}

const GameBoard: React.FC<GameBoardProps> = ({ 
  board, 
  onCellClick, 
  onPieceDrop,
  currentDraggedPiece = null,
  grabOffsetX = 0,
  grabOffsetY = 0,
  canPlacePieceCheck,
  checkCompletedLinesFunc,
  placePieceFunc
}) => {
  const [previewPosition, setPreviewPosition] = useState<{row: number, col: number} | null>(null);
  const [isValidPlacement, setIsValidPlacement] = useState<boolean>(false);
  const [rowsThatWillClear, setRowsThatWillClear] = useState<number[]>([]);
  const [colsThatWillClear, setColsThatWillClear] = useState<number[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  // Generate preview cells from piece shape and position
  const generatePreviewCells = () => {
    if (!currentDraggedPiece || !previewPosition) return [];
    
    const cells: {row: number, col: number}[] = [];
    const shape = currentDraggedPiece.shape;
    
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          cells.push({
            row: previewPosition.row + r,
            col: previewPosition.col + c
          });
        }
      }
    }
    
    return cells;
  };

  // Get preview cells
  const previewCells = generatePreviewCells();

  // Check if a cell is part of the preview
  const isPreviewCell = (row: number, col: number) => {
    return previewCells.some(cell => cell.row === row && cell.col === col);
  };

  // Check if a cell is in a row or column that will be cleared
  const isLineToBeClearedCell = (row: number, col: number) => {
    return rowsThatWillClear.includes(row) || colsThatWillClear.includes(col);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, row: number, col: number) => {
    // Prevent default to allow drop
    e.preventDefault();
    
    // Update preview position, accounting for grab offset
    if (currentDraggedPiece) {
      // Adjust position based on where user grabbed the piece
      const adjustedRow = Math.max(0, row - grabOffsetY);
      const adjustedCol = Math.max(0, col - grabOffsetX);
      
      setPreviewPosition({ row: adjustedRow, col: adjustedCol });
      
      // Check if placement is valid
      if (canPlacePieceCheck && currentDraggedPiece) {
        const canPlace = canPlacePieceCheck(board, currentDraggedPiece, adjustedRow, adjustedCol);
        setIsValidPlacement(canPlace);
        
        // If placement is valid and we have the functions needed, calculate which rows will clear
        if (canPlace && placePieceFunc && checkCompletedLinesFunc) {
          // Create a temporary board with the piece placed
          const tempBoard = placePieceFunc(board, currentDraggedPiece, adjustedRow, adjustedCol);
          // Check which rows/columns would be completed
          const { rowsCleared, colsCleared } = checkCompletedLinesFunc(tempBoard);
          setRowsThatWillClear(rowsCleared);
          setColsThatWillClear(colsCleared);
        } else {
          setRowsThatWillClear([]);
          setColsThatWillClear([]);
        }
      }
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    
    // Reset preview
    setPreviewPosition(null);
    setIsValidPlacement(false);
    setRowsThatWillClear([]);
    setColsThatWillClear([]);
    
    // Process the drop
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.pieceId !== undefined && onPieceDrop) {
        // Adjust drop position based on grab offset
        const adjustedRow = Math.max(0, row - grabOffsetY);
        const adjustedCol = Math.max(0, col - grabOffsetX);
        
        onPieceDrop(data.pieceId, adjustedRow, adjustedCol);
      }
    } catch (err) {
      console.error('Error processing drop:', err);
    }
  };

  // Ensure we're using an 8x8 grid
  const boardSize = 8;
  
  // Prepare board data, ensuring it's 8x8
  const boardData = Array(boardSize).fill(null).map((_, rowIdx) => 
    Array(boardSize).fill(null).map((_, colIdx) => 
      rowIdx < board.length && colIdx < (board[rowIdx]?.length || 0) 
        ? board[rowIdx][colIdx] 
        : null
    )
  );

  return (
    <div className="bg-gray-800 p-2 rounded-lg">
      <div 
        ref={boardRef}
        className="board-grid gap-0.5"
      >
        {boardData.map((row, rowIndex) => 
          row.map((cell, colIndex) => {
            const isPreview = isPreviewCell(rowIndex, colIndex);
            const isLineToBeCleared = isValidPlacement && isLineToBeClearedCell(rowIndex, colIndex);
            
            // Determine cell color based on value
            let cellColor = 'bg-gray-700'; // Default empty cell
            
            if (isPreview) {
              cellColor = isValidPlacement ? 'bg-green-500' : 'bg-red-500';
            } else if (isLineToBeCleared) {
              cellColor = 'bg-yellow-400'; // Highlight cells that will be cleared
            } else if (cell !== null) {
              // Map numeric values to colors
              const colorClasses = [
                'bg-gray-500',  // Fallback for zero (should not happen)
                'bg-blue-500',  // 1
                'bg-green-500', // 2
                'bg-red-500',   // 3
                'bg-purple-500', // 4
                'bg-orange-500', // 5
                'bg-teal-500',   // 6
                'bg-yellow-500'  // 7
              ];
              
              const colorIndex = cell >= 0 && cell < colorClasses.length ? cell : 0;
              cellColor = colorClasses[colorIndex];
            }
            
            return (
              <div 
                key={`${rowIndex}-${colIndex}`}
                className={`
                  ${cellColor}
                  ${isPreview ? 'opacity-50' : ''}
                  rounded
                  transition-colors
                  ${(onCellClick || onPieceDrop) ? 'cursor-pointer hover:opacity-80' : ''}
                  w-full h-full
                `}
                onClick={() => onCellClick?.(rowIndex, colIndex)}
                onDragOver={(e) => handleDragOver(e, rowIndex, colIndex)}
                onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default GameBoard; 