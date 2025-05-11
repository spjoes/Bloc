import Link from "next/link";

export default function HowToPlay() {
  return (
    <div className="min-h-screen flex flex-col items-center p-8 bg-gradient-to-b from-gray-900 to-black text-white">
      <h1 className="text-4xl font-bold text-center mb-8">How to Play BlockBlast</h1>
      
      <div className="max-w-2xl w-full bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Game Rules</h2>
        
        <div className="space-y-6">
          <section>
            <h3 className="text-xl font-semibold mb-2">Game Board</h3>
            <p>BlockBlast is played on an 8x8 grid.</p>
          </section>
          
          <section>
            <h3 className="text-xl font-semibold mb-2">Pieces</h3>
            <p>You receive 3 random pieces at a time to place on the board.</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Pieces come in various shapes (1x5 straight, T-shape, 1x1, etc.)</li>
              <li>Each piece must be placed completely on the board</li>
              <li>Pieces cannot overlap with existing blocks</li>
            </ul>
          </section>
          
          <section>
            <h3 className="text-xl font-semibold mb-2">Scoring Points</h3>
            <p>Score points by clearing lines on the board:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Clear a horizontal or vertical line to score points</li>
              <li>Clearing multiple lines at once gives bonus points</li>
              <li>After placing your 3 pieces, you get 3 new random pieces</li>
            </ul>
          </section>
          
          <section>
            <h3 className="text-xl font-semibold mb-2">Game Over</h3>
            <p>The game ends when there are no valid places to put any of your pieces.</p>
          </section>
          
          <section>
            <h3 className="text-xl font-semibold mb-2">Multiplayer Mode</h3>
            <p>In multiplayer mode:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Compete against other players in real-time</li>
              <li>All players receive the same pieces</li>
              <li>The player with the highest score when someone can't place a piece wins</li>
            </ul>
          </section>
        </div>
      </div>
      
      <div className="mt-8">
        <Link 
          href="/"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg text-center transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
} 