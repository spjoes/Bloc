import GamePiece, { PieceType } from '../components/GamePiece';

// Create an empty board
export function createEmptyBoard(rows = 8, cols = 8): (number | null)[][] {
  return Array(rows).fill(null).map(() => Array(cols).fill(null));
}

// Generate random game pieces
export function generateRandomPieces(count = 3): PieceType[] {
  const pieces: PieceType[] = [];
  
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

// Check if a piece can be placed on the board
export function canPlacePiece(board: (number | null)[][], piece: PieceType, row: number, col: number): boolean {
  if (!piece.shape) return false;
  
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        // Check if the cell is within board bounds
        if (row + y >= board.length || col + x >= board[0].length) {
          return false;
        }
        // Check if the cell is already occupied
        if (board[row + y][col + x] !== null) {
          return false;
        }
      }
    }
  }
  
  return true;
}

// Place a piece on the board
export function placePiece(board: (number | null)[][], piece: PieceType, row: number, col: number): (number | null)[][] {
  const newBoard = board.map(row => [...row]);
  
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        // Use a numeric ID based on the piece color
        const colorMap: Record<string, number> = {
          'blue': 1, 
          'green': 2, 
          'red': 3, 
          'purple': 4, 
          'orange': 5, 
          'teal': 6, 
          'yellow': 7
        };
        newBoard[row + y][col + x] = colorMap[piece.color] || 1;
      }
    }
  }
  
  return newBoard;
}

// Check for completed lines
export function checkCompletedLines(board: (number | null)[][]): { 
  clearedBoard: (number | null)[][], 
  linesCleared: number,
  rowsCleared: number[],
  colsCleared: number[]
} {
  const rowsCleared: number[] = [];
  const colsCleared: number[] = [];
  
  // Check rows
  for (let row = 0; row < board.length; row++) {
    if (board[row].every(cell => cell !== null)) {
      rowsCleared.push(row);
    }
  }
  
  // Check columns
  for (let col = 0; col < board[0].length; col++) {
    if (board.every(row => row[col] !== null)) {
      colsCleared.push(col);
    }
  }
  
  // Clear rows and columns
  let clearedBoard = [...board.map(row => [...row])];
  
  // Clear rows
  for (const row of rowsCleared) {
    clearedBoard[row] = Array(board[0].length).fill(null);
  }
  
  // Clear columns
  for (const col of colsCleared) {
    for (let row = 0; row < board.length; row++) {
      clearedBoard[row][col] = null;
    }
  }
  
  return {
    clearedBoard,
    linesCleared: rowsCleared.length + colsCleared.length,
    rowsCleared,
    colsCleared
  };
}

// Calculate score based on lines cleared and combo
export function calculateScore(linesCleared: number, comboMultiplier: number = 1): number {
  // Base scores for clearing lines
  const basePoints = [0, 100, 300, 600, 1000, 1500];
  const points = basePoints[Math.min(linesCleared, basePoints.length - 1)];
  
  return points * comboMultiplier;
}

// Check if any moves are possible with the available pieces
export function canMakeAnyMove(board: (number | null)[][], pieces: PieceType[]): boolean {
  for (const piece of pieces) {
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[0].length; col++) {
        if (canPlacePiece(board, piece, row, col)) {
          return true;
        }
      }
    }
  }
  
  return false;
} 