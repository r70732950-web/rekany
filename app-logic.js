// data-logic.js
// Handles data fetching, state management, cart, favorites, profile logic.

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, // Ensure these are imported from app-setup
    state, CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE
} from './app-setup.js';

import {
    collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";


// Import UI functions needed for updates after data changes
import {
    renderProducts, renderCart, updateCartCount, renderFavoritesPage,
    renderUserNotificationsUI, renderPoliciesUI, renderContactLinksUI,
    showNotification, t, renderSubcategoriesUI, renderSubSubcategoriesUI,
    renderSkeletonLoader, updateCategoryDependentUI, showPage, updateHeaderView,
    renderMainCategories, renderCategoriesSheet, closeAllPopupsUI,
    renderSubSubcategoriesOnDetailPage, renderProductsOnDetailPageUI,
    createProductCardElement, createPromoCardElement, // Might be needed if home layout renders from here
    renderNewestProductsSection, renderAllProductsSection, renderBrandsSection,
    renderSingleCategoryRow, renderSingleShortcutRow, renderHomePageContent, // Import home page rendering functions
    updateAdminUI // Need this for auth changes
} from './ui-logic.js';
import { clearProductCache } from './admin-helpers.js'; // Assuming admin-helpers.js

// --- Authentication ---

/**
 * Handles authentication state changes.
 * @param {object | null} user - The Firebase user object or null.
 */
export async function handleAuthStateChange(user) {
    // IMPORTANT: Use the actual Admin UID from your Firebase project
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false'); // Update session storage

    updateAdminUI(isAdmin); // Update general UI elements visibility

    if (isAdmin) {
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            // Ensure admin logic is loaded before initializing
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                 window.AdminLogic.initialize();
             } else {
                  // Defer initialization slightly if DOM isn't fully ready yet
                  window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
            console.warn("AdminLogic not found or initialize not a function during auth change.");
             // Attempt to load admin.js dynamically if needed (advanced)
             /*
             if (!window.AdminLogic) {
                 const script = document.createElement('script');
                 script.src = 'admin.js';
                 script.defer = true;
                 script.onload = () => {
                     if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                         window.AdminLogic.initialize();
                     }
                 };
                 document.body.appendChild(script);
             }
             */
        }
    } else {
        // Not admin or logged out
        if (user) {
            // If a non-admin user is somehow signed in, sign them out.
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Clean up admin UI elements
        }
    }

    // Close login modal if user successfully logs in as admin
    const loginModal = document.getElementById('loginModal'); // Get reference if needed
    if (loginModal && loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup(); // Assuming closeCurrentPopup handles UI
    }

     // Trigger a re-render of products to update admin buttons visibility
     searchProducts(state.currentSearch, true);
}


// --- Firestore Persistence ---

export function initializeFirestorePersistence(callback) {
     enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            callback(true); // Indicate success
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            callback(false); // Indicate failure
        });
}

// --- Category Data ---

export function setupCategoryListener(callback) {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    return onSnapshot(categoriesQuery, (snapshot) => { // Return the unsubscribe function
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Update state directly here or pass data to callback
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories]; // Add 'All' category correctly
        callback(state.categories); // Pass updated categories to the callback
    }, (error) => {
        console.error("Error fetching categories:", error);
         // Handle error, maybe show a message to the user
    });
}


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
        console.error("Error fetching subcategories: ", error);
        return []; // Return empty array on error
    }
}

export async function fetchSubSubcategories(mainCatId, subCatId) {
     if (!mainCatId || !subCatId || subCatId === 'all') {
        return [];
    }
    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching sub-subcategories:", error);
        return [];
    }
}


// --- Product Data & Filtering ---

/**
 * Saves the current scroll position in history state for restoration.
 */
export function saveCurrentScrollPosition() {
    const currentState = history.state;
     // Only save scroll position for the main page filter state or subcategory page
    const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
    const subcatDetailPageActive = document.getElementById('subcategoryDetailPage')?.classList.contains('page-active');

    if ((mainPageActive && currentState && !currentState.type) || subcatDetailPageActive) {
         try {
             // Use structuredClone for potentially complex states, fallback otherwise
             const newState = typeof structuredClone === 'function' ? structuredClone(currentState) : JSON.parse(JSON.stringify(currentState));
             newState.scroll = window.scrollY;
             history.replaceState(newState, '');
         } catch (e) {
             console.warn("Could not save scroll position:", e);
              // Fallback for complex unserializable state (less likely now)
             history.replaceState({ ...currentState, scroll: window.scrollY }, '');
         }
    }
}


/**
 * Applies the filter state (category, search) and updates the UI.
 * @param {object} filterState - The state to apply (category, subcategory, subSubcategory, search, scroll).
 * @param {boolean} [fromPopState=false] - Whether this call is from a history popstate event.
 */
export async function applyFilterState(filterState, fromPopState = false) {
    const needsUIClear = state.currentCategory !== filterState.category ||
                         state.currentSubcategory !== filterState.subcategory ||
                         state.currentSubSubcategory !== filterState.subSubcategory;

    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input visuals
    const mainSearchInput = document.getElementById('searchInput');
    const mainClearBtn = document.getElementById('clearSearchBtn');
    if (mainSearchInput) mainSearchInput.value = state.currentSearch;
    if (mainClearBtn) mainClearBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Update category button visuals
    renderMainCategories(state.categories); // Re-render main categories to update active state

    // Fetch and render subcategories or hide if 'all' is selected
    const subcategoriesData = await fetchSubcategories(state.currentCategory);
    await renderSubcategoriesUI(state.currentCategory, subcategoriesData);

    // Fetch and render sub-subcategories if needed
    const subSubcategoriesData = await fetchSubSubcategories(state.currentCategory, state.currentSubcategory);
    await renderSubSubcategoriesUI(state.currentCategory, state.currentSubcategory, subSubcategoriesData);

    // Fetch and render products based on the new filters
    await searchProducts(state.currentSearch, true); // `true` indicates a new search/filter

    // Restore scroll position if navigating back/forward
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Use timeout to allow content to render before scrolling
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        // Scroll to top for new filter actions, unless it was just a search term change
         if (needsUIClear) { // Only scroll to top if categories changed, not just search
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

/**
 * Updates the browser history and triggers a state update for filtering.
 * @param {object} newStateChanges - The specific filter changes (e.g., { category: 'newId' }).
 */
export async function navigateToFilter(newStateChanges) {
     // Save current scroll position before changing state
    saveCurrentScrollPosition();

     // Create the target state by merging current state with changes
    const targetState = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: 0, // Reset scroll for new navigation
        ...newStateChanges // Apply the specific changes
    };

    // Construct URL parameters based on the target state
    const params = new URLSearchParams();
    if (targetState.category && targetState.category !== 'all') params.set('category', targetState.category);
    if (targetState.subcategory && targetState.subcategory !== 'all') params.set('subcategory', targetState.subcategory);
    if (targetState.subSubcategory && targetState.subSubcategory !== 'all') params.set('subSubcategory', targetState.subSubcategory);
    if (targetState.search) params.set('search', targetState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

     // Use pushState to add a new entry in history
    history.pushState(targetState, '', newUrl);

     // Apply the new filter state to update the UI
    await applyFilterState(targetState, false); // false indicates it's not from popstate
}


/**
 * Fetches products from Firestore based on current filters and search term.
 * Handles pagination (infinite scroll).
 * @param {string} [searchTerm=''] - The search term.
 * @param {boolean} [isNewSearch=false] - Whether this is a new search/filter or loading more.
 */
export async function searchProducts(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    // --- Home Page Rendering Logic ---
    if (shouldShowHomeSections) {
        if (productsContainer) productsContainer.style.display = 'none';
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (scrollTrigger) scrollTrigger.style.display = 'none';
        if (homeSectionsContainer) {
             homeSectionsContainer.style.display = 'block';
             // Only render if empty or if it's a new navigation to home
             if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) {
                 await renderHomePageContent(); // Render home content (defined in ui-logic.js)
             }
         }
        return;
    } else {
        // Hide home sections if filtering/searching
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'none';
        // Stop all promo rotations when navigating away from the full home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals
    }
    // --- End Home Page Rendering Logic ---


    // Basic safety checks
    if (!productsContainer || !scrollTrigger || !loader) {
        console.error("Required elements for searchProducts not found.");
        return;
    }

    // --- Cache Check (for new searches only) ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        if (skeletonLoader) skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';

        renderProducts(state.products, sessionStorage.getItem('isAdmin') === 'true'); // Pass admin status
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }
    // --- End Cache Check ---


    if (state.isLoadingMoreProducts && !isNewSearch) return; // Prevent concurrent loads
    if (state.allProductsLoaded && !isNewSearch) return; // Don't load more if all loaded


    state.isLoadingMoreProducts = true;
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        productsContainer.innerHTML = ''; // Clear previous products
        renderSkeletonLoader(); // Show skeleton loader for new search/filter
    } else {
        loader.style.display = 'block'; // Show bottom loader when loading more
    }


    try {
        let productsQuery = collection(db, "products");
        let queryConstraints = []; // Array to hold where and orderBy clauses

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            queryConstraints.push(where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            queryConstraints.push(where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            queryConstraints.push(where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
             // Firestore requires the first orderBy to match the inequality field
             queryConstraints.push(where('searchableName', '>=', finalSearchTerm));
             queryConstraints.push(where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
             queryConstraints.push(orderBy("searchableName", "asc")); // First orderBy
        }

        // Apply primary sorting (createdAt desc) - add as secondary if searching
         queryConstraints.push(orderBy("createdAt", "desc"));


        // Apply pagination (startAfter)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            queryConstraints.push(startAfter(state.lastVisibleProductDoc));
        }

        // Apply limit
        queryConstraints.push(limit(PRODUCTS_PER_PAGE));

        // Construct the final query
        productsQuery = query(productsCollection, ...queryConstraints);


        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));


        if (isNewSearch) {
            state.products = newProducts;
        } else {
             // Prevent duplicates when loading more (though Firestore cursors should handle this)
             const existingIds = new Set(state.products.map(p => p.id));
             const uniqueNewProducts = newProducts.filter(p => !existingIds.has(p.id));
            state.products = [...state.products, ...uniqueNewProducts];
        }

        // Update pagination state
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
             state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block';
        }

        // Cache results for new searches
        if (isNewSearch) {
             if (!state.productCache) state.productCache = {}; // Initialize cache if needed
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render the products
        if (skeletonLoader) skeletonLoader.style.display = 'none'; // Hide skeleton
        loader.style.display = 'none'; // Hide bottom loader
        productsContainer.style.display = 'grid';
        renderProducts(state.products, sessionStorage.getItem('isAdmin') === 'true'); // Pass admin status


        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching/searching products:", error);
         if (productsContainer) productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
    } finally {
        state.isLoadingMoreProducts = false;
    }
}


// --- Cart Logic ---

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount(); // Update UI count immediately
}

export function addToCart(productId) {
    // Attempt to find product in already loaded state.products first
    let product = state.products.find(p => p.id === productId);

    const processAddToCart = (productData) => {
         if (!productData) {
             console.error(`Product data not found for ID: ${productId}`);
             showNotification(t('product_not_found_error'), 'error');
             return;
         }
         const mainImage = (productData.imageUrls && productData.imageUrls.length > 0) ? productData.imageUrls[0] : (productData.image || '');
         const existingItemIndex = state.cart.findIndex(item => item.id === productId);

         if (existingItemIndex > -1) {
             state.cart[existingItemIndex].quantity++;
         } else {
             state.cart.push({
                 id: productData.id,
                 name: productData.name, // Store the multilingual name object
                 price: productData.price,
                 image: mainImage,
                 quantity: 1
             });
         }
         saveCart();
         // showNotification is called in createProductCardElement's click handler
         // If called from elsewhere, add showNotification here.
         // showNotification(t('product_added_to_cart'));
    };

    if (product) {
         processAddToCart({ id: product.id, ...product }); // Pass a copy
    } else {
        console.warn(`Product ${productId} not found in state.products. Fetching from DB...`);
        // Fetch from DB if not found locally
        getDoc(doc(db, "products", productId))
            .then(docSnap => {
                if (docSnap.exists()) {
                    processAddToCart({ id: docSnap.id, ...docSnap.data() });
                } else {
                     console.error(`Product ${productId} not found in DB either.`);
                     showNotification(t('product_not_found_error'), 'error');
                }
            })
            .catch(error => {
                console.error("Error fetching product for cart:", error);
                showNotification(t('error_generic'), 'error');
            });
    }
}


export function updateQuantity(productId, change) {
    const cartItemIndex = state.cart.findIndex(item => item.id === productId);
    if (cartItemIndex > -1) {
        state.cart[cartItemIndex].quantity += change;
        if (state.cart[cartItemIndex].quantity <= 0) {
            removeFromCart(productId); // Remove if quantity is zero or less
        } else {
            saveCart();
            renderCart(state.cart); // Re-render the cart UI
        }
    }
}

export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(state.cart); // Re-render the cart UI
}

export function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    let currentTotal = 0;
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
        currentTotal += item.price * item.quantity;
    });
    message += `\n${t('order_total')}: ${currentTotal.toLocaleString()} د.ع.\n`;

    if (state.userProfile.name || state.userProfile.address || state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        if(state.userProfile.name) message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        if(state.userProfile.address) message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        if(state.userProfile.phone) message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}


// --- Favorites Logic ---

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// toggleFavorite now only manages the data state
export function toggleFavorite(productId) {
    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // The UI update (button class toggle) should happen in the event listener (ui-logic or app-main)
    // after calling this data function. If the favorites sheet is open, trigger its re-render.
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage(state.favorites, sessionStorage.getItem('isAdmin') === 'true');
    }
}

// --- Profile Logic ---

export function saveProfile(profileData) {
    state.userProfile = profileData;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
    showNotification(t('profile_saved'), 'success');
}

export function loadProfile() {
    state.userProfile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    // Update profile form UI if needed (might be better handled when opening the sheet)
}

// --- Notifications & Policies ---

export function setupAnnouncementsListener(callback) {
     // Listen for the latest announcement to update the badge
     const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
     return onSnapshot(q, (snapshot) => { // Return unsubscribe function
        let showBadge = false;
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = parseInt(localStorage.getItem('lastSeenAnnouncementTimestamp') || '0', 10);
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                showBadge = true;
            }
        }
        callback(showBadge); // Pass boolean to UI update function
     }, (error) => {
        console.error("Error listening for announcements:", error);
     });
}

export async function fetchAnnouncements() {
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching announcements:", error);
        return [];
    }
}

export async function fetchPolicies() {
     try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error fetching policies:", error);
        return null;
    }
}

export function setupContactLinksListener(callback) {
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Assuming createdAt exists
    return onSnapshot(q, (snapshot) => { // Return unsubscribe function
        const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(links); // Pass data to UI rendering function
    }, (error) => {
        console.error("Error fetching contact links:", error);
        callback([]); // Pass empty array on error
    });
}


// --- PWA & Service Worker ---

export function saveDeferredPrompt(e) {
    state.deferredPrompt = e;
     // Update UI notify the user they can install the PWA
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex'; // Show install button in settings
    }
    console.log('`beforeinstallprompt` event was fired and saved.');
}

export async function triggerInstallPrompt() {
     const installBtn = document.getElementById('installAppBtn'); // Maybe pass button as arg
    if (state.deferredPrompt && installBtn) {
        installBtn.style.display = 'none'; // Hide the button after prompting
        state.deferredPrompt.prompt();
        try {
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
        } catch (error) {
            console.error("Error during install prompt:", error);
        } finally {
            state.deferredPrompt = null; // Clear the saved prompt
        }
    } else {
        console.log("Deferred prompt not available or install button not found.");
    }
}

// --- Navigation & History --- (Keep core navigation logic separate)

/**
 * Opens a popup (modal or sheet) and updates history.
 * @param {string} id - The ID of the element to open.
 * @param {string} [type='sheet'] - The type ('sheet' or 'modal').
 */
export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups

    if (type === 'sheet') {
        sheetOverlay?.classList.add('show'); // Add check
        element.classList.add('show');
        // Trigger specific content rendering based on sheet ID
        if (id === 'cartSheet') renderCart(state.cart); // Pass current cart data
        if (id === 'favoritesSheet') renderFavoritesPage(state.favorites, sessionStorage.getItem('isAdmin') === 'true'); // Pass current favorites and admin status
        if (id === 'categoriesSheet') renderCategoriesSheet(state.categories); // Pass categories
        if (id === 'notificationsSheet') {
             fetchAnnouncements().then(announcements => renderUserNotificationsUI(announcements)); // Fetch and render
         }
        if (id === 'termsSheet') {
             fetchPolicies().then(policies => renderPoliciesUI(policies)); // Fetch and render
         }
        if (id === 'profileSheet') {
             // Populate profile form from state
             const profileNameInput = document.getElementById('profileName');
             const profileAddressInput = document.getElementById('profileAddress');
             const profilePhoneInput = document.getElementById('profilePhone');
             if(profileNameInput) profileNameInput.value = state.userProfile.name || '';
             if(profileAddressInput) profileAddressInput.value = state.userProfile.address || '';
             if(profilePhoneInput) profilePhoneInput.value = state.userProfile.phone || '';
        }
    } else { // Modal
        element.style.display = 'block';
    }

    document.body.classList.add('overlay-active');

    // Push state for popup
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

/**
 * Closes the currently open popup by triggering a history back operation.
 */
export function closeCurrentPopup() {
    // Check if the current history state represents a popup
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // This will trigger the popstate listener which calls closeAllPopupsUI
    } else {
        // Fallback if history state is not as expected
        closeAllPopupsUI();
    }
}

/**
 * Handles the popstate event for navigation and closing popups.
 */
export async function handlePopstate(event) {
    closeAllPopupsUI(); // Close any open popups first
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
             // Refetch title if needed (e.g., for subcategory detail page)
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                     const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         const subCat = subCatSnap.data();
                         pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                         // Update the history state title silently
                         history.replaceState({...popState, title: pageTitle}, '');
                     }
                 } catch(e) { console.error("Could not refetch title on popstate", e) }
             }
            showPage(popState.id, pageTitle);
             // If navigating *back* to the main page, restore filter state
             if (popState.id === 'mainPage' && popState.category !== undefined) {
                 await applyFilterState(popState, true); // true for fromPopState
             }
             // If navigating *back* to subcategory page, restore scroll
             else if (popState.id === 'subcategoryDetailPage' && typeof popState.scroll === 'number') {
                  setTimeout(() => window.scrollTo(0, popState.scroll), 50);
             }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             // Re-open the popup based on history state (should usually be handled by browser back closing it)
             // This case might be redundant if closeAllPopupsUI is called first
             // openPopup(popState.id, popState.type);
             // Instead, ensure the underlying page's filter state is correct
             const previousState = history.state; // Get state before the popup
             if (previousState && previousState.category !== undefined) {
                 await applyFilterState(previousState, true);
             } else {
                 await applyFilterState({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 }, true);
             }

        } else { // It's a filter state for the main page
             showPage('mainPage'); // Ensure main page is visible
            await applyFilterState(popState, true); // Apply filters and scroll
        }
    } else {
        // No state, assume it's the initial main page state
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         showPage('mainPage');
        await applyFilterState(defaultState, true);
    }
}

/**
 * Handles the initial page load, parsing URL parameters and hash.
 */
export async function handleInitialPageLoad(categories) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');

    let initialPageState = null;
    let initialPopupState = null;

    // Determine target page from hash
    if (hash.startsWith('subcategory_')) {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        let subCatName = 'Details';
         try { // Fetch title immediately
             const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
             const subCatSnap = await getDoc(subCatRef);
             if (subCatSnap.exists()) {
                 const subCat = subCatSnap.data();
                 subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
             }
         } catch(e) {console.error("Failed to get initial subcat name", e)}

        initialPageState = { type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId, scroll: 0 };
         // Render the page content after setting state
         showPage(initialPageState.id, initialPageState.title);
         await renderSubSubcategoriesOnDetailPage(await fetchSubSubcategories(mainCatId, subCatId), subCatId);
         await renderProductsOnDetailPageUI(subCatId, 'all', ''); // Load initial products

    } else if (hash === 'settingsPage') {
        initialPageState = { type: 'page', id: 'settingsPage', title: t('settings_title'), scroll: 0 };
        showPage(initialPageState.id, initialPageState.title);
    } else {
        // Default to main page with filters from query params
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Will be restored by browser potentially, or set later
        };
        initialPageState = initialState; // Main page filters are the 'page' state
         showPage('mainPage'); // Show main page container
         await applyFilterState(initialState, false); // Apply filters (not from popstate)

         // Check if hash points to a popup on the main page
         const element = document.getElementById(hash);
         if (element) {
             const isSheet = element.classList.contains('bottom-sheet');
             const isModal = element.classList.contains('modal');
             if (isSheet || isModal) {
                 initialPopupState = { type: isSheet ? 'sheet' : 'modal', id: hash };
                 openPopup(hash, initialPopupState.type); // Open popup, adds its own history entry
             }
         }
    }

    // Replace initial history entry with the determined state
     history.replaceState(initialPageState, '');

     // If there was a popup state, push it after replacing the initial page state
     if(initialPopupState) {
         // The openPopup function already pushes the state, so no need to push again here.
         // history.pushState(initialPopupState, '', `#${initialPopupState.id}`);
     }


    // Handle direct product link after initial page/filter state is set
    if (productId && !initialPopupState) { // Avoid opening if another popup is already open via hash
        // Delay slightly to ensure necessary data/UI might be ready
        setTimeout(async () => {
             try {
                const docSnap = await getDoc(doc(db, "products", productId));
                if (docSnap.exists()) {
                    const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                    // showProductDetailsWithData needs to be exported from ui-logic
                    // showProductDetailsWithData(fetchedProduct); // Function now in ui-logic
                     // Instead of calling UI directly, maybe just open the popup
                     openPopup('productDetailSheet', 'sheet'); // Assumes ui-logic's openPopup handles rendering details
                } else {
                    showNotification(t('product_not_found_error'), 'error');
                }
             } catch (error) {
                 console.error("Error fetching direct product link:", error);
                 showNotification(t('error_generic'), 'error');
             }
        }, 500);
    }
}

// --- Service Worker ---

export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');

            // Track updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                         // Show update notification bar only if elements exist
                         if (updateNotification) updateNotification.classList.add('show');
                    }
                });
            });

             // Update button listener
             if(updateNowBtn && registration.waiting) { // Check if waiting worker exists
                 updateNowBtn.addEventListener('click', () => {
                     registration.waiting.postMessage({ action: 'skipWaiting' });
                     if (updateNotification) updateNotification.classList.remove('show'); // Hide immediately
                 });
             } else if (updateNowBtn) {
                  // Handle case where button exists but no waiting worker (might happen briefly)
                  console.log("Update button found, but no waiting service worker.");
             }


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

// --- Notifications ---

export async function requestNotificationPermissionAndToken() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success'); // Translate if needed
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Use your actual VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available. Request permission required or SW not ready.');
                 showNotification('نەتوانرا تۆکن وەربگیرێت. تکایە دڵنیابە لە مۆڵەتی ئاگەداری.', 'error');
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification('مۆڵەت نەدرا', 'error'); // Translate if needed
        }
    } catch (error) {
        console.error('An error occurred while requesting permission or getting token: ', error);
         showNotification('هەڵەیەک ڕوویدا لە کاتی داواکردنی مۆڵەت/تۆکن.', 'error');
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy checking/updates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add user ID here if users log in
            // userId: auth.currentUser ? auth.currentUser.uid : null
        }, { merge: true }); // Use merge to update timestamp if token already exists
        console.log('Token saved/updated in Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

export function setupForegroundMessageHandler() {
     if (!messaging) return; // Only if messaging is initialized
     onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'ئاگەداری نوێ';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success'); // Use existing notification system
        // Optionally update the notification badge immediately
        const badge = document.getElementById('notificationBadge');
        if (badge) badge.style.display = 'block';
    });
}
