// app-core.js: Core logic, Firebase interactions, state management

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, // Ensure these are imported from app-setup
    translations, state, // state object needs sliderIntervals: {} added in app-setup.js
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- Helper Functions ---

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func The function to debounce.
 * @param {number} [delay=500] The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- Translation ---

/**
 * Translates a key using the current language. Falls back to ku_sorani if needed.
 * @param {string} key The translation key.
 * @param {object} [replacements={}] Optional replacements for placeholders.
 * @returns {string} The translated string.
 */
export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

// --- State Management ---

/** Saves the current cart to localStorage. */
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    // The UI part (updateCartCount) will be in app-ui.js
}

/** Saves the current favorites list to localStorage. */
export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

/** Saves the user profile to localStorage. */
export function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
}

/** Checks if a product is in the favorites list. */
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Firebase & Data Fetching ---

/**
 * Fetches products from Firestore based on current filters and search term.
 * Handles pagination and caching.
 * @param {string} [searchTerm=''] The search term.
 * @param {boolean} [isNewSearch=false] Whether this is a new search or loading more.
 */
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // Trigger rendering home sections (UI function)
        window.AppUI.renderHomePageSections();
        return;
    } else {
        // Trigger stopping sliders and hiding home sections (UI function)
        window.AppUI.hideHomePageSectionsAndStopSliders();
    }

    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        // Trigger UI update from cache
        window.AppUI.displayCachedProducts();
        return;
    }

    if (state.isLoadingMoreProducts) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        // Trigger UI update for new search (show skeleton)
        window.AppUI.showSkeletonForNewSearch();
    }

    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    // Trigger UI update for loading state
    window.AppUI.showLoadingIndicator(true);

    try {
        let productsQuery = collection(db, "products");

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Apply ordering
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Cache results for new searches
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Trigger UI update with fetched products
        window.AppUI.renderFetchedProducts();

    } catch (error) {
        console.error("Error fetching content:", error);
        // Trigger UI update for error state
        window.AppUI.showFetchingError();
    } finally {
        state.isLoadingMoreProducts = false;
        // Trigger UI update for finished loading state
        window.AppUI.showLoadingIndicator(false);
    }
}

/** Fetches categories from Firestore and stores them in the state. */
export function setupCategoryListener() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories]; // Ensure 'All' category has names
        // Trigger UI update related to categories
        window.AppUI.updateCategoryDependentUI();
        // If it's the initial load after categories are ready, handle initial page state
        if (!state.initialLoadHandled) {
            handleInitialPageLoad(); // Now safe to call
            state.initialLoadHandled = true; // Mark initial load as handled
        }
    }, (error) => {
        console.error("Error fetching categories:", error);
        // Maybe show an error in the category sections?
    });
}

/** Fetches contact links from Firestore. */
export function setupContactLinksListener() {
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Trigger UI update for contact links
        window.AppUI.renderContactLinks(links);
    }, (error) => {
        console.error("Error fetching contact links:", error);
    });
}

/** Fetches contact methods (for sending orders) from Firestore. */
export function setupContactMethodsListener() {
    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt")); // Ensure consistent order

    onSnapshot(q, (snapshot) => {
        state.contactMethods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Trigger UI update for cart action buttons (if cart sheet is open)
        window.AppUI.updateCartActionButtons();
    }, (error) => {
        console.error("Error fetching contact methods:", error);
    });
}


/** Checks for new announcements and updates the badge state. */
export function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
            const showBadge = latestAnnouncement.createdAt > lastSeenTimestamp;
            // Trigger UI update for notification badge
            window.AppUI.updateNotificationBadge(showBadge);
        }
    });
}

/** Fetches announcements for the notification sheet. */
export async function fetchAnnouncementsForSheet() {
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Find the latest timestamp among fetched announcements
        let latestTimestamp = 0;
        if (!snapshot.empty) {
            latestTimestamp = snapshot.docs[0].data().createdAt;
        }

        // Update last seen timestamp and trigger UI update
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        window.AppUI.renderUserNotifications(announcements); // Pass data to UI function
        window.AppUI.updateNotificationBadge(false); // Hide badge after opening

    } catch (error) {
        console.error("Error fetching announcements:", error);
        window.AppUI.renderUserNotifications([]); // Render empty state on error
    }
}

/** Fetches policies from Firestore. */
export async function fetchPolicies() {
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);
        let policiesContent = null;
        if (docSnap.exists() && docSnap.data().content) {
            policiesContent = docSnap.data().content;
        }
        // Trigger UI update for policies sheet
        window.AppUI.renderPoliciesSheet(policiesContent);
    } catch (error) {
        console.error("Error fetching policies:", error);
        window.AppUI.renderPoliciesSheet(null, true); // Pass error flag
    }
}

/** Fetches subcategories for a given main category ID. */
export async function fetchSubcategories(categoryId) {
    if (!categoryId || categoryId === 'all') {
        state.subcategories = [];
        return [];
    }
    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return state.subcategories;
    } catch (error) {
        console.error(`Error fetching subcategories for ${categoryId}:`, error);
        return [];
    }
}

/** Fetches sub-subcategories for given main and sub category IDs. */
export async function fetchSubSubcategories(mainCatId, subCatId) {
    if (!mainCatId || !subCatId) {
        return [];
    }
    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching sub-subcategories for ${mainCatId}/${subCatId}:`, error);
        return [];
    }
}

/** Fetches products for the subcategory detail page. */
export async function fetchProductsForDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    try {
        let productsQuery;
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);
        return productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        return [];
    }
}

/** Fetches related products based on category/subcategory. */
export async function fetchRelatedProducts(currentProduct) {
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return [];
    }

    let q;
    if (currentProduct.subSubcategoryId) {
        q = query(productsCollection, where('subSubcategoryId', '==', currentProduct.subSubcategoryId), where('__name__', '!=', currentProduct.id), limit(6));
    } else if (currentProduct.subcategoryId) {
        q = query(productsCollection, where('subcategoryId', '==', currentProduct.subcategoryId), where('__name__', '!=', currentProduct.id), limit(6));
    } else {
        q = query(productsCollection, where('categoryId', '==', currentProduct.categoryId), where('__name__', '!=', currentProduct.id), limit(6));
    }

    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching related products:", error);
        return [];
    }
}


// --- Cart Logic ---

/** Adds a product to the cart or increments its quantity. */
export function addToCart(productId) {
    // Find product details (prioritize local state, fallback to fetch if needed)
    let product = state.products.find(p => p.id === productId);

    const processAddToCart = (productData) => {
        const mainImage = (productData.imageUrls && productData.imageUrls.length > 0) ? productData.imageUrls[0] : (productData.image || '');
        const existingItem = state.cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity++;
        } else {
            state.cart.push({
                id: productData.id,
                name: productData.name, // Store the full name object
                price: productData.price,
                image: mainImage,
                quantity: 1
            });
        }
        saveCart();
        window.AppUI.showNotification(t('product_added_to_cart'), 'success');
        window.AppUI.updateCartCount(); // Update UI count
    };

    if (product) {
        processAddToCart(product);
    } else {
        console.warn("Product not found locally for cart. Fetching...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                processAddToCart(fetchedProduct);
            } else {
                console.error("Product fetch failed for cart add:", productId);
                window.AppUI.showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(err => {
            console.error("Error fetching product for cart:", err);
            window.AppUI.showNotification(t('error_generic'), 'error');
        });
    }
}


/** Updates the quantity of a cart item. */
export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Remove if quantity is zero or less
        } else {
            saveCart();
            window.AppUI.renderCart(); // Trigger UI update
        }
    }
}

/** Removes an item completely from the cart. */
export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    window.AppUI.renderCart(); // Trigger UI update
    window.AppUI.updateCartCount(); // Update UI count
}

// --- Favorites Logic ---

/** Toggles a product's favorite status. */
export function toggleFavorite(productId) {
    const isCurrentlyFavorite = isFavorite(productId);
    let messageKey = '';
    let messageType = 'success';

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        messageKey = 'product_removed_from_favorites';
        messageType = 'error';
    } else {
        state.favorites.push(productId);
        messageKey = 'product_added_to_favorites';
    }
    saveFavorites();

    // Trigger UI updates
    window.AppUI.showNotification(t(messageKey), messageType);
    window.AppUI.updateFavoriteButtons(productId, !isCurrentlyFavorite);
    window.AppUI.updateFavoritesPageIfOpen();
}

// --- Authentication & Admin ---

/** Sets up the listener for Firebase Authentication state changes. */
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
        const isAdmin = user && user.uid === adminUID;

        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');

        if (isAdmin) {
            console.log("Admin user detected.");
            // Ensure admin logic is loaded before initializing
            if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                     window.AdminLogic.initialize();
                } else {
                    document.addEventListener('DOMContentLoaded', window.AdminLogic.initialize, { once: true });
                }
            } else {
                 console.warn("AdminLogic not found or initialize not a function when admin logged in.");
                 // Optionally try again after a delay if admin.js might load later
                 setTimeout(() => {
                    if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                        window.AdminLogic.initialize();
                    } else {
                         console.error("AdminLogic still not available after delay.");
                    }
                 }, 1000);
            }
        } else {
            console.log("No admin user or non-admin user detected.");
            if (user) {
                // If a non-admin user is somehow signed in, sign them out.
                await signOut(auth);
                console.log("Non-admin user signed out.");
            }
             // Deinitialize admin UI elements if the logic exists
             if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                window.AdminLogic.deinitialize();
            }
        }

        // Trigger UI update based on admin status
        window.AppUI.updateAdminSpecificUI(isAdmin);

        // Close login modal if admin logs in successfully
        if (window.AppUI.isModalOpen('loginModal') && isAdmin) {
            window.AppUI.closeCurrentPopup();
        }
    });
}


// --- Notifications & PWA ---

/** Requests permission for push notifications and saves the token. */
export async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            window.AppUI.showNotification(t('notification_permission_granted', { lang: state.currentLanguage }), 'success'); // Example of passing lang
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            window.AppUI.showNotification(t('notification_permission_denied', { lang: state.currentLanguage }), 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
    }
}

/** Saves the FCM token to Firestore. */
async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy checking/updates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add user ID here if users log in
            // userId: auth.currentUser ? auth.currentUser.uid : null
        }, { merge: true }); // Use merge to avoid overwriting if token exists
        console.log('Token saved/updated in Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

/** Sets up the listener for foreground push messages. */
function setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        // Use the UI function to display the notification
        window.AppUI.showNotification(`${title}: ${body}`, 'success');
        // Optionally update the badge immediately (UI function)
        window.AppUI.updateNotificationBadge(true);
    });
}

/** Handles the PWA beforeinstallprompt event. */
function setupInstallPromptHandler() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        // Trigger UI update to show install button
        window.AppUI.showInstallButton(true);
        console.log('`beforeinstallprompt` event was fired.');
    });
}

/** Triggers the PWA installation prompt. */
export async function triggerInstallPrompt() {
    if (state.deferredPrompt) {
        window.AppUI.showInstallButton(false); // Hide button after prompting
        state.deferredPrompt.prompt();
        try {
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
        } catch (error) {
            console.error("Error during install prompt:", error);
        }
        state.deferredPrompt = null; // Clear the saved prompt
    }
}

// --- Service Worker ---

/** Registers the service worker and sets up update listeners. */
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New worker is waiting, trigger UI update
                        window.AppUI.showUpdateNotification(true);
                    }
                });
            });

        }).catch(err => {
            console.log('Service Worker registration failed: ', err);
        });

        // Listen for controller change (after skipWaiting)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New Service Worker activated. Reloading page...');
            window.location.reload();
        });
    }
}

/** Sends a message to the waiting service worker to skip waiting. */
export function skipWaiting() {
    navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.waiting) {
            registration.waiting.postMessage({ action: 'skipWaiting' });
        }
    });
}

/** Forces an update by unregistering SW and clearing caches. */
export async function forceUpdate() {
    // Confirmation should be handled in UI before calling this
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

        window.AppUI.showNotification(t('update_success'), 'success');
        setTimeout(() => window.location.reload(true), 1500);

    } catch (error) {
        console.error('Error during force update:', error);
        window.AppUI.showNotification(t('error_generic'), 'error');
    }
}


// --- History & Navigation ---

/** Saves the current scroll position for the main page filter state. */
export function saveCurrentScrollPosition() {
    const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
    const currentState = history.state;
    // Only save if on main page and it's a filter state (not modal/sheet/page)
    if (mainPageActive && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
        // console.log("Saved scroll:", window.scrollY, "for state:", currentState);
    }
}

/** Applies filter state (category, search, etc.) and updates the view. */
export async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Trigger UI updates for filters (search input, category buttons)
    window.AppUI.updateFilterUI();

    // Fetch and render content based on the new state
    await searchProductsInFirestore(state.currentSearch, true); // Always treat state application as a new search

    // Restore scroll position if navigating back/forward
    if (fromPopState && typeof filterState.scroll === 'number') {
        // console.log("Restoring scroll to:", filterState.scroll);
        // Delay slightly to allow content rendering
        setTimeout(() => window.scrollTo({ top: filterState.scroll, behavior: 'auto' }), 100);
    } else if (!fromPopState) {
        // Scroll to top for new filter actions initiated by user
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/** Navigates to a new filter state, updating history. */
export async function navigateToFilter(newState) {
    // Save scroll position of the current state *before* navigating
    saveCurrentScrollPosition();

    // Define the new state, merging with current and resetting scroll
    const finalState = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        ...newState, // Apply incoming changes
        scroll: 0 // Always reset scroll for new filter actions
    };

    // Construct the new URL query parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Push the new state and URL to history
    history.pushState(finalState, '', newUrl);

    // Apply the new state to the application
    await applyFilterState(finalState);
}


/** Handles the initial page load based on URL parameters and hash. */
export function handleInitialPageLoad() {
    state.initialLoadHandled = true; // Mark as handled
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const productId = params.get('product');

    // Determine initial page based on hash first
    let initialPageId = 'mainPage';
    let initialPageTitle = '';
    let pageStateData = {};

    if (hash.startsWith('subcategory_')) {
        initialPageId = 'subcategoryDetailPage';
        const ids = hash.split('_');
        pageStateData = { mainCatId: ids[1], subCatId: ids[2] };
        // Title will be fetched later in showSubcategoryDetailPage
    } else if (hash === 'settingsPage') {
        initialPageId = 'settingsPage';
        initialPageTitle = t('settings_title');
        pageStateData = { title: initialPageTitle };
    }

    // Replace history for the initial page view
    history.replaceState({ type: 'page', id: initialPageId, ...pageStateData }, '', window.location.href);
    window.AppUI.showPage(initialPageId, initialPageTitle); // Show the initial page UI

    // If it's the main page, apply filters from query params
    if (initialPageId === 'mainPage') {
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        // Replace initial history state with filter state
        history.replaceState(initialState, '', `${window.location.pathname}?${params.toString()}`);
        applyFilterState(initialState); // Apply filters *after* categories are loaded (handled by listener)
    }

     // If a specific product ID is in the URL, open its details *after* a short delay
     // This allows categories/products to potentially load first
     if (productId) {
         setTimeout(() => window.AppUI.showProductDetailsById(productId), 500); // Use UI function
     }
     // Handle opening sheets/modals based on hash *if* on the main page
     else if (initialPageId === 'mainPage' && hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage') {
         const element = document.getElementById(hash);
         if (element) {
             const isSheet = element.classList.contains('bottom-sheet');
             const isModal = element.classList.contains('modal');
             if (isSheet || isModal) {
                 window.AppUI.openPopup(hash, isSheet ? 'sheet' : 'modal'); // Use UI function
             }
         }
     }
}


// --- Initialization ---

/** Initializes core application logic. */
function initializeAppLogic() {
    state.initialLoadHandled = false; // Reset initial load flag
    state.sliderIntervals = {}; // Ensure slider intervals object exists

    setupCategoryListener(); // Fetches categories and triggers initial load handling
    setupAuthListener();
    setupContactLinksListener();
    setupContactMethodsListener();
    checkNewAnnouncements();
    setupForegroundMessageListener();
    setupInstallPromptHandler();
    setupServiceWorker();

    // Initial language setup (will be refined once categories load)
    window.AppUI.setLanguageUI(state.currentLanguage);
}

/** Main initialization function, enables Firestore persistence first. */
function init() {
    // Attempt to enable offline persistence
    enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.error("Error enabling persistence:", err))
        .finally(() => {
            // Initialize core app logic regardless of persistence success/failure
            initializeAppLogic();
        });
}

// Start the application
document.addEventListener('DOMContentLoaded', init);

// --- Global Exposure for Admin ---
// Expose necessary functions/variables for admin.js
window.globalAdminTools = {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    t,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // Pass new collections
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear the cache
        window.AppUI.clearHomePageContent(); // Clear home page UI to force re-render
    },
    // Expose necessary fetch functions for admin UI updates
    fetchSubcategories,
    fetchSubSubcategories,
    // Add other core functions if admin needs them directly (use with caution)
};
