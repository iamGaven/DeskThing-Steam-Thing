import {
  AppSettings,
  DESKTHING_EVENTS,
  SETTING_TYPES,
} from "@deskthing/types";
import { createDeskThing } from "@deskthing/server";
import steamController from "./steamcontroller";
import { ToClientData, GenericTransitData } from "./types";

const DeskThing = createDeskThing<GenericTransitData, ToClientData>();

console.log("=== INITIALIZING STEAM API APP ===");

// Track settings initialization state
let settingsInitialized = false;
let initialSettingsApplied = false;
let lastKnownSettings: any = null;

// Replace your DeskThing.on("get", ...) handler with this:

DeskThing.on("get", async (data: any) => {
  console.log("=== GET REQUEST RECEIVED ===");
  console.log("Request type:", data?.payload?.request || data?.request);
  
  const request = data?.payload?.request || data?.request;
  
  if (request === "status") {
    console.log("Status request - sending connection status");
    const status = steamController.getStatus();
    DeskThing.send({ type: 'connectionStatus', payload: status });
  } 
  else if (request === "logs") {
    console.log("Logs request - sending logs");
    const logs = steamController.getLogs();
    DeskThing.send({ type: 'logs', payload: logs });
  }
  else if (request === "gameSession") {
    console.log("=== SERVER: RECEIVED gameSession REQUEST ===");
    const currentSession = steamController.getCurrentGameSession();
    console.log("=== SERVER: CURRENT SESSION ===", {
      hasSession: !!currentSession,
      gameId: currentSession?.gameId,
      gameName: currentSession?.gameName,
      startTime: currentSession?.startTime
    });
    console.log("=== SERVER: SENDING gameSession RESPONSE ===");
    DeskThing.send({ type: 'gameSession', payload: currentSession });
  }
  else {
    console.log("Unknown request type:", request);
  }
});

// Handle subscription requests
DeskThing.on("subscribe", (data: any) => {
  const dataType = data?.request || data?.payload?.request;
  
  if (dataType === 'player-summary') {
    steamController.subscribe(dataType);
    console.log(`✓ Subscribed to ${dataType}`);
  } else {
    console.warn(`✗ Invalid subscription type: "${dataType}"`);
  }
});

DeskThing.on("unsubscribe", (data: any) => {
  const dataType = data?.request || data?.payload?.request;
  
  if (dataType === 'player-summary') {
    steamController.unsubscribe(dataType);
    console.log(`✓ Unsubscribed from ${dataType}`);
  } else {
    console.warn(`✗ Invalid unsubscription type: "${dataType}"`);
  }
});

// Handle connection control from client
DeskThing.on("connect", () => {
  console.log("Connect request from client");
  steamController.connect();
});

DeskThing.on("disconnect", () => {
  console.log("Disconnect request from client");
  steamController.disconnect();
});

DeskThing.on("clearLogs", () => {
  console.log("Clear logs request from client");
  steamController.clearLogs();
});

// Handle player summary request
DeskThing.on("requestPlayerSummary", () => {
  console.log("Request player summary");
  steamController.requestPlayerSummary();
});

// Helper to extract Steam-related settings only
function extractSteamSettings(settings: any) {
  return {
    steamApiKey: settings.steamApiKey?.value ?? settings.steamApiKey,
    trackedSteamId: settings.trackedSteamId?.value ?? settings.trackedSteamId,
    discordUserId: settings.discordUserId?.value ?? settings.discordUserId,
    autoConnect: settings.autoConnect?.value ?? settings.autoConnect,
    pollInterval: settings.pollInterval?.value ?? settings.pollInterval,
    maxLogs: settings.maxLogs?.value ?? settings.maxLogs,
  };
}

// Helper to check if Steam settings changed
function steamSettingsChanged(oldSettings: any, newSettings: any): boolean {
  if (!oldSettings || !newSettings) return true;
  
  const oldSteam = extractSteamSettings(oldSettings);
  const newSteam = extractSteamSettings(newSettings);
  
  return JSON.stringify(oldSteam) !== JSON.stringify(newSteam);
}

// Handle settings updates
DeskThing.on(DESKTHING_EVENTS.SETTINGS, (settings) => {
  console.log("=== SETTINGS UPDATE RECEIVED ===");
  
  if (!settings?.payload) {
    console.log("No payload in settings");
    return;
  }

  const currentSettings = settings.payload;

  // Always forward settings to client for UI updates
  console.log("Forwarding settings to client");
  // @ts-ignore - Custom settings event
  DeskThing.send({ type: 'settings', payload: currentSettings });

  // Apply settings only once on initialization or when they actually change
  if (!initialSettingsApplied) {
    console.log("Applying initial Steam settings");
    steamController.updateSettings(currentSettings);
    initialSettingsApplied = true;
    lastKnownSettings = currentSettings;
  } else {
    // Check if Steam settings actually changed
    const settingsChanged = steamSettingsChanged(lastKnownSettings, currentSettings);
    
    if (settingsChanged) {
      console.log("Steam settings changed - updating controller");
      steamController.updateSettings(currentSettings);
    } else {
      console.log("No relevant settings changed - no update needed");
    }
    
    lastKnownSettings = currentSettings;
  }
});

const setupSettings = async () => {
  console.log("Setting up Steam API settings...");
  
  const settings: AppSettings = {
    steamApiKey: {
      label: "Steam API Key",
      id: "steamApiKey",
      value: "",
      description: "Your Steam API key from https://steamcommunity.com/dev/apikey",
      type: SETTING_TYPES.STRING,
    },
    trackedSteamId: {
      label: "Steam ID",
      id: "trackedSteamId",
      value: "",
      description: "The Steam ID (64-bit) of the player to track",
      type: SETTING_TYPES.STRING,
    },
    discordUserId: {
      label: "Discord User ID",
      id: "discordUserId",
      value: "",
      description: "Your Discord User ID for real-time game tracking via Lanyard. Enable Developer Mode in Discord > Right-click your profile > Copy User ID",
      type: SETTING_TYPES.STRING,
    },
    autoConnect: {
      label: "Auto Connect",
      id: "autoConnect",
      value: true,
      description: "Automatically connect to Steam API on startup",
      type: SETTING_TYPES.BOOLEAN,
    },
    pollInterval: {
      label: "Poll Interval (seconds)",
      id: "pollInterval",
      value: 30,
      description: "How often to fetch player profile data from Steam (in seconds)",
      type: SETTING_TYPES.NUMBER,
      min: 10,
      max: 300,
    },
    maxLogs: {
      label: "Maximum Logs",
      id: "maxLogs",
      value: 100,
      description: "Maximum number of log entries to keep",
      type: SETTING_TYPES.NUMBER,
      min: 10,
      max: 1000,
    },
  };

  await DeskThing.initSettings(settings);
  settingsInitialized = true;
  console.log("Settings initialized");
};

const start = async () => {
  console.log("=== STARTING STEAM API APP ===");
  
  steamController.setDeskThing(DeskThing);
  await setupSettings();
  
  // Start controller but don't auto-connect yet
  // Wait for settings to be applied first
  console.log("Steam controller ready, waiting for settings...");
  
  console.log("=== STEAM API APP STARTED SUCCESSFULLY ===");
  
  // Send initial status after a delay
  setTimeout(() => {
    console.log("Sending initial status to client");
    const status = steamController.getStatus();
    DeskThing.send({ type: 'connectionStatus', payload: status });
    
    const logs = steamController.getLogs();
    DeskThing.send({ type: 'logs', payload: logs });
  }, 1000);
};

const stop = async () => {
  console.log("=== STOPPING STEAM API APP ===");
  await steamController.stop();
  
  // Reset state
  settingsInitialized = false;
  initialSettingsApplied = false;
  lastKnownSettings = null;
};

// Register event handlers
DeskThing.on(DESKTHING_EVENTS.STOP, stop);
DeskThing.on(DESKTHING_EVENTS.START, start);

console.log("=== SERVER FILE LOADED, WAITING FOR START EVENT ===");