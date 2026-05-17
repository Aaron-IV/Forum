// chat.js — Chat sidebar (user list) + chat window (messages)

import * as api from '../api.js';
import * as ws from '../ws.js';
import { el, escapeHTML, formatChatTime, getInitial, throttle, debounce } from './utils.js';

let currentChatUser = null; // { id, nickname }
let messageOffset = 0;
let allMessagesLoaded = false;
let isLoadingMore = false;

/**
 * Renders the chat sidebar with user list.
 * @param {HTMLElement} container - The .main-layout element to append sidebar to.
 * @param {Object} currentUser - The logged-in user.
 */
export function renderChatSidebar(container, currentUser) {
    const sidebar = el('div', { className: 'chat-sidebar', id: 'chat-sidebar' }, [
        el('div', { className: 'chat-sidebar-header' }, [
            el('span', { textContent: 'Messages' }),
            el('span', { id: 'online-count', style: 'font-size:12px;color:var(--text-muted)' }),
        ]),
        el('div', { className: 'chat-users-list', id: 'chat-users-list' }),
    ]);

    container.appendChild(sidebar);

    // Chat window (hidden by default)
    const chatWindow = el('div', { className: 'chat-window hidden', id: 'chat-window' });
    document.body.appendChild(chatWindow);

    loadUserList(currentUser);

    // Listen for real-time user status changes
    ws.on('user_status', (payload) => {
        updateUserStatus(payload.userId, payload.online);
    });

    // Listen for real-time messages
    ws.on('message', (payload) => {
        handleIncomingMessage(payload, currentUser);
    });

    // Listen for typing indicators
    ws.on('typing', (payload) => {
        if (currentChatUser && payload.userId === currentChatUser.id) {
            showTypingIndicator();
        }
    });
}

async function loadUserList(currentUser) {
    const listEl = document.getElementById('chat-users-list');
    if (!listEl) return;

    try {
        const users = await api.getUsers();

        // Sort: users with last message first (by date desc), then alphabetically
        users.sort((a, b) => {
            if (a.lastMsgAt && b.lastMsgAt) {
                return new Date(b.lastMsgAt) - new Date(a.lastMsgAt);
            }
            if (a.lastMsgAt) return -1;
            if (b.lastMsgAt) return 1;
            return a.nickname.localeCompare(b.nickname);
        });

        listEl.innerHTML = '';

        if (users.length === 0) {
            listEl.appendChild(el('p', {
                style: 'padding:20px;text-align:center;color:var(--text-muted);font-size:13px',
                textContent: 'No other users yet',
            }));
            return;
        }

        users.forEach(user => {
            const item = el('div', {
                className: 'chat-user-item',
                id: `chat-user-${user.id}`,
                onClick: () => openChat(user, currentUser),
            }, [
                el('div', { className: 'chat-user-avatar' }, [
                    document.createTextNode(getInitial(user.nickname)),
                    el('span', { className: `status-dot ${user.online ? 'online' : ''}` }),
                ]),
                el('div', { className: 'chat-user-info' }, [
                    el('div', { className: 'chat-user-name', textContent: user.nickname }),
                    el('div', { className: 'chat-user-preview', textContent: user.online ? 'Online' : 'Offline' }),
                ]),
            ]);
            listEl.appendChild(item);
        });

        // Update online count
        const onlineCount = users.filter(u => u.online).length;
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.textContent = `${onlineCount} online`;

    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

function updateUserStatus(userId, online) {
    const item = document.getElementById(`chat-user-${userId}`);
    if (!item) return;

    const dot = item.querySelector('.status-dot');
    if (dot) {
        dot.className = `status-dot ${online ? 'online' : ''}`;
    }

    const preview = item.querySelector('.chat-user-preview');
    if (preview && !(currentChatUser && currentChatUser.id === userId)) {
        preview.textContent = online ? 'Online' : 'Offline';
    }

    // Update online count
    const dots = document.querySelectorAll('.status-dot.online');
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.textContent = `${dots.length} online`;
}

async function openChat(user, currentUser) {
    currentChatUser = user;
    messageOffset = 0;
    allMessagesLoaded = false;

    // Highlight active user
    document.querySelectorAll('.chat-user-item').forEach(i => i.classList.remove('active'));
    const userItem = document.getElementById(`chat-user-${user.id}`);
    if (userItem) userItem.classList.add('active');

    const chatWindow = document.getElementById('chat-window');
    chatWindow.className = 'chat-window';
    chatWindow.innerHTML = '';

    // Header
    chatWindow.appendChild(el('div', { className: 'chat-window-header' }, [
        el('h4', { textContent: user.nickname }),
        el('button', {
            className: 'chat-close-btn',
            textContent: '✕',
            onClick: () => closeChat(),
        }),
    ]));

    // Messages area
    const messagesEl = el('div', { className: 'chat-messages', id: 'chat-messages' });
    chatWindow.appendChild(messagesEl);

    // Typing indicator
    chatWindow.appendChild(el('div', { className: 'chat-typing', id: 'chat-typing' }));

    // Input area
    const inputEl = el('input', { type: 'text', id: 'chat-message-input', placeholder: 'Type a message...' });
    chatWindow.appendChild(el('div', { className: 'chat-input-area' }, [
        inputEl,
        el('button', {
            className: 'chat-send-btn',
            textContent: 'Send',
            id: 'chat-send-btn',
            onClick: () => sendMessage(currentUser),
        }),
    ]));

    // Enter to send
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage(currentUser);
    });

    // Typing indicator (debounced)
    const sendTyping = debounce(() => {
        if (currentChatUser) {
            ws.send('typing', { to: currentChatUser.id });
        }
    }, 500);
    inputEl.addEventListener('input', sendTyping);

    // Load messages
    await loadMessages(messagesEl, user.id, currentUser, true);

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Scroll up to load more (throttled)
    const handleScroll = throttle(async () => {
        if (messagesEl.scrollTop < 50 && !allMessagesLoaded && !isLoadingMore) {
            isLoadingMore = true;
            const prevHeight = messagesEl.scrollHeight;
            await loadMessages(messagesEl, user.id, currentUser, false);
            // Keep scroll position
            messagesEl.scrollTop = messagesEl.scrollHeight - prevHeight;
            isLoadingMore = false;
        }
    }, 1000);

    messagesEl.addEventListener('scroll', handleScroll);

    // Focus input
    inputEl.focus();
}

async function loadMessages(container, targetUserId, currentUser, isInitial) {
    if (allMessagesLoaded && !isInitial) return;

    if (!isInitial) {
        const loader = el('div', { className: 'chat-messages-loading', textContent: 'Loading...' });
        container.prepend(loader);
    }

    try {
        const messages = await api.getMessages(targetUserId, messageOffset);

        // Remove loader
        const loader = container.querySelector('.chat-messages-loading');
        if (loader) loader.remove();

        if (messages.length < 10) {
            allMessagesLoaded = true;
        }

        messageOffset += messages.length;

        if (isInitial) {
            container.innerHTML = '';
            if (messages.length === 0) {
                container.appendChild(el('div', {
                    className: 'empty-state',
                    style: 'padding:30px',
                }, [
                    el('p', { textContent: 'No messages yet. Say hi! 👋', style: 'color:var(--text-muted);font-size:13px' }),
                ]));
                return;
            }
            messages.forEach(m => appendMessage(container, m, currentUser, false));
        } else {
            // Prepend older messages
            const fragment = document.createDocumentFragment();
            messages.forEach(m => {
                const msgEl = createMessageEl(m, currentUser);
                fragment.appendChild(msgEl);
            });
            container.prepend(fragment);
        }
    } catch (err) {
        console.error('Failed to load messages:', err);
        const loader = container.querySelector('.chat-messages-loading');
        if (loader) loader.remove();
    }
}

function appendMessage(container, message, currentUser, scrollToBottom = true) {
    // Remove empty state if present
    const empty = container.querySelector('.empty-state');
    if (empty) empty.remove();

    const msgEl = createMessageEl(message, currentUser);
    container.appendChild(msgEl);

    if (scrollToBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

function createMessageEl(message, currentUser) {
    const isSent = message.senderId === currentUser.id;
    return el('div', { className: `chat-msg ${isSent ? 'sent' : 'received'}` }, [
        el('div', { textContent: message.content }),
        el('div', { className: 'chat-msg-meta' }, [
            el('span', { textContent: isSent ? 'You' : (message.senderName || 'User') }),
            el('span', { textContent: formatChatTime(message.createdAt) }),
        ]),
    ]);
}

function sendMessage(currentUser) {
    if (!currentChatUser) return;

    const input = document.getElementById('chat-message-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    ws.send('message', { to: currentChatUser.id, content });
    input.value = '';
    input.focus();
}

function handleIncomingMessage(payload, currentUser) {
    const messagesEl = document.getElementById('chat-messages');

    // If chat window is open with this user, append message
    if (currentChatUser && messagesEl) {
        const isRelevant = payload.senderId === currentChatUser.id || payload.receiverId === currentChatUser.id;
        if (isRelevant) {
            messageOffset++;
            appendMessage(messagesEl, payload, currentUser, true);
            // Clear typing indicator
            const typingEl = document.getElementById('chat-typing');
            if (typingEl) typingEl.textContent = '';
            return;
        }
    }

    // Update user list preview for other conversations
    const otherUserId = payload.senderId === currentUser.id ? payload.receiverId : payload.senderId;
    const userItem = document.getElementById(`chat-user-${otherUserId}`);
    if (userItem) {
        const preview = userItem.querySelector('.chat-user-preview');
        if (preview) {
            const truncated = payload.content.length > 30 ? payload.content.slice(0, 30) + '...' : payload.content;
            preview.textContent = truncated;
        }

        // Move user to top of list
        const list = document.getElementById('chat-users-list');
        if (list && list.firstChild !== userItem) {
            list.prepend(userItem);
        }
    }
}

let typingTimeout = null;
function showTypingIndicator() {
    const typingEl = document.getElementById('chat-typing');
    if (!typingEl) return;

    typingEl.textContent = `${currentChatUser.nickname} is typing...`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        typingEl.textContent = '';
    }, 2000);
}

function closeChat() {
    currentChatUser = null;
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) chatWindow.classList.add('hidden');

    document.querySelectorAll('.chat-user-item').forEach(i => i.classList.remove('active'));
}

/**
 * Cleans up the chat component.
 */
export function destroyChat() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) chatWindow.remove();
    currentChatUser = null;
}
