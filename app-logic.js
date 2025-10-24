// app-logic.js (ناڤکۆکا بەرنامەی / رێکخەرێ سەرەکی - وەشانی نوو)
// بەرپرسیارەتی: دەستپێکرنا بەرنامەی, دانانا Event Listeners, کارێن PWA,
// کونترۆلکرنا Navigation و History, کونترۆلکرنا Authentication,
// رێکخستنا بانگکرنا فەنکشنان ژ moduleên دی.

// --- Imports from Setup ---
import {
    app, auth, db, messaging, // Firebase services
    state, // Global state
    // Collections (maybe needed for admin tools export)
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    // DOM Elements (only those directly needed for event listeners here)
    loginModal, searchInput, clearSearchBtn, loginForm, profileForm,
    homeBtn, settingsBtn, profileBtn, cartBtn, categoriesBtn, notificationBtn,
    termsAndPoliciesBtn, sheetOverlay, // for closing popups
    subpageSearchInput, subpageClearSearchBtn, // Subpage search
    headerBackBtn // Back button in header
} from './app-setup.js';

// --- Imports from Firebase ---
import {
    signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where,
    startAfter, addDoc, runTransaction // Keep needed ones for globalAdminTools
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
    getToken, onMessage
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- Imports from New Modules ---
import {
    t, setLanguage, closeAllPopupsUI, openPopupUI, showPageUI,
    updateHeaderView, updateActiveNav, showNotification, updateAdminUI,
    showNotificationBadge, createProductImageInputs // UI functions
} from './ui-manager.js';
import {
    searchProductsInFirestore, renderHomePageContent, fetchAndUpdateCategories,
    renderSubSubcategoriesOnDetailPage, renderProductsOnDetailPage // Data rendering
} from './data-renderer.js';
import {
    addToCart, updateQuantity, removeFromCart, renderCart, generateOrderMessage, renderCartActionButtons, // Cart
    isFavorite, toggleFavorite, renderFavoritesPage, // Favorites
    saveProfile, // Profile
    checkNewAnnouncements, renderUserNotifications, // Notifications
    renderPolicies // Policies
} from './user-actions.js';

// --- Utility Functions ---

function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- Navigation and History Management ---

/**
 * Saves the current scroll position before opening a popup or navigating.
 */
function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state (not popups or other pages)
    const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
    if (mainPageActive && currentState && !currentState.type) { // state.type exists for popups and pages
        // Update the current history state with the scroll position
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

/**
 * Closes the current popup by going back in history or directly closing UI.
 */
function closeCurrentPopup() {
    // Check if the current state represents a popup
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Let popstate handle the UI closing
    } else {
        closeAllPopupsUI(); // Fallback if history state is not a popup
    }
}

/**
 * Opens a popup (modal or sheet) and pushes its state to the history.
 * @param {string} id - The ID of the popup element.
 * @param {string} [type='sheet'] - 'sheet' or 'modal'.
 */
function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before changing state
    openPopupUI(id, type); // Show the UI element

    // Push state AFTER showing the UI
    history.pushState({ type: type, id: id }, '', `#${id}`);

    // Trigger content rendering *after* opening the UI
    // (This prevents trying to render into a hidden element)
    switch (id) {
        case 'cartSheet':
            renderCart();
            updateActiveNav('cartBtn'); // Set nav active state
            break;
        case 'favoritesSheet':
            renderFavoritesPage();
            // No specific nav button for favorites sheet itself
            break;
        case 'categoriesSheet':
            // renderCategoriesSheet is called by setLanguage or fetchAndUpdateCategories
            updateActiveNav('categoriesBtn');
            break;
        case 'notificationsSheet':
            renderUserNotifications();
            // No specific nav button
            break;
        case 'termsSheet':
            renderPolicies();
            // No specific nav button
            break;
        case 'profileSheet':
            // Populate profile form fields if needed
            const nameInput = document.getElementById('profileName');
            const addressInput = document.getElementById('profileAddress');
            const phoneInput = document.getElementById('profilePhone');
            if (nameInput) nameInput.value = state.userProfile?.name || '';
            if (addressInput) addressInput.value = state.userProfile?.address || '';
            if (phoneInput) phoneInput.value = state.userProfile?.phone || '';
            updateActiveNav('profileBtn');
            break;
        // Modals like loginModal, welcomeModal, productFormModal don't need specific rendering triggers here
    }
}

/**
 * Shows a specific page and pushes its state to the history.
 * @param {string} pageId - The ID of the page element.
 * @param {string} [pageTitle=''] - The title for the header (if not main page).
 * @param {object} [additionalState={}] - Extra data to store in history state (e.g., category IDs for detail page).
 */
function showPage(pageId, pageTitle = '', additionalState = {}) {
     saveCurrentScrollPosition(); // Save scroll before changing state
     showPageUI(pageId, pageTitle); // Show the page UI

     // Push state AFTER showing the UI
     const historyState = { type: 'page', id: pageId, title: pageTitle, ...additionalState };
     // Construct hash for URL consistency
     const hash = pageId === 'mainPage' ? '' : `#${pageId}`; // Keep URL clean for main page
      // Use replaceState for the very first load to avoid duplicate entry, push otherwise?
      // Let's use pushState generally for page navigation. handleInitialPageLoad uses replaceState.
     history.pushState(historyState, '', `${window.location.pathname.split('?')[0]}${hash}${window.location.search}`); // Preserve query params for main page if any? No, reset search/filter on page change.
}


/**
 * Applies filter/search state to the application. Fetches and renders products.
 * @param {object} filterState - Object containing category, subcategory, search, scroll.
 * @param {boolean} [fromPopState=false] - Whether this call originates from a popstate event.
 */
async function applyFilterState(filterState, fromPopState = false) {
    // Update global state
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update UI elements reflecting the state
    if (searchInput) searchInput.value = state.currentSearch;
    if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Re-render category buttons to show active state
    renderMainCategories(); // Renders main categories with active state
    // renderSubcategories(state.currentCategory); // This might be redundant if searchProducts handles rendering

    // Fetch and render products based on the new state
    await searchProductsInFirestore(state.currentSearch, true); // Trigger new search

    // Restore scroll position if navigating via history back/forward
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Delay slightly to allow content to render before scrolling
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
         // Scroll to top for new filter/search actions (unless handled by showPageUI)
         // Check if main page is active before scrolling to top
         const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
         if(mainPageActive) {
             window.scrollTo({ top: 0, behavior: 'smooth' });
         }
    }
}

/**
 * Updates the current filter/search state and pushes it to browser history.
 * @param {object} newState - Object containing changes (e.g., { category: 'newId', search: '' }).
 */
async function navigateToFilter(newState) {
    // Save current scroll position associated with the *old* state before navigating
    saveCurrentScrollPosition(); // This replaces the old state with scroll info

    // Get the current state (which now includes scroll) and merge with new changes
    const currentState = history.state || {}; // Ensure state exists
    const finalState = {
        category: currentState.category || 'all',
        subcategory: currentState.subcategory || 'all',
        subSubcategory: currentState.subSubcategory || 'all',
        search: currentState.search || '',
        ...newState, // Apply incoming changes
        scroll: 0 // Reset scroll for the new state
     };

    // --- Update URL Query Parameters ---
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    // Only include sub/subsub if they are selected AND the parent is selected
    if (finalState.subcategory && finalState.subcategory !== 'all' && finalState.category !== 'all') params.set('subcategory', finalState.subcategory);
     if (finalState.subSubcategory && finalState.subSubcategory !== 'all' && finalState.subcategory !== 'all' && finalState.category !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`; // Clean URL if no params

    // --- Push New State to History ---
    // Only push if URL or state actually changes to prevent unnecessary entries
     const currentUrl = `${window.location.pathname}${window.location.search}`;
     // Simple state comparison (might need deeper comparison for complex states)
     const stateChanged = JSON.stringify(finalState) !== JSON.stringify({...currentState, scroll: 0}); // Compare excluding scroll

     if (newUrl !== currentUrl || stateChanged) {
        history.pushState(finalState, '', newUrl);
     } else {
         // If only scroll changed (handled by replaceState), or nothing changed, don't push.
         // If state is identical but we want to ensure re-render, maybe use replaceState?
         // For now, assume no push needed if URL and state content are the same.
     }


    // --- Apply the New State ---
    await applyFilterState(finalState);
}

/**
 * Handles browser back/forward navigation (popstate event).
 */
async function handlePopState(event) {
    closeAllPopupsUI(); // Close any open popups when navigating history
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            // Restore a specific page view
            let pageTitle = popState.title;
            // Special handling to refetch title for detail page if needed
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                     const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         const subCat = subCatSnap.data();
                         pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                         // Update the state's title retroactively if needed
                         // history.replaceState({ ...popState, title: pageTitle }, ''); // Optional
                     }
                 } catch (e) { console.error("Could not refetch title on popstate", e); }
             }
            showPageUI(popState.id, pageTitle); // Show the page UI
            // If navigating back *to* the subcategory detail page, render its content
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                // We need to re-render the content based on the stored IDs
                 await renderSubSubcategoriesOnDetailPage(popState.mainCatId, popState.subCatId);
                 // Determine current sub-sub filter (might need to store/retrieve this too or default)
                 // Let's default to 'all' and no search when navigating back
                 document.getElementById('subpageSearchInput').value = ''; // Reset search
                 document.getElementById('subpageClearSearchBtn').style.display = 'none';
                 await renderProductsOnDetailPage(popState.subCatId, 'all', '');
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Restore a popup view (UI only, content rendering might need re-triggering if complex)
             openPopupUI(popState.id, popState.type);
             // Re-render content if necessary when restoring popups via history
             switch (popState.id) {
                 case 'cartSheet': renderCart(); updateActiveNav('cartBtn'); break;
                 case 'favoritesSheet': renderFavoritesPage(); break;
                 case 'categoriesSheet': /* renderCategoriesSheet(); */ updateActiveNav('categoriesBtn'); break; // Already rendered by language/fetch
                 case 'notificationsSheet': renderUserNotifications(); break;
                 case 'termsSheet': renderPolicies(); break;
                 case 'profileSheet': updateActiveNav('profileBtn'); break; // Form values restored by browser typically
                 case 'productDetailSheet':
                      // Might need to re-fetch/re-render product details if state isn't preserved perfectly
                      // For simplicity, we assume the DOM state was sufficient or user accepts slight inconsistency.
                      // Or, store product ID in state and re-call showProductDetailsUI.
                     console.warn("Product detail sheet restored via history; content might not be perfectly synced.");
                     break;
             }
        } else {
            // Restore a filter/search state on the main page
            showPageUI('mainPage'); // Ensure main page is visible
            await applyFilterState(popState, true); // Apply the state, indicating it's from popstate
        }
    } else {
        // No state, default to main page with default filters
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPageUI('mainPage');
        await applyFilterState(defaultState);
    }
}

/**
 * Handles the initial page load, parsing URL hash and query parameters.
 */
async function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    let initialPageState = null;
    let initialPopupState = null;
    let initialFilterState = {
        category: params.get('category') || 'all',
        subcategory: params.get('subcategory') || 'all',
         subSubcategory: params.get('subSubcategory') || 'all', // Get subsubcategory
        search: params.get('search') || '',
        scroll: 0
    };

    // Determine initial page based on hash
    if (hash === 'settingsPage') {
        initialPageState = { type: 'page', id: 'settingsPage', title: t('settings_title') };
    } else if (hash.startsWith('subcategory_')) {
         const ids = hash.split('_');
         const mainCatId = ids[1];
         const subCatId = ids[2];
         // Fetch title asynchronously
         let pageTitle = 'Details'; // Default title
         try {
             const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
             const subCatSnap = await getDoc(subCatRef);
             if (subCatSnap.exists()) {
                 const subCat = subCatSnap.data();
                 pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
             }
         } catch(e) { console.error("Error fetching initial detail page title:", e); }

         initialPageState = { type: 'page', id: 'subcategoryDetailPage', title: pageTitle, mainCatId: mainCatId, subCatId: subCatId };
    } else {
        // Default to main page filters, check if hash corresponds to a popup
        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                initialPopupState = { type: isSheet ? 'sheet' : 'modal', id: hash };
            }
        }
    }

    // Replace history: Set initial state without creating a new entry
    if (initialPageState) {
        history.replaceState(initialPageState, '', `${window.location.pathname}${hash ? '#' + hash : ''}`);
        showPageUI(initialPageState.id, initialPageState.title);
         // Render content for detail page if loaded directly
         if (initialPageState.id === 'subcategoryDetailPage') {
              await renderSubSubcategoriesOnDetailPage(initialPageState.mainCatId, initialPageState.subCatId);
              await renderProductsOnDetailPage(initialPageState.subCatId, 'all', ''); // Default to all, no search
         }
    } else {
        // If not a specific page, it's the main page with filters/popups
        history.replaceState(initialFilterState, '', `${window.location.pathname}${window.location.search}${initialPopupState ? '#' + initialPopupState.id : ''}`);
        showPageUI('mainPage');
        await applyFilterState(initialFilterState); // Apply filters/search
        if (initialPopupState) {
            openPopup(initialPopupState.id, initialPopupState.type); // Open popup AFTER applying filters
        }
    }

    // Handle direct product link ?product=PRODUCT_ID
    const productId = params.get('product');
    if (productId && !initialPageState && !initialPopupState) { // Only if not loading another page/popup
        // Delay slightly to ensure main page content might load first
        setTimeout(() => {
            // Find product in state or fetch if needed (will be handled by showProductDetails logic)
             // We need a function to get product details, let's assume it exists/will be added
             // For now, just log it. Need a getProductDetails(id) function.
             console.log(`Need to show details for product: ${productId}`);
             // showProductDetailsById(productId); // This function needs to fetch then call showProductDetailsUI
        }, 500);
    }
}


// --- Authentication ---

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // !! IMPORTANT: Replace with your actual Admin UID !!
    const isAdmin = user && user.uid === adminUID;

    sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false'); // Update session storage
    updateAdminUI(isAdmin); // Update UI based on admin status

    if (isAdmin) {
        console.log("Admin logged in.");
        // Dynamically load and initialize admin.js if not already done
        if (!window.AdminLogic?.listenersAttached) { // Check if already initialized
            try {
                 // Ensure DOM is ready before initializing admin logic that manipulates it
                 if (document.readyState === 'complete' || document.readyState === 'interactive') {
                     await import('./admin.js'); // Dynamically import admin logic
                     if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                         window.AdminLogic.initialize();
                     } else {
                          console.error("AdminLogic.initialize function not found after import.");
                     }
                 } else {
                      document.addEventListener('DOMContentLoaded', async () => {
                          await import('./admin.js');
                          if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                              window.AdminLogic.initialize();
                          } else {
                               console.error("AdminLogic.initialize function not found after import.");
                          }
                      });
                 }

            } catch (error) {
                console.error("Failed to load or initialize admin.js:", error);
            }
        }
        // Close login modal if it was open
        if (loginModal && loginModal.style.display === 'block') {
             closeCurrentPopup();
        }
    } else {
        console.log("User logged out or not admin.");
        // Deinitialize admin logic if it exists
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
         // Ensure non-admin users are signed out if they somehow got authenticated
         if (user) {
             console.log("Signing out non-admin user.");
             await signOut(auth);
         }
    }
     // Re-render products in case admin status changed edit/delete visibility
     // Only re-render if the main product container is visible
     const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
     if (mainPageActive) {
         // This might cause a full re-fetch if not careful.
         // A lighter approach might be to just toggle visibility of existing buttons.
         // For now, let's just update the UI state which toggles visibility.
         // updateAdminUI(isAdmin); // Already called above
     }
});

// --- PWA Features ---

function setupPWAFeatures() {
    // Before Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); // Prevent mini-infobar
        state.deferredPrompt = e; // Save the event
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) {
            installBtn.style.display = 'flex'; // Show install button in settings
        }
        console.log('`beforeinstallprompt` event fired.');
    });

    // Service Worker Registration and Update Handling
    if ('serviceWorker' in navigator) {
        const updateNotificationElement = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered.');

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New worker is waiting, show update prompt
                        if(updateNotificationElement) updateNotificationElement.classList.add('show');
                    }
                });
            });

            if(updateNowBtn && registration.waiting) { // Handle case where update found before listener attached
                updateNotificationElement?.classList.add('show');
            }

            if(updateNowBtn) {
                updateNowBtn.addEventListener('click', () => {
                     // Ensure there's a waiting worker before sending message
                    if (registration.waiting) {
                         registration.waiting.postMessage({ action: 'skipWaiting' });
                    } else {
                         console.log("No waiting service worker found to activate.");
                          updateNotificationElement?.classList.remove('show'); // Hide prompt if no worker
                    }
                });
            }

        }).catch(err => console.error('Service Worker registration failed:', err));

        // Reload page when new worker takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New Service Worker activated. Reloading...');
            window.location.reload();
        });
    }

    // Firebase Messaging Setup
    if (messaging) {
        requestNotificationPermission(); // Ask for permission on load (or move trigger elsewhere)
        // Handle foreground messages
        onMessage(messaging, (payload) => {
            console.log('Foreground Message received: ', payload);
            const title = payload.notification?.title || 'Notification';
            const body = payload.notification?.body || '';
            showNotification(`${title}: ${body}`); // Show using app's notification system
            showNotificationBadge(true); // Show badge indicator
        });
    }
}

/**
 * Requests permission for notifications and saves FCM token if granted.
 */
async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            // Get token
             const currentToken = await getToken(messaging, {
                 vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
             });
             if (currentToken) {
                 console.log('FCM Token:', currentToken);
                 await saveTokenToFirestore(currentToken); // Save token
             } else {
                 console.log('No registration token available. Request permission.');
             }
        } else {
            console.log('Notification permission denied.');
            showNotification(t('notification_permission_denied', {default:'مۆڵەتی ئاگەداری ڕەتکرایەوە'}), 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting notification permission: ', error);
    }
}

/**
 * Saves the FCM device token to Firestore.
 * @param {string} token - The FCM token.
 */
async function saveTokenToFirestore(token) {
    try {
        const tokensCollectionRef = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy checking/updates
        await setDoc(doc(tokensCollectionRef, token), {
            createdAt: Date.now(),
            // Add any other relevant info, like user agent, last updated time etc.
            userAgent: navigator.userAgent
        }, { merge: true }); // Use merge to update timestamp if token already exists
        console.log('Token saved/updated in Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}


// --- Event Listeners Setup ---

function setupEventListeners() {
    // --- Navigation ---
    if (homeBtn) homeBtn.onclick = async () => {
         // Navigate home - clears filters/search
         if (document.getElementById('mainPage')?.classList.contains('page-active')) {
              // If already on main page, just reset filters
               await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
         } else {
             // If on another page, navigate to main page first (history handled by showPage)
              showPage('mainPage'); // This pushes history state
              // Apply default filters AFTER navigating
              await applyFilterState({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' }); // This applies state but doesn't push history again
         }
    };
    if (settingsBtn) settingsBtn.onclick = () => {
         showPage('settingsPage', t('settings_title'));
    };
    if (headerBackBtn) headerBackBtn.onclick = () => {
         history.back(); // Use browser history to go back
    };
    window.addEventListener('popstate', handlePopState); // Main history handler

    // --- Popup Triggers ---
    if (profileBtn) profileBtn.onclick = () => openPopup('profileSheet');
    if (cartBtn) cartBtn.onclick = () => openPopup('cartSheet');
    if (categoriesBtn) categoriesBtn.onclick = () => openPopup('categoriesSheet');
    if (notificationBtn) notificationBtn.onclick = () => openPopup('notificationsSheet');
    if (termsAndPoliciesBtn) termsAndPoliciesBtn.onclick = () => openPopup('termsSheet');
    // Admin login trigger
    const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
    if(settingsAdminLoginBtn) settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    // Favorites trigger from settings
    const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn');
    if(settingsFavoritesBtn) settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');


    // --- Popup Closing ---
    if (sheetOverlay) sheetOverlay.onclick = closeCurrentPopup;
    // Add listeners to all close buttons within popups
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    // Close modal if clicking outside content
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') && e.target.style.display === 'block') {
             closeCurrentPopup();
        }
    });

    // --- Forms ---
    if (loginForm) loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (!emailInput || !passwordInput) return;
        try {
            await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
            // onAuthStateChanged will handle UI updates and admin logic init
        } catch (error) {
            console.error("Login failed:", error);
            showNotification(t('login_error', {default:'ئیمەیڵ یان وشەی نهێنی هەڵەیە'}), 'error');
        }
    };
    if (profileForm) profileForm.onsubmit = (e) => {
        e.preventDefault();
        saveProfile(); // Call action from user-actions module
    };

    // --- Search ---
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
    if (searchInput) searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        if (clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };
    if (clearSearchBtn) clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' }); // Trigger search with empty term
    };
     // Subpage Search
     const debouncedSubpageSearch = debounce(async (term) => {
         // Find which subcategory detail page is active and its context
         const detailPage = document.getElementById('subcategoryDetailPage');
         if (detailPage?.classList.contains('page-active')) {
             const hash = window.location.hash.substring(1); // e.g., #subcategory_mainCatId_subCatId
             if (hash.startsWith('subcategory_')) {
                 const ids = hash.split('_');
                 const subCatId = ids[2];
                 const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
                 const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.subSubcategoryId || 'all') : 'all';
                 await renderProductsOnDetailPage(subCatId, subSubCatId, term); // Re-render products for this page
             }
         }
     }, 500);
     if(subpageSearchInput) subpageSearchInput.oninput = () => {
         const searchTerm = subpageSearchInput.value;
         if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
         debouncedSubpageSearch(searchTerm);
     };
      if(subpageClearSearchBtn) subpageClearSearchBtn.onclick = () => {
          subpageSearchInput.value = '';
          subpageClearSearchBtn.style.display = 'none';
          debouncedSubpageSearch('');
      };

    // --- Language Selection ---
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            const newLang = btn.dataset.lang;
            if (newLang !== state.currentLanguage) {
                setLanguage(newLang); // Set language and update static text
                // Re-fetch/re-render dynamic content based on new language
                searchProductsInFirestore(state.currentSearch, true); // Re-run search/render home
                 // Re-render open popups if their content is language-dependent
                 if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart();
                 if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage();
                 if (document.getElementById('notificationsSheet')?.classList.contains('show')) renderUserNotifications();
                 if (document.getElementById('termsSheet')?.classList.contains('show')) renderPolicies();
                 // Re-fetch category title if detail page is active
                 const detailPage = document.getElementById('subcategoryDetailPage');
                 if(detailPage?.classList.contains('page-active') && history.state?.type === 'page' && history.state?.mainCatId && history.state?.subCatId) {
                      handlePopState({state: history.state}); // Re-run popstate handler to refresh title etc.
                 }
            }
        };
    });

    // --- PWA & Settings Actions ---
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.onclick = async () => {
        if (state.deferredPrompt) {
            installBtn.style.display = 'none';
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`PWA install prompt outcome: ${outcome}`);
            state.deferredPrompt = null;
        }
    };
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) enableNotificationsBtn.onclick = requestNotificationPermission;
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) forceUpdateBtn.onclick = async () => { // Make async
         if (confirm(t('update_confirm', {default: 'Dڵنیایت دەتەوێت ئەپەکە نوێ بکەیتەوە؟ هەموو کاشی ناو وێبگەڕەکەت دەسڕدرێتەوە.'}))) {
             try {
                 if ('serviceWorker' in navigator) {
                     const registrations = await navigator.serviceWorker.getRegistrations();
                     for (const registration of registrations) { await registration.unregister(); }
                     console.log('Service Workers unregistered.');
                 }
                 if (window.caches) {
                     const keys = await window.caches.keys();
                     await Promise.all(keys.map(key => window.caches.delete(key)));
                     console.log('All caches cleared.');
                 }
                 showNotification(t('update_success', {default: 'ئەپەکە بە سەرکەوتوویی نوێکرایەوە!'}), 'success');
                 setTimeout(() => window.location.reload(true), 1500); // Force reload
             } catch (error) {
                 console.error('Error during force update:', error);
                 showNotification(t('error_generic', {default:'هەڵەیەک ڕوویدا!'}), 'error');
             }
         }
    };
    // Logout button (Admin specific, but listener here is fine)
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    if(settingsLogoutBtn) settingsLogoutBtn.onclick = async () => {
        await signOut(auth);
        showNotification(t('logout_success', {default:'بە سەرکەوتوویی چوویتەدەرەوە'}), 'success');
        // onAuthStateChanged will handle UI updates
    };


    // --- Event Delegation for Dynamic Content ---
    // Add listeners to static parent elements

    // Main product container actions
    const mainProductsContainer = document.getElementById('productsContainer');
    if (mainProductsContainer) mainProductsContainer.addEventListener('click', handleProductCardAction);

    // Favorites container actions
    const favContainer = document.getElementById('favoritesContainer');
    if(favContainer) favContainer.addEventListener('click', handleProductCardAction);

     // Related products container actions
     const relContainer = document.getElementById('relatedProductsContainer');
     if(relContainer) relContainer.addEventListener('click', handleProductCardAction);

    // Cart item actions
    const cartContainer = document.getElementById('cartItemsContainer');
    if (cartContainer) cartContainer.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.closest('[data-action]')?.dataset.action;
        const productId = target.closest('[data-id]')?.dataset.id;

        if (productId) {
            if (action === 'increase-quantity') {
                updateQuantity(productId, 1);
            } else if (action === 'decrease-quantity') {
                updateQuantity(productId, -1);
            } else if (action === 'remove-from-cart') {
                removeFromCart(productId);
            }
        }
    });

    // Cart action buttons (Send order)
    const cartActionsContainer = document.getElementById('cartActions');
    if(cartActionsContainer) cartActionsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action="send-order"]');
        if (button) {
             const methodType = button.dataset.methodType;
             const methodValue = button.dataset.methodValue;
             const message = generateOrderMessage();
             if (!message) return;

             let link = '';
             const encodedMessage = encodeURIComponent(message);

             switch (methodType) {
                case 'whatsapp': link = `https://wa.me/${methodValue}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${methodValue}&text=${encodedMessage}`; break; // Needs testing
                case 'telegram': link = `https://t.me/${methodValue}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${methodValue}`; break;
                case 'url': link = methodValue; break; // Assume full URL provided
             }

             if (link) {
                 window.open(link, '_blank');
             } else {
                  console.warn(`Unsupported contact method type: ${methodType}`);
             }
        }
    });

    // Main category filter buttons
     const mainCatContainer = document.getElementById('mainCategoriesContainer');
     if(mainCatContainer) mainCatContainer.addEventListener('click', async (e) => {
         const button = e.target.closest('[data-action="filter-main-category"]');
         if (button) {
             const categoryId = button.dataset.categoryId;
             if (categoryId !== state.currentCategory) {
                 await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
             }
         }
     });

    // Categories sheet filter buttons
     const sheetCatContainer = document.getElementById('sheetCategoriesContainer');
     if(sheetCatContainer) sheetCatContainer.addEventListener('click', async (e) => {
         const button = e.target.closest('[data-action="filter-sheet-category"]');
         if (button) {
             const categoryId = button.dataset.categoryId;
              // Close popup first, then navigate
              closeCurrentPopup(); // This might trigger popstate, be careful
              // Use setTimeout to ensure navigation happens after popup closes visually
              setTimeout(async () => {
                   if (categoryId !== state.currentCategory) { // Check again in case state changed
                       await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                       showPageUI('mainPage'); // Ensure main page is active after filter
                   }
              }, 100); // Small delay
         }
     });

     // Subcategory detail page - sub-subcategory filter buttons
     const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
     if(subSubContainer) subSubContainer.addEventListener('click', async (e) => {
         const button = e.target.closest('[data-action="filter-subsubcategory"]');
         if (button) {
              const subSubcategoryId = button.dataset.subSubcategoryId;
              // Update active button state
              subSubContainer.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
              button.classList.add('active');
              // Re-render products for this filter
              const hash = window.location.hash.substring(1);
              if (hash.startsWith('subcategory_')) {
                  const ids = hash.split('_');
                  const subCatId = ids[2];
                  const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
                  await renderProductsOnDetailPage(subCatId, subSubcategoryId, currentSearch);
              }
         }
     });

    // Home page dynamic section actions (delegated)
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if(homeContainer) homeContainer.addEventListener('click', async (e) => {
        const productCardActionTarget = e.target.closest('.product-card[data-product-id]');
        const promoCardTarget = e.target.closest('.promo-card-grid-item[data-action="navigate-category"]');
        const brandTarget = e.target.closest('.brand-item[data-action="navigate-brand"]');
        const shortcutTarget = e.target.closest('.shortcut-card[data-action="navigate-shortcut"]');
        const seeAllTarget = e.target.closest('.see-all-link[data-action="navigate-see-all"]');
        const promoPrevBtn = e.target.closest('.promo-slider-btn.prev[data-action="promo-prev"]');
        const promoNextBtn = e.target.closest('.promo-slider-btn.next[data-action="promo-next"]');


        if (productCardActionTarget) {
             // Handle actions within product cards displayed on home page sections
             handleProductCardAction(e);
        } else if (promoPrevBtn || promoNextBtn) {
            // Handle promo slider navigation manually within home page sections
            const promoGrid = promoPrevBtn?.closest('.products-container') || promoNextBtn?.closest('.products-container');
            const layoutId = promoGrid?.id.replace('promoSliderLayout_', '');
            const intervalId = state.sliderIntervals ? state.sliderIntervals[layoutId] : null;

            if (promoGrid && layoutId) {
                // Find the sliderState associated with this element (needs adjustment - state might not be directly accessible)
                // This approach is difficult. It's better if createPromoCardElement attaches direct listeners.
                // Let's modify createPromoCardElement to attach its own prev/next listeners.
                console.warn("Promo slider prev/next clicked - delegation needs rework or direct listeners.");
                // Alternative: Re-render the specific slider on button click? Less efficient.
            }
        } else if (promoCardTarget && !e.target.closest('button')) { // Don't trigger category nav if clicking button
            const categoryId = promoCardTarget.dataset.categoryId;
            if (categoryId) {
                 await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                 document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (brandTarget) {
            const categoryId = brandTarget.dataset.categoryId;
            const subcategoryId = brandTarget.dataset.subcategoryId;
            if (subcategoryId && categoryId) {
                 showPage('subcategoryDetailPage', '', { mainCatId: categoryId, subCatId: subcategoryId });
                 // Render content after showing page
                  await renderSubSubcategoriesOnDetailPage(categoryId, subcategoryId);
                  await renderProductsOnDetailPage(subcategoryId, 'all', '');
            } else if (categoryId) {
                 await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
            }
        } else if (shortcutTarget) {
             const categoryId = shortcutTarget.dataset.categoryId || 'all';
             const subcategoryId = shortcutTarget.dataset.subcategoryId || 'all';
             const subSubcategoryId = shortcutTarget.dataset.subSubcategoryId || 'all';
             await navigateToFilter({ category: categoryId, subcategory: subcategoryId, subSubcategory: subSubcategoryId, search: '' });
        } else if (seeAllTarget) {
             const categoryId = seeAllTarget.dataset.categoryId;
             const subcategoryId = seeAllTarget.dataset.subcategoryId;
             // const subSubcategoryId = seeAllTarget.dataset.subSubcategoryId; // Not needed for see all link logic

             if (subcategoryId && categoryId) {
                  // Navigate to subcategory detail page
                  showPage('subcategoryDetailPage', '', { mainCatId: categoryId, subCatId: subcategoryId });
                  await renderSubSubcategoriesOnDetailPage(categoryId, subcategoryId);
                  await renderProductsOnDetailPage(subcategoryId, 'all', '');
             } else if (categoryId) {
                 // Navigate to main category filter on main page
                  await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
             }
        }
    });

     // Product Detail Sheet Actions (Slider Thumbnails & Add to Cart)
     const detailSheet = document.getElementById('productDetailSheet');
     if(detailSheet) detailSheet.addEventListener('click', (e) => {
         const target = e.target;
         const action = target.closest('[data-action]')?.dataset.action;
         const productId = target.closest('[data-product-id]')?.dataset.productId || sheetAddToCartBtn?.dataset.productId; // Get product ID

         if (action === 'select-thumbnail') {
              const index = parseInt(target.closest('[data-index]')?.dataset.index, 10);
              const imageContainer = document.getElementById('sheetImageContainer');
              const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
              const images = imageContainer?.querySelectorAll('img');
              const thumbnails = thumbnailContainer?.querySelectorAll('.thumbnail');

              if (!isNaN(index) && images && thumbnails && images.length === thumbnails.length && index < images.length) {
                   images.forEach(img => img.classList.remove('active'));
                   thumbnails.forEach(thumb => thumb.classList.remove('active'));
                   images[index].classList.add('active');
                   thumbnails[index].classList.add('active');
                   // Update prev/next button state if needed (store currentIndex globally?)
                   // For now, assume simple update is enough. Need `currentIndex` for prev/next.
              }
         } else if (action === 'slider-prev' || action === 'slider-next') {
              // This requires knowing the current index. It's better handled
              // if showProductDetailsUI attaches direct listeners with closure access to currentIndex.
              console.warn("Slider prev/next delegation needs rework or direct listeners.");
         } else if (action === 'add-to-cart-details' && productId) {
             addToCart(productId);
             closeCurrentPopup(); // Close details sheet after adding
         }
     });

}

/**
 * Handles clicks within a product card, delegating actions.
 * @param {Event} event - The click event.
 */
function handleProductCardAction(event) {
    const target = event.target;
    const card = target.closest('.product-card[data-product-id]');
    if (!card) return; // Click wasn't inside a valid product card

    const productId = card.dataset.productId;
    const actionElement = target.closest('[data-action]');
    const action = actionElement?.dataset.action;
    const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

    if (action === 'add-to-cart') {
        addToCart(productId);
        // --- Add visual feedback ---
        const button = actionElement;
        if (button && !button.disabled) {
            const originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            setTimeout(() => {
                button.innerHTML = `<i class="fas fa-check"></i>`; // Show checkmark briefly
                setTimeout(() => {
                    button.innerHTML = originalContent; // Restore original content
                    button.disabled = false;
                }, 1000); // Duration checkmark is shown
            }, 300); // Delay before showing checkmark
        }
        // --- End visual feedback ---
    } else if (isAdminNow && action === 'edit-product') {
        if (window.AdminLogic?.editProduct) {
             window.AdminLogic.editProduct(productId);
        } else { console.error("AdminLogic.editProduct not available."); }
    } else if (isAdminNow && action === 'delete-product') {
         if (window.AdminLogic?.deleteProduct) {
              window.AdminLogic.deleteProduct(productId);
         } else { console.error("AdminLogic.deleteProduct not available."); }
    } else if (action === 'toggle-favorite') {
        toggleFavorite(productId); // Handle favorite toggle
    } else if (action === 'share-product') {
         // Handle sharing
         const productNameElement = card.querySelector('.product-name');
         const productName = productNameElement ? productNameElement.textContent : t('this_product', {default:'ئەم کاڵایە'});
         const productUrl = `${window.location.origin}${window.location.pathname}?product=${productId}`; // Generate product URL
         const shareData = {
             title: productName,
             text: `${t('share_text', {default:'سەیری ئەم کاڵایە بکە'})}: ${productName}`,
             url: productUrl,
         };
         try {
             if (navigator.share) {
                 navigator.share(shareData)
                     .then(() => console.log('Product shared successfully'))
                     .catch((err) => {
                          if (err.name !== 'AbortError') { // Don't show error if user cancelled
                               console.error('Share failed:', err);
                               showNotification(t('share_error', {default:'هاوبەشیپێکردن سەرکەوتوو نەبوو'}), 'error');
                          }
                     });
             } else {
                 // Fallback: Copy link to clipboard
                  navigator.clipboard.writeText(productUrl).then(() => {
                      showNotification(t('link_copied', {default:'لینک کۆپی کرا'}), 'success');
                  }).catch(err => {
                       console.error('Failed to copy link:', err);
                       showNotification(t('copy_failed', {default:'کۆپیکردن سەرکەوتوو نەبوو'}), 'error');
                  });
             }
         } catch (err) { // Catch potential errors with navigator.share or clipboard
              console.error('General share/copy error:', err);
              showNotification(t('share_error', {default:'هاوبەشیپێکردن سەرکەوتوو نەبوو'}), 'error');
         }

    } else if (!action) { // If clicking card itself, not a specific action button
        // Show product details (requires fetching details first)
         console.log(`Need to show details for product: ${productId}`);
         // showProductDetailsById(productId); // Needs implementation
    }
}

// --- Initialization ---

async function initializeAppLogic() {
    console.log("Initializing app logic...");
    // Ensure state object is ready (though it should be from app-setup)
    if (!window.state) window.state = {};
    if (!state.sliderIntervals) state.sliderIntervals = {};

    setLanguage(state.currentLanguage); // Apply initial language early
    updateCartCountUI(); // Update cart badge count from localStorage
    checkNewAnnouncements(); // Start listening for notification badge updates
    setupEventListeners(); // Attach all core event listeners
    setupPWAFeatures(); // Set up Service Worker, Install Prompt, FCM
    setupGpsButton(); // Add GPS functionality to profile (listener attached in setupEventListeners)

    // Fetch essential initial data (categories)
    await fetchAndUpdateCategories();

    // Handle initial URL (hash, query params) AFTER categories are loaded
    await handleInitialPageLoad();

    // Show welcome message only on first visit (after initial load handled)
     if (!localStorage.getItem('hasVisited')) {
          setTimeout(() => { // Delay slightly
              openPopup('welcomeModal', 'modal');
              localStorage.setItem('hasVisited', 'true');
          }, 1500); // Show after 1.5 seconds
     }

     console.log("App logic initialization complete.");
}

function init() {
     // Show skeleton loader immediately while waiting for persistence/init
     renderSkeletonLoader();

    // Attempt to enable offline persistence FIRST
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Initialize after persistence setup
        })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Persistence failed: Multiple tabs open.');
            } else if (err.code === 'unimplemented') {
                console.warn('Persistence failed: Browser not supported.');
            } else {
                 console.error("Error enabling persistence:", err);
            }
            initializeAppLogic(); // Initialize anyway, just without persistence
        });
}


// --- Global Admin Tools Exposure ---
// Make necessary Firebase services and *some* core logic available for admin.js
// Keep this minimal - admin.js should ideally import its own dependencies if possible,
// but for simplicity in this structure, we expose them here.
window.globalAdminTools = {
    // Firebase Services/Functions needed by admin.js
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query,
    orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction, // Firestore
    // UI/Utility Functions needed by admin.js
    showNotification, t, openPopup, closeCurrentPopup, createProductImageInputs,
    // Core Logic functions needed by admin.js
    clearProductCache: () => { // Function to clear cache AND trigger re-render
         console.log("Product cache and home page cleared by admin action.");
         state.productCache = {};
         const homeContainer = document.getElementById('homePageSectionsContainer');
         if (homeContainer) homeContainer.innerHTML = ''; // Clear rendered home page
         // Re-run the main data fetch/render function for the current view
         searchProductsInFirestore(state.currentSearch, true);
     },
    // Category Data Access needed by admin.js
    getCategories: () => state.categories, // Provide current categories
    getCurrentLanguage: () => state.currentLanguage, // Provide current language
    // Editing Product State (simplistic approach)
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    // Collection References (if admin.js doesn't import them itself)
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection
};


// --- Start Application ---
document.addEventListener('DOMContentLoaded', init);