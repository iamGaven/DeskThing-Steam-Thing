import React, { useEffect, useRef } from "react";
import { ConnectionInfo, PlayerSummary } from "./types";
import { Wifi, WifiOff, User } from "lucide-react";

interface ProfileLandingPageProps {
  connectionInfo: ConnectionInfo | null;
  playerSummary: PlayerSummary | null;
  DeskThing: any;
}

const ProfileLandingPage: React.FC<ProfileLandingPageProps> = ({ 
  connectionInfo, 
  playerSummary,
  DeskThing 
}) => {
  const hasSubscribed = useRef(false);
  
  // Subscribe to player summary when connected
  useEffect(() => {
    if (connectionInfo?.status === 'connected' && !hasSubscribed.current) {
      hasSubscribed.current = true;
      DeskThing.send({ type: 'subscribe', request: 'player-summary' });
      DeskThing.send({ type: 'requestPlayerSummary' });
    }
    
    if (connectionInfo?.status !== 'connected') {
      hasSubscribed.current = false;
    }
  }, [connectionInfo?.status, DeskThing]);
  
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

  const isConnected = connectionInfo?.status === 'connected';

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col relative overflow-hidden">
      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Connection Status - Top Left */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Disconnected</span>
          </>
        )}
      </div>

      {/* Main Content - Centered */}
      <div className="relative z-10 flex items-center justify-center h-full">
        {playerSummary && isConnected ? (
          <div className="flex flex-col items-center gap-6">
            {/* Profile Image */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              {playerSummary.avatar ? (
                <div className="relative">
                  <img
                    src={playerSummary.avatarfull || playerSummary.avatarmedium || playerSummary.avatar}
                    alt={playerSummary.personaname}
                    className="relative rounded-full border-4 border-white/20 shadow-2xl"
                    style={{
                      width: '200px',   // EDIT: Profile image size
                      height: '200px'
                    }}
                  />
                  {/* Online Status Dot */}
                  <div 
                    className={`absolute bottom-2 right-2 ${getPersonaStateInfo(playerSummary.personastate).bgColor} rounded-full border-4 border-slate-950 shadow-lg`}
                    style={{
                      width: '40px',   // EDIT: Status indicator size
                      height: '40px'
                    }}
                  />
                </div>
              ) : (
                <div 
                  className="relative rounded-full bg-slate-800 flex items-center justify-center border-4 border-white/20"
                  style={{
                    width: '200px',
                    height: '200px'
                  }}
                >
                  <User className="w-24 h-24 text-gray-400" />
                  <div 
                    className={`absolute bottom-2 right-2 ${getPersonaStateInfo(playerSummary.personastate).bgColor} rounded-full border-4 border-slate-950 shadow-lg`}
                    style={{
                      width: '40px',
                      height: '40px'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Player Name */}
            <h1 
              className="font-bold text-white drop-shadow-2xl text-center max-w-md"
              style={{
                fontSize: '48px'  // EDIT: Player name text size
              }}
            >
              {playerSummary.personaname}
            </h1>

            {/* Online Status */}
            <div 
              className="flex items-center bg-white/10 backdrop-blur-xl rounded-full px-6 py-3 border border-white/20"
            >
              <div 
                className={`w-3 h-3 ${getPersonaStateInfo(playerSummary.personastate).bgColor} rounded-full animate-pulse`}
                style={{
                  marginRight: '12px'  // EDIT: Gap between status dot and text (px)
                }}
              ></div>
              <span 
                className={`font-semibold ${getPersonaStateInfo(playerSummary.personastate).color}`}
                style={{
                  fontSize: '20px'  // EDIT: Status text size
                }}
              >
                {getPersonaStateInfo(playerSummary.personastate).label}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-20">👤</div>
            <div className="text-2xl text-white/60 font-medium">
              {isConnected ? 'Waiting for player data...' : 'Not Connected'}
            </div>
            <div className="text-sm text-white/40 mt-2">
              {isConnected ? 'Configure Steam ID in settings' : 'Connect to Steam API to view profile'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileLandingPage;