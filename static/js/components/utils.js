// utils.js — Shared utility functions

/**
 * Escapes HTML special characters to prevent XSS.
 */
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Formats a date string or Date object into a human-readable format.
 */
export function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Formats a date for chat messages (shows time).
 */
export function formatChatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Creates a throttled version of a function.
 */
export function throttle(fn, delay) {
    let lastCall = 0;
    let timer = null;
    return function (...args) {
        const now = Date.now();
        const remaining = delay - (now - lastCall);
        if (remaining <= 0) {
            if (timer) { clearTimeout(timer); timer = null; }
            lastCall = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                lastCall = Date.now();
                timer = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

/**
 * Creates a debounced version of a function.
 */
export function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Helper to create DOM elements.
 */
export function el(tag, attrs = {}, children = []) {
    const elem = document.createElement(tag);

    for (const [key, val] of Object.entries(attrs)) {
        if (key === 'className') elem.className = val;
        else if (key === 'textContent') elem.textContent = val;
        else if (key === 'innerHTML') elem.innerHTML = val;
        else if (key.startsWith('on')) elem.addEventListener(key.slice(2).toLowerCase(), val);
        else elem.setAttribute(key, val);
    }

    for (const child of children) {
        if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
        else if (child) elem.appendChild(child);
    }

    return elem;
}

/**
 * Gets the first letter of a name for avatar display.
 */
export function getInitial(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}
