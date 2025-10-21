// === app-logic.js (Updated: Home page logic moved to homePage.js) ===
// Fonksiyon û mentiqê serekî yê bernameyê

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection, // Keep collections needed here
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
    // Add any missing elements if needed
} from './app-setup.js';

// ++ IMPORT FUNCTIONS FROM homePage.js ++
import { initializeHomePage, renderHomePageContent, startPromoRotation, stopPromoRotation } from './homePage.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";


// --- Helper Functions (debounce, saveCurrentScrollPosition, etc.) ---
// Keep these helper functions here as they are used by various parts of the app
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function saveCurrentScrollPosition() {
    const currentState = history.state;
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) return; // Add checks

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0); // Scroll to top for subpages
    }

    // Update header based on the page being shown
    updateHeaderView(pageId, pageTitle);

    // Update bottom navigation highlighting
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn'
                     : (pageId === 'settingsPage' ? 'settingsBtn' : null); // Add other pages if needed
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    } else {
        // If no specific button matches, maybe clear active state or highlight based on popup
        // For now, let's clear it if not home or settings
         updateActiveNav(null); // Pass null to clear active state
    }
}


function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if(sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening popup
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with ID "${id}" not found for popup.`);
        return;
    }


    closeAllPopupsUI(); // Close any existing popups first

    if (type === 'sheet') {
        if(sheetOverlay) sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Trigger specific render functions when opening sheets
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            // Populate profile form if opening profile sheet
            const nameInput = document.getElementById('profileName');
            const addressInput = document.getElementById('profileAddress');
            const phoneInput = document.getElementById('profilePhone');
            if (nameInput) nameInput.value = state.userProfile.name || '';
            if (addressInput) addressInput.value = state.userProfile.address || '';
            if (phoneInput) phoneInput.value = state.userProfile.phone || '';
        }
    } else { // Modal type
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent background scroll

    // Push state for popup history management
    history.pushState({ type: type, id: id }, '', `#${id}`);
}


function closeCurrentPopup() {
    // Check if the current history state represents a popup we opened
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Use browser history to close it (will trigger popstate)
    } else {
        // Fallback if history state is not correct (e.g., initial load with hash)
        closeAllPopupsUI();
        // Remove hash from URL without adding to history
        history.replaceState(history.state, '', window.location.pathname + window.location.search);
    }
}

// --- Navigation and State Management ---
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input UI
    if (searchInput) searchInput.value = state.currentSearch;
    if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Update category UI elements
    renderMainCategories(); // Update active state
    await renderSubcategories(state.currentCategory); // Render subcats if needed (might be hidden)

    // Decide whether to show home page or search/filter results
    const shouldShowHome = !state.currentSearch
                        && state.currentCategory === 'all'
                        && state.currentSubcategory === 'all'
                        && state.currentSubSubcategory === 'all';

    const homeContainer = document.getElementById('homePageSectionsContainer');

    if (shouldShowHome) {
        // --- Show Home Page ---
        if(productsContainer) productsContainer.style.display = 'none';
        if(skeletonLoader) skeletonLoader.style.display = 'none';
        const scrollTrigger = document.getElementById('scroll-loader-trigger');
        if(scrollTrigger) scrollTrigger.style.display = 'none';
        if(loader) loader.style.display = 'none';
        if(homeContainer) homeContainer.style.display = 'block';

        // Render home content only if container is empty or forced
        if (homeContainer && (homeContainer.innerHTML.trim() === '' || !fromPopState)) {
             await renderHomePageContent(); // Call imported function
        } else {
            startPromoRotation(); // Ensure rotation is active
        }
    } else {
        // --- Show Search/Filter Results ---
        if(homeContainer) homeContainer.style.display = 'none';
        stopPromoRotation(); // Stop rotation when leaving home view
        await searchProductsInFirestore(state.currentSearch, true); // Trigger search/filter (true = new search)
    }

    // Handle scrolling based on history navigation
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Restore scroll position after a short delay
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState && !shouldShowHome) {
        // Scroll to top for new filter/search actions (but not on initial home load)
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function navigateToFilter(newState) {
    // Save current scroll position before changing state
    history.replaceState({
        ...(history.state || {}), // Keep existing non-filter state
        scroll: window.scrollY
    }, '');

    // Define the new filter state, merging with current and resetting scroll
    const finalFilterState = {
        ...(history.state || {}), // Keep type, id etc. if they exist
        category: newState.category !== undefined ? newState.category : state.currentCategory,
        subcategory: newState.subcategory !== undefined ? newState.subcategory : state.currentSubcategory,
        subSubcategory: newState.subSubcategory !== undefined ? newState.subSubcategory : state.currentSubSubcategory,
        search: newState.search !== undefined ? newState.search : state.currentSearch,
        scroll: 0 // Always reset scroll for a new navigation action
    };

    // Construct URL parameters based ONLY on the filter part of the state
    const params = new URLSearchParams();
    if (finalFilterState.category && finalFilterState.category !== 'all') params.set('category', finalFilterState.category);
    if (finalFilterState.subcategory && finalFilterState.subcategory !== 'all') params.set('subcategory', finalFilterState.subcategory);
    if (finalFilterState.subSubcategory && finalFilterState.subSubcategory !== 'all') params.set('subSubcategory', finalFilterState.subSubcategory);
    if (finalFilterState.search) params.set('search', finalFilterState.search);

    // Build the new URL (pathname + new params + existing hash if any)
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;

    // Push the complete new state (including filter and reset scroll)
    history.pushState(finalFilterState, '', newUrl);

    // Apply the changes to the UI
    await applyFilterState(finalFilterState, false); // false = not from popstate
}


window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI(); // Always close popups on history change first
    const popState = event.state;
    console.log("Popstate triggered:", popState);

    if (popState) {
        if (popState.type === 'page') {
             let pageTitle = popState.title;
             // Refetch title for subcategory page if needed
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                  try {
                       const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                       const subCatSnap = await getDoc(subCatRef);
                       if (subCatSnap.exists()) {
                            const subCat = subCatSnap.data();
                            pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                       }
                  } catch(e) { console.error("Could not refetch title on popstate", e) }
             }
            showPage(popState.id, pageTitle); // Show the correct page structure
            // If navigating back TO the main page, apply its filters and scroll
            if (popState.id === 'mainPage') {
                applyFilterState(popState, true); // true = from popstate (restore scroll)
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             // Re-open the sheet/modal based on the popped state
             openPopup(popState.id, popState.type);
        } else {
             // Assume it's a filter state for the main page
             showPage('mainPage'); // Ensure main page is visible
             applyFilterState(popState, true); // Apply filters and restore scroll
        }
    } else {
        // No state - likely means user navigated back to the initial entry point
        const defaultState = { type:'page', id:'mainPage', category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState, false); // Apply default filters, no scroll needed
    }
});


function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage'
                 : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    let initialState = {};

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        initialState = { type: 'page', id: pageId, mainCatId: mainCatId, subCatId: subCatId };
        // Don't call showSubcategoryDetailPage yet, wait for categories
        showPage(pageId, "Loading..."); // Show page structure
    } else if (pageId === 'settingsPage') {
         initialState = { type: 'page', id: pageId, title: t('settings_title') };
         showPage(pageId, t('settings_title'));
    } else { // mainPage
        initialState = {
            type: 'page',
            id: 'mainPage',
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        showPage('mainPage');
        // applyFilterState will be called after categories load
    }
    // Set initial history state
    history.replaceState(initialState, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);

    // Handle opening popups from hash or product from query param (after slight delay)
     setTimeout(() => {
        const currentHash = window.location.hash.substring(1); // Re-check hash
        const element = document.getElementById(currentHash);
        // Only open popup if we are actually on the main page now
        if (element && document.getElementById('mainPage').classList.contains('page-active')) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                 // Check if history state already represents this popup before opening again
                 if (!history.state || history.state.id !== currentHash) {
                    openPopup(currentHash, isSheet ? 'sheet' : 'modal');
                 }
            }
        }

        const productId = params.get('product');
        if (productId) {
            showProductDetails(productId); // Attempt to show product details
        }
     }, 300);
}



// --- Translation Function (t) ---
function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key])
                   || (translations['ku_sorani'] && translations['ku_sorani'][key]) // Fallback 1: Sorani
                   || (replacements && replacements.defaultValue)                  // Fallback 2: Provided default
                   || key;                                                         // Fallback 3: Key itself
    // Replace placeholders like {price}
    for (const placeholder in replacements) {
        if (placeholder !== 'defaultValue') { // Don't replace the special 'defaultValue' key
             // Use a regex for global replacement (if placeholder appears multiple times)
             const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
             translation = translation.replace(regex, replacements[placeholder]);
        }
    }
    return translation;
}


// --- Functions setLanguage, forceUpdate, updateContactLinksUI, updateActiveNav, formatDescription, requestNotificationPermission, saveTokenToFirestore ---
// (These remain the same as in the previous complete version)
function setLanguage(lang) {
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

    // Re-render dynamic content that depends on language
     const homeContainer = document.getElementById('homePageSectionsContainer');
     homeContainer.innerHTML = ''; // Clear home content to force re-render with new lang

    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (isHomeView) {
        renderHomePageContent(); // Regenerate home content using imported function
    } else {
        // Re-render product list if not on home view
        renderProducts(); // Assumes state.products is already filtered correctly
    }

    // Re-render other language-dependent UI parts
    renderMainCategories();
    renderCategoriesSheet(); // Update category names in the sheet
    if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart(); // Update item names in cart
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage(); // Update item names in favorites
    renderContactLinks(); // Update contact link names
    // Re-render admin category dropdowns if admin is active
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic?.updateAdminCategoryDropdowns) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns();
    }
}

async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success');

            setTimeout(() => {
                window.location.reload(true); // Force reload from server
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

function updateContactLinksUI() {
    // This function seems unused, maybe remove or implement if needed later
    if (!state.contactInfo) return;
    // Update UI based on state.contactInfo
}

function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    if (activeBtnId) { // Check if an ID was provided
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
}


function formatDescription(text) {
    if (!text) return '';
    // Basic escaping
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (http, https, www)
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        // Ensure link opens in new tab and is secure
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newline characters with <br> tags
    return textWithLinks.replace(/\n/g, '<br>');
}


async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notification_permission_granted', {defaultValue: 'مۆڵەتی ناردنی ئاگەداری درا'}), 'success'); // Fallback
            // Get FCM token
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
                showNotification(t('notification_no_token', {defaultValue:'نەتوانرا تۆکن وەربگیرێت'}), 'error'); // Fallback
            }
        } else {
            console.log('Unable to get permission to notify.');
             showNotification(t('notification_permission_denied', {defaultValue:'مۆڵەت نەدرا'}), 'error'); // Fallback
        }
    } catch (error) {
        console.error('An error occurred while requesting permission or getting token: ', error);
         showNotification(t('notification_permission_error', {defaultValue:'هەڵە لە وەرگرتنی مۆڵەت'}), 'error'); // Fallback
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID to prevent duplicates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add user ID here if users log in
            // userId: auth.currentUser ? auth.currentUser.uid : null
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}


// --- Functions saveFavorites, isFavorite, toggleFavorite ---
// (Remain the same)
function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    // Ensure state.favorites is an array before using .includes()
    return Array.isArray(state.favorites) && state.favorites.includes(productId);
}

function toggleFavorite(productId, event) {
    if(event) event.stopPropagation(); // Stop card click when clicking favorite

    // Ensure state.favorites is an array
     if (!Array.isArray(state.favorites)) {
         state.favorites = [];
     }

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update UI only for the clicked button and potentially others for the same product
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Get the icon directly
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite; // The new state
            favButton.classList.toggle('favorited', isNowFavorite);
            // Toggle Font Awesome classes for solid/regular heart
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart if favorited
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular heart if not
        }
    });

    // If the favorites sheet is open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage();
    }
}


// --- renderFavoritesPage (Uses createProductCardElement) ---
async function renderFavoritesPage() {
    if (!favoritesContainer || !emptyFavoritesMessage) return; // Add checks

    favoritesContainer.innerHTML = ''; // Clear previous items

     // Ensure state.favorites is an array
     if (!Array.isArray(state.favorites)) {
         state.favorites = [];
     }


    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Ensure grid display is set

    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeleton while loading

    try {
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton loader

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
             emptyFavoritesMessage.style.display = 'block';
             favoritesContainer.style.display = 'none';
            if(state.favorites.length > 0) {
                console.warn("Some favorited products no longer exist in DB.");
                // state.favorites = favoritedProducts.map(p => p.id); // Uncomment to clean local storage
                // saveFavorites();
            }
        } else {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status once
             // Make sure createProductCardElement exists
             if (typeof createProductCardElement !== 'function') {
                 console.error("createProductCardElement is not available in app-logic.js for favorites.");
                 favoritesContainer.innerHTML = `<p>${t('error_generic')}</p>`;
                 return;
             }

            favoritedProducts.forEach(product => {
                // ++ USE IMPORTED/PASSED FUNCTION ++
                const productCard = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; grid-column: 1 / -1;">${t('error_generic')}</p>`; // Span across grid columns
    }
}


// --- Functions saveCart, updateCartCount, showNotification ---
// (Remain the same)
function saveCart() {
     // Ensure state.cart is an array
     if (!Array.isArray(state.cart)) {
         state.cart = [];
     }
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

function updateCartCount() {
     // Ensure state.cart is an array
     if (!Array.isArray(state.cart)) {
         state.cart = [];
     }
    const totalItems = state.cart.reduce((total, item) => total + (item.quantity || 0), 0); // Add check for quantity
    // Update all elements with the cart-count class
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function showNotification(message, type = 'success') {
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
        }, 300); // Should match CSS transition duration
    }, 3000); // Notification display duration
}


// --- Functions populateCategoryDropdown, renderCategoriesSheet, renderSubcategories, renderMainCategories ---
// (Remain the same)
function populateCategoryDropdown() {
    if (!productCategorySelect) return;
    productCategorySelect.innerHTML = `<option value="" disabled selected>-- ${t('choose_category')} --</option>`; // Translate placeholder
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all'); // Exclude 'all' option
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Display name in current language, fallback to Sorani
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous categories
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        // Get category name, handle 'all' category specially
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Translate "All"
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Use current lang, fallback Sorani

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Use default icon if missing

        btn.onclick = async () => {
             // Navigate to the selected category (clearing subcats and search)
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search term
            });
            closeCurrentPopup(); // Close the category sheet
            showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // Clear previous

    // Don't show subcategories if 'all' main categories are selected
    if (!categoryId || categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Hide the container
        return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show the container

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        // Store fetched subcategories in state (might be useful elsewhere)
        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Don't show the subcategory bar if there are no subcategories
        if (state.subcategories.length === 0) {
            subcategoriesContainer.style.display = 'none';
            return;
        }


        // Add "All" button for the current main category's subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        // SVG icon for 'All'
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
             // Navigate, keeping main category but resetting sub/subsub
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Add buttons for each actual subcategory
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent pixel
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            subcatBtn.onclick = () => {
                // Navigate to the dedicated subcategory detail page
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

async function renderSubSubcategories(mainCatId, subCatId) {
    // This function is no longer needed on the main page, handled by subcategory detail page
    if (subSubcategoriesContainer) {
        subSubcategoriesContainer.innerHTML = '';
        subSubcategoriesContainer.style.display = 'none'; // Ensure it's hidden on main page
    }
}


function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    // Ensure state.categories is loaded and is an array
     if (!Array.isArray(state.categories) || state.categories.length === 0) {
         console.warn("Main categories not loaded yet or empty.");
         return; // Don't render if categories aren't ready
     }


    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Highlight if it's the currently active main category
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // Get category name, handle 'all' category specially
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Translate "All"
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Use current lang, fallback Sorani

        // Use a default icon if none is provided
        btn.innerHTML = `<i class="${cat.icon || 'fas fa-th'}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            // Navigate to this main category, resetting sub-levels and search
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

// --- Subcategory Detail Page Logic ---
// (Keep showSubcategoryDetailPage, renderSubSubcategoriesOnDetailPage, renderProductsOnDetailPage here)
async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = '';
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        } else {
             console.warn(`Subcategory ${subCatId} not found under ${mainCatId}`);
             subCatName = 'Details'; // Fallback title
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
        subCatName = 'Details'; // Fallback title
    }

    // Push state only if not navigating from browser history
    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    // Show the subcategory page structure and set the title
    showPage('subcategoryDetailPage', subCatName);

    // Get references to elements within the detail page
    const detailPageLoader = document.getElementById('detailPageLoader');
    const detailProductsContainer = document.getElementById('productsContainerOnDetailPage');
    const detailSubSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
    const detailSearchInput = document.getElementById('subpageSearchInput');
    const detailClearSearchBtn = document.getElementById('subpageClearSearchBtn');

     // Ensure elements exist before proceeding
     if (!detailPageLoader || !detailProductsContainer || !detailSubSubContainer || !detailSearchInput || !detailClearSearchBtn) {
         console.error("One or more elements missing in subcategoryDetailPage.");
         return;
     }

    // Reset UI: Show loader, clear previous content, reset search
    detailPageLoader.style.display = 'block';
    detailProductsContainer.innerHTML = '';
    detailSubSubContainer.innerHTML = '';
    detailSearchInput.value = '';
    detailClearSearchBtn.style.display = 'none';

    // Fetch and render content for the detail page
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Initially load all products for this subcat

    detailPageLoader.style.display = 'none'; // Hide loader after content is loaded
}

async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
     if (!container) return; // Exit if container not found
    container.innerHTML = ''; // Clear previous

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        // If no sub-subcategories, hide the container entirely
        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex'; // Show the container

        // Add "All" button for this subcategory
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Start with 'All' active
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Identifier for the button
        allBtn.onclick = () => {
            // Deactivate other buttons, activate this one
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            // Reload products for 'all' sub-subcategories, keeping current search term
            const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
            renderProductsOnDetailPage(subCatId, 'all', currentSearch);
        };
        container.appendChild(allBtn);

        // Add buttons for each actual sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Identifier
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;

            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                 // Deactivate other buttons, activate this one
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                 // Reload products for this specific sub-subcategory, keeping current search term
                const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch);
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide on error
    }
}

async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
     if (!productsContainer || !loader) return; // Exit if elements not found

    loader.style.display = 'block'; // Show loader
    productsContainer.innerHTML = ''; // Clear previous products

    try {
        let productsQuery = collection(db, "products"); // Start with base collection

        // --- Apply Filters ---
        // Always filter by the main subcategory ID for this page
        productsQuery = query(productsQuery, where("subcategoryId", "==", subCatId));

        // Apply sub-subcategory filter if it's not 'all'
        if (subSubCatId !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", subSubCatId));
        }

        // --- Apply Search Term ---
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff'),
                orderBy("searchableName", "asc") // First orderBy must match inequality
                // Optionally add secondary sort
                // orderBy("createdAt", "desc")
            );
        } else {
             // Default sort when not searching
             productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // --- Execute Query ---
        const productSnapshot = await getDocs(productsQuery);

        // --- Render Results ---
        if (productSnapshot.empty) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('no_products_found', {defaultValue:'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
        } else {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status
             // Make sure createProductCardElement exists
             if (typeof createProductCardElement !== 'function') {
                 console.error("createProductCardElement is not available in app-logic.js for detail page.");
                 productsContainer.innerHTML = `<p>${t('error_generic')}</p>`;
                 return;
             }
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                // ++ USE IMPORTED/PASSED FUNCTION ++
                const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
                productsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_fetching_products', {defaultValue:'هەڵەیەک ڕوویدا.'})}</p>`;
    } finally {
        loader.style.display = 'none'; // Hide loader
    }
}


// --- Functions renderSkeletonLoader, searchProductsInFirestore, addToCart, renderCart, updateQuantity, removeFromCart, generateOrderMessage, renderCartActionButtons ---
// (Remain the same, but ensure searchProductsInFirestore calls renderHomePageContent correctly)
function renderSkeletonLoader(container = skeletonLoader, count = 8) {
     if(!container) return; // Add check
    container.innerHTML = ''; // Clear previous skeletons or content
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        // Simplified skeleton structure
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid layout

    // If rendering the main skeleton loader, hide the actual products container and loading dots
    if (container === skeletonLoader) {
      if(productsContainer) productsContainer.style.display = 'none';
      if(loader) loader.style.display = 'none'; // Hide the spinning loader if skeleton is shown
      const homeContainer = document.getElementById('homePageSectionsContainer');
      if(homeContainer) homeContainer.style.display = 'none'; // Hide home sections too
    }
}

async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const currentSearchTerm = searchTerm.trim().toLowerCase(); // Normalize search term

    // Determine if we should show the home page layout or search/filter results
    const shouldShowHomeSections = !currentSearchTerm
                                && state.currentCategory === 'all'
                                && state.currentSubcategory === 'all'
                                && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // --- Show Home Page ---
        if(productsContainer) productsContainer.style.display = 'none';
        if(skeletonLoader) skeletonLoader.style.display = 'none';
        if(scrollTrigger) scrollTrigger.style.display = 'none';
        if(loader) loader.style.display = 'none';
        if(homeSectionsContainer) homeSectionsContainer.style.display = 'block';

        // Render home content only if container is empty
        if (homeSectionsContainer && homeSectionsContainer.innerHTML.trim() === '') {
             await renderHomePageContent(); // ++ CALL IMPORTED FUNCTION ++
        } else {
             startPromoRotation(); // Ensure rotation is active if content exists
        }
        return; // Stop execution, home page is displayed
    } else {
        // --- Show Search/Filter Results ---
        if(homeSectionsContainer) homeSectionsContainer.style.display = 'none'; // Hide home sections
         stopPromoRotation(); // ++ CALL IMPORTED FUNCTION ++
    }


    // --- Caching Logic (Optional) ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${currentSearchTerm}`;
    if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
        console.log("Loading from cache:", cacheKey);
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        if(skeletonLoader) skeletonLoader.style.display = 'none';
        if(loader) loader.style.display = 'none';
        if(productsContainer) productsContainer.style.display = 'grid';

        renderProducts(); // Render cached products
        if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    // --- Firestore Query Logic ---
    if (state.isLoadingMoreProducts && !isNewSearch) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        if(productsContainer) productsContainer.innerHTML = '';
        renderSkeletonLoader(); // Show skeleton for new search
    }

    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    if(loader) loader.style.display = isNewSearch ? 'none' : 'block'; // Show spinning loader only when loading more

    try {
        let productsQuery = collection(db, "products");

        // Apply Filters (same as before)
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Apply Search Term Filter (same as before)
        if (currentSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', currentSearchTerm),
                where('searchableName', '<=', currentSearchTerm + '\uf8ff'),
                 orderBy("searchableName", "asc"),
                 orderBy("createdAt", "desc") // Secondary sort
            );
        } else {
             productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply Pagination (same as before)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Apply Limit (same as before)
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // Execute Query (same as before)
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update State (same as before)
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;

         // Update Cache (if new search)
         if (isNewSearch) {
             if(!state.productCache) state.productCache = {};
             state.productCache[cacheKey] = {
                 products: state.products,
                 lastVisible: state.lastVisibleProductDoc,
                 allLoaded: state.allProductsLoaded
             };
              console.log("Saved to cache:", cacheKey);
         }

        // Render Results (Append logic adjusted slightly)
        if (isNewSearch) {
            renderProducts(); // Render the full list for a new search
        } else if (newProducts.length > 0) { // Only append if new products were loaded
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            const fragment = document.createDocumentFragment(); // Use fragment for efficiency
            newProducts.forEach(product => {
                 const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
                 card.classList.add('product-card-reveal');
                 fragment.appendChild(card);
            });
            if(productsContainer) productsContainer.appendChild(fragment); // Append fragment once
            setupScrollAnimations(); // Setup animation for newly added cards
        }

        // Handle empty results (same as before)
        if (state.products.length === 0 && isNewSearch && productsContainer) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', {defaultValue:'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        if(productsContainer) productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_fetching_products', {defaultValue:'هەڵەیەک لە هێنانی کاڵاکان ڕوویدا.'})}</p>`;
    } finally {
        state.isLoadingMoreProducts = false;
        if(loader) loader.style.display = 'none';
        if(skeletonLoader) skeletonLoader.style.display = 'none';
        if(productsContainer) productsContainer.style.display = 'grid'; // Ensure grid is visible
        if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
    }
}

// --- Functions renderPolicies, checkNewAnnouncements, renderUserNotifications, renderContactLinks, showWelcomeMessage, setupGpsButton, setupScrollObserver, updateCategoryDependentUI ---
// (Remain the same)
async function renderPolicies() {
     if(!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage]
                         || policies.ku_sorani
                         || '';
            termsContentContainer.innerHTML = content ? formatDescription(content) : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

function checkNewAnnouncements() {
    if (!notificationBadge) return;

    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = parseInt(localStorage.getItem('lastSeenAnnouncementTimestamp') || '0');

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
             notificationBadge.style.display = 'none';
        }
    }, (error) => {
         console.error("Error listening for new announcements:", error);
    });
    // Consider storing 'unsubscribe' globally if you need to stop listening later
}


async function renderUserNotifications() {
     if(!notificationsListContainer) return;
    notificationsListContainer.innerHTML = `<p>${t('loading_notifications', {defaultValue: '...بارکردنی ئاگەدارییەکان'})}</p>`;

    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = '';
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            localStorage.setItem('lastSeenAnnouncementTimestamp', Date.now().toString());
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
                <p class="notification-content">${formatDescription(content)}</p> {/* Use formatDescription */}
            `;
            notificationsListContainer.appendChild(item);
        });

        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp.toString());
        if(notificationBadge) notificationBadge.style.display = 'none';

    } catch (error) {
        console.error("Error fetching notifications:", error);
        notificationsListContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}


function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if (!contactLinksContainer) return;

    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = '';

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = `<p style="padding: 15px; text-align: center;">${t('no_contact_links', {defaultValue:'هیچ لینکی پەیوەندی نییە.'})}</p>`;
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = (link['name_' + state.currentLanguage]) || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url || '#';
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            linkElement.className = 'settings-item';

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;
            contactLinksContainer.appendChild(linkElement);
        });
    }, (error) => {
         console.error("Error fetching social links:", error);
         contactLinksContainer.innerHTML = `<p style="padding: 15px; text-align: center;">${t('error_generic')}</p>`;
    });
     // Store unsubscribe if needed: window.unsubscribeContactLinks = unsubscribe;
}


function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) {
             openPopup('welcomeModal', 'modal');
             localStorage.setItem('hasVisited', 'true');
        }
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan ? btnSpan.textContent : 'Get Location';

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification(t('gps_not_supported', {defaultValue:'وێبگەڕەکەت پشتگیری GPS ناکات'}), 'error');
            return;
        }

        if(btnSpan) btnSpan.textContent = t('gps_loading', {defaultValue:'...چاوەڕوان بە'});
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => { /* Success */
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification(t('gps_success', {defaultValue:'ناونیشان وەرگیرا'}), 'success');
                    } else {
                        showNotification(t('gps_no_address', {defaultValue:'نەتوانرا ناونیشان بدۆزرێتەوە'}), 'error');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    showNotification(t('gps_error_fetching', {defaultValue:'هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا'}), 'error');
                } finally {
                    if(btnSpan) btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { /* Error */
                let messageKey = 'gps_error_unknown';
                if(error.code === 1) messageKey = 'gps_error_permission';
                else if(error.code === 2) messageKey = 'gps_error_unavailable';
                else if(error.code === 3) messageKey = 'gps_error_timeout';
                showNotification(t(messageKey, {defaultValue: 'هەڵەیەکی نادیار ڕوویدا'}), 'error');
                if(btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 } // Options
        );
    });
}


function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
            console.log("Scroll trigger intersected, loading more products...");
            searchProductsInFirestore(state.currentSearch, false); // false = load more
        }
    }, { threshold: 0.1 });

    observer.observe(trigger);
}


function updateCategoryDependentUI() {
    if (!Array.isArray(state.categories) || state.categories.length === 0) {
        console.warn("Attempted updateCategoryDependentUI before categories loaded.");
        return;
    }
    console.log("Updating category dependent UI...");
    populateCategoryDropdown();
    renderMainCategories();
    renderCategoriesSheet();

    // Update admin dropdowns if admin logic is available
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns?.();
        window.AdminLogic.updateShortcutCardCategoryDropdowns?.();
    }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    // --- Navigation Buttons ---
    homeBtn?.addEventListener('click', async () => {
        if (!document.getElementById('mainPage')?.classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    });

    settingsBtn?.addEventListener('click', () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    });

    document.getElementById('headerBackBtn')?.addEventListener('click', () => history.back());

    // --- Bottom Sheet/Modal Triggers ---
    profileBtn?.addEventListener('click', () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); });
    cartBtn?.addEventListener('click', () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); });
    categoriesBtn?.addEventListener('click', () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); });
    notificationBtn?.addEventListener('click', () => openPopup('notificationsSheet'));

    // --- Settings Page Links ---
    settingsFavoritesBtn?.addEventListener('click', () => openPopup('favoritesSheet'));
    settingsAdminLoginBtn?.addEventListener('click', () => openPopup('loginModal', 'modal'));
    termsAndPoliciesBtn?.addEventListener('click', () => openPopup('termsSheet'));
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate);

    // --- Popup Closing ---
    sheetOverlay?.addEventListener('click', closeCurrentPopup);
    document.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', closeCurrentPopup));
    window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); });

    // --- Forms ---
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        const loginButton = loginForm.querySelector('button[type="submit"]');
        if (!loginButton || !email || !password) return; // Add checks
        const originalButtonText = loginButton.textContent;
        loginButton.disabled = true;
        loginButton.textContent = '...چوونەژوور';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Login failed:", error);
            showNotification(t('login_error'), 'error');
            loginButton.disabled = false;
            loginButton.textContent = originalButtonText;
        }
    });

    profileForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName')?.value.trim(),
            address: document.getElementById('profileAddress')?.value.trim(),
            phone: document.getElementById('profilePhone')?.value.trim(),
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    });

    // --- Search ---
     const debouncedSearch = debounce(async (term) => {
        await navigateToFilter({ search: term, category: 'all', subcategory:'all', subSubcategory:'all' });
    }, 500);

    searchInput?.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        if(clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    });

    clearSearchBtn?.addEventListener('click', () => {
        if(searchInput) searchInput.value = '';
        if(clearSearchBtn) clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '', category:'all', subcategory:'all', subSubcategory:'all' });
    });

     // --- Subpage Search ---
     const subpageSearchInput = document.getElementById('subpageSearchInput');
     const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
     const debouncedSubpageSearch = debounce(async (term) => {
         const hash = window.location.hash.substring(1);
         if (hash.startsWith('subcategory_')) {
             const ids = hash.split('_');
             const subCatId = ids[2];
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
             await renderProductsOnDetailPage(subCatId, subSubCatId, term);
         }
     }, 500);

     subpageSearchInput?.addEventListener('input', () => {
         const searchTerm = subpageSearchInput.value;
         if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
         debouncedSubpageSearch(searchTerm);
     });
     subpageClearSearchBtn?.addEventListener('click', () => {
         if(subpageSearchInput) subpageSearchInput.value = '';
         if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';
         debouncedSubpageSearch('');
     });

    // --- Settings Toggles ---
    contactToggle?.addEventListener('click', () => {
        document.getElementById('dynamicContactLinksContainer')?.classList.toggle('open');
        contactToggle.querySelector('.contact-chevron')?.classList.toggle('open');
    });

    // --- Language Buttons ---
    document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', () => setLanguage(btn.dataset.lang)));

    // --- PWA Install Button ---
    document.getElementById('installAppBtn')?.addEventListener('click', async () => {
        if (state.deferredPrompt) {
            document.getElementById('installAppBtn').style.display = 'none';
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            state.deferredPrompt = null;
        }
    });

     // --- Firebase Messaging Listener (Foreground) ---
     onMessage(messaging, (payload) => {
         console.log('Foreground message received: ', payload);
         const title = payload.notification?.title || 'New Notification';
         const body = payload.notification?.body || '';
         showNotification(`${title}${body ? ': ' + body : ''}`, 'success');
         if (notificationBadge) notificationBadge.style.display = 'block';
     });
}

// --- Auth State Change Listener ---
onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // !! REPLACE WITH YOUR ADMIN UID !!
    const isAdmin = user && user.uid === adminUID;

    console.log("Auth state changed. User:", user ? user.uid : 'null', "Is Admin:", isAdmin);

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        // Initialize admin logic if available and not already done
         if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function' && !window.AdminLogic.listenersAttached) {
             window.AdminLogic.initialize();
         } else if (window.AdminLogic) { // If already initialized, ensure UI is correct
             window.AdminLogic.updateAdminUI(true);
             window.AdminLogic.updateAdminCategoryDropdowns?.(); // Update dropdowns if categories loaded later
             window.AdminLogic.updateShortcutCardCategoryDropdowns?.();
         }
        if (loginModal?.style.display === 'block') closeCurrentPopup(); // Close login if open
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) { // Log out any non-admin authenticated user
            console.log("Non-admin user detected, logging out.");
            await signOut(auth).catch(err => console.error("Error signing out non-admin:", err));
        }
        // Deinitialize or hide admin UI
        if (window.AdminLogic?.deinitialize) window.AdminLogic.deinitialize();
        else if (window.AdminLogic?.updateAdminUI) window.AdminLogic.updateAdminUI(false);
    }

    // Re-render potentially affected UI elements after auth change
    if(state.products?.length > 0) { // Check if products exist before re-rendering
        renderProducts();
        if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
            renderFavoritesPage();
        }
         // Re-render home sections if currently visible to show/hide admin buttons there too
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer && homeContainer.style.display !== 'none') {
             // Re-render home content might be too much, maybe just update buttons?
             // For simplicity, let's re-render home page
             homeContainer.innerHTML = ''; // Clear it first
             renderHomePageContent();
        }
    }
});


// --- Initialization ---
function init() {
    renderSkeletonLoader(); // Show skeleton immediately

    enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.warn("Firestore Persistence Error:", err.code))
        .finally(initializeAppLogic); // Initialize app logic regardless
}

function initializeAppLogic() {
    // Listener for Categories - Drives initial category-dependent UI loading
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani:'هەموو', name_ku_badini:'هەمی', name_ar:'الكل' }, ...fetchedCategories];
        console.log("Categories loaded:", state.categories.length);

        // Update category UI (dropdowns, buttons, sheets)
        updateCategoryDependentUI();

         // ++ Initialize HomePage module with dependencies ++
         initializeHomePage({
             db, state, t, cardHandlers, navigateToFilter, renderSkeletonLoader,
             productsCollection, promoCardsCollection, brandsCollection, shortcutRowsCollection,
             // Pass the ACTUAL card creation functions from this file (or imported ones if they were moved)
             createProductCardElement: createProductCardElement, // Make sure this function exists here
             createPromoCardElement: createPromoCardElement // Make sure this function exists here
         });

        // Handle initial page state (URL hash/params) AFTER categories are loaded
        handleInitialPageLoad(); // Calls applyFilterState internally which might call renderHomePageContent

    }, (error) => {
         console.error("CRITICAL: Error fetching categories:", error);
         // Display critical error message
          const errorMsg = t('error_loading_categories', {defaultValue:'هەڵە لە بارکردنی جۆرەکان'});
         if(document.getElementById('mainCategoriesContainer')) document.getElementById('mainCategoriesContainer').innerHTML = `<p style="color:red;">${errorMsg}</p>`;
         if(productsContainer) productsContainer.innerHTML = `<p style="color:red;">${errorMsg}</p>`;
         if(skeletonLoader) skeletonLoader.style.display = 'none';
    });

    // --- Other Initializations ---
    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    setLanguage(state.currentLanguage); // Apply initial language early
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();

     // Initialize Admin Logic IF admin status is known on load
     if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic?.initialize && !window.AdminLogic.listenersAttached) {
        window.AdminLogic.initialize();
     }
}


// --- Expose functions/data needed by admin.js ---
// (Remains the same - uses globalAdminTools from app-setup.js)
Object.assign(window.globalAdminTools, {
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore, clearProductCache,
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories,
    getCurrentLanguage: () => state.currentLanguage,
     // Expose functions for admin category dropdowns (ensure they exist in AdminLogic)
     populateSubcategoriesDropdown: window.AdminLogic?.populateSubcategoriesDropdown,
     populateSubSubcategoriesDropdown: window.AdminLogic?.populateSubSubcategoriesDropdown
});


// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// --- PWA Service Worker Logic ---
// (Remains the same)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
        console.log('`beforeinstallprompt` event fired.');
    }
});

if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);
            newWorker?.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification?.classList.add('show');
                }
            });
        });
        updateNowBtn?.addEventListener('click', () => {
             registration.waiting?.postMessage({ action: 'skipWaiting' });
             updateNotification?.classList.remove('show');
        });
    }).catch(err => console.log('Service Worker registration failed: ', err));

    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
        refreshing = true;
    });
}

// !! IMPORTANT !! Make sure the createProductCardElement function still exists
// in this file, OR if you moved it previously to productCard.js, ensure it's
// correctly imported at the top. The code above assumes it's defined HERE.
// If you used the previous step and moved it to productCard.js, REMOVE the
// function definition below and keep the import at the top.

// ++ KEEP this function definition HERE if you DID NOT use productCard.js ++
// ++ REMOVE this function definition if you ARE using productCard.js ++
function createProductCardElement(product, handlers, currentLanguage, isAdmin) {
    // Destructure handlers with checks for missing ones
    const t = handlers.t || ((key) => key); // Basic fallback for translation
    const isFavorite = handlers.isFavorite || (() => false);
    const toggleFavorite = handlers.toggleFavorite || (() => console.error("toggleFavorite handler missing"));
    const addToCart = handlers.addToCart || (() => console.error("addToCart handler missing"));
    const showProductDetails = handlers.showProductDetails || (() => console.error("showProductDetails handler missing"));
    const showNotification = handlers.showNotification || ((msg) => console.log("Notification:", msg));
    const AdminLogic = handlers.AdminLogic || {}; // Allow admin logic to be optional
    const navigator = handlers.navigator || window.navigator; // Use window.navigator if not provided

    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;

    // Use default value 'کاڵای بێ ناو' if translation key 'unnamed_product' is missing
    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {defaultValue: 'کاڵای بێ ناو'});
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
        event.stopPropagation();
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`,
            url: productUrl,
        };
        try {
            if (navigator && navigator.share) {
                await navigator.share(shareData);
            } else if (navigator && navigator.clipboard) {
                await navigator.clipboard.writeText(productUrl);
                 // Use default value if translation key is missing
                showNotification(t('share_link_copied', { defaultValue: 'لينكى کاڵا کۆپى کرا!' }), 'success');
            } else {
                 // Use default value if translation key is missing
                 showNotification(t('share_not_supported', {defaultValue: 'پارڤەکرن ناهێتە پشتگیریکرن'}), 'error');
            }
        } catch (err) {
            console.error('Share error:', err);
             if (err.name !== 'AbortError') {
                 showNotification(t('share_error'), 'error');
             }
        }
    });

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');

        if (addToCartButton) {
            event.stopPropagation(); // Prevent card click when clicking add-to-cart
            addToCart(product.id);
            if (!addToCartButton.disabled) {
                // Animation logic
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
        } else if (isAdmin && AdminLogic.editProduct && target.closest('.edit-btn')) {
             event.stopPropagation();
             AdminLogic.editProduct(product.id);
        } else if (isAdmin && AdminLogic.deleteProduct && target.closest('.delete-btn')) {
             event.stopPropagation();
             AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            // toggleFavorite handler should handle stopPropagation if event is passed
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
             // Already handled by its own listener
        } else if (!target.closest('a')) { // Prevent triggering on internal links
             // Pass the full product object to the details handler
             showProductDetails(product); // Assuming showProductDetails can handle the object
        }
    });

    return productCard;
}

// Keep createPromoCardElement here too, or move it with createProductCardElement
function createPromoCardElement(card, currentLanguage, changeHandler, startHandler) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Use existing classes for layout

    const imageUrl = (card.imageUrls && card.imageUrls[currentLanguage])
                  || (card.imageUrls && card.imageUrls.ku_sorani)
                  || 'https://placehold.co/600x200/e2e8f0/2d3748?text=Promo'; // Fallback image
     const placeholderImg = 'https://placehold.co/600x200/e2e8f0/2d3748?text=...';


    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion" onerror="this.src='${placeholderImg}'; this.onerror=null;">
        </div>
        <button class="promo-slider-btn prev" aria-label="Previous Promo"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next" aria-label="Next Promo"><i class="fas fa-chevron-right"></i></button>
    `;

    cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button.promo-slider-btn')) {
            const targetCategoryId = card.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (targetCategoryId && categoryExists) {
                await navigateToFilter({
                    category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                });
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (targetCategoryId) {
                 console.warn(`Promo card target category "${targetCategoryId}" not found.`);
            }
        }
    });

    // Use passed handlers if available
    const changeFunc = typeof changeHandler === 'function' ? changeHandler : changePromoCard;
    // const startFunc = typeof startHandler === 'function' ? startHandler : startPromoRotation;

    cardElement.querySelector('.promo-slider-btn.prev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        changeFunc(-1);
    });

    cardElement.querySelector('.promo-slider-btn.next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        changeFunc(1);
    });

    return cardElement;
}