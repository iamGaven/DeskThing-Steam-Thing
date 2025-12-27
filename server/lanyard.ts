"use strict";

// Add WebSocket import for Node.js environment
import WebSocket from 'ws';

const CONSTANTS = {
    API_URL: "https://api.lanyard.rest/v1",
    WEBSOCKET_URL: "wss://api.lanyard.rest/socket",
    HEARTBEAT_PERIOD: 1000 * 30
};

interface LanyardOptions {
    userId: string | string[];
    socket?: boolean;
    onPresenceUpdate?: (data: any) => void;
}

export function lanyard(opts: LanyardOptions & { socket: true; onPresenceUpdate: (data: any) => void }): WebSocket;
export function lanyard(opts: LanyardOptions & { socket?: false }): Promise<any>;
export function lanyard(opts: LanyardOptions): WebSocket | Promise<any> {
    if (!opts) throw new Error("Specify an options object");
    if (!opts.userId) throw new Error("Specify a user ID");
    
    if (opts.socket) {
        if (!opts.onPresenceUpdate) throw new Error("Specify onPresenceUpdate callback");
        
        // Remove browser check - WebSocket is available via 'ws' package in Node.js
        const socket = new WebSocket(CONSTANTS.WEBSOCKET_URL);
        const subscription = typeof opts.userId === "string" ? "subscribe_to_id" : "subscribe_to_ids";
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        
        socket.addEventListener("open", () => {
            socket.send(
                JSON.stringify({
                    op: 2,
                    d: {
                        [subscription]: opts.userId,
                    },
                }),
            );
            
            heartbeat = setInterval(() => {
                socket.send(
                    JSON.stringify({
                        op: 3,
                    }),
                );
            }, CONSTANTS.HEARTBEAT_PERIOD);
        });
        
        socket.addEventListener("message", (event: WebSocket.MessageEvent) => {
            // In Node.js WebSocket, data might be a Buffer
            const rawData = event.data;
            const data = typeof rawData === 'string' 
                ? rawData 
                : Buffer.isBuffer(rawData)
                    ? rawData.toString()
                    : String(rawData);
            
            const { t, d } = JSON.parse(data);
            
            if (t === "INIT_STATE" || t === "PRESENCE_UPDATE") {
                opts.onPresenceUpdate!(d);
            }
        });
        
        socket.addEventListener("close", (event: WebSocket.CloseEvent) => {
            try {
                console.log("Socket closed");
                if (heartbeat) clearInterval(heartbeat);
                setTimeout(() => {
                    console.log("Trying to reconnect");
                    lanyard(opts as any);
                }, 3000);
            } catch(err) {
                console.log("Socket closed", err);
            }
            console.log(event);
        });
        
        return socket;
    } else {
        return (async () => {
            if (typeof opts.userId === "string") {
                const res = await fetch(`${CONSTANTS.API_URL}/users/${opts.userId}`);
                const body = await res.json();
                
                if (!body.success) throw new Error(body.error?.message || "An invalid error occured");
                
                return body.data;
            } else {
                const val = [];
                
                for (const userId of opts.userId) {
                    const res = await fetch(`${CONSTANTS.API_URL}/users/${userId}`);
                    const body = await res.json();
                    
                    if (!body.success) throw new Error(body.error?.message || "An invalid error occured");
                    
                    val.push(body.data);
                }
                
                return val;
            }
        })();
    }
}