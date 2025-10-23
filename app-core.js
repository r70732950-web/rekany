// app-core.js: Core logic, data fetching, state management

import {
    // Firebase and setup variables
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection,
    state, // Ensure state is imported
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, // Need loginModal for auth state change

    // *** زیادکرا *** : Import utility functions
    showNotification,
    t

} from './app-setup.js';

// Firebase imports
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
    // Basic escaping
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Basic URL detection (needs improvement for complex cases)
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        // Simple link, no special styling here, CSS can handle it
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newlines with <br> for HTML display
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

async function addToCart(productId) { // Make async if product fetch is needed
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

    // Ensure product is valid before proceeding
    if (product) {
         const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
         // Ensure price is a number, default to 0 if not
         const price = typeof product.price === 'number' ? product.price : 0;
         productDataForCart = { id: product.id, name: product.name, price: price, image: mainImage };
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
    let total = 0; // Calculate total here
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('product_no_name', {default: 'کاڵای بێ ناو'}));
        // Ensure price is a number before calculation
        const itemPrice = typeof item.price === 'number' ? item.price : 0;
        const itemQuantity = typeof item.quantity === 'number' ? item.quantity : 0;
        const itemDetails = t('order_item_details', { price: itemPrice.toLocaleString(), quantity: itemQuantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
        total += itemPrice * itemQuantity; // Accumulate total
    });

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
    try {
        const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
        const snapshot = await getDocs(categoriesQuery);
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label') }, ...fetchedCategories]; // Add 'All' category with translated name
        updateCategoryDependentUI(); // Notify UI to update dropdowns etc.
        return state.categories; // Return categories for initial load logic
    } catch (error) {
        console.error("Error fetching categories:", error);
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label') }]; // Provide default on error
        updateCategoryDependentUI();
        return state.categories;
    }
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
        let productsQuery = productsCollection; // Use collection directly
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
            // Using range query for basic prefix search on lowercase name
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }
        // Ordering: Apply search order first if searching, otherwise default order
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
            // Append new products, avoiding duplicates just in case
            newProducts.forEach(newProd => {
                if (!state.products.some(existingProd => existingProd.id === newProd.id)) {
                    state.products.push(newProd);
                }
            });
        }

        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Can be undefined if empty
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
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', { default: 'هیچ کاڵایەک نەدۆزرایەوە.' })}</p>`;
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        // UI Action
        if(productsContainer) productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_generic')}</p>`;
    } finally {
        state.isLoadingMoreProducts = false;
        // UI Actions
        if(loader) loader.style.display = 'none';
        if(skeletonLoader) skeletonLoader.style.display = 'none';
        if(productsContainer) productsContainer.style.display = 'grid'; // Ensure grid display even if empty
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
        const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Assuming createdAt exists
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
        const q = query(methodsCollection, orderBy("createdAt")); // Assuming createdAt exists
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
        let productsQuery = productsCollection; // Start with base collection
        // Apply category filters
        if (subSubCatId !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", subSubCatId));
        } else {
             // If 'all' sub-sub, filter only by parent subcategory
             productsQuery = query(productsQuery, where("subcategoryId", "==", subCatId));
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
        // Note: No pagination applied here yet, might be needed for very large subcategories

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
        // Check if permission already granted
        if (Notification.permission === 'granted') {
             console.log('Notification permission already granted.');
             showNotification('مۆڵەت پێشتر دراوە', 'success');
             // Proceed to get token
             const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
             });
             if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
             } else {
                console.log('Could not get token.');
             }
             return; // Exit function early
        }

        // If not granted or denied, request permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
            // Get token after granting permission
             const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
             });
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('Could not get token after permission grant.');
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
            // You might want to add user ID here if users log in (requires user auth)
            // Example: userId: auth.currentUser ? auth.currentUser.uid : null
            userAgent: navigator.userAgent // Optional: Store user agent info
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
        // Don't show UI notification for background task failure
    }
}


function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    // onSnapshot listens for real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
            const notificationBadge = document.getElementById('notificationBadge'); // Get badge element

            // Compare timestamps (ensure they are numbers)
            const latestTime = Number(latestAnnouncement.createdAt);
            const lastSeenTime = Number(lastSeenTimestamp);

            if (!isNaN(latestTime) && latestTime > lastSeenTime) {
                if(notificationBadge) notificationBadge.style.display = 'block'; // UI update
            } else {
                if(notificationBadge) notificationBadge.style.display = 'none'; // UI update
            }
        }
    }, (error) => {
        console.error("Error checking new announcements:", error);
        // Optionally handle the error, e.g., stop listening or log it
        // unsubscribe(); // Stop listening on error if desired
    });
    // Consider returning unsubscribe if you need to stop listening later
    // return unsubscribe;
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
            // Clear localStorage related to app data (optional but thorough)
            // Be careful not to clear essential things like language preference if not intended
            // localStorage.removeItem(CART_KEY);
            // localStorage.removeItem(FAVORITES_KEY);
            // localStorage.removeItem(PROFILE_KEY);
            // localStorage.removeItem('lastSeenAnnouncementTimestamp');
            // localStorage.removeItem('hasVisited');
            console.log("Local storage potentially cleared (review items if uncommented).")

            showNotification(t('update_success'), 'success');
            // Reload the page forcefully from the server
            setTimeout(() => {
                window.location.reload(true); // Force reload ignoring cache
            }, 1500); // Delay to allow notification to show
        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}


// --- Authentication State Change Listener ---

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // !! IMPORTANT: Keep this secure or use better methods
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        console.log("Admin user detected.");
        // Initialize admin logic *after* admin.js is potentially loaded
        // Use a slight delay and check to ensure admin.js has run
        setTimeout(() => {
            if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                window.AdminLogic.initialize();
            } else {
                console.warn("AdminLogic not ready or found, cannot initialize.");
                // Optionally try again later or indicate an issue
            }
        }, 100); // Small delay to allow admin.js to potentially load

    } else {
        sessionStorage.removeItem('isAdmin');
        console.log("Non-admin user or logged out state.");
        if (user) {
            // Sign out non-admin users if they somehow get logged in
             console.log(`Non-admin user (${user.uid}) detected, signing out.`);
            await signOut(auth);
            showNotification('Signed out.', 'success'); // Inform user
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
     // Ensure sliderIntervals exists
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Attempt to enable offline persistence first
    try {
        await enableIndexedDbPersistence(db);
        console.log("Firestore offline persistence enabled successfully.");
    } catch (err) {
        // Handle specific errors gracefully
        if (err.code == 'failed-precondition') console.warn('Firestore Persistence failed: Multiple tabs open.');
        else if (err.code == 'unimplemented') console.warn('Firestore Persistence failed: Browser not supported.');
        else console.error("Error enabling persistence:", err);
    }

    // Fetch initial necessary data - Categories are crucial for initial UI render
    const categories = await fetchCategories(); // Fetches and updates state & UI dependencies

    // Handle initial page load logic (now receives categories)
    handleInitialPageLoad(categories); // Call UI function

    // Apply language settings (now reliable as categories are loaded)
    setLanguageUI(state.currentLanguage); // Call UI function

    // Setup listeners for real-time updates or background tasks
    checkNewAnnouncements(); // Start listening for new announcements

     // Listen for foreground FCM messages
    try {
        onMessage(messaging, (payload) => {
            console.log('Foreground message received: ', payload);
            const title = payload.notification?.title || t('new_notification', {default: 'New Notification'});
            const body = payload.notification?.body || '';
            showNotification(`${title}: ${body}`, 'success');
            // Update badge UI immediately
            const notificationBadge = document.getElementById('notificationBadge');
            if (notificationBadge) notificationBadge.style.display = 'block';
        });
    } catch (error) {
        console.error("Error setting up foreground message listener:", error);
        // This might happen if FCM is not supported or initialized correctly
    }
}


// --- Exports for app-ui.js and potentially admin.js ---
export {
    // State (allow UI to read, core modifies)
    state,
    // Functions needed by UI
    searchProductsInFirestore,
    addToCart,
    toggleFavorite,
    isFavorite,
    updateQuantity, // Renamed from updateQuantityCore for export simplicity
    removeFromCart, // Renamed from removeFromCartCore for export simplicity
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
    // Auth related (needed for UI forms/buttons)
    signInWithEmailAndPassword,
    signOut
};

// --- Global object for admin.js ---
// This bridge allows admin.js (non-module) to access core functionalities
window.globalAdminTools = {
    // Firebase services & functions
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    // Core Utilities & State Access
    showNotification, t, state,
    searchProductsInFirestore, // Allow admin to trigger re-fetch if needed
    // Collections
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection,
    // Admin specific helpers originally in app-logic
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear the cache
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) homeContainer.innerHTML = ''; // Clear home page to force re-render
        // Optionally trigger a re-render if the user is on the home page view
        // const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
        // if (isHomeView) { searchProductsInFirestore('', true); }
    },
    setEditingProductId: (id) => { state.editingProductId = id; }, // Manage editing state
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide categories data to admin
    getCurrentLanguage: () => state.currentLanguage // Provide language data to admin
};


// --- Start core initialization ---
// This runs once the script is loaded
initializeCoreLogic();