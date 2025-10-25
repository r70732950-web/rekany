// data-logic.js
// Handles fetching, caching, and manipulating application data (Firestore, localStorage).

// --- Imports ---
import {
    db, auth, messaging, state, // Shared state and Firebase instances
    productsCollection, categoriesCollection, announcementsCollection, // Firestore collections
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Added collections
    homeLayoutCollection, // Added collection
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE // Constants
} from './app-setup.js';

import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where,
    startAfter, addDoc, runTransaction, // Firestore functions
    signInWithEmailAndPassword, signOut // Auth functions - Corrected import needed if separate
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Note: Auth functions should be imported from firebase/auth if used separately

// *** گۆڕدرا: Import 'showNotification' لە utils.js ***
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import UI functions needed for updates after data changes
import {
    renderCart, renderFavoritesPage, // Direct UI updates
    updateAdminUI, // Specifically for admin UI toggling
    renderUserNotificationsUI, renderPoliciesUI, renderContactLinksUI, // UI rendering functions
    renderProducts, renderSkeletonLoader, // Added for searchProducts
    renderMainCategories, renderCategoriesSheet, renderSubcategoriesUI, // Added for applyFilterState
    showPage // Added for handlePopstate/handleInitialPageLoad
} from './ui-logic.js';

// Import utility functions
import { t, formatDescription, debounce, showNotification } from './utils.js';
// *** کۆتایی گۆڕانکاری ***

// Import admin helper function if needed (e.g., clearProductCache is called internally sometimes)
import { clearProductCache } from './admin-helpers.js';

// --- Firestore Persistence ---
/**
 * Attempts to enable Firestore offline persistence.
 * Calls the callback with true if enabled, false otherwise.
 * @param {Function} callback - Function to call after attempting persistence.
 */
export function initializeFirestorePersistence(callback) {
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            callback(true);
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            callback(false); // Indicate persistence failed
        });
}

// --- Category Data ---

/**
 * Sets up a real-time listener for the main categories collection.
 * Updates the global state and calls the provided callback on changes.
 * @param {Function} onUpdate - Callback function executed with the updated categories list.
 * @returns {Function} Unsubscribe function to detach the listener.
 */
export function setupCategoryListener(onUpdate) {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Update global state (add 'All' category)
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label') }, ...fetchedCategories]; // Add translated "All"
        console.log("Global categories state updated:", state.categories);
        // Call the callback provided by app-main.js
        if (typeof onUpdate === 'function') {
            onUpdate(state.categories);
        }
    }, (error) => {
        console.error("Error listening to categories:", error);
        // Handle error appropriately, maybe show a notification
        showNotification(t('error_generic') + " (Categories)", 'error');
    });
    return unsubscribe; // Return the function to stop listening
}

/**
 * Returns the currently loaded categories from the state.
 * @returns {Array} List of category objects.
 */
export function getCategories() {
    return state.categories || []; // Return empty array if not loaded yet
}


/**
 * Fetches subcategories for a given main category ID.
 * @param {string} categoryId - The ID of the main category.
 * @returns {Promise<Array>} A promise that resolves with an array of subcategory objects.
 */
export async function fetchSubcategories(categoryId) {
    if (!categoryId || categoryId === 'all') {
        return [];
    }
    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching subcategories:", error);
        showNotification(t('error_generic') + " (Subcategories)", 'error');
        return []; // Return empty array on error
    }
}

/**
 * Fetches sub-subcategories for given main and sub category IDs.
 * @param {string} mainCategoryId - The ID of the main category.
 * @param {string} subcategoryId - The ID of the subcategory.
 * @returns {Promise<Array>} A promise that resolves with an array of sub-subcategory objects.
 */
export async function fetchSubSubcategories(mainCategoryId, subcategoryId) {
    if (!mainCategoryId || !subcategoryId) {
        return [];
    }
    try {
        const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching sub-subcategories:", error);
        showNotification(t('error_generic') + " (SubSubcategories)", 'error');
        return [];
    }
}


// --- Product Data ---

/**
 * Fetches products based on current filters (category, subcategory, search) and pagination.
 * Updates global state (products, lastVisibleProductDoc, allProductsLoaded).
 * Calls UI functions (renderSkeletonLoader, renderProducts) to update the display.
 * @param {string} searchTerm - The current search term.
 * @param {boolean} isNewSearch - Whether this is a new search (reset pagination) or loading more.
 * @returns {Promise<void>}
 */
export async function searchProducts(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const productsContainer = document.getElementById('productsContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const loader = document.getElementById('loader');

    // Determine if we should show home sections or product list
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // --- Show Home Sections ---
        if (productsContainer) productsContainer.style.display = 'none';
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (scrollTrigger) scrollTrigger.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'block';

        if (homeSectionsContainer && homeSectionsContainer.innerHTML.trim() === '') {
             console.log("Rendering home page content because it was empty.");
             // Assuming renderHomePageContent is available via import or global scope
             // ** IMPORTANT: Ensure renderHomePageContent is imported or accessible **
             // If renderHomePageContent is in ui-logic.js, import it there and then import here
             // For now, assuming it might be called indirectly or needs adjustment
              // Example: if defined in ui-logic.js and exported:
             // await renderHomePageContent(); // Needs import from ui-logic
             console.warn("renderHomePageContent needs to be called/imported correctly here."); // Placeholder warning
        }
         state.products = [];
         state.lastVisibleProductDoc = null;
         state.allProductsLoaded = true;
        return;
    } else {
        // --- Show Product List ---
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'none';
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
        });
        state.sliderIntervals = {};
    }

    // Check cache
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
        console.log("Loading products from cache:", cacheKey);
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (productsContainer) productsContainer.style.display = 'grid';

        renderProducts(state.products); // Update UI from ui-logic
        if (scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    if (state.isLoadingMoreProducts) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Update UI from ui-logic
    }

    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    if (loader) loader.style.display = 'block';

    try {
        let productsQuery = collection(db, "products");

        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

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

        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            if (scrollTrigger) scrollTrigger.style.display = 'none';
        } else {
            state.allProductsLoaded = false;
            if (scrollTrigger) scrollTrigger.style.display = 'block';
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        if (isNewSearch) {
            if(!state.productCache) state.productCache = {};
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        renderProducts(state.products); // Update UI from ui-logic

        if (state.products.length === 0 && isNewSearch) {
            if (productsContainer) {
                 productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found') || 'هیچ کاڵایەک نەدۆزرایەوە.'}</p>`;
             }
        }

    } catch (error) {
        console.error("Error fetching products:", error);
         if (productsContainer) {
             productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_generic')}</p>`;
         }
        showNotification(t('error_generic') + " (Products)", 'error');
    } finally {
        state.isLoadingMoreProducts = false;
        if (loader) loader.style.display = 'none';
        if (skeletonLoader && isNewSearch) skeletonLoader.style.display = 'none';
        if (productsContainer) productsContainer.style.display = 'grid';
    }
}


// --- Cart Logic ---

/** Saves the current cart state to localStorage and updates the count display. */
function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(state.cart || []));
        updateCartCount();
    } catch (e) {
        console.error("Error saving cart to localStorage:", e);
        showNotification(t('error_generic') + " (Saving Cart)", 'error');
    }
}

/** Updates the cart item count displayed in the UI. */
function updateCartCount() {
    const totalItems = Array.isArray(state.cart)
        ? state.cart.reduce((total, item) => total + (item.quantity || 0), 0)
        : 0;
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = totalItems;
    });
}

/**
 * Adds a product to the cart or increments its quantity.
 * Fetches product details if not already available locally.
 * @param {string} productId - The ID of the product to add.
 */
export async function addToCart(productId) {
    let product = Array.isArray(state.products) ? state.products.find(p => p.id === productId) : null;

    if (!product) {
        console.warn(`Product ${productId} not found locally, fetching details...`);
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                console.error(`Product ${productId} not found in Firestore.`);
                showNotification(t('product_not_found_error'), 'error');
                return;
            }
        } catch (error) {
            console.error(`Error fetching product ${productId} details:`, error);
            showNotification(t('error_generic') + " (Fetching Product)", 'error');
            return;
        }
    }

    if (!Array.isArray(state.cart)) state.cart = [];

    const existingItem = state.cart.find(item => item.id === productId);
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 0) + 1;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }

    saveCart();
    showNotification(t('product_added_to_cart'));
    if (document.getElementById('cartSheet')?.classList.contains('show')) {
        renderCart(state.cart); // Update UI
    }
}

/**
 * Updates the quantity of an item in the cart. Removes if quantity becomes zero or less.
 * @param {string} productId - The ID of the product to update.
 * @param {number} change - The amount to change the quantity by (+1 or -1).
 */
export function updateQuantity(productId, change) {
    if (!Array.isArray(state.cart)) state.cart = [];
    const cartItemIndex = state.cart.findIndex(item => item.id === productId);

    if (cartItemIndex > -1) {
        state.cart[cartItemIndex].quantity = (state.cart[cartItemIndex].quantity || 0) + change;
        if (state.cart[cartItemIndex].quantity <= 0) {
            state.cart.splice(cartItemIndex, 1);
        }
        saveCart();
        renderCart(state.cart); // Update UI
    } else {
        console.warn(`Attempted to update quantity for non-existent cart item: ${productId}`);
    }
}

/**
 * Removes an item completely from the cart.
 * @param {string} productId - The ID of the product to remove.
 */
export function removeFromCart(productId) {
    if (!Array.isArray(state.cart)) state.cart = [];
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(state.cart); // Update UI
}

/**
 * Generates the order message string for sharing via contact methods.
 * @returns {string} The formatted order message.
 */
export function generateOrderMessage() {
    if (!Array.isArray(state.cart) || state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    let total = 0;
    state.cart.forEach(item => {
        const itemName = (item.name && item.name[state.currentLanguage])
                       || (item.name && item.name.ku_sorani)
                       || (typeof item.name === 'string' ? item.name : t('unknown_product') || 'کاڵای نەناسراو');
        const price = item.price || 0;
        const quantity = item.quantity || 0;
        const itemTotal = price * quantity;
        total += itemTotal;
        const itemDetails = t('order_item_details', { price: price.toLocaleString(), quantity: quantity });
        message += `- ${itemName} | ${itemDetails}\n`;
    });
    const totalAmountSpan = document.getElementById('totalAmount'); // Get total from UI as it's already calculated there
    const totalText = totalAmountSpan ? totalAmountSpan.textContent : total.toLocaleString();
    message += `\n${t('order_total')}: ${totalText} د.ع.\n`;
    const profile = state.userProfile || {};
    if (profile.name && profile.address && profile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${profile.name}\n`;
        message += `${t('order_user_address')}: ${profile.address}\n`;
        message += `${t('order_user_phone')}: ${profile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}


// --- Favorites Logic ---

/** Saves the current favorites state to localStorage. */
function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites || []));
    } catch (e) {
        console.error("Error saving favorites to localStorage:", e);
        showNotification(t('error_generic') + " (Saving Favorites)", 'error');
    }
}

/**
 * Checks if a product ID is in the favorites list.
 * @param {string} productId - The ID of the product.
 * @returns {boolean} True if the product is favorited.
 */
export function isFavorite(productId) {
    return Array.isArray(state.favorites) && state.favorites.includes(productId);
}

/**
 * Adds or removes a product from the favorites list.
 * Updates localStorage and UI elements.
 * @param {string} productId - The ID of the product.
 * @param {Event} [event] - Optional event object (to stop propagation).
 */
export function toggleFavorite(productId, event) {
    if (event) event.stopPropagation();
    if (!Array.isArray(state.favorites)) state.favorites = [];

    const isCurrentlyFavorite = state.favorites.includes(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update UI (This part might be better handled in ui-logic.js if called from there)
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart');
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite);
            heartIcon.classList.toggle('far', !isNowFavorite);
        }
    });

    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage(state.favorites, sessionStorage.getItem('isAdmin') === 'true'); // Update UI
    }
}


// --- User Profile Logic ---

/** Saves the user profile data to localStorage. */
export function saveProfile(profileData) {
    try {
        state.userProfile = profileData || {};
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
    } catch (e) {
        console.error("Error saving profile to localStorage:", e);
        showNotification(t('error_generic') + " (Saving Profile)", 'error');
    }
}

/** Loads the user profile from localStorage into the global state. */
export function loadProfile() {
    try {
        const storedProfile = localStorage.getItem(PROFILE_KEY);
        state.userProfile = storedProfile ? JSON.parse(storedProfile) : {};
    } catch (e) {
        console.error("Error loading profile from localStorage:", e);
        state.userProfile = {};
    }
}


// --- Announcements & Policies ---

/**
 * Sets up a listener for the latest announcement to update the notification badge.
 * @param {Function} onUpdate - Callback function receiving a boolean (true if new).
 * @returns {Function} Unsubscribe function.
 */
export function setupAnnouncementsListener(onUpdate) {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        let showBadge = false;
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = parseFloat(localStorage.getItem('lastSeenAnnouncementTimestamp') || '0');
            if (latestAnnouncement.createdAt && typeof latestAnnouncement.createdAt === 'number') {
                showBadge = latestAnnouncement.createdAt > lastSeenTimestamp;
            }
        }
        if (typeof onUpdate === 'function') {
            onUpdate(showBadge);
        }
    }, (error) => {
        console.error("Error listening to announcements:", error);
    });
    return unsubscribe;
}

/**
 * Fetches all announcements ordered by creation date (desc).
 * @returns {Promise<Array>} Array of announcement objects.
 */
export async function fetchAnnouncements() {
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching announcements:", error);
        showNotification(t('error_generic') + " (Announcements)", 'error');
        return [];
    }
}

/**
 * Fetches the terms and policies content.
 * @returns {Promise<Object|null>} Policies content object or null on error/not found.
 */
export async function fetchPolicies() {
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().content) {
            return docSnap.data().content;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        showNotification(t('error_generic') + " (Policies)", 'error');
        return null;
    }
}


// --- Contact Links ---

/**
 * Sets up a real-time listener for social media/contact links.
 * @param {Function} onUpdate - Callback function executed with the updated links list.
 * @returns {Function} Unsubscribe function.
 */
export function setupContactLinksListener(onUpdate) {
    const socialLinksCollectionRef = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollectionRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (typeof onUpdate === 'function') {
            onUpdate(links);
        }
    }, (error) => {
        console.error("Error listening to contact links:", error);
    });
    return unsubscribe;
}


// --- Authentication & Admin Handling ---

/**
 * Handles changes in authentication state (login/logout).
 * Determines if the user is the admin and updates UI accordingly.
 * @param {User|null} user - The Firebase Auth user object or null.
 */
export async function handleAuthStateChange(user) {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // <<<--- UPDATE THIS
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        console.log("Admin user detected.");
        sessionStorage.setItem('isAdmin', 'true');
         updateAdminUI(true); // Call UI update function

        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                 window.AdminLogic.initialize();
             } else {
                 window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
            console.warn("AdminLogic.initialize function not found. Ensure admin.js is loaded and initialized after this.");
        }
        const loginModalEl = document.getElementById('loginModal');
         if (loginModalEl?.style.display === 'block') {
            closeCurrentPopup();
        }
    } else {
        console.log("No admin user or non-admin user detected.");
        sessionStorage.removeItem('isAdmin');
         updateAdminUI(false); // Call UI update function

        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
        if (user && auth) {
            try {
                await signOut(auth);
                console.log("Non-admin user signed out automatically.");
            } catch (error) {
                console.error("Error signing out non-admin user:", error);
            }
        }
    }
}


// --- PWA & Notifications ---

/**
 * Saves the beforeinstallprompt event for later use.
 * @param {Event} event - The beforeinstallprompt event.
 */
export function saveDeferredPrompt(event) {
    state.deferredPrompt = event;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
    console.log('`beforeinstallprompt` event saved.');
}

/**
 * Triggers the PWA installation prompt if available.
 */
export async function triggerInstallPrompt() {
    const installBtn = document.getElementById('installAppBtn');
    if (state.deferredPrompt) {
        if (installBtn) installBtn.style.display = 'none';
        try {
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            state.deferredPrompt = null;
        } catch (error) {
            console.error("Error showing install prompt:", error);
        }
    } else {
        console.log("Deferred install prompt not available.");
        if (installBtn) installBtn.style.display = 'none';
    }
}

/**
 * Registers the service worker and sets up update handling.
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        const updateNotificationEl = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log("New SW installed and waiting. Showing update notification.");
                            if (updateNotificationEl) updateNotificationEl.classList.add('show');
                        }
                    });
                }
            });
            if (updateNowBtn) {
                 updateNowBtn.addEventListener('click', () => {
                     if (registration.waiting) {
                         console.log("Sending skipWaiting message to SW.");
                         registration.waiting.postMessage({ action: 'skipWaiting' });
                         if (updateNotificationEl) updateNotificationEl.classList.remove('show');
                     } else {
                         console.log("No waiting service worker found to activate.");
                     }
                 });
            }
        }).catch(err => {
            console.error('Service Worker registration failed: ', err);
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
             if (refreshing) return;
             console.log('Controller changed. New Service Worker activated. Reloading page...');
             refreshing = true;
            window.location.reload();
        });
    } else {
        console.log("Service Worker not supported.");
    }
}


/**
 * Requests notification permission and saves the FCM token if granted.
 */
export async function requestNotificationPermissionAndToken() {
    console.log('Requesting notification permission...');
    if (!messaging) { // Check if messaging was initialized
         console.error("Firebase Messaging is not initialized or not supported.");
         showNotification(t('error_generic') + " (Messaging)", 'error');
         return;
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notifications_enabled_success') || 'ئاگەدارییەکان چالاککران', 'success');
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
            showNotification(t('notifications_permission_denied') || 'مۆڵەت نەدرا', 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission or getting token: ', error);
        showNotification(t('error_generic') + " (Notifications)", 'error');
    }
}

/**
 * Saves the FCM device token to Firestore for push notifications.
 * @param {string} token - The FCM token.
 */
async function saveTokenToFirestore(token) {
    if (!token) return;
    try {
        const tokensCollectionRef = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollectionRef, token), { createdAt: Date.now() });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

/**
 * Sets up the handler for receiving FCM messages while the app is in the foreground.
 */
export function setupForegroundMessageHandler() {
     if (!messaging) { // Check if messaging was initialized
         console.warn("Firebase Messaging not initialized or not supported, cannot set up foreground handler.");
         return;
     }
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || t('new_notification') || 'ئاگەداری نوێ';
        const body = payload.notification?.body || '';
        showNotification(`${title}${body ? ': ' + body : ''}`, 'success');
         const badge = document.getElementById('notificationBadge');
         if (badge) badge.style.display = 'block';
        if (document.getElementById('notificationsSheet')?.classList.contains('show')) {
            fetchAnnouncements().then(announcements => renderUserNotificationsUI(announcements)); // Update UI
        }
    });
}


// --- Navigation & State Management ---

/**
 * Saves the current scroll position for the main page in history state.
 */
export function saveCurrentScrollPosition() {
    const currentState = history.state;
    const mainPageEl = document.getElementById('mainPage');
    if (mainPageEl?.classList.contains('page-active') && currentState && !currentState.type) {
        try {
            history.replaceState({ ...currentState, scroll: window.scrollY }, '');
        } catch (e) {
             console.warn("Could not replace history state to save scroll:", e);
        }
    }
}

/**
 * Applies filters based on a state object and updates the product list.
 * @param {object} filterState - Object containing category, subcategory, search etc.
 * @param {boolean} [fromPopState=false] - Indicates if called due to history navigation.
 */
export async function applyFilterState(filterState, fromPopState = false) {
    console.log("Applying filter state:", filterState, "From popstate:", fromPopState);
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    const searchInputEl = document.getElementById('searchInput');
    const clearSearchBtnEl = document.getElementById('clearSearchBtn');
    if (searchInputEl) searchInputEl.value = state.currentSearch;
    if (clearSearchBtnEl) clearSearchBtnEl.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories(state.categories); // Update UI
    const subcats = await fetchSubcategories(state.currentCategory);
    renderSubcategoriesUI(state.currentCategory, subcats); // Update UI

    await searchProducts(state.currentSearch, true); // true = new search

    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 100); // Increased delay slightly
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Updates the browser history and triggers a filter state update.
 * @param {object} newState - Object containing changes to apply (e.g., {category: 'newId'}).
 */
export async function navigateToFilter(newState) {
    saveCurrentScrollPosition();
    const currentState = history.state || {};
    const targetState = {
        category: currentState.category || 'all',
        subcategory: currentState.subcategory || 'all',
        subSubcategory: currentState.subSubcategory || 'all',
        search: currentState.search || '',
        ...newState,
        scroll: 0 // Reset scroll for new navigation
    };
    const params = new URLSearchParams();
    if (targetState.category && targetState.category !== 'all') params.set('category', targetState.category);
    if (targetState.subcategory && targetState.subcategory !== 'all') params.set('subcategory', targetState.subcategory);
    if (targetState.subSubcategory && targetState.subSubcategory !== 'all') params.set('subSubcategory', targetState.subSubcategory);
    if (targetState.search) params.set('search', targetState.search);
     const basePath = window.location.pathname;
    const queryString = params.toString();
    const newUrl = `${basePath}${queryString ? '?' + queryString : ''}`;
    history.pushState(targetState, '', newUrl);
    await applyFilterState(targetState);
}


/**
 * Handles browser back/forward navigation (popstate event).
 * @param {PopStateEvent} event - The popstate event object.
 */
export async function handlePopstate(event) {
    console.log("Popstate event:", event.state);
    closeAllPopupsUI();
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
             let pageTitle = popState.title;
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                     const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         const subCat = subCatSnap.data();
                         pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                         history.replaceState({...popState, title: pageTitle}, '');
                     }
                 } catch (e) { console.error("Could not refetch title on popstate:", e); }
             }
             showPage(popState.id, pageTitle); // Update UI
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             openPopup(popState.id, popState.type); // Update UI
        } else {
             showPage('mainPage'); // Update UI
             await applyFilterState(popState, true); // true = fromPopState
        }
    } else {
         const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         showPage('mainPage'); // Update UI
         await applyFilterState(defaultState);
    }
}


/**
 * Handles the initial page load, parsing URL parameters/hash
 * and setting the initial application state. Should be called
 * *after* essential data like categories are loaded.
 * @param {Array} [categories] - Optional: Pass loaded categories.
 */
export async function handleInitialPageLoad(categories) {
     console.log("Handling initial page load...");
     if (state.initialLoadComplete) {
         console.log("Initial load already handled.");
         return;
     }

     const hash = window.location.hash.substring(1);
     const params = new URLSearchParams(window.location.search);
     let initialStateHandled = false;

     // Case 1: Subcategory Detail Page via Hash
     if (hash.startsWith('subcategory_')) {
         const ids = hash.split('_');
         const mainCatId = ids[1];
         const subCatId = ids[2];
          let subCatName = 'Details';
          try {
              const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
              const subCatSnap = await getDoc(subCatRef);
              if (subCatSnap.exists()) {
                   const subCat = subCatSnap.data();
                   subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
              }
          } catch (e) { console.error("Error fetching initial subcat name:", e); }
         history.replaceState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
         showPage('subcategoryDetailPage', subCatName); // Update UI
          await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Update UI
          await renderProductsOnDetailPageUI(subCatId, 'all', ''); // Update UI
         initialStateHandled = true;
     }
     // Case 2: Settings Page via Hash
     else if (hash === 'settingsPage') {
          history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
          showPage('settingsPage', t('settings_title')); // Update UI
          initialStateHandled = true;
     }

     // Case 3: Main Page
     if (!initialStateHandled) {
          showPage('mainPage'); // Update UI
         const initialState = {
             category: params.get('category') || 'all',
             subcategory: params.get('subcategory') || 'all',
             subSubcategory: params.get('subSubcategory') || 'all',
             search: params.get('search') || '',
             scroll: 0
         };
         const initialUrl = window.location.pathname + (window.location.search || '') + (hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage' ? '#' + hash : '');
         history.replaceState(initialState, '', initialUrl);
         await applyFilterState(initialState); // Apply filters (calls searchProducts -> renderProducts)

         if (hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage') {
              const element = document.getElementById(hash);
              if (element) {
                   const isSheet = element.classList.contains('bottom-sheet');
                   const isModal = element.classList.contains('modal');
                   if (isSheet || isModal) {
                       openPopup(hash, isSheet ? 'sheet' : 'modal'); // Update UI
                       history.replaceState({ ...initialState, type: isSheet ? 'sheet' : 'modal', id: hash }, '', initialUrl);
                   }
              }
         }
          const productId = params.get('product');
          if (productId) {
               setTimeout(() => showProductDetailsWithDataById(productId), 500); // Needs showProductDetailsWithDataById
          }
         initialStateHandled = true;
     }
     // Mark initial load as complete *after* all paths are handled
     state.initialLoadComplete = true; // Set the flag
     console.log("Initial page handling marked complete.");
}

/**
 * Helper to show product details, fetching data if necessary.
 * @param {string} productId
 */
async function showProductDetailsWithDataById(productId) {
     let product = state.products.find(p => p.id === productId);
     if (!product) {
         try {
             console.log(`Fetching details for product ID: ${productId}`);
             const docSnap = await getDoc(doc(db, "products", productId));
             if (docSnap.exists()) {
                 product = { id: docSnap.id, ...docSnap.data() };
             } else {
                 showNotification(t('product_not_found_error'), 'error');
                 return;
             }
         } catch (error) {
             console.error("Error fetching product details by ID:", error);
             showNotification(t('error_generic'), 'error');
             return;
         }
     }
     // Now call the UI function with the product data
     showProductDetailsWithData(product); // Call UI function
}

