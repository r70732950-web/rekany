// app-logic.js - Main application coordinator (New version)
import {
    // Firebase services & config (though config might not be directly needed here)
    app, auth, db, messaging, analytics,
    // State object
    state,
    // DOM Elements (only those directly interacted with in this file)
    loginModal, searchInput, clearSearchBtn, loginForm,
    homeBtn, settingsBtn, profileBtn, cartBtn, categoriesBtn, // Bottom Nav
    sheetOverlay, // For closing popups
    productCategorySelect, productSubcategorySelect, // For admin product form category change
    subSubcategorySelectContainer, productSubSubcategorySelect, // For admin product form category change
    settingsAdminLoginBtn, settingsLogoutBtn, // Admin login/logout buttons
    contactToggle, // Settings contact toggle
    notificationBtn, // Header notification button
    termsAndPoliciesBtn, // Settings terms button
    profileForm, // Profile form submission
    subpageSearchInput, subpageClearSearchBtn, // Subpage search elements
    // PWA related DOM elements
    // installAppBtn element is handled within ui-manager setupEventListeners if needed there
} from './app-setup.js';

import {
    signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction // Include all potentially needed by admin.js
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
    getToken, onMessage
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import functions from other modules
import {
    t, setLanguage, showNotification, updateHeaderView, showPage,
    closeAllPopupsUI, openPopup, updateActiveNav, renderSkeletonLoader,
    renderMainCategories as renderMainCategoriesUI,
    renderSubcategories as renderSubcategoriesUI,
    renderCategoriesSheetContent as renderCategoriesSheetUI, // Renamed import
    renderUserNotifications as renderUserNotificationsUI,
    renderPolicies as renderPoliciesUI,
    setupGpsButton,
    showProductDetailsWithData,
    renderRelatedProducts as renderRelatedProductsUI, // Specific UI function
    renderSubSubcategoriesOnDetailPage as renderSubSubcategoriesOnDetailPageUI // Specific UI function
} from './ui-manager.js';

import {
    searchProductsInFirestore, renderHomePageContent, setupScrollObserver,
    renderProductsOnDetailPage as renderProductsOnDetailPageData // Renamed import
} from './data-renderer.js';

import {
    updateCartCount, addToCart, renderCart,
    toggleFavorite, isFavorite, renderFavoritesPage, saveProfile,
    checkNewAnnouncements, renderContactLinks as renderContactLinksData // Might move rendering UI to ui-manager later
} from './user-actions.js';

// --- Global Actions Object ---
// This object bundles functions needed by other modules, especially for UI element interactions
const appActions = {
    navigateToFilter, // Navigation function from this file
    showSubcategoryDetailPage, // Navigation function from this file
    // Product Card Actions
    isFavorite,
    addToCart,
    toggleFavorite,
    showProductDetails, // Wrapper function in this file
    shareProduct, // Function defined below
    // Admin Actions (conditionally added if admin loads)
    editProduct: (productId) => window.AdminLogic?.editProduct(productId),
    deleteProduct: (productId) => window.AdminLogic?.deleteProduct(productId),
};
// Make actions globally available (alternative to passing down deeply)
window.appActions = appActions;

// --- Debounce Utility --- (Keep locally or move to a utils.js)
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}


// --- Navigation & History ---

/**
 * Applies the filter state (category, search, etc.) to the UI and fetches data.
 * @param {object} filterState - The state object containing filters.
 * @param {boolean} [fromPopState=false] - Indicates if called due to history pop.
 */
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all'; // Needed for correct subcategory rendering
    state.currentSubSubcategory = filterState.subSubcategory || 'all'; // Needed for correct sub-subcategory rendering
    state.currentSearch = filterState.search || '';

    // Update Search Input UI
    if (searchInput) searchInput.value = state.currentSearch;
    if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Update Category UI Elements (using UI module functions)
    renderMainCategoriesUI(navigateToFilter); // Pass navigation function
    await renderSubcategoriesUI(state.currentCategory, showSubcategoryDetailPage); // Pass navigation function

    // Fetch and Render Products/Home Content (using data-renderer module function)
    await searchProductsInFirestore(state.currentSearch, true, appActions, () => renderHomePageContent(appActions)); // Pass actions and home renderer

    // Handle scroll position restoration
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Use setTimeout to ensure content is rendered before scrolling
        setTimeout(() => window.scrollTo(0, filterState.scroll), 100); // Increased delay slightly
    } else if (!fromPopState) {
        // Scroll to top for new filter states unless it's just loading more
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Updates the browser history and triggers a state application for new filters.
 * @param {object} newState - Object containing the new filter values to apply.
 */
async function navigateToFilter(newState) {
    // Save current scroll position before navigating
     const currentScroll = window.scrollY;
    history.replaceState({ ...history.state, scroll: currentScroll }, ''); // Update current state scroll

    // Merge old state with new changes, reset scroll for new view
    const finalState = {
         category: state.currentCategory,
         subcategory: state.currentSubcategory,
         subSubcategory: state.currentSubSubcategory,
         search: state.currentSearch,
        ...newState,
        scroll: 0 // Reset scroll for new filter navigation
    };

    // Construct URL query parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newQueryString = params.toString();
    const newUrl = `${window.location.pathname}${newQueryString ? '?' + newQueryString : ''}`; // Keep URL clean

    // Push the new state to history
    history.pushState(finalState, '', newUrl);

    // Apply the new state to the application
    await applyFilterState(finalState);
}

/**
 * Handles browser back/forward navigation (popstate event).
 * @param {Event} event - The popstate event.
 */
async function handlePopState(event) {
    closeAllPopupsUI(); // Close any open popups on navigation
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
             let pageTitle = popState.title;
             // Refetch title for detail page if missing (necessary after refresh)
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                     const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         const subCat = subCatSnap.data();
                         pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                         // Update the state's title retrospectively if needed
                         history.replaceState({ ...popState, title: pageTitle }, '', window.location.href);
                     }
                 } catch (e) { console.error("Could not refetch title on popstate", e); }
             }
            showPage(popState.id, pageTitle);
            // If navigating to detail page, render its content
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageContent(popState.mainCatId, popState.subCatId);
            }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Re-open the specific popup based on history state
             handleOpenPopupFromState(popState.id, popState.type); // New handler function
        } else {
            // It's a filter state on the main page
            showPage('mainPage');
            applyFilterState(popState, true); // Pass true for fromPopState
        }
    } else {
        // No state - likely initial load or refresh on base URL
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
}

/**
 * Handles opening popups specifically triggered by history navigation.
 * This avoids redundant history pushes and allows correct rendering logic.
 * @param {string} id - The ID of the popup element.
 * @param {string} type - 'sheet' or 'modal'.
 */
function handleOpenPopupFromState(id, type) {
     const element = document.getElementById(id);
     if (!element || !sheetOverlay) return;

     closeAllPopupsUI(); // Ensure others are closed

     if (type === 'sheet') {
         sheetOverlay.classList.add('show');
         element.classList.add('show');
         // Call specific rendering functions needed when opening via history
         if (id === 'cartSheet') renderCart();
         if (id === 'favoritesSheet') renderFavoritesPage(); // Assumes actions available
         if (id === 'categoriesSheet') renderCategoriesSheetUI(navigateToFilter);
         if (id === 'notificationsSheet') renderUserNotificationsUI();
         if (id === 'termsSheet') renderPoliciesUI();
         if (id === 'profileSheet') {
             document.getElementById('profileName').value = state.userProfile.name || '';
             document.getElementById('profileAddress').value = state.userProfile.address || '';
             document.getElementById('profilePhone').value = state.userProfile.phone || '';
         }
          // Add case for product detail sheet if needed
          // if (id === 'productDetailSheet') { /* Potentially re-fetch/re-render based on product ID in state? */ }
     } else { // Modal
         element.style.display = 'block';
     }
     document.body.classList.add('overlay-active');
     // DO NOT push history state here, as this function is CALLED from popstate
}


/**
 * Parses the initial URL (hash and query params) on page load and sets the initial state.
 */
async function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productIdFromParam = params.get('product');

    // Determine initial page based on hash
    let initialPageId = 'mainPage';
    let pageState = {};
    let pageTitle = '';

    if (hash.startsWith('subcategory_')) {
        initialPageId = 'subcategoryDetailPage';
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        pageState = { type: 'page', id: initialPageId, mainCatId, subCatId };
        // Fetch title asynchronously
        try {
            const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
            const subCatSnap = await getDoc(subCatRef);
            if (subCatSnap.exists()) {
                const subCat = subCatSnap.data();
                pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                pageState.title = pageTitle; // Add title to state
            }
        } catch(e) { console.error("Error fetching initial subCat title:", e)}

    } else if (hash === 'settingsPage') {
        initialPageId = 'settingsPage';
        pageTitle = t('settings_title');
        pageState = { type: 'page', id: initialPageId, title: pageTitle };
    } else {
        // Main page with potential filters or specific popup hash
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Initial scroll is always 0
        };
        pageState = initialState; // Main page filter state doesn't have a 'type'
    }

    // Replace initial history entry with the determined state
    history.replaceState(pageState, '', window.location.href);

    // Show the determined page
    showPage(initialPageId, pageTitle);

    // Apply filters if on main page, or render detail page content
    if (initialPageId === 'mainPage') {
        applyFilterState(pageState);
    } else if (initialPageId === 'subcategoryDetailPage' && pageState.mainCatId && pageState.subCatId) {
         await showSubcategoryDetailPageContent(pageState.mainCatId, pageState.subCatId);
    }

    // Check if a specific popup needs to be opened based on hash (only if on main page)
    if (initialPageId === 'mainPage' && hash) {
        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                 // Open popup and push its state AFTER initial page state is set
                 openPopupAndPushState(hash, isSheet ? 'sheet' : 'modal');
            }
        }
    }

     // If a product ID is in the query params, show its details
     if (productIdFromParam) {
         // Use setTimeout to ensure the rest of the UI is potentially ready
         setTimeout(() => showProductDetails(productIdFromParam), 500);
     }
}


/**
 * Opens a popup and pushes its state onto the history stack.
 * @param {string} id - The ID of the popup element.
 * @param {string} type - 'sheet' or 'modal'.
 */
function openPopupAndPushState(id, type) {
    // Call the UI function to visually open the popup
    // Render functions (like renderCart) are called within openPopup
    openPopup(id, type);

    // Push state AFTER opening visually
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

/**
 * Closes the currently active popup by triggering a history back operation or directly.
 */
function closeCurrentPopup() {
    // If the current state represents a popup, go back in history
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        // Otherwise (e.g., if opened without history push), close directly
        closeAllPopupsUI();
    }
}

/**
 * Navigates to the subcategory detail page.
 * @param {string} mainCatId
 * @param {string} subCatId
 */
async function showSubcategoryDetailPage(mainCatId, subCatId) {
    let subCatName = 'Details'; // Default title
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) { console.error("Could not fetch subcategory name for navigation:", e); }

    // Push history state for the new page
    history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);

    // Show the page UI
    showPage('subcategoryDetailPage', subCatName);

    // Render the content of the detail page
    await showSubcategoryDetailPageContent(mainCatId, subCatId);
}

/**
 * Renders the content (sub-subcategories and products) for the detail page.
 * @param {string} mainCatId
 * @param {string} subCatId
 */
async function showSubcategoryDetailPageContent(mainCatId, subCatId) {
    const detailLoader = document.getElementById('detailPageLoader');
    const detailProductsContainer = document.getElementById('productsContainerOnDetailPage');
    const detailSubSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
    const subpageSearch = document.getElementById('subpageSearchInput');
    const subpageClear = document.getElementById('subpageClearSearchBtn');


    if (detailLoader) detailLoader.style.display = 'block';
    if (detailProductsContainer) detailProductsContainer.innerHTML = ''; // Clear previous products
    if (detailSubSubContainer) detailSubSubContainer.innerHTML = ''; // Clear previous sub-subcats
    if (subpageSearch) subpageSearch.value = ''; // Clear search
    if (subpageClear) subpageClear.style.display = 'none';

    // Render sub-subcategories (passing the product rendering function)
    await renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId, (subId, subSubId, searchTerm) => renderProductsOnDetailPageData(subId, subSubId, searchTerm, appActions));

    // Render initial products ('all' sub-subcategories, no search term)
    await renderProductsOnDetailPageData(subCatId, 'all', '', appActions);

    if (detailLoader) detailLoader.style.display = 'none';
}


/**
 * Fetches product data if needed and shows the details sheet.
 * @param {string} productId
 */
async function showProductDetails(productId) {
    try {
        // Attempt to find product in already loaded state.products first
        let product = state.products.find(p => p.id === productId);

        if (!product) {
            // If not found, fetch directly from Firestore
            console.log(`Product ${productId} not in local state, fetching...`);
            const productRef = doc(db, "products", productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                product = { id: productSnap.id, ...productSnap.data() };
                 // Optionally add fetched product to state.products? Be careful about list order.
                 // state.products.push(product); // Or maybe better to just use it directly
            } else {
                showNotification(t('product_not_found_error'), 'error');
                return;
            }
        }

        // Show details using the UI function
        showProductDetailsWithData(product); // Renders images, text, price
        renderRelatedProductsUI(product); // Render related items

         // Push state AFTER showing the sheet visually (if not already handled by parameter)
         // Check if current history state already represents this popup
         if (!history.state || history.state.id !== 'productDetailSheet') {
             history.pushState({ type: 'sheet', id: 'productDetailSheet', productId: productId }, '', `#productDetailSheet?product=${productId}`);
         }
         // Add click listener to the Add to Cart button inside the sheet
         const sheetAddToCartBtn = document.getElementById('sheetAddToCartBtn');
         if (sheetAddToCartBtn) {
             // Remove previous listener to avoid duplicates if sheet is reopened
             sheetAddToCartBtn.onclick = null;
             sheetAddToCartBtn.onclick = () => {
                 addToCart(product.id, sheetAddToCartBtn); // Pass button for feedback
                 // closeCurrentPopup(); // Optionally close sheet after adding
             };
         }

    } catch (error) {
        console.error("Error showing product details:", error);
        showNotification(t('error_displaying_product', {default: 'هەڵە لە نیشاندانی زانیاری کاڵا.'}), 'error');
    }
}

/**
 * Handles sharing a product using Web Share API or fallback.
 * @param {object} product - The product data object.
 */
async function shareProduct(product) {
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {default: 'کاڵای بێ ناو'});
    // Construct URL with product parameter
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
    const shareData = {
        title: nameInCurrentLang,
        text: `${t('share_text')}: ${nameInCurrentLang}`, // Share text defined in translations
        url: productUrl,
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
            console.log('Product shared successfully');
        } else {
            // Fallback: Copy URL to clipboard using execCommand
            const textArea = document.createElement('textarea');
            textArea.value = productUrl;
            // Make it non-editable and invisible
            textArea.style.position = 'fixed';
            textArea.style.top = '-9999px';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                showNotification(t('product_link_copied', { default: 'لینکی کاڵا کۆپی کرا!' }), 'success');
            } catch (err) {
                console.error('Fallback copy error:', err);
                showNotification(t('copy_failed', { default: 'کۆپیکردن سەرکەوتوو نەبوو!' }), 'error');
            }
            document.body.removeChild(textArea);
        }
    } catch (err) {
        // Ignore AbortError which happens if the user cancels the share action
        if (err.name !== 'AbortError') {
            console.error('Share error:', err);
            showNotification(t('share_error'), 'error');
        } else {
             console.log('Share action cancelled by user.');
        }
    }
}



// --- Authentication ---

onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Use the actual Admin UID from your Firebase project
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Indicate admin status
         // Dynamically load admin.js only when admin logs in
         try {
             await import('./admin.js'); // Assuming admin.js exports necessary functions or attaches to window.AdminLogic
             if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                 window.AdminLogic.initialize(); // Initialize admin features
             } else {
                 console.error("Admin logic loaded but initialize function not found.");
             }
         } catch (error) {
             console.error("Failed to load admin.js:", error);
              showNotification(t('error_loading_admin_features', { default: 'هەڵە لە بارکردنی تایبەتمەندییەکانی بەڕێوەبەر.'}), 'error');
              // Optionally sign out if admin module fails to load?
              // await signOut(auth);
         }
         if (loginModal && loginModal.style.display === 'block') {
            closeCurrentPopup(); // Close login modal automatically
        }
    } else {
        // User is not admin or logged out
        sessionStorage.removeItem('isAdmin');
        // If a user is logged in but NOT the admin, sign them out.
        if (user) {
            await signOut(auth);
            console.log("Non-admin user automatically signed out.");
        }
         // Deinitialize admin features if they were loaded
         if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
             window.AdminLogic.deinitialize();
         }
    }
    // Update UI elements regardless of admin status (e.g., show/hide login/logout buttons)
    // This part is now handled within AdminLogic.initialize/deinitialize or directly via updateAdminUI in those functions
});


// --- PWA & Notifications ---

// Request notification permission (can be triggered from settings)
async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notification_permission_granted', { default: 'مۆڵەتی ناردنی ئاگەداری درا' }), 'success');
            // Get FCM token
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken); // Save token
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification(t('notification_permission_denied', { default: 'مۆڵەت نەدرا' }), 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission or getting token: ', error);
         showNotification(t('error_notification_setup', { default: 'هەڵە لە ڕێکخستنی ئاگەداری ڕوویدا' }), 'error');
    }
}

// Save FCM token to Firestore
async function saveTokenToFirestore(token) {
    if (!token) return;
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy lookup/uniqueness
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add user agent or other info here
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

// Handle foreground messages received via FCM
onMessage(messaging, (payload) => {
    console.log('Foreground message received: ', payload);
    const title = payload.notification?.title || t('new_notification', {default:'ئاگەداری نوێ'});
    const body = payload.notification?.body || '';
    showNotification(`${title}: ${body}`); // Show using app's notification system
    // Make the notification badge visible
    if (notificationBadge) notificationBadge.style.display = 'block';
});

// PWA Install Prompt Handling
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevent the default mini-infobar
    state.deferredPrompt = e; // Save the event
    // Show install button in UI (handled in setupEventListeners -> installAppBtn check)
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex';
    console.log('`beforeinstallprompt` event fired.');
});

// Service Worker Update Handling
function setupServiceWorkerUpdate() {
    if ('serviceWorker' in navigator) {
        const updateNotificationElement = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);
                newWorker?.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New worker is waiting, show update prompt
                        if (updateNotificationElement) updateNotificationElement.classList.add('show');
                    }
                });
            });

            if (updateNowBtn) {
                updateNowBtn.addEventListener('click', () => {
                    // Tell the waiting worker to activate
                    registration.waiting?.postMessage({ action: 'skipWaiting' });
                    // Hide the update prompt
                     if (updateNotificationElement) updateNotificationElement.classList.remove('show');
                });
            }

        }).catch(err => {
            console.error('Service Worker registration failed: ', err);
        });

        // Listen for controller change (new worker activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New Service Worker activated. Reloading page...');
            window.location.reload(); // Reload to use the new worker
        });
    }
}

/**
 * Force update by unregistering SW and clearing caches.
 */
async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
             const updateNotificationElement = document.getElementById('update-notification');
             if (updateNotificationElement) updateNotificationElement.classList.remove('show'); // Hide prompt

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
            setTimeout(() => window.location.reload(true), 1500); // Force reload
        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_force_update', {default:'هەڵە لەکاتی نوێکردنەوەی زۆرەملێ.'}), 'error');
        }
    }
}

// --- Event Listeners Setup ---

function setupEventListeners() {
    // Bottom Navigation
    homeBtn?.addEventListener('click', async () => {
        if (!document.getElementById('mainPage')?.classList.contains('page-active')) {
            // Push page state if navigating from another page
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split(/[?#]/)[0]); // Clean URL
             showPage('mainPage');
        }
        // Always reset filters when explicitly clicking Home
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    });
    settingsBtn?.addEventListener('click', () => {
        // Push state for settings page
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    });
    profileBtn?.addEventListener('click', () => {
        openPopupAndPushState('profileSheet', 'sheet'); // Use specific function
        updateActiveNav('profileBtn');
    });
    cartBtn?.addEventListener('click', () => {
        renderCart(); // Render cart content before opening
        openPopupAndPushState('cartSheet', 'sheet');
        updateActiveNav('cartBtn');
    });
    categoriesBtn?.addEventListener('click', () => {
        renderCategoriesSheetUI(navigateToFilter); // Render categories before opening
        openPopupAndPushState('categoriesSheet', 'sheet');
        updateActiveNav('categoriesBtn');
    });

    // Header Back Button
    document.getElementById('headerBackBtn')?.addEventListener('click', () => history.back());

    // Popup Closing
    sheetOverlay?.addEventListener('click', closeCurrentPopup);
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.addEventListener('click', (e) => { // Close modal on outside click
        if (e.target.classList.contains('modal') && e.target.style.display === 'block') {
            closeCurrentPopup();
        }
    });

    // Search Input
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
    searchInput?.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        if (clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    });
    clearSearchBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' }); // Trigger filter update with empty search
    });

    // Subpage Search (Detail Page)
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn?.dataset.id || 'all';
            await renderProductsOnDetailPageData(subCatId, subSubCatId, term, appActions); // Use data-renderer function
        }
    }, 500);

    subpageSearchInput?.addEventListener('input', () => {
        const searchTerm = subpageSearchInput.value;
        if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSubpageSearch(searchTerm);
    });
    subpageClearSearchBtn?.addEventListener('click', () => {
        if (subpageSearchInput) subpageSearchInput.value = '';
        if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';
        debouncedSubpageSearch(''); // Trigger search with empty term
    });


    // Settings Page Actions
    document.getElementById('settingsFavoritesBtn')?.addEventListener('click', () => {
        renderFavoritesPage(); // Render content before opening
        openPopupAndPushState('favoritesSheet', 'sheet');
    });
    settingsAdminLoginBtn?.addEventListener('click', () => openPopupAndPushState('loginModal', 'modal'));
    settingsLogoutBtn?.addEventListener('click', async () => {
        await signOut(auth); // Auth state change will handle UI updates
        showNotification(t('logout_success'), 'success');
    });
    contactToggle?.addEventListener('click', () => { // Toggle social media links visibility
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container?.classList.toggle('open');
        chevron?.classList.toggle('open');
    });
    termsAndPoliciesBtn?.addEventListener('click', () => {
        renderPoliciesUI(); // Render content before opening
        openPopupAndPushState('termsSheet', 'sheet');
    });
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate);

     // PWA Install Button
     const installAppBtn = document.getElementById('installAppBtn');
     if (installAppBtn) {
         installAppBtn.addEventListener('click', async () => {
             if (state.deferredPrompt) {
                 installAppBtn.style.display = 'none'; // Hide button after prompt
                 state.deferredPrompt.prompt();
                 const { outcome } = await state.deferredPrompt.userChoice;
                 console.log(`User response to the install prompt: ${outcome}`);
                 state.deferredPrompt = null; // Clear the saved prompt
             }
         });
         // Hide button initially if prompt hasn't been saved yet
         if (!state.deferredPrompt) {
            installAppBtn.style.display = 'none';
         }
     }


    // Login Form
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        const loginButton = loginForm.querySelector('button[type="submit"]');
        if (!email || !password || !loginButton) return;

        loginButton.disabled = true;
        loginButton.textContent = t('logging_in', {default: '...چوونەژوورەوە'});

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle UI changes and admin logic loading
        } catch (error) {
            console.error("Login failed:", error);
            showNotification(t('login_error'), 'error');
            loginButton.disabled = false;
            loginButton.textContent = t('login_button');
        } finally {
             // Reset button state slightly later if login succeeds (handled by auth state change)
             // If login fails, enable immediately
             if(!auth.currentUser || auth.currentUser.uid !== "xNjDmjYkTxOjEKURGP879wvgpcG3") { // Quick check, might not be fully accurate sync
                 loginButton.disabled = false;
                 loginButton.textContent = t('login_button');
             }
        }
    });

    // Profile Form Submission
    profileForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfile(); // Use action from user-actions module
    });

    // Language Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
            // Re-render relevant content after language change
            renderHomePageContent(appActions); // Re-render home potentially
            // Or trigger a refresh based on current view
            // applyFilterState(history.state || { category: 'all' });
             // Close settings page or popup if open? Optional.
             // closeCurrentPopup();
        };
    });

     // Header Notification Button
     notificationBtn?.addEventListener('click', () => {
         renderUserNotificationsUI(); // Render content before opening
         openPopupAndPushState('notificationsSheet', 'sheet');
     });

      // Admin Product Form Category/Subcategory Change Listeners (if elements exist)
      productCategorySelect?.addEventListener('change', async (e) => {
         // Need access to AdminLogic functions, call via global if necessary
         if (window.AdminLogic?.populateSubcategoriesDropdown) {
             await window.AdminLogic.populateSubcategoriesDropdown(e.target.value);
         }
          if (window.AdminLogic?.populateSubSubcategoriesDropdown) {
             await window.AdminLogic.populateSubSubcategoriesDropdown(null, null); // Clear sub-sub
         }
     });

     productSubcategorySelect?.addEventListener('change', async (e) => {
         const mainCatId = productCategorySelect?.value;
         if (window.AdminLogic?.populateSubSubcategoriesDropdown) {
             await window.AdminLogic.populateSubSubcategoriesDropdown(mainCatId, e.target.value);
         }
     });


}

// --- Initialization ---

/**
 * Initializes the core application logic after DOM content is loaded and persistence is checked.
 */
async function initializeAppLogic() {
    // Ensure slider interval state object exists
    if (!state.sliderIntervals) state.sliderIntervals = {};

    // Fetch initial categories
    const categoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
    try {
        const snapshot = await getDocs(categoriesQuery); // Use getDocs for initial load
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: 'هەموو', name_ku_badini: 'هەمی', name_ar:'الكل' }, ...fetchedCategories]; // Add 'All' category data
         // Update UI elements dependent on categories (dropdowns, buttons)
         if (window.AdminLogic?.updateAdminCategoryDropdowns) { // Ensure admin logic exists if needed
            window.AdminLogic.updateAdminCategoryDropdowns();
            window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Update shortcut dropdowns too
        }
    } catch (error) {
        console.error("Failed to fetch initial categories:", error);
         // Handle error, maybe show a message or retry?
         state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: 'هەموو', name_ku_badini: 'هەمی', name_ar:'الكل' }]; // Provide default 'All'
    }


    // Setup UI and initial state AFTER categories are likely loaded
    updateCartCount();
    setupEventListeners(); // Setup main interaction listeners
    setupScrollObserver((searchTerm, isNew) => searchProductsInFirestore(searchTerm, isNew, appActions, () => renderHomePageContent(appActions))); // Setup infinite scroll
    setLanguage(state.currentLanguage); // Apply initial language
    renderContactLinksData(); // Fetch and display static contact links (social media)
    checkNewAnnouncements(); // Check for notification badge
    setupGpsButton(); // Enable GPS button in profile
    setupServiceWorkerUpdate(); // Setup SW update listener

    handleInitialPageLoad(); // Parse URL and set initial view/filters

    // Show welcome message only on first visit (after other UI setup)
    if (!localStorage.getItem('hasVisited')) {
        setTimeout(() => openPopup('welcomeModal', 'modal'), 500); // Slight delay
        localStorage.setItem('hasVisited', 'true');
    }

}

/**
 * Main initialization function. Enables persistence then starts app logic.
 */
function init() {
    console.log("App initializing...");
    // Attempt to enable offline persistence
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            } else {
                 console.error("Error enabling persistence:", err);
            }
        })
        .finally(() => {
            // Initialize core app logic regardless of persistence success/failure
            initializeAppLogic();
        });
}

// --- Global Admin Tools Setup ---
// Expose necessary functions/variables needed by admin.js
window.globalAdminTools = {
    // Firebase services/functions needed by admin
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    // UI/Helper functions needed by admin
    showNotification, t, openPopup, closeCurrentPopup,
    // Data/State functions needed by admin
    searchProductsInFirestore: (term, isNew) => searchProductsInFirestore(term, isNew, appActions, () => renderHomePageContent(appActions)), // Ensure actions are passed
    clearProductCache: () => { // Function to clear cache AND home UI
         console.log("Product cache and home page cleared due to admin action.");
         state.productCache = {};
         const homeContainer = document.getElementById('homePageSectionsContainer');
         if (homeContainer) homeContainer.innerHTML = ''; // Force re-render on next view
         // If currently on home, trigger re-render
         if (document.getElementById('mainPage')?.classList.contains('page-active') && !state.currentSearch && state.currentCategory === 'all') {
             renderHomePageContent(appActions);
         }
    },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide live categories array
    getCurrentLanguage: () => state.currentLanguage, // Provide current language
};


// Start the application initialization process on DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);
