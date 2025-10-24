// MODULE: ui-manager.js
// Handles UI updates, element creation, notifications, popups, and translations.

import { state, translations, loginModal, productFormModal, sheetOverlay, productsContainer, skeletonLoader, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions, favoritesContainer, emptyFavoritesMessage, sheetCategoriesContainer, notificationsListContainer, termsContentContainer, subSubcategoriesContainer, notificationBadge, loader } from './app-setup.js';
// Updated imports: Added functions needed by showProductDetailsWithData
import { renderCart, renderFavoritesPage, renderCategoriesSheet, renderUserNotifications, renderPolicies, isFavorite, toggleFavorite, addToCart } from './user-actions.js';
import { navigateToFilter, closeCurrentPopup, saveCurrentScrollPosition, updateHeaderView } from './app-logic.js';
import { renderRelatedProducts } from './data-renderer.js'; // Added import for renderRelatedProducts

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
    document.documentElement.dir = 'rtl';

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

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render relevant parts after language change
    // Coordination needed - these functions might need to be called from app-logic after setLanguage finishes
    // renderMainCategories(); // In data-renderer
    // renderSubcategories(state.currentCategory); // In data-renderer
    // if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart(); // In user-actions
    // if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage(); // In user-actions
    // if (document.getElementById('categoriesSheet')?.classList.contains('show')) renderCategoriesSheet(); // In user-actions
    // If on home page, re-render home sections
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
     if (homeSectionsContainer && homeSectionsContainer.style.display !== 'none') {
         // Re-render home content - Need access to renderHomePageContent from data-renderer
         // This highlights complexity - maybe language change should trigger a core app refresh function in app-logic?
         // For now, assume a full re-render might happen via searchProductsInFirestore called after language change.
     } else if (!homeSectionsContainer || homeSectionsContainer.style.display === 'none') {
          // If product list is visible, re-render products
         // This might also happen via searchProductsInFirestore call.
     }
     // Consider a simpler approach: have setLanguage call a function in app-logic that decides what to re-render.
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

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    updateHeaderView(pageId, pageTitle); // From app-logic

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
    saveCurrentScrollPosition(); // From app-logic
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Trigger rendering functions from user-actions
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else if (type === 'modal') {
        element.style.display = 'block';
    }

    document.body.classList.add('overlay-active');

    // Only push state if it's not already the current state (prevent duplicates)
     if (!history.state || history.state.id !== id || history.state.type !== type) {
         history.pushState({ type: type, id: id }, '', `#${id}`);
     }
}

/**
 * Closes all currently open popups (modals and sheets).
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if (sheetOverlay) sheetOverlay.classList.remove('show'); // Check if exists
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
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

/**
 * Formats description text, converting newlines to <br> and URLs to clickable links.
 * @param {string} text - The raw description text.
 * @returns {string} HTML formatted description.
 */
export function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

/**
 * Renders skeleton loader cards in a container.
 * @param {HTMLElement} [container=skeletonLoader] - The container element.
 * @param {number} [count=8] - The number of skeleton cards to render.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) return; // Add check
    container.innerHTML = '';
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
    container.style.display = 'grid';
    if (container === skeletonLoader) {
        if (productsContainer) productsContainer.style.display = 'none'; // Add check
        if (loader) loader.style.display = 'none'; // Add check
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
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unknown_product');
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
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>`;
    }

    const isProdFavorite = isFavorite(product.id); // From user-actions
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

    // Event listener delegation (moved calls to imported functions)
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const favoriteButton = target.closest('.favorite-btn');
        const shareButton = target.closest('.share-btn-card');
        const editButton = target.closest('.edit-btn');
        const deleteButton = target.closest('.delete-btn');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            event.stopPropagation();
            addToCart(product.id); // From user-actions
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
            toggleFavorite(product.id, event); // From user-actions
        } else if (shareButton) {
            event.stopPropagation();
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
            window.AdminLogic?.editProduct(product.id); // Access global AdminLogic
        } else if (isAdminNow && deleteButton) {
            event.stopPropagation();
            window.AdminLogic?.deleteProduct(product.id); // Access global AdminLogic
        } else if (!target.closest('a')) {
             // showProductDetailsWithData(product); // Call the function now defined IN THIS FILE
             // To prevent infinite loop if clicking inside details sheet, maybe call showProductDetails from data-renderer instead?
             // Let's call the one from data-renderer which fetches if needed.
             showProductDetails(product.id); // Call the one from data-renderer
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
    cardElement.className = 'product-card promo-card-grid-item';
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
        if (!e.target.closest('button')) {
            const cardToNavigate = cardData.cards[sliderState.currentIndex];
            const targetCategoryId = cardToNavigate.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await navigateToFilter({ // From app-logic
                    category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                });
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

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
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

/**
 * Creates image input fields for the product form.
 * @param {string[]} [imageUrls=[]] - Existing image URLs to populate.
 */
export function createProductImageInputs(imageUrls = []) {
    const imageInputsContainer = document.getElementById('imageInputsContainer');
    if (!imageInputsContainer) return;
    imageInputsContainer.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const url = imageUrls[i] || '';
        const isRequired = i === 0 ? 'required' : '';
        // Assuming translation keys: 'first_image_placeholder', 'optional_image_placeholder'
        const placeholder = i === 0 ? t('first_image_placeholder') : t('optional_image_placeholder', { index: i + 1 });
        const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;

        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group';
        inputGroup.innerHTML = `
            <input type="url" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}>
            <img src="${previewSrc}" class="image-preview-small" alt="Image preview ${i + 1}" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">
        `;
        imageInputsContainer.appendChild(inputGroup);

        const inputElement = inputGroup.querySelector('.productImageUrl');
        const previewImg = inputGroup.querySelector('.image-preview-small');
        inputElement.addEventListener('input', () => {
            const newUrl = inputElement.value.trim();
            previewImg.src = newUrl || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
        });
    }
}

// =============================================
// === Function Moved from app-logic.js ===
// =============================================
/**
 * Displays the product details in the dedicated bottom sheet.
 * Requires imported functions: t, formatDescription, openPopup, addToCart, closeCurrentPopup, renderRelatedProducts.
 * @param {object} product - The product data object.
 */
export function showProductDetailsWithData(product) { // <-- Added export
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0; // Scroll to top when opening
    }

    // Get localized name and description
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unknown_product');
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description.ku_sorani) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // Get DOM elements for the sheet
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    const productNameEl = document.getElementById('sheetProductName');
    const productDescriptionEl = document.getElementById('sheetProductDescription');
    const priceContainer = document.getElementById('sheetProductPrice');
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    // --- Populate Image Slider and Thumbnails ---
    if (imageContainer) imageContainer.innerHTML = '';
    if (thumbnailContainer) thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Main image
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active'); // First image is active
            if (imageContainer) imageContainer.appendChild(img);

            // Thumbnail image
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); // First thumb is active
            thumb.dataset.index = index.toString(); // Store index for click handling
            if (thumbnailContainer) thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Handle case with no images if necessary
    }

    // --- Slider Logic ---
    let currentIndex = 0;
    const images = imageContainer?.querySelectorAll('img') || [];
    const thumbnails = thumbnailContainer?.querySelectorAll('.thumbnail') || [];

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return; // Check bounds
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    // Show/hide prev/next buttons
    if (prevBtn && nextBtn) {
        if (imageUrls.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
            prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
            nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            prevBtn.onclick = null; // Remove listeners
            nextBtn.onclick = null;
        }
    }
    // Thumbnail click listeners
    thumbnails.forEach(thumb => {
        thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index || '0'));
    });

    // --- Populate Text Content ---
    if (productNameEl) productNameEl.textContent = nameInCurrentLang;
    if (productDescriptionEl) productDescriptionEl.innerHTML = formatDescription(descriptionText); // Use imported function

    // --- Populate Price ---
    if (priceContainer) {
        if (product.originalPrice && product.originalPrice > product.price) {
            priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
        } else {
            priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
        }
    }

    // --- Setup Add to Cart Button ---
    if (addToCartButton) {
        addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`; // Use imported t function
        // Assign new onclick handler
        addToCartButton.onclick = () => {
            addToCart(product.id); // From user-actions
            closeCurrentPopup(); // From app-logic
        };
    }

    // --- Render Related Products ---
    renderRelatedProducts(product); // From data-renderer

    // --- Open the Sheet ---
    openPopup('productDetailSheet'); // Use imported function (already in this file)
}
// =============================================