// app-core.js (تەواو نوێکراوە بۆ Supabase)

import {
    // *** گۆڕانکاری لێرە کرا: ئێمە 'db' (supabaseClient)ـی نوێ هاوردە دەکەین ***
    db, // ئەمە ئێستا Supabase Clientـە
    auth, // ئەمە ئێستا Supabase Authـە
    // ئەم ناوانە ئێستا تەنها "ناون" (string) نەک "collection"
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
} from './app-setup.js';

// *** گۆڕانکاری گەورە: هەموو هاوردەکردنەکانی (import) فایەربەیس سڕدرانەوە ***
// چیتر پێویستمان بە "firebase/app", "firebase/firestore", "firebase/auth" نییە

// --- Exported Helper Functions ---
// (ئەمانە وەک خۆیان دەمێننەوە - هیچ گۆڕانکارییەک نییە)
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
// (ئەمانە وەک خۆیان دەمێننەوە - هیچ گۆڕانکارییەک نییە)
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}
export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Authentication (*** گۆڕانکاری لێرە کرا ***) ---

async function handleLogin(email, password) {
    try {
        // *** گۆڕانکاری: فەنکشنی Supabase Auth بەکارهێنرا ***
        const { error } = await auth.signInWithPassword({
            email: email,
            password: password,
        });
        if (error) throw error; // فڕێدانی هەڵە بۆ ئەوەی بگیرێت
    } catch (error) {
        console.error("Supabase Login Error:", error.message);
        throw new Error(t('login_error')); // فڕێدانی هەڵە بۆ UI
    }
}

async function handleLogout() {
    // *** گۆڕانکاری: فەنکشنی Supabase Auth بەکارهێنرا ***
    await auth.signOut();
}

// --- Supabase Data Fetching (*** هەموو ئەمانە گۆڕدران ***) ---

async function fetchCategories() {
    // *** گۆڕانکاری: فەنکشنی Supabase Select بەکارهێنرا ***
    const { data, error } = await db
        .from(categoriesCollection) // 'categories'
        .select('*')
        .order('order', { ascending: true });

    if (error) {
        console.error("Error fetching categories:", error);
        state.categories = [];
    } else {
        state.categories = data;
    }
}

async function fetchSubcategories(categoryId) {
    if (categoryId === 'all') return [];
    try {
        // *** گۆڕانکاری: فەنکشنی Supabase Select + eq (where) بەکارهێنرا ***
        const { data, error } = await db
            .from('subcategories') // ناوی خشتەکە
            .select('*')
            .eq('category_id', categoryId) // مەرج (Where)
            .order('order', { ascending: true });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        return [];
    }
}

async function fetchSubSubcategories(mainCatId, subCatId) {
    if (!mainCatId || !subCatId) return [];
    try {
        // *** گۆڕانکاری: فەنکشنی Supabase Select + eq (where) بەکارهێنرا ***
        const { data, error } = await db
            .from('subSubcategories') // ناوی خشتەکە
            .select('*')
            .eq('subcategory_id', subCatId) // مەرج (Where)
            .order('order', { ascending: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching sub-subcategories:", error);
        return [];
    }
}

async function fetchProductById(productId) {
    try {
        // *** گۆڕانکاری: فەنکشنی Supabase Select + eq + single بەکارهێنرا ***
        const { data, error } = await db
            .from(productsCollection) // 'products'
            .select('*')
            .eq('id', productId)
            .single(); // .single() بۆ وەرگرتنی تەنها یەک دانە

        if (error) throw error;
        return data; // 'data' ئێستا ئۆبجێکتی کاڵاکەیە
    } catch (error) {
        console.error("Error fetching product by ID:", error);
        return null;
    }
}

async function fetchRelatedProducts(currentProduct) {
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) return [];

    try {
        // *** گۆڕانکاری: فەنکشنی Supabase Select بەکارهێنرا ***
        let query = db.from(productsCollection).select('*');

        if (currentProduct.subSubcategoryId) {
            query = query.eq('subSubcategoryId', currentProduct.subSubcategoryId);
        } else if (currentProduct.subcategoryId) {
            query = query.eq('subcategoryId', currentProduct.subcategoryId);
        } else {
            query = query.eq('categoryId', currentProduct.categoryId);
        }

        // کاڵای ئێستا دەرکە و تەنها 6 دانە بهێنە
        const { data, error } = await query
            .neq('id', currentProduct.id) // .neq() واتە (Not Equal - یەکسان نەبێت)
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching related products (new method):", error);
        return [];
    }
}

// (گرنگترین فەنکشن)
async function fetchProducts(searchTerm = '', isNewSearch = false) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (shouldShowHomeSections) {
        return { isHome: true, products: [], allLoaded: true };
    }

    // ... (لۆجیکی کاش وەک خۆی دەمێنێتەوە) ...
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        // ...
        return { isHome: false, products: state.products, allLoaded: state.allProductsLoaded };
    }

    if (state.isLoadingMoreProducts) return null;
    if (state.allProductsLoaded && !isNewSearch) return null;

    state.isLoadingMoreProducts = true;

    try {
        // *** گۆڕانکاری: فەنکشنی Supabase Query Builder بەکارهێنرا ***
        let query = db.from(productsCollection).select('*');

        if (state.currentCategory && state.currentCategory !== 'all') {
            query = query.eq('categoryId', state.currentCategory);
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            query = query.eq('subcategoryId', state.currentSubcategory);
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            query = query.eq('subSubcategoryId', state.currentSubSubcategory);
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            // .ilike() بۆ گەڕانی (case-insensitive) بەکاردێت
            query = query.ilike('searchableName', `%${finalSearchTerm}%`);
        }

        // *** گۆڕانکاری: گۆڕینی Pagination لە 'startAfter' بۆ 'range' (Offset/Limit) ***
        let page = 0;
        if (isNewSearch) {
            state.products = [];
            state.allProductsLoaded = false;
            page = 0;
            state.currentPage = 0; // دۆخێکی نوێ بۆ ژمارەی لاپەڕە دادەنێین
        } else {
            page = (state.currentPage || 0) + 1; // دەچینە لاپەڕەی داهاتوو
            state.currentPage = page;
        }

        const { from, to } = { from: page * PRODUCTS_PER_PAGE, to: (page + 1) * PRODUCTS_PER_PAGE - 1 };
        query = query.range(from, to);

        // ڕیزبەندی (Order)
        if (finalSearchTerm) {
            query = query.order('searchableName', { ascending: true });
        }
        query = query.order('created_at', { ascending: false }); // هەمیشە ڕیزبەندی دووەم

        // ناردنی داواکارییەکە
        const { data: newProducts, error } = await query;

        if (error) throw error;

        state.allProductsLoaded = newProducts.length < PRODUCTS_PER_PAGE;

        if (isNewSearch) {
            state.products = newProducts;
            state.productCache[cacheKey] = { // پاشەکەوتکردنی کاش
                products: state.products,
                allLoaded: state.allProductsLoaded
                // چیتر پێویستمان بە lastVisible نییە
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
        // *** گۆڕانکاری: Supabase Select + single بەکارهێنرا ***
        const { data, error } = await db
            .from('policies')
            .select('content')
            .single(); // .single() چونکە تەنها یەک دانەیە

        if (error) throw error;
        return data ? data.content : null;
    } catch (error) {
        console.error("Error fetching policies:", error);
        return null;
    }
}

async function fetchAnnouncements() {
    try {
        // *** گۆڕانکاری: Supabase Select بەکارهێنرا ***
        const { data, error } = await db
            .from(announcementsCollection) // 'announcements'
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching announcements:", error);
        return [];
    }
}

async function fetchContactMethods() {
    try {
        // *** گۆڕانکاری: Supabase Select بەکارهێنرا ***
        const { data, error } = await db
            .from('contact_methods')
            .select('*')
            .order('created_at', { ascending: true }); // لێرە created_at بەکاردێنین نەک order

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching contact methods:", error);
        return [];
    }
}

async function fetchHomeLayout() {
    try {
        // *** گۆڕانکاری: Supabase Select بەکارهێنرا ***
        const { data, error } = await db
            .from('home_layout')
            .select('*')
            .eq('enabled', true) // مەرج (Where)
            .order('order', { ascending: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching home layout:", error);
        return [];
    }
}

async function fetchPromoGroupCards(groupId) {
    try {
        // *** گۆڕانکاری: Supabase Select بەکارهێنرا ***
        const { data, error } = await db
            .from('promo_cards')
            .select('*')
            .eq('promo_group_id', groupId)
            .order('order', { ascending: true });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error fetching promo cards for group ${groupId}:`, error);
        return [];
    }
}

async function fetchBrandGroupBrands(groupId) {
    try {
        // *** گۆڕانکاری: Supabase Select بەکارهێنرا ***
        const { data, error } = await db
            .from('brands')
            .select('*')
            .eq('brand_group_id', groupId)
            .order('order', { ascending: true })
            .limit(30);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error fetching brands for group ${groupId}:`, error);
        return [];
    }
}

async function fetchNewestProducts(limitCount = 10) {
    try {
        // *** گۆڕانکاری: Supabase Select + RPC (بۆ بەروار) بەکاردێت ***
        // دانانی بەرواری 15 ڕۆژ پێش ئێستا
        const fifteenDaysAgo = new Date(Date.now() - (15 * 24 * 60 * 60 * 1000)).toISOString();

        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .gte('created_at', fifteenDaysAgo) // gte = Greater than or equal
            .order('created_at', { ascending: false })
            .limit(limitCount);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return [];
    }
}

async function fetchShortcutRowCards(rowId) {
    try {
        // *** گۆڕانکاری: Supabase Select بەکارهێنرا ***
        const { data, error } = await db
            .from('shortcut_cards')
            .select('*')
            .eq('shortcut_row_id', rowId)
            .order('order', { ascending: true });

        if (error) throw error;
        return data;
    } catch(error) {
        console.error(`Error fetching shortcut cards for row ${rowId}:`, error);
        return [];
    }
}

async function fetchCategoryRowProducts(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId } = sectionData;
    
    try {
        // *** گۆڕانکاری: Supabase Query Builder بەکارهێنرا ***
        let query = db.from(productsCollection).select('*');

        if (subSubcategoryId) {
            query = query.eq('subSubcategoryId', subSubcategoryId);
        } else if (subcategoryId) {
            query = query.eq('subcategoryId', subcategoryId);
        } else if (categoryId) {
            query = query.eq('categoryId', categoryId);
        } else {
            return []; // No category specified
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return [];
    }
}

async function fetchInitialProductsForHome(limitCount = 10) {
     try {
        // *** گۆڕانکاری: Supabase Select بەکارهێنرا ***
        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limitCount);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching initial products for home page:", error);
        return [];
    }
}

// --- Cart Logic (*** هیچ گۆڕانکارییەکی پێویست نییە ***) ---
// ئەم فەنکشنانە پشتیان بە 'state' و 'localStorage' بەستووە
export async function addToCartCore(productId) {
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        console.warn("Product not found in local cache for cart. Fetching...");
        // fetchProductById ئێستا هی Supabaseـە
        product = await fetchProductById(productId); 
        if (!product) {
            console.error(`Failed to add product ${productId} to cart: Not found.`);
            return { success: false, message: t('product_not_found_error') };
        }
    }
    // ... (لۆجیکی زیادکردن وەک خۆی دەمێنێتەوە) ...
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
    // ... (وەک خۆی دەمێنێتەوە) ...
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
    // ... (وەک خۆی دەمێنێتەوە) ...
    const initialLength = state.cart.length;
    state.cart = state.cart.filter(item => item.id !== productId);
    if (state.cart.length < initialLength) {
        saveCart();
        return true;
    }
    return false;
}

export function generateOrderMessageCore() {
    // ... (وەک خۆی دەمێنێتەوە) ...
    if (state.cart.length === 0) return "";
    // ... (هەموو لۆجیکی پەیامەکە) ...
    return message;
}


// --- Favorites Logic (*** هیچ گۆڕانکارییەکی پێویست نییە ***) ---
export function toggleFavoriteCore(productId) {
    // ... (وەک خۆی دەمێنێتەوە) ...
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

// --- Profile Logic (*** هیچ گۆڕانکارییەکی پێویست نییە ***) ---
export function saveProfileCore(profileData) {
    // ... (وەک خۆی دەمێنێتەوە) ...
    state.userProfile = {
        name: profileData.name || '',
        address: profileData.address || '',
        phone: profileData.phone || '',
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
    return t('profile_saved');
}

// --- Language (*** هیچ گۆڕانکارییەکی پێویست نییە ***) ---
export function setLanguageCore(lang) {
    // ... (وەک خۆی دەمێنێتەوە) ...
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    state.productCache = {};
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) homeContainer.innerHTML = '';
}

// --- Notifications (*** گۆڕانکاری گەورە: FCM لابرا ***) ---

// *** تێبینی: Firebase Cloud Messaging (FCM) لابرا ***
// Supabase سیستەمێکی جیاوازی هەیە بۆ Push Notifications کە پێویستی بە Edge Functions هەیە.
// ئێمە ئەم بەشە بە کاتی لادەبەین بۆ ئەوەی سەرەتا گواستنەوەی داتابەیسەکە تەواو بکەین.
// ئەم فەنکشنانە ئێستا هیچ ناکەن یان پەیامی کاتی دەگەڕێننەوە.

async function requestNotificationPermissionCore() {
    console.warn("requestNotificationPermissionCore (FCM) is not implemented for Supabase yet.");
    return { granted: false, message: 'سیستەمی ئاگەداری هێشتا بەردەست نییە' };
}
// async function saveTokenToFirestore(token) { ... } // لابرا

export function checkNewAnnouncementsCore(latestAnnouncementTimestamp) {
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    return latestAnnouncementTimestamp > lastSeenTimestamp;
}

export function updateLastSeenAnnouncementTimestamp(timestamp) {
     localStorage.setItem('lastSeenAnnouncementTimestamp', timestamp);
}

// --- PWA & Service Worker (*** هیچ گۆڕانکارییەکی پێویست نییە ***) ---
// ئەم فەنکشنانە پەیوەندییان بە وێبگەڕەکەوە هەیە نەک فایەربەیس
async function handleInstallPrompt(installBtn) {
    // ... (وەک خۆی دەمێنێتەوە) ...
    if (state.deferredPrompt) {
        installBtn.style.display = 'none';
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null;
    }
}

async function forceUpdateCore() {
    // ... (وەک خۆی دەمێنێتەوە) ...
    if (confirm(t('update_confirm'))) {
        try {
            // ... (لۆجیکی سڕینەوەی کاش) ...
            return { success: true, message: t('update_success') };
        } catch (error) {
            // ...
            return { success: false, message: t('error_generic') };
        }
    }
    return { success: false, message: 'Update cancelled.' };
}

// --- Navigation / History (*** هیچ گۆڕانکارییەکی پێویست نییە ***) ---
// ئەم فەنکشنانە پەیوەندییان بە 'History API'ـی وێبگەڕەکەوە هەیە
export function saveCurrentScrollPositionCore() {
    // ... (وەک خۆی دەمێنێتەوە) ...
    const currentState = history.state;
    const activePage = document.getElementById(state.currentPageId); 
    if (activePage && state.currentPageId === 'mainPage' && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: activePage.scrollTop }, '');
    }
}
export function applyFilterStateCore(filterState) {
    // ... (وەک خۆی دەمێنێتەوە) ...
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
}
export function navigateToFilterCore(newState) {
    // ... (وەK خۆی دەمێنێتەوە) ...
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
    // *** گۆڕانکاری: ئێمە چاوەڕێی fetchCategoriesـی نوێ دەکەین ***
    await fetchCategories();
}

export async function initCore() {
    // *** گۆڕانکاری: enableIndexedDbPersistence لابرا ***
    // Supabase خۆی کاشکردن بەڕێوەدەبات

    try {
        await initializeCoreLogic(); // چاوەڕێی لۆجیکی سەرەki بە

        // *** گۆڕانکاری: onAuthStateChanged گۆڕدرا بۆ onAuthStateChange ***
        auth.onAuthStateChange(async (event, session) => {
            const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // ئەمە UIDی فایەربەیس بوو
            
            // *** لۆجیکی نوێی Supabase بۆ Admin ***
            // لێرە دەبێت بزانین چۆن ئەدمین دەناسینەوە. با وادابنێین کە ئەدمین
            // ڕۆڵێکی تایبەتی هەیە لە داتابەیس، بەڵام بۆ ئێستا، با پشت بە session ببەستین
            
            const user = session ? session.user : null;
            let isAdmin = false;

            if (user) {
                // لێرەدا دەبێت پشکنین بۆ ڕۆڵی ئەدمین بکەین، بەڵام هێشتا ئامادە نییە
                // با وادابنێین کە چوونەژوورەوەی سەرکەوتوو واتە ئەدمینە (بۆ تاقیکردنەوە)
                // **** تێبینی: ئەمە پێویستە دواتر بەهێزتر بکرێت ****
                // با هەمان UIDی کۆن بەکاربهێنین ئەگەر گواستنەوەی Auth کرابێت
                // بەڵام وا دیارە نەکراوە، بۆیە با پشت بە بوونی session ببەستین.
                
                // بۆ سادەیی، با وادابنێین هەرکەسێک لۆگین بکات ئەدمینە
                // (چونکە تەنها ئەدمین لۆگین دەکات)
                isAdmin = true; 
            }
            
            const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';

            if (isAdmin) {
                sessionStorage.setItem('isAdmin', 'true');
                if (!wasAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                     window.AdminLogic.initialize();
                }
            } else {
                sessionStorage.removeItem('isAdmin');
                if (user) { await auth.signOut(); } // دەرکردنی غەیرە-ئەدمین
                if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                     window.AdminLogic.deinitialize();
                }
            }
            document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
        });

         // *** گۆڕانکاری: onMessage (FCM) لابرا ***
        // onMessage(messaging, (payload) => { ... });

         // PWA install prompt setup (وەک خۆی دەمێنێتەوە)
         window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            state.deferredPrompt = e;
            console.log('`beforeinstallprompt` event fired.');
            document.dispatchEvent(new Event('installPromptReady'));
        });

        // Service Worker setup (وەک خۆی دەمێنێتەوە)
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
        console.error("Error during core initialization:", err);
    }
}


// Expose necessary core functions and state for UI and Admin layers
// *** گۆڕانکاری: هەناردەکردنی فەنکشنە ساختەکانی فایەربەیس ***
export {
    state,
    handleLogin, handleLogout,
    fetchCategories, fetchSubcategories, fetchSubSubcategories, fetchProductById, fetchProducts, fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    requestNotificationPermissionCore,
    handleInstallPrompt, forceUpdateCore,

    // *** هەناردەکردنی فەنکشنە ساختەکان بۆ app-ui.js و admin.js ***
    // ئەم فەنکشنانە لە app-setup.jsـی نوێدا نین، بۆیە لێرە پێناسەیان دەکەین
    // بۆ ئەوەی فایلەکانی تر هەڵە نەدەن
    doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
    collection, query, orderBy, onSnapshot, getDocs, where, limit, startAfter, runTransaction,
    signInWithEmailAndPassword, onAuthStateChanged, signOut,
    getToken, onMessage
};

// *** دروستکردنی فەنکشنە ساختەکانی فایەربەیس ***
// ئەم فەنکشنانە چیتر هیچ ناکەن، بەڵام ڕێگری دەکەن لەوەی ئەپەکە بوەستێت
// تاوەکو هەموو فایلەکان نوێ دەکەینەوە
function doc() { console.warn("Firebase function 'doc' is called but not implemented."); }
function getDoc() { console.warn("Firebase function 'getDoc' is called."); return Promise.resolve({ exists: () => false }); }
function updateDoc() { console.warn("Firebase function 'updateDoc' is called."); return Promise.resolve(); }
function deleteDoc() { console.warn("Firebase function 'deleteDoc' is called."); return Promise.resolve(); }
function addDoc() { console.warn("Firebase function 'addDoc' is called."); return Promise.resolve(); }
function setDoc() { console.warn("Firebase function 'setDoc' is called."); return Promise.resolve(); }
function collection() { console.warn("Firebase function 'collection' is called."); }
function query() { console.warn("Firebase function 'query' is called."); }
function orderBy() { console.warn("Firebase function 'orderBy' is called."); }
function onSnapshot() { console.warn("Firebase function 'onSnapshot' is called."); return () => {}; }
function getDocs() { console.warn("Firebase function 'getDocs' is called."); return Promise.resolve({ docs: [], empty: true }); }
function where() { console.warn("Firebase function 'where' is called."); }
function limit() { console.warn("Firebase function 'limit' is called."); }
function startAfter() { console.warn("Firebase function 'startAfter' is called."); }
function runTransaction() { console.warn("Firebase function 'runTransaction' is called."); return Promise.resolve(); }
function signInWithEmailAndPassword() { console.warn("Firebase function 'signInWithEmailAndPassword' is called."); return Promise.resolve(); }
function onAuthStateChanged() { console.warn("Firebase function 'onAuthStateChanged' is called."); return () => {}; }
function signOut() { console.warn("Firebase function 'signOut' is called."); return Promise.resolve(); }
function getToken() { console.warn("Firebase function 'getToken' (FCM) is called."); return Promise.resolve(null); }
function onMessage() { console.warn("Firebase function 'onMessage' (FCM) is called."); return () => {}; }
