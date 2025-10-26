// utils.js
// ئەم مۆدیولە فەنکشنە یارمەتیدەرە گشتییەکانی تێدایە کە لە چەندین شوێنی تر بەکاردێن.
import { translations, state } from './app-setup.js';

/**
 * فەنکشنێک بۆ دواخستنی جێبەجێکردنی فەنکشنێکی تر (بۆ نموونە، لە کاتی گەڕان)
 * @param {Function} func - ئەو فەنکشنەی کە دەبێت دوا بخرێت
 * @param {number} [delay=500] - ماوەی دواخستن بە میلی چرکە
 * @returns {Function} - فەنکشنێکی نوێ کە توانای دواخستنی هەیە
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
 * فەنکشنی سەرەکی بۆ وەرگێڕانی دەقەکان بەپێی زمانی هەڵبژێردراو
 * @param {string} key - کلیلی وەرگێڕان
 * @param {Object} [replacements={}] - ئۆبجێکتێک بۆ گۆڕینی نرخە داینامیکەکان (بۆ نموونە: {price: 1000})
 * @returns {string} - دەقی وەرگێڕدراو
 */
export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * وەسفی کاڵا فۆرمات دەکات (هێڵە نوێیەکان دەگۆڕێت بۆ <br> و لینکەکان چالاک دەکات)
 * @param {string} text - دەقی وەسف
 * @returns {string} - دەقی فۆرماتکراو بە HTML
 */
export function formatDescription(text) {
    if (!text) return '';
    // دڵنیابوون لەوەی کە کارەکتەرە تایبەتەکانی HTML بە دروستی پیشان دەدرێن
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // دۆزینەوە و گۆڕینی لینکەکان
    const urlRegex = /(https?:\/\/[^\s<>"'()]+|www\.[^\s<>"'()]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        // دڵنیابوون لەوەی لینکی 'www' بە 'https' دەست پێدەکات
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    
    // گۆڕینی هێڵی نوێ بۆ <br>
    return textWithLinks.replace(/\n/g, '<br>');
}
