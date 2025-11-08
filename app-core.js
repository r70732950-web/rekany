// app-core.js
// Logika bingehîn, danûstendina daneyan, û rêveberiya state

import {
    // === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
    // Em elementên nû yên UI ji bo pêkhateya nû (new structure) import dikin
    // ئێمە توخمە نوێیەکانی UI بۆ پێکهاتە نوێیەکە هاوردە دەکەین
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    categoryLayoutsCollection, // <-- KODA NÛ / کۆدی نوێ
    translations, state,
    homePageLayoutContainer, categoryPageLayoutContainer, // <-- KODA NÛ / کۆدی نوێ
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    // === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where,
    startAfter, addDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- Exported Helper Functions ---
export function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

export function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://www.${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

// --- Local Storage & State Management ---

export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Authentication ---

export async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        throw new Error(t('login_error'));
    }
}

export async function handleLogout() {
    await signOut(auth);
}

// --- Firestore Data Fetching & Manipulation ---

export async function fetchCategories() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(categoriesQuery);
    const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.categories = fetchedCategories;
}

export async function fetchSubcategories(categoryId) {
    if (categoryId === 'all') return [];
    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching subcategories: ", error);
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

export async function fetchProductById(productId) {
    try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            console.warn(`Product with ID ${productId} not found.`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching product by ID:", error);
        return null;
    }
}

export async function fetchRelatedProducts(currentProduct) {
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) return [];

    const baseQuery = collection(db, "products");
    let conditions = [];
    let orderByClauses = []; 

    if (currentProduct.subSubcategoryId) {
        conditions.push(where('subSubcategoryId', '==', currentProduct.subSubcategoryId));
    } else if (currentProduct.subcategoryId) {
        conditions.push(where('subcategoryId', '==', currentProduct.subcategoryId));
    } else {
        conditions.push(where('categoryId', '==', currentProduct.categoryId));
    }

    orderByClauses.push(orderBy('createdAt', 'desc'));
    const q = query(baseQuery, ...conditions, ...orderByClauses, limit(7));

    try {
        const snapshot = await getDocs(q);
        const allRelated = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filteredProducts = allRelated
            .filter(product => product.id !== currentProduct.id)
            .slice(0, 6);
        return filteredProducts;
    } catch (error) {
        console.error("Error fetching related products (new method):", error);
        return [];
    }
}


/**
 * Ev fonksîyon dîzayna taybet a kategoriyekê ji Firestore tîne.
 * ئەم فەنکشنە دیزاینی تایبەتی جۆرێک لە فایەرستۆر دەهێنێت.
 * @param {string} categoryId IDya kategoriyê (IDی جۆرەکە)
 * @returns {object|null} Daneyên dîzaynê (enabled, sections) an null
 */
export async function fetchCategoryLayout(categoryId) {
    if (!categoryId) return null;
    try {
        const layoutDocRef = doc(db, "category_layouts", categoryId);
        const docSnap = await getDoc(layoutDocRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.enabled === true && Array.isArray(data.sections)) {
                return data;
            }
        }
        return null; // Dîzayn tune an ne çalak e (دیزاین نییە یان چالاک نییە)
    } catch (error) {
        console.error(`Error fetching layout for category ${categoryId}:`, error);
        return null;
    }
}


// === START: GۆڕANkARIYA MEZIN / گۆڕانکاریی گەورە ===
// Ev fonksîyon bi tevahî hatiye nûvekirin da ku 3 konteyniran birêve bibe
// ئەم فەنکشنە بە تەواوی نوێکراوەتەوە بۆ بەڕێوەبردنی 3 کۆنتەینەرەکە
export async function fetchProducts(searchTerm = '', isNewSearch = false) {
    
    // 1. Pêşî, em rewşa "Perrê Sereke" (Home Page) kontrol dikin
    // 1. یەکەمجار، پشکنینی دۆخی "پەڕەی سەرەکی" دەکەین
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (shouldShowHomeSections) {
        // Ji UI re bêje bila dîzayna *malê* (home_layout) nîşan bide
        // بە UI بڵێ با دیزاینی *ماڵەوە* (home_layout) پیشان بدات
        // `layout: null` tê wê wateyê ku UI dê fonksîyona `fetchHomeLayout` a standard bang bike
        // `layout: null` واتە UI بانگی فەنکشنی `fetchHomeLayout`ـی ستاندارد دەکات
        return { viewMode: 'HOME', layout: null, layoutId: 'home', products: [], allLoaded: true };
    }

    // 2. KODA NÛ: Em rewşa "Dîzayna Kategoriyê ya Taybet" kontrol dikin
    // 2. کۆدی نوێ: پشکنینی دۆخی "دیزاینی تایبەتی جۆر" دەکەین
    const shouldShowCategoryLayout = !searchTerm && state.currentCategory !== 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (shouldShowCategoryLayout) {
        // Hewl bide dîzayna taybet a vê kategoriyê bîne
        // هەوڵ بدە دیزاینی تایبەتی ئەم جۆرە بهێنیت
        const categoryLayoutData = await fetchCategoryLayout(state.currentCategory);
        
        if (categoryLayoutData) { 
            // Dîzaynek çalak hate dîtin!
            // دیزاینێکی چالاک دۆزرایەوە!
            // Ji UI re bêje bila vê dîzaynê nîşan bide (ne kaڵayan)
            // بە UI بڵێ با ئەم دیزاینە پیشان بدات (نەک کاڵاکان)
            return { 
                viewMode: 'CATEGORY_LAYOUT', 
                layout: categoryLayoutData.sections, // Beşên dîzaynê derbas bike (بەشەکانی دیزاینەکە تێپەڕێنە)
                layoutId: state.currentCategory, // Ji bo cachekirinê IDya kategoriyê derbas bike (بۆ کاشکردن IDی جۆرەکە تێپەڕێنە)
                products: [], 
                allLoaded: true 
            };
        }
        // Heke `categoryLayoutData` null be, em didomînin (ئەگەر `categoryLayoutData` نول بوو، بەردەوام دەبین)
    }
    
    // 3. Heke ne "Home" û ne "Dîzayna Kategoriyê" be, kaڵayên normal bîne (Grid)
    // 3. ئەگەر "ماڵەوە" نەبوو یان "دیزاینی جۆر" نەبوو، کاڵا ئاساییەکان بهێنە (Grid)
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        // Ji UI re bêje bila Grida Berheman nîşan bide
        // بە UI بڵێ با لیستی بەرهەمەکان پیشان بدات
        return { viewMode: 'PRODUCT_GRID', products: state.products, allLoaded: state.allProductsLoaded };
    }

    if (state.isLoadingMoreProducts) return null;
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
    }
    if (state.allProductsLoaded && !isNewSearch) return null;

    state.isLoadingMoreProducts = true;

    try {
        let productsQuery = collection(db, "products");
        let conditions = [];
        let orderByClauses = [];

        if (state.currentCategory && state.currentCategory !== 'all') {
            conditions.push(where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            conditions.push(where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            conditions.push(where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            conditions.push(where('searchableName', '>=', finalSearchTerm));
            conditions.push(where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
            orderByClauses.push(orderBy("searchableName", "asc"));
        }
        orderByClauses.push(orderBy("createdAt", "desc"));

        let finalQuery = query(productsQuery, ...conditions, ...orderByClauses);
        if (state.lastVisibleProductDoc && !isNewSearch) {
            finalQuery = query(finalQuery, startAfter(state.lastVisibleProductDoc));
        }
        finalQuery = query(finalQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(finalQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;

        if (isNewSearch) {
            state.products = newProducts;
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        } else {
            state.products = [...state.products, ...newProducts];
        }
        
        // Ji UI re bêje bila Grida Berheman nîşan bide
        // بە UI بڵێ با لیستی بەرهەمەکان پیشان بدات
        return { viewMode: 'PRODUCT_GRID', products: newProducts, allLoaded: state.allProductsLoaded };

    } catch (error) {
        console.error("Error fetching products:", error);
        return { viewMode: 'PRODUCT_GRID', products: [], allLoaded: true, error: true };
    } finally {
        state.isLoadingMoreProducts = false;
    }
}
// === END: GۆڕANkARIYA MEZIN / کۆتایی گۆڕانکاریی گەورە ===

export async function fetchPolicies() {
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().content) {
            return docSnap.data().content;
        }
        return null;
    } catch (error) {
        console.error("Error fetching policies:", error);
        return null;
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

export async function fetchContactMethods() {
    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching contact methods:", error);
        return [];
    }
}

export async function fetchHomeLayout() {
    try {
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);
        return layoutSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching home layout:", error);
        return [];
    }
}

export async function fetchPromoGroupCards(groupId) {
    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        return cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching promo cards for group ${groupId}:`, error);
        return [];
    }
}

export async function fetchBrandGroupBrands(groupId) {
    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching brands for group ${groupId}:`, error);
        return [];
    }
}

export async function fetchNewestProducts(limitCount = 10) {
    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return [];
    }
}

export async function fetchShortcutRowCards(rowId) {
    try {
        const cardsCollectionRef = collection(db, "shortcut_rows", rowId, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        return cardsSnapshot.docs.map(cardDoc => ({ id: cardDoc.id, ...cardDoc.data() }));
    } catch(error) {
        console.error(`Error fetching shortcut cards for row ${rowId}:`, error);
        return [];
    }
}

export async function fetchCategoryRowProducts(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId } = sectionData;
    let queryField, queryValue;

    if (subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
    } else if (subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
    } else {
        return []; // No category specified
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
        console.error(`Error fetching products for single category row:`, error);
        return [];
    }
}

export async function fetchInitialProductsForHome(limitCount = 10) {
     try {
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching initial products for home page:", error);
        return [];
    }
}

// --- Cart Logic ---

export async function addToCartCore(productId) {
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        product = await fetchProductById(productId);
        if (!product) {
            return { success: false, message: t('product_not_found_error') };
        }
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
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
    return { success: true, message: t('product_added_to_cart') };
}

export function updateCartQuantityCore(productId, change) {
    const cartItemIndex = state.cart.findIndex(item => item.id === productId);
    if (cartItemIndex > -1) {
        state.cart[cartItemIndex].quantity += change;
        if (state.cart[cartItemIndex].quantity <= 0) {
            state.cart.splice(cartItemIndex, 1);
        }
        saveCart();
        return true;
    }
    return false;
}

export function removeFromCartCore(productId) {
    const initialLength = state.cart.length;
    state.cart = state.cart.filter(item => item.id !== productId);
    if (state.cart.length < initialLength) {
        saveCart();
        return true;
    }
    return false;
}

export function generateOrderMessageCore() {
    if (state.cart.length === 0) return "";

    let total = 0;
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
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


// --- Favorites Logic ---

export function toggleFavoriteCore(productId) {
    const isCurrentlyFavorite = isFavorite(productId);
    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        saveFavorites();
        return { favorited: false, message: t('product_removed_from_favorites') };
    } else {
        state.favorites.push(productId);
        saveFavorites();
        return { favorited: true, message: t('product_added_to_favorites') };
    }
}

// --- Profile Logic ---

export function saveProfileCore(profileData) {
    state.userProfile = {
        name: profileData.name || '',
        address: profileData.address || '',
        phone: profileData.phone || '',
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
    return t('profile_saved');
}

// --- Language ---
// === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
// Em vê fonksîyonê nûve dikin da ku hemî dîzaynan paqij bike
// ئێمە ئەم فەنکشنە نوێ دەکەینەوە بۆ پاککردنەوەی هەموو دیزاینەکان
export function setLanguageCore(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    
    // Cacheya lêgerîna berheman paqij bike (کاشی گەڕانی بەرهەمەکان پاک بکەوە)
    state.productCache = {}; 

    // Hemî dîzaynên renderkirî paqij bike da ku bi zimanê nû ji nû ve werin çêkirin
    // هەموو دیزاینە ڕێندەرکراوەکان پاک بکەوە بۆ ئەوەی بە زمانی نوێ دووبارە دروست بکرێنەوە
    if (homePageLayoutContainer) {
        homePageLayoutContainer.innerHTML = '';
        homePageLayoutContainer.dataset.cached = 'false';
    }
    if (categoryPageLayoutContainer) {
        categoryPageLayoutContainer.innerHTML = '';
        categoryPageLayoutContainer.dataset.cachedLayoutId = '';
    }
}
// === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===


// --- Notifications ---

export async function requestNotificationPermissionCore() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
                return { granted: true, message: 'مۆڵەتی ناردنی ئاگەداری درا' };
            } else {
                console.log('No registration token available.');
                return { granted: false, message: 'تۆکن وەرنەگیرا' };
            }
        } else {
            console.log('Unable to get permission to notify.');
            return { granted: false, message: 'مۆڵەت نەدرا' };
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
        return { granted: false, message: t('error_generic') };
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now()
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

export function checkNewAnnouncementsCore(latestAnnouncementTimestamp) {
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    return latestAnnouncementTimestamp > lastSeenTimestamp;
}

export function updateLastSeenAnnouncementTimestamp(timestamp) {
     localStorage.setItem('lastSeenAnnouncementTimestamp', timestamp);
}

// --- PWA & Service Worker ---

export async function handleInstallPrompt(installBtn) {
    if (state.deferredPrompt) {
        installBtn.style.display = 'none';
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null;
    }
}

export async function forceUpdateCore() {
    if (confirm(t('update_confirm'))) {
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
            return { success: true, message: t('update_success') };
        } catch (error) {
            console.error('Error during force update:', error);
            return { success: false, message: t('error_generic') };
        }
    }
    return { success: false, message: 'Update cancelled.' };
}

// --- Navigation / History ---

// === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
// Em fonksîyonê nûve dikin da ku konteynira çalak a rast bibîne
// ئێمە فەنکشنەکە نوێ دەکەینەوە بۆ دۆزینەوەی کۆنتەینەرە چالاکە ڕاستەکە
export function saveCurrentScrollPositionCore() {
    const currentState = history.state;
    // Em tenê ji bo rûpela serekî (mainPage) û dema ku ew fîlterek e (ne popup) tomar dikin
    // ئێمە تەنها بۆ لاپەڕەی سەرەکی و کاتێک فلتەرە (نەک پۆپئەپ) پاشەکەوتی دەکەین
    if (state.currentPageId !== 'mainPage' || !currentState || currentState.type) {
        return; 
    }

    // Konteynira çalak a NIHA bibîne (کۆنتەینەری چالاکی ئێستا بدۆزەرەوە)
    let activeContainer = null;
    if (homePageLayoutContainer && homePageLayoutContainer.style.display !== 'none') {
        activeContainer = homePageLayoutContainer;
    } else if (categoryPageLayoutContainer && categoryPageLayoutContainer.style.display !== 'none') {
        activeContainer = categoryPageLayoutContainer;
    } else {
        // Em texmîn dikin ku heke yên din neçalak bin, divê grid çalak be
        // ئێمە وا دادەنێین ئەگەر ئەوانی تر چالاک نەبن، دەبێت گریدەکە چالاک بێت
        activeContainer = document.getElementById('productGridPageContainer'); // Fallback to getElementById if import failed
    }

    if (activeContainer) {
        // Skrolê konteynira çalak tomar bike (سکڕۆڵی کۆنتەینەرە چالاکەکە پاشەکەوت بکە)
        history.replaceState({ ...currentState, scroll: activeContainer.scrollTop }, '');
    }
}
// === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===

// Applies filter state (category, search, etc.) but doesn't handle UI rendering directly
export function applyFilterStateCore(filterState) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
}

export function navigateToFilterCore(newState) {
    saveCurrentScrollPositionCore(); 
    const finalState = { ...history.state, ...newState }; 
    delete finalState.scroll; // Skrola kevn jê bibe ji bo rewşa nû (سکڕۆڵی کۆن بسڕەوە بۆ دۆخی نوێ)

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    history.pushState(finalState, '', newUrl);
    applyFilterStateCore(finalState);
}


// --- Initialization ---

async function initializeCoreLogic() {
    if (!state.sliderIntervals) state.sliderIntervals = {};
    await fetchCategories();
}

export async function initCore() {
    return enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.warn("Firestore Persistence failed:", err.code))
        .finally(async () => {
            await initializeCoreLogic();

            onAuthStateChanged(auth, async (user) => {
                const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
                const isAdmin = user && user.uid === adminUID;
                const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';

                if (isAdmin) {
                    sessionStorage.setItem('isAdmin', 'true');
                    if (!wasAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                         window.AdminLogic.initialize();
                    }
                } else {
                    sessionStorage.removeItem('isAdmin');
                     if (user) { await signOut(auth); }
                    if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                         window.AdminLogic.deinitialize();
                    }
                }
                document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
            });

            onMessage(messaging, (payload) => {
                console.log('Foreground message received: ', payload);
                document.dispatchEvent(new CustomEvent('fcmMessage', { detail: payload }));
            });

             window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                state.deferredPrompt = e;
                console.log('`beforeinstallprompt` event fired.');
                document.dispatchEvent(new Event('installPromptReady'));
            });

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered.');
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New SW found!', newWorker);
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                document.dispatchEvent(new CustomEvent('swUpdateReady', { detail: { registration } }));
                            }
                        });
                    });
                }).catch(err => console.error('SW registration failed: ', err));

                navigator.serviceWorker.addEventListener('controllerchange', () => {
                     console.log('New SW activated. Reloading...');
                     window.location.reload();
                });
            }
        });
}


// === START: GۆڕANkARI LI VIR (BLOKA EXPORTÊ YA PAQIJ) ===
// === دەستپێک: گۆڕانکاری لێرە (بلۆکی هەناردەکردنی پاک) ===
// Em tenê tiştên ku PÊWÎST in û jixwe li jor bi 'export function' nehatine hinartin, hinartin
// ئێمە تەنها ئەو شتانە هەناردە دەکەین کە پێویستن و پێشتر لە سەرەوە بە 'export function' هەناردە نەکراون
export {
    state, // Objekta stateyê ya guhêrbar hinartin (هەناردەکردنی ئۆبجێکتی ستەیت)

    // Fonksiyonên Firebase yên ku app-ui.js û admin.js hewceyê wan in
    // فەنکشنەکانی فایەربەیس کە app-ui.js و admin.js پێویستیان پێیەتی
    db,
    productsCollection,
    collection, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
    query, orderBy, onSnapshot, getDocs, where, limit, startAfter, runTransaction
};
// === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===