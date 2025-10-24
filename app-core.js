// app-core.js: Core logic, Firebase interactions, state management (Fixed Errors v2)

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
 * Fetches the dynamic home page layout sections and triggers their rendering.
 * This is now separate from searchProductsInFirestore to avoid recursion.
 */
async function renderDynamicHomeLayoutSections() {
    if (!window.AppUI) {
        console.warn("renderDynamicHomeLayoutSections called before AppUI is ready.");
        return;
    }
     if (state.isRenderingHomePage) return; // Prevent concurrent rendering
     state.isRenderingHomePage = true;

    try {
        // Clear previous content and stop sliders via UI function
        window.AppUI.clearHomePageContent();

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            // Optionally render a default message via AppUI
             window.AppUI.showEmptyHomePageMessage();
        } else {
            const homeSectionsContainer = document.getElementById('homePageSectionsContainer'); // Get container once

            // Clear skeleton loader added by prepareHomePageView
             if (homeSectionsContainer) homeSectionsContainer.innerHTML = '';

            for (const docSnapshot of layoutSnapshot.docs) { // Use specific name for clarity
                const section = { id: docSnapshot.id, ...docSnapshot.data() };
                let sectionData = null; // To hold data fetched for the section

                try {
                    switch (section.type) {
                        case 'promo_slider':
                            if (section.groupId) {
                                // Fetch promo cards for the group
                                const cardsQuery = query(collection(db, "promo_groups", section.groupId, "cards"), orderBy("order", "asc"));
                                const cardsSnapshot = await getDocs(cardsQuery);
                                const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                if (cards.length > 0) {
                                    sectionData = { cards };
                                    // Trigger UI rendering for this section type
                                    window.AppUI.renderPromoCardsSectionUI(sectionData, section.id, homeSectionsContainer); // Pass layout ID for interval management
                                } else {
                                     console.log(`Promo slider group ${section.groupId} has no cards.`);
                                }
                            } else { console.warn("Promo slider section is missing groupId."); }
                            break;
                        case 'brands':
                            if (section.groupId) {
                                // Fetch brands for the group
                                const brandsQuery = query(collection(db, "brand_groups", section.groupId, "brands"), orderBy("order", "asc"), limit(30));
                                const brandsSnapshot = await getDocs(brandsQuery);
                                const brands = brandsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                if (brands.length > 0) {
                                    sectionData = brands;
                                    // Trigger UI rendering
                                    window.AppUI.renderBrandsSectionUI(sectionData, homeSectionsContainer);
                                } else {
                                    console.log(`Brand group ${section.groupId} has no brands.`);
                                }
                            } else { console.warn("Brands section is missing groupId."); }
                            break;
                        case 'newest_products':
                            // Fetch newest products
                            const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
                            const newestQuery = query(
                                productsCollection,
                                where('createdAt', '>=', fifteenDaysAgo),
                                orderBy('createdAt', 'desc'),
                                limit(10)
                            );
                            const newestSnapshot = await getDocs(newestQuery);
                            const newestProducts = newestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                             if (newestProducts.length > 0) {
                                sectionData = newestProducts;
                                // Trigger UI rendering
                                window.AppUI.renderNewestProductsSectionUI(sectionData, homeSectionsContainer);
                             } else {
                                console.log("No newest products found to render.");
                             }
                            break;
                        case 'single_shortcut_row':
                            if (section.rowId) {
                                // Fetch row details and cards
                                const rowDoc = await getDoc(doc(db, "shortcut_rows", section.rowId));
                                if (rowDoc.exists()) {
                                    const rowData = { id: rowDoc.id, ...rowDoc.data() };
                                    const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
                                    const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
                                    const cardsSnapshot = await getDocs(cardsQuery);
                                    const cards = cardsSnapshot.docs.map(cardDoc => ({ id: cardDoc.id, ...cardDoc.data() }));
                                    if (cards.length > 0) {
                                         sectionData = { rowData, cards };
                                         // Trigger UI rendering
                                         window.AppUI.renderSingleShortcutRowUI(sectionData.rowData, sectionData.cards, homeSectionsContainer);
                                    } else {
                                         console.log(`Shortcut row ${section.rowId} has no cards.`);
                                    }
                                } else { console.warn(`Shortcut row ${section.rowId} not found.`); }
                            } else { console.warn("Single shortcut row section is missing rowId."); }
                            break;
                        case 'single_category_row':
                            if (section.categoryId) {
                                // Determine query parameters based on available IDs
                                let queryField, queryValue;
                                if (section.subSubcategoryId) {
                                    queryField = 'subSubcategoryId'; queryValue = section.subSubcategoryId;
                                } else if (section.subcategoryId) {
                                    queryField = 'subcategoryId'; queryValue = section.subcategoryId;
                                } else {
                                    queryField = 'categoryId'; queryValue = section.categoryId;
                                }
                                // Fetch products for the category row
                                const catProdQuery = query(
                                    productsCollection,
                                    where(queryField, '==', queryValue),
                                    orderBy('createdAt', 'desc'),
                                    limit(10)
                                );
                                const catProdSnapshot = await getDocs(catProdQuery);
                                const catProducts = catProdSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                 if (catProducts.length > 0) {
                                    sectionData = catProducts;
                                    // Trigger UI rendering
                                    window.AppUI.renderSingleCategoryRowUI(section, sectionData, homeSectionsContainer); // Pass section config and product data
                                 } else {
                                    console.log(`No products found for single category row: ${JSON.stringify(section)}`);
                                 }
                            } else { console.warn("Single category row section is missing categoryId."); }
                            break;
                        case 'all_products':
                             // Fetch first few products for the 'all products' preview
                            const allProdQuery = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
                            const allProdSnapshot = await getDocs(allProdQuery);
                            const allProducts = allProdSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                             if (allProducts.length > 0) {
                                sectionData = allProducts;
                                // Trigger UI rendering
                                window.AppUI.renderAllProductsSectionUI(sectionData, homeSectionsContainer);
                             } else {
                                console.log("No products found for 'all products' section.");
                             }
                            break;
                        default:
                            console.warn(`Unknown home layout section type: ${section.type}`);
                    }
                } catch (sectionError) {
                     console.error(`Error processing section type ${section.type} (ID: ${section.id}):`, sectionError);
                     // Optionally render an error placeholder for this section in the UI
                }
            }
        }
    } catch (error) {
        console.error("Error fetching or rendering home page layout:", error);
         // Trigger UI update for a general home page error
         window.AppUI.showEmptyHomePageMessage("هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.");
    } finally {
        state.isRenderingHomePage = false; // Allow rendering again
    }
}


/**
 * Determines whether to show home sections or filtered products,
 * then fetches and triggers the appropriate rendering.
 * @param {string} [searchTerm=''] The search term.
 * @param {boolean} [isNewSearch=false] Whether this is a new search or loading more.
 */
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    // Ensure AppUI is available before proceeding
    if (!window.AppUI) {
        console.warn("searchProductsInFirestore called before AppUI is ready.");
        return;
    }

    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // --- FIX START ---
        // 1. Prepare UI for home view (show container, hide products/loader, show skeleton)
        window.AppUI.prepareHomePageView();
        // 2. Fetch and render dynamic sections separately
        await renderDynamicHomeLayoutSections(); // Call the new function
        // --- FIX END ---
        return; // Stop here, home sections are handled
    } else {
        // Hide home sections and stop sliders if they were running
        window.AppUI.hideHomePageSectionsAndStopSliders();
    }

    // --- Proceed with fetching filtered/searched products ---

    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        window.AppUI.displayCachedProducts();
        return;
    }

    if (state.isLoadingMoreProducts) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        window.AppUI.showSkeletonForNewSearch();
    }

    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    window.AppUI.showLoadingIndicator(true);

    try {
        let productsQuery = collection(db, "products");

        // Apply filters
        if (state.currentCategory !== 'all') productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        if (state.currentSubcategory !== 'all') productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        if (state.currentSubSubcategory !== 'all') productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));

        // Apply search
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
            const currentIds = new Set(state.products.map(p => p.id));
            const uniqueNewProducts = newProducts.filter(p => !currentIds.has(p.id));
            state.products = [...state.products, ...uniqueNewProducts];
        }

        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        window.AppUI.renderFetchedProducts(); // Update UI

    } catch (error) {
        console.error("Error fetching content:", error);
        window.AppUI.showFetchingError(); // Update UI
    } finally {
        state.isLoadingMoreProducts = false;
        window.AppUI.showLoadingIndicator(false); // Update UI
    }
}


/** Fetches categories from Firestore and stores them in the state. */
export function setupCategoryListener() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allCategoryNameObj = {
            ku_sorani: t('all_categories_label', { lang: 'ku_sorani' }),
            ku_badini: t('all_categories_label', { lang: 'ku_badini' }),
            ar: t('all_categories_label', { lang: 'ar' })
        };
        state.categories = [{ id: 'all', icon: 'fas fa-th', ...allCategoryNameObj }, ...fetchedCategories];

        if (window.AppUI) {
            window.AppUI.updateCategoryDependentUI();
        } else {
            console.warn("Category listener fired before AppUI was ready.");
        }

        if (!state.initialLoadHandled) {
             handleInitialPageLoad();
             state.initialLoadHandled = true;
        }
    }, (error) => {
        console.error("Error fetching categories:", error);
    });
}


/** Fetches contact links from Firestore. */
export function setupContactLinksListener() {
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (window.AppUI) {
            window.AppUI.renderContactLinks(links);
        }
    }, (error) => {
        console.error("Error fetching contact links:", error);
    });
}

/** Fetches contact methods (for sending orders) from Firestore. */
export function setupContactMethodsListener() {
    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt"));

    onSnapshot(q, (snapshot) => {
        state.contactMethods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // FIX: Check if AppUI and the function exist before calling
        if (window.AppUI && typeof window.AppUI.updateCartActionButtons === 'function') {
            window.AppUI.updateCartActionButtons();
        } else {
             console.warn("Contact methods updated, but AppUI.updateCartActionButtons not ready.");
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
             // Ensure createdAt is a valid number before comparing
            if (latestAnnouncement && typeof latestAnnouncement.createdAt === 'number') {
                const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
                const showBadge = latestAnnouncement.createdAt > lastSeenTimestamp;
                if (window.AppUI) {
                    window.AppUI.updateNotificationBadge(showBadge);
                }
            } else {
                 console.warn("Latest announcement data is invalid or missing createdAt:", latestAnnouncement);
            }
        } else {
             // No announcements found, ensure badge is hidden
            if (window.AppUI) {
                window.AppUI.updateNotificationBadge(false);
            }
        }
    }, (error) => {
        console.error("Error checking announcements:", error);
    });
}

/** Fetches announcements for the notification sheet. */
export async function fetchAnnouncementsForSheet() {
     if (!window.AppUI) {
        console.warn("fetchAnnouncementsForSheet called before AppUI is ready.");
        return;
    }
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let latestTimestamp = 0;
        if (!snapshot.empty) {
            const firstDocData = snapshot.docs[0].data();
            if (firstDocData && typeof firstDocData.createdAt === 'number') {
                latestTimestamp = firstDocData.createdAt;
            } else {
                 console.warn("Latest announcement missing valid createdAt:", firstDocData);
                 // Fallback: find max timestamp manually
                 latestTimestamp = announcements.reduce((max, ann) => (ann && typeof ann.createdAt === 'number' && ann.createdAt > max ? ann.createdAt : max), 0);
            }
        }

        if (latestTimestamp > 0) {
             localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        }
        window.AppUI.renderUserNotifications(announcements);
        window.AppUI.updateNotificationBadge(false);

    } catch (error) {
        console.error("Error fetching announcements:", error);
        window.AppUI.renderUserNotifications([]);
    }
}


/** Fetches policies from Firestore. */
export async function fetchPolicies() {
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
        window.AppUI.renderPoliciesSheet(policiesContent);
    } catch (error) {
        console.error("Error fetching policies:", error);
        window.AppUI.renderPoliciesSheet(null, true);
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
    if (!mainCatId || !subCatId) return [];
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
        console.error(`Error fetching products for detail page:`, error);
        return [];
    }
}

/** Fetches related products based on category/subcategory. */
export async function fetchRelatedProducts(currentProduct) {
    let queryField, queryValue;
    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId'; queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId'; queryValue = currentProduct.subcategoryId;
    } else if (currentProduct.categoryId) {
        queryField = 'categoryId'; queryValue = currentProduct.categoryId;
    } else {
        return [];
    }
    const q = query(
        productsCollection,
        where(queryField, '==', queryValue),
        where('__name__', '!=', currentProduct.id),
        limit(6)
    );
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
     if (!window.AppUI) { console.warn("addToCart called before AppUI."); return; }
    let product = state.products.find(p => p.id === productId);

    const processAddToCart = (productData) => {
         if (!productData || !productData.id || productData.price == null) { // Check price explicitly
             console.error("Invalid product data:", productData);
             window.AppUI.showNotification(t('error_generic'), 'error');
             return;
         }
        const mainImage = (productData.imageUrls && productData.imageUrls[0]) || productData.image || '';
        const existingItem = state.cart.find(item => item.id === productId);
        if (existingItem) { existingItem.quantity++; }
        else { state.cart.push({ id: productData.id, name: productData.name, price: productData.price, image: mainImage, quantity: 1 }); }
        saveCart();
        window.AppUI.showNotification(t('product_added_to_cart'), 'success');
    };

    if (product) { processAddToCart(product); }
    else {
        console.warn("Product not found locally. Fetching...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) { processAddToCart({ id: docSnap.id, ...docSnap.data() }); }
            else { window.AppUI.showNotification(t('product_not_found_error'), 'error'); }
        }).catch(err => {
            console.error("Fetch error:", err);
            window.AppUI.showNotification(t('error_generic'), 'error');
        });
    }
}


/** Updates the quantity of a cart item. */
export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else {
            saveCart();
            if (window.AppUI) window.AppUI.renderCart();
        }
    }
}

/** Removes an item completely from the cart. */
export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    if (window.AppUI) window.AppUI.renderCart();
}

// --- Favorites Logic ---

/** Toggles a product's favorite status. */
export function toggleFavorite(productId) {
     if (!window.AppUI) { console.warn("toggleFavorite called before AppUI."); return; }
    const isCurrentlyFavorite = isFavorite(productId);
    let messageKey = isCurrentlyFavorite ? 'product_removed_from_favorites' : 'product_added_to_favorites';
    let messageType = isCurrentlyFavorite ? 'error' : 'success';

    if (isCurrentlyFavorite) { state.favorites = state.favorites.filter(id => id !== productId); }
    else { state.favorites.push(productId); }
    saveFavorites();

    window.AppUI.showNotification(t(messageKey), messageType);
    window.AppUI.updateFavoriteButtons(productId, !isCurrentlyFavorite);
    window.AppUI.updateFavoritesPageIfOpen();
}


// --- Authentication & Admin ---

/** Sets up the listener for Firebase Authentication state changes. */
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
        const isAdmin = user && user.uid === adminUID;
        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');

        if (isAdmin) {
            console.log("Admin user detected.");
             if (!window.AdminLogic) {
                const adminScript = document.createElement('script');
                adminScript.src = 'admin.js';
                adminScript.defer = true;
                adminScript.onload = () => {
                    if (window.AdminLogic?.initialize) {
                        window.AdminLogic.initialize();
                         if (window.AppUI) window.AppUI.updateAdminSpecificUI(true);
                    } else { console.error("admin.js loaded but AdminLogic.initialize not found."); }
                };
                adminScript.onerror = () => console.error("Failed to load admin.js");
                document.body.appendChild(adminScript);
            } else if (window.AdminLogic.initialize) {
                window.AdminLogic.initialize();
            }
        } else {
            console.log("No admin user.");
            if (user) { // Sign out non-admins immediately
                 try { await signOut(auth); console.log("Non-admin signed out."); }
                 catch (e) { console.error("Sign out error:", e); }
            }
             if (window.AdminLogic?.deinitialize) window.AdminLogic.deinitialize();
        }

        if (window.AppUI) window.AppUI.updateAdminSpecificUI(isAdmin); // Update UI based on status
        if (window.AppUI?.isModalOpen('loginModal') && isAdmin) window.AppUI.closeCurrentPopup(); // Close modal on success
    });
}


// --- Notifications & PWA ---

/** Requests permission for push notifications and saves the token. */
export async function requestNotificationPermission() {
    if (!window.AppUI) { console.warn("requestNotificationPermission before AppUI."); return; }
    console.log('Requesting notification permission...');
    try {
        if (Notification.permission === 'granted') {
             window.AppUI.showNotification('مۆڵەت پێشتر دراوە.', 'success');
        } else if (Notification.permission === 'denied') {
            window.AppUI.showNotification('مۆڵەت ڕەتکراوەتەوە. لە ڕێکخستنەکان چاکی بکە.', 'error');
            return;
        }

        const permissionResult = await Notification.requestPermission();
        if (permissionResult === 'granted') {
            window.AppUI.showNotification(t('notification_permission_granted', { lang: state.currentLanguage }), 'success');
            const currentToken = await getToken(messaging, { vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' })
                .catch(err => { console.error('Token retrieval error:', err); window.AppUI.showNotification('هەڵە لە وەرگرتنی تۆکن.', 'error'); return null; });
            if (currentToken) { await saveTokenToFirestore(currentToken); }
            else { console.log('No token available or error.'); }
        } else {
             window.AppUI.showNotification(t('notification_permission_denied', { lang: state.currentLanguage }), 'error');
        }
    } catch (error) {
        console.error('Notification permission request error:', error);
         window.AppUI.showNotification(t('error_generic'), 'error');
    }
}


/** Saves the FCM token to Firestore. */
async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), { lastUpdated: Date.now() }, { merge: true });
        console.log('Token saved/updated.');
    } catch (error) {
        console.error('Error saving token:', error);
        if (window.AppUI) window.AppUI.showNotification('هەڵە لە پاشەکەوتکردنی تۆکن', 'error');
    }
}


/** Sets up the listener for foreground push messages. */
function setupForegroundMessageListener() {
    onMessage(messaging, (payload) => {
        console.log('Foreground message:', payload);
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
         if (window.AppUI) {
            window.AppUI.showNotification(`${title}: ${body}`, 'success');
             window.AppUI.updateNotificationBadge(true);
        }
    });
}

/** Handles the PWA beforeinstallprompt event. */
function setupInstallPromptHandler() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        if (window.AppUI) window.AppUI.showInstallButton(true);
        console.log('beforeinstallprompt fired.');
    });
}

/** Triggers the PWA installation prompt. */
export async function triggerInstallPrompt() {
    if (state.deferredPrompt) {
         if (window.AppUI) window.AppUI.showInstallButton(false);
        state.deferredPrompt.prompt();
        try { const { outcome } = await state.deferredPrompt.userChoice; console.log(`Install prompt outcome: ${outcome}`); }
        catch (error) { console.error("Install prompt error:", error); }
        state.deferredPrompt = null;
    } else {
        console.log("Deferred prompt not available.");
        if (window.AppUI) window.AppUI.showNotification("ئەپ دامەزراوە یان وێبگەڕ پشتگیری ناکات.", "error");
    }
}


// --- Service Worker ---

/** Registers the service worker and sets up update listeners. */
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registered.');
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New SW found!', newWorker);
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                         if (window.AppUI) window.AppUI.showUpdateNotification(true);
                    }
                });
            });
        }).catch(err => console.log('SW registration failed: ', err));

        navigator.serviceWorker.addEventListener('controllerchange', () => {
             if (navigator.serviceWorker.controller) {
                 console.log('New SW activated. Reloading...');
                 window.location.reload();
             }
        });
    } else { console.log('Service workers not supported.'); }
}


/** Sends a message to the waiting service worker to skip waiting. */
export function skipWaiting() {
    navigator.serviceWorker.getRegistration().then(registration => {
        if (registration?.waiting) {
            registration.waiting.postMessage({ action: 'skipWaiting' });
             if (window.AppUI) window.AppUI.showUpdateNotification(false);
        }
    }).catch(error => console.error("skipWaiting error:", error));
}

/** Forces an update by unregistering SW and clearing caches. */
export async function forceUpdate() {
     if (!window.AppUI) { console.error("Cannot force update, AppUI not ready."); return; }
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
            console.log('SWs unregistered.');
        }
        if (window.caches) {
            const keys = await window.caches.keys();
            await Promise.all(keys.map(key => window.caches.delete(key)));
            console.log('Caches cleared.');
        }
        window.AppUI.showNotification(t('update_success'), 'success');
        setTimeout(() => window.location.reload(true), 1500);
    } catch (error) {
        console.error('Force update error:', error);
        window.AppUI.showNotification(t('error_generic'), 'error');
    }
}


// --- History & Navigation ---

/** Saves the current scroll position for the main page filter state. */
export function saveCurrentScrollPosition() {
    const mainPageElement = document.getElementById('mainPage');
    if (!mainPageElement) return;
    const mainPageActive = mainPageElement.classList.contains('page-active');
    const currentState = history.state;
    if (mainPageActive && currentState && !currentState.type) {
        try { history.replaceState({ ...currentState, scroll: window.scrollY }, ''); }
        catch (e) { console.warn("Could not save scroll:", e); }
    }
}

/** Applies filter state (category, search, etc.) and updates the view. */
export async function applyFilterState(filterState, fromPopState = false) {
    if (!window.AppUI) { console.warn("applyFilterState before AppUI."); return; }

    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    window.AppUI.updateFilterUI(); // Update search input, category buttons etc.

    // Fetch/render content. searchProductsInFirestore now handles home sections internally.
    await searchProductsInFirestore(state.currentSearch, true); // Always treat as new search when applying state

    // Restore scroll after content is potentially rendered
    if (fromPopState && typeof filterState.scroll === 'number' && filterState.scroll >= 0) {
        setTimeout(() => window.scrollTo({ top: filterState.scroll, behavior: 'auto' }), 150);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/** Navigates to a new filter state, updating history. */
export async function navigateToFilter(newState) {
    saveCurrentScrollPosition(); // Save scroll of the current state

    const finalState = {
        category: state.currentCategory, subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory, search: state.currentSearch,
        ...newState, scroll: 0 // Apply changes, reset scroll
    };

    const params = new URLSearchParams();
    if (finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`;

    try { history.pushState(finalState, '', newUrl); }
    catch (e) { console.warn("Could not push history state:", e); }

    await applyFilterState(finalState); // Apply the new state
}


/** Handles the initial page load based on URL parameters and hash. */
export function handleInitialPageLoad() {
    state.initialLoadHandled = true;
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');

    if (!window.AppUI) { console.error("AppUI not ready for initial load."); return; }

    let initialPageId = 'mainPage';
    let initialPageTitle = '';
    let pageStateData = {};

    // Determine page from hash
    if (hash.startsWith('subcategory_')) {
        const ids = hash.split('_');
        if (ids.length >= 3) {
             initialPageId = 'subcategoryDetailPage';
             pageStateData = { mainCatId: ids[1], subCatId: ids[2] };
             // Title fetched later
        } else { console.warn("Invalid subcategory hash:", hash); }
    } else if (hash === 'settingsPage') {
        initialPageId = 'settingsPage';
        initialPageTitle = t('settings_title');
        pageStateData = { title: initialPageTitle };
    }

    // Set initial history state for the page
    try { history.replaceState({ type: 'page', id: initialPageId, ...pageStateData }, '', window.location.href); }
    catch(e) { console.warn("Could not replace initial page history:", e); }

    // Show the determined page
    window.AppUI.showPage(initialPageId, initialPageTitle);

    // Apply filters if on main page, or load detail page content
    if (initialPageId === 'mainPage') {
        const initialState = {
            category: params.get('category') || 'all', subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all', search: params.get('search') || '', scroll: 0
        };
        const queryString = params.toString();
        const initialUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`;
        try { history.replaceState(initialState, '', initialUrl); } // Replace history with filter state
        catch(e) { console.warn("Could not replace initial filter history:", e); }

        // Apply filters (searchProductsInFirestore handles home vs filter)
        applyFilterState(initialState);

    } else if (initialPageId === 'subcategoryDetailPage' && pageStateData.mainCatId && pageStateData.subCatId) {
         // Load content for detail page
         window.AppUI.showSubcategoryDetailPage(pageStateData.mainCatId, pageStateData.subCatId, true);
    }

     // Handle opening product detail or other popups based on URL *after* page is set
     if (productId) {
         setTimeout(() => window.AppUI.showProductDetailsById(productId), 700);
     } else if (initialPageId === 'mainPage' && hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage') {
         setTimeout(() => { // Delay popups slightly
             const element = document.getElementById(hash);
             if (element) {
                 const isSheet = element.classList.contains('bottom-sheet');
                 const isModal = element.classList.contains('modal');
                 if (isSheet || isModal) window.AppUI.openPopup(hash, isSheet ? 'sheet' : 'modal');
             }
         }, 300);
     }
}


// --- Initialization ---

/** Initializes core application logic. */
function initializeAppLogic() {
    state.initialLoadHandled = false;
    state.sliderIntervals = {};
    state.productCache = {};

    setupAuthListener();
    setupCategoryListener(); // This triggers handleInitialPageLoad when categories are ready
    setupContactLinksListener();
    setupContactMethodsListener();
    checkNewAnnouncements();
    setupForegroundMessageListener();
    setupInstallPromptHandler();
    setupServiceWorker();

    // Initial language setup - UI part is deferred until AppUI is ready
    const checkUIInterval = setInterval(() => {
        if (window.AppUI) {
            clearInterval(checkUIInterval);
            window.AppUI.setLanguageUI(state.currentLanguage);
            // Show welcome message via UI
            if (!localStorage.getItem('hasVisited')) {
                window.AppUI.openPopup('welcomeModal', 'modal');
                localStorage.setItem('hasVisited', 'true');
            }
        }
    }, 50);
}


/** Main initialization function, enables Firestore persistence first. */
function init() {
    console.log("Initializing application...");
    enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.error("Error enabling persistence:", err))
        .finally(() => initializeAppLogic()); // Initialize regardless of persistence status
}

document.addEventListener('DOMContentLoaded', init);


// --- Global Exposure for Admin ---
// Ensure this runs after the functions are defined
window.globalAdminTools = {
    // Firebase services/functions
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,

    // Core utility functions
    t,
    showNotification: (msg, type) => { if (window.AppUI) window.AppUI.showNotification(msg, type); else console.warn("UI not ready for notification."); },
    openPopup: (id, type) => { if (window.AppUI) window.AppUI.openPopup(id, type); },
    closeCurrentPopup: () => { if (window.AppUI) window.AppUI.closeCurrentPopup(); },
    searchProductsInFirestore,

    // Collections
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection,

    // State accessors/mutators
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,

    // Cache clearing
    clearProductCache: () => {
        console.log("Product cache cleared by admin.");
        state.productCache = {};
        if (window.AppUI) window.AppUI.clearHomePageContent(); // Clear home sections too
        // Optionally trigger a re-render if needed: searchProductsInFirestore(state.currentSearch, true);
    },

    // Specific Fetch functions for admin forms
    fetchSubcategories,
    fetchSubSubcategories,
};

