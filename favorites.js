// favorites.js
// ئەم مۆدیولە هەموو لۆجیکی تایبەت بە لیستی دڵخوازەکان (Favorites) بەڕێوەدەبات.

import { 
    state, 
    FAVORITES_KEY, 
    favoritesContainer, 
    emptyFavoritesMessage, 
    db 
} from './app-setup.js';
import { t } from './utils.js';
import { showNotification } from './ui.js';
// ئەم فەنکشنە لە 'product.js'ەوە ایمپۆرت دەکرێت (کە دواتر دروست دەکرێت)
import { createProductCardElement, renderSkeletonLoader } from './product.js'; 
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

/**
 * لیستی دڵخوازەکان لە Local Storage پاشەکەوت دەکات
 */
export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

/**
 * پشکنین دەکات بزانێت ئایە کاڵایەک لە لیستی دڵخوازەکاندایە
 * @param {string} productId - ئایدی کاڵا
 * @returns {boolean} - True ئەگەر لە لیستەکەدا بێت
 */
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/**
 * کاڵایەک زیاد دەکات بۆ لیستی دڵخوازەکان یان لێی لادەبات
 * @param {string} productId - ئایدی کاڵا
 * @param {Event} [event] - ئەو ڕووداوەی (event) کە فەنکشنەکەی بانگ کردووە (بۆ ڕێگرتن لە 'event bubbling')
 */
export function toggleFavorite(productId, event) {
    if (event) {
        event.stopPropagation(); // ڕێگری دەکات لەوەی کلیکەکە کاریگەری لەسەر کارتی باوان هەبێت
    }

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        // سڕینەوە لە لیستی دڵخوازەکان
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        // زیادکردن بۆ لیستی دڵخوازەکان
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    
    saveFavorites(); // پاشەکەوتکردنی گۆڕانکاری

    // نوێکردنەوەی ئایکۆنی دڵ لەسەر هەموو کارتەکانی ئەم کاڵایە کە لە شاشە پیشان دەدرێن
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart');
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite; // دۆخی نوێ
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // ئایکۆنی پڕ
            heartIcon.classList.toggle('far', !isNowFavorite); // ئایکۆنی بەتاڵ
        }
    });

    // ئەگەر لەناو لاپەڕەی دڵخوازەکان بووین، لیستەکە نوێ دەکەینەوە
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

/**
 * لاپەڕەی (bottom sheet) لیستی دڵخوازەکان دروست دەکات و پیشانی دەدات
 */
export async function renderFavoritesPage() {
    favoritesContainer.innerHTML = ''; // بەتاڵکردنەوەی لیستی پێشوو

    // پشکنین ئەگەر لیستی دڵخوازەکان بەتاڵ بێت
    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // گۆڕین بۆ 'grid' بۆ پیشاندانی کارتەکان

    // پیشاندانی سکێلێتۆن لۆدەر لەکاتی هێنانی زانیاری
    // دڵنیا دەبینەوە کە فەنکشنەکە لە product.js ەوە هاتووە
    if (typeof renderSkeletonLoader === 'function') {
        renderSkeletonLoader(favoritesContainer, 4);
    }

    try {
        // دروستکردنی لیستێک لە 'promise' بۆ هێنانی زانیاری هەموو کاڵا دڵخوازەکان
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // سڕینەوەی سکێلێتۆن لۆدەر

        // پاڵاوتنی ئەو کاڵایانەی کە هێشتا لە فایەربەیس بوونیان هەیە
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // ئەگەر هیچ کاڵایەک نەدۆزرایەوە (ڕەنگە سڕابنەوە)
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            // دروستکردنی کارتی کاڵا بۆ هەر یەکێکیان
            favoritedProducts.forEach(product => {
                // دڵنیا دەبینەوە کە فەنکشنەکە لە product.js ەوە هاتووە
                if (typeof createProductCardElement === 'function') {
                    const productCard = createProductCardElement(product);
                    favoritesContainer.appendChild(productCard);
                } else {
                    console.error("createProductCardElement function is not imported or available.");
                }
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; grid-column: 1 / -1;">${t('error_generic')}</p>`;
    }
}
