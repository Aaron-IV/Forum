// chat.js — Chat sidebar (user list) + chat window (messages)

import * as api from '../api.js';
import * as ws from '../ws.js';
import { el, formatMessageDateTime, getInitial, throttle, debounce, showToast } from './utils.js';

let currentChatUser = null;
let messageOffset = 0;
let allMessagesLoaded = false;
let isLoadingMore = false;
let usersCache = [];
let loggedInUser = null;
const unreadByUser = new Map();

function sortUsers(users) {
    return [...users].sort((a, b) => {
        if (a.lastMsgAt && b.lastMsgAt) {
            return new Date(b.lastMsgAt) - new Date(a.lastMsgAt);
        }
        if (a.lastMsgAt) return -1;
        if (b.lastMsgAt) return 1;
        return a.nickname.localeCompare(b.nickname);
    });
}

function sortOnlineUsers(users) {
    return [...users].sort((a, b) => a.nickname.localeCompare(b.nickname));
}

function getUnreadCount(userId) {
    return unreadByUser.get(userId) || 0;
}

function setUnreadCount(userId, count) {
    if (count <= 0) {
        unreadByUser.delete(userId);
    } else {
        unreadByUser.set(userId, count);
    }
    updateUnreadBadge(userId);
}

function incrementUnread(userId) {
    setUnreadCount(userId, getUnreadCount(userId) + 1);
}

function clearUnread(userId) {
    setUnreadCount(userId, 0);
}

function updateUnreadBadge(userId) {
    const badge = document.getElementById(`unread-${userId}`);
    const count = getUnreadCount(userId);
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.add('visible');
    } else {
        badge.textContent = '';
        badge.classList.remove('visible');
    }
}

function createChatUserItem(user, currentUser, previewText) {
    const unread = getUnreadCount(user.id);
    const infoChildren = [
        el('div', { className: 'chat-user-name', textContent: user.nickname }),
        el('div', { className: 'chat-user-preview', textContent: previewText }),
    ];

    const item = el('div', {
        className: 'chat-user-item',
        id: `chat-user-${user.id}`,
        onClick: () => openChat(user, currentUser),
    }, [
        el('div', { className: 'chat-user-avatar' }, [
            document.createTextNode(getInitial(user.nickname)),
            el('span', { className: `status-dot ${user.online ? 'online' : ''}` }),
        ]),
        el('div', { className: 'chat-user-info' }, infoChildren),
        el('span', { className: 'chat-unread-badge', id: `unread-${user.id}`, textContent: unread > 0 ? String(unread) : '' }),
    ]);

    if (unread > 0) {
        item.querySelector('.chat-unread-badge').classList.add('visible');
    }

    return item;
}

function createOnlineUserItem(user, currentUser) {
    return el('div', {
        className: 'chat-online-item',
        id: `chat-online-${user.id}`,
        onClick: () => openChat(user, currentUser),
    }, [
        el('div', { className: 'chat-user-avatar' }, [
            document.createTextNode(getInitial(user.nickname)),
            el('span', { className: 'status-dot online' }),
        ]),
        el('span', { className: 'chat-online-name', textContent: user.nickname }),
    ]);
}

function renderOnlineSection() {
    const onlineList = document.getElementById('online-users-list');
    const countEl = document.getElementById('online-count');
    if (!onlineList) return;

    const onlineUsers = sortOnlineUsers(usersCache.filter(u => u.online));
    onlineList.innerHTML = '';

    if (onlineUsers.length === 0) {
        onlineList.appendChild(el('p', {
            className: 'chat-section-empty',
            textContent: 'No one online',
        }));
    } else {
        onlineUsers.forEach(user => onlineList.appendChild(createOnlineUserItem(user, loggedInUser)));
    }

    if (countEl) {
        countEl.textContent = `${onlineUsers.length} online`;
    }
}

function renderConversationsList() {
    const listEl = document.getElementById('chat-users-list');
    if (!listEl) return;

    const sorted = sortUsers(usersCache);
    listEl.innerHTML = '';

    if (sorted.length === 0) {
        listEl.appendChild(el('p', {
            className: 'chat-section-empty',
            textContent: 'No other users yet',
        }));
        return;
    }

    sorted.forEach(user => {
        const preview = user.lastPreview || (user.online ? 'Online' : 'Offline');
        listEl.appendChild(createChatUserItem(user, loggedInUser, preview));
    });
}

function renderUserLists() {
    renderOnlineSection();
    renderConversationsList();
}

/**
 * Renders the chat sidebar with user list.
 */
export function renderChatSidebar(container, currentUser) {
    loggedInUser = currentUser;
    unreadByUser.clear();

    const sidebar = el('div', { className: 'chat-sidebar', id: 'chat-sidebar' }, [
        el('div', { className: 'chat-sidebar-header' }, [
            el('span', { textContent: 'Messages' }),
        ]),
        el('div', { className: 'chat-online-section' }, [
            el('div', { className: 'chat-section-label' }, [
                el('span', { textContent: 'Online' }),
                el('span', { id: 'online-count', className: 'online-count-badge' }),
            ]),
            el('div', { className: 'online-users-list', id: 'online-users-list' }),
        ]),
        el('div', { className: 'chat-conversations-section' }, [
            el('div', { className: 'chat-section-label', textContent: 'Conversations' }),
            el('div', { className: 'chat-users-list', id: 'chat-users-list' }),
        ]),
    ]);

    container.appendChild(sidebar);

    const chatWindow = el('div', { className: 'chat-window hidden', id: 'chat-window' });
    document.body.appendChild(chatWindow);

    loadUserList(currentUser);

    ws.on('user_status', (payload) => {
        updateUserStatus(payload.userId, payload.online);
    });

    ws.on('message', (payload) => {
        handleIncomingMessage(payload, currentUser);
    });

    ws.on('typing', (payload) => {
        if (currentChatUser && payload.userId === currentChatUser.id) {
            showTypingIndicator();
        }
    });
}

async function loadUserList(currentUser) {
    try {
        const users = await api.getUsers();
        usersCache = users.map(u => ({
            ...u,
            lastPreview: u.online ? 'Online' : 'Offline',
        }));
        renderUserLists();
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

function updateUserStatus(userId, online) {
    const user = usersCache.find(u => u.id === userId);
    if (user) {
        user.online = online;
        if (!user.lastPreview || user.lastPreview === 'Online' || user.lastPreview === 'Offline') {
            user.lastPreview = online ? 'Online' : 'Offline';
        }
    }

    const item = document.getElementById(`chat-user-${userId}`);
    if (item) {
        const dot = item.querySelector('.status-dot');
        if (dot) dot.className = `status-dot ${online ? 'online' : ''}`;

        const preview = item.querySelector('.chat-user-preview');
        if (preview && !(currentChatUser && currentChatUser.id === userId)) {
            if (!user?.lastPreview || user.lastPreview === 'Online' || user.lastPreview === 'Offline') {
                preview.textContent = online ? 'Online' : 'Offline';
            }
        }
    }

    renderOnlineSection();
}

function updateConversationPreview(userId, text) {
    const user = usersCache.find(u => u.id === userId);
    if (user) user.lastPreview = text;

    const preview = document.querySelector(`#chat-user-${userId} .chat-user-preview`);
    if (preview) preview.textContent = text;
}

async function openChat(user, currentUser) {
    currentChatUser = user;
    messageOffset = 0;
    allMessagesLoaded = false;
    clearUnread(user.id);

    document.querySelectorAll('.chat-user-item, .chat-online-item').forEach(i => i.classList.remove('active'));
    const userItem = document.getElementById(`chat-user-${user.id}`);
    const onlineItem = document.getElementById(`chat-online-${user.id}`);
    if (userItem) userItem.classList.add('active');
    if (onlineItem) onlineItem.classList.add('active');

    const chatWindow = document.getElementById('chat-window');
    chatWindow.className = 'chat-window';
    chatWindow.innerHTML = '';

    chatWindow.appendChild(el('div', { className: 'chat-window-header' }, [
        el('h4', { textContent: user.nickname }),
        el('button', {
            className: 'chat-close-btn',
            textContent: '✕',
            onClick: () => closeChat(),
        }),
    ]));

    const messagesEl = el('div', { className: 'chat-messages', id: 'chat-messages' });
    chatWindow.appendChild(messagesEl);
    chatWindow.appendChild(el('div', { className: 'chat-typing', id: 'chat-typing' }));

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

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage(currentUser);
    });

    const sendTyping = debounce(() => {
        if (currentChatUser) {
            ws.send('typing', { to: currentChatUser.id });
        }
    }, 500);
    inputEl.addEventListener('input', sendTyping);

    await loadMessages(messagesEl, user.id, currentUser, true);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const handleScroll = throttle(async () => {
        if (messagesEl.scrollTop < 50 && !allMessagesLoaded && !isLoadingMore) {
            isLoadingMore = true;
            const prevHeight = messagesEl.scrollHeight;
            await loadMessages(messagesEl, user.id, currentUser, false);
            messagesEl.scrollTop = messagesEl.scrollHeight - prevHeight;
            isLoadingMore = false;
        }
    }, 1000);

    messagesEl.addEventListener('scroll', handleScroll);
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
                    el('p', { textContent: 'No messages yet. Say hi!', style: 'color:var(--text-muted);font-size:13px' }),
                ]));
                return;
            }
            messages.forEach(m => appendMessage(container, m, currentUser, false));
        } else {
            const fragment = document.createDocumentFragment();
            messages.forEach(m => fragment.appendChild(createMessageEl(m, currentUser)));
            container.prepend(fragment);
        }
    } catch (err) {
        console.error('Failed to load messages:', err);
        const loader = container.querySelector('.chat-messages-loading');
        if (loader) loader.remove();
    }
}

function appendMessage(container, message, currentUser, scrollToBottom = true) {
    const empty = container.querySelector('.empty-state');
    if (empty) empty.remove();

    container.appendChild(createMessageEl(message, currentUser));

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
            el('span', { textContent: formatMessageDateTime(message.createdAt) }),
        ]),
    ]);
}

async function sendMessage(currentUser) {
    if (!currentChatUser) return;

    const input = document.getElementById('chat-message-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    const messagesEl = document.getElementById('chat-messages');
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    try {
        const message = await api.sendMessage(currentChatUser.id, content);
        input.value = '';
        if (messagesEl) {
            messageOffset++;
            appendMessage(messagesEl, message, currentUser, true);
        }
        const truncated = content.length > 30 ? content.slice(0, 30) + '...' : content;
        updateConversationPreview(currentChatUser.id, truncated);
        input.focus();
    } catch (err) {
        showToast('Message not sent', err.message || 'Try again');
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function handleIncomingMessage(payload, currentUser) {
    const messagesEl = document.getElementById('chat-messages');
    const otherUserId = payload.senderId === currentUser.id ? payload.receiverId : payload.senderId;
    const sender = usersCache.find(u => u.id === payload.senderId);
    const senderName = payload.senderName || sender?.nickname || 'User';

    if (currentChatUser && messagesEl) {
        const isRelevant = payload.senderId === currentChatUser.id || payload.receiverId === currentChatUser.id;
        if (isRelevant) {
            messageOffset++;
            appendMessage(messagesEl, payload, currentUser, true);
            const typingEl = document.getElementById('chat-typing');
            if (typingEl) typingEl.textContent = '';
            if (payload.senderId !== currentUser.id) {
                clearUnread(currentChatUser.id);
            }
            return;
        }
    }

    const truncated = payload.content.length > 30 ? payload.content.slice(0, 30) + '...' : payload.content;
    updateConversationPreview(otherUserId, truncated);

    const userItem = document.getElementById(`chat-user-${otherUserId}`);
    if (userItem) {
        const list = document.getElementById('chat-users-list');
        if (list && list.firstChild !== userItem) {
            list.prepend(userItem);
        }
    }

    const cached = usersCache.find(u => u.id === otherUserId);
    if (cached) {
        cached.lastMsgAt = payload.createdAt || new Date().toISOString();
        cached.lastPreview = truncated;
    }

    if (payload.senderId !== currentUser.id) {
        incrementUnread(otherUserId);
        showToast(
            `New message from ${senderName}`,
            truncated,
            () => {
                const user = usersCache.find(u => u.id === otherUserId);
                if (user) openChat(user, currentUser);
            }
        );
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

    document.querySelectorAll('.chat-user-item, .chat-online-item').forEach(i => i.classList.remove('active'));
}

export function destroyChat() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) chatWindow.remove();

    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) toastContainer.remove();

    currentChatUser = null;
    usersCache = [];
    loggedInUser = null;
    unreadByUser.clear();
}
