// app-core.js
// Logika bingehîn, danûstendina daneyan, û rêveberiya state (Guhertoya Supabase)

import {
    // Supabase client ji app-setup
    db, auth,
    
    // Navên xişteyan (Table names)
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    subcategoriesCollection, subSubcategoriesCollection, promoCardsCollection,
    brandsCollection, shortcutCardsCollection, homeLayoutCollection,
    policiesCollection, socialLinksCollection, contactMethodsCollection,

    // Mîhengên din
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
} from './app-setup.js';

// --- Exported Helper Functions ---
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
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
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Authentication (Supabase) ---

async function handleLogin(email, password) {
    try {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Logic dê bi rêya onAuthStateChanged bidome
    } catch (error) {
        throw new Error(t('login_error'));
    }
}

async function handleLogout() {
    await auth.signOut();
    // UI dê bi rêya onAuthStateChanged were nûve kirin
}

// --- Supabase Data Fetching & Manipulation ---

async function fetchCategories() {
    const { data, error } = await db
        .from(categoriesCollection)
        .select('*')
        .order('order', { ascending: true });

    if (error) {
        console.error("Error fetching categories:", error);
        state.categories = [];
        return;
    }
    state.categories = data;
}

async function fetchSubcategories(categoryId) {
    if (categoryId === 'all') return [];
    
    const { data, error } = await db
        .from(subcategoriesCollection)
        .select('*')
        .eq('category_id', categoryId) // Li gorî schema nû ya Supabase
        .order('order', { ascending: true });

    if (error) {
        console.error("Error fetching subcategories:", error);
        return [];
    }
    return data;
}

async function fetchSubSubcategories(mainCatId, subCatId) {
    if (!mainCatId || !subCatId) return [];

    const { data, error } = await db
        .from(subSubcategoriesCollection)
        .select('*')
        .eq('subcategory_id', subCatId) // Li gorî schema nû ya Supabase
        .order('order', { ascending: true });

    if (error) {
        console.error("Error fetching sub-subcategories:", error);
        return [];
    }
    return data;
}

async function fetchProductById(productId) {
    // Yekem, hewl bide ku ji kaşa (cache) stateyê bistînî
    let product = state.products.find(p => p.id === productId);
    if (product) return product;

    // Duyem, hewl bide ku ji kaşa (cache) giştî bistînî
    if (state.productCache[productId]) {
        return state.productCache[productId];
    }
    
    // Heke ney, ji databaseê bistîne
    try {
        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .eq('id', productId)
            .single(); // Tenê yek rêzê vegerîne

        if (error) throw error;
        
        if (data) {
            state.productCache[data.id] = data; // Kaşê (cache) tomar bike
            return data;
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

    let queryField, queryValue;

    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = currentProduct.subcategoryId;
    } else {
        queryField = 'categoryId';
        queryValue = currentProduct.categoryId;
    }

    try {
        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .eq(queryField, queryValue)
            .not('id', 'eq', currentProduct.id) // Kaڵaya heyî derxe
            .order('created_at', { ascending: false })
            .limit(6); // 6 hebên din bîne

        if (error) throw error;
        return data || [];
        
    } catch (error) {
        console.error("Error fetching related products (Supabase):", error);
        return [];
    }
}


// Fetches products based on current filters and pagination state
async function fetchProducts(searchTerm = '', isNewSearch = false) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        return { isHome: true, products: [], allLoaded: true };
    }

    // Supabase pagination
    if (isNewSearch) {
        state.currentPage = 0;
        state.allProductsLoaded = false;
        state.products = [];
    }

    if (state.isLoadingMoreProducts) return null;
    if (state.allProductsLoaded && !isNewSearch) return null;

    state.isLoadingMoreProducts = true;

    try {
        let query = db.from(productsCollection).select('*');

        // Fîlterên Kategoriyê
        if (state.currentCategory && state.currentCategory !== 'all') {
            query = query.eq('categoryId', state.currentCategory);
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            query = query.eq('subcategoryId', state.currentSubcategory);
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            query = query.eq('subSubcategoryId', state.currentSubSubcategory);
        }

        // Fîltera Lêgerînê (Search)
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            // Em RLS (Row Level Security) û stûnek 'searchableName' bikar tînin
            // An jî fonksiyonek PostgreSQL text-search (fts)
            // Li vir, em texmîn dikin ku 'searchableName' heye
            query = query.ilike('searchableName', `%${finalSearchTerm}%`);
        }

        // Rêzkirin (Ordering)
        query = query.order('created_at', { ascending: false });
        
        // Rûpelkirin (Pagination)
        const from = state.currentPage * PRODUCTS_PER_PAGE;
        const to = from + PRODUCTS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data: newProducts, error } = await query;

        if (error) throw error;

        state.allProductsLoaded = newProducts.length < PRODUCTS_PER_PAGE;
        state.currentPage += 1; // Rûpela din amade bike

        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        return { isHome: false, products: newProducts, allLoaded: state.allProductsLoaded };

    } catch (error) {
        console.error("Error fetching products:", error.message);
        return { isHome: false, products: [], allLoaded: true, error: true };
    } finally {
        state.isLoadingMoreProducts = false;
    }
}

async function fetchPolicies() {
    try {
        const { data, error } = await db
            .from(policiesCollection)
            .select('content')
            .single(); // Texmîn dikin ku tenê yek rêzek heye

        if (error) throw error;
        return data ? data.content : null;
    } catch (error) {
        console.error("Error fetching policies:", error);
        return null;
    }
}

async function fetchAnnouncements() {
    try {
        const { data, error } = await db
            .from(announcementsCollection)
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching announcements:", error);
        return [];
    }
}

async function fetchContactMethods() {
    try {
        const { data, error } = await db
            .from(contactMethodsCollection)
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching contact methods:", error);
        return [];
    }
}

async function fetchHomeLayout() {
    try {
        const { data, error } = await db
            .from(homeLayoutCollection)
            .select('*')
            .eq('enabled', true)
            .order('order', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching home layout:", error);
        return [];
    }
}

async function fetchPromoGroupCards(groupId) {
    try {
        const { data, error } = await db
            .from(promoCardsCollection)
            .select('*')
            .eq('group_id', groupId)
            .order('order', { ascending: true });
            
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error(`Error fetching promo cards for group ${groupId}:`, error);
        return [];
    }
}

async function fetchBrandGroupBrands(groupId) {
    try {
        const { data, error } = await db
            .from(brandsCollection)
            .select('*')
            .eq('group_id', groupId)
            .order('order', { ascending: true })
            .limit(30);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error(`Error fetching brands for group ${groupId}:`, error);
        return [];
    }
}

async function fetchNewestProducts(limitCount = 10) {
    try {
        // Ji bo Supabase, em tenê li gorî 'created_at' rêz dikin
        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limitCount);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return [];
    }
}

async function fetchShortcutRowCards(rowId) {
    try {
        const { data, error } = await db
            .from(shortcutCardsCollection)
            .select('*')
            .eq('row_id', rowId)
            .order('order', { ascending: true });

        if (error) throw error;
        return data || [];
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
        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .eq(queryField, queryValue)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return [];
    }
}

async function fetchInitialProductsForHome(limitCount = 10) {
     try {
        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limitCount);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching initial products for home page:", error);
        return [];
    }
}

// --- Cart Logic ---
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
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


// --- Favorites Logic ---
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
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
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
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
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
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
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
// Têbînî: Pêdivî ye ku mantiqê FCM (Firebase Cloud Messaging) were guheztin
// bo tiştekî ku Supabase piştgirî dike (mînak, 'web push' an servîsek partiya sêyemîn)
// Lê ji bo naha, em ê mantiqê (logic) heyî bihêlin
export async function requestNotificationPermissionCore() {
    console.warn("FCM logic (requestNotificationPermissionCore) needs replacing for Supabase.");
    // ... Mantiqê FCM yê kevn ...
    // ... (Koda FCM ya kevn li vir tê texmîn kirin) ...
    return { granted: false, message: 'FCM êdî nehatiye vesaz kirin (FCM دیگر تنظیم نشده است)' };
}

export function checkNewAnnouncementsCore(latestAnnouncementTimestamp) {
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    // Dîrokên Supabase (ISO string) bi yên Firebase (timestamp) re bide ber hev
    const latestTime = new Date(latestAnnouncementTimestamp).getTime();
    return latestTime > lastSeenTimestamp;
}

export function updateLastSeenAnnouncementTimestamp(timestamp) {
     const timeToSave = new Date(timestamp).getTime();
     localStorage.setItem('lastSeenAnnouncementTimestamp', timeToSave);
}

// --- PWA & Service Worker ---
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
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
// (Ev fonksiyon wek xwe dimînin - هیچ گۆڕانکارییەک نییە)
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


// --- Initialization ---

async function initializeCoreLogic() {
    if (!state.sliderIntervals) state.sliderIntervals = {};
    await fetchCategories();
}

export async function initCore() {
    // Ji ber ku em êdî IndexedDbPersistence bikar naynin, em wê radikin
    console.log("Supabase Core Initializing...");
    
    try {
        await initializeCoreLogic(); // Kategoriyan û mîhengên bingehîn bar bike

        // Guhdarîkirina li ser guhertinên rewşa têketinê (Auth State Change)
        auth.onAuthStateChanged(async (event, session) => {
            const user = session ? session.user : null;
            // Têbînî: Pêdivî ye ku Admin UID-a te li Supabase hebe
            // Ji bo naha, em ê tenê texmîn bikin ku têketin = admin
            const isAdmin = !!user; 
            const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';

            if (isAdmin) {
                sessionStorage.setItem('isAdmin', 'true');
                if (!wasAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                    window.AdminLogic.initialize();
                }
            } else {
                sessionStorage.removeItem('isAdmin');
                if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                    window.AdminLogic.deinitialize();
                }
            }
            document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
        });

        // Mantiqê FCM / Messaging li vir hatiye rakirin
        // ... (Pêdivî ye ku ji bo Supabase çareseriyek 'push notification' were dîtin) ...

        // PWA install prompt setup
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            state.deferredPrompt = e;
            console.log('`beforeinstallprompt` event fired.');
            document.dispatchEvent(new Event('installPromptReady'));
        });

        // Service Worker setup
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
    } catch (err) {
        console.error("Core Initialization failed:", err);
    }
}


// Fonksiyonên ku êdî ji Firebase nayên bikar anîn, lê ji bo exportê hatine hiştin
// da ku koda kevn a `admin.js` bi tevahî têk neçe (her çend ew ê hewceyê nûvekirinê bin)
export const collection = (name) => console.warn(`Firebase 'collection' is deprecated. Use 'db.from("${name}")'`);
export const doc = () => console.warn("Firebase 'doc' is deprecated.");
export const getDoc = () => console.warn("Firebase 'getDoc' is deprecated.");
export const updateDoc = () => console.warn("Firebase 'updateDoc' is deprecated.");
export const deleteDoc = () => console.warn("Firebase 'deleteDoc' is deprecated.");
export const addDoc = () => console.warn("Firebase 'addDoc' is deprecated.");
export const setDoc = () => console.warn("Firebase 'setDoc' is deprecated.");
export const query = () => console.warn("Firebase 'query' is deprecated.");
export const orderBy = () => console.warn("Firebase 'orderBy' is deprecated.");
export const onSnapshot = () => console.warn("Firebase 'onSnapshot' is deprecated.");
export const getDocs = () => console.warn("Firebase 'getDocs' is deprecated.");
export const where = () => console.warn("Firebase 'where' is deprecated.");
export const limit = () => console.warn("Firebase 'limit' is deprecated.");
export const startAfter = () => console.warn("Firebase 'startAfter' is deprecated.");
export const runTransaction = () => console.warn("Firebase 'runTransaction' is deprecated.");


// Exportên bingehîn ji bo UI
export {
    state,
    handleLogin, handleLogout,
    fetchCategories, fetchSubcategories, fetchSubSubcategories, fetchProductById, fetchProducts, fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    requestNotificationPermissionCore,
    handleInstallPrompt, forceUpdateCore,
};
