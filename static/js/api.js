// api.js — HTTP API client wrapper

import { getToken, setToken, clearToken } from './session.js';

const BASE = '';

async function request(url, options = {}) {
    const { headers: optHeaders, ...rest } = options;
    const headers = { 'Content-Type': 'application/json', ...optHeaders };
    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(BASE + url, {
        credentials: 'same-origin',
        ...rest,
        headers,
    });

    const data = await res.json().catch(() => null);

    if (!data) throw new Error('Invalid response');

    if (!res.ok) {
        if (res.status === 401) {
            clearToken();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Auth
export async function register(data) {
    const user = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
    if (user.token) setToken(user.token);
    return user;
}

export async function login(data) {
    const user = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
    if (user.token) setToken(user.token);
    return user;
}

export async function logout() {
    try {
        await request('/api/auth/logout', { method: 'POST' });
    } finally {
        clearToken();
    }
}

export function getMe() {
    return request('/api/auth/me');
}

// Posts
export function getPosts(category = '') {
    const q = category ? `?category=${encodeURIComponent(category)}` : '';
    return request(`/api/posts${q}`);
}

export function createPost(data) {
    return request('/api/posts', { method: 'POST', body: JSON.stringify(data) });
}

export function getPost(id) {
    return request(`/api/posts/${id}`);
}

// Comments
export function getComments(postId) {
    return request(`/api/posts/${postId}/comments`);
}

export function createComment(postId, content) {
    return request(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
    });
}

// Users
export function getUsers() {
    return request('/api/users');
}

// Messages
export function getMessages(userId, offset = 0) {
    return request(`/api/messages/${userId}?offset=${offset}`);
}

export function sendMessage(userId, content) {
    return request(`/api/messages/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
    });
}
