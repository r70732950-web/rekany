// data-logic.js
import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    state, CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE
} from './app-setup.js';

import {
    signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    enableIndexedDbPersistence, collection as firestoreCollection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Import collection as firestoreCollection
import {
    getToken, onMessage
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import UI functions needed by data logic
// *** چاککراو: renderFavoritesPage زیادکرا ***
import { showNotification, t, renderCart, updateCartCount, renderFavoritesPage, updateActiveNav, showPage, closeCurrentPopup, openPopup, updateHeaderView, setLanguage as uiSetLanguage, handleHomeVsProductView, renderProductListFromCache, showSkeleton, showLoadMoreIndicator, renderProductListAndUpdateUI, showProductFetchError, hideLoadIndicators, clearHomePageContainer, updateAdminStatusUI, populateCategoryDropdown as uiPopulateCategoryDropdown, renderMainCategories as uiRenderMainCategories, renderCategoriesSheet as uiRenderCategoriesSheet, renderSubcategories as uiRenderSubcategories, renderContactLinks as uiRenderContactLinks, checkNewAnnouncements as uiCheckNewAnnouncements, showWelcomeMessage as uiShowWelcomeMessage, setupGpsButton as uiSetupGpsButton, updateFavoriteButtonsUI, handleInitialPageLoad as uiHandleInitialPageLoad, setupUIEventListeners as uiSetupEventListeners, setupScrollObserver as uiSetupScrollObserver } from './ui-logic.js';

// --- State Management Functions ---

export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount(); // Update UI count
}

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Cart Logic ---

export async function addToCart(productId) {
    // Find product in already loaded state.products first
    let product = state.products.find(p => p.id === productId);

    // If not found (e.g., added from favorites or direct link), fetch it
    if (!product) {
        console.warn("Product not found in local 'products' array for cart. Fetching...");
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                console.error("Product not found in Firestore either.");
                showNotification(t('product_not_found_error'), 'error');
                return;
            }
        } catch (error) {
            console.error("Error fetching product for cart:", error);
            showNotification(t('error_generic'), 'error');
            return;
        }
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Ensure product name is structured correctly before adding
        const productName = (product.name && typeof product.name === 'object')
            ? product.name
            : { ku_sorani: product.name, ku_badini: product.name, ar: product.name }; // Basic fallback

        state.cart.push({
            id: product.id,
            name: productName, // Store the name object
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }
    saveCart();
    showNotification(t('product_added_to_cart'));
}


export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // This already calls saveCart and renderCart
        } else {
            saveCart();
            renderCart(); // Update the cart UI
        }
    }
}

export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // Update the cart UI
}

export function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
     // Access totalAmount from the DOM element updated by renderCart
     const totalAmountText = document.getElementById('totalAmount')?.textContent || '0';
    message += `\n${t('order_total')}: ${totalAmountText} د.ع.\n`;


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

// --- Favorite Logic ---

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

    // Call UI function to update favorite buttons visually
    updateFavoriteButtonsUI(productId, !isCurrentlyFavorite); // Defined in ui-logic.js

    // If the favorites sheet is open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
         renderFavoritesPage(); // Call the imported UI function
    }
}


// --- Data Fetching Logic ---

// Function to fetch product details - needed for showProductDetails in UI
export async function fetchProductDetails(productId) {
     try {
        const docSnap = await getDoc(doc(db, "products", productId));
        if (docSnap.exists()) {
             return { id: docSnap.id, ...docSnap.data() };
         } else {
            return null;
        }
     } catch (error) {
        console.error("Error fetching product details:", error);
         return null;
     }
 }
export async function fetchCategories() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(categoriesQuery);
    const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories];
    // console.log("Categories fetched and state updated:", state.categories);
}

export async function fetchSubcategories(categoryId) {
    if (!categoryId || categoryId === 'all') {
        return [];
    }
    try {
        const subcategoriesQuery = firestoreCollection(db, "categories", categoryId, "subcategories"); // Use firestoreCollection
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching subcategories:", error);
        return [];
    }
}

export async function fetchSubSubcategories(mainCatId, subCatId) {
     if (!mainCatId || !subCatId) {
         return [];
     }
     try {
         const ref = firestoreCollection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"); // Use firestoreCollection
         const q = query(ref, orderBy("order", "asc"));
         const snapshot = await getDocs(q);
         return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
     } catch (error) {
         console.error("Error fetching sub-subcategories:", error);
         return [];
     }
}

// Combined search/fetch function
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    // Call UI function to handle showing/hiding home sections vs product list
    handleHomeVsProductView(shouldShowHomeSections);

    if (shouldShowHomeSections) {
        // Trigger rendering home content if needed (handled in ui-logic.js)
        return; // Stop data fetching if showing home view
    }

    // Cache logic (consider if still needed or simplify)
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        // Call UI function to render cached products and update UI state
        renderProductListFromCache();
        return;
    }

    if (state.isLoadingMoreProducts && !isNewSearch) return; // Prevent concurrent loads
    if (state.allProductsLoaded && !isNewSearch) return; // Don't load if all loaded


    state.isLoadingMoreProducts = true;
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
         // Call UI function to show skeleton loader
         showSkeleton();
    } else {
        // Call UI function to show loading indicator
        showLoadMoreIndicator(true);
    }


    try {
        let productsQuery = firestoreCollection(db, "products"); // Use firestoreCollection

        // Apply filters
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

        // Update state
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Can be undefined if empty

        // Update cache if it's a new search
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                 products: state.products,
                 lastVisible: state.lastVisibleProductDoc,
                 allLoaded: state.allProductsLoaded
             };
        }

        // Call UI function to render the updated product list and hide loaders
        renderProductListAndUpdateUI(isNewSearch);

    } catch (error) {
        console.error("Error fetching/searching products:", error);
         // Call UI function to show an error message
         showProductFetchError();
    } finally {
        state.isLoadingMoreProducts = false;
         // Call UI function to hide loading indicators if they weren't hidden by renderProductListAndUpdateUI
         hideLoadIndicators();
    }
}


// --- Authentication & Permissions ---

export async function handleSignIn(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Auth state change will handle UI updates
        return true;
    } catch (error) {
        showNotification(t('login_error'), 'error');
        return false;
    }
}

export async function handleSignOut() {
    try {
        await signOut(auth);
        showNotification(t('logout_success'), 'success');
        // Auth state change will handle UI updates
    } catch (error) {
        console.error("Error signing out:", error);
    }
}

export async function requestNotificationPermission() {
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
     }
 }

async function saveTokenToFirestore(token) {
     try {
         const tokensCollection = firestoreCollection(db, 'device_tokens'); // Use firestoreCollection
         // Use the token itself as the document ID to prevent duplicates
         await setDoc(doc(tokensCollection, token), {
             createdAt: Date.now()
             // You might want to add userId if users log in, or other relevant info
         });
         console.log('Token saved to Firestore.');
     } catch (error) {
         console.error('Error saving token to Firestore: ', error);
     }
 }

 export function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
            // Call UI function to show/hide badge
            uiCheckNewAnnouncements(latestAnnouncement.createdAt > lastSeenTimestamp);
        } else {
            // Call UI function to hide badge if no announcements exist
            uiCheckNewAnnouncements(false);
        }
    }, (error) => {
        console.error("Error checking new announcements:", error);
    });
}


// --- Initialization ---

export function setupAuthListener(adminInitializationCallback, adminDeinitializationCallback) {
     onAuthStateChanged(auth, async (user) => {
         const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Consider moving to config/env
         const isAdmin = user && user.uid === adminUID;

         if (isAdmin) {
             sessionStorage.setItem('isAdmin', 'true');
             if (adminInitializationCallback) adminInitializationCallback();
         } else {
             sessionStorage.removeItem('isAdmin');
             // If a non-admin user is somehow logged in, log them out.
             if (user) {
                 await handleSignOut(); // Use the sign out handler
             }
             if (adminDeinitializationCallback) adminDeinitializationCallback();
         }
         // Optionally trigger a general UI update based on admin status
          updateAdminStatusUI(isAdmin); // Defined in ui-logic.js
          // Close login modal if it was open and sign-in was successful
          if (isAdmin && document.getElementById('loginModal')?.style.display === 'block') {
             closeCurrentPopup();
          }
     });
}

// Function to fetch initial necessary data
export async function loadInitialData() {
     await fetchCategories();
     // Fetch contact info or other settings if needed on load
     // await fetchContactInfo();
     checkNewAnnouncements(); // Initial check for notification badge
}

export function init() {
     // Call UI function to show initial skeleton
     showSkeleton(); // Defined in ui-logic.js

     enableIndexedDbPersistence(db)
         .then(() => {
             console.log("Firestore offline persistence enabled successfully.");
             initializeAppLogic();
         })
         .catch((err) => {
             if (err.code == 'failed-precondition') {
                 console.warn('Firestore Persistence failed: Multiple tabs open?');
             } else if (err.code == 'unimplemented') {
                 console.warn('Firestore Persistence failed: Browser not supported?');
             }
             console.error("Error enabling persistence, running online mode only:", err);
             initializeAppLogic(); // Proceed without persistence
         });
 }

// Main initialization logic coordinating data loading and UI setup
async function initializeAppLogic() {
     await loadInitialData(); // Fetch categories and check notifications first

     // Setup auth listener, passing AdminLogic callbacks
     setupAuthListener(
         () => window.AdminLogic?.initialize(), // Initialize admin UI/logic if available
         () => window.AdminLogic?.deinitialize() // Deinitialize admin UI/logic if available
     );

     // Call UI setup functions now that categories are loaded
     uiSetupEventListeners(); // Setup general UI listeners
     uiSetupScrollObserver(); // Setup infinite scroll
     // updateCategoryDependentUI(); // Populate dropdowns, main categories etc. - Called by fetchCategories now
     uiRenderContactLinks(); // Render contact links in settings
     uiHandleInitialPageLoad(); // Determine initial view based on URL
     uiShowWelcomeMessage(); // Show welcome popup on first visit
     uiSetupGpsButton(); // Enable GPS functionality
     uiSetLanguage(state.currentLanguage); // Apply initial language

    // Set up Firebase messaging listener
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'New Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success'); // Assuming showNotification is in ui-logic.js
         checkNewAnnouncements(); // Update badge status potentially
    });

}

// Expose necessary functions for admin.js (if still needed via global)
// Consider refactoring admin.js to use imports if possible
// *** چاککراو: collection زیادکرا، هەروەها فانکشنەکانی UIش ***
Object.assign(window.globalAdminTools, {
    // Keep essential Firestore/Auth refs if admin.js needs direct access
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    collection: firestoreCollection, // *** لێرە زیادی بکە ***
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    // Add data/logic functions needed by admin.js
    searchProductsInFirestore,
    fetchCategories,
    fetchSubcategories,
    fetchSubSubcategories,
    clearProductCache: () => {
         console.log("Product cache and home page cleared due to admin action.");
         state.productCache = {};
         // Call UI function to clear home container
          clearHomePageContainer(); // Defined in ui-logic.js
     },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories,
    getCurrentLanguage: () => state.currentLanguage,
     // Add UI functions needed by admin.js that are now in ui-logic.js
     showNotification, // *** زیادکرا ***
     t,             // *** زیادکرا ***
     openPopup,     // *** زیادکرا ***
     closeCurrentPopup // *** زیادکرا ***
});

// Start initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);