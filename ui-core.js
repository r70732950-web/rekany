// ui-core.js
// Logika giştî ya UI, girêdana bûyeran, û rêveberiya navbeynkariyê - WITH DEBUG LOGS

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
    // Firestore needed for renderContactLinksUI
    db, collection, query, orderBy, getDocs, doc, getDoc, signOut // signOut needed for logout button
} from './app-core.js';

import {
    // Import rendering functions from ui-render.js
    renderCartUI, renderFavoritesPageUI, renderCategoriesSheetUI,
    renderUserNotificationsUI, renderPoliciesUI, renderCartActionButtonsUI,
    showProductDetailsUI, // Needed for direct product link loading
    showSubcategoryDetailPageUI // Needed for direct subcategory link loading
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
    console.log(`[showPage] Called for pageId: ${pageId}, title: ${pageTitle}`); // Debug log
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

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

export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPositionCore();
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();

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
    } else { // type === 'modal'
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');

    history.pushState({ type: type, id: id }, '', `#${id}`);
}
// Make globally available if needed by admin.js
if(window.globalAdminTools) window.globalAdminTools.openPopup = openPopup;


export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
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
                     const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
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
        console.log("[homeBtn.onclick] Clicked."); // Debug log
        if (!mainPage.classList.contains('page-active')) {
             console.log("[homeBtn.onclick] Main page not active, showing it."); // Debug log
             // Check if current state is already home, if so, replace instead of push
             if (history.state && history.state.type === 'page' && history.state.id === 'mainPage') {
                 history.replaceState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
             } else {
                 history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
             }
             showPage('mainPage'); // Use function from this file
        } else {
            console.log("[homeBtn.onclick] Main page already active."); // Debug log
        }
        // Always reset filters when home button is explicitly clicked
        console.log("[homeBtn.onclick] Resetting filters via navigateToFilterCore."); // Debug log
        await navigateToFilterCore({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        console.log("[homeBtn.onclick] Calling updateProductViewUI(true)."); // Debug log
        await updateProductViewUI(true); // From home.js (Force refresh)
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title')); // Use function from this file
    };

    document.getElementById('headerBackBtn').onclick = () => {
         console.log("[headerBackBtn.onclick] Going back."); // Debug log
         history.back();
    };

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
            // Need renderProductsOnDetailPageUI from ui-render.js
            // Assuming it's globally available or imported via ui-render.js
            if (typeof renderProductsOnDetailPageUI === 'function') { // Check if function exists
                await renderProductsOnDetailPageUI(subCatId, subSubCatId, term);
            } else {
                 console.error("renderProductsOnDetailPageUI not imported correctly from ui-render.js");
            }
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

            if (entries[0].isIntersecting && isMainPageActive && homeSectionsHidden && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                console.log("[InfiniteScroll] Triggered."); // Debug log
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
        console.log("[clearCacheTriggerRender] Event received. Checking if home view needs update."); // Debug log
        if (state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all' && !state.currentSearch) {
             console.log("[clearCacheTriggerRender] Home view detected, calling updateProductViewUI(true)."); // Debug log
             await updateProductViewUI(true); // Re-render home view (from home.js)
        } else {
            console.log("[clearCacheTriggerRender] Not home view, update skipped."); // Debug log
        }
    });

    // GPS Button Setup
    setupGpsButtonUI(); // Use function from this file
}

// Popstate listener for handling back/forward navigation
window.addEventListener('popstate', async (event) => {
    console.log("[Popstate] Event triggered. History state:", event.state); // Debug log
    closeAllPopupsUI(); // Close any open popups
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
             console.log(`[Popstate] Navigating to page: ${popState.id}`); // Debug log
            let pageTitle = popState.title;
            // Refetch title for detail page if needed
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
            showPage(popState.id, pageTitle); // Show target page (from this file)

            // Re-render detail page content if navigating back to it
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                console.log(`[Popstate] Re-rendering subcategory detail page: ${popState.subCatId}`); // Debug log
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true); // From ui-render.js
            }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             console.log(`[Popstate] Re-opening popup: ${popState.id}`); // Debug log
            openPopup(popState.id, popState.type); // Re-open popup (from this file)
        } else { // Filter state for main page
             console.log("[Popstate] Applying filter state for main page:", popState); // Debug log
            showPage('mainPage'); // Ensure main page visible (from this file)
            applyFilterStateCore(popState); // Apply state logic
            console.log("[Popstate] Calling updateProductViewUI(true) for main page filter state."); // Debug log
            await updateProductViewUI(true); // Re-render products (from home.js)
            if (typeof popState.scroll === 'number') {
                setTimeout(() => window.scrollTo(0, popState.scroll), 50);
            }
        }
    } else { // No state, default to main page
        console.log("[Popstate] No state found, defaulting to main page."); // Debug log
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage'); // From this file
        applyFilterStateCore(defaultState);
        console.log("[Popstate] Calling updateProductViewUI(true) for default main page state."); // Debug log
        await updateProductViewUI(true); // From home.js
    }
});

// Handles initial page load based on URL after core logic is ready
async function handleInitialPageLoadUI() {
    console.log("[handleInitialPageLoadUI] Starting initial load check."); // Debug log
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const isSettings = hash === 'settingsPage';
    const isSubcategoryDetail = hash.startsWith('subcategory_');

    if (isSettings) {
        console.log("[handleInitialPageLoadUI] Loading settings page."); // Debug log
        history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
        showPage('settingsPage', t('settings_title')); // From this file
    } else if (isSubcategoryDetail) {
        console.log("[handleInitialPageLoadUI] Loading subcategory detail page."); // Debug log
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        if (state.categories.length > 1) { // Check if categories are loaded
            await showSubcategoryDetailPageUI(mainCatId, subCatId, true); // From ui-render.js
        } else {
            console.warn("[handleInitialPageLoadUI] Categories not ready for subcategory page, showing main page."); // Debug log
            showPage('mainPage'); // From this file
            await updateProductViewUI(true); // From home.js
        }
    } else { // Default to main page
        console.log("[handleInitialPageLoadUI] Loading main page (default)."); // Debug log
        showPage('mainPage'); // From this file
        const initialState = { category: params.get('category') || 'all', subcategory: params.get('subcategory') || 'all', subSubcategory: params.get('subSubcategory') || 'all', search: params.get('search') || '', scroll: 0 };
        console.log("[handleInitialPageLoadUI] Initial filter state:", initialState); // Debug log
        history.replaceState(initialState, '');
        applyFilterStateCore(initialState);
        console.log("[handleInitialPageLoadUI] Calling updateProductViewUI(true) for initial main page load."); // Debug log
        await updateProductViewUI(true); // From home.js

        const element = document.getElementById(hash);
        if (element) { // Check if hash corresponds to a popup
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                 console.log(`[handleInitialPageLoadUI] Opening initial popup: ${hash}`); // Debug log
                 openPopup(hash, isSheet ? 'sheet' : 'modal'); // From this file
            }
        }

        const productId = params.get('product'); // Check for direct product link
        if (productId) {
            console.log(`[handleInitialPageLoadUI] Found product ID in URL: ${productId}. Fetching...`); // Debug log
            const product = await fetchProductById(productId);
            if (product) {
                 console.log(`[handleInitialPageLoadUI] Product found, showing details.`); // Debug log
                 setTimeout(() => showProductDetailsUI(product), 300); // From ui-render.js
            } else {
                console.warn(`[handleInitialPageLoadUI] Product ${productId} not found.`); // Debug log
            }
        }
    }
     console.log("[handleInitialPageLoadUI] Finished initial load check."); // Debug log
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
    const announcements = await fetchAnnouncements();
     if(announcements.length > 0 && checkNewAnnouncementsCore(announcements[0].createdAt)) {
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
window.navigateToFilterCore = navigateToFilterCore; // From app-core, needed by category sheet render
window.updateProductViewUI = updateProductViewUI; // From home.js, needed by category sheet render
// Make renderProductsOnDetailPageUI globally accessible if needed by subpage search in this file
// window.renderProductsOnDetailPageUI = renderProductsOnDetailPageUI; // Assuming it's defined in ui-render.js and imported
