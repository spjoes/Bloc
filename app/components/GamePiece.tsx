import React, { useRef } from 'react';

// Define types
export type PieceShape = boolean[][] | number[][];

export interface PieceType {
  id: number;
  shape: PieceShape;
  color: string;
}

interface GamePieceProps {
  piece: PieceType;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  draggable?: boolean;
  onDragStart?: (piece: PieceType, grabOffsetX: number, grabOffsetY: number) => void;
}

const CELL_SIZES = {
  small: 'w-5 h-5',
  medium: 'w-7 h-7',
  large: 'w-9 h-9',
};

// Size in pixels for cells (approximate)
const CELL_PIXEL_SIZES = {
  small: 20,
  medium: 28,
  large: 36,
};

// Convert color name to a Tailwind CSS class
const getColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    'blue': 'bg-blue-500',
    'green': 'bg-green-500',
    'red': 'bg-red-500',
    'purple': 'bg-purple-500',
    'orange': 'bg-orange-500',
    'teal': 'bg-teal-500',
    'yellow': 'bg-yellow-500',
    // Handle legacy colors that include the bg- prefix
    'bg-blue-500': 'bg-blue-500',
    'bg-green-500': 'bg-green-500',
    'bg-red-500': 'bg-red-500',
    'bg-yellow-500': 'bg-yellow-500',
    'bg-purple-500': 'bg-purple-500',
    'bg-pink-500': 'bg-pink-500',
    'bg-indigo-500': 'bg-indigo-500',
    'bg-orange-500': 'bg-orange-500',
  };

  return colorMap[color] || 'bg-gray-500'; // Fallback color
};

const GamePiece: React.FC<GamePieceProps> = ({ 
  piece, 
  isSelected = false, 
  onClick,
  size = 'medium',
  draggable = false,
  onDragStart
}) => {
  const pieceRef = useRef<HTMLDivElement>(null);
  const maxRows = piece.shape.length;
  const maxCols = Math.max(...piece.shape.map(row => row.length));
  
  // Handle drag start
  const handleDragStart = (e: React.DragEvent) => {
    if (draggable && onDragStart && pieceRef.current) {
      // Set data to be transferred (for drop handling)
      e.dataTransfer.setData('application/json', JSON.stringify({
        pieceId: piece.id
      }));
      
      // Hide default browser drag image
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent pixel
      e.dataTransfer.setDragImage(img, 0, 0);
      
      // Calculate the offset within the piece where the user grabbed it
      const rect = pieceRef.current.getBoundingClientRect();
      const grabOffsetX = e.clientX - rect.left;
      const grabOffsetY = e.clientY - rect.top;
      
      // Convert to grid cell coordinates (approximate)
      const cellSize = CELL_PIXEL_SIZES[size];
      const cellOffsetX = Math.floor(grabOffsetX / cellSize);
      const cellOffsetY = Math.floor(grabOffsetY / cellSize);
      
      // Call the onDragStart handler with piece and grab offsets
      onDragStart(piece, cellOffsetX, cellOffsetY);
    }
  };
  
  // Helper function to check if a cell is filled
  const isCellFilled = (cell: boolean | number): boolean => {
    if (typeof cell === 'boolean') return cell;
    return cell > 0;
  };
  
  // Get the color class based on the piece color
  const colorClass = getColorClass(piece.color);
  
  return (
    <div 
      ref={pieceRef}
      className={`
        inline-block p-1 rounded-md
        ${isSelected ? 'bg-gray-500' : 'bg-gray-700'}
        ${onClick ? 'cursor-pointer hover:bg-gray-600' : ''}
        ${draggable ? 'cursor-move' : ''}
      `}
      onClick={onClick}
      draggable={draggable}
      onDragStart={handleDragStart}
    >
      <div 
        className="grid gap-0.5"
        style={{ 
          gridTemplateRows: `repeat(${maxRows}, 1fr)`,
          gridTemplateColumns: `repeat(${maxCols}, 1fr)`
        }}
      >
        {piece.shape.map((row, rowIndex) => (
          row.map((cell, colIndex) => (
            <div 
              key={`${rowIndex}-${colIndex}`}
              className={`
                ${CELL_SIZES[size]} 
                rounded
                ${isCellFilled(cell) ? colorClass : 'bg-transparent'}
              `}
            />
          ))
        ))}
      </div>
    </div>
  );
};

export default GamePiece; 