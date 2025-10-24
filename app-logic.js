// MODULE: app-logic.js (Formerly app-core.js)
// Handles core application initialization, event listeners, PWA features, navigation, and authentication state.

// --- Imports from Setup ---
import {
    db, auth, messaging, state, analytics, firebaseConfig, // Core Firebase and state
    loginModal, // DOM Elements needed for event listeners or direct manipulation here
    sheetOverlay,
    searchInput, clearSearchBtn, subpageSearchInput, subpageClearSearchBtn,
    notificationBadge, // For FCM badge update
    categoriesCollection, // Added categoriesCollection needed for onSnapshot listener
    // ... add any other DOM elements directly used ONLY in this core file
} from './app-setup.js';

// --- Firebase Service Imports ---
import { enableIndexedDbPersistence, doc, getDoc, collection, query, orderBy, getDocs, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Note: Added onSnapshot here
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- Imports from Other Modules ---
// Removed closeCurrentPopup from ui-manager import as it's defined and exported here now.
import { t, setLanguage, showPage, openPopup, closeAllPopupsUI, showNotification, updateActiveNav } from './ui-manager.js';
import { searchProductsInFirestore, renderMainCategories, renderSubcategories, showSubcategoryDetailPage, renderProductsOnDetailPage, showProductDetails } from './data-renderer.js'; // Added renderProductsOnDetailPage, showProductDetails
import { saveProfile, renderCart, renderFavoritesPage, renderCategoriesSheet, renderUserNotifications, renderPolicies, checkNewAnnouncements, saveTokenToFirestore, requestNotificationPermission, renderContactLinks } from './user-actions.js'; // Added renderContactLinks

// Debounce utility function
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Saves the current scroll position to the history state for the main page.
 */
export function saveCurrentScrollPosition() {
    const mainPage = document.getElementById('mainPage');
    if (mainPage?.classList.contains('page-active')) {
        const currentState = history.state || {}; // Get current state or initialize if null
        // Only save scroll if it's a main page filter state (not a popup/page state)
        if (!currentState.type) {
            history.replaceState({ ...currentState, scroll: window.scrollY }, '');
        }
    }
}

/**
 * Updates the header display (main search vs. subpage title/back button).
 * @param {string} pageId - The ID of the page being displayed.
 * @param {string} [title=''] - The title for subpage headers.
 */
export function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) return; // Exit if elements not found

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
        // Reset subpage search if navigating back to main page
        const subpageSearchInputEl = document.getElementById('subpageSearchInput');
        const subpageClearSearchBtnEl = document.getElementById('subpageClearSearchBtn');
        if (subpageSearchInputEl) subpageSearchInputEl.value = '';
        if (subpageClearSearchBtnEl) subpageClearSearchBtnEl.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title; // Set the title for the subpage
    }
}

/**
 * Closes the currently active popup based on history state or closes all if no state.
 * Needs to be EXPORTED.
 */
export function closeCurrentPopup() { // <-- Exported here
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Use history back to close popups managed by history state
    } else {
        closeAllPopupsUI(); // Fallback if no history state (imported from ui-manager)
    }
}

/**
 * Applies filter state (category, search, etc.) to the UI and fetches corresponding products.
 * @param {object} filterState - An object containing category, subcategory, search, scroll properties.
 * @param {boolean} [fromPopState=false] - Indicates if the state change is from browser history navigation.
 */
export async function applyFilterState(filterState, fromPopState = false) {
    // Update global state
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input UI
    const searchInputEl = document.getElementById('searchInput');
    const clearSearchBtnEl = document.getElementById('clearSearchBtn');
    if (searchInputEl) searchInputEl.value = state.currentSearch;
    if (clearSearchBtnEl) clearSearchBtnEl.style.display = state.currentSearch ? 'block' : 'none';

    // Re-render category buttons to show active state
    renderMainCategories(); // Assumes renderMainCategories is imported from data-renderer
    // Render subcategories based on the current main category
    await renderSubcategories(state.currentCategory); // Assumes renderSubcategories is imported from data-renderer

    // Fetch and render products based on the new state
    await searchProductsInFirestore(state.currentSearch, true); // True for new search/filter (from data-renderer)

    // Restore scroll position if navigating back/forward
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Delay slightly to allow content rendering
        setTimeout(() => window.scrollTo(0, filterState.scroll), 100);
    } else if (!fromPopState) {
        // Scroll to top for new filter actions
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Updates the browser history and triggers a state update for filtering/searching.
 * @param {object} newState - Object containing the new filter properties (category, search, etc.).
 */
export async function navigateToFilter(newState) {
    // Save current scroll position before navigating
    saveCurrentScrollPosition(); // Save scroll for the state we are leaving

    // Merge new state properties with existing ones, reset scroll for the new state
    const finalState = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        ...newState, // Overwrite with new properties
        scroll: 0 // New filter state starts at the top
    };

    // Construct URL query parameters based on the final state
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`; // New URL with query params

    // Push the new state and URL to the browser history
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state to the UI and fetch data
    await applyFilterState(finalState);
}


/**
 * Handles browser back/forward navigation (popstate event).
 * @param {PopStateEvent} event - The popstate event object.
 */
async function handlePopState(event) {
    closeAllPopupsUI(); // Close any open popups when navigating history
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            // Restore page state (e.g., settings page, subcategory detail page)
            let pageTitle = popState.title;
             // Refetch title for subcategory detail page if missing (e.g., after reload)
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                try {
                    const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    const subCatSnap = await getDoc(subCatRef);
                    if (subCatSnap.exists()) {
                        const subCat = subCatSnap.data();
                        pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                        // Update the state's title for future popstate events if needed
                        history.replaceState({ ...popState, title: pageTitle }, '');
                    }
                } catch (e) { console.error("Could not refetch title on popstate", e); }
            }
            showPage(popState.id, pageTitle);
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Reopen the corresponding popup
            openPopup(popState.id, popState.type);
        } else {
            // Assume it's a main page filter state
            showPage('mainPage'); // Ensure main page is visible
            applyFilterState(popState, true); // Apply filters and restore scroll (true for fromPopState)
        }
    } else {
        // No state found (e.g., initial load or manual URL change), go to default main page state
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
}

/**
 * Handles the initial page load, parsing URL hash and query parameters.
 */
async function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product'); // Check for direct product link

    let initialStateHandled = false;

    // Determine initial page based on hash
    if (hash.startsWith('subcategory_')) {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // Wait for categories to load before showing subcategory page
        // The actual rendering will be triggered by onSnapshot in initializeAppLogic checking the hash again
        initialStateHandled = true; // Mark as handled to prevent default main page load below
        showPage('subcategoryDetailPage'); // Show page structure, content loads later
    } else if (hash === 'settingsPage') {
        history.replaceState({ type: 'page', id: hash, title: t('settings_title') }, '', `#${hash}`);
        showPage(hash, t('settings_title'));
        initialStateHandled = true;
    }

    // If no specific page hash, handle main page filters/popups
    if (!initialStateHandled) {
        showPage('mainPage'); // Show main page by default
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Initial load starts at top
        };
        // Use replaceState for initial load so back button doesn't just remove query params
        history.replaceState(initialState, '', `${window.location.pathname}?${params.toString()}`);
        await applyFilterState(initialState); // Apply filters based on query params

        // Check if a popup hash exists (e.g., #cartSheet)
        const element = document.getElementById(hash);
        if (element && (element.classList.contains('bottom-sheet') || element.classList.contains('modal'))) {
            openPopup(hash, element.classList.contains('bottom-sheet') ? 'sheet' : 'modal');
        }
    }

    // If a product ID is in the URL, open its details after a short delay
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500); // showProductDetails is in data-renderer
    }
}


/**
 * Sets up core application event listeners.
 */
function setupEventListeners() {
    // --- Bottom Navigation ---
    document.getElementById('homeBtn').onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };
    document.getElementById('settingsBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };
    document.getElementById('profileBtn').onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    document.getElementById('cartBtn').onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    document.getElementById('categoriesBtn').onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };

    // --- Header Buttons ---
    document.getElementById('headerBackBtn').onclick = () => history.back();
    document.getElementById('notificationBtn').addEventListener('click', () => openPopup('notificationsSheet'));

    // --- Popup Close Mechanisms ---
    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // --- Search ---
    const searchInputEl = document.getElementById('searchInput');
    const clearSearchBtnEl = document.getElementById('clearSearchBtn');
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
    if (searchInputEl) {
        searchInputEl.oninput = () => {
            const searchTerm = searchInputEl.value;
            if (clearSearchBtnEl) clearSearchBtnEl.style.display = searchTerm ? 'block' : 'none';
            debouncedSearch(searchTerm);
        };
    }
    if (clearSearchBtnEl) {
        clearSearchBtnEl.onclick = () => {
            if (searchInputEl) searchInputEl.value = '';
            clearSearchBtnEl.style.display = 'none';
            navigateToFilter({ search: '' });
        };
    }
     // Subpage search logic
    const subpageSearchInputEl = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtnEl = document.getElementById('subpageClearSearchBtn');
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
    if (subpageSearchInputEl) {
        subpageSearchInputEl.oninput = () => {
            const searchTerm = subpageSearchInputEl.value;
            if (subpageClearSearchBtnEl) subpageClearSearchBtnEl.style.display = searchTerm ? 'block' : 'none';
            debouncedSubpageSearch(searchTerm);
        };
    }
     if (subpageClearSearchBtnEl) {
         subpageClearSearchBtnEl.onclick = () => {
             if (subpageSearchInputEl) subpageSearchInputEl.value = '';
             subpageClearSearchBtnEl.style.display = 'none';
             debouncedSubpageSearch('');
         };
     }

    // --- Settings Page Actions ---
    document.getElementById('settingsFavoritesBtn').onclick = () => openPopup('favoritesSheet');
    document.getElementById('settingsAdminLoginBtn').onclick = () => openPopup('loginModal', 'modal');
    document.getElementById('termsAndPoliciesBtn')?.addEventListener('click', () => openPopup('termsSheet'));
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate);
    document.getElementById('settingsLogoutBtn').onclick = async () => {
        await signOut(auth);
        showNotification(t('logout_success'), 'success');
    };
     document.getElementById('contactToggle').onclick = () => {
         const container = document.getElementById('dynamicContactLinksContainer');
         const chevron = document.querySelector('#contactToggle .contact-chevron');
         container?.classList.toggle('open');
         chevron?.classList.toggle('open');
     };


    // --- Forms ---
    document.getElementById('loginForm').onsubmit = handleLogin;
    document.getElementById('profileForm').onsubmit = (e) => { e.preventDefault(); saveProfile(); };

    // --- Language Buttons ---
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => setLanguage(btn.dataset.lang);
    });

    // --- PWA Install Button ---
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', handleInstallPrompt);
    }

    // --- History Navigation ---
    window.addEventListener('popstate', handlePopState);
}

/**
 * Handles the PWA installation prompt.
 */
async function handleInstallPrompt() {
    const installBtn = document.getElementById('installAppBtn');
    if (state.deferredPrompt) {
        if (installBtn) installBtn.style.display = 'none'; // Hide button after prompting
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null;
    }
}


/**
 * Handles admin login form submission.
 * @param {Event} e - The form submission event.
 */
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = loginButton.textContent;
    loginButton.disabled = true;
    loginButton.textContent = '...چوونەژوور';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Success handled by onAuthStateChanged
    } catch (error) {
        console.error("Login failed:", error);
        showNotification(t('login_error'), 'error');
        loginButton.disabled = false;
        loginButton.textContent = originalButtonText;
    }
}

/**
 * Handles forced update: unregisters service worker, clears caches, reloads page.
 */
async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            showNotification('...خەریکی نوێکردنەوەیە', 'success');

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

            setTimeout(() => {
                window.location.reload(true);
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

/**
 * Sets up Service Worker registration and update handling.
 */
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (updateNotification) updateNotification.classList.add('show');
                    }
                });
            });

            if (updateNowBtn) {
                updateNowBtn.addEventListener('click', () => {
                    if (registration.waiting) {
                        registration.waiting.postMessage({ action: 'skipWaiting' });
                    }
                });
            }

        }).catch(err => {
            console.error('Service Worker registration failed: ', err);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New Service Worker activated. Reloading page...');
            window.location.reload();
        });
    }
}

/**
 * Sets up Firebase Cloud Messaging.
 */
function setupFCM() {
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'New Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        if(notificationBadge) notificationBadge.style.display = 'block'; // Ensure badge exists
    });

    Notification.requestPermission().then(permission => {
         if (permission === 'granted') {
             getToken(messaging, { vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' }).then(currentToken => { // Replace with your VAPID key
                if (currentToken) {
                     console.log('FCM Token:', currentToken);
                     saveTokenToFirestore(currentToken);
                 } else {
                     console.log('No registration token available. Request permission.');
                 }
             }).catch(err => {
                 console.error('An error occurred while retrieving token. ', err);
             });
         }
     });
}

/**
 * Initializes the main application logic after DOM content is loaded and persistence is set up.
 */
async function initializeAppLogic() {
    console.log("Initializing App Logic...");
    if (!state.sliderIntervals) state.sliderIntervals = {};

    // Listen for category changes (moved inside init to ensure it runs once)
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, async (snapshot) => { // Keep reference to unsubscribe later if needed
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Add 'All' category dynamically, ensuring translations are ready
        state.categories = [{ id: 'all', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label', {}, 'ku_badini'), name_ar: t('all_categories_label', {}, 'ar'), icon: 'fas fa-th' }, ...fetchedCategories];

        // Handle initial page load only *once* after categories are first loaded
        if (!initializeAppLogic.initialLoadHandled) {
             initializeAppLogic.initialLoadHandled = true; // Flag to prevent re-running
             await handleInitialPageLoad();
             setLanguage(state.currentLanguage); // Apply language after initial load logic
         } else {
             // Subsequent updates: Just re-render category UI and potentially refresh data if category structure changes significantly
             renderMainCategories();
             renderCategoriesSheet();
         }

        // Always update admin dropdowns when categories change
        if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
            window.AdminLogic.updateAdminCategoryDropdowns?.();
            window.AdminLogic.updateShortcutCardCategoryDropdowns?.();
        }
    }, error => {
        console.error("Error fetching categories: ", error);
        // Handle error appropriately
    });
    initializeAppLogic.initialLoadHandled = false; // Initialize the flag


    // Setup remaining parts (should run only once during init)
    setupEventListeners();
    renderContactLinks();
    checkNewAnnouncements();
    // Consider moving showWelcomeMessage here if needed on first load
    setupServiceWorker();
    setupFCM();

    // Listen for Authentication state changes
    onAuthStateChanged(auth, async (user) => {
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // !! IMPORTANT: Replace with your actual Admin UID !!
        const isAdmin = user && user.uid === adminUID;

        if (isAdmin) {
            sessionStorage.setItem('isAdmin', 'true');
            if (!window.AdminLogic) {
                try {
                    // Use dynamic import for admin.js
                    const adminModule = await import('./admin.js');
                    // Ensure AdminLogic is attached to window or exported properly if needed elsewhere
                    if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                         window.AdminLogic.initialize();
                     } else if (adminModule.AdminLogic && typeof adminModule.AdminLogic.initialize === 'function') {
                         // If admin.js exports an object
                         window.AdminLogic = adminModule.AdminLogic; // Make it global if needed by UI elements
                         window.AdminLogic.initialize();
                     } else { throw new Error('AdminLogic loaded but initialize function not found.'); }
                } catch (err) {
                    console.error("Failed to load or initialize admin.js:", err);
                    showNotification('Error loading admin tools', 'error');
                    sessionStorage.removeItem('isAdmin');
                    signOut(auth);
                }
            } else if (typeof window.AdminLogic.initialize === 'function') {
                 window.AdminLogic.initialize(); // Initialize if already loaded
            }
            if (loginModal?.style.display === 'block') { // Check if loginModal exists
                 closeCurrentPopup();
            }
        } else {
            sessionStorage.removeItem('isAdmin');
            if (user) {
                await signOut(auth);
                console.log("Non-admin user signed out.");
            }
            if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                window.AdminLogic.deinitialize();
            }
        }
    });

    // PWA install prompt handling
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.style.display = 'flex';
        console.log('`beforeinstallprompt` event fired.');
    });
}


/**
 * Initializes the application: sets up Firestore persistence, then calls initializeAppLogic.
 */
function init() {
    console.log("App initializing...");
    // Render skeleton loader is handled within initializeAppLogic/applyFilterState now
    // renderSkeletonLoader();

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic();
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Persistence failed: Multiple tabs open or unsupported environment.');
            } else if (err.code == 'unimplemented') {
                console.warn('Persistence failed: Browser does not support required features.');
            }
            console.error("Error enabling persistence:", err);
            initializeAppLogic(); // Initialize anyway
        });
}

// Start the application initialization process when the DOM is ready
document.addEventListener('DOMContentLoaded', init);