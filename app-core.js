// app-core.js (کۆدا نوو یا Supabase)

import {
    // 'db' نها Supabase Client e
    db, auth,
    // ئەڤە نها بتنێ ناڤن (String)
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    // خشتێن نوو
    subcategoriesCollection, subSubcategoriesCollection, promoCardsCollection,
    brandsCollection, shortcutCardsCollection, homeLayoutCollection,
    policiesCollection, socialLinksCollection, contactMethodsCollection,
    // شتێن دی
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
} from './app-setup.js';

// *** گرنگ: چ فەنکشنەکا Firebase ل ڤێرە نینە ***

// --- Exported Helper Functions ---
// (ئەڤە وەک خۆ دمینن - چ گوهۆڕین نینە)
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
// (ئەڤە وەک خۆ دمینن - چ گوهۆڕین نینە)
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}
export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// --- Authentication (*** گوهۆڕین ل ڤێرە هەیە ***) ---

async function handleLogin(email, password) {
    try {
        // *** گوهۆڕین: فەنکشنا Supabase Auth دهێتە بکارئینان ***
        const { error } = await auth.signInWithPassword({
            email: email,
            password: password,
        });
        if (error) throw error; // هەلدانا خەلەتیێ
    } catch (error) {
        console.error("Supabase Login Error:", error.message);
        throw new Error(t('login_error')); // هەلدانا خەلەتیێ بۆ UI
    }
}

async function handleLogout() {
    // *** گوهۆڕین: فەنکشنا Supabase Auth دهێتە بکارئینان ***
    await auth.signOut();
}

// --- Supabase Data Fetching (*** هەمی ئەڤە هاتینە گوهۆڕین ***) ---

async function fetchCategories() {
    // *** گوهۆڕین: فەنکشنا Supabase Select دهێتە بکارئینان ***
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
        // *** گوهۆڕین: فەنکشنا Supabase Select + eq (where) دهێتە بکارئینان ***
        const { data, error } = await db
            .from(subcategoriesCollection) // 'subcategories'
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
        // *** گوهۆڕین: فەنکشنا Supabase Select + eq (where) دهێتە بکارئینان ***
        const { data, error } = await db
            .from(subSubcategoriesCollection) // 'subSubcategories'
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
        // *** گوهۆڕین: فەنکشنا Supabase Select + eq + single دهێتە بکارئینان ***
        const { data, error } = await db
            .from(productsCollection) // 'products'
            .select('*')
            .eq('id', productId)
            .single(); // .single() بۆ وەرگرتنا بتنێ ئێک دانە

        if (error) {
            // ئەگەر خەلەتی "PGRST116" بیت، واتا چ کاڵا نەهاتینە دیتن
            if (error.code === 'PGRST116') {
                 console.warn(`Product with ID ${productId} not found.`);
                 return null;
            }
            throw error; // هەلدانا خەلەتیێن دی
        }
        return data; // 'data' نها ئۆبجێکتێ کاڵایێ یە
    } catch (error) {
        console.error("Error fetching product by ID:", error);
        return null;
    }
}

async function fetchRelatedProducts(currentProduct) {
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) return [];

    try {
        // *** گوهۆڕین: فەنکشنا Supabase Select دهێتە بکارئینان ***
        let query = db.from(productsCollection).select('*');

        if (currentProduct.subSubcategoryId) {
            query = query.eq('subSubcategoryId', currentProduct.subSubcategoryId);
        } else if (currentProduct.subcategoryId) {
            query = query.eq('subcategoryId', currentProduct.subcategoryId);
        } else {
            query = query.eq('categoryId', currentProduct.categoryId);
        }

        // کاڵایێ نها دەرکە و بتنێ 6 دانان بینە
        const { data, error } = await query
            .neq('id', currentProduct.id) // .neq() واتا (Not Equal - یەکسان نەبیت)
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

    // ... (لۆجیکێ کاشێ وەک خۆ دمینیت) ...
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        state.currentPage = state.productCache[cacheKey].page;
        return { isHome: false, products: state.products, allLoaded: state.allProductsLoaded };
    }

    if (state.isLoadingMoreProducts) return null;
    if (state.allProductsLoaded && !isNewSearch) return null;

    state.isLoadingMoreProducts = true;

    try {
        // *** گوهۆڕین: Supabase Query Builder دهێتە بکارئینان ***
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
            // .ilike() بۆ گەڕانێ (case-insensitive) دهێتە بکارئینان
            query = query.ilike('searchableName', `%${finalSearchTerm}%`);
        }

        // *** گوهۆڕین: گوهۆڕینا Pagination ژ 'startAfter' بۆ 'range' (Offset/Limit) ***
        let page = 0;
        if (isNewSearch) {
            state.products = [];
            state.allProductsLoaded = false;
            page = 0;
            state.currentPage = 0; // دۆخەکێ نوو بۆ ژمارا لاپەڕێ دادەنێین
        } else {
            page = (state.currentPage || 0) + 1; // دچینە لاپەڕا داهاتوو
            state.currentPage = page;
        }

        const { from, to } = { from: page * PRODUCTS_PER_PAGE, to: (page + 1) * PRODUCTS_PER_PAGE - 1 };
        query = query.range(from, to);

        // ڕیزبەندی (Order)
        if (finalSearchTerm) {
            query = query.order('searchableName', { ascending: true });
        }
        query = query.order('created_at', { ascending: false }); // هەمیشە ڕیزبەندیا دووەم

        // شاندنا داخازیێ
        const { data: newProducts, error } = await query;

        if (error) throw error;

        state.allProductsLoaded = newProducts.length < PRODUCTS_PER_PAGE;

        if (isNewSearch) {
            state.products = newProducts;
            state.productCache[cacheKey] = { // پاشەکەفتکرنا کاشێ
                products: state.products,
                allLoaded: state.allProductsLoaded,
                page: state.currentPage
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
        // *** گوهۆڕین: Supabase Select + single دهێتە بکارئینان ***
        const { data, error } = await db
            .from(policiesCollection) // 'policies'
            .select('content')
            .single(); // .single() چونکی بتنێ ئێک دانەیە

        if (error) throw error;
        return data ? data.content : null;
    } catch (error) {
        // ئەگەر چ یاسا نەبن، خەلەتیێ نیشان نادەین
        if (error.code !== 'PGRST116') {
            console.error("Error fetching policies:", error);
        }
        return null;
    }
}

async function fetchAnnouncements() {
    try {
        // *** گوهۆڕین: Supabase Select دهێتە بکارئینان ***
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
        // *** گوهۆڕین: Supabase Select دهێتە بکارئینان ***
        const { data, error } = await db
            .from(contactMethodsCollection) // 'contact_methods'
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching contact methods:", error);
        return [];
    }
}

async function fetchHomeLayout() {
    try {
        // *** گوهۆڕین: Supabase Select دهێتە بکارئینان ***
        const { data, error } = await db
            .from(homeLayoutCollection) // 'home_layout'
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
        // *** گوهۆڕین: Supabase Select دهێتە بکارئینان ***
        const { data, error } = await db
            .from(promoCardsCollection) // 'promo_cards'
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
        // *** گوهۆڕین: Supabase Select دهێتە بکارئینان ***
        const { data, error } = await db
            .from(brandsCollection) // 'brands'
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
        // *** گوهۆڕین: Supabase Select + gte (بۆ بەروارێ) دهێتە بکارئینان ***
        const fifteenDaysAgo = new Date(Date.now() - (15 * 24 * 60 * 60 * 1000)).toISOString();

        const { data, error } = await db
            .from(productsCollection)
            .select('*')
            .gte('created_at', fifteenDaysAgo) // gte = مەزنتر یان یەکسان
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
        // *** گوهۆڕین: Supabase Select دهێتە بکارئینان ***
        const { data, error } = await db
            .from(shortcutCardsCollection) // 'shortcut_cards'
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
        // *** گوهۆڕین: Supabase Query Builder دهێتە بکارئینان ***
        let query = db.from(productsCollection).select('*');

        if (subSubcategoryId) {
            query = query.eq('subSubcategoryId', subSubcategoryId);
        } else if (subcategoryId) {
            query = query.eq('subcategoryId', subcategoryId);
        } else if (categoryId) {
            query = query.eq('categoryId', categoryId);
        } else {
            return []; // چ جۆرەک نینە
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
        // *** گوهۆڕین: Supabase Select دهێتە بکارئینان ***
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

// --- Cart Logic (*** چ گوهۆڕینەکا پێدڤی نینە ***) ---
// ئەڤ فەنکشنە پشتا خۆ ب 'state' و 'localStorage' گرێددەن
export async function addToCartCore(productId) {
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        console.warn("Product not found in local cache for cart. Fetching...");
        // fetchProductById نها یا Supabase یە
        product = await fetchProductById(productId); 
        if (!product) {
            console.error(`Failed to add product ${productId} to cart: Not found.`);
            return { success: false, message: t('product_not_found_error') };
        }
    }
    // ... (لۆجیکێ زێدەکرنێ وەک خۆ دمینیت) ...
    const mainImage = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : (product.image || '');
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
    // ... (وەک خۆ دمینیت) ...
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
    // ... (وەک خۆ دمینیت) ...
    const initialLength = state.cart.length;
    state.cart = state.cart.filter(item => item.id !== productId);
    if (state.cart.length < initialLength) {
        saveCart();
        return true;
    }
    return false;
}

export function generateOrderMessageCore() {
    // ... (وەک خۆ دمینیت) ...
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


// --- Favorites Logic (*** چ گوهۆڕینەکا پێدڤی نینە ***) ---
export function toggleFavoriteCore(productId) {
    // ... (وەک خۆ دمینیت) ...
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

// --- Profile Logic (*** چ گوهۆڕینەکا پێدڤی نینە ***) ---
export function saveProfileCore(profileData) {
    // ... (وەک خۆ دمینیت) ...
    state.userProfile = {
        name: profileData.name || '',
        address: profileData.address || '',
        phone: profileData.phone || '',
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
    return t('profile_saved');
}

// --- Language (*** چ گوهۆڕینەکا پێدڤی نینە ***) ---
export function setLanguageCore(lang) {
    // ... (وەک خۆ دمینیت) ...
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    state.productCache = {};
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) homeContainer.innerHTML = '';
}

// --- Notifications (*** گوهۆڕینا مەزن: FCM هاتیە راکرن ***) ---

// *** تێبینی: Firebase Cloud Messaging (FCM) هاتیە راکرن ***
// Supabase سیستەمەکێ جودا هەیە بۆ Push Notifications کو پێدڤی ب Edge Functions هەیە.
// مە ئەڤ بەشە ب دەمکی راکریە دا کو گوهۆڕینا داتابەیسێ خلاس بکەین.
async function requestNotificationPermissionCore() {
    console.warn("requestNotificationPermissionCore (FCM) is not implemented for Supabase yet.");
    return { granted: false, message: 'سیستەمێ ئاگەهداریان هێشتا نینە' };
}
// async function saveTokenToFirestore(token) { ... } // هاتیە راکرن

export function checkNewAnnouncementsCore(latestAnnouncementTimestamp) {
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    return latestAnnouncementTimestamp > lastSeenTimestamp;
}

export function updateLastSeenAnnouncementTimestamp(timestamp) {
     localStorage.setItem('lastSeenAnnouncementTimestamp', timestamp);
}

// --- PWA & Service Worker (*** چ گوهۆڕینەکا پێدڤی نینە ***) ---
// ئەڤ فەنکشنە پشتا خۆ ب وێبگەرێ گرێددەن نەک فایەربەیس
async function handleInstallPrompt(installBtn) {
    // ... (وەک خۆ دمینیت) ...
    if (state.deferredPrompt) {
        installBtn.style.display = 'none';
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null;
    }
}

async function forceUpdateCore() {
    // ... (وەک خۆ دمینیت) ...
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

// --- Navigation / History (*** چ گوهۆڕینەکا پێدڤی نینە ***) ---
export function saveCurrentScrollPositionCore() {
    // ... (وەک خۆ دمینیت) ...
    const currentState = history.state;
    const activePage = document.getElementById(state.currentPageId); 
    if (activePage && state.currentPageId === 'mainPage' && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: activePage.scrollTop }, '');
    }
}
export function applyFilterStateCore(filterState) {
    // ... (وەک خۆ دمینیت) ...
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
}
export function navigateToFilterCore(newState) {
    // ... (وەک خۆ دمینیت) ...
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
    // *** گوهۆڕین: ئەم چاڤەرێی fetchCategories یا نوو دبین ***
    await fetchCategories();
}

export async function initCore() {
    // *** گوهۆڕین: enableIndexedDbPersistence هاتیە راکرن ***
    try {
        await initializeCoreLogic(); // چاڤەرێی لۆجیکێ سەرەکی بە

        // *** گوهۆڕین: onAuthStateChanged هاتیە گوهۆڕین بۆ onAuthStateChange ***
        auth.onAuthStateChange(async (event, session) => {
            const user = session ? session.user : null;
            let isAdmin = false;

            if (user) {
                // نها ئەم دشێین پشتراست بکەین کا ئەڤ یوزەرە "ئەدمین"ە یان نە
                // ب رێکا خشتەیا 'profiles' یا مە دروست کری
                const { data: profile, error } = await db
                    .from('profiles') // ناڤێ خشتەیێ
                    .select('role')   // بتنێ ستوونا 'role' بینە
                    .eq('id', user.id) // ل یوزەرێ نها بگەڕە
                    .single(); // بتنێ ئێک دانە

                if (error && error.code !== 'PGRST116') { // PGRST116 = چ تشت نەهاتە دیتن
                     console.error("Error checking admin role:", error);
                }
                
                if (profile && profile.role === 'admin') {
                    isAdmin = true;
                }
            }
            
            const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';

            if (isAdmin) {
                sessionStorage.setItem('isAdmin', 'true');
                if (!wasAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                     window.AdminLogic.initialize();
                }
            } else {
                sessionStorage.removeItem('isAdmin');
                // ئەگەر یوزەر لۆگین کربیت لێ نە ئەدمین بیت، دەرکەڤیت
                if (user) { await auth.signOut(); } 
                if (wasAdmin && window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                     window.AdminLogic.deinitialize();
                }
            }
            document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
        });

         // *** گوهۆڕین: onMessage (FCM) هاتیە راکرن ***
         
         // PWA install prompt (وەک خۆ دمینیت)
         window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            state.deferredPrompt = e;
            console.log('`beforeinstallprompt` event fired.');
            document.dispatchEvent(new Event('installPromptReady'));
        });

        // Service Worker setup (وەک خۆ دمینیت)
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


// هەناردەکرنا فەنکشنێن پێدڤی بۆ قاتا UI
export {
    state,
    handleLogin, handleLogout,
    fetchCategories, fetchSubcategories, fetchSubSubcategories, fetchProductById, fetchProducts, fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    requestNotificationPermissionCore,
    handleInstallPrompt, forceUpdateCore,
    
    // *** گرنگ: ئەڤە هاتیە راکرن ***
    // چ فەنکشنەکا Firebase ناهێتە هەناردەکرن
};
