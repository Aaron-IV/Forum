// app.js — Application bootstrap, global state, route setup

import * as api from './api.js';
import * as ws from './ws.js';
import * as router from './router.js';
import { renderLogin } from './components/auth.js';
import { renderNavbar } from './components/navbar.js';
import { renderFeed, renderSinglePost } from './components/posts.js';
import { renderComments } from './components/comments.js';
import { renderChatSidebar, destroyChat } from './components/chat.js';

// Global application state
const state = {
    user: null,
    isAuthenticated: false,
};

const app = document.getElementById('app');

/**
 * Initializes the application.
 */
async function init() {
    try {
        const user = await api.getMe();
        state.user = user;
        state.isAuthenticated = true;
        renderAuthenticatedApp();
    } catch (err) {
        state.user = null;
        state.isAuthenticated = false;
        renderUnauthenticatedApp();
    }
}

/**
 * Renders the app for unauthenticated users (login/register).
 */
function renderUnauthenticatedApp() {
    ws.disconnect();
    destroyChat();
    app.innerHTML = '';

    renderLogin(app, (user) => {
        state.user = user;
        state.isAuthenticated = true;
        renderAuthenticatedApp();
    });
}

/**
 * Renders the app for authenticated users (navbar + content + chat).
 */
function renderAuthenticatedApp() {
    app.innerHTML = '';

    // Navbar
    renderNavbar(app, state.user, () => {
        state.user = null;
        state.isAuthenticated = false;
        ws.disconnect();
        destroyChat();
        renderUnauthenticatedApp();
    });

    // Main layout: content area + chat sidebar
    const layout = document.createElement('div');
    layout.className = 'main-layout';

    const contentArea = document.createElement('div');
    contentArea.className = 'content-area';
    contentArea.id = 'content-area';
    layout.appendChild(contentArea);

    app.appendChild(layout);

    // Chat sidebar (always visible)
    renderChatSidebar(layout, state.user);

    // Connect WebSocket
    ws.connect();

    // Setup routes
    router.route('#/', () => {
        renderFeed(contentArea);
    });

    router.route('#/post/:id', (params) => {
        renderSinglePost(contentArea, params.id).then(() => {
            const commentsSection = document.getElementById('comments-section');
            if (commentsSection) {
                renderComments(commentsSection, params.id);
            }
        });
    });

    // Initialize router
    router.init();
}

// Handle unauthorized responses (session expired)
window.addEventListener('auth:unauthorized', () => {
    if (state.isAuthenticated) {
        state.user = null;
        state.isAuthenticated = false;
        ws.disconnect();
        destroyChat();
        renderUnauthenticatedApp();
    }
});

// Start the app
init();
