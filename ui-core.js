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
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // *** KODA ÇAKKIRÎ: Skrola ji bo rûpelên din neşîne serî ***
    // if (pageId !== 'mainPage') {
    // 	window.scrollTo(0, 0);
    // }

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
    // *** KODA ÇAKKIRÎ: Dema ku popup vedibe, skrolê tomarkirî hilîne ***
    // saveCurrentScrollPositionCore(); // Ev êdî ne pêwîst e ji ber ku skrol bi domdarî tê tomarkirin

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
    // *** KODA ÇAKKIRÎ: homeBtn.onclick ***
    homeBtn.onclick = async () => {
    	const isAlreadyHome = mainPage.classList.contains('page-active');
    	const isHomeFilter = state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all' && !state.currentSearch;

    	if (isAlreadyHome && isHomeFilter) {
    		// Jixwe li ser rûpela serekî ye û fîlter tune, tenê skrol bike jor
    		console.log("Already on home, scrolling top.");
    		window.scrollTo({ top: 0, behavior: 'smooth' });
    	} else {
    		// Ne li ser rûpela serekî ye an fîlter çalak e, navîgasyon bike û nûve bike
    		console.log("Navigating to home filter.");
    		// Pêşî rewşa dîrokê biguherîne
    		history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
    		// Paşê rûpelê nîşan bide
    		showPage('mainPage'); // Fonksiyona ji vê pelê bikar bîne
    		// Paşê logîka navîgasyonê ya bingehîn bikar bîne
    		await navigateToFilterCore({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    		// Di dawiyê de dîmenê nûve bike (ev dê kaşê bikar bîne û skrolê sererast bike)
    		await updateProductViewUI(true); // Ji home.js
    	}
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
            // Need renderProductsOnDetailPageUI from ui-render.js
            // Assuming it's globally available or imported in calling context
            if (typeof window.renderProductsOnDetailPageUI === 'function') {
            	await window.renderProductsOnDetailPageUI(subCatId, subSubCatId, term);
            } else {
            	console.error("renderProductsOnDetailPageUI not found globally.");
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
        	// Têbînî: Barkirina bêtir tenê divê hebe gava ku rûpela serekî çalak be
        	// Û gava ku beşên serekî neyên nîşandan (ango rûpelek fîlterkirî ye)
        	const isMainPageActive = mainPage?.classList.contains('page-active');
        	const homeSectionsHidden = document.getElementById('homePageSectionsContainer')?.style.display === 'none';

        	if (entries[0].isIntersecting && isMainPageActive && homeSectionsHidden && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
        		console.log("Triggering infinite scroll...");
        		loader.style.display = 'block';
        		await updateProductViewUI(false); // Call from home.js to fetch and append
        		loader.style.display = 'none';
        		scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        	}
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    } else {
    	console.warn("Infinite scroll trigger or loader not found.");
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
        // Trigger full re-render regardless of current category
    	await updateProductViewUI(true); // Re-render view (from home.js)
    });

    // GPS Button Setup
    setupGpsButtonUI(); // Use function from this file
}

// *** KODA ÇAKKIRÎ: Popstate listener ***
window.addEventListener('popstate', async (event) => {
    console.log("Popstate event fired:", event.state);
    closeAllPopupsUI(); // Pêşî hemî popupan bigire

    const popState = event.state || {}; // Ger state tune be, objectek vala bikar bîne

    // Ger em vedigerin rûpelekê (ne popup)
    if (!popState.type || popState.type === 'page') {
    	let targetPageId = popState.id || 'mainPage';
    	let pageTitle = popState.title || '';

    	// Rewşa fîlterê ya armanc (target filter state) destnîşan bike
    	// Ger vedigere rûpela serekî (home), fîlterên 'all' bikar bîne
    	// Ger vedigere rûpelek fîlterkirî (ji dîrokê), fîlterên tomarkirî bikar bîne
    	const targetFilterState = targetPageId === 'mainPage'
    		? { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' }
    		: { category: popState.category, subcategory: popState.subcategory, subSubcategory: popState.subSubcategory, search: popState.search };

    	// Rewşa fîlterê ya core nûve bike
    	applyFilterStateCore(targetFilterState);

    	// Ger vedigere rûpela detail ya subcategory
    	if (targetPageId === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
    		await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true); // true = ji dîrokê
    	}
    	// Ger vedigere rûpela settings
    	else if (targetPageId === 'settingsPage') {
    		showPage('settingsPage', t('settings_title'));
    	}
    	// Ger vedigere rûpela serekî (home) an rûpelek fîlterkirî
    	else {
    		showPage('mainPage'); // Her gav rûpela serekî ya HTML nîşan bide
    		// UI nûve bike. Ev dê kaşê kontrol bike û skrolê sererast bike.
    		await updateProductViewUI(true); // true = lêgerînek/navîgasyonek nû
    	}

    }
    // Têbînî: Ger popState.type 'sheet' an 'modal' be, em tiştek nakin ji ber ku closeAllPopupsUI() jixwe ew girtine.
});


// Handles initial page load based on URL after core logic is ready
async function handleInitialPageLoadUI() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const isSettings = hash === 'settingsPage';
    const isSubcategoryDetail = hash.startsWith('subcategory_');

    if (isSettings) {
    	history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
    	showPage('settingsPage', t('settings_title')); // From this file
    } else if (isSubcategoryDetail) {
    	const ids = hash.split('_');
    	const mainCatId = ids[1];
    	const subCatId = ids[2];
    	if (state.categories.length > 1) { // Check if categories are loaded
    		// Ger rasterast were vê rûpelê, dîroka rast biafirîne
    		history.replaceState({ type: 'page', id: 'subcategoryDetailPage', title: '', mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
    		await showSubcategoryDetailPageUI(mainCatId, subCatId, true); // From ui-render.js (true = ji dîrokê)
    	} else {
    		console.warn("Categories not ready, showing main page.");
    		history.replaceState({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 }, '', window.location.pathname);
    		showPage('mainPage'); // From this file
    		await updateProductViewUI(true); // From home.js
    	}
    } else { // Default to main page
    	const initialState = {
    		category: params.get('category') || 'all',
    		subcategory: params.get('subcategory') || 'all',
    		subSubcategory: params.get('subSubcategory') || 'all',
    		search: params.get('search') || '',
    		scroll: 0 // Destpêkê skrol 0 ye
    	};
    	history.replaceState(initialState, '', window.location.pathname + window.location.search); // URL ya heyî biparêze
    	applyFilterStateCore(initialState);
    	showPage('mainPage'); // From this file
    	await updateProductViewUI(true); // From home.js ( dê kaşê bikar bîne ger hebe)

    	const element = document.getElementById(hash);
    	if (element) { // Check if hash corresponds to a popup
    		const isSheet = element.classList.contains('bottom-sheet');
    		const isModal = element.classList.contains('modal');
    		if (isSheet || isModal) {
    			// Dîroka rast ji bo popupê biafirîne
    			history.replaceState({ type: isSheet ? 'sheet' : 'modal', id: hash }, '', `#${hash}`);
    			openPopup(hash, isSheet ? 'sheet' : 'modal'); // From this file
    		}
    	}

    	const productId = params.get('product'); // Check for direct product link
    	if (productId) {
    		const product = await fetchProductById(productId);
    		if (product) setTimeout(() => showProductDetailsUI(product), 300); // From ui-render.js
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
    await handleInitialPageLoadUI(); // From this file (calls rendering functions) - needs await

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
// window.showPage = showPage; // Removed, internal use mostly
// window.openPopup = openPopup; // Already in globalAdminTools
// window.closeCurrentPopup = closeCurrentPopup; // Already in globalAdminTools
// window.updateCartCountUI = updateCartCountUI; // Kept for now
// window.showNotification = showNotification; // Already in globalAdminTools
// window.navigateToFilterCore = navigateToFilterCore; // Make available if needed elsewhere
// window.updateProductViewUI = updateProductViewUI; // Make available if needed elsewhere

// *** KODA NÛ: Fonksiyona `renderProductsOnDetailPageUI` ji `ui-render.js` li ser window zêde bike ***
// Ji ber ku ew di `debouncedSubpageSearch` de tê bikaranîn
import { renderProductsOnDetailPageUI } from './ui-render.js';
window.renderProductsOnDetailPageUI = renderProductsOnDetailPageUI;

