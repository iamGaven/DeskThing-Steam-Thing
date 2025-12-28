import { DeskThingClass } from "@deskthing/server";
import { 
  ToClientData, 
  GenericTransitData, 
  ConnectionStatus, 
  ConnectionInfo, 
  LogEntry,
  PlayerSummary,
  GameSession,
  RecentlyPlayedGame
} from "./types";

import type WebSocket from 'ws';

class SteamController {
  private static instance: SteamController | null = null;
  private DeskThing: DeskThingClass<GenericTransitData, ToClientData> | null = null;
  
  private steamApiKey: string = "";
  private steamApi: any | null = null;
  private autoConnect: boolean = true;
  private maxLogs: number = 100;
  private pollInterval: number = 30000; 
  private connectionStatus: ConnectionStatus = 'disconnected';
  private lastConnected: number | null = null;
  private lastError: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  
  private logs: LogEntry[] = [];
  private trackedSteamId: string = "";
  private discordUserId: string = ""; 
  private lanyardSocket: WebSocket | null = null;
  private lanyardConnected: boolean = false;
  private activeSubscriptions: Set<'player-summary'> = new Set();
  private currentGameSession: GameSession | null = null;
  private lastGameId: string | null = null;

  private constructor() {
    this.steamApiKey = "";
  }

  static getInstance(): SteamController {
    if (!SteamController.instance) {
      SteamController.instance = new SteamController();
    }
    return SteamController.instance;
  }

  public setDeskThing(deskThing: DeskThingClass<GenericTransitData, ToClientData>) {
    this.DeskThing = deskThing;
  }

  public setTrackedSteamId(steamId: string) {
    this.trackedSteamId = steamId;
    this.addLog('info', `Tracking Steam ID: ${steamId}`);
  }

  public setDiscordUserId(discordId: string) {
    this.discordUserId = discordId;
    this.addLog('info', `Discord User ID set: ${discordId}`);
    
    if (this.lanyardConnected) {
      this.disconnectLanyard();
      this.connectLanyard();
    }
  }

  public subscribe(dataType: 'player-summary') {
    const wasEmpty = this.activeSubscriptions.size === 0;
    this.activeSubscriptions.add(dataType);
    
    this.addLog('info', `Subscribed to ${dataType} data`);
    
    if (wasEmpty && this.connectionStatus === 'connected') {
      this.startPolling();
    }
  }

  public unsubscribe(dataType: 'player-summary') {
    this.activeSubscriptions.delete(dataType);
    
    this.addLog('info', `Unsubscribed from ${dataType} data`);
    
    if (this.activeSubscriptions.size === 0) {
      this.stopPolling();
    }
  }

  public clearSubscriptions() {
    this.activeSubscriptions.clear();
    this.stopPolling();
    this.addLog('info', 'Cleared all subscriptions');
  }

  private addLog(level: LogEntry['level'], message: string) {
    const log: LogEntry = {
      timestamp: Date.now(),
      level,
      message
    };
    
    this.logs.push(log);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    if (this.DeskThing) {
      this.DeskThing.send({ type: 'log', payload: log });
    }
    
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  private sendConnectionStatus() {
    const info: ConnectionInfo = {
      status: this.connectionStatus,
      lastConnected: this.lastConnected,
      lastError: this.lastError,
      trackedSteamId: this.trackedSteamId
    };
    
    if (this.DeskThing) {
      this.DeskThing.send({ type: 'connectionStatus', payload: info });
    }
  }

  private sendGameSession() {
    if (this.DeskThing && this.currentGameSession) {
      this.DeskThing.send({ type: 'gameSession', payload: this.currentGameSession });
    }
  }

  private async connectLanyard() {
    if (!this.discordUserId) {
      console.log('warn', 'No Discord User ID configured for Lanyard');
      return;
    }

    if (this.lanyardSocket) {
      console.log('warn', 'Lanyard already connected');
      return;
    }

    try {
      console.log('info', 'Connecting to Lanyard WebSocket...');
      
      const lanyardModule = await import('./lanyard.js');
      const lanyardFn = lanyardModule.lanyard;
      
      if (!lanyardFn) {
        throw new Error('Lanyard function not found in module');
      }

      this.lanyardSocket = lanyardFn({
        userId: this.discordUserId,
        socket: true,
        onPresenceUpdate: (presenceData: any) => {
          this.handleLanyardPresence(presenceData);
        }
      });

      this.lanyardConnected = true;
      console.log('success', 'Connected to Lanyard WebSocket');

      if (this.lanyardSocket) {
        this.lanyardSocket.addEventListener('close', () => {
          console.log('warn', 'Lanyard WebSocket closed');
          this.lanyardConnected = false;
          this.lanyardSocket = null;
          
          if (this.connectionStatus === 'connected') {
            setTimeout(() => {
             console.log('info', 'Attempting to reconnect to Lanyard...');
              this.connectLanyard();
            }, 3000);
          }
        });
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.addLog('error', `Failed to connect to Lanyard: ${errorMsg}`);
    }
  }

  private disconnectLanyard() {
    if (this.lanyardSocket) {
      this.lanyardSocket.close();
      this.lanyardSocket = null;
      this.lanyardConnected = false;
      this.addLog('info', 'Disconnected from Lanyard WebSocket');
    }
  }

  private handleLanyardPresence(presenceData: any) {
    console.log('=== LANYARD HEARTBEAT ===', new Date().toISOString());
    
    const data = presenceData.data || presenceData;
    const activities = data.activities || [];
    
    console.log('All activities:', JSON.stringify(activities, null, 2));
    
    const gameActivity = activities.find((activity: any) => activity.type === 0);
    
    if (gameActivity) {
      console.log('Game activity timestamps:', gameActivity.timestamps);
      
      const gameName = gameActivity.name;
      const gameId = gameActivity.application_id || gameName;
      
      console.log(`=== GAME DETECTED: ${gameName} (${gameId}) ===`);
      
      if (gameId !== this.lastGameId) {
        console.log('=== NEW GAME - CREATING SESSION ===');
        this.addLog('info', `User started playing: ${gameName}`);
        this.startGameSessionFromLanyard(gameActivity);
      } else {
        console.log('=== SAME GAME - UPDATING SESSION ===');
        if (this.currentGameSession) {
          this.updateGameSessionFromActivity(gameActivity);
          this.sendGameSession();
        } else {
          console.warn('=== WARNING: Game ID matches but no session exists, creating new session ===');
          this.startGameSessionFromLanyard(gameActivity);
        }
      }
      
      this.lastGameId = gameId;
    } else {
      console.log('=== NO GAME ACTIVITY ===');
      if (this.lastGameId) {
        this.addLog('info', 'User stopped playing game');
        this.stopGameSession();
      }
      this.lastGameId = null;
    }
  }

  private async fetchImageAsBase64(url: string): Promise<string | null> {
    try {
      this.addLog('info', `Fetching game image from: ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;
        this.addLog('success', `Successfully converted game image to base64 (${Math.floor(base64.length / 1024)}KB)`);
        return dataUrl;
      } else {
        this.addLog('warn', `Failed to fetch image: HTTP ${response.status}`);
      }
    } catch (err) {
      this.addLog('error', `Failed to fetch image: ${err}`);
    }
    return null;
  }
  private async startGameSessionFromLanyard(activity: any) {
    const gameName = activity.name;
    const gameId = activity.application_id || gameName;
    const platform = activity.platform; // Get platform from activity
    
    const startTime = activity.timestamps?.start || Date.now();
    
    console.log('=== CREATING GAME SESSION ===', {
      gameId,
      gameName,
      platform,
      startTime,
      startTimeDate: new Date(startTime).toISOString()
    });

    this.addLog('info', `Fetching game image for platform: ${platform || 'Steam'}`);
    const gameIconUrl = await this.getGameImage(platform);

    this.currentGameSession = {
      gameId: gameId,
      gameName: gameName,
      gameIconUrl: gameIconUrl,
      startTime: startTime,
      serverTime: Date.now(),
      elapsedTime: 0
    };

    console.log('Sending session to client with game image');
    this.sendGameSession();
    this.addLog('success', `Started tracking: ${gameName} on ${platform || 'Steam'}`);
  }

  private async updateGameSessionFromActivity(activity: any) {
    if (!this.currentGameSession) return;

    if (!this.currentGameSession.gameIconUrl) {
      const platform = activity.platform;
      this.addLog('info', `Fetching game image for platform: ${platform || 'Steam'}`);
      const gameImage = await this.getGameImage(platform);
      if (gameImage) {
        this.currentGameSession.gameIconUrl = gameImage;
        this.sendGameSession();
      }
    }
  }


  public async connect() {
    if (!this.steamApiKey) {
      this.addLog('error', 'No Steam API key configured. Please add your Steam API key in settings');
      this.connectionStatus = 'error';
      this.lastError = 'Missing API key';
      this.sendConnectionStatus();
      return;
    }

    if (this.connectionStatus === 'connecting') {
      this.addLog('warn', 'Already attempting to connect');
      return;
    }

    this.connectionStatus = 'connecting';
    this.sendConnectionStatus();
    this.addLog('info', 'Initializing Steam API connection...');

    try {
      const SteamApiModule: any = await import('@varandas/steam');
      
      const SteamApiClass = SteamApiModule.default?.default || SteamApiModule.default;
      
      if (!SteamApiClass || typeof SteamApiClass !== 'function') {
        throw new Error('Could not find Steam API constructor in module');
      }
      
      this.steamApi = new SteamApiClass(this.steamApiKey);
      
      const userService = this.steamApi.getUserService();
      await userService.getPlayerSummaries({
        steamids: ['76561197960435530'] 
      });

      this.connectionStatus = 'connected';
      this.lastConnected = Date.now();
      this.lastError = null;
      this.addLog('success', 'Successfully connected to Steam API');
      this.sendConnectionStatus();

      if (this.discordUserId) {
        await this.connectLanyard();
      } else {
        this.addLog('warn', 'No Discord User ID set - game tracking via Lanyard unavailable');
      }

      if (this.activeSubscriptions.size > 0) {
        this.startPolling();
      }
      
    } catch (error) {
      this.connectionStatus = 'error';
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.lastError = errorMsg;
      this.addLog('error', `Failed to connect to Steam API: ${errorMsg}`);
      this.sendConnectionStatus();
    }
  }

  public async disconnect() {
    this.stopPolling();
    this.disconnectLanyard();
    
    this.connectionStatus = 'disconnected';
    this.steamApi = null;
    this.addLog('info', 'Disconnected from Steam API');
    this.sendConnectionStatus();
    
    if (this.currentGameSession) {
      this.stopGameSession();
    }
  }

  public getCurrentGameSession(): GameSession | null {
    return this.currentGameSession;
  }

  public getStatus(): ConnectionInfo {
    return {
      status: this.connectionStatus,
      lastConnected: this.lastConnected,
      lastError: this.lastError,
      trackedSteamId: this.trackedSteamId
    };
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.addLog('info', 'Logs cleared');
    
    if (this.DeskThing) {
      this.DeskThing.send({ type: 'logs', payload: [] });
    }
  }

  public updateSettings(settings: any) {
    if (!settings) {
      this.addLog('warn', 'No settings provided');
      return;
    }

    try {
      const newApiKey = String(settings.steamApiKey?.value ?? settings.steamApiKey ?? this.steamApiKey);
      const newAutoConnect = Boolean(settings.autoConnect?.value ?? settings.autoConnect ?? true);
      const newMaxLogs = parseInt(String(settings.maxLogs?.value ?? settings.maxLogs ?? "100"));
      const newPollInterval = parseInt(String(settings.pollInterval?.value ?? settings.pollInterval ?? "30")) * 1000;
      const newSteamId = String(settings.trackedSteamId?.value ?? settings.trackedSteamId ?? this.trackedSteamId);
      const newDiscordId = String(settings.discordUserId?.value ?? settings.discordUserId ?? this.discordUserId);
      
      const apiKeyChanged = newApiKey !== this.steamApiKey;
      const discordIdChanged = newDiscordId !== this.discordUserId;
      const wasConnected = this.connectionStatus === 'connected';
      
      this.steamApiKey = newApiKey;
      this.autoConnect = newAutoConnect;
      this.maxLogs = newMaxLogs;
      this.pollInterval = newPollInterval;
      this.trackedSteamId = newSteamId;
      this.discordUserId = newDiscordId;

      this.addLog('info', `Settings updated - Auto-connect: ${this.autoConnect}`);

      if (discordIdChanged && this.lanyardConnected) {
        this.addLog('info', 'Discord ID changed - reconnecting Lanyard...');
        this.disconnectLanyard();
        this.connectLanyard();
      }

      if (apiKeyChanged && wasConnected) {
        this.addLog('info', 'API key changed while connected - reconnecting...');
        this.disconnect().then(() => {
          setTimeout(() => {
            this.connect();
          }, 500);
        });
      } else if (!wasConnected && newAutoConnect && newApiKey) {
        this.addLog('info', 'Initial connection with auto-connect enabled...');
        this.start();
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.addLog('error', `Error updating settings: ${errorMsg}`);
    }
  }

  public start() {
    this.addLog('info', 'Steam controller started');
    
    if (this.autoConnect && this.steamApiKey) {
      this.connect();
    }
  }

  public async stop() {
    this.addLog('info', 'Steam controller stopped');
    
    this.clearSubscriptions();
    await this.disconnect();
  }

  private async startPolling() {
    this.stopPolling();

    if (this.activeSubscriptions.size === 0) {
      this.addLog('info', 'No active subscriptions, skipping polling');
      return;
    }

    this.addLog('info', `Started polling Steam API for profile data every ${this.pollInterval / 1000}s`);

    const poll = async () => {
      if (!this.steamApi || !this.trackedSteamId) {
        return;
      }

      try {
        if (this.activeSubscriptions.has('player-summary')) {
          await this.requestPlayerSummary();
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.addLog('error', `Polling error: ${errorMsg}`);
      }
    };

    poll();
    
    this.pollTimer = setInterval(poll, this.pollInterval);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.addLog('info', 'Stopped polling Steam API');
    }
  }

  public async requestPlayerSummary() {
    if (!this.steamApi || !this.trackedSteamId) {
      this.addLog('warn', 'Cannot request player summary - not connected or no Steam ID');
      return;
    }

    try {
      const userService = this.steamApi.getUserService();
      const players = await userService.getPlayerSummaries({
        steamids: [this.trackedSteamId]
      });

      if (players && players.length > 0) {
        const player = players[0];
        
        if (player.avatarfull || player.avatarmedium || player.avatar) {
          const avatarUrl = player.avatarfull || player.avatarmedium || player.avatar;
          try {
            const response = await fetch(avatarUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              player.avatar = `data:image/jpeg;base64,${base64}`;
              player.avatarmedium = player.avatar;
              player.avatarfull = player.avatar;
            }
          } catch (err) {
            this.addLog('warn', `Failed to fetch avatar: ${err}`);
          }
        }
        
        if (this.DeskThing) {
          this.DeskThing.send({ 
            type: 'playerSummary', 
            payload: player as PlayerSummary
          });
        }
        
        this.addLog('info', `Player: ${player.personaname}`);
        
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.addLog('error', `Failed to request player summary: ${errorMsg}`);
    }
  }

  
private async readLocalImageAsBase64(fileName: string): Promise<string | null> {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const imagePath = path.join(appData, "deskthing", "apps", "steamthing", "client", fileName);
    
    this.addLog('info', `Reading local image from: ${imagePath}`);
    
    const imageBuffer = await fs.readFile(imagePath);
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;
    
    this.addLog('success', `Successfully converted local image to base64 (${Math.floor(base64.length / 1024)}KB)`);
    return dataUrl;
  } catch (err) {
    this.addLog('error', `Failed to read local image: ${err}`);
    return null;
  }
}

public async getGameImage(platform?: string): Promise<string | null> {
  if (platform) {
    const platformLower = platform.toLowerCase();
    
    if (platformLower === 'xbox') {
      this.addLog('info', 'Xbox platform detected - using Xbox logo');
      return await this.readLocalImageAsBase64('xbox.png');
    }
    
    if (platformLower === 'playstation') {
      this.addLog('info', 'PlayStation platform detected - using PlayStation logo');
      return await this.readLocalImageAsBase64('playstation.png');
    }
  }
  
  if (!this.steamApi || !this.trackedSteamId) {
    this.addLog('warn', 'Cannot get game image - not connected or no Steam ID');
    return null;
  }

  try {
    const userService = this.steamApi.getUserService();
    const players = await userService.getPlayerSummaries({
      steamids: [this.trackedSteamId]
    });

    if (players && players.length > 0) {
      const player = players[0];
      
      if (player.gameid) {
        const currentAppId = player.gameid;
        this.addLog('info', `Found currently playing game with app ID: ${currentAppId}`);
        
        const playerService = this.steamApi.getPlayerService();
        const recentGamesResponse = await playerService.getRecentlyPlayedGames({
          steamid: this.trackedSteamId,
          count: 10
        });

        if (recentGamesResponse?.response?.games) {
          const games = recentGamesResponse.response.games;
          const matchingGame = games.find((game: any) => game.appid === parseInt(currentAppId));
          
          if (matchingGame && matchingGame.img_icon_url) {
            const imageUrl = `https://media.steampowered.com/steamcommunity/public/images/apps/${matchingGame.appid}/${matchingGame.img_icon_url}.jpg`;
            this.addLog('info', `Fetching game icon from Steam CDN: ${matchingGame.name}`);
            
            const gameImageBase64 = await this.fetchImageAsBase64(imageUrl);
            
            if (gameImageBase64) {
              this.addLog('success', `Successfully fetched game image for: ${matchingGame.name}`);
              return gameImageBase64;
            }
          } else {
            this.addLog('warn', `Game with app ID ${currentAppId} not found in recently played games`);
          }
        }
      } else {
        this.addLog('info', 'Player is not currently in a game');
      }
    }
    
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.addLog('error', `Failed to get game image: ${errorMsg}`);
    return null;
  }
}


  private stopGameSession() {
    if (this.currentGameSession) {
      const finalElapsed = Date.now() - this.currentGameSession.startTime;
      this.addLog('info', `Game session ended. Duration: ${Math.floor(finalElapsed / 60000)} minutes`);
      
      this.currentGameSession = null;
      
      if (this.DeskThing) {
        this.DeskThing.send({ type: 'gameSession', payload: null });
      }
    }
  }

  public async getRecentlyPlayedGames(): Promise<RecentlyPlayedGame[]> {
    if (!this.steamApi || !this.trackedSteamId) {
      this.addLog('warn', 'Cannot get recently played games - not connected or no Steam ID');
      return [];
    }

    try {
      const playerService = this.steamApi.getPlayerService();
      const response = await playerService.getRecentlyPlayedGames({
        steamid: this.trackedSteamId,
        count: 10
      });

      if (response?.response?.games) {
        return response.response.games;
      }
      
      return [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.addLog('error', `Failed to get recently played games: ${errorMsg}`);
      return [];
    }
  }
}

export default SteamController.getInstance();
export { SteamController };