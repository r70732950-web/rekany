// utils.js: Helper functions / فەنکشنە یارمەتیدەرەکان

import { translations, state } from './app-setup.js';

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} [delay=500] The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
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
 * Translates a key using the current language state.
 * @param {string} key The translation key.
 * @param {Object} [replacements={}] An object containing placeholder values.
 * @returns {string} The translated string.
 */
export function t(key, replacements = {}) {
    // Attempt to get translation for the current language
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key])
                      // Fallback to Sorani if current language translation doesn't exist
                      || (translations['ku_sorani'] && translations['ku_sorani'][key])
                      // Fallback to the key itself if no translation is found
                      || key;
    // Replace placeholders like {price} or {quantity}
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * Formats text for display: escapes HTML, converts URLs to links, and replaces newlines with <br>.
 * @param {string} text The text to format.
 * @returns {string} The formatted HTML string.
 */
export function formatDescription(text) {
    if (!text) return '';
    // Escape basic HTML characters
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    // Replace URLs with clickable links
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`; // Ensure protocol exists
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newline characters with HTML line breaks
    return textWithLinks.replace(/\n/g, '<br>');
}

/**
 * Saves the current window scroll position into the history state.
 * Only saves if the main page is active and it's not a popup state.
 */
export function saveCurrentScrollPosition() {
    const currentState = history.state;
    const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
    // Only save scroll position for the main page filter/content state (not popups/other pages)
    if (mainPageActive && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}
