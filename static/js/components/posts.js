// posts.js — Post feed, create post form, single post view

import * as api from '../api.js';
import { el, escapeHTML, formatDate, getInitial } from './utils.js';
import { navigate } from '../router.js';

const CATEGORIES = ['general', 'tech', 'gaming', 'music', 'sports', 'news', 'random'];

/**
 * Renders the post feed with create form and category filters.
 */
export async function renderFeed(container) {
    container.innerHTML = '';

    // Header
    const header = el('div', { className: 'feed-header' }, [
        el('h2', { textContent: 'Posts' }),
        el('button', {
            className: 'btn btn-secondary',
            textContent: '+ New Post',
            id: 'toggle-create-post',
        }),
    ]);
    container.appendChild(header);

    // Create post form (hidden by default)
    const createForm = renderCreatePostForm(() => loadPosts(postsContainer, activeCategory));
    createForm.style.display = 'none';
    container.appendChild(createForm);

    document.getElementById('toggle-create-post').addEventListener('click', () => {
        createForm.style.display = createForm.style.display === 'none' ? 'block' : 'none';
    });

    // Category filters
    let activeCategory = '';
    const filters = el('div', { className: 'category-filters' });
    const allTag = el('span', { className: 'category-tag active', textContent: 'All', onClick: () => {
        activeCategory = '';
        updateActiveFilter(filters, allTag);
        loadPosts(postsContainer, activeCategory);
    }});
    filters.appendChild(allTag);

    CATEGORIES.forEach(cat => {
        const tag = el('span', { className: 'category-tag', textContent: cat, onClick: () => {
            activeCategory = cat;
            updateActiveFilter(filters, tag);
            loadPosts(postsContainer, activeCategory);
        }});
        filters.appendChild(tag);
    });
    container.appendChild(filters);

    // Posts list
    const postsContainer = el('div', { id: 'posts-list' });
    container.appendChild(postsContainer);

    await loadPosts(postsContainer, activeCategory);
}

function updateActiveFilter(filtersEl, activeEl) {
    filtersEl.querySelectorAll('.category-tag').forEach(t => t.classList.remove('active'));
    activeEl.classList.add('active');
}

async function loadPosts(container, category) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
        const posts = await api.getPosts(category);
        container.innerHTML = '';
        if (posts.length === 0) {
            container.appendChild(el('div', { className: 'empty-state' }, [
                el('div', { className: 'empty-state-icon', textContent: '📝' }),
                el('h3', { textContent: 'No posts yet' }),
                el('p', { textContent: 'Be the first to start a discussion!' }),
            ]));
            return;
        }
        posts.forEach(post => container.appendChild(renderPostCard(post)));
    } catch (err) {
        container.innerHTML = `<p style="color:var(--danger)">Failed to load posts</p>`;
    }
}

function renderPostCard(post) {
    const cats = post.categories ? post.categories.split(',').map(c => c.trim()) : [];
    const card = el('div', { className: 'post-card fade-in', onClick: () => navigate(`#/post/${post.id}`) }, [
        el('div', { className: 'post-card-header' }, [
            el('div', { className: 'post-author-avatar', textContent: getInitial(post.author) }),
            el('div', { className: 'post-author-info' }, [
                el('div', { className: 'post-author-name', textContent: post.author }),
                el('div', { className: 'post-time', textContent: formatDate(post.createdAt) }),
            ]),
        ]),
        el('h3', { textContent: post.title }),
        el('div', { className: 'post-card-content', textContent: post.content }),
        el('div', { className: 'post-card-footer' }, [
            el('span', { className: 'post-stat', textContent: `💬 ${post.commentCount} comments` }),
            el('div', { className: 'post-categories' },
                cats.map(c => el('span', { className: 'tag', textContent: c }))
            ),
        ]),
    ]);
    return card;
}

function renderCreatePostForm(onCreated) {
    const form = el('div', { className: 'create-post-form fade-in', id: 'create-post-section' }, [
        el('h3', { textContent: 'Create a New Post' }),
        el('div', { className: 'form-error', id: 'create-post-error' }),
        el('input', { type: 'text', id: 'post-title', placeholder: 'Post title...' }),
        el('textarea', { id: 'post-content', placeholder: 'What\'s on your mind?' }),
        el('div', { className: 'form-group', style: 'margin-top:12px' }, [
            el('label', { textContent: 'Categories (comma-separated)' }),
            el('input', { type: 'text', id: 'post-categories', placeholder: 'e.g. tech, gaming' }),
        ]),
        el('div', { className: 'create-post-actions' }, [
            el('button', {
                className: 'btn btn-primary',
                textContent: 'Publish',
                style: 'width:auto;padding:10px 28px',
                id: 'submit-post-btn',
            }),
        ]),
    ]);

    // Use event delegation to avoid timing issues
    form.addEventListener('click', async (e) => {
        if (e.target.id !== 'submit-post-btn') return;
        const errEl = form.querySelector('#create-post-error');
        errEl.classList.remove('visible');

        const title = form.querySelector('#post-title').value.trim();
        const content = form.querySelector('#post-content').value.trim();
        const categories = form.querySelector('#post-categories').value.trim() || 'general';

        if (!title || !content) {
            errEl.textContent = 'Title and content are required';
            errEl.classList.add('visible');
            return;
        }

        try {
            await api.createPost({ title, content, categories });
            form.querySelector('#post-title').value = '';
            form.querySelector('#post-content').value = '';
            form.querySelector('#post-categories').value = '';
            form.style.display = 'none';
            if (onCreated) onCreated();
        } catch (err) {
            errEl.textContent = err.message || 'Failed to create post';
            errEl.classList.add('visible');
        }
    });

    return form;
}

/**
 * Renders a single post view (full post + comments placeholder).
 */
export async function renderSinglePost(container, postId) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
        const post = await api.getPost(postId);
        const cats = post.categories ? post.categories.split(',').map(c => c.trim()) : [];

        container.innerHTML = '';
        const wrapper = el('div', { className: 'single-post fade-in' });

        // Back button
        wrapper.appendChild(el('div', { className: 'back-btn', textContent: '← Back to feed', onClick: () => navigate('#/') }));

        // Post card
        wrapper.appendChild(el('div', { className: 'single-post-card' }, [
            el('div', { className: 'post-card-header' }, [
                el('div', { className: 'post-author-avatar', textContent: getInitial(post.author) }),
                el('div', { className: 'post-author-info' }, [
                    el('div', { className: 'post-author-name', textContent: post.author }),
                    el('div', { className: 'post-time', textContent: formatDate(post.createdAt) }),
                ]),
            ]),
            el('h2', { textContent: post.title }),
            el('div', { className: 'post-categories', style: 'margin-bottom:16px' },
                cats.map(c => el('span', { className: 'tag', textContent: c }))
            ),
            el('div', { className: 'post-content', textContent: post.content }),
        ]));

        // Comments section placeholder
        wrapper.appendChild(el('div', { id: 'comments-section' }));

        container.appendChild(wrapper);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Post not found</h3></div>`;
    }
}
