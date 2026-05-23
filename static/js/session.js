// session.js — Per-tab session token (sessionStorage is isolated per browser tab/window)

const TOKEN_KEY = 'forum_session_token';

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
    if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    }
}

export function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
}
