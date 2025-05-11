import { Server as HTTPServer } from 'http';
import { Socket as NetSocket } from 'net';
import { Server as IOServer } from 'socket.io';

export interface ServerToClientEvents {
  roomUpdated: (roomInfo: any) => void;
  playerLeft: (data: { playerId: string; roomInfo: any }) => void;
  gameStarted: (data: { roomInfo: any; initialPieces: any[] }) => void;
  opponentUpdated: (data: { playerId: string; board: (number | null)[][]; score: number }) => void;
  gameFinished: (data: { winnerId: string; winnerName: string }) => void;
  gameAborted: (data: { reason: string }) => void;
}

export interface ClientToServerEvents {
  createRoom: (data: { username: string }, callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  joinRoom: (data: { roomCode: string; username: string }, callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  toggleReady: (callback: (response: { success: boolean; isReady?: boolean; error?: string }) => void) => void;
  startGame: () => void;
  updateGameState: (data: { board: (number | null)[][]; score: number; piecesUsed: number[] }) => void;
  gameOver: () => void;
  leaveRoom: () => void;
  getRoomInfo: (data: { roomCode: string }, callback: (response: { success: boolean; roomInfo?: any; error?: string }) => void) => void;
  disconnect: () => void;
}

export interface SocketData {
  roomCode: string | null;
}

export interface NextApiResponseServerIO {
  socket: NetSocket & {
    server: HTTPServer & {
      io: IOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
    };
  };
} 