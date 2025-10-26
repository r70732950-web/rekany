// ui.js
// Berpirs e ji bo birêvebirina UI-ya giştî: pop-up, agahdarî, rûpel, ziman, hwd.

import {
    // Ji app-setup.js tenê tuخمên ku bi rastî têne export kirin import bike
    state,
    translations,
    sheetOverlay,
    loginModal,
    welcomeModal,
    notificationsSheet,
    cartSheet,
    categoriesSheet,
    profileSheet,
    favoritesSheet,
    productDetailSheet,
    termsSheet,
    mainPage,
    // === START: ÇAKKIRIN / FIX ===
    // profileName, profileAddress, û profilePhone hatin rakirin ji ber ku nehatine export kirin
    profileForm
    // === END: ÇAKKIRIN / FIX ===
} from './app-setup.js';
import { renderCart } from './cart.js';
import { renderFavoritesPage } from './favorites.js';
import { renderCategoriesSheet, renderPolicies } from './category.js';
import { renderUserNotifications } from './home.js'; // Ev ê bê guhertin bo 'notifications.js' lê niha baş e

// --- Callback Fonksiyonên Placeholder ---
// Em van datînin da ku ui.js pêwîst neke rasterast modulên din import bike
let callbacks = {
    renderCart: renderCart,
    renderFavoritesPage: renderFavoritesPage,
    renderCategoriesSheet: renderCategoriesSheet,
    renderUserNotifications: renderUserNotifications,
    renderPolicies: renderPolicies,
    applyFilterState: () => {}, // Dê ji app-logic.js were danîn
};

/**
 * Fonksiyonên callback saz dike da ku pêwendiya kêm (loose coupling) misoger bike
 * @param {Object} funcs - Objektek ji fonksiyonên callback
 */
export function setupUICallbacks(funcs) {
    callbacks = { ...callbacks, ...funcs };
}

// --- Fonksiyonên UI yên Sereke ---

/**
 * Zimanê sepanê diguherîne
 * @param {string} lang - Koda zimanê (mînak: 'ku_sorani')
 */
export function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    // Rêgeziya rûpelê û zimanê HTML saz dike
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';

    // Hemî tuخمên ku wergerandinê hewce dikin nûve dike
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    // Bişkojên ziman nûve dike
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Vegerandina beşên ku dibe ku bi ziman ve girêdayî bin
    // (Em bangî 'applyFilterState' dikin ku ew ê rûpelê ji nû ve ava bike)
    if (callbacks.applyFilterState) {
        callbacks.applyFilterState(state, false, true); // 'true' ji bo force re-render
    }

    // Nûvekirina UI-yên din ên ku vekirî ne
    if (document.getElementById('cartSheet').classList.contains('show')) callbacks.renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) callbacks.renderFavoritesPage();
}

/**
 * Rûpelek taybet nîşan dide û yên din vedişêre
 * @param {string} pageId - ID ya rûpela ku were nîşandan
 * @param {string} [pageTitle=''] - Sernavê ku di headerê de were nîşandan (ji bo sub-rûpelan)
 * @param {Object} [params={}] - Parametreyên ku bi rewşa rûpelê re werin tomarkirin
 */
export function showPage(pageId, pageTitle = '', params = {}) {
    // Hemî rûpelan kontrol dike û ya çalak nîşan dide
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Heke ne rûpela sereke be, scroll bike serî
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Headerê li gorî rûpelê nûve dike
    if (pageId === 'settingsPage') {
        updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        updateHeaderView('subcategoryDetailPage', pageTitle);
    } else {
        updateHeaderView('mainPage');
    }
    
    // Rewşa (state) ya sepanê ji bo navîgasyonê nûve dike
    state.currentPageId = pageId;
    state.currentPageParams = params;

    // Bişkoka navîgasyonê ya çalak nûve dike
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
    
    // Tomarkirina rewşa rûpelê di history de
    const historyState = { type: 'page', id: pageId, title: pageTitle, ...params };
    const hash = (pageId === 'mainPage') ? '' : (pageId === 'subcategoryDetailPage' ? `#subcategory_${params.mainCatId}_${params.subCatId}` : `#${pageId}`);
    
    // Tenê 'pushState' bike heke rewşa niha ne eynî be
    if (!state.isNavigatingBack && JSON.stringify(history.state) !== JSON.stringify(historyState)) {
        history.pushState(historyState, '', hash || window.location.pathname.split('?')[0]);
    }
    state.isNavigatingBack = false; // Piştî operasyonê reset bike
}


/**
 * Hemî pop-up û modalên vekirî digire
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

/**
 * Pop-up (sheet an modal) vedike
 * @param {string} id - ID ya tuخمê ku were vekirin
 * @param {string} [type='sheet'] - Cure ('sheet' an 'modal')
 */
export function openPopup(id, type = 'sheet') {
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Pêşî hemî yên din bigire
    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Callbackên ji bo nûvekirina naverokê dema vekirinê
        if (id === 'cartSheet') callbacks.renderCart();
        if (id === 'favoritesSheet') callbacks.renderFavoritesPage();
        if (id === 'categoriesSheet') callbacks.renderCategoriesSheet();
        if (id === 'notificationsSheet') callbacks.renderUserNotifications();
        if (id === 'termsSheet') callbacks.renderPolicies();
        if (id === 'profileSheet') {
            // === START: ÇAKKIRIN / FIX ===
            // Em êdî van ji app-setup import nakin, em getElementById bikar tînin
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
            // === END: ÇAKKIRIN / FIX ===
        }
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    
    // Rewşa pop-upê di history de tomar dike
    if (!state.isNavigatingBack) {
        history.pushState({ type: type, id: id }, '', `#${id}`);
    }
}

/**
 * Pop-upa niha ya çalak digire (bi rêya history.back)
 */
export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Ev ê 'popstate' trigger bike, ku ew ê 'closeAllPopupsUI' bang bike
    } else {
        closeAllPopupsUI(); // Wekî fallback
    }
}

/**
 * Nîşanek (notification) demkî nîşan dide
 * @param {string} message - Peyama ku were nîşandan
 * @param {string} [type='success'] - Cure ('success' an 'error')
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Hêdî hêdî nîşan bide
    setTimeout(() => notification.classList.add('show'), 10);
    // Piştî 3 çirkeyan veşêre
    setTimeout(() => {
        notification.classList.remove('show');
        // Piştî ku animasyona veşartinê xilas bû, jê bibe
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

/**
 * Dîmena headerê diguherîne (navbera rûpela sereke û sub-rûpelan)
 * @param {string} view - 'mainPage' an 'subpage'
 * @param {string} [title=''] - Sernavê ji bo sub-rûpelê
 */
export function updateHeaderView(view, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (view === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

/**
 * Bişkoka çalak di navîgasyona jêrîn de nûve dike
 * @param {string} activeBtnId - ID ya bişkoka ku bibe çalak
 */
export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * URL û rewşa (state) ji bo fîlterek nû nûve dike
 * @param {Object} newState - Rewşa fîlterê ya nû
 */
export function navigateToFilter(newState) {
    // Rewşa scrolla niha tomar bike
    history.replaceState({ ...history.state, scroll: window.scrollY }, '');

    // Rewşa nû biafirîne
    const finalState = { ...state.filterState, ...newState, scroll: 0 };
    
    // URL-ê nûve bike
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Rewşa nû bixe nav history
    history.pushState(finalState, '', newUrl);

    // Fîlterê bicîh bîne
    if (callbacks.applyFilterState) {
        callbacks.applyFilterState(finalState);
    }
}

/**
 * Fîlterê li gorî rewşek (state) diyarkirî bicîh tîne
 * @param {Object} filterState - Rewşa fîlterê
 * @param {boolean} [fromPopState=false] - Gelo ev ji bûyera 'popstate' tê
 * @param {boolean} [forceRender=false] - Gelo divê ji nû ve render bike heke state wekî hev be jî
 */
export function applyFilterState(filterState, fromPopState = false, forceRender = false) {
    const oldState = { ...state.filterState };
    const newState = {
        category: filterState.category || 'all',
        subcategory: filterState.subcategory || 'all',
        subSubcategory: filterState.subSubcategory || 'all',
        search: filterState.search || '',
    };
    
    // Kontrol bike ka tiştek bi rastî guheriye
    const hasChanged = JSON.stringify(oldState) !== JSON.stringify(newState);
    if (!hasChanged && !forceRender) return; // Heke tiştek neguheriye, tiştek neke

    // Rewşa (state) ya giştî nûve bike
    state.filterState = newState;
    state.currentCategory = newState.category;
    state.currentSubcategory = newState.subcategory;
    state.currentSubSubcategory = newState.subSubcategory;
    state.currentSearch = newState.search;

    // UI-yê nûve bike da ku li gorî rewşa nû be
    document.getElementById('searchInput').value = state.currentSearch;
    document.getElementById('clearSearchBtn').style.display = state.currentSearch ? 'block' : 'none';

    // Kategoriyên sereke û jêr-kategoriyan ji nû ve render bike
    if (callbacks.renderMainCategories) callbacks.renderMainCategories();
    if (callbacks.renderSubcategories) callbacks.renderSubcategories(state.currentCategory);

    // Li kałayan bigere
    if (callbacks.searchProducts) {
        callbacks.searchProducts(state.currentSearch, true);
    }

    // Scroll-ê sererast bike
    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Rûpela destpêkê li gorî URL-a niha saz dike (dema rûpel tê barkirin)
 */
export function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');
    
    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // Li benda barkirina kategoriyan be berî ku nîşan bide
        // Ev dê ji hêla onSnapshot a kategoriyan ve were birêvebirin
    } else if (pageId === 'settingsPage') {
         showPage(pageId, t('settings_title'));
    } else {
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        history.replaceState(initialState, ''); // Rewşa destpêkê saz bike
        if (callbacks.applyFilterState) {
            callbacks.applyFilterState(initialState);
        }
    }

    // Pop-upên di hash de veke (mînak: #cartSheet)
    const element = document.getElementById(hash);
    if (element && pageId === 'mainPage') {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopup(hash, isSheet ? 'sheet' : 'modal');
        }
    }

    // Hûrguliyên kałayê veke heke di URL de be
    const productId = params.get('product');
    if (productId) {
        // Hinekî raweste da ku piştrast be ku sepan amade ye
        setTimeout(() => callbacks.showProductDetails(productId), 500);
    }
}

/**
 * Fonksiyona ji bo nûvekirina bi zorê (force update) bi paqijkirina cache
 */
export async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            // Service Worker-an jê bibe
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }
            // Hemî Cache-an paqij bike
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
            }
            showNotification(t('update_success'), 'success');
            // Rûpelê ji nû ve barke
            setTimeout(() => window.location.reload(true), 1500);
        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

/**
 * Daxwaza destûrê ji bo agahdariyan
 */
export async function requestNotificationPermission() {
    console.log('Daxwaza destûra agahdariyan...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showNotification('Destûra agahdariyan hate dayîn', 'success');
            // Tokenê ji FCM bistîne (ev fonksiyon divê di app-logic.js de be)
            if (callbacks.getFcmToken) {
                callbacks.getFcmToken();
            }
        } else {
            showNotification('Destûr nehate dayîn', 'error');
        }
    } catch (error) {
        console.error('Error requesting permission: ', error);
    }
}

/**
 * Bişkoja GPS di rûpela profaylê de saz dike
 */
export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    // === START: ÇAKKIRIN / FIX ===
    const profileAddressInput = document.getElementById('profileAddress'); // Bi rêya getElementById hate dîtin
    // === END: ÇAKKIRIN / FIX ===
    
    if (!getLocationBtn || !profileAddressInput) return;
    
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('Geroka te piştgiriya GPS nake', 'error');
            return;
        }

        btnSpan.textContent = '...Li bendê be';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Bikaranîna Nominatim ji bo dîtina navê cîh
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    const data = await response.json();
                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification('Navnîşan hate wergirtin', 'success');
                    } else {
                        showNotification('Navnîşan nehate dîtin', 'error');
                    }
                } catch (error) {
                    showNotification('Çewtî di wergirtina navnîşanê de', 'error');
                } finally {
                    btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => {
                // ... (koda birêvebirina çewtiyê wekî berê)
                showNotification('Destûr nehate dayîn an çewtî çêbû', 'error');
                btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            }
        );
    });
}

