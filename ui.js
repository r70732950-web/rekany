// ui.js: UI interaction and rendering functions / فەنکشنەکانی کارلێک و پیشاندانی ڕووکاری بەکارهێنەر

import {
    state, db, collection, query, orderBy, getDocs, doc, getDoc, limit, where,
    FAVORITES_KEY, announcementsCollection,
    productsCollection // Import necessary Firestore variables/refs
} from './app-setup.js';
import { t, formatDescription } from './utils.js';
import { renderCart, saveCart, generateOrderMessage, addToCart } from './cart.js'; // Import cart functions used here

// --- Notification / ئاگاداری ---
/**
 * Displays a short notification message at the top right of the screen.
 * پیشاندانی نامەیەکی ئاگاداری کورت لە سەرەوەی لای ڕاستی شاشەکە.
 * @param {string} message The message to display. / ئەو نامەیەی پیشان دەدرێت.
 * @param {string} [type='success'] The type of notification ('success' or 'error'). / جۆری ئاگاداری ('success' یان 'error').
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
        setTimeout(() => {
            // Check if the element still exists before removing
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}


// --- Popups (Modals & Sheets) / پۆپئەپەکان (مۆداڵ و شیتەکان) ---

/**
 * Closes all currently visible modals and bottom sheets and hides the overlay.
 * داخستنی هەموو مۆداڵ و شیتە بنییە کراوەکان و شاردنەوەی پۆشەرەکە.
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    const sheetOverlay = document.getElementById('sheet-overlay');
    if (sheetOverlay) {
        sheetOverlay.classList.remove('show');
    }
    document.body.classList.remove('overlay-active'); // Re-enable body scroll
}

/**
 * Opens a specific popup (modal or bottom sheet) by its ID.
 * کردنەوەی پۆپئەپێکی دیاریکراو (مۆداڵ یان شیتی بنی) بە بەکارهێنانی ID یەکەی.
 * @param {string} id The ID of the element to open. / ID ی ئەو توخمەی دەکرێتەوە.
 * @param {string} [type='sheet'] The type of popup ('sheet' or 'modal'). / جۆری پۆپئەپ ('sheet' یان 'modal').
 */
export function openPopup(id, type = 'sheet') {
    // saveCurrentScrollPosition(); // Keep this in app-logic maybe, depends on usage
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Popup element with ID ${id} not found.`);
        return;
    }

    closeAllPopupsUI(); // Close others before opening new one
    const sheetOverlay = document.getElementById('sheet-overlay');

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Pre-render content if needed when opening the sheet
        if (id === 'cartSheet') renderCart(); // Assumes renderCart is imported/available
        if (id === 'favoritesSheet') renderFavoritesPage(); // Assumes renderFavoritesPage is defined below
        if (id === 'categoriesSheet') renderCategoriesSheet(); // Assumes renderCategoriesSheet is defined below
        if (id === 'notificationsSheet') renderUserNotifications(); // Assumes renderUserNotifications is defined below
        if (id === 'termsSheet') renderPolicies(); // Assumes renderPolicies is defined below
        if (id === 'profileSheet') { // Populate profile form if opening profile sheet
             document.getElementById('profileName').value = state.userProfile.name || '';
             document.getElementById('profileAddress').value = state.userProfile.address || '';
             document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // Modal type
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent body scrolling when popup is open
    // history management remains in app-logic.js
}

/**
 * Handles closing the currently active popup, often triggered by back button or close icon.
 * داخستنی پۆپئەپی چالاکی ئێستا، زۆر جار لە ڕێگەی دوگمەی گەڕانەوە یان ئایکۆنی داخستنەوە.
 */
export function closeCurrentPopup() {
     // History management determines the actual closing logic in app-logic.js
     // This function might just visually hide if not tied to history,
     // but currently relies on history.back() in app-logic.js
     if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
         history.back(); // Let the popstate listener handle the UI closing
     } else {
         closeAllPopupsUI(); // Fallback if no relevant history state
     }
}

// --- Page Navigation & Header / گەشتیاری نێو پەڕەکان و سەردێڕ ---

/**
 * Updates the appearance of the header based on the active page.
 * نوێکردنەوەی دەرکەوتنی سەردێڕ بە پشت بەستن بە پەڕەی چالاک.
 * @param {string} pageId The ID of the page being shown ('mainPage', 'settingsPage', 'subcategoryDetailPage'). / ID ی پەڕەی پیشاندراو.
 * @param {string} [title=''] The title to display in the subpage header. / ئەو سەردێڕەی لە سەردێڕی ژێرپەڕەدا پیشان دەدرێت.
 */
export function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) {
        console.error("Header elements not found!");
        return;
    }

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex'; // Show main search/logo header
        subpageHeader.style.display = 'none'; // Hide back button/title header
    } else {
        mainHeader.style.display = 'none'; // Hide main header
        subpageHeader.style.display = 'flex'; // Show subpage header
        headerTitle.textContent = title; // Set the title for the subpage
    }
}

/**
 * Shows a specific page and hides others, updating the header and active nav item.
 * پیشاندانی پەڕەیەکی دیاریکراو و شاردنەوەی ئەوانی تر، نوێکردنەوەی سەردێڕ و توخمی چالاکی ناڤیگەیشن.
 * @param {string} pageId The ID of the page to show. / ID ی پەڕەی پیشاندراو.
 * @param {string} [pageTitle=''] The title for the subpage header if applicable. / سەردێڕ بۆ سەردێڕی ژێرپەڕە ئەگەر پێویست بوو.
 */
export function showPage(pageId, pageTitle = '') {
    // Hide all pages first
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('page-active');
        page.classList.add('page-hidden');
    });
    // Show the target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('page-active');
        targetPage.classList.remove('page-hidden');
    } else {
        console.error(`Page with ID ${pageId} not found.`);
        // Fallback to main page if target not found
        document.getElementById('mainPage')?.classList.add('page-active');
        document.getElementById('mainPage')?.classList.remove('page-hidden');
        pageId = 'mainPage'; // Update pageId for subsequent logic
    }

    // Scroll to top for subpages
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Update the header based on the active page
    updateHeaderView(pageId, pageTitle);

    // Update the active state in the bottom navigation bar
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    } else {
        // If navigating to a page not directly linked in nav (like subcategory detail), clear active state
        updateActiveNav(null);
    }
}

/**
 * Updates the active state highlight in the bottom navigation bar.
 * نوێکردنەوەی نیشانەی چالاکی لە ناڤیگەیشنی بنی.
 * @param {string | null} activeBtnId The ID of the button to mark as active, or null to clear all. / ID ی دوگمەی چالاککراو، یان null بۆ لابردنی هەموو چالاکییەکان.
 */
export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    if (activeBtnId) {
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
}


// --- Product Rendering / پیشاندانی کاڵاکان ---

/**
 * Renders skeleton loading placeholders for products.
 * پیشاندانی شوێنگرەوەکانی بارکردنی سکێڵتۆن بۆ کاڵاکان.
 * @param {HTMLElement} [container=skeletonLoader] The container element to render into. / ئەو توخمەی تێیدا پیشان دەدرێت.
 * @param {number} [count=8] The number of skeleton cards to render. / ژمارەی کارتی سکێڵتۆنی پیشاندراو.
 */
export function renderSkeletonLoader(container = document.getElementById('skeletonLoader'), count = 8) {
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
    container.style.display = 'grid'; // Ensure container is visible
    // Hide actual product container while skeleton is shown (if default container is used)
    if (container === document.getElementById('skeletonLoader')) {
         document.getElementById('productsContainer').style.display = 'none';
         document.getElementById('loader').style.display = 'none'; // Hide infinite scroll loader too
    }
}

/**
 * Creates an HTML element for a single product card.
 * دروستکردنی توخمێکی HTML بۆ کارتی تاک کاڵایەک.
 * @param {object} product The product data object. / ئۆبجێکتی داتای کاڵاکە.
 * @returns {HTMLElement} The created product card element. / توخمی کارتی کاڵای دروستکراو.
 */
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // Store product ID for later reference
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check if admin is logged in

    // Determine product name in the current language, with fallbacks
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage])
                              || (product.name && product.name.ku_sorani) // Fallback to Sorani
                              || (typeof product.name === 'string' ? product.name : t('product_unnamed', {id: product.id})); // Fallback if name object is missing

    // Determine the main image URL, with fallbacks
    const mainImage = (product.imageUrls && product.imageUrls.length > 0)
                      ? product.imageUrls[0]
                      : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // --- Price and Discount Logic ---
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        // Show discounted price and strikethrough original price
        priceHTML = `<div class="product-price-container">
                        <span class="product-price">${product.price.toLocaleString()} د.ع.</span>
                        <del class="original-price" style="display:inline; color:var(--dark-gray); font-size: 13px; margin-right: 5px;">${product.originalPrice.toLocaleString()} د.ع.</del>
                     </div>`;
        // Calculate and display discount percentage badge
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // --- Shipping Info Logic ---
    let extraInfoHTML = '';
    // Get shipping info text for the current language, trimming whitespace
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();

    if (shippingText) {
        // Create HTML for the shipping badge if text exists
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>
        `;
    }

    // --- Favorite Button Logic ---
    const isProdFavorite = isFavorite(product.id); // Check if product is in favorites
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // Solid or regular heart icon
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn'; // Add 'favorited' class for styling

    // --- Card Inner HTML ---
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
             <button class="${favoriteBtnClass}" aria-label="${isProdFavorite ? t('remove_from_favorites') : t('add_to_favorites')}">
                 <i class="${heartIconClass} fa-heart"></i>
             </button>
            <button class="share-btn-card" aria-label="${t('share_product')}">
                <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card" aria-label="${t('add_to_cart')}">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span> <!-- Hidden text for accessibility -->
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // --- Event Listeners attached in app-logic.js ---
    // (addToCart, edit, delete, toggleFavorite, share, showDetails)

    return productCard;
}

/**
 * Sets up IntersectionObserver to add 'visible' class for fade-in animation on scroll.
 * دامەزراندنی IntersectionObserver بۆ زیادکردنی کڵاسی 'visible' بۆ ئەنیمەیشنی دەرکەوتن لە کاتی سکڕۆڵکردندا.
 */
export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible'); // Add class when element enters viewport
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    // Observe all elements needing the reveal animation
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

/**
 * Renders the list of products into the specified container.
 * پیشاندانی لیستی کاڵاکان لەناو کۆنتەینەری دیاریکراودا.
 * @param {Array} productsToRender The array of product objects to render. / زنجیرەی ئۆبجێکتی کاڵاکان بۆ پیشاندان.
 * @param {HTMLElement} container The container element to append products to. / ئەو توخمەی کاڵاکانی تێدا زیاد دەکرێت.
 * @param {boolean} [append=false] If true, appends to existing content; otherwise, replaces it. / ئەگەر true بوو، بۆ ناوەڕۆکی ئێستا زیاد دەکات؛ ئەگەر نا، جێگەی دەگرێتەوە.
 */
export function renderProducts(productsToRender, container, append = false) {
    if (!container) {
        console.error("Target container for rendering products not found.");
        return;
    }

    if (!append) {
        container.innerHTML = ''; // Clear container if not appending
    }

    if (!productsToRender || productsToRender.length === 0) {
        if (!append) { // Only show message if container was cleared and is now empty
            container.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found')}</p>`;
        }
        return; // Exit if no products to render
    }

    // Create and append product card elements
    productsToRender.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for scroll animation
        container.appendChild(element);
    });

    setupScrollAnimations(); // Re-apply scroll animations for newly added cards
}


// --- Category Rendering / پیشاندانی جۆرەکان ---

/**
 * Renders the main category buttons (horizontal scroll).
 * پیشاندانی دوگمەکانی جۆرە سەرەکییەکان (سکڕۆڵی ئاسۆیی).
 */
export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous buttons

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id; // Store category ID

        // Add 'active' class if this category is currently selected
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // Get category name in current language, fallback to Sorani, or use label for 'all'
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        // Set button icon and text
        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        // Click event handler is attached in app-logic.js (navigateToFilter)
        container.appendChild(btn);
    });
}

/**
 * Renders the category list inside the 'Categories' bottom sheet.
 * پیشاندانی لیستی جۆرەکان لەناو شیتی بنی 'جۆرەکان'.
 */
export function renderCategoriesSheet() {
    const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous list

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id; // Store category ID
        // Add 'active' class if this category is currently selected
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        // Get category name with fallback
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        // Set button icon and text
        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        // Click event handler is attached in app-logic.js (navigateToFilter and close popup)
        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Renders subcategory buttons (horizontal scroll) below main categories.
 * پیشاندانی دوگمەکانی جۆرە لاوەکییەکان (سکڕۆڵی ئاسۆیی) لە ژێر جۆرە سەرەکییەکاندا.
 * @param {string} categoryId The ID of the parent main category. / ID ی جۆری سەرەکی باوان.
 */
export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // Clear previous subcategories
    subcategoriesContainer.style.display = 'none'; // Hide initially

    // Do not show subcategories if 'All' main category is selected or no categoryId provided
    if (categoryId === 'all' || !categoryId) {
        return;
    }

    try {
        // Query subcategories for the given main category, ordered by 'order'
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        // Store fetched subcategories in state (optional, could be useful elsewhere)
        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // If no subcategories found, keep the container hidden and exit
        if (state.subcategories.length === 0) return;

        subcategoriesContainer.style.display = 'flex'; // Show the container

        // --- Create 'All' button for subcategories ---
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        // SVG icon for 'All'
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        // Click event handler attached in app-logic.js (navigateToFilter)
        subcategoriesContainer.appendChild(allBtn);

        // --- Create buttons for each subcategory ---
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            // Get subcategory name with fallback
            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent pixel
            const imageUrl = subcat.imageUrl || placeholderImg; // Use image URL or placeholder

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            // Click event handler attached in app-logic.js (showSubcategoryDetailPage)
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching/rendering subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}


// --- Favorites Rendering / پیشاندانی دڵخوازەکان ---

/**
 * Checks if a product is in the user's favorites list.
 * پشکنینی ئەوەی کە ئایا کاڵایەک لە لیستی دڵخوازەکانی بەکارهێنەردایە.
 * @param {string} productId The ID of the product to check. / ID ی کاڵاکە.
 * @returns {boolean} True if the product is a favorite, false otherwise. / True ئەگەر کاڵاکە دڵخواز بوو، ئەگەر نا False.
 */
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/**
 * Saves the current favorites list to local storage.
 * پاشەکەوتکردنی لیستی دڵخوازەکانی ئێستا لە local storage.
 */
export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

/**
 * Renders the user's favorite products in the favorites bottom sheet.
 * پیشاندانی کاڵا دڵخوازەکانی بەکارهێنەر لە شیتی بنی دڵخوازەکاندا.
 */
export async function renderFavoritesPage() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
    if (!favoritesContainer || !emptyFavoritesMessage) return;

    favoritesContainer.innerHTML = ''; // Clear previous items

    if (state.favorites.length === 0) {
        // Show empty message if no favorites
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    // Hide empty message and show container
    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';

    // Show skeleton loader while fetching
    renderSkeletonLoader(favoritesContainer, state.favorites.length);

    try {
        // Create promises to fetch details for each favorite product ID
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        // Wait for all promises to resolve
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeletons

        // Filter out products that might have been deleted and map to data objects
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // If all favorited products were deleted, show empty message again
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            // Render the fetched favorite products
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product);
                productCard.classList.add('product-card-reveal'); // Add animation class
                favoritesContainer.appendChild(productCard);
            });
            setupScrollAnimations(); // Apply animations
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; padding:20px; grid-column: 1/-1;">${t('error_generic')}</p>`; // Show error message
    }
}


// --- Notifications & Policies Rendering / پیشاندانی ئاگادارییەکان و سیاسەتەکان ---

/**
 * Checks for new announcements and updates the notification badge visibility.
 * پشکنینی بۆ ئاگادارییە نوێیەکان و نوێکردنەوەی بینینی نیشانەی ئاگاداری.
 */
export function checkNewAnnouncements() {
    const notificationBadge = document.getElementById('notificationBadge');
    if (!notificationBadge) return;

    // Query for the latest announcement based on creation timestamp
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    // Listen for real-time updates (optional, could be getDocs for one-time check)
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Get the timestamp of the last announcement the user saw
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // If the latest announcement is newer than the last seen one, show the badge
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
            // No announcements found, hide badge
            notificationBadge.style.display = 'none';
        }
    }, (error) => {
        console.error("Error checking new announcements:", error);
        notificationBadge.style.display = 'none'; // Hide badge on error
    });
    // Consider returning `unsubscribe` if you need to stop listening later
}

/**
 * Renders the list of announcements in the notifications bottom sheet.
 * پیشاندانی لیستی ئاگادارییەکان لە شیتی بنی ئاگادارییەکاندا.
 */
export async function renderUserNotifications() {
    const notificationsListContainer = document.getElementById('notificationsListContainer');
    if (!notificationsListContainer) return;

    notificationsListContainer.innerHTML = `<div style="text-align:center; padding:20px;">${t('loading_notifications', {default: '...بارکردنی ئاگەدارییەکان'})}</div>`;

    try {
        // Query all announcements, ordered by newest first
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear loading message
        if (snapshot.empty) {
            // Show message if no notifications found
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        // Loop through each announcement document
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Keep track of the newest announcement timestamp
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            // Format the date
            const date = new Date(announcement.createdAt);
            const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

            // Get title and content in the current language, with fallbacks
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            // Create and append the notification item element
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p> <!-- Replace newlines -->
            `;
            notificationsListContainer.appendChild(item);
        });

        // Update the last seen timestamp in local storage after displaying
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        // Hide the notification badge in the header
        const notificationBadge = document.getElementById('notificationBadge');
        if (notificationBadge) notificationBadge.style.display = 'none';

    } catch (error) {
        console.error("Error rendering user notifications:", error);
        notificationsListContainer.innerHTML = `<div style="text-align:center; padding:20px;">${t('error_generic')}</div>`;
    }
}

/**
 * Renders the terms and policies content in the corresponding bottom sheet.
 * پیشاندانی ناوەڕۆکی مەرج و سیاسەتەکان لە شیتی بنی تایبەت بە خۆیدا.
 */
export async function renderPolicies() {
    const termsContentContainer = document.getElementById('termsContentContainer');
    if (!termsContentContainer) return;

    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Show loading message
    try {
        // Get the policies document from Firestore
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language, fallback to Sorani, or empty string
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Display content, replacing newlines with <br>, or show 'not found' message
            termsContentContainer.innerHTML = content
                ? content.replace(/\n/g, '<br>')
                : `<p>${t('no_policies_found')}</p>`;
        } else {
            // Show 'not found' message if document or content doesn't exist
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Show error message
    }
}

// --- Contact Links Rendering / پیشاندانی لینکەکانی پەیوەندی ---

/**
 * Renders the social media/contact links in the settings page.
 * پیشاندانی لینکەکانی سۆشیال میدیا/پەیوەندی لە پەڕەی ڕێکخستنەکاندا.
 */
export function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if (!contactLinksContainer) return;

    // Define the Firestore collection reference
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    // Query links, ordered by creation time (you might want a different order)
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Or order by a specific 'order' field if you add one

    // Listen for real-time updates to the links
    const unsubscribe = onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

        if (snapshot.empty) {
            // Show message if no links are found
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        // Loop through each link document
        snapshot.forEach(doc => {
            const link = doc.data();
            // Get name in current language with fallback
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            // Create the link element (<a>)
            const linkElement = document.createElement('a');
            linkElement.href = link.url; // Set the URL
            linkElement.target = '_blank'; // Open in new tab
            linkElement.rel = 'noopener noreferrer'; // Security measure
            linkElement.className = 'settings-item'; // Use existing style

            // Set the inner HTML with icon and name
            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i> <!-- External link icon -->
            `;

            contactLinksContainer.appendChild(linkElement); // Add link to the container
        });
    }, (error) => {
        console.error("Error fetching contact links:", error);
        contactLinksContainer.innerHTML = `<p style="padding: 15px; text-align: center;">${t('error_generic')}</p>`;
    });
    // Consider returning `unsubscribe` if needed
}

/**
 * Renders the available order submission method buttons (WhatsApp, Viber, etc.) in the cart.
 * پیشاندانی دوگمەکانی شێوازەکانی ناردنی داواکاری بەردەست (واتسئاپ، ڤایبەر، هتد) لە سەبەتەکەدا.
 */
export async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    if (!container) return;
    container.innerHTML = ''; // Clear previous buttons

    try {
        // Reference to the contact methods subcollection
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        // Query methods, ordered by creation time (or an 'order' field if added)
        const q = query(methodsCollection, orderBy("createdAt")); // Assuming older methods should appear first

        const snapshot = await getDocs(q); // Fetch the methods once

        if (snapshot.empty) {
            // Show message if no methods are configured
            container.innerHTML = '<p style="text-align: center; margin-top: 10px;">هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        // Loop through each contact method document
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a generic class and apply specific styles inline or via data attributes
            btn.className = 'whatsapp-btn'; // Reusing class, maybe rename to 'order-action-btn'
            btn.style.backgroundColor = method.color; // Set button color

            // Get button text in current language with fallback
            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`; // Set icon and text

            // --- Click Handler ---
            btn.onclick = () => {
                const message = generateOrderMessage(); // Generate the order message from cart.js
                if (!message) return; // Don't proceed if cart is empty

                let link = '';
                const encodedMessage = encodeURIComponent(message); // URL-encode the message
                const value = method.value; // The phone number, username, or URL

                // Construct the appropriate link based on the method type
                switch (method.type) {
                    case 'whatsapp':
                        // Ensure number includes country code, '+' is handled by wa.me
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber links: number should include country code without '+'
                        link = `viber://chat?number=${value.replace('+', '')}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        // Telegram link uses username (without @)
                        link = `https://t.me/${value.replace('@', '')}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        // Standard telephone link
                        link = `tel:${value}`;
                        break;
                    case 'url': // For custom URLs (e.g., website order form)
                        // Assume the value is the full URL, potentially append message as query param?
                        // This might need adjustment based on how the target URL handles input.
                        // For simplicity, just opening the URL for now.
                        link = value; // Could be: `${value}?message=${encodedMessage}`
                        break;
                }

                // Open the generated link in a new tab/app
                if (link) {
                    window.open(link, '_blank');
                }
            };
            // --- End Click Handler ---

            container.appendChild(btn); // Add the button to the container
        });
    } catch (error) {
        console.error("Error fetching contact methods for cart:", error);
        container.innerHTML = `<p style="text-align: center; margin-top: 10px;">${t('error_generic')}</p>`;
    }
}

