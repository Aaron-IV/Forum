// api.js — HTTP API client wrapper

const BASE = '';

async function request(url, options = {}) {
    const res = await fetch(BASE + url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    const data = await res.json().catch(() => null);

    if (!data) throw new Error('Invalid response');

    if (!res.ok) {
        if (res.status === 401) {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Auth
export function register(data) {
    return request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
}

export function login(data) {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
}

export function logout() {
    return request('/api/auth/logout', { method: 'POST' });
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
