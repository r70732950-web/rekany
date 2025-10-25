// ui-manager.js - Handles UI updates, rendering, translations, and interactions

import {
    // State needed for UI rendering
    state,
    // DOM Elements needed for UI manipulation
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, // Keep clearSearchBtn if UI updates it directly
    loader, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, sheetOverlay, sheetCategoriesContainer,
    profileForm, settingsPage, mainPage, // Page elements
    settingsAdminLoginBtn, settingsLogoutBtn, // Admin buttons in settings
    notificationBadge, notificationsSheet, notificationsListContainer, // Notifications
    termsSheet, termsContentContainer, // Terms
    // Product Detail Sheet elements
    productDetailSheet, sheetImageContainer, sheetThumbnailContainer, sheetPrevBtn, sheetNextBtn,
    sheetProductName, sheetProductDescription, sheetProductPrice, sheetAddToCartBtn,
    relatedProductsSection, relatedProductsContainer,
    // Header elements
    // subSubcategoriesContainer, // *** REMOVED IMPORT ***
    mainCategoriesContainer, subcategoriesContainer, // Main page category containers
    // Subcategory Detail Page Elements
    subcategoryDetailPage, subSubCategoryContainerOnDetailPage, productsContainerOnDetailPage, detailPageLoader,
    subpageSearchInput, subpageClearSearchBtn, // Subpage search elements
    // Welcome Modal
    welcomeModal,
    // Add other elements if directly manipulated here
} from './app-setup.js';

import { translations } from './app-setup.js'; // Import translations


// --- Core UI Functions ---

/**
 * Translates a key using the current language.
 * @param {string} key - The translation key.
 * @param {object} [replacements={}] - Optional placeholder replacements.
 * @returns {string} The translated string or the key itself if not found.
 */
export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage]?.[key])
                   || (translations['ku_sorani']?.[key]) // Fallback to Sorani
                   || key; // Fallback to the key itself
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
    if (!translations[lang]) {
        console.warn(`Language '${lang}' not found in translations. Falling back.`);
        lang = 'ku_sorani'; // Default fallback
    }
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    // Update HTML attributes
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL for these languages

    // Update text content of elements with data-translate-key
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        // Handle input placeholders vs other elements
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder !== undefined) { // Check if placeholder exists
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    // Update active language button style
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

     // Potentially re-render dynamic content that depends on language
     // This might need coordination with app-logic or data-renderer
     // Example: If product cards or category names need explicit re-rendering
     // renderProducts(); // If product cards need full re-render
     // renderMainCategories(); // If main categories need re-render
     // renderSubcategories(state.currentCategory); // If subcategories need re-render
     // etc.
     // NOTE: This re-rendering logic might be better placed in app-logic.js
     // after calling setLanguage, to keep UI manager focused on updating static text.
}


/**
 * Shows a temporary notification message.
 * @param {string} message - The message to display.
 * @param {('success' | 'error')} [type='success'] - The notification type.
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition ends
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

/**
 * Updates the header view based on the current page.
 * @param {string} pageId - The ID of the active page ('mainPage', 'settingsPage', etc.).
 * @param {string} [title=''] - The title for subpages.
 */
export function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitleEl = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitleEl) return; // Exit if elements not found

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitleEl.textContent = title;
        // Optionally clear subpage search when navigating TO a subpage
        // if (subpageSearchInput) subpageSearchInput.value = '';
        // if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';
    }
}

/**
 * Shows the specified page and hides others.
 * @param {string} pageId - The ID of the page to show.
 * @param {string} [pageTitle=''] - Title for the header if it's a subpage.
 */
export function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top when navigating to a new page (except potentially main page via history)
    if (pageId !== 'mainPage' || !history.state || history.state.type === 'page') {
         // Check if history state represents a page navigation, not a filter change
         // Or if it's not the main page at all
        window.scrollTo(0, 0);
    }


    // Update the header based on the page being shown
    updateHeaderView(pageId, pageTitle);

    // Update bottom navigation active state
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn'
                     : pageId === 'settingsPage' ? 'settingsBtn'
                     // Add cases for other pages if they have dedicated nav buttons
                     : null; // No dedicated button for detail page
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    } else {
         // If no dedicated button, remove active state from all
         updateActiveNav(null);
    }
}


/**
 * Updates the active state styling for bottom navigation buttons.
 * @param {string | null} activeBtnId - The ID of the button to activate, or null to deactivate all.
 */
export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.id === activeBtnId);
    });
}


// --- Popup Management (Modals & Sheets) ---

/** Closes all currently open modals and bottom sheets. */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if (sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active'); // Allow body scrolling
}

/**
 * Opens a specific modal or bottom sheet.
 * Assumes history state is handled separately by app-logic.
 * @param {string} id - The ID of the element to open.
 * @param {('sheet' | 'modal')} [type='sheet'] - The type of popup.
 */
export function openPopup(id, type = 'sheet') {
     // Don't save scroll position here, handled before navigation in app-logic
    const element = document.getElementById(id);
    if (!element || !sheetOverlay) return;

    // Ensure others are closed before opening a new one
    // closeAllPopupsUI(); // This might be called by the caller function (e.g., openPopupAndPushState)

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Specific rendering logic might be called *before* this function in app-logic
        // Example: renderCart() is called before openPopup('cartSheet')
        // Only handle UI state logic here, like setting profile values if profile sheet
        if (id === 'profileSheet') {
             const nameInput = document.getElementById('profileName');
             const addressInput = document.getElementById('profileAddress');
             const phoneInput = document.getElementById('profilePhone');
             if(nameInput) nameInput.value = state.userProfile.name || '';
             if(addressInput) addressInput.value = state.userProfile.address || '';
             if(phoneInput) phoneInput.value = state.userProfile.phone || '';
        }

    } else { // Modal
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent body scrolling
}


// --- Element Creation & Rendering ---

/**
 * Creates and returns an HTML element for a product card.
 * @param {object} product - The product data object.
 * @param {object} actions - Object containing action functions (addToCart, toggleFavorite, etc.).
 * @returns {HTMLElement} The product card element.
 */
export function createProductCardElement(product, actions = window.appActions || {}) { // Use global actions if available
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

    // Safely access potentially multi-language names
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage])
                           || (product.name && product.name.ku_sorani) // Fallback Sorani
                           || (typeof product.name === 'string' ? product.name : t('unnamed_product', {default:'کاڵای بێ ناو'})); // Fallback string or default

    // Determine image URL
    const mainImage = (product.imageUrls && product.imageUrls.length > 0)
                     ? product.imageUrls[0]
                     : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // Format price and discount
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price?.toLocaleString() ?? 'N/A'} ${t('currency',{default:'د.ع.'})}</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        const originalPriceFormatted = product.originalPrice.toLocaleString();
        const currentPriceFormatted = product.price.toLocaleString();
        priceHTML = `<div class="product-price-container"><span class="product-price">${currentPriceFormatted} ${t('currency',{default:'د.ع.'})}</span><del class="original-price">${originalPriceFormatted} ${t('currency',{default:'د.ع.'})}</del></div>`;
        try {
             const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
             discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
        } catch { /* Ignore calculation errors */ }
    }

    // Shipping Info Badge
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo?.[state.currentLanguage]?.trim() || product.shippingInfo?.ku_sorani?.trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>`;
    }

    // Favorite Button State
    const isProdFavorite = actions.isFavorite ? actions.isFavorite(product.id) : false;
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // Solid vs regular heart
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // Construct Inner HTML
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=${t('no_image', {default:'وێنە+نییە'})}';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="${t('add_to_favorites', {default:'Add to favorites'})}">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
            <button class="share-btn-card" aria-label="${t('share_product', {default:'Share product'})}">
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

    // --- Add Event Listeners ---
    const addToCartButton = productCard.querySelector('.add-to-cart-btn-card');
    const favoriteButton = productCard.querySelector('.favorite-btn');
    const shareButton = productCard.querySelector('.share-btn-card');
    const editButton = productCard.querySelector('.edit-btn');
    const deleteButton = productCard.querySelector('.delete-btn');

    // Add to Cart
    if (addToCartButton && actions.addToCart) {
        addToCartButton.addEventListener('click', (event) => {
            event.stopPropagation();
            actions.addToCart(product.id, addToCartButton); // Pass button for UI feedback
             // UI Feedback logic moved to user-actions.js/addToCart
        });
    }

    // Toggle Favorite
    if (favoriteButton && actions.toggleFavorite) {
        favoriteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            actions.toggleFavorite(product.id, event); // Let user-actions handle UI update too
        });
    }

     // Share Button
     if (shareButton && actions.shareProduct) {
        shareButton.addEventListener('click', (event) => {
            event.stopPropagation();
            actions.shareProduct(product);
        });
     }

    // Admin Edit/Delete
    if (isAdmin) {
        if (editButton && actions.editProduct) {
            editButton.addEventListener('click', (event) => {
                event.stopPropagation();
                actions.editProduct(product.id);
            });
        }
        if (deleteButton && actions.deleteProduct) {
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                actions.deleteProduct(product.id);
            });
        }
    }

    // Click on card itself (navigate to details)
    if(actions.showProductDetails) {
        productCard.addEventListener('click', (event) => {
            // Prevent navigation if clicking interactive elements
            if (!event.target.closest('button, a')) {
                actions.showProductDetails(product.id);
            }
        });
    }


    return productCard;
}

/**
 * Creates a skeleton loader element for product cards.
 * @returns {HTMLElement} The skeleton card element.
 */
function createSkeletonCard() {
    const skeletonCard = document.createElement('div');
    skeletonCard.className = 'skeleton-card';
    skeletonCard.innerHTML = `
        <div class="skeleton-image shimmer"></div>
        <div class="skeleton-text shimmer"></div>
        <div class="skeleton-price shimmer"></div>
        <div class="skeleton-button shimmer"></div>
    `;
    return skeletonCard;
}

/**
 * Renders skeleton loaders in a container.
 * @param {HTMLElement} container - The container to render into.
 * @param {number} [count=8] - The number of skeletons to render.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) return;
    container.innerHTML = ''; // Clear previous skeletons
    for (let i = 0; i < count; i++) {
        container.appendChild(createSkeletonCard());
    }
    container.style.display = 'grid'; // Ensure container is visible

    // Hide actual products and loading spinner if rendering main skeleton
    if (container === skeletonLoader) {
        if (productsContainer) productsContainer.style.display = 'none';
        if (loader) loader.style.display = 'none';
    }
}

/**
 * Renders the main category buttons.
 * @param {function} navigateFn - The navigation function to call on click.
 */
export function renderMainCategories(navigateFn) {
    const container = mainCategoriesContainer;
    if (!container) return;
    container.innerHTML = ''; // Clear existing buttons

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;
        btn.classList.toggle('active', state.currentCategory === cat.id);

        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Use specific label for 'All'
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Default to Sorani if current lang missing

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName || cat.id}</span>`; // Add default icon

        btn.onclick = () => {
             // Navigate to this category, resetting subcategories and search
            navigateFn({
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
            });
        };
        container.appendChild(btn);
    });
}

/**
 * Renders subcategory buttons for the currently selected main category.
 * @param {string} categoryId - The ID of the parent main category.
 * @param {function} showDetailFn - Function to call when a subcategory is clicked.
 */
export async function renderSubcategories(categoryId, showDetailFn) {
    const container = subcategoriesContainer; // Use the specific container
    if (!container) return;
    container.innerHTML = ''; // Clear previous subcategories

    // Do not render subcategories if 'All' main category is selected
    if (categoryId === 'all' || !categoryId) {
         container.style.display = 'none'; // Hide the container
        return;
    }

    container.style.display = 'flex'; // Show the container

    // Add the "All" button for the current main category's subcategories
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    // Simple "All" icon
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
    allBtn.onclick = () => {
         // This button should filter on the main page, not go to detail page
         window.appActions?.navigateToFilter({ // Use global actions or pass navigateFn
             subcategory: 'all',
             subSubcategory: 'all'
             // Keep current main category and search
         });
    };
    container.appendChild(allBtn);


    // Fetch and render actual subcategories
    try {
        // Fetch subcategories (this might be better done in data-renderer and passed here)
        // For now, keep fetch here for simplicity based on original structure
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0 && querySnapshot.empty) { // Check both state and snapshot
             container.style.display = 'none'; // Hide if truly empty
             return;
        }


        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                <span>${subcatName || subcat.id}</span>
            `;

            // Click navigates to the detail page
            subcatBtn.onclick = () => {
                showDetailFn(categoryId, subcat.id);
            };
            container.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching/rendering subcategories: ", error);
         container.style.display = 'none'; // Hide on error
    }
     // *** REMOVED subSubcategoriesContainer manipulation ***
}


/**
 * Renders sub-subcategory buttons on the detail page.
 * @param {string} mainCatId
 * @param {string} subCatId
 * @param {function} renderProductsFn - Function to call when a button is clicked.
 */
export async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId, renderProductsFn) {
    const container = subSubCategoryContainerOnDetailPage; // Specific container for detail page
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Hide if no sub-subs
            return;
        }

        container.style.display = 'flex'; // Show if there are sub-subs

        // Add the "All" button for this subcategory
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Active by default
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Mark as the 'all' button
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = subpageSearchInput?.value || '';
            renderProductsFn(subCatId, 'all', currentSearch); // Render all products for subCatId
        };
        container.appendChild(allBtn);

        // Add buttons for each sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Store ID for filtering
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';"><span>${subSubcatName || subSubcat.id}</span>`;

            btn.onclick = () => {
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = subpageSearchInput?.value || '';
                renderProductsFn(subCatId, subSubcat.id, currentSearch); // Render products for this specific subSubcatId
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching/rendering sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide on error
    }
}


/**
 * Renders the list of categories inside the categories bottom sheet.
 * @param {function} navigateFn - The navigation function to call on click.
 */
export function renderCategoriesSheetContent(navigateFn) { // Renamed function
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous content

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        btn.classList.toggle('active', state.currentCategory === cat.id);

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName || cat.id}`;

        btn.onclick = () => {
             // Navigate on main page after closing the sheet
            navigateFn({
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
            });
            window.appActions?.closeCurrentPopup(); // Use global close function
            // showPage('mainPage'); // Should be handled by navigateFn triggering applyFilterState
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Renders the list of user notifications in the notifications sheet.
 */
export async function renderUserNotifications() {
    if (!notificationsListContainer) return;
    notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-spinner fa-spin"></i><p>${t('loading_notifications', { default: '...بارکردنی ئاگەدارییەکان' })}</p></div>`;

    try {
        const q = query(collection(db,"announcements"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear loading message
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            localStorage.setItem('lastSeenAnnouncementTimestamp', Date.now()); // Mark as seen even if empty
             if(notificationBadge) notificationBadge.style.display = 'none';
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            const date = new Date(announcement.createdAt);
             // Format date as YYYY/MM/DD
            const formattedDate = date.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD, close enough

            const title = (announcement.title?.[state.currentLanguage]) || (announcement.title?.ku_sorani) || '';
            const content = (announcement.content?.[state.currentLanguage]) || (announcement.content?.ku_sorani) || '';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p> `; // Render newlines
            notificationsListContainer.appendChild(item);
        });

        // Update last seen timestamp and hide badge
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
         if(notificationBadge) notificationBadge.style.display = 'none';

    } catch (error) {
        console.error("Error rendering user notifications:", error);
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-exclamation-circle"></i><p>${t('error_loading_notifications', { default: 'هەڵە لە بارکردنی ئاگەدارییەکان' })}</p></div>`;
    }
}

/**
 * Renders the terms and policies content in the respective sheet.
 */
export async function renderPolicies() {
    if (!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage]
                         || policies.ku_sorani // Fallback Sorani
                         || '';
            // Replace newlines with <br> for HTML display
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_loading_policies', {default:'هەڵە لە بارکردنی ڕێساکان.'})}</p>`;
    }
}

// --- Animations & Misc UI ---

/** Sets up Intersection Observer for scroll animations on product cards. */
export function setupScrollAnimations() {
    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
        console.warn("IntersectionObserver not supported, scroll animations disabled.");
        // Make all cards visible immediately as a fallback
        document.querySelectorAll('.product-card-reveal').forEach(card => {
            card.classList.add('visible');
        });
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% of the card is visible
    });

    // Observe newly added product cards that have the reveal class
    document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
        observer.observe(card);
    });
}

/** Sets up the GPS button functionality in the profile sheet. */
export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
     // Ensure originalBtnText is captured correctly even if language changes later
    const originalBtnTextKey = 'get_gps_location'; // Assuming a key exists
    const originalBtnText = t(originalBtnTextKey, { default: 'وەرگرتنی ناونیشانم بە GPS' });
    if(btnSpan) btnSpan.textContent = originalBtnText; // Set initial text

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification(t('gps_not_supported', { default: 'وێبگەڕەکەت پشتگیری GPS ناکات' }), 'error');
            return;
        }

        if (btnSpan) btnSpan.textContent = t('loading_wait', { default: '...چاوەڕوان بە' });
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
             async (position) => { // Success Callback
                const { latitude, longitude } = position.coords;
                try {
                    // Using Nominatim for reverse geocoding (OpenStreetMap data)
                    // Request language preference based on current app language
                    const langPref = state.currentLanguage.split('_')[0]; // 'ku' or 'ar'
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${langPref},en`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification(t('address_received', { default: 'ناونیشان وەرگیرا' }), 'success');
                    } else {
                         throw new Error('No display_name found in geocoding response.');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    showNotification(t('error_getting_address', { default: 'هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا' }), 'error');
                     // Fallback: Display coordinates if geocoding fails
                     profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
                } finally {
                    if (btnSpan) btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error Callback
                let messageKey = 'error_gps_unknown';
                switch (error.code) {
                    case error.PERMISSION_DENIED: messageKey = 'error_gps_permission'; break;
                    case error.POSITION_UNAVAILABLE: messageKey = 'error_gps_unavailable'; break;
                    case error.TIMEOUT: messageKey = 'error_gps_timeout'; break;
                }
                showNotification(t(messageKey, { default: 'هەڵە لە وەرگرتنی شوێن.' }), 'error');
                if (btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 } // Options
        );
    });
}

