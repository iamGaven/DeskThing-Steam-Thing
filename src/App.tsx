import React, { useEffect, useState } from "react";
import ProfileLandingPage from "./ProfileLandingPage";
import ActiveGamePage from "./ActiveGamePage";
import { createDeskThing } from "@deskthing/client";
import { ToClientData, GenericTransitData, ConnectionInfo, PlayerSummary, GameSession } from "./types";

const DeskThing = createDeskThing<ToClientData, GenericTransitData>();

const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';

const App: React.FC = () => {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [playerSummary, setPlayerSummary] = useState<PlayerSummary | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const hasRequestedSession = React.useRef(false);

  // Set up core listeners once at the app level
  useEffect(() => {
    // Reset loading states when component mounts
    setIsLoading(true);
    setInitialCheckComplete(false);
    hasRequestedSession.current = false;
    
    if (isDev) {
      console.log("=== RUNNING IN DEV MODE ===");
      setIsLoading(false);
      setInitialCheckComplete(true);
      // Set mock connection info for dev
      setConnectionInfo({
        status: 'connected',
        lastConnected: Date.now(),
        lastError: null,
        trackedSteamId: '76561197960435530'
      });
      // Set mock player summary for dev
      setPlayerSummary({
        steamid: '76561197960435530',
        personaname: 'Gabe Newell',
        profileurl: 'https://steamcommunity.com/id/gabelogannewell/',
        avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg',
        avatarmedium: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg',
        avatarfull: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
        personastate: 1,
        communityvisibilitystate: 3,
        profilestate: 1,
        lastlogoff: Date.now() - 3600000,
        commentpermission: 1
      });
      // Set mock game session
      setGameSession({
        gameId: '240720',
        gameName: 'Getting Over It with Bennett Foddy',
        gameIconUrl: 'https://media.steampowered.com/steamcommunity/public/images/apps/240720/161090eb78acf2e28333e8ae182121d906f1ee85.jpg',
        startTime: Date.now() - 1800000, // Started 30 minutes ago
        serverTime: Date.now(),
        elapsedTime: 1800000
      });
      // Set mock settings for dev
      setSettings({
        steamApiKey: { value: 'mock-api-key' },
        trackedSteamId: { value: '76561197960435530' },
        discordUserId: { value: '123456789012345678' },
        autoConnect: { value: true },
        pollInterval: { value: 30 },
        maxLogs: { value: 100 }
      });
      return;
    }
    
    let invalid = false;
    
    console.log("=== SETTING UP CORE APP LISTENERS ===");
    
    // Connection status listener
    const removeStatusListener = DeskThing.on('connectionStatus', (data: any) => {
      if (invalid) return;
      console.log("=== APP: RECEIVED CONNECTION STATUS ===", data?.payload);
      
      if (!data?.payload) return;
      
      setConnectionInfo(data.payload);
      
      // Mark initial check as complete once we get connection status
      if (!initialCheckComplete) {
        setInitialCheckComplete(true);
      }
      setIsLoading(false);
    });

    // Player summary listener (Steam profile data - still polled)
    const removePlayerListener = DeskThing.on('playerSummary', (data: any) => {
      if (invalid) return;
      console.log("=== APP: RECEIVED PLAYER SUMMARY (Steam Profile) ===", data?.payload);
      
      if (!data?.payload) return;
      
      setPlayerSummary(data.payload);
    });

    // Game session listener (Lanyard real-time game tracking)
    const removeGameSessionListener = DeskThing.on('gameSession', (data: any) => {
      if (invalid) return;
      console.log("=== APP: RECEIVED GAME SESSION UPDATE ===", {
        timestamp: new Date().toISOString(),
        payload: data?.payload,
        hasGameId: !!data?.payload?.gameId,
        gameId: data?.payload?.gameId,
        gameName: data?.payload?.gameName,
        startTime: data?.payload?.startTime,
        startTimeType: typeof data?.payload?.startTime,
        now: Date.now(),
        difference: data?.payload?.startTime ? (Date.now() - data?.payload?.startTime) : 'N/A'
      });
      
      // Payload can be null when user stops playing
      setGameSession(data.payload);
      
      // If this is the first game session we receive and we're still loading,
      // mark initial check as complete
      if (!initialCheckComplete) {
        console.log("=== APP: MARKING INITIAL CHECK AS COMPLETE ===");
        setInitialCheckComplete(true);
        setIsLoading(false);
      }
    });

    // Settings listener
    const removeSettingsListener = DeskThing.on('settings', (data: any) => {
      if (invalid) return;
      console.log("=== APP: RECEIVED SETTINGS ===");
      
      if (!data?.payload) {
        console.log("No payload in settings data");
        return;
      }
      
      setSettings(data.payload);
    });

    // Request initial status
    console.log("=== APP: REQUESTING INITIAL STATUS ===");
    DeskThing.send({ type: 'get', request: 'status' });
    
    // Subscribe to player summary updates (Steam profile - still needs polling)
    console.log("=== APP: SUBSCRIBING TO PLAYER SUMMARY ===");
    DeskThing.send({ type: 'subscribe', request: 'player-summary' });
    
    // Request current game session if there is one
    if (!hasRequestedSession.current) {
      console.log("=== APP: REQUESTING CURRENT GAME SESSION ===");
      DeskThing.send({ type: 'get', request: 'gameSession' });
      hasRequestedSession.current = true;
    }
    
    // Game tracking via Lanyard is now AUTOMATIC via WebSocket heartbeat!
    // Every ~30 seconds Lanyard sends presence updates automatically
    // No polling or subscription needed - it's push-based!
    
    // Timeout if no response - consider initial check complete after 3 seconds
    setTimeout(() => {
      if (!invalid && !initialCheckComplete) {
        console.warn("=== APP: NO GAME SESSION RESPONSE WITHIN 3 SECONDS - PROCEEDING ===");
        setInitialCheckComplete(true);
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      console.log("=== APP: CLEANING UP LISTENERS ===");
      invalid = true;
      
      // Unsubscribe from player summary
      DeskThing.send({ type: 'unsubscribe', request: 'player-summary' });
      
      removeStatusListener();
      removePlayerListener();
      removeGameSessionListener();
      removeSettingsListener();
    };
  }, []); // Empty dependency array - only run once on mount

  // THIS IS A SEPARATE useEffect - Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log("=== VISIBILITY CHANGE ===", {
        hidden: document.hidden,
        isDev: isDev
      });
      
      if (!document.hidden && !isDev) {
        console.log("=== APP: PAGE BECAME VISIBLE - RE-CHECKING GAME SESSION ===");
        
        // Request game session WITHOUT showing loading screen
        console.log("=== APP: SENDING gameSession REQUEST ===");
        DeskThing.send({ type: 'get', request: 'gameSession' });
        
        // Also request status
        DeskThing.send({ type: 'get', request: 'status' });
      }
    };

    console.log("=== APP: ADDING VISIBILITY CHANGE LISTENER ===");
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log("=== APP: REMOVING VISIBILITY CHANGE LISTENER ===");
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Determine which page to show based on game session
  const hasActiveGame = gameSession && gameSession.gameId;

  // Loading state - only show while we're waiting for initial data
  if (isLoading || !initialCheckComplete) {
    return (
      <div className="w-screen h-screen bg-slate-900 flex justify-center items-center overflow-hidden">
        <div className="text-white text-xl">Connecting to Steam & Discord...</div>
      </div>
    );
  }

  // Route to appropriate page based on game session
  // If there's an active game on startup, go straight to ActiveGamePage
  return (
    <div className="w-screen h-screen">
      {hasActiveGame ? (
        <ActiveGamePage
          connectionInfo={connectionInfo}
          playerSummary={playerSummary}
          gameSession={gameSession}
          DeskThing={DeskThing}
          key={gameSession?.gameId || 'no-game'}
        />
      ) : (
        <ProfileLandingPage
          connectionInfo={connectionInfo}
          playerSummary={playerSummary}
          DeskThing={DeskThing}
        />
      )}
    </div>
  );
};

export default App;