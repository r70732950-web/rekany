// productCard.js

// Ev fonksiyon l خوارێ دڤێت ژ فایلێن دی بهێنە وەرگرتن یان وەک پارامەتر بهێنە دان
// We need functions like t, isFavorite, addToCart, showProductDetailsWithData,
// toggleFavorite, AdminLogic, showNotification, navigator from the main logic.

/**
 * Creates a product card element.
 * @param {object} product - The product data object.
 * @param {object} handlers - An object containing handler functions.
 * @param {function} handlers.t - Translation function.
 * @param {function} handlers.isFavorite - Checks if product is favorite.
 * @param {function} handlers.toggleFavorite - Toggles favorite status.
 * @param {function} handlers.addToCart - Adds product to cart.
 * @param {function} handlers.showProductDetails - Shows product details popup.
 * @param {function} handlers.showNotification - Shows a notification.
 * @param {object} handlers.AdminLogic - Admin specific logic object.
 * @param {string} currentLanguage - The current language code (e.g., 'ku_sorani').
 * @param {boolean} isAdmin - Flag indicating if the user is an admin.
 * @returns {HTMLElement} The product card element.
 */
export function createProductCardElement(product, handlers, currentLanguage, isAdmin) {
    const {
        t,
        isFavorite,
        toggleFavorite,
        addToCart,
        showProductDetails,
        showNotification,
        AdminLogic,
        navigator // For sharing
    } = handlers;

    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // Ev rêz girîng e

    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {defaultValue: 'کاڵای بێ ناو'}); // Fallback translation
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[currentLanguage] && product.shippingInfo[currentLanguage].trim();

    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>
        `;
    }

    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
             <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                 <i class="${heartIconClass} fa-heart"></i>
             </button>
             <button class="share-btn-card" aria-label="Share product">
                 <i class="fas fa-share-alt"></i>
             </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // --- Event Listeners ---

    productCard.querySelector('.share-btn-card').addEventListener('click', async (event) => {
        event.stopPropagation(); // Nehiştina vekirina hûrguliyên hilberê
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`,
            url: productUrl,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback for browsers that don't support navigator.share
                await navigator.clipboard.writeText(productUrl); // Await clipboard write
                showNotification(t('share_link_copied', {defaultValue:'لينكى کاڵا کۆپى کرا!'}), 'success'); // Fallback translation
            }
        } catch (err) {
            console.error('Share error:', err);
             if (err.name !== 'AbortError') { // Don't show error if user cancelled share
                 showNotification(t('share_error'), 'error');
             }
        }
    });

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        // We get isAdmin status directly now, no need to check session storage here
        // const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            addToCart(product.id);
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`;
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent;
                        addToCartButton.disabled = false;
                    }, 1500);
                }, 500);
            }
        } else if (isAdmin && target.closest('.edit-btn')) {
            AdminLogic.editProduct(product.id);
        } else if (isAdmin && target.closest('.delete-btn')) {
            AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id, event); // Pass event to stop propagation if needed
        } else if (target.closest('.share-btn-card')) {
             // Jixwe event listenerê xwe heye, tiştek neke
        } else if (!target.closest('a')) { // Prevent clicking links inside description from opening details
            showProductDetails(product); // Pass the whole product object
        }
    });
    return productCard;
}