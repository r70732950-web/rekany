// app-core.js: Core logic, data fetching, state management

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, // Ensure these are imported from app-setup
    translations, state, // state object needs sliderIntervals: {} added in app-setup.js
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, // Need loginModal for auth state change
    showNotification, // Utility function likely in setup or needs to be moved here/imported
    t // Translation function likely in setup or needs to be moved here/imported
} from './app-setup.js';

import {
    signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
    getToken, onMessage
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import UI functions needed by core logic
import { updateCartCount, renderProducts, renderSkeletonLoader, showPage, closeCurrentPopup, updateCategoryDependentUI, handleInitialPageLoad, setLanguage as setLanguageUI, renderHomePageContent } from './app-ui.js';

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

function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

// --- State Management (Cart, Favorites, Profile) ---

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount(); // Call UI function
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

function toggleFavorite(productId) {
    // Note: Event propagation stopping should happen in the UI event listener
    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();
    // Returning the new state might be useful for the UI to update itself
    return !isCurrentlyFavorite;
}

function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Calls local function below
        } else {
            saveCart();
            // Need to trigger UI update - ideally renderCart should be called from UI module
            // For now, let's return true to indicate success
            return true;
        }
    }
    return false; // Indicate item not found or quantity became zero
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    // Need to trigger UI update - return true to indicate success
    return true;
}

async function addToCart(productId) {
    // Note: Product fetching logic remains, state modification, saving
    const allFetchedProducts = [...state.products]; // Assuming state.products is populated correctly
    let product = allFetchedProducts.find(p => p.id === productId);

    let productDataForCart = null;

    if (!product) {
        console.warn("Product not found in local 'products' array. Fetching...");
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                showNotification(t('product_not_found_error'), 'error');
                return; // Stop if product doesn't exist
            }
        } catch (error) {
            console.error("Error fetching product on add to cart:", error);
            showNotification(t('error_generic'), 'error');
            return;
        }
    }

    if (product) {
         const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
         productDataForCart = { id: product.id, name: product.name, price: product.price, image: mainImage };
    }


    if (productDataForCart) {
        const existingItem = state.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            state.cart.push({ ...productDataForCart, quantity: 1 });
        }
        saveCart();
        showNotification(t('product_added_to_cart'));
    }
}

function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    // Assuming totalAmount is calculated and available elsewhere (e.g., in UI state or passed)
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    message += `\n${t('order_total')}: ${total.toLocaleString()} د.ع.\n`;


    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

// --- Data Fetching (Products, Categories, Settings etc.) ---

async function fetchCategories() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(categoriesQuery);
    const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]; // Add 'All' category
    updateCategoryDependentUI(); // Notify UI to update dropdowns etc.
    return state.categories; // Return categories for initial load logic
}

async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer'); // Still needed here for logic
    const scrollTrigger = document.getElementById('scroll-loader-trigger'); // Still needed here for logic
    const productsContainer = document.getElementById('productsContainer'); // Needed for UI updates
    const skeletonLoader = document.getElementById('skeletonLoader'); // Needed for UI updates
    const loader = document.getElementById('loader'); // Needed for UI updates

    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // UI Actions
        if(productsContainer) productsContainer.style.display = 'none';
        if(skeletonLoader) skeletonLoader.style.display = 'none';
        if(scrollTrigger) scrollTrigger.style.display = 'none';
        if(homeSectionsContainer) homeSectionsContainer.style.display = 'block';

        if (homeSectionsContainer && homeSectionsContainer.innerHTML.trim() === '') {
             renderHomePageContent(); // Call UI function to render
        } else {
            // Re-start rotations implicitly handled by renderHomePageContent
        }
        return;
    } else {
        // UI Actions
        if(homeSectionsContainer) homeSectionsContainer.style.display = 'none';
        // Stop all promo rotations
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};
    }

    // Cache logic remains the same
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        // UI Actions
        if(skeletonLoader) skeletonLoader.style.display = 'none';
        if(loader) loader.style.display = 'none';
        if(productsContainer) productsContainer.style.display = 'grid';
        if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';

        renderProducts(state.products); // Call UI function to render
        return;
    }

    if (state.isLoadingMoreProducts) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        // UI Action
        renderSkeletonLoader(); // Call UI function
    }

    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    // UI Action
    if(loader) loader.style.display = 'block';

    try {
        // Query logic remains the same
        let productsQuery = collection(db, "products");
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        // ... (add other filters for subcategory, subSubcategory, searchTerm) ...
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
        // Ordering
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }
        // Pagination
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

        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;

        // Cache update logic remains the same
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // UI Actions
        renderProducts(state.products); // Pass products to render
        if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        if (productsContainer && state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        // UI Action
        if(productsContainer) productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        // UI Actions
        if(loader) loader.style.display = 'none';
        if(skeletonLoader) skeletonLoader.style.display = 'none';
        if(productsContainer) productsContainer.style.display = 'grid';
    }
}

async function fetchPolicies() {
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().content) {
            return docSnap.data().content;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
    }
    return null; // Return null if not found or error
}

async function fetchAnnouncements() {
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching announcements:", error);
        return [];
    }
}

async function fetchContactLinks() {
     try {
        const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
     } catch (error) {
        console.error("Error fetching contact links:", error);
        return [];
     }
}

async function fetchCartActionMethods() {
     try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
     } catch(error) {
         console.error("Error fetching cart action methods:", error);
         return [];
     }
}

async function fetchSubcategories(categoryId) {
    if (!categoryId || categoryId === 'all') return [];
    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching subcategories for ${categoryId}:`, error);
        return [];
    }
}

async function fetchSubSubcategories(mainCategoryId, subcategoryId) {
    if (!mainCategoryId || !subcategoryId) return [];
    try {
        const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching sub-subcategories for ${mainCategoryId}/${subcategoryId}:`, error);
        return [];
    }
}

async function fetchProductsForSubcategoryDetail(subCatId, subSubCatId = 'all', searchTerm = '') {
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
        return []; // Return empty array on error
    }
}


// --- Notifications / PWA ---

async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
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
            showNotification('مۆڵەت نەدرا', 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
        showNotification(t('error_generic'), 'error');
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID to prevent duplicates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add user ID here if users log in
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    // onSnapshot is better here to listen for real-time changes
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
            const notificationBadge = document.getElementById('notificationBadge'); // Get badge element

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                if(notificationBadge) notificationBadge.style.display = 'block'; // UI update
            } else {
                if(notificationBadge) notificationBadge.style.display = 'none'; // UI update
            }
        }
    }, (error) => {
        console.error("Error checking new announcements:", error);
    });
}

async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            // Unregister service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }
            // Clear caches
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }
            showNotification(t('update_success'), 'success');
            // Reload the page
            setTimeout(() => {
                window.location.reload(true); // Force reload ignoring cache
            }, 1500);
        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}


// --- Authentication ---

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        // Initialize admin logic *after* admin.js is loaded and ready
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                 window.AdminLogic.initialize();
             } else {
                 window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
             // Retry initialization after a short delay in case admin.js wasn't ready
             setTimeout(() => {
                if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                    window.AdminLogic.initialize();
                } else {
                    console.warn("AdminLogic not found or initialize not a function even after delay.");
                }
             }, 500);

        }
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) {
            // Sign out non-admin users if they somehow get logged in
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        // Deinitialize admin UI if admin.js is loaded
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    // Close login modal if admin logs in successfully
    if (loginModal && loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup(); // Call UI function
    }
});


// --- Initialization ---

async function initializeCoreLogic() {
     // Add sliderIntervals property if it doesn't exist
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Attempt to enable offline persistence first
    try {
        await enableIndexedDbPersistence(db);
        console.log("Firestore offline persistence enabled successfully.");
    } catch (err) {
        if (err.code == 'failed-precondition') {
            console.warn('Firestore Persistence failed: Multiple tabs open.');
        } else if (err.code == 'unimplemented') {
            console.warn('Firestore Persistence failed: Browser not supported.');
        } else {
            console.error("Error enabling persistence:", err);
        }
    }

    // Fetch initial necessary data
    const categories = await fetchCategories(); // Fetch categories and update state/UI dependencies

    // Handle initial page load logic (might depend on categories)
    handleInitialPageLoad(categories); // Pass categories to UI handler

    // Apply language settings (might depend on categories for names)
    setLanguageUI(state.currentLanguage); // Call UI function

    // Setup listeners for real-time updates or background tasks
    checkNewAnnouncements();

     // Listen for foreground FCM messages
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'New Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        const notificationBadge = document.getElementById('notificationBadge');
        if (notificationBadge) notificationBadge.style.display = 'block';
    });
}


// --- Exports for app-ui.js and admin.js ---
export {
    // State
    state,
    // Functions needed by UI
    searchProductsInFirestore,
    addToCart,
    toggleFavorite,
    isFavorite,
    updateQuantity,
    removeFromCart,
    generateOrderMessage,
    fetchPolicies,
    fetchAnnouncements,
    fetchContactLinks,
    fetchCartActionMethods,
    fetchSubcategories,
    fetchSubSubcategories,
    fetchProductsForSubcategoryDetail,
    requestNotificationPermission,
    forceUpdate,
    // Utilities needed by UI or Admin
    formatDescription,
    debounce,
    // Auth related
    signInWithEmailAndPassword, // Needed for login form in UI
    signOut // Needed for logout button in UI/Admin
};

// --- Global object for admin.js (since it might not be a module) ---
window.globalAdminTools = {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    showNotification, t,
    openPopup, closeCurrentPopup, // From UI, but admin needs them
    searchProductsInFirestore, // From Core
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // From Setup
    // Helper functions from app-logic originally, keep here or move to admin-specific core? Keep for now.
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear the cache
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Clear home page to force re-render
        }
        // Force re-fetch/render if needed (depends on current view)
        // searchProductsInFirestore(state.currentSearch, true);
    },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide categories to admin
    getCurrentLanguage: () => state.currentLanguage // Provide language to admin
};


// Start core initialization
initializeCoreLogic();