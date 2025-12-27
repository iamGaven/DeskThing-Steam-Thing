import React, { useEffect, useState, useRef } from "react";
import { ConnectionInfo, PlayerSummary, GameSession } from "./types";
import { Users, Wifi, WifiOff, Activity, Clock, ExternalLink, Gamepad2, Timer } from "lucide-react";

interface SimplePageProps {
  connectionInfo: ConnectionInfo | null;
  playerSummary: PlayerSummary | null;
  gameSession: GameSession | null;
  settings?: any;
  DeskThing: any;
}

const SimplePage: React.FC<SimplePageProps> = ({ 
  connectionInfo, 
  playerSummary,
  gameSession,
  DeskThing 
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  const hasSubscribed = useRef(false);
  
  // Subscribe to player summary when connected
  useEffect(() => {
    if (connectionInfo?.status === 'connected' && !hasSubscribed.current) {
      hasSubscribed.current = true;
      // Subscribe to player summary updates
      DeskThing.send({ type: 'subscribe', request: 'player-summary' });
      // Request initial player data
      DeskThing.send({ type: 'requestPlayerSummary' });
    }
    
    if (connectionInfo?.status !== 'connected') {
      hasSubscribed.current = false;
    }
  }, [connectionInfo?.status, DeskThing]);
  
  // Handle game session changes
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (gameSession && gameSession.gameId) {
      // Game is active - start counting from 0
      isRunningRef.current = true;
      setElapsedSeconds(0);
      
      // Start interval to increment every second
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
      
    } else {
      // No game session - stop and reset
      isRunningRef.current = false;
      setElapsedSeconds(0);
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameSession?.gameId]);
  
  // Format display time from elapsed seconds
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  
  const displayTime = hours > 0 
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const getPersonaStateInfo = (state: number) => {
    const states: Record<number, { label: string; color: string; bgColor: string }> = {
      0: { label: 'Offline', color: 'text-gray-400', bgColor: 'bg-gray-500' },
      1: { label: 'Online', color: 'text-green-400', bgColor: 'bg-green-500' },
      2: { label: 'Busy', color: 'text-red-400', bgColor: 'bg-red-500' },
      3: { label: 'Away', color: 'text-yellow-400', bgColor: 'bg-yellow-500' },
      4: { label: 'Snooze', color: 'text-blue-400', bgColor: 'bg-blue-500' },
      5: { label: 'Looking to trade', color: 'text-purple-400', bgColor: 'bg-purple-500' },
      6: { label: 'Looking to play', color: 'text-cyan-400', bgColor: 'bg-cyan-500' }
    };
    return states[state] || states[0];
  };

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const lastSeenMs = timestamp * 1000;
    const diff = now - lastSeenMs;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleConnect = () => {
    DeskThing.send({ type: 'connect' });
  };

  const handleDisconnect = () => {
    DeskThing.send({ type: 'disconnect' });
  };

  const handleRefresh = () => {
    DeskThing.send({ type: 'requestPlayerSummary' });
  };

  const isConnected = connectionInfo?.status === 'connected';
  const isConnecting = connectionInfo?.status === 'connecting';

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
      
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-green-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}
          <span className={`text-sm font-medium ${
            isConnected ? 'text-green-400' : 
            isConnecting ? 'text-yellow-400' : 
            'text-red-400'
          }`}>
            {connectionInfo?.status || 'Unknown'}
          </span>
        </div>
        
        <div className="flex gap-2">
          {!isConnected && !isConnecting && (
            <button
              onClick={handleConnect}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Connect
            </button>
          )}
          {isConnected && (
            <>
              <button
                onClick={handleRefresh}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        
        {/* Game Session Card (shown when playing) */}
        {gameSession && gameSession.gameId && isConnected ? (
          <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30">
            
            <div className="flex items-center gap-2 text-purple-300 text-xs mb-2">
              <Gamepad2 className="w-3 h-3" />
              <span>Currently Playing</span>
            </div>

            <div className="flex gap-4">
              {/* Game Icon */}
              {gameSession.gameIconUrl ? (
                <img
                  src={gameSession.gameIconUrl}
                  alt={gameSession.gameName}
                  className="w-24 h-24 rounded-lg border-2 border-purple-500/50 shadow-lg flex-shrink-0"
                  onError={(e) => {
                    console.error('Failed to load game icon:', gameSession.gameIconUrl);
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="w-24 h-24 rounded-lg border-2 border-purple-500/50 bg-purple-900/30 flex items-center justify-center flex-shrink-0"
                style={{ display: gameSession.gameIconUrl ? 'none' : 'flex' }}
              >
                <Gamepad2 className="w-12 h-12 text-purple-400" />
              </div>

              {/* Game Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white mb-3 line-clamp-2">
                  {gameSession.gameName}
                </h2>

                {/* Session Timer */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">Session Duration</span>
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {displayTime}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Debug: {elapsedSeconds}s
                  </div>
                </div>
              </div>
            </div>

            {/* Player Status */}
            {playerSummary && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
                <img
                  src={playerSummary.avatar}
                  alt={playerSummary.personaname}
                  className="w-10 h-10 rounded-full border-2 border-white/20"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{playerSummary.personaname}</div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getPersonaStateInfo(playerSummary.personastate).bgColor}`} />
                    <span className={`text-xs ${getPersonaStateInfo(playerSummary.personastate).color}`}>
                      {getPersonaStateInfo(playerSummary.personastate).label}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Player Summary Card (shown when not playing) */
          playerSummary && isConnected ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={playerSummary.avatarfull || playerSummary.avatarmedium || playerSummary.avatar}
                    alt={playerSummary.personaname}
                    className="w-24 h-24 rounded-lg border-2 border-white/20"
                  />
                  {/* Status Indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${getPersonaStateInfo(playerSummary.personastate).bgColor} rounded-full border-4 border-slate-900`} />
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-white mb-1 truncate">
                    {playerSummary.personaname}
                  </h2>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className={`w-3 h-3 ${getPersonaStateInfo(playerSummary.personastate).color}`} />
                    <span className={`text-xs font-medium ${getPersonaStateInfo(playerSummary.personastate).color}`}>
                      {getPersonaStateInfo(playerSummary.personastate).label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-xs text-gray-400">Steam ID</div>
                      <div className="text-white font-mono text-xs truncate">{playerSummary.steamid}</div>
                    </div>

                    {playerSummary.lastlogoff && (
                      <div className="bg-white/5 rounded p-2">
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last Seen
                        </div>
                        <div className="text-white text-xs">
                          {formatLastSeen(playerSummary.lastlogoff)}
                        </div>
                      </div>
                    )}
                  </div>

                  {playerSummary.profileurl && (
                    <a
                      href={playerSummary.profileurl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 mt-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-xs"
                    >
                      View Profile
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : isConnected ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">Waiting for player data...</p>
              <p className="text-gray-500 text-sm mt-1">Configure Steam ID in settings</p>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
              <WifiOff className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">Not connected to Steam API</p>
              <p className="text-gray-500 text-sm mt-1">Click Connect to start tracking</p>
            </div>
          )
        )}

      </div>
    </div>
  );
};

export default SimplePage;