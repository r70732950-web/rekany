// MODULE: ui-manager.js
// Handles UI updates, element creation, notifications, popups, and translations.

import { state, translations, loginModal, productFormModal, sheetOverlay, productsContainer, skeletonLoader, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions, favoritesContainer, emptyFavoritesMessage, sheetCategoriesContainer, notificationsListContainer, termsContentContainer, subSubcategoriesContainer, notificationBadge, loader } from './app-setup.js';
import { renderCart, renderFavoritesPage, renderCategoriesSheet, renderUserNotifications, renderPolicies, saveCart, isFavorite, toggleFavorite } from './user-actions.js'; // Assuming these will be moved
import { navigateToFilter, closeCurrentPopup, saveCurrentScrollPosition, updateHeaderView } from './app-core.js'; // Assuming these will be moved

/**
 * Translates a key using the current language.
 * @param {string} key - The translation key.
 * @param {object} replacements - Placeholders to replace in the translation string.
 * @returns {string} The translated string.
 */
export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * Sets the application language and updates the UI.
 * @param {string} lang - The language code (e.g., 'ku_sorani').
 */
export function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL for these languages

    // Update all elements with data-translate-key attribute
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    // Update language button active state
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render dynamic content that depends on language
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) { // Ensure re-rendering happens in data-renderer
        // Trigger re-render (logic should be in data-renderer now)
    }
    // Need to call render functions from data-renderer and user-actions
    // Example (actual calls might differ based on final structure):
    // renderMainCategories(); // Belongs to data-renderer
    // renderCategoriesSheet(); // Belongs to user-actions or here? (UI part)
    // if (document.getElementById('cartSheet').classList.contains('show')) renderCart(); // Belongs to user-actions
    // if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage(); // Belongs to user-actions

    // Note: Actual re-rendering calls need to be coordinated after all modules are created.
    // For now, this function primarily handles static text updates.
}

/**
 * Shows a specific page and hides others.
 * @param {string} pageId - The ID of the page to show.
 * @param {string} [pageTitle=''] - The title to display in the header for subpages.
 */
export function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top for non-main pages
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Update header based on the active page
    updateHeaderView(pageId, pageTitle); // Assumes updateHeaderView is moved to app-core or stays here

    // Update bottom navigation active state
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    }
}


/**
 * Opens a popup (modal or bottom sheet).
 * @param {string} id - The ID of the element to open.
 * @param {string} [type='sheet'] - The type ('sheet' or 'modal').
 */
export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Assumes this function is moved to app-core or stays here
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Trigger rendering functions (these should be imported from user-actions or data-renderer)
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet(); // Renders category list in the sheet
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') { // Populate profile form
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else if (type === 'modal') {
        element.style.display = 'block';
    }

    document.body.classList.add('overlay-active'); // Prevent body scrolling

    // Push state for back button navigation (logic might move to app-core)
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

/**
 * Closes all currently open popups (modals and sheets).
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

/**
 * Updates the active state indicator on the bottom navigation.
 * @param {string} activeBtnId - The ID of the button to mark as active.
 */
export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * Displays a temporary notification message.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type ('success' or 'error').
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10); // Trigger animation
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300); // Remove after animation
    }, 3000);
}

/**
 * Formats description text, converting newlines to <br> and URLs to clickable links.
 * @param {string} text - The raw description text.
 * @returns {string} HTML formatted description.
 */
export function formatDescription(text) {
    if (!text) return '';
    // Escape HTML characters first
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (starting with http/https or www)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    // Replace URLs with anchor tags
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`; // Add https if missing for www links
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newline characters with <br> tags
    return textWithLinks.replace(/\n/g, '<br>');
}

/**
 * Renders skeleton loader cards in a container.
 * @param {HTMLElement} [container=skeletonLoader] - The container element.
 * @param {number} [count=8] - The number of skeleton cards to render.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = ''; // Clear previous skeletons
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid display
    // If rendering in the main skeleton container, hide products and loader
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none';
    }
}


/**
 * Creates and returns a product card HTML element.
 * @param {object} product - The product data object.
 * @returns {HTMLElement} The product card element.
 */
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

    // Get product name in the current language, fallback to Sorani, then a default
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unknown_product'); // Assuming 'unknown_product' key exists

    // Get the primary image URL
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // Format price and discount badge
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // Format shipping info badge
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>`;
    }

    // Favorite button state
    const isProdFavorite = isFavorite(product.id); // Assumes isFavorite is imported
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // Construct card HTML
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

    // Event listener for the entire card (delegated)
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const favoriteButton = target.closest('.favorite-btn');
        const shareButton = target.closest('.share-btn-card');
        const editButton = target.closest('.edit-btn');
        const deleteButton = target.closest('.delete-btn');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Re-check admin status on click

        if (addToCartButton) {
            event.stopPropagation(); // Prevent opening details view
            // Add to cart logic (will be imported from user-actions)
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
        } else if (favoriteButton) {
            event.stopPropagation();
            toggleFavorite(product.id, event); // Assumes toggleFavorite is imported
        } else if (shareButton) {
            event.stopPropagation();
            // Share logic
            const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
            const shareData = { title: nameInCurrentLang, text: `${t('share_text')}: ${nameInCurrentLang}`, url: productUrl };
            try {
                if (navigator.share) {
                    navigator.share(shareData);
                } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = productUrl; document.body.appendChild(textArea); textArea.select();
                    try { document.execCommand('copy'); showNotification('لينكى کاڵا کۆپى کرا!', 'success'); }
                    catch (err) { showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error'); }
                    document.body.removeChild(textArea);
                }
            } catch (err) {
                if (err.name !== 'AbortError') showNotification(t('share_error'), 'error');
            }
        } else if (isAdminNow && editButton) {
            event.stopPropagation();
            // Admin edit logic (needs access to AdminLogic)
            window.AdminLogic?.editProduct(product.id);
        } else if (isAdminNow && deleteButton) {
            event.stopPropagation();
            // Admin delete logic (needs access to AdminLogic)
            window.AdminLogic?.deleteProduct(product.id);
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description (handled via formatDescription)
            // Open product details (will be imported from data-renderer)
            // showProductDetailsWithData(product); // Needs coordination
        }
    });

    return productCard;
}

/**
 * Creates and returns a promo card slider element.
 * Requires sliderState object to manage its state.
 * @param {object} cardData - Group data containing an array of cards.
 * @param {object} sliderState - An object { currentIndex: number, intervalId: number | null } for this slider.
 * @returns {HTMLElement} The promo card element.
 */
export function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Reuse styles
    const currentCard = cardData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    cardElement.addEventListener('click', async (e) => {
        // Click action: navigate to linked category
        if (!e.target.closest('button')) { // Ignore clicks on prev/next buttons
            const cardToNavigate = cardData.cards[sliderState.currentIndex]; // Use current index
            const targetCategoryId = cardToNavigate.categoryId;
            // Check if category exists (using state.categories which should be populated)
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await navigateToFilter({ // navigateToFilter needs to be imported from app-core
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                // Optionally scroll to categories section
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    // Add prev/next button functionality if multiple cards exist
    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if (imgElement) imgElement.src = newImageUrl;
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if (imgElement) imgElement.src = newImageUrl;
        });
    }

    return cardElement;
}

/**
 * Sets up intersection observer for reveal-on-scroll animations.
 */
export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% is visible
    });

    // Observe elements with the reveal class
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

// Add other UI-specific functions here...
// e.g., functions to update specific parts of the header, manage welcome message UI, etc.

// Note: Functions like createProductImageInputs which are only used by admin might stay in admin.js
// or be moved here if considered general UI helper functions. For now, keep it here if createProductCard uses it indirectly.
// If createProductImageInputs is purely for the *admin form*, it should ideally be in admin.js.
// Let's assume it's more general UI for now.

/**
 * Creates image input fields for the product form.
 * @param {string[]} [imageUrls=[]] - Existing image URLs to populate.
 */
export function createProductImageInputs(imageUrls = []) {
    const imageInputsContainer = document.getElementById('imageInputsContainer');
    if (!imageInputsContainer) return; // Exit if container not found
    imageInputsContainer.innerHTML = ''; // Clear previous inputs
    for (let i = 0; i < 4; i++) {
        const url = imageUrls[i] || '';
        const isRequired = i === 0 ? 'required' : ''; // Only first image is required
        const placeholder = i === 0 ? t('first_image_placeholder') : t('optional_image_placeholder', { index: i + 1 }); // Assuming translation keys exist
        const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`; // Placeholder image

        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group';
        inputGroup.innerHTML = `
            <input type="url" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}>
            <img src="${previewSrc}" class="image-preview-small" alt="Image preview ${i + 1}" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">
        `;
        imageInputsContainer.appendChild(inputGroup);

        // Add event listener for live preview update
        const inputElement = inputGroup.querySelector('.productImageUrl');
        const previewImg = inputGroup.querySelector('.image-preview-small');
        inputElement.addEventListener('input', () => {
            const newUrl = inputElement.value.trim();
            if (newUrl) {
                previewImg.src = newUrl;
            } else {
                previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`; // Reset to placeholder if empty
            }
        });
    }
}