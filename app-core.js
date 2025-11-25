// app-core.js
import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    categoryLayoutsCollection, 
    usersCollection, 
    createUserWithEmailAndPassword, updateProfile, 
    sendPasswordResetEmail,
    deleteUser, 
    translations, 
    CART_KEY, FAVORITES_KEY, PRODUCTS_PER_PAGE,
} from './app-setup.js';

import { 
    signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where,
    startAfter, addDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- State Definition ---
export let state = {
    currentLanguage: localStorage.getItem('language') || 'ku_sorani',
    deferredPrompt: null,
    cart: JSON.parse(localStorage.getItem("maten_store_cart")) || [],
    favorites: JSON.parse(localStorage.getItem("maten_store_favorites")) || [],
    userProfile: {}, 
    currentUser: null, 
    editingProductId: null, 
    products: [],
    categories: [], 
    subcategories: [], 
    lastVisibleProductDoc: null,
    isLoadingMoreProducts: false,
    allProductsLoaded: false,
    isRenderingHomePage: false,
    productCache: {},
    currentCategory: 'all',
    currentSubcategory: 'all',
    currentSubSubcategory: 'all',
    currentSearch: '',
    currentProductId: null, 
    currentPageId: 'mainPage', 
    currentPopupState: null, 
    pendingFilterNav: null, 
    sliderIntervals: {}, 
    contactInfo: {}, 
    activeChatUserId: null,
    unreadMessagesCount: 0,
    currentSplitCategory: null 
};

// Promise to ensure Auth is ready
let authReadyResolver;
export const authReady = new Promise(resolve => {
    authReadyResolver = resolve;
});

// --- Utility Functions ---

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

function extractShippingCostFromText(text) {
    if (!text) return 0;
    const cleanText = text.toString().replace(/,/g, '');
    const match = cleanText.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
}

// --- Storage Helpers ---

export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Auth Functions ---

async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        throw new Error(t('login_error')); 
    }
}

async function handleUserLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error) {
        console.error("User login error:", error.code);
        return { success: false, message: t('user_login_error') };
    }
}

async function handleUserSignUp(name, email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: name });

        const userProfileRef = doc(usersCollection, user.uid);
        await setDoc(userProfileRef, {
            email: user.email,
            displayName: name,
            createdAt: Date.now(),
            name: "",      
            address: "",  
            phone: ""     
        });

        return { success: true, message: t('user_signup_success') };
    } catch (error) {
        console.error("User signup error:", error.code);
        if (error.code === 'auth/email-already-in-use') {
            return { success: false, message: t('user_signup_email_exists') };
        }
        if (error.code === 'auth/weak-password') {
            return { success: false, message: t('user_signup_weak_password') };
        }
        return { success: false, message: t('error_generic') };
    }
}

async function handleUserLogout() {
    try {
        await signOut(auth);
        return { success: true, message: t('user_logout_success') };
    } catch (error) {
        console.error("User logout error:", error);
        return { success: false, message: t('error_generic') };
    }
}

async function handlePasswordReset(email) {
    if (!email) {
        return { success: false, message: t('password_reset_enter_email') };
    }
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: t('password_reset_email_sent') };
    } catch (error) {
        console.error("Password reset error:", error.code);
        if (error.code === 'auth/user-not-found') {
            return { success: false, message: t('password_reset_error_not_found') };
        }
        return { success: false, message: t('error_generic') };
    }
}

export async function handleDeleteAccount(skipConfirmation = false) {
    if (!state.currentUser) return { success: false, message: "Error" };

    if (!skipConfirmation && !confirm(t('delete_account_confirm'))) {
        return { success: false, message: "Cancelled" };
    }

    try {
        const uid = state.currentUser.uid;
        const user = auth.currentUser;

        await deleteDoc(doc(db, "users", uid));
        await deleteUser(user);

        state.currentUser = null;
        state.userProfile = {};
        
        return { success: true, message: t('account_deleted_success') };

    } catch (error) {
        console.error("Delete Account Error:", error);
        
        if (error.code === 'auth/requires-recent-login') {
            return { success: false, message: t('delete_account_error_login') };
        }
        
        return { success: false, message: t('error_generic') };
    }
}

// --- Fetching Data ---

async function fetchCategories() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(categoriesQuery);
    const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.categories = fetchedCategories;
}

async function fetchSubcategories(categoryId) {
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

async function fetchSubSubcategories(mainCatId, subCatId) {
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

async function fetchProductById(productId) {
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

async function fetchRelatedProducts(currentProduct) {
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
        const filteredProducts = allRelated.filter(product => product.id !== currentProduct.id).slice(0, 6); 
        return filteredProducts;
    } catch (error) {
        console.error("Error fetching related products:", error);
        return [];
    }
}

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
        return null; 
    } catch (error) {
        console.error(`Error fetching layout for category ${categoryId}:`, error);
        return null;
    }
}

async function fetchProducts(searchTerm = '', isNewSearch = false) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (shouldShowHomeSections) {
        return { isHome: true, layout: null, products: [], allLoaded: true };
    }

    const shouldShowCategoryLayout = !searchTerm && state.currentCategory !== 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (shouldShowCategoryLayout) {
        const categoryLayoutData = await fetchCategoryLayout(state.currentCategory);
        if (categoryLayoutData) { 
            return { isHome: true, layout: categoryLayoutData.sections, products: [], allLoaded: true };
        }
    }
    
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        return { isHome: false, products: state.products, allLoaded: state.allProductsLoaded };
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
        
        return { isHome: false, products: newProducts, allLoaded: state.allProductsLoaded };

    } catch (error) {
        console.error("Error fetching products:", error);
        return { isHome: false, products: [], allLoaded: true, error: true }; 
    } finally {
        state.isLoadingMoreProducts = false;
    }
}

async function fetchPolicies() {
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

async function fetchContactMethods() {
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

async function fetchHomeLayout() {
    try {
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);
        return layoutSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching home layout:", error);
        return [];
    }
}

async function fetchPromoGroupCards(groupId) {
    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        return cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching promo cards for group ${groupId}:`, error);
        return [];
    }
}

async function fetchBrandGroupBrands(groupId) {
    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching brands for group ${groupId}:`, error);
        return [];
    }
}

async function fetchNewestProducts(limitCount = 20, categoryId = null) {
    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        let q;

        if (categoryId && categoryId !== 'all') {
             q = query(
                 productsCollection, 
                 where('categoryId', '==', categoryId), 
                 where('createdAt', '>=', fifteenDaysAgo), 
                 orderBy('createdAt', 'desc'), 
                 limit(limitCount)
             );
        } else {
             q = query(
                 productsCollection, 
                 where('createdAt', '>=', fifteenDaysAgo), 
                 orderBy('createdAt', 'desc'), 
                 limit(limitCount)
             );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return [];
    }
}

async function fetchShortcutRowCards(rowId) {
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

async function fetchCategoryRowProducts(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId } = sectionData;
    let queryField, queryValue;

    if (subSubcategoryId) {
        queryField = 'subSubcategoryId'; queryValue = subSubcategoryId;
    } else if (subcategoryId) {
        queryField = 'subcategoryId'; queryValue = subcategoryId;
    } else if (categoryId) {
        queryField = 'categoryId'; queryValue = categoryId;
    } else { return []; }

    try {
        const q = query(productsCollection, where(queryField, '==', queryValue), orderBy('createdAt', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return [];
    }
}

async function fetchInitialProductsForHome(limitCount = 30, categoryId = null) {
     try {
        let q;
        
        if (!state.lastVisibleProductDoc || state.currentCategory !== (categoryId || 'all')) {
             state.allProductsLoaded = false;
             state.lastVisibleProductDoc = null;
             state.products = [];
        }
        
        let conditions = [];
        
        if (categoryId && categoryId !== 'all') {
             conditions.push(where('categoryId', '==', categoryId));
        }
        conditions.push(orderBy('createdAt', 'desc'));

        q = query(productsCollection, ...conditions, limit(limitCount));

        const snapshot = await getDocs(q);
        
        state.lastVisibleProductDoc = snapshot.docs[snapshot.docs.length - 1];
        state.allProductsLoaded = snapshot.docs.length < limitCount;
        
        const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        return fetchedProducts;
    } catch (error) {
        console.error("Error fetching initial products for home page:", error);
        return [];
    }
}

export async function addToCartCore(productId, selectedVariationInfo = null) {
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        console.warn("Product not found in local cache for cart. Fetching...");
        product = await fetchProductById(productId);
        if (!product) {
            return { success: false, message: t('product_not_found_error') };
        }
    }

    const shippingText = (product.shippingInfo && product.shippingInfo[state.currentLanguage]) ||
                         (product.shippingInfo && product.shippingInfo.ku_sorani) || '';
    const calculatedShippingCost = extractShippingCostFromText(shippingText);
    const baseImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');

    let cartId = product.id;
    let cartItemName = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || (typeof product.name === 'string' ? product.name : 'کاڵای بێ ناو');
    let cartItemPrice = product.price;
    let cartItemImage = baseImage;
    
    if (selectedVariationInfo && selectedVariationInfo.lvl1Id) {
        cartId = `${product.id}_${selectedVariationInfo.lvl1Id}`;
        cartItemName += ` (${selectedVariationInfo.lvl1Name}`;
        
        const lvl1Var = (product.variations || []).find(v => v.id === selectedVariationInfo.lvl1Id);
        if (lvl1Var && lvl1Var.imageUrls && lvl1Var.imageUrls.length > 0) {
            cartItemImage = lvl1Var.imageUrls[0];
        }

        if (selectedVariationInfo.lvl2Id) {
            cartId += `_${selectedVariationInfo.lvl2Id}`;
            cartItemName += ` - ${selectedVariationInfo.lvl2Name}`;
            cartItemPrice = selectedVariationInfo.price; 
        }
        
        cartItemName += `)`;
    }

    const existingItem = state.cart.find(item => item.id === cartId);

    if (existingItem) {
        existingItem.quantity++;
        existingItem.shippingCost = calculatedShippingCost; 
    } else {
        state.cart.push({
            id: cartId, 
            productId: product.id, 
            name: cartItemName,
            // --- [MARKET CODE: START] ---
            marketCode: product.marketCode || '', // ئێرە زیاد کرا
            // --- [MARKET CODE: END] ---
            price: cartItemPrice, 
            shippingCost: calculatedShippingCost,
            image: cartItemImage, 
            quantity: 1,
            variationInfo: selectedVariationInfo 
        });
    }
    saveCart();
    return { success: true, message: t('product_added_to_cart') };
}

export function updateCartQuantityCore(cartId, change) {
    const cartItemIndex = state.cart.findIndex(item => item.id === cartId);
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

export function removeFromCartCore(cartId) {
    const initialLength = state.cart.length;
    state.cart = state.cart.filter(item => item.id !== cartId);
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
        const shipping = item.shippingCost || 0;
        const lineTotal = (item.price * item.quantity) + shipping;
        
        total += lineTotal;
        
        const itemName = (typeof item.name === 'string') 
            ? item.name 
            : ((item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || 'کاڵای بێ ناو');
        
        // --- [MARKET CODE: START] ---
        let marketInfo = "";
        if (item.marketCode) {
            marketInfo = ` [مارکێت: ${item.marketCode}]`;
        }
        // --- [MARKET CODE: END] ---

        let priceDetails = "";
        if (shipping > 0) {
             priceDetails = `(${item.price.toLocaleString()} x ${item.quantity}) + ${shipping.toLocaleString()} (${t('shipping_cost') || 'گەیاندن'}) = ${lineTotal.toLocaleString()}`;
        } else {
             priceDetails = `(${item.price.toLocaleString()} x ${item.quantity}) + (${t('free_shipping') || 'گەیاندن بێ بەرامبەر'}) = ${lineTotal.toLocaleString()}`;
        }

        // --- [MARKET CODE: Added marketInfo] ---
        message += `- ${itemName}${marketInfo}\n`;
        message += `   💰 ${priceDetails}\n`;
        message += `   ----------------\n`;
    });
    
    message += `\n💵 ${t('order_total')}: ${total.toLocaleString()} د.ع.\n`;

    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n👤 ${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

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

export async function saveProfileCore(profileData) {
    if (!state.currentUser) {
        return { success: false, message: "تکایە سەرەتا بچۆ ژوورەوە" }; 
    }
    try {
        const userProfileRef = doc(usersCollection, state.currentUser.uid);
        await setDoc(userProfileRef, {
            name: profileData.name || '',
            address: profileData.address || '',
            phone: profileData.phone || '',
        }, { merge: true }); 
        
        return { success: true, message: t('profile_saved') };
    } catch (error) {
        console.error("Error saving profile to Firestore:", error);
        return { success: false, message: t('error_generic') };
    }
}

async function requestNotificationPermissionCore() {
    if (!("Notification" in window)) {
        return { granted: false, message: 'مۆبایلەکەت پشتگیری ئاگەداری (Notifications) ناکات.' };
    }
    if (Notification.permission === 'denied') {
        return { granted: false, message: 'مۆڵەتی ئاگەداری ڕەت کراوەتەوە (Blocked). تکایە لە ڕێکخستنەکانی وێبگەڕ (Settings) چالاکی بکە.' };
    }

    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;
            const vapidKey = "BBu5yMLTteU8iIyneiAjmo6j5ERmlqCjOwKxZ8aPfLOHTETkehoqnML_7kM92yLwNyMr0xCC2AmeIyeumYgHBtM";
            const currentToken = await getToken(messaging, { 
                serviceWorkerRegistration: registration,
                vapidKey: vapidKey 
            });

            if (currentToken) {
                await saveTokenToFirestore(currentToken);
                return { granted: true, message: 'مۆڵەتی ناردنی ئاگەداری بە سەرکەوتوویی درا' };
            } else {
                return { granted: false, message: 'تۆکن وەرنەگیرا (Token Error)' };
            }
        } else {
            return { granted: false, message: 'مۆڵەت نەدرا (Denied)' };
        }
    } catch (error) {
        console.error("Notification Error:", error);
        return { granted: false, message: 'هەڵە: ' + error.message };
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        const tokenData = {
            lastUpdatedAt: Date.now(),
            language: state.currentLanguage
        };
        
        if (state.currentUser && state.currentUser.uid) {
            tokenData.userId = state.currentUser.uid;
        }

        await setDoc(doc(tokensCollection, token), tokenData, { merge: true });
        console.log("Token saved with userId:", tokenData.userId);
    } catch (error) { console.error('Error saving token: ', error); }
}

export function checkNewAnnouncementsCore(latestAnnouncementTimestamp) {
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    return latestAnnouncementTimestamp > lastSeenTimestamp;
}

export function updateLastSeenAnnouncementTimestamp(timestamp) {
     localStorage.setItem('lastSeenAnnouncementTimestamp', timestamp);
}

async function handleInstallPrompt(installBtn) {
    if (state.deferredPrompt) {
        installBtn.style.display = 'none'; 
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        state.deferredPrompt = null; 
    }
}

async function forceUpdateCore() {
    if (confirm(t('update_confirm'))) {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) { await registration.unregister(); }
            }
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
            }
            return { success: true, message: t('update_success') };
        } catch (error) { return { success: false, message: t('error_generic') }; }
    }
    return { success: false, message: 'Update cancelled.' }; 
}

export function saveCurrentScrollPositionCore() {
    const currentState = history.state;
    const activePage = document.getElementById(state.currentPageId); 
    
    if (activePage && currentState) {
        history.replaceState({ ...currentState, scroll: activePage.scrollTop }, '');
    }
}

export function applyFilterStateCore(filterState) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
}

export function navigateToFilterCore(newState) {
    saveCurrentScrollPositionCore(); 
    const finalState = { ...history.state, ...newState }; 
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.pushState(finalState, '', newUrl);
    applyFilterStateCore(finalState);
}

async function initializeCoreLogic() {
    if (!state.sliderIntervals) state.sliderIntervals = {};
    await fetchCategories();
    if ('Notification' in window && Notification.permission === 'granted') {
        requestNotificationPermissionCore(); 
    }
}

async function updateTokenLanguageInFirestore(newLang) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const currentToken = await getToken(messaging, { serviceWorkerRegistration: await navigator.serviceWorker.ready });
            if (currentToken) {
                const tokensCollection = collection(db, 'device_tokens');
                await setDoc(doc(tokensCollection, currentToken), { language: newLang }, { merge: true }); 
            }
        } catch (error) { console.error('Error updating token language:', error); }
    }
}

export function setLanguageCore(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    state.productCache = {};
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) homeContainer.innerHTML = '';
    updateTokenLanguageInFirestore(lang);
}

let userProfileUnsubscribe = null; 

async function loadUserProfile(uid) {
    if (userProfileUnsubscribe) {
        userProfileUnsubscribe();
        userProfileUnsubscribe = null;
    }
    const userProfileRef = doc(usersCollection, uid);
    
    userProfileUnsubscribe = onSnapshot(userProfileRef, (docSnap) => {
        if (docSnap.exists()) {
            const profileData = docSnap.data();
            state.userProfile = {
                name: profileData.name || '',
                address: profileData.address || '',
                phone: profileData.phone || ''
            };
            if (state.currentUser) {
                state.currentUser.displayName = profileData.displayName;
                state.currentUser.email = profileData.email;
            }
        } else {
            setDoc(userProfileRef, {
                email: state.currentUser.email,
                displayName: state.currentUser.displayName,
                createdAt: Date.now(),
                name: "", address: "", phone: ""
            }).catch(e => console.error("Error creating profile:", e));
            state.userProfile = { name: "", address: "", phone: "" };
        }
        document.dispatchEvent(new CustomEvent('profileLoaded'));
    });
}

export async function initCore() {
    return enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.warn("Firestore Persistence failed:", err.code))
        .finally(async () => { 
            await initializeCoreLogic(); 

            onAuthStateChanged(auth, async (user) => {
                const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
                let isAdmin = false;

                if (userProfileUnsubscribe) {
                    userProfileUnsubscribe();
                    userProfileUnsubscribe = null;
                }

                if (user) {
                    if (user.uid === adminUID) {
                        isAdmin = true;
                        state.currentUser = null; 
                        state.userProfile = {};
                        
                        const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';
                        sessionStorage.setItem('isAdmin', 'true');
                        if (!wasAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                            window.AdminLogic.initialize();
                        }
                    } 
                    else {
                        isAdmin = false;
                        state.currentUser = user; 
                        await loadUserProfile(user.uid);
                        
                        const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';
                        sessionStorage.removeItem('isAdmin');
                        if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                            window.AdminLogic.deinitialize();
                        }
                        if ('Notification' in window && Notification.permission === 'granted') {
                            requestNotificationPermissionCore();
                        }
                    }
                } 
                else {
                    isAdmin = false;
                    state.currentUser = null;
                    state.userProfile = {}; 
                    
                    const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';
                    sessionStorage.removeItem('isAdmin');
                    if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                        window.AdminLogic.deinitialize();
                    }
                }
                
                document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
                document.dispatchEvent(new CustomEvent('userChange', { detail: { user: state.currentUser } }));

                if (authReadyResolver) {
                    authReadyResolver(user); 
                    authReadyResolver = null; 
                }
            });

            onMessage(messaging, (payload) => {
                document.dispatchEvent(new CustomEvent('fcmMessage', { detail: payload }));
            });

             window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                state.deferredPrompt = e;
                document.dispatchEvent(new Event('installPromptReady')); 
            });

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                document.dispatchEvent(new CustomEvent('swUpdateReady', { detail: { registration } }));
                            }
                        });
                    });
                }).catch(err => console.error('SW registration failed: ', err));

                navigator.serviceWorker.addEventListener('controllerchange', () => {
                     window.location.reload();
                });
            }
        });
}

export {
    // state exported from definition above
    handleLogin, 
    handleUserLogin, handleUserSignUp, handleUserLogout, handlePasswordReset,
    fetchCategories, fetchSubcategories, fetchSubSubcategories, fetchProductById, fetchProducts, fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, 
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    requestNotificationPermissionCore,
    handleInstallPrompt, 
    forceUpdateCore, 

    db, 
    productsCollection,
    collection, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
    query, orderBy, onSnapshot, getDocs, where, limit, startAfter, runTransaction
};
