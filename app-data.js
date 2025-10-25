// BEŞÊ DUYEM: app-data.js
// Fonksiyonên birêvebirina data û state

import {
    db, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, homeLayoutCollection, settingsCollection,
    state, // Import the state object
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    t // Import the translation function
} from './app-setup.js';

import {
    getFirestore, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction, Timestamp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- State Access/Modification Functions (Exported for admin.js via app-setup) ---

export function setEditingProductId(id) {
    state.editingProductId = id;
}

export function getEditingProductId() {
    return state.editingProductId;
}

export function getCategoriesFromState() {
    return state.categories;
}

export function getCurrentLanguage() {
    return state.currentLanguage;
}

export function clearProductCache() {
    console.log("Product cache and home page cleared.");
    state.productCache = {};
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = ''; // Clear home page to force re-render
    }
    // No need to trigger search here, clearing is enough. Re-render happens naturally.
}

// --- Language & Translation ---

export function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
}

// --- Cart Management ---

export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    // Note: updateCartCount (UI update) is called separately in app-ui.js
}

export async function addToCart(productId) {
    // Find in currently loaded products first
    let product = state.products.find(p => p.id === productId);

    // If not found, fetch from Firestore
    if (!product) {
        console.warn("Product not found in local 'products' array. Fetching...");
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                console.error(`Product with ID ${productId} not found in Firestore.`);
                // Show notification is handled in app-ui.js caller
                return false; // Indicate failure
            }
        } catch (error) {
            console.error(`Error fetching product ${productId}:`, error);
            // Show notification is handled in app-ui.js caller
            return false; // Indicate failure
        }
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Ensure product.name is an object before accessing language properties
        const productName = (typeof product.name === 'object' && product.name !== null) ? product.name : { ku_sorani: product.name || 'کاڵای بێ ناو' };
        state.cart.push({
            id: product.id,
            name: productName, // Store the name object
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }
    saveCart();
    return true; // Indicate success
}


export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // This also saves and triggers re-render
        } else {
            saveCart();
            // Trigger re-render (handled in app-ui.js)
            document.dispatchEvent(new CustomEvent('cartUpdated'));
        }
    }
}

export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    // Trigger re-render (handled in app-ui.js)
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

export function getCartTotalItems() {
     return state.cart.reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotalPrice() {
    return state.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// --- Favorites Management ---

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

export function toggleFavorite(productId) {
    const isCurrentlyFavorite = isFavorite(productId);
    let added; // To indicate if added or removed

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        added = false;
    } else {
        state.favorites.push(productId);
        added = true;
    }
    saveFavorites();
    // Trigger UI update (handled in app-ui.js)
    document.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: { productId, added } }));
    return added; // Return status for immediate feedback if needed
}

// --- Profile Management ---

export function saveProfile(profileData) {
    state.userProfile = profileData;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
}

// --- Data Fetching ---

export async function fetchCategories() {
    try {
        const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
        const snapshot = await getDocs(categoriesQuery); // Use getDocs for initial fetch
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories]; // Add 'All' category data
        console.log("Categories fetched:", state.categories);
        document.dispatchEvent(new Event('categoriesLoaded')); // Notify UI
    } catch (error) {
        console.error("Error fetching categories: ", error);
    }
}


export async function fetchSubcategories(categoryId) {
    if (categoryId === 'all') {
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
        console.error("Error fetching subcategories: ", error);
        state.subcategories = [];
        return [];
    }
}

export async function fetchSubSubcategories(mainCatId, subCatId) {
     if (!mainCatId || !subCatId) return [];
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

export async function fetchProducts(searchTerm = '', categoryId = 'all', subcategoryId = 'all', subSubcategoryId = 'all', loadMore = false) {

    const cacheKey = `${categoryId}-${subcategoryId}-${subSubcategoryId}-${searchTerm.trim().toLowerCase()}`;
    const isNewSearch = !loadMore; // New search if not loading more

    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        console.log("Loaded products from cache for key:", cacheKey);
        return { products: state.products, allLoaded: state.allProductsLoaded };
    }


    if (state.isLoadingMoreProducts) return { products: state.products, allLoaded: state.allProductsLoaded, loading: true }; // Prevent concurrent loads

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
    }

    if (state.allProductsLoaded && loadMore) return { products: state.products, allLoaded: true }; // Already loaded all

    state.isLoadingMoreProducts = true;

    try {
        let productsQuery = collection(db, "products");

        // Apply category filters
        if (categoryId !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", categoryId));
        }
        if (subcategoryId !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", subcategoryId));
        }
        if (subSubcategoryId !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", subSubcategoryId));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // If searching, first orderBy must match inequality field
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default sort if not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }


        // Apply pagination if loading more
        if (loadMore && state.lastVisibleProductDoc) {
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

        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
        } else {
            state.allProductsLoaded = false;
        }

        // Update cache only for new searches
        if (isNewSearch) {
             state.productCache[cacheKey] = {
                 products: [...state.products], // Store a copy
                 lastVisible: state.lastVisibleProductDoc,
                 allLoaded: state.allProductsLoaded
             };
         }

        return { products: state.products, allLoaded: state.allProductsLoaded };

    } catch (error) {
        console.error("Error fetching products:", error);
        return { products: state.products, allLoaded: state.allProductsLoaded, error: true };
    } finally {
        state.isLoadingMoreProducts = false;
    }
}


// Function for searching products, now calls fetchProducts
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = true) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    document.dispatchEvent(new CustomEvent('searchInitiated', { detail: { isNewSearch, shouldShowHomeSections } }));

    if (shouldShowHomeSections) {
        document.dispatchEvent(new Event('renderHomePage')); // Let app-render handle home page rendering
    } else {
        const { products, allLoaded, error } = await fetchProducts(
            searchTerm,
            state.currentCategory,
            state.currentSubcategory,
            state.currentSubSubcategory,
            !isNewSearch // loadMore is true if it's *not* a new search
        );
         document.dispatchEvent(new CustomEvent('productsFetched', { detail: { products, allLoaded, error, isNewSearch } }));
    }
}

// --- Home Page Data Fetching ---

export async function fetchHomeLayout() {
    try {
        const layoutQuery = query(homeLayoutCollection, where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);
        return layoutSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching home layout:", error);
        return [];
    }
}

export async function fetchPromoCardsForGroup(groupId) {
     try {
         const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
         const cardsSnapshot = await getDocs(cardsQuery);
         return cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
     } catch (error) {
         console.error(`Error fetching promo cards for group ${groupId}:`, error);
         return [];
     }
}

export async function fetchBrandsForGroup(groupId) {
    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return [];
    }
}

export async function fetchNewestProducts() {
    try {
        const fifteenDaysAgo = Timestamp.fromMillis(Date.now() - (15 * 24 * 60 * 60 * 1000));
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return [];
    }
}

export async function fetchShortcutRowData(rowId) {
    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;
        const rowData = { id: rowDoc.id, ...rowDoc.data() };

        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        rowData.cards = cardsSnapshot.docs.map(cardDoc => cardDoc.data());
        return rowData;
    } catch (error) {
        console.error("Error fetching shortcut row data:", error);
        return null;
    }
}

export async function fetchProductsForCategoryRow(categoryId, subcategoryId, subSubcategoryId) {
    let queryField, queryValue;
    if (subSubcategoryId) {
        queryField = 'subSubcategoryId'; queryValue = subSubcategoryId;
    } else if (subcategoryId) {
        queryField = 'subcategoryId'; queryValue = subcategoryId;
    } else if (categoryId) {
        queryField = 'categoryId'; queryValue = categoryId;
    } else {
        return [];
    }

    try {
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching products for category row:", error);
        return [];
    }
}

export async function fetchInitialAllProductsForHome() {
     try {
         const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
         const snapshot = await getDocs(q);
         return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
     } catch (error) {
         console.error("Error fetching initial all products:", error);
         return [];
     }
}

// --- Other Data Functions ---

export async function fetchPolicies() {
    try {
        const docRef = doc(settingsCollection, "policies");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().content) {
            return docSnap.data().content;
        }
        return null; // Or return an empty object {}
    } catch (error) {
        console.error("Error fetching policies:", error);
        return null; // Or return an empty object {}
    }
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

export async function fetchLatestAnnouncementTimestamp() {
     try {
         const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
         const snapshot = await getDocs(q);
         if (!snapshot.empty) {
             return snapshot.docs[0].data().createdAt;
         }
         return 0;
     } catch (error) {
         console.error("Error fetching latest announcement timestamp:", error);
         return 0;
     }
}

export async function fetchContactMethods() {
    try {
        const methodsCollection = collection(settingsCollection, 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching contact methods:", error);
        return [];
    }
}

export async function fetchSocialLinks() {
    try {
        const socialLinksCollection = collection(settingsCollection, 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching social links:", error);
        return [];
    }
}

// --- Notifications ---
export async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), {
            createdAt: Timestamp.now() // Use Firestore Timestamp
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

export async function requestNotificationPermissionAndSaveToken() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            // showNotification handled in app-ui.js
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Consider env variable
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
                return { granted: true, tokenSaved: true };
            } else {
                console.log('No registration token available.');
                return { granted: true, tokenSaved: false };
            }
        } else {
            console.log('Unable to get permission to notify.');
             return { granted: false };
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
        return { granted: false, error: true };
    }
}

// --- Navigation State ---
// Apply filter state modifies the global state based on history or direct navigation
export function applyFilterState(filterState) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
    // Scroll position is handled in app-ui.js based on popstate event
}

// navigateToFilter updates history and then calls applyFilterState indirectly via popstate or directly
export function navigateToFilter(newState) {
    // Save current scroll before navigating
    const currentScroll = window.scrollY;
    history.replaceState({ ...history.state, scroll: currentScroll }, '');

    // Create the target state, resetting scroll
    const targetState = {
        category: newState.category ?? state.currentCategory,
        subcategory: newState.subcategory ?? state.currentSubcategory,
        subSubcategory: newState.subSubcategory ?? state.currentSubSubcategory,
        search: newState.search ?? state.currentSearch,
        scroll: 0 // Reset scroll for new navigation
     };

     // Clean up state (remove 'all' values)
     const cleanState = { ...targetState };
     if (cleanState.category === 'all') delete cleanState.category;
     if (cleanState.subcategory === 'all') delete cleanState.subcategory;
     if (cleanState.subSubcategory === 'all') delete cleanState.subSubcategory;
     if (!cleanState.search) delete cleanState.search;


     // Generate new URL search params
     const params = new URLSearchParams();
     if (targetState.category && targetState.category !== 'all') params.set('category', targetState.category);
     if (targetState.subcategory && targetState.subcategory !== 'all') params.set('subcategory', targetState.subcategory);
     if (targetState.subSubcategory && targetState.subSubcategory !== 'all') params.set('subSubcategory', targetState.subSubcategory);
     if (targetState.search) params.set('search', targetState.search);
     const newUrl = `${window.location.pathname}?${params.toString()}`;


     // Push the new state to history
     history.pushState(targetState, '', newUrl);

     // Apply the new state and trigger search/render
     applyFilterState(targetState); // Update global state
     searchProductsInFirestore(targetState.search, true); // Trigger data fetch/render

     // Scroll to top after applying state
     window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- PWA ---
export function setDeferredPrompt(prompt) {
    state.deferredPrompt = prompt;
}

export function getDeferredPrompt() {
    return state.deferredPrompt;
}
