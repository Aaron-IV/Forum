// ws.js — WebSocket client with auto-reconnect

let socket = null;
let reconnectAttempts = 0;
let shouldReconnect = true;
let reconnectTimer = null;
const MAX_RECONNECT = 10;
const handlers = {};

/**
 * Connects to the WebSocket server.
 */
export function connect() {
    // Don't connect if already connected or connecting
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    shouldReconnect = true;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}/ws`);

    socket.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type && handlers[msg.type]) {
                handlers[msg.type].forEach(cb => cb(msg.payload));
            }
        } catch (e) {
            console.error('WS message parse error:', e);
        }
    };

    socket.onclose = (event) => {
        console.log('WebSocket closed:', event.code);
        const closedSocket = socket;
        socket = null;

        // Only reconnect if:
        // 1. We haven't been told to stop (disconnect() wasn't called)
        // 2. This is the current socket (not a stale one)
        // 3. Close wasn't a normal/intentional close
        if (shouldReconnect && event.code !== 1000) {
            attemptReconnect();
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

/**
 * Attempts to reconnect with exponential backoff.
 */
function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT) {
        console.log('Max reconnect attempts reached');
        return;
    }

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (shouldReconnect) {
            connect();
        }
    }, delay);
}

/**
 * Registers a handler for a specific message type.
 */
export function on(type, callback) {
    if (!handlers[type]) handlers[type] = [];
    handlers[type].push(callback);
}

/**
 * Removes a handler for a specific message type.
 */
export function off(type, callback) {
    if (!handlers[type]) return;
    handlers[type] = handlers[type].filter(cb => cb !== callback);
}

/**
 * Sends a message through the WebSocket.
 */
export function send(type, payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, payload }));
    }
}

/**
 * Disconnects the WebSocket.
 */
export function disconnect() {
    shouldReconnect = false;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    reconnectAttempts = 0;
    if (socket) {
        socket.close(1000, 'logout');
        socket = null;
    }
}

