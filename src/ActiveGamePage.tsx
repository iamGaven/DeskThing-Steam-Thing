import React, { useEffect, useState } from "react";
import { ConnectionInfo, PlayerSummary, GameSession } from "./types";
import { Timer, User } from "lucide-react";

interface ActiveGamePageProps {
  connectionInfo: ConnectionInfo | null;
  playerSummary: PlayerSummary | null;
  gameSession: GameSession | null;
  DeskThing: any;
}

const ActiveGamePage: React.FC<ActiveGamePageProps> = ({ 
  connectionInfo, 
  playerSummary,
  gameSession 
}) => {
  const [tick, setTick] = useState(0);
  const [baseElapsedSeconds, setBaseElapsedSeconds] = useState(0);
  const [localStartTime, setLocalStartTime] = useState(Date.now());
  
  useEffect(() => {
    if (gameSession?.startTime && gameSession?.serverTime) {
      const elapsedAtServerMs = gameSession.serverTime - gameSession.startTime;
      const elapsedAtServerSec = Math.floor(elapsedAtServerMs / 1000);
      setBaseElapsedSeconds(elapsedAtServerSec);
      setLocalStartTime(Date.now());
    }
  }, [gameSession?.gameId, gameSession?.startTime, gameSession?.serverTime]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const getElapsedSeconds = () => {
    if (!gameSession?.startTime) return 0;
    const localElapsedSeconds = Math.floor((Date.now() - localStartTime) / 1000);
    const totalElapsed = baseElapsedSeconds + localElapsedSeconds;
    return Math.max(0, totalElapsed);
  };
  
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isConnected = connectionInfo?.status === 'connected';
  const displaySeconds = getElapsedSeconds();

return (
    <div className="w-full h-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col relative overflow-hidden">
      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {gameSession && gameSession.gameId && isConnected ? (
        <div className="relative z-10 w-full h-full">
          {/* Now Playing label - top left */}
          <div className="absolute top-4 left-4 flex items-center gap-4 text-emerald-400">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Now Playing</span>
          </div>

          {/* EDIT THESE VALUES TO MOVE AND RESIZE THE GAME COVER */}
          {/* Game cover art - FREELY POSITIONABLE */}
          {/* Use % for position (0-100%) or vw/vh for viewport units */}
          <div 
            className="absolute group flex-shrink-0"
            style={{
              left: '10%',        // EDIT: Horizontal position (% or px or vw)
              top: '50%',        // EDIT: Vertical position (% or px or vh)
              transform: 'translateY(-50%)',  // Centers vertically at the top value
              width: '30vw',     // EDIT: Width (vw = viewport width, or px)
              height: '30vw'     // EDIT: Height (keep same as width for square, or use vh)
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-800/50 backdrop-blur-xl border-2 border-white/10 shadow-2xl">
              {gameSession.gameIconUrl ? (
                <img 
                  src={gameSession.gameIconUrl} 
                  alt={gameSession.gameName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-6xl opacity-20">🎮</div>
                </div>
              )}
            </div>
          </div>

          {/* EDIT THESE VALUES TO MOVE THE GAME INFO */}
          {/* Game info and timer - FREELY POSITIONABLE */}
          <div 
            className="absolute flex flex-col justify-center gap-5"
            style={{
              left: '45%',     // EDIT: Horizontal position (% or px or vw)
              top: '50%',      // EDIT: Vertical position (% or px or vh)
              transform: 'translateY(-50%)'  // Centers vertically at the top value
            }}
          >
            {/* Game title */}
            <div>
              <h1 
                className="font-bold text-white drop-shadow-lg leading-tight break-words max-w-md"
                style={{
                  fontSize: '6vw'  // EDIT: Game title text size (vw scales with screen)
                }}
              >
                {gameSession.gameName}
              </h1>
            </div>

         {/* Session timer */}
            <div className="flex items-center gap-5">
              <Timer 
                className="text-blue-400"
                style={{
                  width: '4vw',   // EDIT: Timer icon size (vw scales with screen)
                  height: '4vw'
                }}
              />
              <div 
                className="font-bold text-white font-mono tracking-wider drop-shadow-2xl"
                style={{
                  fontSize: '5vw'  // EDIT: Timer text size (vw scales with screen)
                }}
              >
                {formatTime(displaySeconds)}
              </div>
            </div>
          </div>

          {/* EDIT THESE VALUES TO MOVE AND RESIZE THE PLAYER PROFILE */}
          {/* Player profile - FREELY POSITIONABLE */}
          {playerSummary && (
            <div 
              className="absolute bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl flex items-center"
              style={{
                bottom: '3%',    // EDIT: Distance from bottom (% or px or vh)
                right: '3%',     // EDIT: Distance from right (% or px or vw)
                padding: '20px'  // EDIT: Padding inside box (px for consistent sizing)
              }}
            >
              {playerSummary.avatar ? (
                <img 
                  src={playerSummary.avatar} 
                  alt={playerSummary.personaname}
                  className="rounded-full border-2 border-blue-500 shadow-lg"
                  style={{
                    width: '80px',      // EDIT: Avatar width (px for consistent sizing)
                    height: '80px',     // EDIT: Avatar height
                    marginRight: '24px' // EDIT: Space between avatar and text (px)
                  }}
                />
              ) : (
                <div 
                  className="rounded-full bg-slate-800 flex items-center justify-center border-2 border-blue-500"
                  style={{
                    width: '80px',      // EDIT: Avatar width (px for consistent sizing)
                    height: '80px',     // EDIT: Avatar height
                    marginRight: '24px' // EDIT: Space between avatar and text (px)
                  }}
                >
                  <User 
                    className="text-gray-400"
                    style={{
                      width: '40px',  // EDIT: Icon size (px for consistent sizing)
                      height: '40px'
                    }}
                  />
                </div>
              )}
              <div className="flex flex-col">
                <span 
                  className="text-gray-400"
                  style={{
                    fontSize: '18px',      // EDIT: "Player" label text (px for consistent sizing)
                    marginBottom: '4px'
                  }}
                >
                  Player
                </span>
                <span 
                  className="font-semibold text-white"
                  style={{
                    fontSize: '20px'  // EDIT: Player name text (px for consistent sizing)
                  }}
                >
                  {playerSummary.personaname}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-20">🎮</div>
            <div className="text-2xl text-white/60 font-medium">No Active Game</div>
            <div className="text-sm text-white/40 mt-2">Start playing a game to begin tracking</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveGamePage;