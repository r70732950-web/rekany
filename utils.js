// utils.js
// General utility functions used across the application.

import { state, translations } from './app-setup.js'; // Need state and translations for t()

/**
 * Translates a given key using the current language state.
 * Supports basic placeholder replacement like {placeholder}.
 * @param {string} key - The translation key.
 * @param {object} [replacements={}] - An object containing placeholder values.
 * @returns {string} The translated string or the key itself if not found.
 */
export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key])
                   || (translations['ku_sorani'] && translations['ku_sorani'][key]) // Fallback to Sorani
                   || key; // Fallback to the key itself

    // Replace placeholders like {placeholder}
    for (const placeholder in replacements) {
        // Use a regex to replace all occurrences globally
        const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
        translation = translation.replace(regex, replacements[placeholder]);
    }
    return translation;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} [delay=500] - The number of milliseconds to delay.
 * @returns {Function} The new debounced function.
 */
export function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Formats description text: escapes HTML, converts URLs to links, replaces newlines with <br>.
 * @param {string} text - The input text.
 * @returns {string} The formatted HTML string.
 */
export function formatDescription(text) {
    if (!text) return '';

    // 1. Escape basic HTML characters to prevent XSS
    let escapedText = text.replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;')
                          .replace(/'/g, '&#039;');

    // 2. Find URLs (http, https, www) and convert them to clickable links
    //    Regex improved to handle various URL endings and avoid matching partial links within HTML attributes (though unlikely after escaping)
    const urlRegex = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        // Ensure the link starts with http:// or https://
        const hyperLink = url.startsWith('www.') ? `https://${url}` : url;
        // Make sure the link itself doesn't contain harmful content (though escaping helps)
        // Keep the displayed URL clean, use the hyperlink in href
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    // 3. Replace newline characters with <br> tags for display in HTML
    return textWithLinks.replace(/\n/g, '<br>');
}


/**
 * Shows a temporary notification message on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type ('success' or 'error').
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`; // Apply type class for styling
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger the animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10); // Small delay to allow the element to be added to DOM first

    // Automatically remove the notification after a delay
    setTimeout(() => {
        notification.classList.remove('show');
        // Wait for the fade-out animation to complete before removing from DOM
        notification.addEventListener('transitionend', () => {
             // Check if the element still has a parent before removing
             if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, { once: true }); // Ensure listener is removed after firing once
    }, 3000); // Notification visible for 3 seconds
}
