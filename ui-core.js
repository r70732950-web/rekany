// ui-core.js
// Logika giştî ya UI, girêdana bûyeran, û rêveberiya navbeynkariyê

import {
    // DOM Elements needed for general UI management & event listeners
    loginModal, addProductBtn, productFormModal, searchInput, clearSearchBtn,
    loginForm, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn,
    cartBtn, categoriesBtn, sheetOverlay, contactToggle, notificationBtn,
    notificationBadge, termsAndPoliciesBtn,
    // Admin elements needed for visibility toggling
    adminPoliciesManagement, adminSocialMediaManagement, adminAnnouncementManagement,
    adminPromoCardsManagement, adminBrandsManagement, adminCategoryManagement,
    adminContactMethodsManagement, adminShortcutRowsManagement, adminHomeLayoutManagement,
} from './app-setup.js';

import {
    // Core state and logic functions
    state, t, debounce,
    handleLogin, handleLogout, saveProfileCore, setLanguageCore,
    requestNotificationPermissionCore, checkNewAnnouncementsCore,
    handleInstallPrompt, forceUpdateCore, saveCurrentScrollPositionCore,
    applyFilterStateCore, navigateToFilterCore, initCore,
    fetchContactMethods, // Needed for renderContactLinksUI
    // Firestore needed for renderContactLinksUI and popstate title fetch
    db, collection, query, orderBy, getDocs, doc, getDoc, signOut // signOut needed for logout button
} from './app-core.js';

import {
    // Import rendering functions from ui-render.js
    renderCartUI, renderFavoritesPageUI, renderCategoriesSheetUI,
    renderUserNotificationsUI, renderPoliciesUI, renderCartActionButtonsUI,
    showProductDetailsUI, // Needed for direct product link loading
    showSubcategoryDetailPageUI, // Needed for direct subcategory link loading
    renderProductsOnDetailPageUI // Needed for subpage search
} from './ui-render.js';

import {
    // Import functions needed from home.js
    updateProductViewUI, renderMainCategoriesUI, renderSubcategoriesUI, // For language change & navigation
    renderHomePageContentUI // For language change potentially
} from './home.js';

// --- Exported UI Helper Functions ---

export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}
// Make globally available if needed by admin.js indirectly via globalAdminTools
if(window.globalAdminTools) window.globalAdminTools.showNotification = showNotification;


export function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

export function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId === 'settingsPage') {
         updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
         updateHeaderView('subcategoryDetailPage', pageTitle);
    } else { // Includes mainPage
         updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
}
// Make globally available if needed? (Less likely)
// window.showPage = showPage;

// === START: KODA GUHERTÎ JI BO ÇARESERKIRINA LEQETA SCROLL v3 ===
export function closeAllPopupsUI() {
    const wasOpen = document.body.classList.contains('overlay-active'); // Kontrol bike ka popupek vekirî bû
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active'); // PÊŞÎ klasê jê bibe

    // PAŞAN, scrollê vegere eger popupek vekirî bû
    if (wasOpen) {
        setTimeout(() => {
            window.scrollTo({ top: window.lastScrollPositionBeforePopup || 0, behavior: 'instant' });
            console.log("Scroll restored by closeAllPopupsUI to:", window.lastScrollPositionBeforePopup);
        }, 0); // Demeke pir kurt bes e ji bo ku gerok layoutê ji nû ve hesab bike
    }
}

export function openPopup(id, type = 'sheet') {
    // Scrollê TOMAR BIKE berî guhertina UI
    window.lastScrollPositionBeforePopup = window.scrollY;
    console.log("Scroll saved before opening popup:", window.lastScrollPositionBeforePopup);

    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Pêşî hemû popupên din bigire

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Trigger rendering content specifically for the opened sheet (uses functions from ui-render.js)
        if (id === 'cartSheet') renderCartUI();
        if (id === 'favoritesSheet') renderFavoritesPageUI();
        if (id === 'categoriesSheet') renderCategoriesSheetUI();
        if (id === 'notificationsSheet') renderUserNotificationsUI();
        if (id === 'termsSheet') renderPoliciesUI();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
        // Note: Product detail sheet content is usually rendered *before* calling openPopup
    } else { // type === 'modal'
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Klasê ZÊDE bike piştî tomarkirina scrollê

    // Push state ONLY if it's not already the current state (prevents duplicate entries)
    if (!history.state || history.state.id !== id) {
        history.pushState({ type: type, id: id }, '', `#${id}`);
    }
}
// === DAWÎYA KODA GUHERTÎ ===

// Make globally available if needed by admin.js
if(window.globalAdminTools) window.globalAdminTools.openPopup = openPopup;


export function closeCurrentPopup() {
    // Check if the current history state corresponds to a popup
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        // Go back in history, which triggers the popstate listener to close the UI
        history.back();
    } else {
        // If history state is not a popup, directly close UI elements (fallback)
        closeAllPopupsUI();
    }
}
// Make globally available if needed by admin.js
if(window.globalAdminTools) window.globalAdminTools.closeCurrentPopup = closeCurrentPopup;


export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

export function updateCartCountUI() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

// --- UI Event Handlers (General Interaction) ---

async function handleSetLanguage(lang) {
    setLanguageCore(lang); // Update core state and localStorage

    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if(element.placeholder) element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render dynamic content (uses functions from ui-render.js and home.js)
    renderCategoriesSheetUI();
    if (document.getElementById('cartSheet')?.classList.contains('show')) renderCartUI();
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPageUI();
    await updateProductViewUI(true); // Re-render main view (home or products)
    await renderContactLinksUI(); // Re-render contact links (uses function from this file)

    // Re-render admin lists if admin is active
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.renderAdminAnnouncementsList?.();
        window.AdminLogic.renderSocialMediaLinks?.();
        window.AdminLogic.renderContactMethodsAdmin?.();
        window.AdminLogic.renderCategoryManagementUI?.();
        window.AdminLogic.renderPromoGroupsAdminList?.();
        window.AdminLogic.renderBrandGroupsAdminList?.();
        window.AdminLogic.renderShortcutRowsAdminList?.();
        window.AdminLogic.renderHomeLayoutAdmin?.();
    }
}

// Renders dynamic contact links in settings (Specific render kept here as it's small)
async function renderContactLinksUI() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    try {
        const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        contactLinksContainer.innerHTML = '';

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank';
            linkElement.className = 'settings-item';
            linkElement.innerHTML = `
                 <div>
                     <i class="${link.icon}" style="margin-left: 10px;"></i>
                     <span>${name}</span>
                 </div>
                 <i class="fas fa-external-link-alt"></i>
            `;
            contactLinksContainer.appendChild(linkElement);
        });
    } catch (error) {
        console.error("Error fetching/rendering social links:", error);
        contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هەڵە لە بارکردنی لینکەکان.</p>';
    }
}

// Sets up GPS button functionality in profile (Specific setup kept here)
function setupGpsButtonUI() {
     const getLocationBtn = document.getElementById('getLocationBtn');
     const profileAddressInput = document.getElementById('profileAddress');
     if (!getLocationBtn || !profileAddressInput) return;
     const btnSpan = getLocationBtn.querySelector('span');
     const originalBtnText = btnSpan ? btnSpan.textContent : 'وەرگرتنی ناونیشانم بە GPS';

     getLocationBtn.addEventListener('click', () => {
         if (!('geolocation' in navigator)) {
             showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error'); return;
         }
         if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
         getLocationBtn.disabled = true;

         navigator.geolocation.getCurrentPosition(
             async (position) => { // Success
                 const { latitude, longitude } = position.coords;
                 try {
                     const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`;
                     const response = await fetch(apiUrl);
                     if (!response.ok) {
                         throw new Error(`HTTP error! status: ${response.status}`);
                     }
                     const data = await response.json();
                     if (data && data.display_name) {
                         profileAddressInput.value = data.display_name;
                         showNotification('ناونیشان وەرگیرا', 'success');
                     } else { showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error'); }
                 } catch (error) {
                     console.error('Reverse Geocoding Error:', error);
                     showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
                 } finally {
                     if(btnSpan) btnSpan.textContent = originalBtnText;
                     getLocationBtn.disabled = false;
                 }
             },
             (error) => { // Error
                 let message = t('error_generic');
                 switch (error.code) {
                     case 1: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                     case 2: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                     case 3: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                 }
                 showNotification(message, 'error');
                 if(btnSpan) btnSpan.textContent = originalBtnText;
                 getLocationBtn.disabled = false;
             }
         );
     });
}

// Updates visibility of admin elements based on auth state
export function updateAdminUIAuth(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    const adminSections = [
        'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
        'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
        'adminContactMethodsManagement', 'adminShortcutRowsManagement',
        'adminHomeLayoutManagement'
    ];
    adminSections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = isAdmin ? 'block' : 'none';
    });
    settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
    settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
    addProductBtn.style.display = isAdmin ? 'flex' : 'none';

    // Rerender potentially open elements to show/hide admin controls within them
    const favoritesSheet = document.getElementById('favoritesSheet');
    if (favoritesSheet?.classList.contains('show')) {
        renderFavoritesPageUI(); // From ui-render.js
    }
    // Note: Detail sheet product card re-render would require re-calling showProductDetailsUI
    // Main product grid re-render is handled by updateProductViewUI in home.js when needed
}


// --- Setup Functions ---

function setupUIEventListeners() {
    homeBtn.onclick = async () => {
        if (!mainPage.classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage'); // Use function from this file
        }
        // Reset filters *before* rendering
        await navigateToFilterCore({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        await updateProductViewUI(true); // From home.js
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title')); // Use function from this file
    };

    document.getElementById('headerBackBtn').onclick = () => { history.back(); };

    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); }; // Use functions from this file
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); }; // Use functions from this file
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); }; // Use functions from this file
    settingsFavoritesBtn.onclick = () => { openPopup('favoritesSheet'); }; // Use function from this file
    settingsAdminLoginBtn.onclick = () => { openPopup('loginModal', 'modal'); }; // Use function from this file
    notificationBtn.addEventListener('click', () => { openPopup('notificationsSheet'); }); // Use function from this file
    termsAndPoliciesBtn?.addEventListener('click', () => { openPopup('termsSheet'); }); // Use function from this file

    sheetOverlay.onclick = closeCurrentPopup; // Use function from this file
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup); // Use function from this file
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); }; // Use function from this file

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await handleLogin(document.getElementById('email').value, document.getElementById('password').value);
            // Auth listener handles UI update + admin init
            closeCurrentPopup(); // Use function from this file
        } catch (error) {
            showNotification(error.message, 'error'); // Use function from this file
        }
    };

    // Main Search (Home Page)
    const debouncedSearch = debounce(async (term) => {
        await navigateToFilterCore({ search: term });
        await updateProductViewUI(true); // From home.js
    }, 500);
    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };
    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        debouncedSearch('');
    };

    // Subpage Search (Detail Page)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            await renderProductsOnDetailPageUI(subCatId, subSubCatId, term); // from ui-render.js
        }
    }, 500);
    subpageSearchInput.oninput = () => {
        const searchTerm = subpageSearchInput.value;
        subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSubpageSearch(searchTerm);
    };
    subpageClearSearchBtn.onclick = () => {
        subpageSearchInput.value = '';
        subpageClearSearchBtn.style.display = 'none';
        debouncedSubpageSearch('');
    };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        const profileData = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        const message = saveProfileCore(profileData);
        showNotification(message, 'success'); // Use function from this file
        closeCurrentPopup(); // Use function from this file
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => handleSetLanguage(btn.dataset.lang); // Use function from this file
    });

    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.addEventListener('click', () => handleInstallPrompt(installBtn));

    document.getElementById('enableNotificationsBtn')?.addEventListener('click', async () => {
        const result = await requestNotificationPermissionCore();
        showNotification(result.message, result.granted ? 'success' : 'error'); // Use function from this file
    });

    document.getElementById('forceUpdateBtn')?.addEventListener('click', async () => {
        const result = await forceUpdateCore();
        if (result.success) {
            showNotification(result.message, 'success'); // Use function from this file
            setTimeout(() => window.location.reload(true), 1500);
        } else if (result.message !== 'Update cancelled.') {
            showNotification(result.message, 'error'); // Use function from this file
        }
    });

    // --- Infinite Scroll ---
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const loader = document.getElementById('loader'); // Assuming loader is in setup
    if (scrollTrigger && loader) {
        const observer = new IntersectionObserver(async (entries) => {
            const isMainPageActive = mainPage?.classList.contains('page-active');
            const homeSectionsHidden = document.getElementById('homePageSectionsContainer')?.style.display === 'none';

            // Load more ONLY if on main page, home sections are hidden (meaning product grid is visible),
            // and not already loading or finished loading
            if (entries[0].isIntersecting && isMainPageActive && homeSectionsHidden && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                loader.style.display = 'block';
                await updateProductViewUI(false); // Call from home.js to fetch and append
                loader.style.display = 'none';
                scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
            }
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    }

    // --- Custom Event Listeners (from app-core) ---
    document.addEventListener('authChange', (e) => {
        updateAdminUIAuth(e.detail.isAdmin); // Use function from this file
        if (e.detail.isAdmin && loginModal.style.display === 'block') {
            closeCurrentPopup(); // Use function from this file
        }
    });

    document.addEventListener('fcmMessage', (e) => {
        const payload = e.detail;
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success'); // Use function from this file
        notificationBadge.style.display = 'block';
    });

    document.addEventListener('installPromptReady', () => {
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.style.display = 'flex';
    });

    document.addEventListener('swUpdateReady', (e) => {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');
        updateNotification.classList.add('show');
        updateNowBtn.onclick = () => {
             e.detail.registration?.waiting?.postMessage({ action: 'skipWaiting' });
        };
    });

    document.addEventListener('clearCacheTriggerRender', async () => {
        console.log("UI received clearCacheTriggerRender event.");
        // Force a full re-render of the current view, whatever it is
        await updateProductViewUI(true);
    });

    // GPS Button Setup
    setupGpsButtonUI(); // Use function from this file
}

// === KODA GUHERTÎ: Popstate Listener ji bo Çareserkirina Leqeta Scroll v3 ===
window.addEventListener('popstate', async (event) => {
    // closeAllPopupsUI() dê scrollê vegere eger pêwîst be
    closeAllPopupsUI();

    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            // Logika navigasyonê ya rûpelan wekî xwe dimîne
            let pageTitle = popState.title;
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                try {
                    const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    const subCatSnap = await getDoc(subCatRef);
                    if (subCatSnap.exists()) {
                        const subCat = subCatSnap.data();
                        pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                        history.replaceState({ ...popState, title: pageTitle }, '', window.location.href);
                    }
                } catch(e) { console.error("Could not refetch title on popstate", e) }
            }
            showPage(popState.id, pageTitle); // Rûpela armanc nîşan bide

            // Naveroka rûpela hûrguliyan ji nû ve render bike eger vedigere wê
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true);
            }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Ger vedigere statekê ku divê popupek vekirî be (ji bo nimûne, lînka rasterast), wê veke.
            // Lêbelê, ev ê di pir rewşan de ne hewce be ji ber ku gava em `history.back()` dikin, stateya berê nayê hilanîn.
            // openPopup(popState.id, popState.type);
        } else { // State filterê ji bo rûpela sereke (bi îhtîmal ev state ye ku em vedigerinê)
            showPage('mainPage'); // Piştrast bike ku rûpela sereke xuya ye
            applyFilterStateCore(popState); // Logika state bicîh bîne
            await updateProductViewUI(true); // Berheman ji nû ve render bike

            // Em nema hewce ne ku scrollê li vir vegerînin ji ber ku closeAllPopupsUI() wê dike
            // Lêbelê, em dikarin scrollê vegerînin eger di navbera filterên rûpela sereke de digere (ne ji popupekê)
            if (typeof popState.scroll === 'number' && !document.body.classList.contains('overlay-active')) { // Kontrol bike overlay çalak e an na
                setTimeout(() => window.scrollTo({ top: popState.scroll, behavior: 'auto' }), 50);
            }
        }
    } else { // No state, vegere rûpela sereke ya default
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterStateCore(defaultState);
        await updateProductViewUI(true);
        window.scrollTo({ top: 0, behavior: 'instant' }); // Ji bo barkirina default scroll bike jor
    }
});
// === DAWÎYA KODA GUHERTÎ ===


// Handles initial page load based on URL after core logic is ready
async function handleInitialPageLoadUI() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const isSettings = hash === 'settingsPage';
    const isSubcategoryDetail = hash.startsWith('subcategory_');

    if (isSettings) {
        history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
        showPage('settingsPage', t('settings_title'));
    } else if (isSubcategoryDetail) {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        if (state.categories.length > 1) { // Check if categories are loaded
            let subCatName = 'Details';
            try {
                const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
                const subCatSnap = await getDoc(subCatRef);
                if (subCatSnap.exists()) {
                    const subCat = subCatSnap.data();
                    subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                }
            } catch (e) { console.error("Could not fetch subcategory name for initial load:", e); }
            history.replaceState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
            await showSubcategoryDetailPageUI(mainCatId, subCatId, true); // from ui-render.js
        } else {
            console.warn("Categories not ready, showing main page.");
            showPage('mainPage');
            await updateProductViewUI(true);
        }
    } else { // Default to main page
        showPage('mainPage');
        const initialState = { category: params.get('category') || 'all', subcategory: params.get('subcategory') || 'all', subSubcategory: params.get('subSubcategory') || 'all', search: params.get('search') || '', scroll: 0 };
        history.replaceState(initialState, '', `?${params.toString()}`);
        applyFilterStateCore(initialState);
        await updateProductViewUI(true);

        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                await new Promise(resolve => setTimeout(resolve, 50));
                openPopup(hash, isSheet ? 'sheet' : 'modal');
            }
        }

        const productId = params.get('product');
        if (productId) {
            const product = await fetchProductById(productId); // from app-core.js
            if (product) {
                await new Promise(resolve => setTimeout(resolve, 50));
                showProductDetailsUI(product); // from ui-render.js
            }
        }
    }
}

// Initializes the entire UI layer after DOM is ready
async function initializeUI() {
    await initCore(); // Wait for core logic (persistence, initial fetches like categories)

    // Apply initial language to static elements
    handleSetLanguage(state.currentLanguage); // Call local function to apply static text

    // Render initial dynamic UI elements NOT handled by home.js (e.g., sheets)
    renderCategoriesSheetUI(); // From ui-render.js

    // Setup general UI event listeners
    setupUIEventListeners(); // From this file

    // Handle initial page view based on URL (hash/query params)
    handleInitialPageLoadUI(); // From this file (calls rendering functions)

    // Render dynamic contact links
    renderContactLinksUI(); // From this file

    // Check for new notifications
    const announcements = await fetchAnnouncements(); // From app-core.js
     if(announcements.length > 0 && checkNewAnnouncementsCore(announcements[0].createdAt)) { // From app-core.js
         notificationBadge.style.display = 'block';
     }

    // Show welcome message only on first visit
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal'); // From this file
        localStorage.setItem('hasVisited', 'true');
    }
}

// --- Start UI Initialization ---
document.addEventListener('DOMContentLoaded', initializeUI);

// Make functions needed by other modules globally accessible (alternative to complex exports/imports)
window.showPage = showPage;
window.openPopup = openPopup;
window.closeCurrentPopup = closeCurrentPopup;
window.updateCartCountUI = updateCartCountUI;
window.showNotification = showNotification;
// These are needed by renderCategoriesSheetUI in ui-render.js
window.navigateToFilterCore = navigateToFilterCore; // From app-core
window.updateProductViewUI = updateProductViewUI; // From home.js

