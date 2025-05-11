import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-8 bg-gradient-to-b from-gray-900 to-black text-white">
      <h1 className="text-5xl font-bold text-center mb-2">BlockBlast</h1>
      <h2 className="text-xl text-center mb-8">Puzzle Game</h2>
      
      <div className="flex flex-col gap-4 w-full max-w-md">
        <Link 
          href="/game/single"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
        >
          Single Player
        </Link>
        
        <Link 
          href="/game/multiplayer/lobby"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
        >
          Multiplayer
        </Link>
        
        <Link 
          href="/how-to-play"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
        >
          How to Play
        </Link>
      </div>
      
      <div className="mt-8 text-center text-sm opacity-70">
        <p>A puzzle game where you place blocks to clear lines and score points!</p>
      </div>
    </div>
  );
}
