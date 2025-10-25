// ui-manager.js - Responsible for UI interactions, rendering elements, translations, etc.
import {
    db, state, translations,
    sheetOverlay, loginModal, productFormModal, // Import necessary DOM elements
    cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions, // Cart UI elements
    favoritesContainer, emptyFavoritesMessage, // Favorites UI elements
    sheetCategoriesContainer, // Categories sheet container
    notificationsListContainer, notificationBadge, // Notifications UI
    termsContentContainer, // Terms UI
    subSubcategoriesContainer, // Main page sub-subcategories (might be removed)
    skeletonLoader, productsContainer, loader, // Product list UI elements
} from './app-setup.js';

import {
    getDoc, doc, query, collection, orderBy, limit, getDocs, where
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Global UI State Functions ---

/**
 * Saves the current scroll position in the history state for the main page.
 */
function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state
    if (document.getElementById('mainPage')?.classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

/**
 * Updates the header view based on the current page.
 * @param {string} pageId - The ID of the page being shown.
 * @param {string} [title=''] - The title for subpages.
 */
export function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) return;

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

/**
 * Shows the specified page and hides others.
 * @param {string} pageId - The ID of the page to show.
 * @param {string} [pageTitle=''] - Optional title for subpages.
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

    // Update header based on the page
    if (pageId === 'settingsPage') {
        updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        updateHeaderView('subcategoryDetailPage', pageTitle);
    } else {
        updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    }
}

/**
 * Closes all modals and bottom sheets.
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if (sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

/**
 * Opens a modal or bottom sheet.
 * @param {string} id - The ID of the element to open.
 * @param {string} [type='sheet'] - 'sheet' or 'modal'.
 */
export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition();
    const element = document.getElementById(id);
    if (!element || !sheetOverlay) return;

    closeAllPopupsUI(); // Close any existing popups first

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Specific rendering logic will be called from user-actions.js or app-logic.js
        // Example placeholders:
        // if (id === 'cartSheet') renderCart();
        // if (id === 'favoritesSheet') renderFavoritesPage();
        // if (id === 'categoriesSheet') renderCategoriesSheet();
        // if (id === 'notificationsSheet') renderUserNotifications();
        // if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') { // Populate profile form if opening profile sheet
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // Modal
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    // We push state in app-logic.js now to keep navigation logic centralized
    // history.pushState({ type: type, id: id }, '', `#${id}`);
}

/**
 * Updates the active state of the bottom navigation buttons.
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

// --- Translation ---

/**
 * Gets the translation for a given key in the current language.
 * @param {string} key - The translation key.
 * @param {object} [replacements={}] - Optional replacements for placeholders.
 * @returns {string} The translated string or the key itself if not found.
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

    // Re-render components that depend on language (will be triggered from app-logic)
    // Example placeholders:
    // renderHomePageContent(); or renderProducts();
    // renderMainCategories();
    // renderCategoriesSheet();
    // if (cart sheet open) renderCart();
    // if (favorites sheet open) renderFavoritesPage();
}


// --- Notifications ---

/**
 * Shows a temporary notification message.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - 'success' or 'error'.
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
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}


// --- UI Element Creation & Rendering ---

/**
 * Formats description text with line breaks and clickable links.
 * @param {string} text - The description text.
 * @returns {string} HTML formatted string.
 */
export function formatDescription(text) {
    if (!text) return '';
    // Basic escaping
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (simplified)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        // Ensure quotes are handled correctly in the href attribute
        const safeUrl = hyperLink.replace(/"/g, '&quot;');
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newlines with <br>
    return textWithLinks.replace(/\n/g, '<br>');
}


/**
 * Creates a product card HTML element.
 * Needs functions like `isFavorite`, `addToCart`, `toggleFavorite`, `showProductDetailsWithData`, `editProduct`, `deleteProduct` passed or imported.
 * These will likely come from user-actions.js and admin-logic via app-logic.js
 * @param {object} product - Product data object.
 * @param {object} actions - Object containing action functions { isFavorite, addToCart, toggleFavorite, showDetails, editProduct, deleteProduct, shareProduct }.
 * @returns {HTMLElement} The product card element.
 */
export function createProductCardElement(product, actions) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {default: 'کاڵای بێ ناو'});
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
            </div>
        `;
    }

    const isProdFavorite = actions.isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="${t('toggle_favorite', {default: 'Add/Remove Favorite'})}">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
            <button class="share-btn-card" aria-label="${t('share_product', {default: 'Share Product'})}">
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
            <button class="edit-btn" aria-label="${t('edit_product', {default: 'Edit Product'})}"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="${t('delete_product', {default: 'Delete Product'})}"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // --- Event Listeners using provided actions ---
    const shareButton = productCard.querySelector('.share-btn-card');
    if (shareButton) {
        shareButton.addEventListener('click', (event) => {
            event.stopPropagation();
            actions.shareProduct(product); // Call the share action
        });
    }

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const editButton = target.closest('.edit-btn');
        const deleteButton = target.closest('.delete-btn');
        const favoriteButton = target.closest('.favorite-btn');
        const shareBtn = target.closest('.share-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            actions.addToCart(product.id, addToCartButton); // Pass button for UI feedback
        } else if (isAdminNow && editButton) {
            actions.editProduct(product.id);
        } else if (isAdminNow && deleteButton) {
            actions.deleteProduct(product.id);
        } else if (favoriteButton) {
            actions.toggleFavorite(product.id, event);
        } else if (shareBtn) {
           // Share handled by its own listener now
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description
            actions.showDetails(product.id);
        }
    });

    return productCard;
}

/**
 * Creates a promo card slider element. Requires interaction logic.
 * @param {object} cardData - Object containing an array of cards for the group.
 * @param {object} sliderState - Object to hold the current index and interval ID for this specific slider instance.
 * @param {Function} navigateToFilter - Function to handle navigation.
 * @returns {HTMLElement | null} The promo card element or null if no cards.
 */
export function createPromoCardElement(cardData, sliderState, navigateToFilter) {
    if (!cardData || !cardData.cards || cardData.cards.length === 0) {
        return null;
    }

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container promo-slider-container'; // Added a class for potential styling
    promoGrid.style.marginBottom = '24px';
    // Unique ID is set in the calling function (renderPromoCardsSectionForHome)

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item'; // Keep existing classes

    const updateCardContent = (index) => {
        const currentCard = cardData.cards[index];
        const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani || 'https://placehold.co/600x200/e2e8f0/2d3748?text=Promo';
        const targetCategoryId = currentCard.categoryId;

        promoCardElement.innerHTML = `
            <div class="product-image-container">
                <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
            </div>
            ${cardData.cards.length > 1 ? `
            <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
            <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
            ` : ''}
        `;

        // Re-attach listeners for buttons if they exist
        if (cardData.cards.length > 1) {
            const prevBtn = promoCardElement.querySelector('.promo-slider-btn.prev');
            const nextBtn = promoCardElement.querySelector('.promo-slider-btn.next');

            if (prevBtn) {
                prevBtn.onclick = (e) => {
                    e.stopPropagation();
                    sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
                    updateCardContent(sliderState.currentIndex);
                    // Reset interval on manual navigation (optional)
                    // resetInterval();
                };
            }
            if (nextBtn) {
                nextBtn.onclick = (e) => {
                    e.stopPropagation();
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
                    updateCardContent(sliderState.currentIndex);
                     // Reset interval on manual navigation (optional)
                    // resetInterval();
                };
            }
        }

         // Click listener for the card itself (navigation)
         promoCardElement.onclick = async (e) => {
             if (!e.target.closest('button')) { // Don't navigate if clicking buttons
                 const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
                 if (targetCategoryId && categoryExists) {
                     await navigateToFilter({
                         category: targetCategoryId,
                         subcategory: 'all',
                         subSubcategory: 'all',
                         search: ''
                     });
                     document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
                 } else if (targetCategoryId) {
                     console.warn(`Promo card links to non-existent category ID: ${targetCategoryId}`);
                 }
             }
         };
    };

    updateCardContent(sliderState.currentIndex); // Initial render
    promoGrid.appendChild(promoCardElement);

    // Auto-rotation interval is managed in app-logic.js (renderPromoCardsSectionForHome)

    return promoGrid;
}


/**
 * Renders skeleton loading cards.
 * @param {HTMLElement} [container=skeletonLoader] - The container to render into.
 * @param {number} [count=8] - Number of skeleton cards to render.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) return;
    container.innerHTML = ''; // Clear previous skeletons or content
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
    container.style.display = 'grid'; // Ensure grid layout is applied

    // Hide actual content and loader when showing skeleton
    if (container === skeletonLoader) {
        if (productsContainer) productsContainer.style.display = 'none';
        if (loader) loader.style.display = 'none';
    }
}

/**
 * Sets up Intersection Observer for scroll animations.
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
        threshold: 0.1 // Trigger when 10% visible
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

/**
 * Displays the product details in the bottom sheet.
 * @param {object} product - The product data object.
 */
export function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {default: 'کاڵای بێ ناو'});
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

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
            thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Display placeholder if no images
        imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="${nameInCurrentLang}" class="active">`;
    }

    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');

    function updateSlider(index) {
        if (!images[index]) return;
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        if (thumbnails[index]) thumbnails[index].classList.add('active'); // Check if thumbnail exists
        currentIndex = index;
    }

    // Show/Hide slider buttons
    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
        thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        prevBtn.onclick = null;
        nextBtn.onclick = null;
        thumbnails.forEach(thumb => thumb.onclick = null);
    }

    // Update text content
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    // Update price display
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Update Add to Cart button (action will be attached in app-logic)
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    // addToCartButton.onclick = () => { /* Logic from user-actions */ };

    // Render related products (logic likely in data-renderer.js)
    // renderRelatedProducts(product);

    // Open the sheet (call will be made from app-logic)
    // openPopup('productDetailSheet');
}

/**
 * Renders related products in the product detail sheet.
 * @param {object} currentProduct - The product currently being viewed.
 */
export async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    if (!section || !container) return;

    container.innerHTML = ''; // Clear previous
    section.style.display = 'none'; // Hide initially

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Cannot find related if no category info
    }

    let q;
    // Prioritize most specific category match
    if (currentProduct.subSubcategoryId) {
        q = query(
            collection(db, "products"),
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Exclude the current product
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        q = query(
            collection(db, "products"),
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else { // Fallback to main category
        q = query(
            collection(db, "products"),
            where('categoryId', '==', currentProduct.categoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return;
        }

        // Need access to createProductCardElement and action functions
        // This suggests `createProductCardElement` should be here or easily accessible
        // Let's assume actions are globally available or passed down for now
        const actions = window.appActions; // Placeholder for actual actions object

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // Ensure actions are passed
            if (actions) {
                 const card = createProductCardElement(product, actions);
                 if (card) container.appendChild(card);
            } else {
                 console.warn("Actions not available for rendering related product card.");
            }
        });

        if (container.children.length > 0) {
            section.style.display = 'block'; // Show section if products were added
        }

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}

/**
 * Renders the list of categories in the bottom sheet.
 * Requires `MapsToFilter` function.
 * @param {Function} navigateToFilter - Function to handle navigation/filtering.
 */
export function renderCategoriesSheet(navigateToFilter) {
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Default icon

        btn.onclick = async () => {
            // Call the navigation function passed from app-logic
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
             // Close popup needs to be handled by app-logic potentially
            // closeCurrentPopup();
             // showPage('mainPage'); // Handled by navigateToFilter/popstate
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Renders the main category buttons strip.
 * Requires `MapsToFilter` function.
 * @param {Function} navigateToFilter - Function to handle navigation/filtering.
 */
export function renderMainCategories(navigateToFilter) {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Default icon

        btn.onclick = async () => {
            // Call the navigation function passed from app-logic
            await navigateToFilter({
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
 * Renders subcategory buttons based on the selected main category.
 * Requires `showSubcategoryDetailPage` function.
 * @param {string} categoryId - The ID of the selected main category.
 * @param {Function} showSubcategoryDetailPage - Function to navigate to detail page.
 */
export async function renderSubcategories(categoryId, showSubcategoryDetailPage) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // Clear previous
    subcategoriesContainer.style.display = 'none'; // Hide by default

    if (!categoryId || categoryId === 'all') {
        return; // Don't show subcategories if 'All' or no category is selected
    }

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const fetchedSubcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (fetchedSubcategories.length === 0) return; // Don't show if empty

        subcategoriesContainer.style.display = 'flex'; // Show the container

        // Add 'All' button for this subcategory level
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
             // Need navigateToFilter here
            // await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
             console.warn("navigateToFilter needed in renderSubcategories 'All' button");
        };
       // subcategoriesContainer.appendChild(allBtn); // Re-evaluate if 'All' is needed here vs detail page

        // Add actual subcategory buttons
        fetchedSubcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            subcatBtn.onclick = () => {
                // Call the function passed from app-logic
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching/rendering subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

/**
 * Renders sub-subcategory buttons on the detail page.
 * Requires `renderProductsOnDetailPage` function.
 * @param {string} mainCatId
 * @param {string} subCatId
 * @param {Function} renderProductsFn - Function to render products for the selected sub-sub category.
 */
export async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId, renderProductsFn) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    container.innerHTML = ''; // Clear previous
    container.style.display = 'none'; // Hide by default

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return; // Don't show if empty
        }

        container.style.display = 'flex'; // Show container

        // Add 'All' button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Default to active
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all';
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
            renderProductsFn(subCatId, 'all', currentSearch); // Call passed function
        };
        container.appendChild(allBtn);

        // Add specific sub-subcategory buttons
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id;
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
                renderProductsFn(subCatId, subSubcat.id, currentSearch); // Call passed function
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching/rendering sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide on error
    }
}


/**
 * Sets up the GPS button functionality.
 */
export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan?.textContent || t('get_location', {default: 'Get My Location'});

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification(t('gps_not_supported', {default: 'GPS not supported by your browser'}), 'error');
            return;
        }

        if (btnSpan) btnSpan.textContent = t('waiting', {default: '...Waiting'});
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success Callback
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Using Nominatim for reverse geocoding (requires internet)
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${state.currentLanguage},en`); // Prioritize current lang
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification(t('address_retrieved', {default: 'Address Retrieved'}), 'success');
                    } else {
                         profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coords
                        showNotification(t('address_not_found_gps', {default: 'Could not find address, using coordinates'}), 'warning');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                     profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coords
                    showNotification(t('error_getting_address_gps', {default: 'Error getting address, using coordinates'}), 'error');
                } finally {
                    if (btnSpan) btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error Callback
                let message = '';
                switch (error.code) {
                    case 1: message = t('gps_permission_denied', {default: 'GPS permission denied'}); break;
                    case 2: message = t('gps_position_unavailable', {default: 'Location information is unavailable'}); break;
                    case 3: message = t('gps_timeout', {default: 'Location request timed out'}); break;
                    default: message = t('gps_unknown_error', {default: 'An unknown GPS error occurred'}); break;
                }
                showNotification(message, 'error');
                if (btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            }
        );
    });
}
