// app-core.js
// Logika bingehîn, danûstendina daneyan, û rêveberiya state

import {
    // === START: KODA NÛ / کۆدی نوێ ===
    // Fonksiyonên AUTH yên nû hatin zêdekirin
    // فەنکشنە نوێیەکانی AUTH زیادکران
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    usersCollection, chatsCollection, // <-- Koleksiyonên nû / کۆڵێکشنە نوێیەکان
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    RecaptchaVerifier, signInWithPhoneNumber // <-- Fonksiyonên nû / فەنکشنە نوێیەکان
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
} from './app-setup.js';

import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where,
    startAfter, addDoc, runTransaction, serverTimestamp, writeBatch
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
    // Note: Updating UI count is handled in app-ui.js
}

// === START: KODA GÛHERTÎ / کۆدی گۆڕاو ===
// Em êdî vê fonksiyonê bikar naynin, ji ber ku dê 'state.favorites' rasterast ji Firestore were
// ئێمە ئیتر ئەم فەنکشنە بەکارناهێنین، چونکە 'state.favorites' ڕاستەوخۆ لە فایەرستۆرەوە دێت
/*
export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}
*/
// === END: KODA GÛHERTÎ / کۆتایی کۆدی گۆڕاو ===


export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Authentication (Admin & User) ---

// Ji bo têketina Admin (بۆ چوونەژوورەوەی ئەدمین)
async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Admin logic initialization will happen via onAuthStateChanged
    } catch (error) {
        throw new Error(t('login_error')); // Throw error to be caught in UI layer
    }
}

// Ji bo derketina Admin (بۆ دەرچوونی ئەدمین)
async function handleLogout() {
    await signOut(auth);
    // UI updates handled by onAuthStateChanged listener
}

// === START: KODA NÛ JI BO AUTH / کۆدی نوێ بۆ پشتڕاستکردنەوە ===

// Fonksiyona derketina bikarhênerê (فانکشنى دەرچوونی بەکارهێنەر)
export async function handleUserLogoutCore() {
    try {
        await signOut(auth);
        // Guhdarê 'onAuthStateChanged' dê her tiştî paqij bike
        // گوێگری 'onAuthStateChanged' هەموو شتێک پاک دەکاتەوە
        return { success: true, message: t('user_logout_success') };
    } catch (error) {
        console.error("Error signing out user:", error);
        return { success: false, message: t('error_generic') };
    }
}

// 1. Sazkirina Recaptcha (دانانی Recaptcha)
export function setupRecaptchaCore(containerId) {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA çareser bû, em dikarin koda piştrastkirinê bişînin
                // reCAPTCHA چارەسەر بوو، دەتوانین کۆدی پشتڕاستکردنەوە بنێرین
                console.log("Recaptcha solved");
            },
            'expired-callback': () => {
                // Bersiv qediya... Ji bikarhêner bixwaze ku dîsa biceribîne
                // وەڵامدانەوە بەسەرچوو... داوا لە بەکارهێنەر بکە دووبارە هەوڵ بداتەوە
                console.warn("Recaptcha expired");
                showNotification("Recaptcha بەسەرچوو، تکایە دووبارە هەوڵبدەوە.", "error");
            }
        });
    }
}

// 2. Şandina koda piştrastkirinê (ناردنی کۆدی پشتڕاستکردنەوە)
export async function sendVerificationCodeCore(phoneNumber) {
    try {
        const appVerifier = window.recaptchaVerifier;
        state.confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        // SMS hate şandin (SMS نێردرا)
        return { success: true };
    } catch (error) {
        console.error("Error sending SMS:", error);
        // Reset recaptcha
        window.recaptchaVerifier.render().then(widgetId => {
            grecaptcha.reset(widgetId);
        });
        let message = t('error_generic');
        if (error.code === 'auth/invalid-phone-number') {
            message = 'ژمارەی مۆبایل نادروستە.';
        } else if (error.code === 'auth/too-many-requests') {
            message = 'تۆ زۆر هەوڵت داوە. تکایە دواتر هەوڵبدەوە.';
        }
        return { success: false, message: message };
    }
}

// 3. Piştrastkirina kodê (پشتڕاستکردنەوەی کۆد)
export async function verifyCodeCore(code) {
    if (!state.confirmationResult) {
        return { success: false, message: 'هیچ پرۆسەیەکی پشتڕاستکردنەوە دەستی پێنەکردووە.' };
    }
    try {
        const result = await state.confirmationResult.confirm(code);
        const user = result.user;
        // Têketin serketî bû! (چوونەژوورەوە سەرکەوتوو بوو!)
        // Guhdarê 'onAuthStateChanged' dê naha were destpêkirin
        // گوێگری 'onAuthStateChanged' ئێستا دەستپێدەکات
        state.confirmationResult = null; // Paqij bike (پاکی بکەوە)
        return { success: true, user: user };
    } catch (error) {
        console.error("Error verifying code:", error);
        let message = t('error_generic');
        if (error.code === 'auth/invalid-verification-code') {
            message = 'کۆدەکە نادروستە.';
        }
        return { success: false, message: message };
    }
}
// === END: KODA NÛ JI BO AUTH / کۆتایی کۆدی نوێ بۆ پشتڕاستکردنەوە ===


// --- Firestore Data Fetching & Manipulation ---

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
        const filteredProducts = allRelated
            .filter(product => product.id !== currentProduct.id) 
            .slice(0, 6); 

        return filteredProducts;
        
    } catch (error) {
        console.error("Error fetching related products (new method):", error);
        return [];
    }
}


// Fetches products based on current filters and pagination state
async function fetchProducts(searchTerm = '', isNewSearch = false) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        return { isHome: true, products: [], allLoaded: true };
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

async function fetchNewestProducts(limitCount = 10) {
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

async function fetchInitialProductsForHome(limitCount = 10) {
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
        console.warn("Product not found in local cache for cart. Fetching...");
        product = await fetchProductById(productId);
        if (!product) {
            console.error(`Failed to add product ${productId} to cart: Not found.`);
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
    
    // === START: KODA GÛHERTÎ / کۆدی گۆڕاو ===
    // Naha em profîlê ji stateya ku ji Firestore hatiye barkirin dixwînin
    // ئێستا پڕۆفایل لەو ستەیتەوە دەخوێنینەوە کە لە فایەرستۆرەوە هاتووە
    const profile = state.currentUser ? state.userProfile : JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    if (profile.name && profile.address && profile.phone) {
    // === END: KODA GÛHERTÎ / کۆتایی کۆدی گۆڕاو ===
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${profile.name}\n`;
        message += `${t('order_user_address')}: ${profile.address}\n`;
        message += `${t('order_user_phone')}: ${profile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

// === START: KODA NÛ / کۆدی نوێ ===
// Fonksiyonek nû ji bo çêkirina kurteya sebetê ji bo chatê
// فەنکشنێکی نوێ بۆ دروستکردنی پوختەی سەبەتە بۆ چات
export function generateCartSummaryMessageCore() {
    if (state.cart.length === 0) return "";

    let total = 0;
    let message = t('chat_cart_summary_message') + "\n\n";
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `* ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n*${t('order_total')}: ${total.toLocaleString()} د.ع.*`;
    
    return message;
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// --- Favorites Logic (Guhertî / گۆڕدراو) ---

export async function toggleFavoriteCore(productId) {
    const isCurrentlyFavorite = isFavorite(productId);
    
    if (state.currentUser) {
        // Bikarhêner têketî ye, Firestore bikar bîne
        // بەکارهێنەر لۆگین بووە، فایەرستۆر بەکاربهێنە
        const favRef = doc(db, `users/${state.currentUser.uid}/favorites`, productId);
        try {
            if (isCurrentlyFavorite) {
                await deleteDoc(favRef);
                state.favorites = state.favorites.filter(id => id !== productId); // Stateya herêmî nû bike
                return { favorited: false, message: t('product_removed_from_favorites') };
            } else {
                await setDoc(favRef, { createdAt: serverTimestamp() });
                state.favorites.push(productId); // Stateya herêmî nû bike
                return { favorited: true, message: t('product_added_to_favorites') };
            }
        } catch (error) {
            console.error("Error updating favorites in Firestore:", error);
            return { favorited: isCurrentlyFavorite, message: t('error_generic') };
        }
    } else {
        // Bikarhêner ne têketî ye, localStorage bikar bîne (wek berê)
        // بەکارهێنەر لۆگین نییە، لۆکاڵ ستۆرێج بەکاربهێنە (وەک پێشوو)
        if (isCurrentlyFavorite) {
            state.favorites = state.favorites.filter(id => id !== productId);
        } else {
            state.favorites.push(productId);
        }
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
        return { 
            favorited: !isCurrentlyFavorite, 
            message: !isCurrentlyFavorite ? t('product_added_to_favorites') : t('product_removed_from_favorites') 
        };
    }
}

// --- Profile Logic (Guhertî / گۆڕدراو) ---

export async function saveProfileCore(profileData) {
    const profile = {
        name: profileData.name || '',
        address: profileData.address || '',
        phone: profileData.phone || '',
    };
    
    if (state.currentUser) {
        // Bikarhêner têketî ye, Firestore nû bike
        // بەکارهێنەر لۆگین بووە، فایەرستۆر نوێ بکەوە
        const userDocRef = doc(db, "users", state.currentUser.uid);
        try {
            await setDoc(userDocRef, profile, { merge: true });
            state.userProfile = profile; // Stateya herêmî nû bike
            return { success: true, message: t('profile_saved') };
        } catch (error) {
            console.error("Error saving profile to Firestore:", error);
            return { success: false, message: t('error_generic') };
        }
    } else {
        // Bikarhêner ne têketî ye, localStorage bikar bîne
        // بەکارهێنەر لۆگین نییە، لۆکاڵ ستۆرێج بەکاربهێنە
        state.userProfile = profile;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        return { success: true, message: t('profile_saved') };
    }
}

// --- Language ---
export function setLanguageCore(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    state.productCache = {};
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) homeContainer.innerHTML = '';
}

// --- Notifications ---

async function requestNotificationPermissionCore() {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ'
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    return latestAnnouncementTimestamp > lastSeenTimestamp;
}

export function updateLastSeenAnnouncementTimestamp(timestamp) {
     // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
     localStorage.setItem('lastSeenAnnouncementTimestamp', timestamp);
}

// --- PWA & Service Worker ---

async function handleInstallPrompt(installBtn) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    if (state.deferredPrompt) {
        installBtn.style.display = 'none'; 
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null; 
    }
}

async function forceUpdateCore() {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    return { success: false, message: 'Update cancelled.' }; // User cancelled
}

// --- Navigation / History ---

export function saveCurrentScrollPositionCore() {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    const currentState = history.state;
    const activePage = document.getElementById(state.currentPageId); 

    if (activePage && state.currentPageId === 'mainPage' && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: activePage.scrollTop }, '');
    }
}

export function applyFilterStateCore(filterState) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
}

export function navigateToFilterCore(newState) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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

// --- === START: KODA NÛ JI BO CHAT / کۆدی نوێ بۆ چات === ---

/**
 * Peyamekê ji bikarhêner an admin dişîne.
 * نامەیەک لە بەکارهێنەر یان ئەدمینەوە دەنێرێت.
 * @param {string} text - Naveroka peyamê (ناوەڕۆکی نامەکە).
 * @param {string} chatRoomId - IDya bikarhênerê ku chat jê re tê şandin (ئایدی ئەو بەکارهێنەرەی چاتی بۆ دەچێت).
 * @param {string} senderId - 'admin' an UIDya bikarhêner (یان 'admin' یان UIDی بەکارهێنەر).
 */
export async function sendChatMessageCore(text, chatRoomId, senderId) {
    if (!text.trim() || !chatRoomId || !senderId) return;

    try {
        const chatDocRef = doc(db, "chats", chatRoomId);
        const messagesCollectionRef = collection(chatDocRef, "messages");

        // 1. Peyamê lê zêde bike (نامەکە زیاد بکە)
        await addDoc(messagesCollectionRef, {
            text: text,
            senderId: senderId,
            timestamp: serverTimestamp()
        });

        // 2. Peyama dawî li ser belgeya chatê ya sereke nû bike (دوا نامە لەسەر دۆکیومێنتی چاتە سەرەکییەکە نوێ بکەوە)
        const updateData = {
            lastMessage: text,
            lastTimestamp: serverTimestamp()
        };

        if (senderId === 'admin') {
            updateData.seenByUser = false; // Bikarhêner ev nedîtiye (بەکارهێنەر ئەمەی نەبینیوە)
            updateData.seenByAdmin = true; // Admin ev şandiye (ئەدمین ئەمەی ناردووە)
        } else {
            updateData.seenByAdmin = false; // Admin ev nedîtiye (ئەدمین ئەمەی نەبینیوە)
            updateData.seenByUser = true; // Bikarhêner ev şandiye (بەکارهێنەر ئەمەی ناردووە)
            // Di heman demê de piştrast bike ku agahdariyên bikarhêner nû ne
            // هەروەها دڵنیابە کە زانیارییەکانی بەکارهێنەر نوێن
            updateData.userName = state.userProfile.name || state.currentUser.phoneNumber;
            updateData.userPhone = state.currentUser.phoneNumber;
        }

        await setDoc(chatDocRef, updateData, { merge: true });

    } catch (error) {
        console.error("Error sending chat message:", error);
        // Ji UI re bêje ku têkçûnek çêbû (بە UI بڵێ کە شکستێک ڕوویدا)
        throw new Error("Failed to send message."); 
    }
}

/**
 * Guh dide peyamên nû ji bo jûreyek chatê ya taybetî.
 * گوێ لە نامە نوێیەکان دەگرێت بۆ ژوورێکی چاتی دیاریکراو.
 * @param {string} chatRoomId - UIDya bikarhêner (UIDی بەکارهێنەر).
 * @param {function} callback - Fonksiyona ku dema peyamên nû werin dê were bang kirin (فەنکشنێک کە کاتێک نامەی نوێ دێت بانگ دەکرێت).
 * @returns {function} - Fonksiyona Unsubscribe (فەنکشنى Unsubscribe).
 */
export function listenForChatMessages(chatRoomId, callback) {
    const messagesRef = collection(db, "chats", chatRoomId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    }, (error) => {
        console.error("Error listening to chat messages:", error);
        callback([], error); // Bi peyamek vala û çewtî vegere (بە نامەیەکی بەتاڵ و هەڵەوە بگەڕێوە)
    });

    return unsubscribe;
}

/**
 * Guh dide navnîşa giştî ya chatan ji bo panela admin.
 * گوێ لە لیستی گشتی چاتەکان دەگرێت بۆ پانێڵی ئەدمین.
 * @param {function} callback - Fonksiyona ku dema navnîş tê nûve kirin dê were bang kirin (فەنکشنێک کە کاتێک لیستەکە نوێ دەبێتەوە بانگ دەکرێت).
 * @returns {function} - Fonksiyona Unsubscribe (فەنکشنى Unsubscribe).
 */
export function listenForAdminChatList(callback) {
    const q = query(chatsCollection, orderBy("lastTimestamp", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(chatList);
    }, (error) => {
        console.error("Error listening to admin chat list:", error);
        callback([], error);
    });

    return unsubscribe;
}

/**
 * Chatekê wekî "xwendî" nîşan dide.
 * چاتێک وەک "خوێندراوە" نیشان دەدات.
 * @param {string} chatRoomId - UIDya bikarhêner (UIDی بەکارهێنەر).
 * @param {string} userType - 'admin' an 'user'
 */
export async function markChatAsReadCore(chatRoomId, userType) {
    if (!chatRoomId || !userType) return;
    
    const chatDocRef = doc(db, "chats", chatRoomId);
    try {
        if (userType === 'admin') {
            await updateDoc(chatDocRef, { seenByAdmin: true });
        } else {
            await updateDoc(chatDocRef, { seenByUser: true });
        }
    } catch (error) {
        console.error("Error marking chat as read:", error);
    }
}


// --- === END: KODA NÛ JI BO CHAT / کۆتایی کۆدی نوێ بۆ چات === ---


// --- Initialization ---

async function initializeCoreLogic() {
    if (!state.sliderIntervals) state.sliderIntervals = {};
    await fetchCategories();
}

// === START: KODA GÛHERTÎ (Mîgrasyona Daneyan) / کۆدی گۆڕاو (گواستنەوەی داتا) ===
/**
 * Daneyên herêmî yên bikarhêner (profîl û hezkirî) vediguhezîne Firestore.
 * زانیارییە لۆکاڵییەکانی بەکارهێنەر (پڕۆفایل و دڵخوازەکان) دەگوازێتەوە بۆ فایەرستۆر.
 * @param {string} userId - UIDya bikarhênerê ya nû (UIDی نوێی بەکارهێنەر).
 */
async function migrateUserDataToFirestore(userId) {
    console.log(`Starting data migration for user ${userId}...`);
    const batch = writeBatch(db);

    // 1. Veguhastina Profîlê (گواستنەوەی پڕۆفایل)
    const localProfile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    if (localProfile.name || localProfile.address || localProfile.phone) {
        const userDocRef = doc(db, "users", userId);
        batch.set(userDocRef, localProfile, { merge: true });
        console.log("Profile data added to batch.");
    }

    // 2. Veguhastina Hezkiriyan (گواستنەوەی دڵخوازەکان)
    const localFavorites = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    if (localFavorites.length > 0) {
        localFavorites.forEach(productId => {
            const favDocRef = doc(db, `users/${userId}/favorites`, productId);
            batch.set(favDocRef, { createdAt: serverTimestamp() });
        });
        console.log(`${localFavorites.length} favorites added to batch.`);
    }

    // Batchê bişîne (Batchـەکە بنێرە)
    try {
        await batch.commit();
        console.log("Data migration successful.");

        // Daneyên herêmî yên kevn paqij bike (داتای لۆکاڵی کۆن پاک بکەوە)
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(FAVORITES_KEY);
        
        // Stateya herêmî nû bike (ستەیتی ناوخۆیی نوێ بکەوە)
        state.userProfile = localProfile;
        state.favorites = localFavorites;
    } catch (error) {
        console.error("Error during data migration:", error);
    }
}

/**
 * Profîl û hezkiriyên bikarhênerê ji Firestore bar dike.
 * پڕۆفایل و دڵخوازەکانی بەکارهێنەر لە فایەرستۆرەوە بار دەکات.
 * @param {string} userId - UIDya bikarhênerê (UIDی بەکارهێنەر).
 */
async function loadUserFromFirestore(userId) {
    console.log(`Loading data from Firestore for user ${userId}...`);
    try {
        // 1. Barkirina Profîlê (بارکردنی پڕۆفایل)
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            state.userProfile = userDocSnap.data();
            console.log("User profile loaded.");
        } else {
            console.log("No profile found in Firestore, using local (empty).");
            state.userProfile = {};
        }

        // 2. Barkirina Hezkiriyan (بارکردنی دڵخوازەکان)
        const favoritesRef = collection(db, `users/${userId}/favorites`);
        const favoritesSnap = await getDocs(favoritesRef);
        state.favorites = favoritesSnap.docs.map(doc => doc.id);
        console.log(`Loaded ${state.favorites.length} favorites.`);

    } catch (error) {
        console.error("Error loading user data from Firestore:", error);
    }
}
// === END: KODA GÛHERTÎ (Mîgrasyona Daneyan) / کۆتایی کۆدی گۆڕاو (گواستنەوەی داتا) ===


export async function initCore() {
    return enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.warn("Firestore Persistence failed:", err.code))
        .finally(async () => {
            await initializeCoreLogic(); // Kategoriyan bar bike (جۆرەکان بار بکە)

            // === START: KODA GÛHERTÎ (onAuthStateChanged) / کۆدی گۆڕاو ===
            // Vê guhdarê hanê naha hem admin û hem jî bikarhêneran birêve dibe
            // ئەم گوێگرە ئێستا هەم ئەدمین و هەم بەکارهێنەران بەڕێوە دەبات
            onAuthStateChanged(auth, async (user) => {
                const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // UIDya xwe ya Admin li vir bi cî bike (UIDی ئەدمینی خۆت لێرە دابنێ)
                const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';
                
                // Sifirkirina stateya berê (سفرکردنەوەی ستەیتی پێشوو)
                sessionStorage.removeItem('isAdmin');
                state.currentUser = null;
                state.userProfile = {}; // Profîlê vala bike (پڕۆفایل بەتاڵ بکەوە)
                state.favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; // Vegere localStorage (بگەڕێوە سەر لۆکاڵ ستۆرێج)

                if (user) {
                    if (user.uid === adminUID) {
                        // Bikarhêner Admin e (بەکارهێنەر ئەدمینە)
                        console.log("Admin logged in.");
                        sessionStorage.setItem('isAdmin', 'true');
                        state.currentUser = user; // Her çend admin be jî, em dikarin wê tomar bikin (هەرچەندە ئەدمینە، دەتوانین تۆماری بکەین)
                        if (!wasAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                            window.AdminLogic.initialize();
                        }
                    } else {
                        // Bikarhênerek normal e (بەکارهێنەرێکی ئاساییە)
                        console.log("User logged in:", user.uid);
                        state.currentUser = user;
                        
                        // Kontrol bike ka pêdivî bi veguhastina daneyan heye
                        // پشکنین بکە بزانە پێویستی بە گواستنەوەی داتا هەیە
                        const localProfileExists = !!localStorage.getItem(PROFILE_KEY);
                        const localFavoritesExist = !!localStorage.getItem(FAVORITES_KEY);
                        
                        if (localProfileExists || localFavoritesExist) {
                            // Daneyên herêmî hene, wan veguhezîne (داتای لۆکاڵ هەیە، بیانگوازەوە)
                            await migrateUserDataToFirestore(user.uid);
                        } else {
                            // Daneyên herêmî nînin, tenê ji Firestore bar bike (داتای لۆکاڵ نییە، تەنها لە فایەرستۆر بار بکە)
                            await loadUserFromFirestore(user.uid);
                        }
                    }
                } else {
                    // Kes têketî nîne (کەس لۆگین نییە)
                    console.log("User logged out or session expired.");
                    if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                        window.AdminLogic.deinitialize();
                    }
                }
                
                // UIyê agahdar bike ku rewşa têketinê guherî
                // UI ئاگادار بکەوە کە دۆخی لۆگین گۆڕا
                document.dispatchEvent(new CustomEvent('authChange', { 
                    detail: { 
                        isAdmin: sessionStorage.getItem('isAdmin') === 'true',
                        isUser: !!state.currentUser && sessionStorage.getItem('isAdmin') !== 'true'
                    } 
                }));
            });
            // === END: KODA GÛHERTÎ (onAuthStateChanged) / کۆتایی کۆدی گۆڕاو ===

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


// Expose necessary core functions and state for UI and Admin layers
export {
    state, 
    handleLogin, handleLogout, 
    fetchCategories, fetchSubcategories, fetchSubSubcategories, fetchProductById, fetchProducts, fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, 
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    requestNotificationPermissionCore,
    handleInstallPrompt, forceUpdateCore, 
    db,
    productsCollection,
    collection, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
    query, orderBy, onSnapshot, getDocs, where, limit, startAfter, runTransaction,
    // === START: KODA NÛ / کۆدی نوێ ===
    serverTimestamp, // Ji bo peyamên chatê (بۆ نامەکانی چات)
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
};
