// ui-manager.js (رێکخەرێ رووکارێ)
// بەرپرسیارەتی: هەمی کارێن نیشاندان/ڤەشارتنا ئێلێمێنتان (pages, modals, sheets),
// نیشاندانا notifications, وەرگێران (t, setLanguage), چێکرنا ئێلێمێنتێن UI,
// رێکخستنا header, کارێن animation.

import {
    // DOM Elements
    loginModal, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect,
    subSubcategorySelectContainer, productSubSubcategorySelect, profileForm, settingsPage,
    mainPage, homeBtn, settingsBtn, settingsFavoritesBtn, settingsAdminLoginBtn,
    settingsLogoutBtn, profileBtn, contactToggle, dynamicContactLinksContainer,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
    welcomeModal, productDetailSheet, categoriesSheet, profileSheet, favoritesSheet, cartSheet,
    mainCategoriesContainer, subcategoriesContainer, homePageSectionsContainer,
    headerTitle, // ZÊDEKIRÎ JI BO updateHeaderView
    relatedProductsSection, relatedProductsContainer, // ZÊDEKIRÎ JI BO showProductDetailsUI
    sheetImageContainer, sheetThumbnailContainer, sheetProductName, sheetProductDescription,
    sheetProductPrice, sheetAddToCartBtn, sheetPrevBtn, sheetNextBtn, // ZÊDEKIRÎ JI BO showProductDetailsUI

    // State & Config
    state, translations, FAVORITES_KEY, PROFILE_KEY // Import necessary state parts and translations
} from './app-setup.js'; // Assuming app-setup.js is in the same directory

// --- Internal Helper Functions ---

/**
 * Formats description text: converts newlines to <br> and URLs to clickable links.
 * @param {string} text - The input text.
 * @returns {string} - Formatted HTML string.
 */
function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

// --- Translation Functions ---

/**
 * Gets the translation for a given key in the current language.
 * @param {string} key - The translation key.
 * @param {object} replacements - Key-value pairs for placeholder replacement.
 * @returns {string} - The translated string.
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
 * @param {string} lang - The language code (e.g., 'ku_sorani', 'ar').
 */
export function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL for these languages

    // Update all elements with data-translate-key
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder !== undefined) { // Check if placeholder exists
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

    // Clear dynamic home sections to force re-render with new language
    // Note: The actual re-rendering logic will be triggered by the caller (app-logic.js or data-renderer.js)
    if (homePageSectionsContainer) {
        homePageSectionsContainer.innerHTML = '';
    }

    // Re-render category related UI elements immediately as they depend only on language
    renderMainCategories();
    renderCategoriesSheet();

    // The caller (app-logic.js) should decide whether to re-render products or home page content
}


// --- Popup and Page Management ---

/**
 * Closes all modals and bottom sheets and hides the overlay.
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if (sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

/**
 * Opens a specific modal or bottom sheet.
 * Note: Does not handle history API. The caller (app-logic.js) should manage history.
 * Note: Does not trigger data loading/rendering, only shows the UI element. Caller should render content.
 * @param {string} id - The ID of the element to open.
 * @param {string} [type='sheet'] - 'sheet' or 'modal'.
 */
export function openPopupUI(id, type = 'sheet') {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with ID "${id}" not found for opening popup.`);
        return;
    }

    closeAllPopupsUI(); // Close any currently open popups first

    if (type === 'sheet') {
        if (sheetOverlay) sheetOverlay.classList.add('show');
        element.classList.add('show');
    } else { // type === 'modal'
        element.style.display = 'block';
    }

    document.body.classList.add('overlay-active');
    // History pushState should be handled by the caller in app-logic.js
}

/**
 * Shows a specific page and hides others. Updates header and active nav item.
 * Note: Does not handle history API. The caller (app-logic.js) should manage history.
 * @param {string} pageId - The ID of the page to show.
 * @param {string} [pageTitle=''] - The title to display in the header for subpages.
 */
export function showPageUI(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top only if navigating to a *different* page than main page
    if (pageId !== 'mainPage' && document.getElementById(pageId)?.classList.contains('page-active')) {
         // Check if it's actually active to prevent scrolling on initial load incorrectly
        window.scrollTo(0, 0);
    }

    // Update header based on the active page
    if (pageId === 'settingsPage') {
        updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        updateHeaderView('subcategoryDetailPage', pageTitle);
    } else { // mainPage or any other not explicitly handled
        updateHeaderView('mainPage');
    }

    // Update active state in bottom navigation
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    } else {
        // If no specific button corresponds, deactivate all except maybe profile/cart if sheets are open?
        // Simpler: Just ensure the main page/settings buttons are handled.
    }
     // History pushState should be handled by the caller in app-logic.js
}

/**
 * Updates the header display (main vs. subpage view and title).
 * @param {string} viewType - 'mainPage' or specific page ID like 'settingsPage', 'subcategoryDetailPage'.
 * @param {string} [title=''] - The title for subpage headers.
 */
export function updateHeaderView(viewType, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');

    if (!mainHeader || !subpageHeader || !headerTitle) return;

    if (viewType === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else { // Any subpage view
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
        // Reset subpage search on view change? Maybe not, keep it simple.
    }
}

/**
 * Updates the visual active state of the bottom navigation bar.
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


// --- Notifications ---

/**
 * Shows a temporary notification message at the top right.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - 'success' or 'error'.
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Trigger CSS transition
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after a delay
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition finishes
        setTimeout(() => {
            if (document.body.contains(notification)) {
                 document.body.removeChild(notification);
            }
        }, 300); // Should match CSS transition duration
    }, 3000); // Display duration
}


// --- UI Element Creation ---

/**
 * Creates the HTML structure for a product card.
 * Adds data-* attributes for actions, to be handled by event listeners in app-logic.js.
 * @param {object} product - The product data object.
 * @param {boolean} isAdmin - Whether the current user is an admin.
 * @param {boolean} isProdFavorite - Whether the product is in the user's favorites.
 * @returns {HTMLElement} - The product card element.
 */
export function createProductCardElement(product, isAdmin, isProdFavorite) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // Essential for identifying the product

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_name_placeholder', {default: 'کاڵای بێ ناو'}); // Added placeholder fallback
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

    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
             <button class="${favoriteBtnClass}" data-action="toggle-favorite" aria-label="Toggle favorite">
                 <i class="${heartIconClass} fa-heart"></i>
             </button>
             <button class="share-btn-card" data-action="share-product" aria-label="Share product">
                 <i class="fas fa-share-alt"></i>
             </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card" data-action="add-to-cart">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" data-action="edit-product" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" data-action="delete-product" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;
    // Add data-action attributes for event delegation in app-logic.js
    // The main card click (to show details) will be handled by a listener on the container in app-logic.js
    return productCard;
}

/**
 * Creates the HTML structure for a promotion card slider item.
 * Adds data-* attributes for actions.
 * @param {object} cardGroupData - Object containing an array of card objects for the group.
 * @param {object} sliderState - An object with { currentIndex } to track the current slide.
 * @returns {HTMLElement} - The promo card element.
 */
export function createPromoCardElement(cardGroupData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Use existing styles

    if (!cardGroupData || !cardGroupData.cards || cardGroupData.cards.length === 0) {
        cardElement.innerHTML = '<p>No promo cards available.</p>'; // Handle empty case
        return cardElement;
    }

    // Ensure currentIndex is valid
    sliderState.currentIndex = sliderState.currentIndex % cardGroupData.cards.length;
    const currentCard = cardGroupData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    // Set data attributes for navigation action
    cardElement.dataset.action = "navigate-category";
    cardElement.dataset.categoryId = currentCard.categoryId;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardGroupData.cards.length > 1 ? `
        <button class="promo-slider-btn prev" data-action="promo-prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next" data-action="promo-next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    // Add necessary data attributes to buttons for event delegation in app-logic.js
    if (cardGroupData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').dataset.sliderStateIndex = sliderState.currentIndex; // Pass index if needed
        cardElement.querySelector('.promo-slider-btn.next').dataset.sliderStateIndex = sliderState.currentIndex; // Pass index if needed
    }

    return cardElement;
}

/**
 * Updates the image displayed in a specific promo card element.
 * @param {HTMLElement} promoCardElement - The promo card element to update.
 * @param {object} cardGroupData - The full data for the promo card group.
 * @param {object} sliderState - The slider state object { currentIndex }.
 */
export function updatePromoCardImage(promoCardElement, cardGroupData, sliderState) {
    if (!cardGroupData || !cardGroupData.cards || cardGroupData.cards.length === 0) return;

    sliderState.currentIndex = (sliderState.currentIndex + cardGroupData.cards.length) % cardGroupData.cards.length; // Ensure index is valid
    const currentCard = cardGroupData.cards[sliderState.currentIndex];
    const newImageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    const imgElement = promoCardElement.querySelector('.product-image');
    if (imgElement) {
        imgElement.src = newImageUrl;
    }

    // Update data attributes for navigation
    promoCardElement.dataset.categoryId = currentCard.categoryId;

    // Update button states if needed (though index isn't strictly necessary for prev/next logic)
    const prevBtn = promoCardElement.querySelector('.promo-slider-btn.prev');
    const nextBtn = promoCardElement.querySelector('.promo-slider-btn.next');
    if(prevBtn) prevBtn.dataset.sliderStateIndex = sliderState.currentIndex;
    if(nextBtn) nextBtn.dataset.sliderStateIndex = sliderState.currentIndex;
}


// --- Rendering Functions ---

/**
 * Renders product cards into the main products container.
 * @param {Array} products - An array of product objects to render.
 */
export function renderProductsUI(products) {
    if (!productsContainer) return;
    productsContainer.innerHTML = ''; // Clear previous products

    if (!products || products.length === 0) {
        // Optionally display a "No products found" message here
        // productsContainer.innerHTML = '<p>هیچ کاڵایەک نەدۆزرایەوە.</p>';
        return;
    }

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    products.forEach(item => {
        const isProdFavorite = state.favorites.includes(item.id);
        let element = createProductCardElement(item, isAdmin, isProdFavorite);
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Re-setup animations for new elements
    productsContainer.style.display = 'grid'; // Ensure container is visible
    if (skeletonLoader) skeletonLoader.style.display = 'none'; // Hide skeleton
    if (loader) loader.style.display = 'none'; // Hide loading indicator
}

/**
 * Renders the main category buttons. Uses `state.categories`.
 */
export function renderMainCategories() {
    if (!mainCategoriesContainer || !state.categories) return;
    mainCategoriesContainer.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.categoryId = cat.id; // Use categoryId for consistency
        btn.classList.toggle('active', state.currentCategory === cat.id);

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Added default icon

        // Add data-action attribute instead of onclick
        btn.dataset.action = 'filter-main-category';

        mainCategoriesContainer.appendChild(btn);
    });
}

/**
 * Renders the category list inside the 'Categories' bottom sheet. Uses `state.categories`.
 */
export function renderCategoriesSheet() {
    if (!sheetCategoriesContainer || !state.categories) return;
    sheetCategoriesContainer.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.categoryId = cat.id; // Use categoryId
        btn.classList.toggle('active', state.currentCategory === cat.id);

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`;

        // Add data-action attribute instead of onclick
        btn.dataset.action = 'filter-sheet-category';

        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Renders skeleton loading cards in a specified container.
 * @param {HTMLElement} [container=skeletonLoader] - The container to render into.
 * @param {number} [count=8] - The number of skeleton cards to render.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) return;
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
    container.style.display = 'grid'; // Make skeleton container visible

    // If rendering into the main skeleton loader, hide the actual products container
    if (container === skeletonLoader && productsContainer) {
        productsContainer.style.display = 'none';
    }
     if (loader) loader.style.display = 'none'; // Hide infinite scroll loader
}


// --- Animations ---

/**
 * Sets up IntersectionObserver to add 'visible' class to elements for animations.
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
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    // Observe elements with the 'product-card-reveal' class
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}


// --- Specific UI Updates ---

/**
 * Updates the UI of the product detail bottom sheet with product data.
 * @param {object} product - The product data object.
 * @param {Array} relatedProducts - An array of related product objects.
 */
export function showProductDetailsUI(product, relatedProducts) {
    if (!productDetailSheet) return;

    const sheetContent = productDetailSheet.querySelector('.sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_name_placeholder', {default: 'کاڵای بێ ناو'});
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // --- Image Slider ---
    if (imageContainer && thumbnailContainer && prevBtn && nextBtn) {
        imageContainer.innerHTML = '';
        thumbnailContainer.innerHTML = '';
        let currentIndex = 0;

        if (imageUrls.length > 0) {
            imageUrls.forEach((url, index) => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = nameInCurrentLang;
                if (index === 0) img.classList.add('active');
                imageContainer.appendChild(img);

                const thumb = document.createElement('img');
                thumb.src = url;
                thumb.alt = `Thumbnail ${index + 1}`;
                thumb.className = 'thumbnail';
                if (index === 0) thumb.classList.add('active');
                thumb.dataset.index = index;
                // Add data-action for event delegation
                thumb.dataset.action = 'select-thumbnail';
                thumbnailContainer.appendChild(thumb);
            });
        } else {
             // Add a placeholder if no images
             imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="${nameInCurrentLang}" class="active">`;
        }

        const images = imageContainer.querySelectorAll('img');
        const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');

        const showSlide = (index) => {
            if (index < 0 || index >= images.length) return;
            images.forEach(img => img.classList.remove('active'));
            thumbnails.forEach(thumb => thumb.classList.remove('active'));
            if(images[index]) images[index].classList.add('active');
            if(thumbnails[index]) thumbnails[index].classList.add('active');
            currentIndex = index;
        };

        // Add data-action attributes to prev/next buttons
        prevBtn.dataset.action = 'slider-prev';
        nextBtn.dataset.action = 'slider-next';
        // Store current index if needed by the handler in app-logic.js
        prevBtn.dataset.currentIndex = currentIndex;
        nextBtn.dataset.currentIndex = currentIndex;


        if (imageUrls.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    }
    // --- End Image Slider ---

    if(sheetProductName) sheetProductName.textContent = nameInCurrentLang;
    if(sheetProductDescription) sheetProductDescription.innerHTML = formatDescription(descriptionText);

    if (sheetProductPrice) {
        if (product.originalPrice && product.originalPrice > product.price) {
            sheetProductPrice.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
        } else {
            sheetProductPrice.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
        }
    }

    // --- Related Products ---
    if (relatedContainer && relatedSection) {
        relatedContainer.innerHTML = ''; // Clear previous related products
        if (relatedProducts && relatedProducts.length > 0) {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            relatedProducts.forEach(relProd => {
                const isFav = state.favorites.includes(relProd.id);
                const card = createProductCardElement(relProd, isAdmin, isFav);
                relatedContainer.appendChild(card);
            });
            relatedSection.style.display = 'block';
        } else {
            relatedSection.style.display = 'none';
        }
    }
    // --- End Related Products ---

    // --- Add to Cart Button ---
    if (sheetAddToCartBtn) {
        sheetAddToCartBtn.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
        sheetAddToCartBtn.dataset.productId = product.id; // Add product ID for listener
        sheetAddToCartBtn.dataset.action = "add-to-cart-details"; // Action for listener
    }
    // --- End Add to Cart Button ---

    openPopupUI('productDetailSheet'); // Show the sheet UI
}

/**
 * Creates the HTML input fields for product images in the admin form.
 * @param {string[]} [imageUrls=[]] - Array of existing image URLs.
 */
export function createProductImageInputs(imageUrls = []) {
     if (!imageInputsContainer) return;
     imageInputsContainer.innerHTML = '';
     for (let i = 0; i < 4; i++) {
         const url = imageUrls[i] || '';
         const isRequired = i === 0 ? 'required' : '';
         const placeholder = i === 0 ? 'لینکی وێنەی یەکەم (سەرەکی)' : `لینکی وێنەی ${['دووەم', 'سێیەم', 'چوارەم'][i-1]}`;
         const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
         const inputGroup = document.createElement('div');
         inputGroup.className = 'image-input-group';
         inputGroup.innerHTML = `<input type="url" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}><img src="${previewSrc}" class="image-preview-small" alt="Image preview ${i+1}" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">`;

         // Add listener to update preview on input change
         const input = inputGroup.querySelector('input');
         const img = inputGroup.querySelector('img');
         input.addEventListener('input', () => {
             const newUrl = input.value.trim();
             img.src = newUrl || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
         });
         imageInputsContainer.appendChild(inputGroup);
     }
}

/**
 * Updates the cart item count badge in the UI.
 * Relies on state.cart being up-to-date.
 */
export function updateCartCountUI() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

/**
 * Toggles the visual state of a favorite button on a product card.
 * @param {string} productId - The ID of the product.
 * @param {boolean} isFavorite - The new favorite state.
 */
export function updateFavoriteButtonUI(productId, isFavorite) {
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn[data-action="toggle-favorite"]');
        if (favButton) {
            const heartIcon = favButton.querySelector('.fa-heart');
            favButton.classList.toggle('favorited', isFavorite);
            if (heartIcon) {
                heartIcon.classList.toggle('fas', isFavorite); // Solid heart
                heartIcon.classList.toggle('far', !isFavorite); // Outline heart
            }
        }
    });
}

/**
 * Updates the UI to show/hide admin-specific elements.
 * @param {boolean} isAdmin - Whether the user is an admin.
 */
export function updateAdminUI(isAdmin) {
    // Show/hide edit/delete buttons on product cards
    document.querySelectorAll('.product-actions').forEach(el => {
         el.style.display = isAdmin ? 'flex' : 'none';
     });

    // Show/hide admin sections in settings
    const adminSections = [
        'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
        'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
        'adminContactMethodsManagement', 'adminShortcutRowsManagement',
        'adminHomeLayoutManagement'
    ];
    adminSections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = isAdmin ? 'block' : 'none';
    });

    // Toggle login/logout buttons in settings and add product button
    if (settingsLogoutBtn) settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
    if (settingsAdminLoginBtn) settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
    if (addProductBtn) addProductBtn.style.display = isAdmin ? 'flex' : 'none';
}

/**
 * Displays or hides the notification badge.
 * @param {boolean} show - Whether to show the badge.
 */
export function showNotificationBadge(show) {
    if (notificationBadge) {
        notificationBadge.style.display = show ? 'block' : 'none';
    }
}