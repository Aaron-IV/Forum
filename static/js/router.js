// router.js — Simple hash-based SPA router

const routes = {};
let currentCleanup = null;

/**
 * Registers a route handler.
 * @param {string} pattern - Route pattern like '#/' or '#/post/:id'
 * @param {Function} handler - Function to call when route matches. Receives params object.
 */
export function route(pattern, handler) {
    routes[pattern] = handler;
}

/**
 * Navigates to a hash route.
 */
export function navigate(hash) {
    window.location.hash = hash;
}

/**
 * Resolves the current hash and calls the matching route handler.
 */
export function resolve() {
    const hash = window.location.hash || '#/';

    // Cleanup previous route
    if (currentCleanup && typeof currentCleanup === 'function') {
        currentCleanup();
        currentCleanup = null;
    }

    // Try exact match first
    if (routes[hash]) {
        currentCleanup = routes[hash]({});
        return;
    }

    // Try pattern matching (e.g., #/post/:id)
    for (const [pattern, handler] of Object.entries(routes)) {
        const params = matchRoute(pattern, hash);
        if (params) {
            currentCleanup = handler(params);
            return;
        }
    }

    // Default to home
    if (routes['#/']) {
        currentCleanup = routes['#/']({});
    }
}

/**
 * Matches a route pattern against a hash.
 * Returns params object or null.
 */
function matchRoute(pattern, hash) {
    const patternParts = pattern.split('/');
    const hashParts = hash.split('/');

    if (patternParts.length !== hashParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = hashParts[i];
        } else if (patternParts[i] !== hashParts[i]) {
            return null;
        }
    }

    return params;
}

/**
 * Initializes the router by listening to hash changes.
 */
export function init() {
    window.addEventListener('hashchange', resolve);
    resolve();
}
