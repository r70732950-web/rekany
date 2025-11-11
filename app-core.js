// app-core.js (چاککراو بۆ سیستەمی بەکارهێنەر)
import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    categoryLayoutsCollection, 
    // [ 💡 گۆڕانکاری لێرە کرا 💡 ]
    usersCollection, // کۆڵێکشنی نوێی بەکارهێنەران
    createUserWithEmailAndPassword, updateProfile, // فانکشنی نوێی Auth
    sendPasswordResetEmail, // <--- فانکشنی نوێ بۆ بیرچوونەوە
    translations, state,
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

export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// فانکشنی چوونەژوورەوەی ئەدمین (وەک خۆی دەمێنێتەوە)
async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        throw new Error(t('login_error')); 
    }
}

export async function handleUserLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error) {
        console.error("User login error:", error.code);
        return { success: false, message: t('user_login_error') };
    }
}

export async function handleUserSignUp(name, email, password) {
    try {
        // 1. دروستکردنی بەکارهێنەر لە Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. نوێکردنەوەی پڕۆفایلی Auth (بۆ دانانی ناو)
        await updateProfile(user, { displayName: name });

        // 3. دروستکردنی دۆکیومێنتی پڕۆفایل لە Firestore
        const userProfileRef = doc(usersCollection, user.uid);
        await setDoc(userProfileRef, {
            email: user.email,
            displayName: name,
            createdAt: Date.now(),
            name: "",      // بۆ زانیاری گەیاندن (سەرەتا بەتاڵە)
            address: "",  // بۆ زانیاری گەیاندن (سەرەتا بەتاڵە)
            phone: ""     // بۆ زانیاری گەیاندن (سەرەتا بەتاڵە)
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

export async function handleUserLogout() {
    try {
        await signOut(auth);
        return { success: true, message: t('user_logout_success') };
    } catch (error) {
        console.error("User logout error:", error);
        return { success: false, message: t('error_generic') };
    }
}

// === [نوێ] فانکشنی بیرچوونەوەی وشەی نهێنی ===
export async function handlePasswordReset(email) {
    if (!email || email.trim() === '') {
        return { success: false, message: "تکایە ئیمەیڵەکەت بنووسە." };
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: t('password_reset_sent') };
    } catch (error) {
        console.error("Password reset error:", error.code);
        if (error.code === 'auth/user-not-found') {
            return { success: false, message: t('user_not_found') };
        }
        return { success: false, message: t('error_generic') };
    }
}
// ==========================================


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
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            const currentToken = await getToken(messaging, {
                serviceWorkerRegistration: await navigator.serviceWorker.ready 
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
            createdAt: Date.now(),
            language: state.currentLanguage 
        });
        console.log(`Token saved to Firestore with language: ${state.currentLanguage}`);
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

async function handleInstallPrompt(installBtn) {
    if (state.deferredPrompt) {
        installBtn.style.display = 'none'; 
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null; 
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
    return { success: false, message: 'Update cancelled.' }; 
}

export function saveCurrentScrollPositionCore() {
    const currentState = history.state;
    const activePage = document.getElementById(state.currentPageId); 

    if (activePage && state.currentPageId === 'mainPage' && currentState && !currentState.type) {
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
}

async function updateTokenLanguageInFirestore(newLang) {
    if ('Notification' in window && Notification.permission === 'granted') {
        console.log(`Language changed to ${newLang}, updating token in Firestore...`);
        try {
            const currentToken = await getToken(messaging, {
                serviceWorkerRegistration: await navigator.serviceWorker.ready
            });
            
            if (currentToken) {
                const tokensCollection = collection(db, 'device_tokens');
                await setDoc(doc(tokensCollection, currentToken), {
                    language: newLang 
                }, { merge: true }); 
                console.log(`Token ${currentToken} language updated to ${newLang}.`);
            }
        } catch (error) {
            console.error('Error updating token language:', error);
        }
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
            console.log("پڕۆفایلی بەکارهێنەر بارکرا:", state.userProfile);
        } else {
            console.warn(`دۆکیومێنتی پڕۆفایل نەدۆزرایەوە بۆ: ${uid}. دروستکردنی یەکێکی نوێ...`);
            setDoc(userProfileRef, {
                email: state.currentUser.email,
                displayName: state.currentUser.displayName,
                createdAt: Date.now(),
                name: "", address: "", phone: ""
            }).catch(e => console.error("هەڵە لە دروستکردنی پڕۆفایلی ونبوو:", e));
            state.userProfile = { name: "", address: "", phone: "" };
        }
        document.dispatchEvent(new CustomEvent('profileLoaded'));
    }, (error) => {
        console.error("هەڵە لە گوێگرتن لە پڕۆفایلی بەکارهێنەر:", error);
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
                navigator.serviceWorker.register('/sw.js', { type: 'module' }).then(registration => {
                    console.log('SW registered (as module).'); 
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


export {
    state, 
    handleLogin, 
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
