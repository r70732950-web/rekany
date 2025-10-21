// ui-logic.js
import {
    state, translations,
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer, // Note: subSubcategoriesContainer usage might be removed/changed
    db // Need db temporarily for direct calls in some render functions, consider refactoring
} from './app-setup.js';

// Import data/logic functions needed by UI
import {
    saveCart, saveFavorites, isFavorite, toggleFavorite, addToCart, updateQuantity, removeFromCart, generateOrderMessage,
    handleSignIn, handleSignOut, requestNotificationPermission, searchProductsInFirestore,
    fetchSubcategories, fetchSubSubcategories, fetchProductDetails, // Added fetchProductDetails
    init as dataInit // Renamed to avoid conflict
} from './data-logic.js';

import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Direct imports needed here

// --- Utilities ---

export function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

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
        // Remove from DOM after transition
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000); // 3 seconds
}

// --- Navigation & Page/Popup Handling ---

function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state (not popups or other pages)
    if (document.getElementById('mainPage')?.classList.contains('page-active') && currentState && !currentState.type) {
         history.replaceState({ ...currentState, scroll: window.scrollY }, '');
     }
}

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

export function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top only when navigating to a new *page* (not main page potentially)
     if (pageId !== 'mainPage') {
         window.scrollTo(0, 0); // Always scroll subpages to top
     }

    // Update header based on the active page
     updateHeaderView(pageId, pageTitle);


    // Update bottom navigation active state
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' :
                       (pageId === 'settingsPage' ? 'settingsBtn' : null); // Add more page IDs if needed
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    }
}


export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay?.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening popup
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any existing popups first

    if (type === 'sheet') {
        sheetOverlay?.classList.add('show');
        element.classList.add('show');
        // Pre-render content if needed when opening specific sheets
         if (id === 'cartSheet') renderCart();
         if (id === 'favoritesSheet') renderFavoritesPage();
         if (id === 'categoriesSheet') renderCategoriesSheet();
         if (id === 'notificationsSheet') renderUserNotifications();
         if (id === 'termsSheet') renderPolicies();
         if (id === 'profileSheet') { // Pre-fill profile form
             document.getElementById('profileName').value = state.userProfile.name || '';
             document.getElementById('profileAddress').value = state.userProfile.address || '';
             document.getElementById('profilePhone').value = state.userProfile.phone || '';
         }
    } else { // Modal
        element.style.display = 'block';
    }

    document.body.classList.add('overlay-active'); // Prevent body scroll
    history.pushState({ type: type, id: id }, '', `#${id}`); // Add history entry
}

export function closeCurrentPopup() {
    // Check if the current history state is a popup state
     if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
         history.back(); // Use browser back to close and remove history entry
     } else {
         closeAllPopupsUI(); // Fallback if history state is not correct
     }
}

// Apply filter state to UI elements
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input
     searchInput.value = state.currentSearch;
     clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';


    // Re-render category/subcategory bars based on new state
     renderMainCategories(); // Update active state
    await renderSubcategories(state.currentCategory); // Render subcategories for the current main category

     // Trigger search/fetch in data-logic (which will then call back to render)
     await searchProductsInFirestore(state.currentSearch, true); // true = isNewSearch

    // Restore scroll position if navigating back/forward
     if (fromPopState && typeof filterState.scroll === 'number') {
         // Use setTimeout to ensure rendering is complete before scrolling
         setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
     } else if (!fromPopState) {
        // Scroll to top for new filter actions
         window.scrollTo({ top: 0, behavior: 'smooth' });
     }
}


// Handles navigation based on user filter actions
async function navigateToFilter(newState) {
     // Save current scroll position before navigating
     history.replaceState({
         ...history.state, // Preserve existing state properties if any
         scroll: window.scrollY
     }, '');

     // Create the new state object, overriding with newState, resetting scroll
     const finalState = {
         category: state.currentCategory,
         subcategory: state.currentSubcategory,
         subSubcategory: state.currentSubSubcategory,
         search: state.currentSearch,
         ...newState,
         scroll: 0 // Reset scroll for new navigation
     };

     // Update URL parameters
     const params = new URLSearchParams();
     if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
     if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
     if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
     if (finalState.search) params.set('search', finalState.search);

     const newUrl = `${window.location.pathname}?${params.toString()}`;

     // Push the new state and URL to history
     history.pushState(finalState, '', newUrl);

     // Apply the new filter state to the UI and fetch data
     await applyFilterState(finalState);
}


async function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const isSubcategoryPage = hash.startsWith('subcategory_');
    const isSettingsPage = hash === 'settingsPage';
    const isProductDetail = params.get('product'); // Check for product detail first
    const isPopup = hash && (document.getElementById(hash)?.classList.contains('bottom-sheet') || document.getElementById(hash)?.classList.contains('modal'));

    // Prioritize Product Detail Popup
    if (isProductDetail) {
         showPage('mainPage'); // Show main page in background
        const initialState = { /* ... initial filter state from params ... */ scroll: 0 };
        history.replaceState(initialState, ''); // Set base state
        applyFilterState(initialState);
         setTimeout(() => showProductDetails(params.get('product')), 300); // Open product detail popup
    }
    // Then check for other pages
    else if (isSubcategoryPage) {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
         // Don't push history here, showPage will update header, rendering happens elsewhere
         // showSubcategoryDetailPage will be called by initializeAppLogic after categories load
         // For now, just ensure the header is updated if possible
         updateHeaderView('subcategoryDetailPage', 'Loading...'); // Temporary title
    } else if (isSettingsPage) {
         history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
         showPage('settingsPage', t('settings_title'));
    }
    // Then check for popups on the main page
    else if (isPopup) {
         showPage('mainPage'); // Ensure main page is shown
        const initialState = { /* ... initial filter state from params ... */ scroll: 0 };
        history.replaceState(initialState, ''); // Set base state
        applyFilterState(initialState);
        const elementType = document.getElementById(hash)?.classList.contains('bottom-sheet') ? 'sheet' : 'modal';
         openPopup(hash, elementType); // This adds its own history state
    }
    // Default to main page with filters
    else {
         showPage('mainPage');
        const initialState = {
             category: params.get('category') || 'all',
             subcategory: params.get('subcategory') || 'all',
             subSubcategory: params.get('subSubcategory') || 'all',
             search: params.get('search') || '',
             scroll: 0
         };
         history.replaceState(initialState, ''); // Set base state for main page filters
         applyFilterState(initialState);
    }
}


// --- UI Rendering Functions ---

export function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Update all elements with the cart-count class
     document.querySelectorAll('.cart-count').forEach(el => {
         el.textContent = totalItems;
         // Optionally show/hide the badge based on count
         el.style.display = totalItems > 0 ? 'flex' : 'none';
     });
}


export function populateCategoryDropdown() {
    if (!productCategorySelect) return;
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

export function renderCategoriesSheet() {
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous buttons
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) {
            btn.classList.add('active'); // Highlight active category
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             await navigateToFilter({
                 category: cat.id,
                 subcategory: 'all', // Reset subcategory when changing main category
                 subSubcategory: 'all', // Reset sub-subcategory
                 search: '' // Clear search
             });
             closeCurrentPopup(); // Close the sheet
             showPage('mainPage'); // Ensure main page is active
         };

        sheetCategoriesContainer.appendChild(btn);
    });
}

// Function to render subcategories bar (used on main page)
export async function renderSubcategories(categoryId) {
     const subcategoriesContainer = document.getElementById('subcategoriesContainer');
     if (!subcategoriesContainer) return;
     subcategoriesContainer.innerHTML = ''; // Clear previous

     if (categoryId === 'all') {
         subcategoriesContainer.style.display = 'none'; // Hide if 'all' categories selected
         return;
     }

     const subcategories = await fetchSubcategories(categoryId); // Fetch from data-logic

     if (subcategories.length === 0) {
         subcategoriesContainer.style.display = 'none'; // Hide if no subcategories
         return;
     }

     subcategoriesContainer.style.display = 'flex'; // Show the container

     // Add "All" button for the subcategory level
     const allBtn = document.createElement('button');
     allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
     // Re-using the SVG icon for 'All'
     const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
     allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
     allBtn.onclick = async () => {
         await navigateToFilter({
             subcategory: 'all', // Set subcategory to 'all'
             subSubcategory: 'all' // Reset sub-subcategory
         });
     };
     subcategoriesContainer.appendChild(allBtn);

     // Add buttons for each actual subcategory
     subcategories.forEach(subcat => {
         const subcatBtn = document.createElement('button');
         subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
         const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
         const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
         const imageUrl = subcat.imageUrl || placeholderImg;

         subcatBtn.innerHTML = `<img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subcatName}</span>`;

         subcatBtn.onclick = () => {
             // Navigate to the dedicated subcategory detail page
             showSubcategoryDetailPage(categoryId, subcat.id);
         };
         subcategoriesContainer.appendChild(subcatBtn);
     });
}


export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active'); // Highlight active category
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
             await navigateToFilter({
                 category: cat.id,
                 subcategory: 'all', // Reset subcategory
                 subSubcategory: 'all', // Reset sub-subcategory
                 search: '' // Clear search
             });
         };

        container.appendChild(btn);
    });
}

// Shows product details - fetches data using data-logic function
export async function showProductDetails(productId) {
     const product = await fetchProductDetails(productId); // Fetch from data-logic
     if (product) {
         showProductDetailsWithData(product); // Render UI using the fetched data
     } else {
         showNotification(t('product_not_found_error'), 'error');
     }
}

// Renders the product detail sheet UI with the provided product data
export function showProductDetailsWithData(product) {
     const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
     if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

     const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
     const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
     const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

     // --- Image Slider Setup ---
     const imageContainer = document.getElementById('sheetImageContainer');
     const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
     imageContainer.innerHTML = '';
     thumbnailContainer.innerHTML = '';
     // (Rest of the image slider logic remains the same as before)
     if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
             const img = document.createElement('img');
             img.src = url;
             img.alt = nameInCurrentLang;
             if (index === 0) img.classList.add('active');
             imageContainer.appendChild(img);

             const thumb = document.createElement('img');
             thumb.src = url;
             thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
             thumb.className = 'thumbnail';
             if (index === 0) thumb.classList.add('active');
             thumb.dataset.index = index;
             thumbnailContainer.appendChild(thumb);
         });
     }
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

     function updateSlider(index) {
         if (!images[index] || !thumbnails[index]) return;
         images.forEach(img => img.classList.remove('active'));
         thumbnails.forEach(thumb => thumb.classList.remove('active'));
         images[index].classList.add('active');
         thumbnails[index].classList.add('active');
         currentIndex = index;
     }

    if (imageUrls.length > 1) {
         prevBtn.style.display = 'flex';
         nextBtn.style.display = 'flex';
     } else {
         prevBtn.style.display = 'none';
         nextBtn.style.display = 'none';
     }

     prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
     nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
     thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

     // --- /Image Slider Setup ---

     document.getElementById('sheetProductName').textContent = nameInCurrentLang;
     document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

     // Price display
     const priceContainer = document.getElementById('sheetProductPrice');
     if (product.originalPrice && product.originalPrice > product.price) {
         priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
     } else {
         priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
     }

     // Add to Cart Button
     const addToCartButton = document.getElementById('sheetAddToCartBtn');
     addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
     addToCartButton.onclick = () => {
         addToCart(product.id); // Call data-logic function
         closeCurrentPopup(); // Close the sheet
     };

     renderRelatedProducts(product); // Render related products section

     openPopup('productDetailSheet'); // Open the sheet UI
     // Update URL for shareability, but don't add to navigation history stack
     const productUrl = `${window.location.pathname}?product=${product.id}${window.location.hash}`;
     history.replaceState(history.state, '', productUrl); // Use replaceState
}


export function createPromoCardElement(card) {
     const cardElement = document.createElement('div');
     cardElement.className = 'product-card promo-card-grid-item';

     const imageUrl = card.imageUrls[state.currentLanguage] || card.imageUrls.ku_sorani;

     cardElement.innerHTML = `
         <div class="product-image-container">
             <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
         </div>
         <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
         <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
     `;

     // Click on card (not buttons) navigates to category
     cardElement.addEventListener('click', async (e) => {
         if (!e.target.closest('button')) { // Ignore clicks on buttons
             const targetCategoryId = card.categoryId;
             // Check if category exists in the loaded state.categories
             const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
             if (categoryExists) {
                 await navigateToFilter({
                     category: targetCategoryId,
                     subcategory: 'all',
                     subSubcategory: 'all',
                     search: ''
                 });
                 // Optionally scroll to the category section
                 document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
             } else {
                 console.warn(`Promo card target category ${targetCategoryId} not found.`);
             }
         }
     });

     // Button click handlers
     cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
         e.stopPropagation(); // Prevent card click
         changePromoCard(-1); // Function to handle slider change
     });

     cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
         e.stopPropagation(); // Prevent card click
         changePromoCard(1); // Function to handle slider change
     });

     return cardElement;
}


// Creates a product card HTML element
export function createProductCardElement(product) {
     const productCard = document.createElement('div');
     productCard.className = 'product-card';
     productCard.dataset.productId = product.id; // Important for targeting updates
     const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

     const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
     const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

     // Price and Discount Badge HTML
     let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
     let discountBadgeHTML = '';
     const hasDiscount = product.originalPrice && product.originalPrice > product.price;
     if (hasDiscount) {
         priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
         const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
         discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
     }

     // Shipping Info Badge HTML
     let extraInfoHTML = '';
     const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
     if (shippingText) {
         extraInfoHTML = `<div class="product-extra-info"><div class="info-badge shipping-badge"><i class="fas fa-truck"></i>${shippingText}</div></div>`;
     }

     // Favorite Button HTML
     const isProdFavorite = isFavorite(product.id); // Check favorite status
     const heartIconClass = isProdFavorite ? 'fas' : 'far';
     const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

     // Assemble Card HTML
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

     // --- Event Listeners for Card Actions ---

     // Share Button
     productCard.querySelector('.share-btn-card')?.addEventListener('click', async (event) => {
         event.stopPropagation(); // Prevent opening product details
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
                 navigator.clipboard.writeText(productUrl); // Fallback to copy link
                 showNotification('لينكى کاڵا کۆپى کرا!', 'success');
             }
         } catch (err) {
             console.error('Share error:', err);
             if (err.name !== 'AbortError') { // Ignore if user cancels share dialog
                 showNotification(t('share_error'), 'error');
             }
         }
     });

    // Favorite Button
    const favButton = productCard.querySelector('.favorite-btn');
    if (favButton) {
        favButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent opening product details
            toggleFavorite(product.id); // Call data-logic function
            // Update button UI immediately (optimistic update)
             const heartIcon = favButton.querySelector('.fa-heart');
             const isNowFavorite = !favButton.classList.contains('favorited');
             favButton.classList.toggle('favorited', isNowFavorite);
             heartIcon?.classList.toggle('fas', isNowFavorite);
             heartIcon?.classList.toggle('far', !isNowFavorite);
        });
    }

    // Add to Cart Button
    const cartButton = productCard.querySelector('.add-to-cart-btn-card');
    if (cartButton) {
        cartButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent opening product details
            addToCart(product.id); // Call data-logic function

            // Simple visual feedback on the button
            if (!cartButton.disabled) {
                const originalContent = cartButton.innerHTML;
                cartButton.disabled = true;
                cartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                setTimeout(() => {
                    cartButton.innerHTML = `<i class="fas fa-check"></i>`; // Change to checkmark
                    setTimeout(() => {
                        cartButton.innerHTML = originalContent; // Revert back
                        cartButton.disabled = false;
                    }, 1000); // Show checkmark for 1 second
                }, 300); // Show spinner briefly
            }
        });
    }

     // Admin Edit Button
     const editButton = productCard.querySelector('.edit-btn');
     if (editButton) {
         editButton.addEventListener('click', (event) => {
             event.stopPropagation();
             // Assuming AdminLogic is globally available or imported
             if (window.AdminLogic?.editProduct) {
                 window.AdminLogic.editProduct(product.id);
             }
         });
     }

     // Admin Delete Button
     const deleteButton = productCard.querySelector('.delete-btn');
     if (deleteButton) {
         deleteButton.addEventListener('click', (event) => {
             event.stopPropagation();
             if (window.AdminLogic?.deleteProduct) {
                 window.AdminLogic.deleteProduct(product.id);
             }
         });
     }


     // Click on the card itself (not buttons) to show details
     productCard.addEventListener('click', (event) => {
         // Check if the click was on the card itself or its non-interactive children,
         // and not on any button or link inside it.
         if (!event.target.closest('button, a')) {
             showProductDetailsWithData(product);
         }
     });


     return productCard;
}

// Sets up Intersection Observer for fade-in animations
export function setupScrollAnimations() {
     // Check if IntersectionObserver is supported
     if (!('IntersectionObserver' in window)) {
         console.warn("IntersectionObserver not supported, animations disabled.");
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
         threshold: 0.1 // Trigger when 10% of the element is visible
     });

     // Observe all elements with the reveal class
     document.querySelectorAll('.product-card-reveal').forEach(card => {
         observer.observe(card);
     });
}


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
    container.style.display = 'grid'; // Ensure it's visible

    // Hide actual products and loader when showing skeleton
     if (container === skeletonLoader) { // Only do this if rendering the main skeleton loader
         if(productsContainer) productsContainer.style.display = 'none';
         if(loader) loader.style.display = 'none';
         document.getElementById('homePageSectionsContainer').style.display = 'none'; // Hide home sections too
     }
}

// Renders the list of product cards from state.products
export function renderProducts(isNewSearch = false) {
     if (!productsContainer) return;

     if (isNewSearch) {
         productsContainer.innerHTML = ''; // Clear container for new search results
     }

     // Determine which products to render (only new ones if not a new search)
     const startIndex = isNewSearch ? 0 : productsContainer.children.length;
     const productsToRender = state.products.slice(startIndex);

     if (productsToRender.length === 0 && isNewSearch && state.products.length === 0) {
         // Handle empty state for a new search explicitly if needed elsewhere
         // This function just renders what's in state.products
         return;
     }

     productsToRender.forEach(item => {
         let element;
         // Check if item represents a promo card (you might need a flag like item.isPromoCard)
         if (item.isPromoCard) {
            // element = createPromoCardElement(item); // Promo card rendering might be separate
         } else {
             element = createProductCardElement(item);
         }
         if (element) {
             element.classList.add('product-card-reveal'); // Add class for animation
             productsContainer.appendChild(element);
         }
     });

     // Apply scroll animations to newly added cards
     setupScrollAnimations();
 }

// Renders the cart UI
export function renderCart() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (state.cart.length === 0) {
        if(emptyCartMessage) emptyCartMessage.style.display = 'block';
        if(cartTotal) cartTotal.style.display = 'none';
        if(cartActions) cartActions.style.display = 'none';
        updateCartCount(); // Ensure count badge is 0
        return;
    }

    if(emptyCartMessage) emptyCartMessage.style.display = 'none';
    if(cartTotal) cartTotal.style.display = 'block';
    if(cartActions) cartActions.style.display = 'block';
    renderCartActionButtons(); // Render Send buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemImage = item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'; // Fallback image

        cartItem.innerHTML = `
            <img src="${itemImage}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('total_price')}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    if(totalAmount) totalAmount.textContent = total.toLocaleString();

    // Add event listeners for quantity buttons and remove button
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));

    updateCartCount(); // Update badge count
}

// Renders the Send action buttons in the cart based on Firestore settings
export async function renderCartActionButtons() {
     const container = document.getElementById('cartActions');
     if (!container) return;
     container.innerHTML = ''; // Clear previous buttons

     try {
         const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
         const q = query(methodsCollection, orderBy("createdAt")); // Assuming createdAt exists for ordering
         const snapshot = await getDocs(q);

         if (snapshot.empty) {
             container.innerHTML = '<p style="text-align: center; color: var(--dark-gray);">هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
             return;
         }

         snapshot.forEach(doc => {
             const method = { id: doc.id, ...doc.data() };
             const btn = document.createElement('button');
             // Use a consistent class, customize appearance with style attribute
             btn.className = 'whatsapp-btn'; // Re-use class for basic styling, override color
             btn.style.backgroundColor = method.color; // Apply specific color

             const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
             const iconClass = method.icon || 'fas fa-paper-plane'; // Default icon

             btn.innerHTML = `<i class="${iconClass}"></i> <span>${name}</span>`;

             btn.onclick = () => {
                 const message = generateOrderMessage(); // Get message from data-logic
                 if (!message) return;

                 let link = '';
                 const encodedMessage = encodeURIComponent(message);
                 const value = method.value; // Phone number, username, or URL

                 // Generate the correct link based on the method type
                 switch (method.type) {
                     case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                     case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; // Ensure '+' is encoded for Viber
                     case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                     case 'phone': link = `tel:${value}`; break; // No message for phone call
                     case 'url': link = value; break; // Direct URL, message might not apply
                     default: console.warn("Unknown contact method type:", method.type);
                 }

                 if (link) {
                     // For phone, just open link. For others, try opening in new tab.
                     if (method.type === 'phone' || method.type === 'viber') {
                         window.location.href = link;
                     } else {
                         window.open(link, '_blank');
                     }
                 }
             };

             container.appendChild(btn);
         });
     } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = '<p style="text-align: center; color: var(--danger-color);">هەڵەیەک ڕوویدا لە هێنانی ڕێگاکانی ناردن.</p>';
     }
 }


// Renders Policies in the terms sheet
export async function renderPolicies() {
    if (!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Render content, replacing newlines with <br> for HTML display
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p style="text-align: center; padding: 20px;">${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--danger-color);">${t('error_generic')}</p>`;
    }
}

// Renders user notifications in the notification sheet
export async function renderUserNotifications() {
     if (!notificationsListContainer) return;
     notificationsListContainer.innerHTML = ''; // Clear previous

     try {
         const q = query(announcementsCollection, orderBy("createdAt", "desc"));
         const snapshot = await getDocs(q);

         if (snapshot.empty) {
             notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
             return;
         }

         let latestTimestamp = 0;
         snapshot.forEach(doc => {
             const announcement = doc.data();
             if (announcement.createdAt > latestTimestamp) {
                 latestTimestamp = announcement.createdAt; // Track the newest announcement timestamp
             }

             const date = new Date(announcement.createdAt);
             // Simple date format YYYY/MM/DD
             const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

             const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
             const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

             const item = document.createElement('div');
             item.className = 'notification-item';
             item.innerHTML = `
                 <div class="notification-header">
                     <span class="notification-title">${title}</span>
                     <span class="notification-date">${formattedDate}</span>
                 </div>
                 <p class="notification-content">${content.replace(/\n/g, '<br>')}</p> {# Render newlines #}
             `;
             notificationsListContainer.appendChild(item);
         });

         // Update the last seen timestamp and hide the badge
         localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
         if (notificationBadge) notificationBadge.style.display = 'none';

     } catch (error) {
         console.error("Error fetching user notifications:", error);
         notificationsListContainer.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--danger-color);">${t('error_generic')}</p>`;
     }
}


// --- UI Component Setup & Event Listeners ---

export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

export function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL

    // Update all elements with data-translate-key
     document.querySelectorAll('[data-translate-key]').forEach(element => {
         const key = element.dataset.translateKey;
         const translation = t(key); // Get translation using t()

         // Handle different element types
         if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
             if (element.placeholder) {
                 element.placeholder = translation;
             }
         } else if (element.tagName === 'BUTTON' && element.querySelector('span')) {
            // Special case for bottom nav buttons or similar with spans
             element.querySelector('span').textContent = translation;
         }
         else {
             element.textContent = translation;
         }
     });

    // Update active language button style
     document.querySelectorAll('.lang-btn').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.lang === lang);
     });

    // Re-render language-dependent UI parts
     const homeContainer = document.getElementById('homePageSectionsContainer');
     if (homeContainer) {
        // Decide whether to re-render home or products based on current view
         const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
         if (isHomeView) {
             homeContainer.innerHTML = ''; // Clear home content to force re-render
             renderHomePageContent(); // Re-render home sections
         } else {
             renderProducts(true); // Re-render product list from scratch
         }
     } else {
        renderProducts(true); // Default to re-rendering product list if home container doesn't exist
     }

     renderMainCategories(); // Re-render main category bar
     renderCategoriesSheet(); // Re-render category sheet content
     renderContactLinks(); // Re-render contact links in settings

     // Re-render open popups if their content is language-dependent
     if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart();
     if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage();
     if (document.getElementById('termsSheet')?.classList.contains('show')) renderPolicies();
     if (document.getElementById('notificationsSheet')?.classList.contains('show')) renderUserNotifications();

    // Re-render subcategories if a main category is selected
     if(state.currentCategory !== 'all') {
         renderSubcategories(state.currentCategory);
     }
}


// Setup main UI event listeners
export function setupUIEventListeners() {

    // --- Bottom Navigation ---
     homeBtn?.addEventListener('click', async () => {
         if (!mainPage?.classList.contains('page-active')) {
            // Navigate to main page state in history
             history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
             showPage('mainPage');
         }
         // Reset filters via navigateToFilter
         await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
     });

     settingsBtn?.addEventListener('click', () => {
         // Navigate to settings page state in history
         history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
         showPage('settingsPage', t('settings_title'));
     });

     profileBtn?.addEventListener('click', () => {
         openPopup('profileSheet');
         updateActiveNav('profileBtn'); // Keep profile active while sheet is open
     });

     cartBtn?.addEventListener('click', () => {
         openPopup('cartSheet');
         updateActiveNav('cartBtn'); // Keep cart active while sheet is open
     });

     categoriesBtn?.addEventListener('click', () => {
         openPopup('categoriesSheet');
         updateActiveNav('categoriesBtn'); // Keep categories active while sheet is open
     });

    // --- Header Back Button ---
     document.getElementById('headerBackBtn')?.addEventListener('click', () => {
         history.back(); // Use browser history back for navigation
     });

    // --- Settings Page Links ---
     settingsFavoritesBtn?.addEventListener('click', () => openPopup('favoritesSheet'));
     settingsAdminLoginBtn?.addEventListener('click', () => openPopup('loginModal', 'modal'));
     termsAndPoliciesBtn?.addEventListener('click', () => openPopup('termsSheet'));
     document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
     document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate); // Assuming forceUpdate is defined

     // Contact Links Toggle in Settings
     contactToggle?.addEventListener('click', () => {
         const container = document.getElementById('dynamicContactLinksContainer');
         const chevron = contactToggle.querySelector('.contact-chevron');
         container?.classList.toggle('open');
         chevron?.classList.toggle('open');
     });

    // --- Popups Closing ---
     sheetOverlay?.addEventListener('click', closeCurrentPopup);
     document.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', closeCurrentPopup));
     window.addEventListener('click', (e) => {
         // Close modal if background is clicked
         if (e.target.classList.contains('modal')) {
             closeCurrentPopup();
         }
     });

    // --- Search ---
     const debouncedSearch = debounce((term) => {
         navigateToFilter({ search: term }); // Use navigateToFilter for search
     }, 500);

     searchInput?.addEventListener('input', () => {
         const searchTerm = searchInput.value;
         if(clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
         debouncedSearch(searchTerm);
     });

     clearSearchBtn?.addEventListener('click', () => {
         searchInput.value = '';
         clearSearchBtn.style.display = 'none';
         navigateToFilter({ search: '' }); // Clear search via navigateToFilter
     });

    // --- Subpage Search ---
     const subpageSearchInput = document.getElementById('subpageSearchInput');
     const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
     const debouncedSubpageSearch = debounce(async (term) => {
         // Find current subcategory page context
         const hash = window.location.hash.substring(1);
         if (hash.startsWith('subcategory_')) {
             const ids = hash.split('_');
             const subCatId = ids[2];
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
             // Re-render products on the detail page with the search term
             await renderProductsOnDetailPage(subCatId, subSubCatId, term);
         }
     }, 500);

     subpageSearchInput?.addEventListener('input', () => {
         const searchTerm = subpageSearchInput.value;
         if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
         debouncedSubpageSearch(searchTerm);
     });

     subpageClearSearchBtn?.addEventListener('click', () => {
         subpageSearchInput.value = '';
         subpageClearSearchBtn.style.display = 'none';
         debouncedSubpageSearch('');
     });

    // --- Forms ---
     loginForm?.addEventListener('submit', async (e) => {
         e.preventDefault();
         const email = document.getElementById('email')?.value;
         const password = document.getElementById('password')?.value;
         const success = await handleSignIn(email, password); // Call data-logic function
         if (success) {
            closeCurrentPopup(); // Close login modal on success
         }
     });

     profileForm?.addEventListener('submit', (e) => {
         e.preventDefault();
         // Update state (consider moving this logic to data-logic.js)
         state.userProfile = {
             name: document.getElementById('profileName')?.value || '',
             address: document.getElementById('profileAddress')?.value || '',
             phone: document.getElementById('profilePhone')?.value || '',
         };
         localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
         showNotification(t('profile_saved'), 'success');
         closeCurrentPopup(); // Close profile sheet
     });

    // --- Language Buttons ---
     document.querySelectorAll('.lang-btn').forEach(btn => {
         btn.addEventListener('click', () => {
             setLanguage(btn.dataset.lang); // Call UI function to set language
         });
     });

    // --- PWA Install Button ---
     const installBtn = document.getElementById('installAppBtn');
     window.addEventListener('beforeinstallprompt', (e) => {
         e.preventDefault();
         state.deferredPrompt = e; // Store the prompt event in state (app-setup.js)
         if (installBtn) installBtn.style.display = 'flex'; // Show the button
     });
     installBtn?.addEventListener('click', async () => {
         if (state.deferredPrompt) {
             installBtn.style.display = 'none'; // Hide button after click
             state.deferredPrompt.prompt(); // Show install prompt
             const { outcome } = await state.deferredPrompt.userChoice;
             console.log(`User response to the install prompt: ${outcome}`);
             state.deferredPrompt = null; // Clear the stored prompt event
         }
     });

     // --- Notification Button ---
      notificationBtn?.addEventListener('click', () => openPopup('notificationsSheet'));

     // --- Admin Logout ---
     settingsLogoutBtn?.addEventListener('click', handleSignOut); // Call data-logic signout

     // --- Product Form Category/Subcategory Chaining ---
     productCategorySelect?.addEventListener('change', async (e) => {
         const mainCatId = e.target.value;
         await populateSubcategoriesDropdown(mainCatId); // Update subcat dropdown
         await populateSubSubcategoriesDropdown(null, null); // Clear sub-subcat dropdown
     });
     productSubcategorySelect?.addEventListener('change', async (e) => {
        const mainCatId = productCategorySelect.value;
        const subCatId = e.target.value;
         await populateSubSubcategoriesDropdown(mainCatId, subCatId); // Update sub-subcat dropdown
     });

    // --- Service Worker Update Notification ---
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');
     if (updateNowBtn && 'serviceWorker' in navigator) {
         navigator.serviceWorker.getRegistration().then(registration => {
             if (registration && registration.waiting) {
                 updateNowBtn.onclick = () => {
                     registration.waiting.postMessage({ action: 'skipWaiting' });
                     updateNotification.classList.remove('show'); // Hide notification
                 };
             }
         });
     }
}

// Function to handle showing skeleton or hiding it
export function showSkeleton(show = true) {
     if (skeletonLoader) skeletonLoader.style.display = show ? 'grid' : 'none';
     if (productsContainer) productsContainer.style.display = show ? 'none' : 'grid';
     if (loader) loader.style.display = 'none'; // Ensure main loader is hidden when skeleton shows/hides
     if(document.getElementById('homePageSectionsContainer')) document.getElementById('homePageSectionsContainer').style.display = 'none'; // Hide home sections when skeleton shows
 }

 // Function to show/hide the load more indicator
 export function showLoadMoreIndicator(show = true) {
     if (loader) loader.style.display = show ? 'block' : 'none';
     // Optionally hide scroll trigger when loader shows, show when hidden
     const scrollTrigger = document.getElementById('scroll-loader-trigger');
     if (scrollTrigger) scrollTrigger.style.display = show ? 'none' : (state.allProductsLoaded ? 'none' : 'block');
 }

 // Call this after fetching products in data-logic.js
 export function renderProductListAndUpdateUI(isNewSearch) {
     renderProducts(isNewSearch); // Render the products (new or appended)
     showSkeleton(false); // Hide skeleton loader
     showLoadMoreIndicator(false); // Hide load more indicator

     // Show "no products" message if applicable
     if (isNewSearch && state.products.length === 0 && productsContainer) {
         productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
     }
 }

 // Call this if fetching products fails
 export function showProductFetchError() {
     if(productsContainer) productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1; color: var(--danger-color);">هەڵەیەک ڕوویدا.</p>';
     showSkeleton(false);
     showLoadMoreIndicator(false);
 }

// Call this from data-logic.js when needed
export function updateAdminStatusUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
     if (addProductBtn) addProductBtn.style.display = isAdmin ? 'flex' : 'none';
     if (settingsLogoutBtn) settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
     if (settingsAdminLoginBtn) settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
    // Hide/show other admin sections in settings...
}

// Populates subcategory dropdown in the product form
async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
     const subcatSelect = productSubcategorySelect;
     const subcatContainer = subcategorySelectContainer;
     const subSubContainer = subSubcategorySelectContainer;

     if (!subcatSelect || !subcatContainer || !subSubContainer) return;

     if (!categoryId) {
         subcatContainer.style.display = 'none';
         subSubContainer.style.display = 'none';
         subcatSelect.innerHTML = '';
         return;
     }

     subcatContainer.style.display = 'block';
     subcatSelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
     subcatSelect.disabled = true;

     const subcategories = await fetchSubcategories(categoryId); // Fetch from data-logic

     subcatSelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
     if (subcategories.length === 0) {
         subcatSelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
         subSubContainer.style.display = 'none'; // Hide sub-sub if no sub
     } else {
        subcategories.forEach(subcat => {
            const option = document.createElement('option');
             option.value = subcat.id;
             option.textContent = subcat.name_ku_sorani || subcat.id; // Use Sorani name or ID
             if (subcat.id === selectedSubcategoryId) {
                 option.selected = true; // Pre-select if editing
             }
             subcatSelect.appendChild(option);
         });
     }
     subcatSelect.disabled = false;
 }

 // Populates sub-subcategory dropdown in the product form
 async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
     const subSubSelect = productSubSubcategorySelect;
     const subSubContainer = subSubcategorySelectContainer;

     if (!subSubSelect || !subSubContainer) return;

     if (!mainCategoryId || !subcategoryId) {
         subSubContainer.style.display = 'none';
         subSubSelect.innerHTML = '';
         return;
     }

     subSubContainer.style.display = 'block';
     subSubSelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
     subSubSelect.disabled = true;

     const subSubcategories = await fetchSubSubcategories(mainCategoryId, subcategoryId); // Fetch from data-logic

     subSubSelect.innerHTML = '<option value="">-- هیچ --</option>'; // Add a "None" option
     if (subSubcategories.length > 0) {
         subSubcategories.forEach(subSubcat => {
             const option = document.createElement('option');
             option.value = subSubCat.id;
             option.textContent = subSubCat.name_ku_sorani; // Use Sorani name
             if (subSubCat.id === selectedSubSubcategoryId) {
                 option.selected = true; // Pre-select if editing
             }
             subSubSelect.appendChild(option);
         });
     }
     subSubSelect.disabled = false;
 }

 // Handles showing home sections or product grid
 export function handleHomeVsProductView(showHome) {
     const homeContainer = document.getElementById('homePageSectionsContainer');
     const productsGrid = productsContainer; // Direct reference
     const skeleton = skeletonLoader; // Direct reference
     const scrollTrigger = document.getElementById('scroll-loader-trigger');

     if (showHome) {
         if (productsGrid) productsGrid.style.display = 'none';
         if (skeleton) skeleton.style.display = 'none';
         if (scrollTrigger) scrollTrigger.style.display = 'none';
         if (homeContainer) {
             homeContainer.style.display = 'block';
             // If home container is empty, trigger render
             if (homeContainer.innerHTML.trim() === '') {
                 renderHomePageContent();
             } else {
                 startPromoRotation(); // Restart promo rotation if content exists
             }
         }
     } else {
         if (homeContainer) homeContainer.style.display = 'none';
         if (scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; // Show trigger if needed
         // Don't change productsGrid/skeleton display here, searchProductsInFirestore handles it
         stopPromoRotation(); // Stop promo rotation when leaving home view
     }
 }


 // --- Initialization called from data-logic.js ---
 // export function initializeUI() {
 //     setupUIEventListeners();
 //     setupScrollObserver();
 //     updateCategoryDependentUI();
 //     renderContactLinks();
 //     checkNewAnnouncements(); // Defined in data-logic? Needs clarification
 //     handleInitialPageLoad();
 //     showWelcomeMessage();
 //     setupGpsButton();
 //     setLanguage(state.currentLanguage);
 // }

// Expose functions needed globally or by data-logic.js
// Or better, let data-logic.js import them explicitly.
Object.assign(window.globalAdminTools, {
     // UI/Util functions needed by admin.js
     showNotification,
     t,
     openPopup,
     closeCurrentPopup,
 });

 // Note: The actual initialization call (initializeAppLogic -> loadInitialData -> setupAuthListener -> UI setup)
 // is managed within data-logic.js after persistence setup.