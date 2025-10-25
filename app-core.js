// app-core.js
// Destpêk, event listeners, navigation, PWA, û barkirina features

import {
    // Firebase services (re-exported ji setup bo bikaranîna navxweyî)
    db, auth, messaging,
    // Global state û constants
    state, // Têbînî: State niha dibe ku bêtir di features de were bikaranîn
    translations, // Hîn jî dibe ku ji bo t() hewce be
    // DOM elements (tenê yên ku core hewce dike)
    loginModal, // Bo girtina modal piştî login
    sheetOverlay, // Bo girtina overlay
    // Wekî din, em ê hewl bidin ku elementên DOM di features de bihêlin
} from './app-setup.js';

// Import servicesên Firebase ku rasterast di core de têne bikaranîn
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, doc, getDoc, collection, query, orderBy, onSnapshot, getDocs, limit, where, startAfter, addDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import hemû fonksiyonên features
import * as features from './app-features.js';

// === Helper Functions (Core related) ===

/**
 * Fonksiyon ji bo wergerandinê (dikare li vir bimîne yan jî bi features re were barkirin)
 * Translates a key using the current language.
 * @param {string} key - The translation key.
 * @param {object} replacements - Placeholder replacements.
 * @returns {string} The translated string.
 */
function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * Fonksiyon ji bo derengxistina cîbicîkirina fonksiyonek din (debounce).
 * @param {Function} func - Fonksiyona ku were derengxistin.
 * @param {number} [delay=500] - Dema derengxistinê bi milîsanî.
 * @returns {Function} Fonksiyona debounced.
 */
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// === Navigation & Page Management ===

let currentHistoryState = null; // Ji bo şopandina rewşa niha

/**
 * Cihê scrollê yê niha di history state de tomar dike.
 */
function saveCurrentScrollPosition() {
    const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
    // Tenê ji bo rewşa filtera rûpela sereke tomar bike
    if (mainPageActive && currentHistoryState && !currentHistoryState.type) {
        history.replaceState({ ...currentHistoryState, scroll: window.scrollY }, '');
        currentHistoryState.scroll = window.scrollY; // Update local tracker
    }
}

/**
 * Dîmena headerê nûve dike li gorî rûpela çalak.
 * @param {string} pageId - ID ya rûpela çalak.
 * @param {string} [title=''] - Sernavê ji bo subpage header.
 */
function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) return; // Parastin

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

/**
 * Rûpelek diyar nîşan dide û yên din vedişêre.
 * @param {string} pageId - ID ya rûpela ku were nîşandan.
 * @param {string} [pageTitle=''] - Sernavê ji bo headerê (eger ne rûpela sereke be).
 */
function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0); // Scroll bike jor ji bo rûpelên nû
    }

    // Nûvekirina headerê li gorî rûpelê
    if (pageId === 'settingsPage') {
        updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        updateHeaderView('subcategoryDetailPage', pageTitle || 'Details'); // Sernavê default
    } else {
        updateHeaderView('mainPage');
    }

    // Nûvekirina butona navîgasyonê ya çalak
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    }
}

/**
 * Hemû popupên UI (modals, bottom sheets) digire.
 */
function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if (sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

/**
 * Popupek (modal an bottom sheet) vedike.
 * @param {string} id - ID ya elementa popupê.
 * @param {('sheet'|'modal')} [type='sheet'] - Cûreya popupê.
 */
function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Scrollê berê tomar bike
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Pêşî hemûyan bigire

    if (type === 'sheet') {
        if (sheetOverlay) sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Bangkirina fonksiyonên renderkirinê yên têkildar ji features
        if (id === 'cartSheet' && features.renderCart) features.renderCart();
        if (id === 'favoritesSheet' && features.renderFavoritesPage) features.renderFavoritesPage();
        if (id === 'categoriesSheet' && features.renderCategoriesSheet) features.renderCategoriesSheet();
        if (id === 'notificationsSheet' && features.renderUserNotifications) features.renderUserNotifications();
        if (id === 'termsSheet' && features.renderPolicies) features.renderPolicies();
        if (id === 'productDetailSheet') { /* Rendering di features.showProductDetailsWithData de ye */ }
        if (id === 'profileSheet' && features.loadProfileData) features.loadProfileData(); // Fonksiyonek nû di features de
    } else { // Modal
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');

    // Rewşa history nûve bike
    const newState = { type: type, id: id };
    history.pushState(newState, '', `#${id}`);
    currentHistoryState = newState; // Rewşa niha bişopîne
}

/**
 * Popupa niha ya çalak digire (bi bikaranîna history.back).
 */
function closeCurrentPopup() {
    if (currentHistoryState && (currentHistoryState.type === 'sheet' || currentHistoryState.type === 'modal')) {
        history.back(); // Popstate event dê UI bigire
    } else {
        // Heke tiştek di history de tunebe (rewşek kêm), bi destan bigire
        closeAllPopupsUI();
    }
}

/**
 * Rewşa filterê ya nû bicîh tîne (ji popstate an navigateToFilter).
 * @param {object} filterState - Rewşa filterê (category, subcategory, search, scroll).
 * @param {boolean} [fromPopState=false] - Nîşan dide ka ev ji popstate hatiye bangkirin.
 */
async function applyFilterState(filterState, fromPopState = false) {
    // Nûvekirina state (ev dibe ku bêtir were veguhestin bo features)
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Nûvekirina UI (ev dibe ku bêtir were veguhestin bo features)
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) searchInput.value = state.currentSearch;
    if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Bangkirina fonksiyonên renderkirinê ji features
    if (features.renderMainCategories) features.renderMainCategories();
    if (features.renderSubcategories) await features.renderSubcategories(state.currentCategory); // Hîn jî dibe ku hewce be ji bo UIya sereke

    // Bangkirina fonksiyona lêgerînê/filterkirinê ji features
    if (features.searchProductsInFirestore) await features.searchProductsInFirestore(state.currentSearch, true); // Her tim wekî lêgerînek nû dest pê bike

    // Bicihkirina scroll position
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Derengiyek biçûk bide da ku piştrast bibe ku content hatiye barkirin
        setTimeout(() => window.scrollTo(0, filterState.scroll), 100);
    } else if (!fromPopState) {
        // Scroll bike jor ji bo filterên nû yên ku ji UI hatine çêkirin
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Navîgasyonê dike bo rewşek filterê ya nû û history nûve dike.
 * @param {object} newStateChanges - Guhertinên ku li rewşa niha werin zêdekirin.
 */
async function navigateToFilter(newStateChanges) {
    // Rewşa niha bi scroll position tomar bike
    saveCurrentScrollPosition();

    // Rewşa nû biafirîne
    const finalState = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: 0, // Her gav scrollê sifir bike ji bo navîgasyona nû
        ...newStateChanges // Guhertinên nû bicîh bike
    };

    // URLê nû biafirîne
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // History nûve bike
    history.pushState(finalState, '', newUrl);
    currentHistoryState = finalState; // Tracker nûve bike

    // Rewşa nû bicîh bike
    await applyFilterState(finalState);
}

// === PWA & Service Worker ===

/**
 * Dema ku bikarhêner li ser bişkoja 'update' bitikîne, peyamek dişîne bo SW.
 */
function skipWaiting() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
            }
        });
    }
}

/**
 * Service Worker tomar dike û guhdarî dike ji bo nûvekirinan.
 */
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW Registered.');

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('SW Update Found!', newWorker);
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (updateNotification) updateNotification.classList.add('show');
                    }
                });
            });

            if (updateNowBtn) updateNowBtn.addEventListener('click', skipWaiting);

        }).catch(err => console.error('SW Registration Failed:', err));

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('SW Controller Changed. Reloading...');
            window.location.reload();
        });
    }
}

// === Notifications ===

/**
 * Daxwaza destûrê ji bo notifications dike û token tomar dike.
 */
async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            features.showNotification(t('notification_permission_granted', { lang: state.currentLanguage }), 'success'); // Assuming t() is available or moved
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            features.showNotification(t('notification_permission_denied', { lang: state.currentLanguage }), 'error');
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
    }
}

/**
 * FCM token di Firestore de tomar dike.
 * @param {string} token - The FCM token.
 */
async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use setDoc with the token as the document ID to prevent duplicates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add more data, like user ID if logged in
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore:', error);
    }
}

// === Authentication ===

/**
 * UIya admin nûve dike li gorî rewşa login.
 * @param {boolean} isAdmin - Nîşan dide ka bikarhêner admin e.
 */
function updateAdminSpecificUI(isAdmin) {
    // Ev fonksiyon dê UIya taybet a admin kontrol bike (wekî bişkoja logout/login)
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
    const addProductBtn = document.getElementById('addProductBtn'); // Assuming add product is admin only

    if (isAdmin) {
        if (settingsLogoutBtn) settingsLogoutBtn.style.display = 'flex';
        if (settingsAdminLoginBtn) settingsAdminLoginBtn.style.display = 'none';
        if (addProductBtn) addProductBtn.style.display = 'flex';
         // Hide login modal if user successfully logs in as admin
        if (loginModal && loginModal.style.display === 'block') {
             closeCurrentPopup();
         }
    } else {
        if (settingsLogoutBtn) settingsLogoutBtn.style.display = 'none';
        if (settingsAdminLoginBtn) settingsAdminLoginBtn.style.display = 'flex';
        if (addProductBtn) addProductBtn.style.display = 'none';
    }

    // Bangkirina fonksiyonek ji features ji bo nûvekirina UIya giştî ya ku dibe ku biguhere
    if (features.updateUIAfterAuthChange) {
        features.updateUIAfterAuthChange(isAdmin);
    }
     // Initialize or deinitialize admin logic (admin.js)
     if (isAdmin) {
         if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Ensure admin logic is loaded before initializing
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                  window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
         } else {
             console.warn("AdminLogic not found or initialize not a function during admin login.");
         }
     } else {
         if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
             window.AdminLogic.deinitialize(); // Clean up admin UI elements
         }
     }
}

// === Event Listeners Setup ===

/**
 * Hemû event listenerên global saz dike.
 */
function setupEventListeners() {
    // Navigation Listeners
    document.getElementById('homeBtn')?.addEventListener('click', async () => {
        if (!document.getElementById('mainPage')?.classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    });
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
        const newState = { type: 'page', id: 'settingsPage', title: t('settings_title') };
        history.pushState(newState, '', '#settingsPage');
        currentHistoryState = newState;
        showPage('settingsPage');
    });
    document.getElementById('headerBackBtn')?.addEventListener('click', () => history.back());

    // Popup Trigger Listeners
    document.getElementById('profileBtn')?.addEventListener('click', () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); });
    document.getElementById('cartBtn')?.addEventListener('click', () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); });
    document.getElementById('categoriesBtn')?.addEventListener('click', () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); });
    document.getElementById('settingsFavoritesBtn')?.addEventListener('click', () => openPopup('favoritesSheet'));
    document.getElementById('settingsAdminLoginBtn')?.addEventListener('click', () => openPopup('loginModal', 'modal'));
    document.getElementById('notificationBtn')?.addEventListener('click', () => openPopup('notificationsSheet'));
    document.getElementById('termsAndPoliciesBtn')?.addEventListener('click', () => openPopup('termsSheet'));
    document.getElementById('addProductBtn')?.addEventListener('click', () => {
        if (window.AdminLogic && window.AdminLogic.openAddProductModal) {
            window.AdminLogic.openAddProductModal(); // Assume admin.js has this
        } else {
            console.warn("AdminLogic or openAddProductModal not available.");
        }
    });


    // Popup Closing Listeners
    sheetOverlay?.addEventListener('click', closeCurrentPopup);
    document.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', closeCurrentPopup));
    window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); });

    // Search Listener (Main Search)
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value;
            if (clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
            debouncedSearch(searchTerm);
        });
    }
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            navigateToFilter({ search: '' });
        });
    }
     // Subpage Search Listener
     const subpageSearchInput = document.getElementById('subpageSearchInput');
     const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
     const debouncedSubpageSearch = debounce(async (term) => {
         const hash = window.location.hash.substring(1);
         if (hash.startsWith('subcategory_') && features.renderProductsOnDetailPage) {
             const ids = hash.split('_');
             const subCatId = ids[2];
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
             await features.renderProductsOnDetailPage(subCatId, subSubCatId, term);
         }
     }, 500);

     if (subpageSearchInput) {
         subpageSearchInput.addEventListener('input', () => {
             const searchTerm = subpageSearchInput.value;
             if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
             debouncedSubpageSearch(searchTerm);
         });
     }
     if (subpageClearSearchBtn) {
         subpageClearSearchBtn.addEventListener('click', () => {
             if (subpageSearchInput) subpageSearchInput.value = '';
             subpageClearSearchBtn.style.display = 'none';
             debouncedSubpageSearch('');
         });
     }

    // Login Form Listener
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        if (!email || !password) return;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Auth state change will handle UI updates and admin initialization
        } catch (error) {
            console.error("Login failed:", error);
            features.showNotification(t('login_error'), 'error');
        }
    });

    // Profile Form Listener (delegated to features?)
    document.getElementById('profileForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (features.saveProfileData) features.saveProfileData();
        closeCurrentPopup();
    });

    // Language Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (features.setLanguage) features.setLanguage(btn.dataset.lang);
        });
    });

    // PWA Install Button
    document.getElementById('installAppBtn')?.addEventListener('click', async () => {
        if (state.deferredPrompt) {
            document.getElementById('installAppBtn').style.display = 'none';
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            state.deferredPrompt = null;
        }
    });

    // Other Settings Buttons
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', () => {
         if (features.forceUpdate) features.forceUpdate();
    });
    document.getElementById('settingsLogoutBtn')?.addEventListener('click', async () => {
         await signOut(auth);
         features.showNotification(t('logout_success'), 'success');
         // Auth state change will handle UI updates
     });

    // Contact Links Toggle
     const contactToggle = document.getElementById('contactToggle');
     if (contactToggle) {
         contactToggle.addEventListener('click', () => {
             const container = document.getElementById('dynamicContactLinksContainer');
             const chevron = contactToggle.querySelector('.contact-chevron');
             container?.classList.toggle('open');
             chevron?.classList.toggle('open');
         });
     }
      // Social Media Links Toggle (in Admin section)
      const socialMediaToggle = document.getElementById('socialMediaToggle');
      if (socialMediaToggle) {
          socialMediaToggle.addEventListener('click', () => {
              const container = document.getElementById('adminSocialMediaManagement')?.querySelector('.contact-links-container');
              const chevron = socialMediaToggle.querySelector('.contact-chevron');
              container?.classList.toggle('open');
              chevron?.classList.toggle('open');
          });
      }

    // Popstate listener for handling back/forward navigation
    window.addEventListener('popstate', handlePopstate);
}

/**
 * Fonksiyon ji bo birêvebirina `popstate` event.
 * @param {PopStateEvent} event - The popstate event object.
 */
async function handlePopstate(event) {
    closeAllPopupsUI(); // Pêşî hemû popupan bigire
    const popState = event.state;
    currentHistoryState = popState; // Rewşa niha nûve bike

    if (popState) {
        if (popState.type === 'page') {
             let pageTitle = popState.title;
             // Ger ew rûpela jêr-kategoriyê be û sernav tune be, ji nû ve bistîne
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                  try {
                       const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                       const subCatSnap = await getDoc(subCatRef);
                       if (subCatSnap.exists()) {
                            const subCat = subCatSnap.data();
                            pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                       }
                  } catch(e) { console.error("Could not refetch title on popstate", e) }
             }
            showPage(popState.id, pageTitle);
            // Ger vegere rûpela sereke, dibe ku filter hebe
            if (popState.id === 'mainPage') {
                await applyFilterState(popState, true); // Rewşa filterê ji popstate bicîh bike
            } else if (popState.id === 'subcategoryDetailPage' && features.showSubcategoryDetailPageFromHistory) {
                 // Bawer bike ku fonksiyona features heye berî bangkirinê
                 await features.showSubcategoryDetailPageFromHistory(popState.mainCatId, popState.subCatId);
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Popupa ku di state de hatiye tomarkirin ji nû ve veke (divê UI nûve bike)
            openPopup(popState.id, popState.type);
        } else {
            // Rewşa filterê ya rûpela sereke
            showPage('mainPage');
            await applyFilterState(popState, true);
        }
    } else {
        // Rewşa destpêkê (dibe ku bikarhêner URL guhertibe)
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        await applyFilterState(defaultState);
        currentHistoryState = defaultState; // Rewşa destpêkê tomar bike
    }
}


/**
 * Navîgasyona çalak di navbara jêrîn de nûve dike.
 * @param {string} activeBtnId - ID ya butona ku were çalak kirin.
 */
function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * Barkirina destpêkê ya rûpelê birêve dibe li gorî URL.
 */
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    let initialState = null;
    let initialPageId = 'mainPage';
    let initialPageTitle = '';

    if (hash.startsWith('subcategory_')) {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        initialPageId = 'subcategoryDetailPage';
        // Sernav dê paşê were barkirin dema ku data tê
        initialState = { type: 'page', id: initialPageId, mainCatId: mainCatId, subCatId: subCatId, title: '' };
        // Ger were barkirin, fonksiyona features dê were bangkirin
        if (features.showSubcategoryDetailPageFromHistory) {
            features.showSubcategoryDetailPageFromHistory(mainCatId, subCatId); // Use specific function
        }
    } else if (hash === 'settingsPage') {
        initialPageId = 'settingsPage';
        initialPageTitle = t('settings_title');
        initialState = { type: 'page', id: initialPageId, title: initialPageTitle };
        showPage(initialPageId, initialPageTitle); // Rûpelê rasterast nîşan bide
    } else {
        // Rûpela sereke bi filterên gengaz
        const filterState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Scrolla destpêkê her gav sifir e
        };
        initialState = filterState; // Rewşa destpêkê filter e
        showPage('mainPage'); // Rûpela sereke nîşan bide
        applyFilterState(filterState); // Filteran bicîh bike
    }

    // Rewşa destpêkê di history de tomar bike
    history.replaceState(initialState, '', window.location.href);
    currentHistoryState = initialState; // Rewşa destpêkê bişopîne

    // Popupa destpêkê veke ger hebe (piştî ku rûpela sereke hatiye nîşandan)
    if (initialPageId === 'mainPage' && hash) {
        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                // Bi derengiyek biçûk veke da ku piştrast bibe ku page transition qediya ye
                setTimeout(() => openPopup(hash, isSheet ? 'sheet' : 'modal'), 100);
            }
        }
    }

     // Heger parametera product hebe, detayan nîşan bide (piştî ku data hatiye barkirin)
     const productId = params.get('product');
     if (productId && features.showProductDetailsById) {
          // Bi derengî bang bike da ku piştrast bibe ku products hatine barkirin
          setTimeout(() => features.showProductDetailsById(productId), 500);
     }
}


// === Initialization ===

/**
 * Mantiqê bingehîn ê sepanê dest pê dike piştî ku persistence hatiye sazkirin.
 */
function initializeAppLogic() {
    // State û UIya bingehîn saz bike
    setLanguage(state.currentLanguage); // Zimanê destpêkê saz bike
    setupEventListeners(); // Guhdarên eventan saz bike
    setupServiceWorker(); // Service Worker saz bike

    // Guhdarî bike ji bo guhertinên authentication
    onAuthStateChanged(auth, async (user) => {
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // UIDya Admin li vir danê
        const isAdmin = user && user.uid === adminUID;

        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false'); // Rewşa admin tomar bike
        updateAdminSpecificUI(isAdmin); // UIya admin nûve bike

        if (user && !isAdmin) {
            // Ger bikarhênerek ne-admin login bibe, log out bike
             await signOut(auth);
             console.log("Non-admin user signed out.");
        }
    });


    // Guhdarî bike ji bo peyamên notificationê yên foreground
    onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        if (features.showNotification) features.showNotification(`${title}: ${body}`);
        // Badge nûve bike (ev dibe ku di features de be)
         const notificationBadge = document.getElementById('notificationBadge');
         if(notificationBadge) notificationBadge.style.display = 'block';
    });

    // Barkirina datayên bingehîn (categories) - Ev dê handleInitialPageLoad jî trigger bike
    if (features.loadInitialData) {
        features.loadInitialData().then(() => {
             // Barkirina destpêkê ya rûpelê piştî ku categories hatin barkirin
             handleInitialPageLoad();
             // Barkirina yên din ên ku girêdayî categories nînin
             if(features.renderContactLinks) features.renderContactLinks();
             if(features.checkNewAnnouncements) features.checkNewAnnouncements();
             if(features.showWelcomeMessage) features.showWelcomeMessage(); // Peyama bi xêr hatinê
        }).catch(error => {
            console.error("Error loading initial data:", error);
            // Hîn jî hewl bide ku UIya bingehîn nîşan bide
            handleInitialPageLoad();
        });
    } else {
         console.error("features.loadInitialData is not defined!");
         // Hewl bide ku UIya bingehîn bêyî data nîşan bide
         handleInitialPageLoad();
    }
}

/**
 * Destpêkirina giştî ya sepanê.
 */
function init() {
    console.log("App initializing...");
    // Hewl bide ku offline persistence çalak bike
    enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.warn("Firestore offline persistence failed:", err))
        .finally(() => {
            // Mantiqê sepanê dest pê bike çi persistence çalak bû an na
            initializeAppLogic();
        });
}

// === Event Listeners for PWA ===
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex';
    console.log('`beforeinstallprompt` event fired.');
});

// === Start Application ===
document.addEventListener('DOMContentLoaded', init);

// === Export functions needed by admin.js ===
// Export tiştên ku admin.js rasterast hewce dike (ji bilî yên ku di features de ne)
export { t, openPopup, closeCurrentPopup, showPage, debounce };