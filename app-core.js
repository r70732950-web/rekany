// app-core.js: Core logic, Firebase interactions, state management (Fixed Errors)

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
    if (window.AppUI && typeof window.AppUI.updateCartCount === 'function') {
        window.AppUI.updateCartCount(); // Update UI count immediately after saving
    }
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

/** Sets the ID of the product currently being edited (for admin). */
export function setEditingProductId(id) {
    state.editingProductId = id;
}

/** Gets the ID of the product currently being edited (for admin). */
export function getEditingProductId() {
    return state.editingProductId;
}

/** Gets the currently loaded categories (for admin). */
export function getCategories() {
    return state.categories;
}

/** Gets the current language setting (for admin). */
export function getCurrentLanguage() {
    return state.currentLanguage;
}


// --- Firebase & Data Fetching ---

/**
 * Fetches products from Firestore based on current filters and search term.
 * Handles pagination and caching.
 * @param {string} [searchTerm=''] The search term.
 * @param {boolean} [isNewSearch=false] Whether this is a new search or loading more.
 */
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    // Ensure AppUI is available before proceeding
     if (!window.AppUI) {
        console.warn("searchProductsInFirestore called before AppUI is ready.");
        // Optionally, retry after a short delay
        // setTimeout(() => searchProductsInFirestore(searchTerm, isNewSearch), 100);
        return;
    }

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
            // Append new products, avoiding duplicates just in case
            const currentIds = new Set(state.products.map(p => p.id));
            const uniqueNewProducts = newProducts.filter(p => !currentIds.has(p.id));
            state.products = [...state.products, ...uniqueNewProducts];
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
        // Ensure 'All' category has names for all languages for consistency
        const allCategoryNameObj = {
            ku_sorani: t('all_categories_label', { lang: 'ku_sorani' }),
            ku_badini: t('all_categories_label', { lang: 'ku_badini' }),
            ar: t('all_categories_label', { lang: 'ar' })
        };
        state.categories = [{ id: 'all', icon: 'fas fa-th', ...allCategoryNameObj }, ...fetchedCategories]; // Add 'All' category

        // Trigger UI update related to categories (ensure AppUI exists)
        if (window.AppUI && typeof window.AppUI.updateCategoryDependentUI === 'function') {
            window.AppUI.updateCategoryDependentUI();
        } else {
            console.warn("Category listener fired before AppUI was ready.");
        }

        // Handle initial page load based on URL *after* categories are loaded
        if (!state.initialLoadHandled) {
             handleInitialPageLoad(); // Now safe to call as categories are available
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
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order consistently

    onSnapshot(q, (snapshot) => {
        const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Trigger UI update for contact links (check if AppUI exists)
        if (window.AppUI && typeof window.AppUI.renderContactLinks === 'function') {
            window.AppUI.renderContactLinks(links);
        }
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
        // Trigger UI update for cart action buttons (check if AppUI exists)
        // FIX: Check if AppUI and the function exist before calling
        if (window.AppUI && typeof window.AppUI.updateCartActionButtons === 'function') {
            window.AppUI.updateCartActionButtons();
        } else {
             console.warn("Contact methods updated, but AppUI.updateCartActionButtons not ready.");
             // Optionally queue the update or handle later
        }
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
            // Trigger UI update for notification badge (check if AppUI exists)
            if (window.AppUI && typeof window.AppUI.updateNotificationBadge === 'function') {
                 window.AppUI.updateNotificationBadge(showBadge);
            }
        }
    }, (error) => {
        console.error("Error checking announcements:", error);
    });
}

/** Fetches announcements for the notification sheet. */
export async function fetchAnnouncementsForSheet() {
     // Ensure AppUI is available
     if (!window.AppUI) {
        console.warn("fetchAnnouncementsForSheet called before AppUI is ready.");
        return;
    }
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Find the latest timestamp among fetched announcements
        let latestTimestamp = 0;
        if (!snapshot.empty) {
            // Ensure createdAt exists and is a number before comparison
            const firstDocData = snapshot.docs[0].data();
            if (firstDocData && typeof firstDocData.createdAt === 'number') {
                latestTimestamp = firstDocData.createdAt;
            } else {
                // Fallback or log error if createdAt is missing/invalid
                console.warn("Latest announcement missing valid createdAt timestamp:", firstDocData);
                 // Find the max timestamp manually just in case the first isn't the latest due to potential data issues
                 announcements.forEach(ann => {
                    if (ann && typeof ann.createdAt === 'number' && ann.createdAt > latestTimestamp) {
                        latestTimestamp = ann.createdAt;
                    }
                 });
            }
        }


        // Update last seen timestamp and trigger UI update
        if (latestTimestamp > 0) { // Only update if a valid timestamp was found
             localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        }
        window.AppUI.renderUserNotifications(announcements); // Pass data to UI function
        window.AppUI.updateNotificationBadge(false); // Hide badge after opening

    } catch (error) {
        console.error("Error fetching announcements:", error);
        window.AppUI.renderUserNotifications([]); // Render empty state on error
    }
}


/** Fetches policies from Firestore. */
export async function fetchPolicies() {
     // Ensure AppUI is available
     if (!window.AppUI) {
        console.warn("fetchPolicies called before AppUI is ready.");
        return;
    }
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
        // Store in state (optional, could just return)
        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return state.subcategories;
    } catch (error) {
        console.error(`Error fetching subcategories for ${categoryId}:`, error);
        return []; // Return empty array on error
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
        return []; // Return empty array on error
    }
}

/** Fetches products for the subcategory detail page. */
export async function fetchProductsForDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    try {
        let productsQuery;
        // Base query based on sub or sub-sub category
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Order by searchableName first when searching
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default order when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);
        return productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        return []; // Return empty array on error
    }
}

/** Fetches related products based on category/subcategory. */
export async function fetchRelatedProducts(currentProduct) {
    // Determine the most specific category available
    let queryField, queryValue;
    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = currentProduct.subcategoryId;
    } else if (currentProduct.categoryId) {
        queryField = 'categoryId';
        queryValue = currentProduct.categoryId;
    } else {
        return []; // Cannot find related if no category info
    }

    // Query for products in the same category, excluding the current one
    const q = query(
        productsCollection,
        where(queryField, '==', queryValue),
        where('__name__', '!=', currentProduct.id), // Exclude the product itself
        limit(6) // Limit the number of related products
        // Optionally add orderBy('createdAt', 'desc') or similar
    );

    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching related products:", error);
        return []; // Return empty array on error
    }
}


// --- Cart Logic ---

/** Adds a product to the cart or increments its quantity. */
export function addToCart(productId) {
    // Ensure AppUI is available for notifications
     if (!window.AppUI) {
        console.warn("addToCart called before AppUI is ready.");
        return; // Or queue the action
    }

    // Find product details (prioritize local state, fallback to fetch if needed)
    let product = state.products.find(p => p.id === productId);

    const processAddToCart = (productData) => {
        // Ensure productData is valid before proceeding
         if (!productData || !productData.id || !productData.price) {
             console.error("Invalid product data for cart:", productData);
             window.AppUI.showNotification(t('error_generic'), 'error');
             return;
         }

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
        saveCart(); // This now calls AppUI.updateCartCount internally
        window.AppUI.showNotification(t('product_added_to_cart'), 'success');
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
            // Trigger UI update (check if AppUI exists)
            if (window.AppUI && typeof window.AppUI.renderCart === 'function') {
                window.AppUI.renderCart();
            }
        }
    }
}

/** Removes an item completely from the cart. */
export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart(); // This will also update the count via AppUI
    // Trigger UI update (check if AppUI exists)
     if (window.AppUI && typeof window.AppUI.renderCart === 'function') {
        window.AppUI.renderCart();
    }
}

// --- Favorites Logic ---

/** Toggles a product's favorite status. */
export function toggleFavorite(productId) {
    // Ensure AppUI is available for notifications and UI updates
     if (!window.AppUI) {
        console.warn("toggleFavorite called before AppUI is ready.");
        return;
    }

    const isCurrentlyFavorite = isFavorite(productId);
    let messageKey = '';
    let messageType = 'success';

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        messageKey = 'product_removed_from_favorites';
        messageType = 'error'; // Use error style for removal
    } else {
        state.favorites.push(productId);
        messageKey = 'product_added_to_favorites';
    }
    saveFavorites(); // Save the updated list

    // Trigger UI updates using AppUI functions
    window.AppUI.showNotification(t(messageKey), messageType);
    window.AppUI.updateFavoriteButtons(productId, !isCurrentlyFavorite);
    window.AppUI.updateFavoritesPageIfOpen();
}


// --- Authentication & Admin ---

/** Sets up the listener for Firebase Authentication state changes. */
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        // IMPORTANT: Use the actual Admin UID from your Firebase project
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
        const isAdmin = user && user.uid === adminUID;

        // Use sessionStorage which is cleared when the tab/browser is closed
        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');

        if (isAdmin) {
            console.log("Admin user detected.");
             // Load admin script dynamically if not already loaded (more robust)
             if (!window.AdminLogic) {
                const adminScript = document.createElement('script');
                adminScript.src = 'admin.js';
                adminScript.defer = true;
                adminScript.onload = () => {
                    if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                        window.AdminLogic.initialize();
                         // Update UI after admin logic is initialized
                         if (window.AppUI && typeof window.AppUI.updateAdminSpecificUI === 'function') {
                            window.AppUI.updateAdminSpecificUI(true);
                        }
                    } else {
                         console.error("admin.js loaded but AdminLogic.initialize not found.");
                    }
                };
                adminScript.onerror = () => console.error("Failed to load admin.js");
                document.body.appendChild(adminScript);
            } else if (typeof window.AdminLogic.initialize === 'function') {
                // If already loaded, just initialize
                window.AdminLogic.initialize();
            }
        } else {
            console.log("No admin user or non-admin user detected.");
            if (user) {
                // If a non-admin user is somehow signed in, sign them out.
                try {
                    await signOut(auth);
                    console.log("Non-admin user signed out.");
                } catch (signOutError) {
                    console.error("Error signing out non-admin user:", signOutError);
                }
            }
             // Deinitialize admin UI elements if the logic exists and is initialized
             if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                window.AdminLogic.deinitialize();
            }
        }

        // Trigger UI update based on admin status (might run before admin.js loads, but sets initial state)
         if (window.AppUI && typeof window.AppUI.updateAdminSpecificUI === 'function') {
             window.AppUI.updateAdminSpecificUI(isAdmin);
        }

        // Close login modal if admin logs in successfully
        if (window.AppUI && window.AppUI.isModalOpen('loginModal') && isAdmin) {
             window.AppUI.closeCurrentPopup();
        }
    });
}


// --- Notifications & PWA ---

/** Requests permission for push notifications and saves the token. */
export async function requestNotificationPermission() {
    // Ensure AppUI is available for notifications
     if (!window.AppUI) {
        console.warn("requestNotificationPermission called before AppUI is ready.");
        return;
    }
    console.log('Requesting notification permission...');
    try {
        // Check current permission state first
        if (Notification.permission === 'granted') {
             console.log('Notification permission already granted.');
             window.AppUI.showNotification('مۆڵەتی ئاگەداری پێشتر دراوە.', 'success');
             // Proceed to get and save token
        } else if (Notification.permission === 'denied') {
            console.log('Notification permission was previously denied.');
            window.AppUI.showNotification('مۆڵەتی ئاگەداری ڕەتکراوەتەوە. تکایە لە ڕێکخستنەکانی وێبگەڕەکەت چاکی بکە.', 'error');
            return; // Don't request again if denied
        }

        // If permission is 'default', request it
        const permissionResult = await Notification.requestPermission();

        if (permissionResult === 'granted') {
            console.log('Notification permission granted.');
            window.AppUI.showNotification(t('notification_permission_granted', { lang: state.currentLanguage }), 'success');
            // Get and save the token
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            }).catch(err => { // Catch errors during getToken specifically
                console.error('Error retrieving FCM token:', err);
                 window.AppUI.showNotification('هەڵە لە وەرگرتنی تۆکن ڕوویدا.', 'error');
                 return null; // Return null if token retrieval fails
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                 console.log('No registration token available or error retrieving token.');
                 // Optionally inform the user if token retrieval failed after permission grant
                 if (Notification.permission === 'granted') {
                     // We already showed an error if getToken failed
                 }
            }
        } else {
            console.log('User denied notification permission.');
            window.AppUI.showNotification(t('notification_permission_denied', { lang: state.currentLanguage }), 'error');
        }
    } catch (error) {
        console.error('An error occurred during notification permission request: ', error);
         window.AppUI.showNotification(t('error_generic'), 'error');
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
            lastUpdated: Date.now() // Add a timestamp for last update
        }, { merge: true }); // Use merge to avoid overwriting if token exists
        console.log('Token saved/updated in Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
        // Optionally notify UI about the error
         if (window.AppUI) {
             window.AppUI.showNotification('هەڵە لە پاشەکەوتکردنی تۆکن ڕوویدا', 'error');
         }
    }
}


/** Sets up the listener for foreground push messages. */
function setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
         // Use the UI function to display the notification (check existence)
         if (window.AppUI && typeof window.AppUI.showNotification === 'function') {
            window.AppUI.showNotification(`${title}: ${body}`, 'success');
             // Optionally update the badge immediately (UI function)
             window.AppUI.updateNotificationBadge(true);
        }
    });
}

/** Handles the PWA beforeinstallprompt event. */
function setupInstallPromptHandler() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); // Prevent the default mini-infobar
        state.deferredPrompt = e; // Save the event
        // Trigger UI update to show install button (check existence)
        if (window.AppUI && typeof window.AppUI.showInstallButton === 'function') {
            window.AppUI.showInstallButton(true);
        }
        console.log('`beforeinstallprompt` event was fired.');
    });
}

/** Triggers the PWA installation prompt. */
export async function triggerInstallPrompt() {
    if (state.deferredPrompt) {
         // Hide button via UI function (check existence)
         if (window.AppUI && typeof window.AppUI.showInstallButton === 'function') {
             window.AppUI.showInstallButton(false);
         }
        state.deferredPrompt.prompt(); // Show the install prompt
        try {
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
        } catch (error) {
            console.error("Error during install prompt:", error);
        }
        state.deferredPrompt = null; // Clear the saved prompt once used
    } else {
        console.log("Deferred install prompt not available.");
        // Optionally inform the user via UI
         if (window.AppUI) {
             window.AppUI.showNotification("ئەپەکە پێشتر دامەزراوە یان وێبگەڕ پشتگیری ناکات.", "error");
         }
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
                        // New worker is waiting, trigger UI update (check existence)
                         if (window.AppUI && typeof window.AppUI.showUpdateNotification === 'function') {
                            window.AppUI.showUpdateNotification(true);
                        }
                    }
                });
            });

        }).catch(err => {
            console.log('Service Worker registration failed: ', err);
        });

        // Listen for controller change (after skipWaiting)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
             // Ensure this only runs once
             if (navigator.serviceWorker.controller) { // Check if controller is now active
                 console.log('New Service Worker activated. Reloading page...');
                 window.location.reload();
             }
        });

    } else {
        console.log('Service workers are not supported in this browser.');
    }
}


/** Sends a message to the waiting service worker to skip waiting. */
export function skipWaiting() {
    navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.waiting) {
            registration.waiting.postMessage({ action: 'skipWaiting' });
             // Optionally hide the update notification immediately in the UI
             if (window.AppUI) {
                 window.AppUI.showUpdateNotification(false);
             }
        }
    }).catch(error => {
        console.error("Error getting SW registration for skipWaiting:", error);
    });
}

/** Forces an update by unregistering SW and clearing caches. */
export async function forceUpdate() {
     // Ensure AppUI exists for notifications
     if (!window.AppUI) {
         console.error("Cannot force update, AppUI not ready.");
         alert("Cannot force update now, please try again later."); // Basic fallback
         return;
     }
    // Confirmation should be handled in UI before calling this
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('Service Workers unregistered.');
        } else {
            console.log('Service workers not supported, skipping unregister.');
        }

        if (window.caches) {
            const keys = await window.caches.keys();
            await Promise.all(keys.map(key => window.caches.delete(key)));
            console.log('All caches cleared.');
        } else {
             console.log('Cache API not supported, skipping cache clear.');
        }

        window.AppUI.showNotification(t('update_success'), 'success');
        // Reload after a short delay to allow notification to show
        setTimeout(() => window.location.reload(true), 1500);

    } catch (error) {
        console.error('Error during force update:', error);
        window.AppUI.showNotification(t('error_generic'), 'error');
    }
}


// --- History & Navigation ---

/** Saves the current scroll position for the main page filter state. */
export function saveCurrentScrollPosition() {
    // Ensure mainPage element exists
    const mainPageElement = document.getElementById('mainPage');
    if (!mainPageElement) return;

    const mainPageActive = mainPageElement.classList.contains('page-active');
    const currentState = history.state;
    // Only save if on main page and it's a filter state (not modal/sheet/page)
    if (mainPageActive && currentState && !currentState.type) {
        try {
            history.replaceState({ ...currentState, scroll: window.scrollY }, '');
        } catch (e) {
             console.warn("Could not replace history state for scroll:", e);
        }
        // console.log("Saved scroll:", window.scrollY, "for state:", currentState);
    }
}

/** Applies filter state (category, search, etc.) and updates the view. */
export async function applyFilterState(filterState, fromPopState = false) {
    // Ensure AppUI is available
    if (!window.AppUI) {
        console.warn("applyFilterState called before AppUI is ready.");
        return;
    }

    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Trigger UI updates for filters (search input, category buttons)
    window.AppUI.updateFilterUI();

    // Fetch and render content based on the new state
    // Use await to ensure products are fetched before attempting scroll restoration
    await searchProductsInFirestore(state.currentSearch, true);

    // Restore scroll position if navigating back/forward
    if (fromPopState && typeof filterState.scroll === 'number' && filterState.scroll >= 0) {
        // console.log("Restoring scroll to:", filterState.scroll);
        // Delay slightly AFTER products are likely rendered
        setTimeout(() => {
            window.scrollTo({ top: filterState.scroll, behavior: 'auto' }); // Use 'auto' for instant jump
        }, 150); // Increased delay slightly
    } else if (!fromPopState) {
        // Scroll to top smoothly for new filter actions initiated by user
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
    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`; // Avoid trailing '?'


    // Push the new state and URL to history
    try {
        history.pushState(finalState, '', newUrl);
    } catch (e) {
         console.warn("Could not push history state:", e);
    }

    // Apply the new state to the application
    await applyFilterState(finalState); // Apply state immediately
}


/** Handles the initial page load based on URL parameters and hash. */
export function handleInitialPageLoad() {
    state.initialLoadHandled = true; // Mark as handled
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');

    // Ensure AppUI is available
    if (!window.AppUI) {
        console.error("AppUI not available during initial page load handling.");
        return;
    }

    // Determine initial page based on hash first
    let initialPageId = 'mainPage';
    let initialPageTitle = '';
    let pageStateData = {};

    if (hash.startsWith('subcategory_')) {
        initialPageId = 'subcategoryDetailPage';
        const ids = hash.split('_');
        // Validate IDs if necessary
        if (ids.length >= 3) {
             pageStateData = { mainCatId: ids[1], subCatId: ids[2] };
             // Title will be fetched later in showSubcategoryDetailPage
        } else {
            console.warn("Invalid subcategory hash:", hash);
            initialPageId = 'mainPage'; // Fallback to main page
        }
    } else if (hash === 'settingsPage') {
        initialPageId = 'settingsPage';
        initialPageTitle = t('settings_title');
        pageStateData = { title: initialPageTitle };
    }

    // Replace history for the initial page view
    try {
        history.replaceState({ type: 'page', id: initialPageId, ...pageStateData }, '', window.location.href);
    } catch(e) {
        console.warn("Could not replace initial history state:", e);
    }

    // Show the initial page UI first
    window.AppUI.showPage(initialPageId, initialPageTitle);

    // If it's the main page, apply filters from query params
    if (initialPageId === 'mainPage') {
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Initial scroll is always 0
        };
        // Replace initial history state with filter state
        const queryString = params.toString();
        const initialUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`;
         try {
             history.replaceState(initialState, '', initialUrl);
         } catch (e) {
             console.warn("Could not replace initial filter history state:", e);
         }
        // Apply filters *after* categories are loaded (handled by category listener calling this function again if needed)
        // Check if categories are already loaded
         if (state.categories && state.categories.length > 0) {
            applyFilterState(initialState);
        } else {
             console.log("Initial load: Categories not yet loaded, deferring filter application.");
        }

    } else if (initialPageId === 'subcategoryDetailPage' && pageStateData.mainCatId && pageStateData.subCatId) {
         // If starting on detail page, render its content
         window.AppUI.showSubcategoryDetailPage(pageStateData.mainCatId, pageStateData.subCatId, true); // True because it's initial load
    }


     // Handle opening sheets/modals based on hash *if* on the main page
     // This needs to run *after* the initial page is shown and filters potentially applied
     // Also check if a product detail is requested first
     if (productId) {
         // Delay slightly to ensure necessary data/UI might be ready
         setTimeout(() => window.AppUI.showProductDetailsById(productId), 700); // Increased delay
     }
     else if (initialPageId === 'mainPage' && hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage') {
         // Delay opening popups slightly on initial load
         setTimeout(() => {
             const element = document.getElementById(hash);
             if (element) {
                 const isSheet = element.classList.contains('bottom-sheet');
                 const isModal = element.classList.contains('modal');
                 if (isSheet || isModal) {
                     window.AppUI.openPopup(hash, isSheet ? 'sheet' : 'modal');
                 }
             }
         }, 300); // Short delay for popups
     }
}


// --- Initialization ---

/** Initializes core application logic. */
function initializeAppLogic() {
    state.initialLoadHandled = false; // Reset initial load flag
    state.sliderIntervals = {}; // Ensure slider intervals object exists
    state.productCache = {}; // Initialize product cache

    setupAuthListener(); // Setup auth listener early
    setupCategoryListener(); // Fetches categories and triggers initial load handling when ready
    setupContactLinksListener();
    setupContactMethodsListener();
    checkNewAnnouncements();
    setupForegroundMessageListener();
    setupInstallPromptHandler();
    setupServiceWorker();

    // Initial language setup (will be refined once categories load)
    // Defer UI setup until AppUI is confirmed to be loaded
    if (window.AppUI) {
         window.AppUI.setLanguageUI(state.currentLanguage);
    } else {
         // If AppUI isn't ready yet, wait for it
         const checkUIInterval = setInterval(() => {
             if (window.AppUI) {
                 clearInterval(checkUIInterval);
                 window.AppUI.setLanguageUI(state.currentLanguage);
                 // Potentially call other deferred UI setups here if needed
             }
         }, 50); // Check every 50ms
    }
}


/** Main initialization function, enables Firestore persistence first. */
function init() {
    console.log("Initializing application...");
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
// Use DOMContentLoaded to ensure basic DOM is ready before trying to init
document.addEventListener('DOMContentLoaded', init);


// --- Global Exposure for Admin ---
// Ensure this runs after the functions are defined
window.globalAdminTools = {
    // Firebase services/functions needed by admin.js
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,

    // Core utility functions needed by admin.js
    t, // Translation
    showNotification: (msg, type) => { // Wrapper to ensure AppUI exists
        if (window.AppUI) window.AppUI.showNotification(msg, type);
        else console.warn("Admin tried to show notification before AppUI was ready.");
    },
    openPopup: (id, type) => { // Wrapper
        if (window.AppUI) window.AppUI.openPopup(id, type);
    },
    closeCurrentPopup: () => { // Wrapper
         if (window.AppUI) window.AppUI.closeCurrentPopup();
    },
    searchProductsInFirestore, // Core search function

    // Collections needed by admin.js
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection,

    // State accessors/mutators needed by admin.js
    setEditingProductId,
    getEditingProductId,
    getCategories,
    getCurrentLanguage,

    // Cache clearing function
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear the cache
        // Trigger UI update to clear home page (check AppUI)
        if (window.AppUI) window.AppUI.clearHomePageContent();
    },

    // Specific Fetch functions needed by admin forms
    fetchSubcategories,
    fetchSubSubcategories,
};

