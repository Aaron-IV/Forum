// auth.js — Login & Registration components

import * as api from '../api.js';
import { el, escapeHTML } from './utils.js';

/**
 * Renders the login form.
 * @param {Function} onSuccess - Called with user data after successful login.
 */
export function renderLogin(container, onSuccess) {
    const card = el('div', { className: 'auth-card fade-in' }, [
        el('h1', { textContent: '✦ Welcome Back' }),
        el('p', { className: 'subtitle', textContent: 'Sign in to continue to the forum' }),
        el('div', { className: 'form-error', id: 'login-error' }),
        el('form', { id: 'login-form' }, [
            el('div', { className: 'form-group' }, [
                el('label', { textContent: 'Nickname or Email' }),
                el('input', { type: 'text', id: 'login-input', placeholder: 'Enter your nickname or email', required: 'true', autocomplete: 'username' }),
            ]),
            el('div', { className: 'form-group' }, [
                el('label', { textContent: 'Password' }),
                el('input', { type: 'password', id: 'login-password', placeholder: 'Enter your password', required: 'true', autocomplete: 'current-password' }),
            ]),
            el('button', { className: 'btn btn-primary', type: 'submit', textContent: 'Sign In' }),
        ]),
        el('p', { className: 'auth-switch', innerHTML: 'Don\'t have an account? <a id="switch-to-register">Sign Up</a>' }),
    ]);

    container.innerHTML = '';
    container.appendChild(el('div', { className: 'auth-container' }, [card]));

    // Switch to register
    document.getElementById('switch-to-register').addEventListener('click', () => {
        renderRegister(container, onSuccess);
    });

    // Handle submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-error');
        errEl.classList.remove('visible');

        const login = document.getElementById('login-input').value.trim();
        const password = document.getElementById('login-password').value;

        if (!login || !password) {
            errEl.textContent = 'Please fill in all fields';
            errEl.classList.add('visible');
            return;
        }

        try {
            const user = await api.login({ login, password });
            onSuccess(user);
        } catch (err) {
            errEl.textContent = err.message || 'Login failed';
            errEl.classList.add('visible');
        }
    });
}

/**
 * Renders the registration form.
 * @param {Function} onSuccess - Called with user data after successful registration.
 */
export function renderRegister(container, onSuccess) {
    const card = el('div', { className: 'auth-card fade-in' }, [
        el('h1', { textContent: '✦ Create Account' }),
        el('p', { className: 'subtitle', textContent: 'Join the community and start discussing' }),
        el('div', { className: 'form-error', id: 'register-error' }),
        el('form', { id: 'register-form' }, [
            el('div', { className: 'form-row' }, [
                el('div', { className: 'form-group' }, [
                    el('label', { textContent: 'First Name' }),
                    el('input', { type: 'text', id: 'reg-first', placeholder: 'John', required: 'true' }),
                ]),
                el('div', { className: 'form-group' }, [
                    el('label', { textContent: 'Last Name' }),
                    el('input', { type: 'text', id: 'reg-last', placeholder: 'Doe', required: 'true' }),
                ]),
            ]),
            el('div', { className: 'form-group' }, [
                el('label', { textContent: 'Nickname' }),
                el('input', { type: 'text', id: 'reg-nickname', placeholder: 'Choose a unique nickname', required: 'true' }),
            ]),
            el('div', { className: 'form-group' }, [
                el('label', { textContent: 'Email' }),
                el('input', { type: 'email', id: 'reg-email', placeholder: 'you@example.com', required: 'true' }),
            ]),
            el('div', { className: 'form-row' }, [
                el('div', { className: 'form-group' }, [
                    el('label', { textContent: 'Age' }),
                    el('input', { type: 'number', id: 'reg-age', placeholder: '25', min: '1', max: '150', required: 'true' }),
                ]),
                el('div', { className: 'form-group' }, [
                    el('label', { textContent: 'Gender' }),
                    (() => {
                        const s = el('select', { id: 'reg-gender', required: 'true' });
                        s.innerHTML = '<option value="">Select...</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>';
                        return s;
                    })(),
                ]),
            ]),
            el('div', { className: 'form-group' }, [
                el('label', { textContent: 'Password' }),
                el('input', { type: 'password', id: 'reg-password', placeholder: 'At least 6 characters', required: 'true', autocomplete: 'new-password' }),
            ]),
            el('button', { className: 'btn btn-primary', type: 'submit', textContent: 'Create Account' }),
        ]),
        el('p', { className: 'auth-switch', innerHTML: 'Already have an account? <a id="switch-to-login">Sign In</a>' }),
    ]);

    container.innerHTML = '';
    container.appendChild(el('div', { className: 'auth-container' }, [card]));

    // Switch to login
    document.getElementById('switch-to-login').addEventListener('click', () => {
        renderLogin(container, onSuccess);
    });

    // Handle submit
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('register-error');
        errEl.classList.remove('visible');

        const data = {
            firstName: document.getElementById('reg-first').value.trim(),
            lastName: document.getElementById('reg-last').value.trim(),
            nickname: document.getElementById('reg-nickname').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            age: parseInt(document.getElementById('reg-age').value),
            gender: document.getElementById('reg-gender').value,
            password: document.getElementById('reg-password').value,
        };

        if (!data.firstName || !data.lastName || !data.nickname || !data.email || !data.password || !data.age || !data.gender) {
            errEl.textContent = 'Please fill in all fields';
            errEl.classList.add('visible');
            return;
        }

        if (data.password.length < 6) {
            errEl.textContent = 'Password must be at least 6 characters';
            errEl.classList.add('visible');
            return;
        }

        try {
            const user = await api.register(data);
            onSuccess(user);
        } catch (err) {
            errEl.textContent = err.message || 'Registration failed';
            errEl.classList.add('visible');
        }
    });
}
