// navbar.js — Navigation bar component

import * as api from '../api.js';
import { el, getInitial } from './utils.js';

/**
 * Renders the navigation bar.
 * @param {Object} user - Current user object.
 * @param {Function} onLogout - Called when user logs out.
 */
export function renderNavbar(container, user, onLogout) {
    const navbar = el('nav', { className: 'navbar', id: 'main-navbar' }, [
        el('div', { className: 'navbar-brand', textContent: '✦ Forum', onClick: () => { window.location.hash = '#/'; } }),
        el('div', { className: 'navbar-user' }, [
            el('div', { className: 'navbar-avatar', textContent: getInitial(user.nickname) }),
            el('span', { className: 'navbar-username', textContent: user.nickname }),
            el('button', {
                className: 'btn-logout',
                textContent: 'Logout',
                id: 'logout-btn',
                onClick: async () => {
                    try {
                        await api.logout();
                    } catch (e) { /* ignore */ }
                    onLogout();
                }
            }),
        ]),
    ]);

    container.prepend(navbar);
}
