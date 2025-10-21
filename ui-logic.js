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
    termsAndPoliciesBtn, termsSheet, termsContentContainer, // Note: subSubcategoriesContainer removed as it's not used directly here
    db, promoCardsCollection, brandsCollection, shortcutRowsCollection // Need db and collections for rendering home page sections directly for now
} from './app-setup.js';

// Import data/logic functions needed by UI
import {
    saveCart, saveFavorites, isFavorite, toggleFavorite, addToCart, updateQuantity, removeFromCart, generateOrderMessage,
    handleSignIn, handleSignOut, requestNotificationPermission, searchProductsInFirestore,
    fetchSubcategories, fetchSubSubcategories, fetchProductDetails, loadInitialData, // Added loadInitialData if needed, init renamed if necessary
    checkNewAnnouncements as dataCheckNewAnnouncements // Renamed to avoid conflict
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
        setTimeout(() => {
             // Ensure element still exists before removing
             if (notification.parentNode === document.body) {
                 document.body.removeChild(notification);
             }
         }, 300);
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

    document.body.classList.add('overlay-active'); // Prevent body scroll
    // Only push state if it's not already the current hash
    if (`#${id}` !== window.location.hash) {
        history.pushState({ type: type, id: id }, '', `#${id}`); // Add history entry
    }
}


export function closeCurrentPopup() {
    // Check if the current history state is a popup state matching the hash
    const currentHash = window.location.hash.substring(1);
     if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal') && history.state.id === currentHash) {
         history.back(); // Use browser back to close and remove history entry
     } else {
         closeAllPopupsUI(); // Fallback if history state is not correct or hash doesn't match
         // Also clear the hash in the URL without adding a history entry
         history.replaceState(history.state, '', window.location.pathname + window.location.search);
     }
}


// Apply filter state to UI elements
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input
     if(searchInput) searchInput.value = state.currentSearch;
     if(clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';


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
     // Use current state from history if available, otherwise use default
     const currentState = history.state || { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: window.scrollY };
     history.replaceState({
         ...currentState,
         scroll: window.scrollY // Update only scroll position of current state
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

// Function called on popstate event (browser back/forward)
export async function handlePopState(event) {
    closeAllPopupsUI(); // Close any open popups when navigating history
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title || '';
            // If it's a subcategory detail page and title is missing, try to fetch it
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                try {
                    const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    const subCatSnap = await getDoc(subCatRef);
                    if (subCatSnap.exists()) {
                        const subCat = subCatSnap.data();
                        pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                    }
                } catch (e) { console.error("Could not refetch title on popstate", e); }
            }
            showPage(popState.id, pageTitle);
            // If navigating back to subcategory page, re-render its content
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPage(popState.mainCatId, popState.subCatId, true); // Pass true for fromHistory
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             // Re-open the popup based on the history state (handled by openPopup adding state)
             // Need to ensure openPopup doesn't push state again in this case, or just call the UI part
             const element = document.getElementById(popState.id);
             if (element) {
                 if (popState.type === 'sheet') {
                     sheetOverlay?.classList.add('show');
                     element.classList.add('show');
                 } else {
                     element.style.display = 'block';
                 }
                 document.body.classList.add('overlay-active');
                 // Potentially re-render popup content if needed
                 if (popState.id === 'cartSheet') renderCart();
                 // etc. for other popups
             }
         } else { // Filter state on main page
            showPage('mainPage'); // Ensure main page is visible
            applyFilterState(popState, true); // Apply filters and scroll
        }
    } else { // No state, likely initial load or navigation outside app's control
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
}


export async function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const isSubcategoryPage = hash.startsWith('subcategory_');
    const isSettingsPage = hash === 'settingsPage';
    const isProductDetail = params.get('product');
    const isPopup = hash && (document.getElementById(hash)?.classList.contains('bottom-sheet') || document.getElementById(hash)?.classList.contains('modal'));

    // 1. Product Detail takes precedence
    if (isProductDetail) {
         showPage('mainPage'); // Show main page in background
        const initialState = { /* ... filters from params ... */ scroll: 0 };
        history.replaceState(initialState, ''); // Set base state for main page
        applyFilterState(initialState); // Apply filters for background content
         // Fetch and show product details after a short delay
         setTimeout(() => showProductDetails(params.get('product')), 300);
    }
    // 2. Subcategory Page
    else if (isSubcategoryPage) {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // Don't render content yet, wait for categories to load in initializeAppLogic
        // Just set the initial state and show the page structure
         history.replaceState({ type: 'page', id: 'subcategoryDetailPage', mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
         showPage('subcategoryDetailPage', 'Loading...'); // Show page with temp title
    }
    // 3. Settings Page
    else if (isSettingsPage) {
         history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
         showPage('settingsPage', t('settings_title'));
    }
    // 4. Popup on Main Page
    else if (isPopup) {
         showPage('mainPage'); // Show main page
        const initialState = { /* ... filters from params ... */ scroll: 0 };
        history.replaceState(initialState, ''); // Set base state for main page
        applyFilterState(initialState); // Apply filters
        const elementType = document.getElementById(hash)?.classList.contains('bottom-sheet') ? 'sheet' : 'modal';
         // Open popup, which will add its own history state
         // Use setTimeout to ensure main page rendering starts first
         setTimeout(() => openPopup(hash, elementType), 50);
    }
    // 5. Default to Main Page (with filters)
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
         applyFilterState(initialState); // Apply filters
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

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Added default icon

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
    if (!container || !state.categories) return; // Added check for state.categories
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

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Added default icon

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

    if (imageUrls.length > 1 && prevBtn && nextBtn) { // Added null checks
         prevBtn.style.display = 'flex';
         nextBtn.style.display = 'flex';
         prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
         nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
         thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));
     } else if (prevBtn && nextBtn) {
         prevBtn.style.display = 'none';
         nextBtn.style.display = 'none';
     }


     // --- /Image Slider Setup ---

    const productNameEl = document.getElementById('sheetProductName');
    const productDescEl = document.getElementById('sheetProductDescription');
    const priceContainer = document.getElementById('sheetProductPrice');
    const addToCartButton = document.getElementById('sheetAddToCartBtn');


     if(productNameEl) productNameEl.textContent = nameInCurrentLang;
     if(productDescEl) productDescEl.innerHTML = formatDescription(descriptionText); // Use helper

     // Price display
     if (priceContainer) {
         if (product.originalPrice && product.originalPrice > product.price) {
             priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
         } else {
             priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
         }
     }

     // Add to Cart Button
     if(addToCartButton) {
         addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
         addToCartButton.onclick = () => {
             addToCart(product.id); // Call data-logic function
             closeCurrentPopup(); // Close the sheet
         };
     }

     renderRelatedProducts(product); // Render related products section

     openPopup('productDetailSheet'); // Open the sheet UI
     // Update URL for shareability, but don't add to navigation history stack
     // Only update if product details are being shown (not during initial load check)
      if (window.location.hash === '#productDetailSheet' || window.location.search.includes(`product=${product.id}`)) {
          const productUrl = `${window.location.pathname}?product=${product.id}${window.location.hash}`;
          history.replaceState(history.state, '', productUrl); // Use replaceState
      }
}

// Helper to format description text (handles links and newlines)
function formatDescription(text) {
     if (!text) return '';
     // 1. Escape HTML characters to prevent XSS
     let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     // 2. Find URLs (http, https, www) and convert them to clickable links
     const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
     let textWithLinks = escapedText.replace(urlRegex, (url) => {
         // Ensure www links get https:// prefix
         const hyperLink = url.startsWith('http') ? url : `https://${url}`;
         // Add target="_blank" to open in new tab and rel="noopener noreferrer" for security
         return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
     });
     // 3. Convert newline characters to <br> tags for HTML display
     return textWithLinks.replace(/\n/g, '<br>');
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
     cardElement.querySelector('.promo-slider-btn.prev')?.addEventListener('click', (e) => { // Added null check
         e.stopPropagation(); // Prevent card click
         changePromoCard(-1); // Function to handle slider change
     });

     cardElement.querySelector('.promo-slider-btn.next')?.addEventListener('click', (e) => { // Added null check
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
            // Update button UI immediately (optimistic update handled in updateFavoriteButtonsUI called by toggleFavorite)
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

// Function to update the visual state of favorite buttons for a specific product
export function updateFavoriteButtonsUI(productId, isFavoriteNow) {
     const allProductCards = document.querySelectorAll(`.product-card[data-product-id="${productId}"]`);
     allProductCards.forEach(card => {
         const favButton = card.querySelector('.favorite-btn');
         const heartIcon = favButton?.querySelector('.fa-heart'); // Use optional chaining
         if (favButton && heartIcon) {
             favButton.classList.toggle('favorited', isFavoriteNow);
             heartIcon.classList.toggle('fas', isFavoriteNow); // Solid heart if favorite
             heartIcon.classList.toggle('far', !isFavoriteNow); // Regular heart if not
         }
     });
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
         const homeContainer = document.getElementById('homePageSectionsContainer');
         if(homeContainer) homeContainer.style.display = 'none'; // Hide home sections too
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
     // Filter out any promo cards that might have gotten into state.products incorrectly
     const productsToRender = state.products.slice(startIndex).filter(item => !item.isPromoCard);

     if (productsToRender.length === 0 && isNewSearch && state.products.filter(item => !item.isPromoCard).length === 0) {
         // Handle empty state for a new search explicitly if needed elsewhere
         return;
     }

     productsToRender.forEach(product => {
         const element = createProductCardElement(product);
         if (element) {
             element.classList.add('product-card-reveal'); // Add class for animation
             productsContainer.appendChild(element);
         }
     });

     // Apply scroll animations to newly added cards
     setupScrollAnimations();
 }

 // Renders cached products (called by data-logic)
 export function renderProductListFromCache() {
     if(skeletonLoader) skeletonLoader.style.display = 'none';
     if(loader) loader.style.display = 'none';
     if(productsContainer) productsContainer.style.display = 'grid';
     renderProducts(true); // Render all products from cache (isNewSearch = true clears container first)
     const scrollTrigger = document.getElementById('scroll-loader-trigger');
     if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
 }

 // Call this after fetching products in data-logic.js
 export function renderProductListAndUpdateUI(isNewSearch) {
     renderProducts(isNewSearch); // Render the products (new or appended)
     if(skeletonLoader) skeletonLoader.style.display = 'none'; // Hide skeleton loader
     if(loader) loader.style.display = 'none'; // Hide load more indicator
     if(productsContainer) productsContainer.style.display = 'grid'; // Ensure product grid is visible

     const scrollTrigger = document.getElementById('scroll-loader-trigger');
     if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; // Update scroll trigger visibility

     // Show "no products" message if applicable
     if (isNewSearch && state.products.filter(p => !p.isPromoCard).length === 0 && productsContainer) {
          // Check if home sections are supposed to be visible (e.g., no filters applied)
          const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
          if (!isHomeView) { // Only show "no products" if not on the main home view
              productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
          }
      }
 }

 // Call this if fetching products fails
 export function showProductFetchError() {
     if(productsContainer) productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1; color: var(--danger-color);">هەڵەیەک ڕوویدا.</p>';
     if(skeletonLoader) skeletonLoader.style.display = 'none';
     if(loader) loader.style.display = 'none';
     if(productsContainer) productsContainer.style.display = 'grid'; // Ensure container is visible to show error
 }

 // Helper to hide loaders
 export function hideLoadIndicators() {
     if(loader) loader.style.display = 'none';
     // Don't hide skeleton here, renderProductListAndUpdateUI handles it
     const scrollTrigger = document.getElementById('scroll-loader-trigger');
     if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
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

// *** چاککراو: Export زیادکرا ***
export async function renderFavoritesPage() {
    if (!favoritesContainer) return;
    favoritesContainer.innerHTML = ''; // Clear previous

    if (state.favorites.length === 0) {
         if(emptyFavoritesMessage) emptyFavoritesMessage.style.display = 'block';
         favoritesContainer.style.display = 'none';
         return;
     }

     if(emptyFavoritesMessage) emptyFavoritesMessage.style.display = 'none';
     favoritesContainer.style.display = 'grid';

     renderSkeletonLoader(favoritesContainer, state.favorites.length > 4 ? 4 : state.favorites.length); // Show skeleton while loading

     try {
         const fetchPromises = state.favorites.map(id => fetchProductDetails(id)); // Use fetchProductDetails from data-logic
         const favoritedProductsData = await Promise.all(fetchPromises);

         favoritesContainer.innerHTML = ''; // Clear skeleton

         const favoritedProducts = favoritedProductsData.filter(product => product !== null); // Filter out nulls if fetch failed

         if (favoritedProducts.length === 0) {
             if(emptyFavoritesMessage) emptyFavoritesMessage.style.display = 'block';
             favoritesContainer.style.display = 'none';
         } else {
             favoritedProducts.forEach(product => {
                 const productCard = createProductCardElement(product); // Create card UI
                 favoritesContainer.appendChild(productCard);
             });
         }
     } catch (error) {
         console.error("Error fetching favorites:", error);
         favoritesContainer.innerHTML = `<p style="text-align:center; grid-column: 1 / -1; color: var(--danger-color);">${t('error_generic')}</p>`;
     }
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
         const q = query(collection(db, "announcements"), orderBy("createdAt", "desc")); // Use collection from Firestore
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
                 <p class="notification-content">${content.replace(/\n/g, '<br>')}</p>
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

// Renders contact links in settings page
export function renderContactLinks() {
     const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
     if (!contactLinksContainer) return;

     const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
     const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

     // Use onSnapshot to listen for real-time updates if desired, or getDocs for one-time fetch
     onSnapshot(q, (snapshot) => {
         contactLinksContainer.innerHTML = ''; // Clear previous links

         if (snapshot.empty) {
             contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
             return;
         }

         snapshot.forEach(doc => {
             const link = doc.data();
             const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;
             const iconClass = link.icon || 'fas fa-link'; // Default icon

             const linkElement = document.createElement('a');
             linkElement.href = link.url;
             linkElement.target = '_blank'; // Open in new tab
             linkElement.rel = 'noopener noreferrer'; // Security measure
             linkElement.className = 'settings-item';

             linkElement.innerHTML = `
                 <div>
                     <i class="${iconClass}" style="margin-left: 10px;"></i>
                     <span>${name}</span>
                 </div>
                 <i class="fas fa-external-link-alt"></i> {# Icon indicating external link #}
             `;

             contactLinksContainer.appendChild(linkElement);
         });
     }, (error) => {
         console.error("Error fetching contact links:", error);
         contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center; color: var(--danger-color);">هەڵە لە هێنانی لینکەکان.</p>';
     });
 }


 // Shows welcome message on first visit
 export function showWelcomeMessage() {
     if (!localStorage.getItem('hasVisited')) {
         openPopup('welcomeModal', 'modal');
         localStorage.setItem('hasVisited', 'true');
     }
 }

 // Sets up the GPS button functionality
 export function setupGpsButton() {
     const getLocationBtn = document.getElementById('getLocationBtn');
     const profileAddressInput = document.getElementById('profileAddress');

     if (!getLocationBtn || !profileAddressInput) return; // Exit if elements not found

     const btnSpan = getLocationBtn.querySelector('span');
     const originalBtnText = btnSpan ? btnSpan.textContent : 'وەرگرتنی ناونیشانم بە GPS'; // Fallback text

     getLocationBtn.addEventListener('click', () => {
         if (!('geolocation' in navigator)) {
             showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
             return;
         }

         if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
         getLocationBtn.disabled = true;

         navigator.geolocation.getCurrentPosition(
             async (position) => { // Success callback
                 const latitude = position.coords.latitude;
                 const longitude = position.coords.longitude;

                 try {
                     // Use Nominatim reverse geocoding
                     const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                     if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                     const data = await response.json();

                     if (data && data.display_name) {
                         profileAddressInput.value = data.display_name;
                         showNotification('ناونیشان وەرگیرا', 'success');
                     } else {
                         profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coordinates
                         showNotification('نەتوانرا ناونیشانی ورد بدۆزرێتەوە', 'error');
                     }
                 } catch (error) {
                     console.error('Reverse Geocoding Error:', error);
                     profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coordinates
                     showNotification('هەڵەیەک لە وەرگرتنی ناونیشانی ورد ڕوویدا', 'error');
                 } finally {
                     if(btnSpan) btnSpan.textContent = originalBtnText;
                     getLocationBtn.disabled = false;
                 }
             },
             (error) => { // Error callback
                 let message = '';
                 switch (error.code) {
                     case error.PERMISSION_DENIED: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                     case error.POSITION_UNAVAILABLE: message = 'زانیاری شوێن بەردەست نییە'; break;
                     case error.TIMEOUT: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                     default: message = 'هەڵەیەکی نادیار ڕوویدا'; break;
                 }
                 showNotification(message, 'error');
                 if(btnSpan) btnSpan.textContent = originalBtnText;
                 getLocationBtn.disabled = false;
             },
             { // Options
                 enableHighAccuracy: true,
                 timeout: 10000, // 10 seconds timeout
                 maximumAge: 0 // Force fresh location
             }
         );
     });
 }


// Sets up the IntersectionObserver for infinite scrolling
export function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger || !('IntersectionObserver' in window)) {
        if (!('IntersectionObserver' in window)) {
            console.warn("IntersectionObserver not supported, infinite scroll disabled.");
        }
        return; // Exit if trigger doesn't exist or Observer not supported
    }

    const observer = new IntersectionObserver(async (entries) => {
         // Check if the trigger element is intersecting (visible)
         if (entries[0].isIntersecting) {
             // Call the data-logic function to fetch more products
             // Pass false for isNewSearch to indicate loading more
             await searchProductsInFirestore(state.currentSearch, false);
         }
     }, {
         root: null, // Use the viewport as the root
         threshold: 0.1 // Trigger when 10% of the trigger is visible
     });

    observer.observe(trigger); // Start observing the trigger element
}


// Updates UI elements that depend on the categories list
export function updateCategoryDependentUI() {
    if (!state.categories || state.categories.length === 0) {
        console.warn("Categories not loaded yet, cannot update dependent UI.");
        return;
    }
    populateCategoryDropdown(); // Populate admin form dropdown
    renderMainCategories(); // Render the main category bar
    renderCategoriesSheet(); // Render the category selection sheet

     // Update admin dropdowns if admin logic is loaded
     if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic?.updateAdminCategoryDropdowns) {
         window.AdminLogic.updateAdminCategoryDropdowns();
     }
}

// Clears the home page container (called from data-logic clearProductCache)
export function clearHomePageContainer() {
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = '';
    }
    stopPromoRotation(); // Stop rotation when home is cleared
}

// Function to check notification status and update badge (called from data-logic)
export function uiCheckNewAnnouncements(hasNew) {
    if (notificationBadge) {
        notificationBadge.style.display = hasNew ? 'block' : 'none';
    }
}


// --- Home Page Rendering --- (Moved here as it's primarily UI)

async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Prevent concurrent rendering
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
        state.isRenderingHomePage = false;
        return; // Exit if container doesn't exist
    }

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton in home section area
        homeSectionsContainer.innerHTML = ''; // Clear skeleton/previous content

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             // Optionally render the 'all_products' section as a fallback
             const fallbackSection = await renderAllProductsSection();
             if (fallbackSection) homeSectionsContainer.appendChild(fallbackSection);
        } else {
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                // Call appropriate rendering function based on section type
                 switch (section.type) {
                     case 'promo_slider': sectionElement = await renderPromoCardsSectionForHome(); break;
                     case 'brands': sectionElement = await renderBrandsSection(); break;
                     case 'newest_products': sectionElement = await renderNewestProductsSection(); break;
                     case 'single_shortcut_row': sectionElement = section.rowId ? await renderSingleShortcutRow(section.rowId, section.name) : null; break;
                     case 'single_category_row': sectionElement = section.categoryId ? await renderSingleCategoryRow(section.categoryId, section.name) : null; break;
                     case 'all_products': sectionElement = await renderAllProductsSection(); break; // Render limited products initially
                     default: console.warn(`Unknown home layout section type: ${section.type}`);
                 }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--danger-color);">هەڵەیەک ڕوویدا.</p>`;
    } finally {
        state.isRenderingHomePage = false;
         // Ensure skeleton loader in the main product area is hidden if home renders
         if(skeletonLoader) skeletonLoader.style.display = 'none';
    }
}

// Renders Promo Cards Slider section for home page
async function renderPromoCardsSectionForHome() {
     // Fetch promo cards if not already fetched
     if (state.allPromoCards.length === 0) {
         try {
             const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
             const promoSnapshot = await getDocs(promoQuery);
             state.allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
         } catch (error) {
             console.error("Error fetching promo cards:", error);
             return null; // Return null if fetching fails
         }
     }

     if (state.allPromoCards.length > 0) {
         // Ensure index is valid
         if (state.currentPromoCardIndex >= state.allPromoCards.length || state.currentPromoCardIndex < 0) {
             state.currentPromoCardIndex = 0;
         }
         // Create the grid container for the promo card
         const promoGrid = document.createElement('div');
         promoGrid.className = 'products-container promo-slider-container'; // Add a specific class
         promoGrid.style.marginBottom = '16px'; // Add some spacing

         // Create and append the current promo card element
         const promoCardElement = createPromoCardElement(state.allPromoCards[state.currentPromoCardIndex]);
         promoGrid.appendChild(promoCardElement);

         startPromoRotation(); // Start auto-rotation
         return promoGrid; // Return the container element
     }
     return null; // Return null if no promo cards exist
}

// --- Promo Slider Logic ---

function displayPromoCard(index) {
     const promoCardSlot = document.querySelector('.promo-slider-container .promo-card-grid-item'); // Target the card within the specific container
     if (!promoCardSlot || !state.allPromoCards[index]) return; // Exit if slot or card data not found

     const cardData = state.allPromoCards[index];
     const newCardElement = createPromoCardElement(cardData);
     newCardElement.classList.add('product-card-reveal'); // Add animation class

     // Fade out old card, replace, fade in new card
     promoCardSlot.style.opacity = 0;
     setTimeout(() => {
         if (promoCardSlot.parentNode) {
             promoCardSlot.parentNode.replaceChild(newCardElement, promoCardSlot);
             // Trigger fade-in animation
             setTimeout(() => {
                 newCardElement.classList.add('visible');
             }, 10); // Small delay to ensure replacement happens first
         }
     }, 300); // Wait for fade-out transition (adjust time if needed)
}


function rotatePromoCard() {
    if (state.allPromoCards.length <= 1) return; // No rotation needed for 0 or 1 card
    state.currentPromoCardIndex = (state.currentPromoCardIndex + 1) % state.allPromoCards.length;
    displayPromoCard(state.currentPromoCardIndex);
}

function changePromoCard(direction) {
    if (state.allPromoCards.length <= 1) return;
    state.currentPromoCardIndex += direction;
    // Wrap around index if it goes out of bounds
    if (state.currentPromoCardIndex >= state.allPromoCards.length) {
        state.currentPromoCardIndex = 0;
    } else if (state.currentPromoCardIndex < 0) {
        state.currentPromoCardIndex = state.allPromoCards.length - 1;
    }
    displayPromoCard(state.currentPromoCardIndex);
    startPromoRotation(); // Reset the timer after manual change
}

function startPromoRotation() {
    stopPromoRotation(); // Clear existing interval first
    if (state.allPromoCards.length > 1) { // Only rotate if more than one card
        state.promoRotationInterval = setInterval(rotatePromoCard, 5000); // Rotate every 5 seconds
    }
}

function stopPromoRotation() {
    if (state.promoRotationInterval) {
        clearInterval(state.promoRotationInterval);
        state.promoRotationInterval = null;
    }
}

// Renders Brands section for home page
async function renderBrandsSection() {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(brandsCollection, orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render if empty

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;
            const imageUrl = brand.imageUrl || 'https://placehold.co/65x65/e2e8f0/718096?text=Brand'; // Fallback

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${imageUrl}" alt="${brandName}" loading="lazy" class="brand-image" onerror="this.src='https://placehold.co/65x65/e2e8f0/718096?text=Err'">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
                await navigateToFilter({ // Use navigate function
                    category: brand.categoryId || 'all',
                    subcategory: brand.subcategoryId || 'all',
                    subSubcategory: 'all', // Reset sub-sub
                    search: '' // Clear search
                });
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands:", error);
        return null; // Return null on error
    }
}

// Renders Newest Products section for home page
async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    container.appendChild(header);

    try {
         // Fetch products created in the last 15 days, limit 10
         const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
         const q = query(
             collection(db, "products"), // Use collection from firestore
             where('createdAt', '>=', fifteenDaysAgo),
             orderBy('createdAt', 'desc'),
             limit(10)
         );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render if empty

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Create card UI
            productsScroller.appendChild(card);
        });
        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

// Renders a single Shortcut Row section for home page
async function renderSingleShortcutRow(rowId, sectionNameObj) {
     const sectionContainer = document.createElement('div');
     sectionContainer.className = 'shortcut-cards-section';

     try {
         const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
         if (!rowDoc.exists()) return null; // Don't render if row doesn't exist

         const rowData = { id: rowDoc.id, ...rowDoc.data() };
         // Use provided section name first, fallback to row title
         const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

         // Add Title
         const titleElement = document.createElement('h3');
         titleElement.className = 'shortcut-row-title';
         titleElement.textContent = rowTitle;
         sectionContainer.appendChild(titleElement);

         // Add Cards Container
         const cardsContainer = document.createElement('div');
         cardsContainer.className = 'shortcut-cards-container';
         sectionContainer.appendChild(cardsContainer);

         // Fetch and render cards within the row
         const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
         const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
         const cardsSnapshot = await getDocs(cardsQuery);

         if (cardsSnapshot.empty) return null; // Don't render empty rows

         cardsSnapshot.forEach(cardDoc => {
             const cardData = cardDoc.data();
             const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
             const imageUrl = cardData.imageUrl || 'https://placehold.co/100x100/e2e8f0/718096?text=N/A'; // Fallback

             const item = document.createElement('div');
             item.className = 'shortcut-card';
             item.innerHTML = `
                 <img src="${imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy" onerror="this.src='https://placehold.co/100x100/e2e8f0/718096?text=Err'">
                 <div class="shortcut-card-name">${cardName}</div>
             `;

             // Set click handler to navigate to the card's target filter
             item.onclick = async () => {
                 await navigateToFilter({ // Use navigate function
                     category: cardData.categoryId || 'all',
                     subcategory: cardData.subcategoryId || 'all',
                     subSubcategory: cardData.subSubcategoryId || 'all',
                     search: '' // Clear search
                 });
             };
             cardsContainer.appendChild(item);
         });

         return sectionContainer; // Return the fully rendered section
     } catch (error) {
         console.error(`Error rendering single shortcut row (ID: ${rowId}):`, error);
         return null; // Return null on error
     }
}

// Renders a single Category Row section for home page
async function renderSingleCategoryRow(categoryId, sectionNameObj) {
     const category = state.categories.find(c => c.id === categoryId);
     if (!category || category.id === 'all') return null; // Don't render 'all' or non-existent

     const container = document.createElement('div');
     container.className = 'dynamic-section';
     const header = document.createElement('div');
     header.className = 'section-title-header';

     // Title with Icon
     const title = document.createElement('h3');
     title.className = 'section-title-main';
     // Use provided section name first, fallback to category name
     const categoryName = (sectionNameObj && sectionNameObj[state.currentLanguage]) || category['name_' + state.currentLanguage] || category.name_ku_sorani;
     title.innerHTML = `<i class="${category.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Added default icon
     header.appendChild(title);

     // "See All" Link
     const seeAllLink = document.createElement('a');
     seeAllLink.className = 'see-all-link';
     seeAllLink.textContent = t('see_all');
     seeAllLink.onclick = async () => {
         await navigateToFilter({ // Use navigate function
             category: category.id,
             subcategory: 'all', // Reset subcategory
             subSubcategory: 'all', // Reset sub-sub
             search: '' // Clear search
         });
     };
     header.appendChild(seeAllLink);
     container.appendChild(header);

     // Horizontal Products Scroller
     const productsScroller = document.createElement('div');
     productsScroller.className = 'horizontal-products-container';
     container.appendChild(productsScroller);

     try {
         // Fetch latest 10 products from this category
         const q = query(
             collection(db, "products"), // Use collection from firestore
             where('categoryId', '==', categoryId),
             orderBy('createdAt', 'desc'),
             limit(10)
         );
         const snapshot = await getDocs(q);

         if (snapshot.empty) return null; // Don't render empty sections

         snapshot.forEach(doc => {
             const product = { id: doc.id, ...doc.data() };
             const card = createProductCardElement(product); // Create card UI
             productsScroller.appendChild(card);
         });
         return container; // Return the fully rendered section
     } catch (error) {
         console.error(`Error fetching products for single category row ${categoryId}:`, error);
         return null; // Return null on error
     }
}

// Renders the "All Products" section for home page (limited view)
async function renderAllProductsSection() {
     const container = document.createElement('div');
     container.className = 'dynamic-section';
     container.style.marginTop = '20px'; // Add some top margin

     const header = document.createElement('div');
     header.className = 'section-title-header';
     const title = document.createElement('h3');
     title.className = 'section-title-main';
     title.textContent = t('all_products_section_title');
     header.appendChild(title);
     container.appendChild(header);

     // Product Grid Container
     const productsGrid = document.createElement('div');
     productsGrid.className = 'products-container';
     container.appendChild(productsGrid);

     try {
         // Fetch latest 10 products overall
         const q = query(collection(db,"products"), orderBy('createdAt', 'desc'), limit(10)); // Use collection
         const snapshot = await getDocs(q);

         if (snapshot.empty) return null; // Don't render if no products at all

         snapshot.forEach(doc => {
             const product = { id: doc.id, ...doc.data() };
             const card = createProductCardElement(product); // Create card UI
             productsGrid.appendChild(card);
         });
         return container; // Return the fully rendered section
     } catch (error) {
         console.error("Error fetching initial all products for home page:", error);
         return null; // Return null on error
     }
}



// --- Service Worker Related ---
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');

            // Listen for updatefound event
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);

                newWorker.addEventListener('statechange', () => {
                    // Check if the new worker is installed and waiting
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                         // Show the update notification bar
                         if(updateNotification) updateNotification.classList.add('show');
                     }
                });
            });

            // Handle the click on the "Update Now" button
            if (updateNowBtn) {
                 updateNowBtn.addEventListener('click', () => {
                     // Send skipWaiting message to the waiting service worker
                     if (registration.waiting) {
                         registration.waiting.postMessage({ action: 'skipWaiting' });
                         // Hide the notification after clicking
                         if(updateNotification) updateNotification.classList.remove('show');
                     }
                 });
             }

        }).catch(err => {
            console.error('Service Worker registration failed: ', err);
        });

        // Listen for controllerchange event (new worker activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New Service Worker activated. Reloading page...');
             window.location.reload(); // Force reload to use the new service worker
        });
    }
}

// --- Initial UI Setup Call --- (Called from data-logic after data is ready)
export function initializeUI() {
    setupUIEventListeners();
    setupScrollObserver();
    updateCategoryDependentUI(); // Ensure this runs after categories are in state
    renderContactLinks();
    // checkNewAnnouncements() is called from data-logic now
    handleInitialPageLoad(); // Handles initial view based on URL
    showWelcomeMessage();
    setupGpsButton();
    setupServiceWorker(); // Register and set up SW listeners
    setLanguage(state.currentLanguage); // Apply language last to translate everything
}

// Add popstate listener to the window
window.addEventListener('popstate', handlePopState);