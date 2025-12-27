/**
 * Type definitions for Steam API DeskThing App with Game Tracking
 */

// Connection status
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// Log entry
export type LogEntry = {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
};

// Connection info
export type ConnectionInfo = {
  status: ConnectionStatus;
  lastConnected: number | null;
  lastError: string | null;
  trackedSteamId?: string;
};

// Player Summary (from Steam API ISteamUser/GetPlayerSummaries/v2)
export type PlayerSummary = {
  steamid: string;
  communityvisibilitystate: number;
  profilestate: number;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  avatarhash?: string;
  lastlogoff: number;
  personastate: number;
  realname?: string;
  primaryclanid?: string;
  timecreated?: number;
  personastateflags?: number;
  loccountrycode?: string;
  locstatecode?: string;
  loccityid?: number;
  gameextrainfo?: string;
  gameid?: string;
  commentpermission?: number;
};

// Recently Played Game
export type RecentlyPlayedGame = {
  appid: number;
  name: string;
  playtime_2weeks: number;
  playtime_forever: number;
  img_icon_url: string;
  playtime_windows_forever: number;
  playtime_mac_forever: number;
  playtime_linux_forever: number;
  playtime_deck_forever: number;
};

export interface GameSession {
  gameId: string;
  gameName: string;
  gameIconUrl: string | null;
  startTime: number;
  serverTime?: number; // Add this
  elapsedTime: number;
}
// Subscription data types
export type SubscriptionDataType = 'player-summary';

// App settings payload
export type AppSettingsPayload = {
  steamApiKey?: string | { value: string };
  autoConnect?: boolean | { value: boolean };
  pollInterval?: number | { value: number };
  maxLogs?: number | { value: number };
  trackedSteamId?: string | { value: string };
};

// Data sent to client from server
export type ToClientData = 
  | {
      type: 'connectionStatus';
      payload: ConnectionInfo;
    }
  | {
      type: 'log';
      payload: LogEntry;
    }
  | {
      type: 'logs';
      payload: LogEntry[];
    }
  | {
      type: 'playerSummary';
      payload: PlayerSummary;
    }
  | {
      type: 'gameSession';
      payload: GameSession | null;
    }
  | {
      type: 'settings';
      payload: AppSettingsPayload;
    };

// Data sent from client to server
export type GenericTransitData = 
  | {
      type: 'get';
      request: 'status' | 'logs' | 'gameSession';
      payload?: string;
    }
  | {
      type: 'connect';
      payload?: string;
    }
  | {
      type: 'disconnect';
      payload?: string;
    }
  | {
      type: 'clearLogs';
      payload?: string;
    }
  | {
      type: 'subscribe';
      request: SubscriptionDataType;
      payload?: string;
    }
  | {
      type: 'unsubscribe';
      request: SubscriptionDataType;
      payload?: string;
    }
  | {
      type: 'requestPlayerSummary';
      payload?: string;
    }
  | {
      type: 'setTrackedSteamId';
      payload: string;
    };

// App settings
export type SteamSettings = {
  steamApiKey: string;
  autoConnect: boolean;
  pollInterval: number;
  maxLogs: number;
  trackedSteamId: string;
};