// app-core.js
// Logika bingehîn, danûstendina daneyan, û rêveberiya state

import {
    // *** گۆڕانکاری لێرە: db و کۆڵێکشنە نوێیەکە لێرە هاوردەکراوە ***
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    categoryLayoutsCollection, // <-- KODA NÛ / کۆدی نوێ
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
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
    // Note: Updating UI count is handled in app-ui.js
}

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Authentication ---

async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Admin logic initialization will happen via onAuthStateChanged
    } catch (error) {
        throw new Error(t('login_error')); // Throw error to be caught in UI layer
    }
}

async function handleLogout() {
    await signOut(auth);
    // UI updates handled by onAuthStateChanged listener
}

// --- Firestore Data Fetching & Manipulation ---

async function fetchCategories() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(categoriesQuery);
    const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Em êdî bi awayekî otomatîkî 'all' zêde nakin. Ew ê bi awayekî logîkî di UIyê de were birêvebirin.
    // ئێمە ئیتر بە شێوەیەکی ئۆتۆماتیکی 'all' زیاد ناکەین. ئەمە بە شێوەی لۆجیکی لەناو UI چارەسەر دەکرێت.
    state.categories = fetchedCategories;
}

async function fetchSubcategories(categoryId) {
    if (categoryId === 'all') return []; // Ev rast e, ji bo "Home" divê em ti jêr-kategorî nîşan nedin (ئەمە دروستە، بۆ "سەرەکی" پێویست ناکات هیچ جۆرێکی لاوەکی نیشان بدەین)
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

// *** ÇAKKIRÎ LI GOR ŞÎROVEYA TE (Corrected According to Your Explanation) ***
async function fetchRelatedProducts(currentProduct) {
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) return [];

    const baseQuery = collection(db, "products");
    let conditions = [];
    let orderByClauses = []; 

    // Pêşî mercên kategoriyê saz bikin (Set category conditions first)
    // یەکەم جار مەرجەکانی بەشەکان دادەنێین
    if (currentProduct.subSubcategoryId) {
        conditions.push(where('subSubcategoryId', '==', currentProduct.subSubcategoryId));
    } else if (currentProduct.subcategoryId) {
        conditions.push(where('subcategoryId', '==', currentProduct.subcategoryId));
    } else { // Tenê categoryId heye
        conditions.push(where('categoryId', '==', currentProduct.categoryId));
    }

    // Em êdî hewcedariya me bi '__name__' nîne
    // ئیتر پێویستمان بە فلتەرکردن بە '__name__' نییە
    orderByClauses.push(orderBy('createdAt', 'desc'));

    // Wek ku te got, em ê 7-an bixwazin (As you said, we will request 7)
    // وەک خۆت وتت، داوای 7 دانە دەکەین
    const q = query(baseQuery, ...conditions, ...orderByClauses, limit(7));

    try {
        const snapshot = await getDocs(q);
        const allRelated = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Naha, em ê kaڵaya heyî bi JavaSript fîlter bikin û 6 hilbijêrin
        // ئێستا، کاڵای ئێستا بە جاڤاسکریپت فلتەر دەکەین و 6 دانە هەڵدەبژێرین
        const filteredProducts = allRelated
            .filter(product => product.id !== currentProduct.id) // Kaڵaya heyî derxe (Remove the current product)
            .slice(0, 6); // Tenê 6-an bigire (Take only 6)

        return filteredProducts;
        
    } catch (error) {
        console.error("Error fetching related products (new method):", error);
        return [];
    }
}
// *** DAWÎYA ÇAKKIRINÊ / END CORRECTION ***


// === START: KODA NÛ / کۆدی نوێ ===
/**
 * Ev fonksîyon dîzayna taybet a kategoriyekê ji Firestore tîne.
 * ئەم فەنکشنە دیزاینی تایبەتی جۆرێک لە فایەرستۆر دەهێنێت.
 * @param {string} categoryId IDya kategoriyê (IDی جۆرەکە)
 * @returns {object|null} Daneyên dîzaynê (enabled, sections) an null
 */
export async function fetchCategoryLayout(categoryId) { // <-- EXPORT LI VIR / هەناردە لێرە
    if (!categoryId) return null;
    try {
        // Dîzayn wekî belgeyek bi IDya kategoriyê tê tomarkirin
        // دیزاینەکە وەک دۆکیومێنتێک بە IDی جۆرەکە پاشەکەوت دەکرێت
        const layoutDocRef = doc(db, "category_layouts", categoryId);
        const docSnap = await getDoc(layoutDocRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Piştrast bike ku dîzayn çalak e û beşên wê hene
            // دڵنیابە کە دیزاینەکە چالاکە و بەشی هەیە
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
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// Fetches products based on current filters and pagination state
// === START: KODA GUHERTÎ / کۆدی گۆڕاو ===
async function fetchProducts(searchTerm = '', isNewSearch = false) {
    
    // 1. Pêşî, em rewşa "Perrê Sereke" (Home Page) kontrol dikin
    // 1. یەکەمجار، پشکنینی دۆخی "پەڕەی سەرەکی" دەکەین
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (shouldShowHomeSections) {
        // Ji UI re bêje bila dîzayna *malê* (home_layout) nîşan bide
        // بە UI بڵێ با دیزاینی *ماڵەوە* (home_layout) پیشان بدات
        return { isHome: true, layout: null, products: [], allLoaded: true };
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
            return { isHome: true, layout: categoryLayoutData.sections, products: [], allLoaded: true };
        }
        // Heke `categoryLayoutData` null be (dîzayn tune an ne çalak e),
        // em naçin `else`, em tenê didomînin da ku kaڵayên normal ên kategoriyê bînin.
        // ئەگەر `categoryLayoutData` نول بوو (دیزاین نییە یان چالاک نەکراوە)،
        // ئێمە ناچینە `else`، بەڵکو بەردەوام دەبین بۆ هێنانی کاڵا ئاساییەکانی جۆرەکە.
    }
    
    // 3. Heke ne "Home" û ne "Dîzayna Kategoriyê" be, kaڵayên normal bîne (Grid)
    // 3. ئەگەر "ماڵەوە" نەبوو یان "دیزاینی جۆر" نەبوو، کاڵا ئاساییەکان بهێنە (Grid)
    
    // ... (Logica cache û barkirina bêdawî wekî berê dimîne) ...
    // ... (لۆجیکی کاش و سکڕۆڵی بێکۆتا وەک خۆی دەمێنێتەوە) ...
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        // Return cached data for new search
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        return { isHome: false, products: state.products, allLoaded: state.allProductsLoaded };
    }

    if (state.isLoadingMoreProducts) return null; // Prevent concurrent loading

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
    }

    if (state.allProductsLoaded && !isNewSearch) return null; // Already loaded all

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
            // If searching, first orderBy must match inequality field
            orderByClauses.push(orderBy("searchableName", "asc"));
        }
        // Always add createdAt sort for consistent pagination
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
            // Cache the result of the new search
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        } else {
            state.products = [...state.products, ...newProducts];
            // Update cache for subsequent loads? Maybe not necessary if infinite scroll works reliably.
        }
        
        // Nîşana `isHome: false` nîşan dide ku divê grid-a kaڵayan were nîşandan
        // نیشانەی `isHome: false` واتە پێویستە گریدی کاڵاکان پیشان بدرێت
        return { isHome: false, products: newProducts, allLoaded: state.allProductsLoaded };

    } catch (error) {
        console.error("Error fetching products:", error);
        return { isHome: false, products: [], allLoaded: true, error: true }; // Indicate error
    } finally {
        state.isLoadingMoreProducts = false;
    }
}
// === END: KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===

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
            name: product.name, // Keep the multilingual object
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
            state.cart.splice(cartItemIndex, 1); // Remove item if quantity is zero or less
        }
        saveCart();
        return true; // Indicate success
    }
    return false; // Item not found
}

export function removeFromCartCore(productId) {
    const initialLength = state.cart.length;
    state.cart = state.cart.filter(item => item.id !== productId);
    if (state.cart.length < initialLength) {
        saveCart();
        return true; // Indicate success
    }
    return false; // Item not found
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
export function setLanguageCore(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    // Clear cache as language affects rendered content
    state.productCache = {};
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) homeContainer.innerHTML = '';
}

// --- Notifications ---

async function requestNotificationPermissionCore() {
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
        // Use the token itself as the document ID to prevent duplicates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now()
            // You might want to add more info here later, like userID if users log in
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

// Check for new announcements compared to last seen timestamp
export function checkNewAnnouncementsCore(latestAnnouncementTimestamp) {
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    return latestAnnouncementTimestamp > lastSeenTimestamp;
}

export function updateLastSeenAnnouncementTimestamp(timestamp) {
     localStorage.setItem('lastSeenAnnouncementTimestamp', timestamp);
}

// --- PWA & Service Worker ---

async function handleInstallPrompt(installBtn) {
    if (state.deferredPrompt) {
        installBtn.style.display = 'none'; // Hide button after prompting
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null; // Clear the saved prompt
    }
}

async function forceUpdateCore() {
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

// *** START: Gۆڕانکاری لێرە کرا ***
// *** دەستپێک: گۆڕانکاری لێرە کرا ***
export function saveCurrentScrollPositionCore() {
    const currentState = history.state;
    // Em êdî ne window.scrollY, lê scrollTop a rûpela çalak tomar dikin
    // ئێمە ئیتر window.scrollY پاشەکەوت ناکەین، بەڵکو scrollTopـی پەڕە چالاکەکە پاشەکەوت دەکەین
    const activePage = document.getElementById(state.currentPageId); 

    // Only save scroll position for the main page filter state
    // Tenê ji bo rûpela serekî (mainPage) û dema ku ew filterek e (ne popup) tomar bike
    // تەنها بۆ لاپەڕەی سەرەکی و کاتێک فلتەرە (نەک پۆپئەپ) پاشەکەوتی بکە
    if (activePage && state.currentPageId === 'mainPage' && currentState && !currentState.type) {
        // scrollTop a elementa rûpelê tomar bike (scrollTopـی توخمی لاپەڕەکە پاشەکەوت بکە)
        history.replaceState({ ...currentState, scroll: activePage.scrollTop }, '');
    }
}
// *** END: Gۆڕانکاری لێرە کرا ***
// *** کۆتایی: گۆڕانکاری لێرە کرا ***

// Applies filter state (category, search, etc.) but doesn't handle UI rendering directly
export function applyFilterStateCore(filterState) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
    // Note: Fetching products based on this state is handled separately
}

export function navigateToFilterCore(newState) {
    // Save current scroll before changing state
    // *** Gۆڕانکاری: Em ê fonksiyona xwe ya nû ya saveCurrentScrollPositionCore bikar bînin ***
    // *** گۆڕانکاری: ئێمە فانکشنە نوێیەکەمان saveCurrentScrollPositionCore بەکاردەهێنین ***
    saveCurrentScrollPositionCore(); 
    // Berê (Previous): history.replaceState({ ... history.state, scroll: window.scrollY }, '');

    // Combine current state with new changes, reset scroll for new view
    // Em êdî 'scroll: 0' li vir dananîn, ji ber ku dibe ku em nexwazin tavilê skrol bikin
    // ئێمە ئیتر 'scroll: 0' لێرە دانانێین، چونکە لەوانەیە نەمانەوێت دەستبەجێ سکڕۆڵ بکەین
    const finalState = { ...history.state, ...newState }; 
    // Berê (Previous): const finalState = { ...history.state, ...newState, scroll: 0 };


    // Update URL query parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Push the new state and URL to history
    history.pushState(finalState, '', newUrl);

    // Apply the new state logically (fetching data is separate)
    applyFilterStateCore(finalState);
}


// --- Initialization ---

// *** This function is now async ***
async function initializeCoreLogic() {
    if (!state.sliderIntervals) state.sliderIntervals = {};
    // *** We await fetchCategories here ***
    await fetchCategories();
    // Fetch initial contact methods, social links, etc. if needed globally
}

// Call this once on app load
// *** This function is now async and returns a Promise ***
export async function initCore() {
    // Return the promise chain
    return enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.warn("Firestore Persistence failed:", err.code))
        .finally(async () => { // Make the finally block async
            // *** Await the core logic setup ***
            await initializeCoreLogic(); // Await the core logic setup

            // Setup listeners *after* core logic (like categories) is ready
            onAuthStateChanged(auth, async (user) => {
                const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
                const isAdmin = user && user.uid === adminUID;
                const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';

                if (isAdmin) {
                    sessionStorage.setItem('isAdmin', 'true');
                    if (!wasAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                         window.AdminLogic.initialize();
                    }
                } else {
                    sessionStorage.removeItem('isAdmin');
                     if (user) { await signOut(auth); } // Sign out non-admins
                    if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                         window.AdminLogic.deinitialize();
                    }
                }
                // Notify UI layer about auth change
                document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
            });

             // Listen for foreground FCM messages
            onMessage(messaging, (payload) => {
                console.log('Foreground message received: ', payload);
                // Notify UI layer to display the message
                document.dispatchEvent(new CustomEvent('fcmMessage', { detail: payload }));
            });

             // PWA install prompt setup (can run earlier, but keeping it grouped)
             window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                state.deferredPrompt = e;
                console.log('`beforeinstallprompt` event fired.');
                document.dispatchEvent(new Event('installPromptReady')); // Notify UI
            });

            // Service Worker setup (can run earlier)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered.');
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New SW found!', newWorker);
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New SW waiting to activate. Notify UI.
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
// *** گۆڕانکاری لێرە: لابردنی 'fetchCategoryLayout'ـی دووبارە ***
export {
    state, // Export the mutable state object
    handleLogin, handleLogout, // Authentication
    fetchCategories, fetchSubcategories, fetchSubSubcategories, fetchProductById, fetchProducts, fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, // Data fetching
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    // fetchCategoryLayout, // <-- === EV HATE RAKIRIN / ئەمە سڕایەوە ===
    // setLanguageCore exported where it's defined
    requestNotificationPermissionCore,
    // checkNewAnnouncementsCore exported where it's defined
    // updateLastSeenAnnouncementTimestamp exported where it's defined
    handleInstallPrompt, forceUpdateCore, // PWA & SW
    // History functions are exported above
    // Core cart/favorites/profile functions are exported above

    // *** Export Firestore functions needed by app-ui.js and admin.js ***
    db, // <-- db لێرە زیادکرا
    productsCollection,
    collection, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
    query, orderBy, onSnapshot, getDocs, where, limit, startAfter, runTransaction
};
