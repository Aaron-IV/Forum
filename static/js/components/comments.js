// comments.js — Comments list and create comment form

import * as api from '../api.js';
import { el, escapeHTML, formatDate, getInitial } from './utils.js';

/**
 * Renders the comments section for a given post.
 * @param {HTMLElement} container - The #comments-section element.
 * @param {string} postId - The post ID.
 */
export async function renderComments(container, postId) {
    container.innerHTML = '';

    const section = el('div', { className: 'comments-section fade-in' });
    section.appendChild(el('h3', { textContent: 'Comments' }));

    // Comment input
    const addCommentEl = el('div', { className: 'add-comment' }, [
        el('input', { type: 'text', id: 'comment-input', placeholder: 'Write a comment...' }),
        el('button', {
            className: 'btn btn-secondary',
            textContent: 'Send',
            id: 'submit-comment-btn',
        }),
    ]);
    section.appendChild(addCommentEl);

    // Comments list container
    const listEl = el('div', { id: 'comments-list', style: 'margin-top:16px' });
    section.appendChild(listEl);

    container.appendChild(section);

    // Load comments
    await loadComments(listEl, postId);

    // Submit handler
    document.getElementById('submit-comment-btn').addEventListener('click', async () => {
        const input = document.getElementById('comment-input');
        const content = input.value.trim();
        if (!content) return;

        try {
            const comment = await api.createComment(postId, content);
            input.value = '';
            appendComment(listEl, comment);
        } catch (err) {
            console.error('Failed to create comment:', err);
        }
    });

    // Also submit on Enter
    document.getElementById('comment-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submit-comment-btn').click();
        }
    });
}

async function loadComments(container, postId) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
        const comments = await api.getComments(postId);
        container.innerHTML = '';
        if (comments.length === 0) {
            container.appendChild(el('p', {
                style: 'color:var(--text-muted);font-size:14px;padding:12px 0',
                textContent: 'No comments yet. Be the first!'
            }));
            return;
        }
        comments.forEach(c => appendComment(container, c));
    } catch (err) {
        container.innerHTML = '<p style="color:var(--danger)">Failed to load comments</p>';
    }
}

function appendComment(container, comment) {
    // Remove "no comments" message if present
    const noComments = container.querySelector('p');
    if (noComments && noComments.textContent.includes('No comments')) {
        noComments.remove();
    }

    const card = el('div', { className: 'comment-card fade-in' }, [
        el('div', { className: 'comment-header' }, [
            el('div', { className: 'comment-avatar', textContent: getInitial(comment.author) }),
            el('span', { className: 'comment-author', textContent: comment.author }),
            el('span', { className: 'comment-time', textContent: formatDate(comment.createdAt) }),
        ]),
        el('div', { className: 'comment-body', textContent: comment.content }),
    ]);

    container.appendChild(card);
}

/**
 * Adds a real-time comment to the list if currently viewing that post.
 */
export function addRealtimeComment(comment) {
    const listEl = document.getElementById('comments-list');
    if (listEl) {
        appendComment(listEl, comment);
    }
}
