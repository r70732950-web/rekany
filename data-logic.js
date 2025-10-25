// data-logic.js
// Handles fetching, caching, and manipulating application data (Firestore, localStorage).

// --- Imports ---
import {
    db, auth, messaging, state, // Shared state and Firebase instances
    productsCollection, categoriesCollection, announcementsCollection, // Firestore collections
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Added collections
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE // Constants
} from './app-setup.js';

import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where,
    startAfter, addDoc, runTransaction, // Firestore functions
    signInWithEmailAndPassword, signOut // Auth functions
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Note: Auth functions should be imported from firebase/auth

import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import UI functions needed for updates after data changes
import {
    renderCart, renderFavoritesPage, showNotification, // Direct UI updates
    updateAdminUI, // Specifically for admin UI toggling
    renderUserNotificationsUI, renderPoliciesUI, renderContactLinksUI // UI rendering functions
} from './ui-logic.js';

// Import utility functions
import { t, formatDescription, debounce } from './utils.js';

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

// *** زیادکرا: Export function to get categories ***
/**
 * Returns the currently loaded categories from the state.
 * @returns {Array} List of category objects.
 */
export function getCategories() {
    return state.categories || []; // Return empty array if not loaded yet
}
// *** کۆتایی زیادکراو ***


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
        if (scrollTrigger) scrollTrigger.style.display = 'none'; // Hide load more trigger
        if (loader) loader.style.display = 'none'; // Hide spinner
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'block';

        // Re-render home content if it's empty (e.g., after language change or cache clear)
        // Note: renderHomePageContent needs to be imported or called via app-main
        if (homeSectionsContainer && homeSectionsContainer.innerHTML.trim() === '') {
             console.log("Rendering home page content because it was empty.");
             // Assuming renderHomePageContent is available via import or global scope (less ideal)
             if (typeof renderHomePageContent === 'function') { // Check if function exists
                 await renderHomePageContent(); // Needs await if it's async
             } else {
                 console.error("renderHomePageContent function not found!");
             }
        }
         state.products = []; // Clear products list when showing home sections
         state.lastVisibleProductDoc = null;
         state.allProductsLoaded = true; // No more products to load in this view
        return; // Stop execution here
    } else {
        // --- Show Product List ---
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'none';
        // Stop any running promo sliders (needs access to state.sliderIntervals)
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals

         // Proceed with fetching/rendering products
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

        renderProducts(state.products); // Update UI
        if (scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    // Prevent concurrent loading
    if (state.isLoadingMoreProducts) return;

    // Reset state for new search
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show loading state in UI
    }

    // Stop if all products are already loaded (for infinite scroll)
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    if (loader) loader.style.display = 'block'; // Show loading spinner for infinite scroll

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

        // Apply search term filter (using searchableName)
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Apply ordering - IMPORTANT: First orderBy must match the inequality field if searching
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (startAfter) for infinite scroll
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Apply limit
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // Fetch documents
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update state
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            // Append new products for infinite scroll
            state.products = [...state.products, ...newProducts];
        }

        // Update pagination state
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            if (scrollTrigger) scrollTrigger.style.display = 'none'; // Hide trigger if all loaded
        } else {
            state.allProductsLoaded = false;
            if (scrollTrigger) scrollTrigger.style.display = 'block'; // Show trigger if more might exist
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Store last doc for next page

        // Update cache if it was a new search
        if (isNewSearch) {
            if(!state.productCache) state.productCache = {}; // Ensure cache object exists
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render the updated product list in the UI
        renderProducts(state.products);

        // Handle empty results for a new search
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
        if (skeletonLoader && isNewSearch) skeletonLoader.style.display = 'none'; // Hide skeleton only after new search
        if (productsContainer) productsContainer.style.display = 'grid'; // Ensure grid is displayed
    }
}


// --- Cart Logic ---

/** Saves the current cart state to localStorage and updates the count display. */
function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(state.cart || [])); // Ensure cart is an array
        updateCartCount(); // Update UI immediately
    } catch (e) {
        console.error("Error saving cart to localStorage:", e);
        showNotification(t('error_generic') + " (Saving Cart)", 'error');
    }
}

/** Updates the cart item count displayed in the UI. */
function updateCartCount() {
    // Ensure state.cart is an array before reducing
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
    // Find product in already loaded state.products first
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
                return; // Stop if product doesn't exist
            }
        } catch (error) {
            console.error(`Error fetching product ${productId} details:`, error);
            showNotification(t('error_generic') + " (Fetching Product)", 'error');
            return;
        }
    }

    // Ensure state.cart is an array
    if (!Array.isArray(state.cart)) {
        state.cart = [];
    }

    const existingItem = state.cart.find(item => item.id === productId);
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 0) + 1; // Ensure quantity exists
    } else {
        state.cart.push({
            id: product.id,
            name: product.name, // Store the multilingual name object
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }

    saveCart(); // Save and update count
    showNotification(t('product_added_to_cart'));
    // If the cart sheet is open, re-render it
    if (document.getElementById('cartSheet')?.classList.contains('show')) {
        renderCart(state.cart); // Pass cart data to UI function
    }
}

/**
 * Updates the quantity of an item in the cart. Removes if quantity becomes zero or less.
 * @param {string} productId - The ID of the product to update.
 * @param {number} change - The amount to change the quantity by (+1 or -1).
 */
export function updateQuantity(productId, change) {
    if (!Array.isArray(state.cart)) state.cart = []; // Ensure cart is array

    const cartItemIndex = state.cart.findIndex(item => item.id === productId);

    if (cartItemIndex > -1) {
        state.cart[cartItemIndex].quantity = (state.cart[cartItemIndex].quantity || 0) + change; // Ensure quantity exists

        if (state.cart[cartItemIndex].quantity <= 0) {
            // Remove item if quantity is zero or less
            state.cart.splice(cartItemIndex, 1);
        }
        saveCart(); // Save changes and update count
        renderCart(state.cart); // Re-render the cart UI
    } else {
        console.warn(`Attempted to update quantity for non-existent cart item: ${productId}`);
    }
}

/**
 * Removes an item completely from the cart.
 * @param {string} productId - The ID of the product to remove.
 */
export function removeFromCart(productId) {
    if (!Array.isArray(state.cart)) state.cart = []; // Ensure cart is array

    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart(); // Save changes and update count
    renderCart(state.cart); // Re-render the cart UI
}

/**
 * Generates the order message string for sharing via contact methods.
 * Includes product details and user profile info if available.
 * @returns {string} The formatted order message.
 */
export function generateOrderMessage() {
    if (!Array.isArray(state.cart) || state.cart.length === 0) return "";

    let message = t('order_greeting') + "\n\n";
    let total = 0;

    state.cart.forEach(item => {
        // Get name in current language, fallback to Sorani, then string if object fails
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

    message += `\n${t('order_total')}: ${total.toLocaleString()} د.ع.\n`;

    // Add user info if available
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
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites || [])); // Ensure array
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
    // Ensure state.favorites is an array
    return Array.isArray(state.favorites) && state.favorites.includes(productId);
}

/**
 * Adds or removes a product from the favorites list.
 * Updates localStorage and UI elements.
 * @param {string} productId - The ID of the product.
 * @param {Event} [event] - Optional event object (to stop propagation).
 */
export function toggleFavorite(productId, event) {
    if (event) event.stopPropagation(); // Prevent card click when clicking button

    // Ensure state.favorites is an array
    if (!Array.isArray(state.favorites)) {
        state.favorites = [];
    }

    const isCurrentlyFavorite = state.favorites.includes(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites(); // Save the updated list

    // Update UI for all cards matching this product ID
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Assuming icon has fa-heart class
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            // Toggle between solid (fas) and regular (far) Font Awesome styles
            heartIcon.classList.toggle('fas', isNowFavorite);
            heartIcon.classList.toggle('far', !isNowFavorite);
        }
    });

    // If the favorites sheet is currently open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage(state.favorites, sessionStorage.getItem('isAdmin') === 'true'); // Pass favorites data and admin status
    }
}


// --- User Profile Logic ---

/** Saves the user profile data to localStorage. */
export function saveProfile(profileData) {
    try {
        state.userProfile = profileData || {}; // Update global state
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
        state.userProfile = {}; // Reset profile on error
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
            // Use parseFloat to handle potential string numbers from localStorage
            const lastSeenTimestamp = parseFloat(localStorage.getItem('lastSeenAnnouncementTimestamp') || '0');
            // Ensure createdAt exists and is a number
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
            return docSnap.data().content; // Return the content object {ku_sorani: ..., ku_badini: ..., ar: ...}
        } else {
            return null; // No policies found
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
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Assuming you want order
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (typeof onUpdate === 'function') {
            onUpdate(links); // Pass the fetched links to the UI function
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
    // IMPORTANT: Replace with your actual Admin UID from Firebase Authentication
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // <<<--- UPDATE THIS
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        console.log("Admin user detected.");
        sessionStorage.setItem('isAdmin', 'true'); // Use sessionStorage for session-only admin status
         // Call the UI update function
         updateAdminUI(true);

        // Initialize admin-specific logic if available (admin.js should expose this)
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            // Check if DOM is ready, otherwise wait for load event
             if (document.readyState === 'complete') {
                 window.AdminLogic.initialize();
             } else {
                 // Defer initialization until the window is fully loaded
                 window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
            console.warn("AdminLogic.initialize function not found. Ensure admin.js is loaded.");
        }
        // Close login modal if open
        const loginModal = document.getElementById('loginModal');
         if (loginModal?.style.display === 'block') { // Use optional chaining
            closeCurrentPopup(); // Close the modal
        }
    } else {
        console.log("No admin user or non-admin user detected.");
        sessionStorage.removeItem('isAdmin'); // Remove admin status

         // Call the UI update function
         updateAdminUI(false);

        // Deinitialize admin logic if available
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
        // If a non-admin user is somehow signed in, sign them out immediately.
        if (user && auth) { // Check if auth is initialized
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
    // Update UI (show install button) - This should ideally be handled in ui-logic.js
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex'; // Show install button in settings
    }
    console.log('`beforeinstallprompt` event saved.');
}

/**
 * Triggers the PWA installation prompt if available.
 */
export async function triggerInstallPrompt() {
    const installBtn = document.getElementById('installAppBtn'); // Get button for hiding
    if (state.deferredPrompt) {
        if (installBtn) installBtn.style.display = 'none'; // Hide button after prompting
        try {
            state.deferredPrompt.prompt(); // Show the install prompt
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            state.deferredPrompt = null; // Clear the saved prompt, it can only be used once
        } catch (error) {
            console.error("Error showing install prompt:", error);
            // Optionally show error to user
        }
    } else {
        console.log("Deferred install prompt not available.");
        if (installBtn) installBtn.style.display = 'none'; // Hide button if no prompt
    }
}

/**
 * Registers the service worker and sets up update handling.
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');

            // --- Update Handling ---
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New worker installed & waiting, current page is controlled. Show update UI.
                            console.log("New SW installed and waiting. Showing update notification.");
                            if (updateNotification) updateNotification.classList.add('show');
                        }
                    });
                }
            });

            // --- Update Button Action ---
            if (updateNowBtn) {
                 updateNowBtn.addEventListener('click', () => {
                     // Check if there is a waiting worker
                     if (registration.waiting) {
                         console.log("Sending skipWaiting message to SW.");
                         // Send message to SW to skip waiting and activate immediately
                         registration.waiting.postMessage({ action: 'skipWaiting' });
                         // Optionally hide notification immediately, reload will happen on controllerchange
                         if (updateNotification) updateNotification.classList.remove('show');
                     } else {
                         console.log("No waiting service worker found to activate.");
                     }
                 });
            }

        }).catch(err => {
            console.error('Service Worker registration failed: ', err);
        });

        // --- Reload on Controller Change ---
        let refreshing = false; // Prevent multiple reloads
        navigator.serviceWorker.addEventListener('controllerchange', () => {
             if (refreshing) return;
             console.log('Controller changed. New Service Worker activated. Reloading page...');
             refreshing = true;
            window.location.reload();
        });
    } else {
        console.log("Service Worker not supported in this browser.");
    }
}


/**
 * Requests notification permission and saves the FCM token if granted.
 */
export async function requestNotificationPermissionAndToken() {
    console.log('Requesting notification permission...');
    if (!messaging) {
         console.error("Firebase Messaging is not initialized.");
         showNotification(t('error_generic') + " (Messaging)", 'error');
         return;
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notifications_enabled_success') || 'ئاگەدارییەکان چالاککران', 'success'); // Add translation key if needed

            // Get the FCM token
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken); // Save the token
            } else {
                console.log('No registration token available. Request permission to generate one.');
                // Usually happens if permission was denied previously and then granted,
                // or if cookies/site data were cleared. Might need to guide user.
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification(t('notifications_permission_denied') || 'مۆڵەت نەدرا', 'error'); // Add translation key if needed
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
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy checking/removal
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add userId if users log in: userId: auth.currentUser?.uid
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
        // Don't necessarily show error to user, maybe log it
    }
}

/**
 * Sets up the handler for receiving FCM messages while the app is in the foreground.
 */
export function setupForegroundMessageHandler() {
     if (!messaging) {
         console.warn("Firebase Messaging not initialized, cannot set up foreground handler.");
         return;
     }
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        // Customize notification display for foreground messages
        const title = payload.notification?.title || t('new_notification') || 'ئاگەداری نوێ';
        const body = payload.notification?.body || '';
        const icon = payload.notification?.icon; // Optional icon from payload

        showNotification(`${title}${body ? ': ' + body : ''}`, 'success'); // Use existing notification system

        // Optionally update the notification badge immediately
         const badge = document.getElementById('notificationBadge');
         if (badge) badge.style.display = 'block';

        // Optionally, if the notifications sheet is open, refresh it
        if (document.getElementById('notificationsSheet')?.classList.contains('show')) {
            fetchAnnouncements().then(announcements => renderUserNotificationsUI(announcements));
        }
    });
}


// --- Navigation & State Management ---

/**
 * Saves the current scroll position for the main page in history state.
 */
export function saveCurrentScrollPosition() {
    const currentState = history.state;
    const mainPage = document.getElementById('mainPage');
    // Only save scroll position if we are on the main page AND it's a filter/list view state (not a popup/page state)
    if (mainPage?.classList.contains('page-active') && currentState && !currentState.type) {
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

    // Update UI elements to reflect the new state
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) searchInput.value = state.currentSearch;
    if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Re-render category/subcategory bars to show active state
    renderMainCategories(state.categories); // Pass current categories
    const subcats = await fetchSubcategories(state.currentCategory);
    renderSubcategoriesUI(state.currentCategory, subcats); // Pass fetched subcategories
    // No need to render sub-subcategories on the main page list view

    // Fetch and render products based on the new filters (triggers UI update inside)
    await searchProducts(state.currentSearch, true); // true = new search

    // Restore scroll position if navigating back/forward
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Delay slightly to allow content rendering
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
         // Scroll to top for new filter actions (unless it's just loading more)
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Updates the browser history and triggers a filter state update.
 * @param {object} newState - Object containing changes to apply (e.g., {category: 'newId'}).
 */
export async function navigateToFilter(newState) {
    // 1. Save current scroll position before changing state
    saveCurrentScrollPosition(); // Uses history.replaceState

    // 2. Define the target state by merging current state (from history) with new changes
    const currentState = history.state || {}; // Get current state or default
    const targetState = {
        category: currentState.category || 'all',
        subcategory: currentState.subcategory || 'all',
        subSubcategory: currentState.subSubcategory || 'all',
        search: currentState.search || '',
        ...newState, // Apply incoming changes
        scroll: 0 // Always reset scroll for a new navigation action
    };

    // 3. Construct the new URL based on the target state
    const params = new URLSearchParams();
    if (targetState.category && targetState.category !== 'all') params.set('category', targetState.category);
    if (targetState.subcategory && targetState.subcategory !== 'all') params.set('subcategory', targetState.subcategory);
    if (targetState.subSubcategory && targetState.subSubcategory !== 'all') params.set('subSubcategory', targetState.subSubcategory);
    if (targetState.search) params.set('search', targetState.search);

     // Get base path without existing query string or hash
     const basePath = window.location.pathname;
    const queryString = params.toString();
    const newUrl = `${basePath}${queryString ? '?' + queryString : ''}`; // Add query string only if params exist

    // 4. Push the new state and URL to history
    history.pushState(targetState, '', newUrl);

    // 5. Apply the filter state to update the application UI and data
    await applyFilterState(targetState);
}


/**
 * Handles browser back/forward navigation (popstate event).
 * @param {PopStateEvent} event - The popstate event object.
 */
export async function handlePopstate(event) {
    console.log("Popstate event:", event.state);
    closeAllPopupsUI(); // Close any open modals/sheets first
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
             let pageTitle = popState.title;
             // Refetch title for subcategory page if missing (e.g., hard refresh)
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                     const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         const subCat = subCatSnap.data();
                         pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                         // Update the history state title now that we have it
                         history.replaceState({...popState, title: pageTitle}, '');
                     }
                 } catch (e) { console.error("Could not refetch title on popstate:", e); }
             }
             showPage(popState.id, pageTitle); // Show the correct page (from ui-logic)
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             // Re-open the specific popup (implementation depends on openPopup function)
             openPopup(popState.id, popState.type);
        } else {
             // Assume it's a filter state for the main page
             showPage('mainPage'); // Ensure main page is visible
             await applyFilterState(popState, true); // Apply filters and restore scroll (true=fromPopState)
        }
    } else {
         // No state - likely initial load or navigating back to initial state
         // Define a default state if needed, or rely on handleInitialPageLoad
         const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         showPage('mainPage');
         await applyFilterState(defaultState); // Apply default filters
    }
}


/**
 * Handles the initial page load, parsing URL parameters/hash
 * and setting the initial application state. Should be called
 * *after* essential data like categories are loaded.
 * @param {Array} [categories] - Optional: Pass loaded categories to avoid race conditions.
 */
export async function handleInitialPageLoad(categories) {
     console.log("Handling initial page load...");
     if (state.initialLoadComplete) {
         console.log("Initial load already handled.");
         return; // Prevent running multiple times
     }

     const hash = window.location.hash.substring(1);
     const params = new URLSearchParams(window.location.search);
     let initialStateHandled = false; // Flag to ensure only one initial state is applied

     // Case 1: Subcategory Detail Page via Hash
     if (hash.startsWith('subcategory_')) {
         const ids = hash.split('_');
         const mainCatId = ids[1];
         const subCatId = ids[2];
          // Get the name for the title
          let subCatName = 'Details'; // Default title
          try {
              const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
              const subCatSnap = await getDoc(subCatRef);
              if (subCatSnap.exists()) {
                   const subCat = subCatSnap.data();
                   subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
              }
          } catch (e) { console.error("Error fetching initial subcat name:", e); }

         // Replace history state for this page view
         history.replaceState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
         showPage('subcategoryDetailPage', subCatName); // Show the page UI
          // Render content for this page (sub-subs and products)
         await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Await rendering
         await renderProductsOnDetailPageUI(subCatId, 'all', ''); // Await rendering initial products

         initialStateHandled = true;
     }
     // Case 2: Settings Page via Hash
     else if (hash === 'settingsPage') {
          history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
          showPage('settingsPage', t('settings_title'));
          initialStateHandled = true;
     }

     // Case 3: Main Page (Default or with filters/popups)
     if (!initialStateHandled) {
          showPage('mainPage'); // Ensure main page container is active

          // Define initial filter state based on URL params or defaults
         const initialState = {
             category: params.get('category') || 'all',
             subcategory: params.get('subcategory') || 'all',
             subSubcategory: params.get('subSubcategory') || 'all',
             search: params.get('search') || '',
             scroll: 0 // Initial scroll is always 0
         };

         // Replace initial history entry with the parsed state
         const initialUrl = window.location.pathname + (window.location.search || '') + (hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage' ? '#' + hash : ''); // Preserve non-page hashes
         history.replaceState(initialState, '', initialUrl);

         // Apply the initial filters (fetches products/renders home)
         await applyFilterState(initialState); // Await the application

         // Check if a popup/sheet needs to be opened based on hash
         if (hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage') {
              const element = document.getElementById(hash);
              if (element) {
                   const isSheet = element.classList.contains('bottom-sheet');
                   const isModal = element.classList.contains('modal');
                   if (isSheet || isModal) {
                       // Open the popup *after* applying filters
                       openPopup(hash, isSheet ? 'sheet' : 'modal');
                       // Update history state to reflect the opened popup
                       history.replaceState({ ...initialState, type: isSheet ? 'sheet' : 'modal', id: hash }, '', initialUrl); // Overwrite state with popup info
                   }
              }
         }

          // Check if a specific product detail needs to be shown via query param
          const productId = params.get('product');
          if (productId) {
               // Use setTimeout to ensure the main page content is rendered first
               // and the product data might be available in the initial fetch
               setTimeout(() => showProductDetailsWithDataById(productId), 500); // New function to fetch if needed
          }

         initialStateHandled = true; // Mark as handled
     }
     console.log("Initial page handling done.");
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
     showProductDetailsWithData(product); // Assumes this function is in ui-logic.js
}

