// app-ui.js
import {
    loginModal, addProductBtn, productFormModal, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, cartBtn, favoritesContainer, emptyFavoritesMessage, categoriesBtn, 
    sheetOverlay, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer,
    homePageSectionsContainer, categoryLayoutContainer,
    // ... (Other exports from setup remain valid)
} from './app-setup.js';

import {
    state, t, debounce, handleLogin, handleUserLogin, handleUserSignUp, handleUserLogout, handlePasswordReset,
    fetchProducts, fetchPolicies, fetchAnnouncements,
    saveProfileCore, setLanguageCore, requestNotificationPermissionCore, checkNewAnnouncementsCore, 
    updateLastSeenAnnouncementTimestamp, handleInstallPrompt, forceUpdateCore,
    saveCurrentScrollPositionCore, applyFilterStateCore, navigateToFilterCore, initCore,
    db, collection, doc, getDocs, query, orderBy
} from './app-core.js';

// Import from New Modules
import { renderSplitCategoriesPageUI } from './categories.js';
import { renderCartUI, updateCartCountUI } from './cart.js';
import { createProductCardElementUI, showProductDetailsUI, setupScrollAnimations, handleToggleFavoriteUI } from './products.js';
import { renderPageContentUI, updateProductViewUI, renderMainCategoriesUI, renderSubcategoriesUI } from './home.js';
import { initChatSystem, openChatPage } from './chat.js';

// --- Global UI Helpers ---

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

export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) { return; }
    container.innerHTML = ''; 
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; 
}

// --- Navigation & View Logic ---

function updateHeaderView(pageId, title = '') {
    const appHeader = document.querySelector('.app-header');
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');
    const subpageSearch = document.querySelector('.subpage-search'); 

    if (pageId === 'chatPage') {
        if (appHeader) appHeader.style.display = 'none';
        document.documentElement.classList.add('chat-active'); 
        return;
    } 
    
    if (appHeader) appHeader.style.display = 'flex';
    document.documentElement.classList.remove('chat-active');
    
    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
        const mainSearchContainer = document.querySelector('.main-header-content .search-container');
        if (mainSearchContainer) mainSearchContainer.style.display = 'block';
    } 
    else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;

        if (subpageSearch) {
            if (pageId === 'subcategoryDetailPage') {
                subpageSearch.style.display = 'block'; 
            } else {
                subpageSearch.style.display = 'none'; 
            }
        }
    }
}

export function showPage(pageId, pageTitle = '', scrollToTop = true) {
    state.currentPageId = pageId; 
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = (pageId === 'chatPage') ? 'none' : 'flex';
    }

    if (pageId !== 'mainPage' && scrollToTop) {
         requestAnimationFrame(() => { 
             const activePage = document.getElementById(pageId);
             if(activePage) activePage.scrollTo({ top: 0, behavior: 'instant' });
         });
    }

    // Update Headers based on page
    if (pageId === 'settingsPage') updateHeaderView('settingsPage', t('settings_title'));
    else if (pageId === 'subcategoryDetailPage') updateHeaderView('subcategoryDetailPage', pageTitle);
    else if (pageId === 'productDetailPage') updateHeaderView('productDetailPage', pageTitle);
    else if (pageId === 'chatPage') updateHeaderView('chatPage', pageTitle);
    else if (pageId === 'adminChatListPage') updateHeaderView('adminChatListPage', t('conversations_title'));
    else if (pageId === 'categoriesPage') updateHeaderView('categoriesPage', t('nav_categories'));
    else updateHeaderView('mainPage');

    // Update Bottom Nav Active State
    let activeBtnId = null;
    if (pageId === 'mainPage') activeBtnId = 'homeBtn';
    else if (pageId === 'settingsPage') activeBtnId = 'settingsBtn';
    else if (pageId === 'categoriesPage') activeBtnId = 'categoriesBtn';
    else if (pageId === 'chatPage' || pageId === 'adminChatListPage') activeBtnId = 'chatBtn';

    if (activeBtnId) updateActiveNav(activeBtnId);
}

function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// --- Popups (Modals & Sheets) ---

export function openPopup(id, type = 'sheet', addToHistory = true) {
    saveCurrentScrollPositionCore(); 
    const element = document.getElementById(id);
    if (!element) return;

    if (addToHistory) closeAllPopupsUI(); 
    else {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    }

    if (type === 'sheet') {
        const sheetContent = element.querySelector('.sheet-content');
        if (sheetContent) sheetContent.scrollTop = 0;

        sheetOverlay.classList.add('show');
        element.classList.add('show');
        
        // Render specific sheet content
        if (id === 'cartSheet') renderCartUI();
        if (id === 'favoritesSheet') renderFavoritesPageUI();
        if (id === 'notificationsSheet') renderUserNotificationsUI();
        if (id === 'termsSheet') renderPoliciesUI();
        if (id === 'profileSheet') updateProfileSheetUI();
    } else { 
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); 

    if (addToHistory) {
        const newState = { type: type, id: id };
        state.currentPopupState = newState; 
        history.pushState(newState, '', `#${id}`);
    }
}

export function closeCurrentPopup() {
    const videoWrapper = document.getElementById('videoPlayerWrapper');
    if (videoWrapper) videoWrapper.innerHTML = ''; 

    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
        state.currentPopupState = null;
    }
}

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

// --- Content Rendering Helpers ---

async function renderFavoritesPageUI() {
    favoritesContainer.innerHTML = '';
    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }
    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';
    renderSkeletonLoader(favoritesContainer, 4); 

    try {
        // Using imported logic from products.js implicitly via createProductCardElementUI
        const fetchPromises = state.favorites.map(id => fetchProductById(id)); // Need to ensure fetchProductById is imported if used here, wait... it is in app-core.
        // Actually let's import fetchProductById from app-core in the header
        const favoritedProducts = (await Promise.all(fetchPromises)).filter(p => p !== null);

        favoritesContainer.innerHTML = ''; 
        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElementUI(product); 
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    }
}

async function renderPoliciesUI() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    const policies = await fetchPolicies(); 
    if (policies) {
        const content = policies[state.currentLanguage] || policies.ku_sorani || '';
        termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
    } else {
        termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
    }
}

async function renderUserNotificationsUI() {
    const announcements = await fetchAnnouncements(); 
    notificationsListContainer.innerHTML = '';

    if (!announcements || announcements.length === 0) {
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    announcements.forEach(announcement => {
        if (announcement.createdAt > latestTimestamp) latestTimestamp = announcement.createdAt;

        const date = new Date(announcement.createdAt);
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
        const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${title}</span>
                <span class="notification-date">${formattedDate}</span>
            </div>
            <p class="notification-content">${content}</p>
        `;
        notificationsListContainer.appendChild(item);
    });

    updateLastSeenAnnouncementTimestamp(latestTimestamp); 
    notificationBadge.style.display = 'none'; 
}

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
             linkElement.innerHTML = `<div><i class="${link.icon}" style="margin-left: 10px;"></i><span>${name}</span></div><i class="fas fa-external-link-alt"></i>`;
             contactLinksContainer.appendChild(linkElement);
         });
     } catch (error) {
         contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هەڵە لە بارکردنی لینکەکان.</p>';
     }
}

// --- Auth & Profile UI ---

function updateProfileSheetUI() {
    const authView = document.getElementById('authView');
    const profileView = document.getElementById('profileView');
    
    if (!state.currentUser) {
        authView.style.display = 'block';
        profileView.style.display = 'none';
        // Reset active tabs UI
        document.getElementById('authTabLogin').classList.add('active');
        document.getElementById('authTabLogin').style.color = 'var(--primary-color)';
        document.getElementById('authTabLogin').style.borderBottomColor = 'var(--primary-color)';
        document.getElementById('authTabSignUp').classList.remove('active');
        document.getElementById('authTabSignUp').style.color = 'var(--dark-gray)';
        document.getElementById('authTabSignUp').style.borderBottomColor = 'transparent';
        document.getElementById('userLoginForm').style.display = 'block';
        document.getElementById('userSignUpForm').style.display = 'none';
    } else {
        authView.style.display = 'none';
        profileView.style.display = 'block';
        document.getElementById('profileDisplayName').textContent = state.currentUser.displayName || "بەکارهێنەر";
        document.getElementById('profileDisplayEmail').textContent = state.currentUser.email;
        document.getElementById('profileName').value = state.userProfile.name || '';
        document.getElementById('profileAddress').value = state.userProfile.address || '';
        document.getElementById('profilePhone').value = state.userProfile.phone || '';
    }
}

function updateAdminUIAuth(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    const adminSections = [
         'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
         'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
         'adminContactMethodsManagement', 'adminShortcutRowsManagement',
         'adminHomeLayoutManagement', 'adminCategoryLayoutManagement', 'adminChatsManagement'
    ];
    adminSections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = isAdmin ? 'block' : 'none';
    });
    settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
    settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
    addProductBtn.style.display = isAdmin ? 'flex' : 'none';
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPageUI();
}

// --- Initialization & Listeners ---

function setupUIEventListeners() {
    homeBtn.onclick = async () => {
        saveCurrentScrollPositionCore();
        const resetState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        history.pushState(resetState, '', window.location.pathname);
        state.currentCategory = 'all'; state.currentSubcategory = 'all'; state.currentSubSubcategory = 'all'; state.currentSearch = '';
        showPage('mainPage');
        await updateProductViewUI(true, true);
    };

    settingsBtn.onclick = () => {
        saveCurrentScrollPositionCore(); 
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    categoriesBtn.onclick = async () => {
        saveCurrentScrollPositionCore();
        history.pushState({ type: 'page', id: 'categoriesPage', title: t('nav_categories') }, '', '#categories');
        showPage('categoriesPage', t('nav_categories'));
        await renderSplitCategoriesPageUI();
        updateActiveNav('categoriesBtn');
    };

    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    document.getElementById('headerBackBtn').onclick = () => { history.back(); };
    document.getElementById('settingsProfileBtn')?.addEventListener('click', () => { openPopup('profileSheet'); });
    settingsFavoritesBtn.onclick = () => { openPopup('favoritesSheet'); };
    settingsAdminLoginBtn.onclick = () => { openPopup('loginModal', 'modal'); };
    notificationBtn.addEventListener('click', () => { openPopup('notificationsSheet'); });
    termsAndPoliciesBtn?.addEventListener('click', () => { openPopup('termsSheet'); });

    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Search Logic
    const debouncedSearch = debounce(async (term) => {
        await navigateToFilterCore({ search: term }); 
        await updateProductViewUI(true, true); 
    }, 500);
    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };
    clearSearchBtn.onclick = () => { searchInput.value = ''; clearSearchBtn.style.display = 'none'; debouncedSearch(''); };

    // Profile Form
    profileForm.onsubmit = async (e) => {
        e.preventDefault();
        const result = await saveProfileCore({
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        });
        showNotification(result.message, result.success ? 'success' : 'error');
        if(result.success) closeCurrentPopup();
    };

    // Auth Forms
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try { await handleLogin(document.getElementById('email').value, document.getElementById('password').value); closeCurrentPopup(); } 
        catch (error) { showNotification(error.message, 'error'); }
    };
    
    const userLoginForm = document.getElementById('userLoginForm');
    if (userLoginForm) {
        userLoginForm.onsubmit = async (e) => {
            e.preventDefault();
            const result = await handleUserLogin(document.getElementById('userLoginEmail').value, document.getElementById('userLoginPassword').value);
            if (result.success) closeCurrentPopup();
            else { document.getElementById('userLoginError').textContent = result.message; document.getElementById('userLoginError').style.display = 'block'; }
        };
    }

    // Other UI Elements
    document.querySelectorAll('.lang-btn').forEach(btn => { btn.onclick = () => handleSetLanguage(btn.dataset.lang); });
    
    contactToggle.onclick = () => {
        document.getElementById('dynamicContactLinksContainer').classList.toggle('open');
        contactToggle.querySelector('.contact-chevron').classList.toggle('open');
    };

    document.getElementById('installAppBtn')?.addEventListener('click', () => handleInstallPrompt(document.getElementById('installAppBtn')));
    document.getElementById('userLogoutBtn').onclick = async () => { showNotification((await handleUserLogout()).message, 'success'); };

    // Infinite Scroll
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    if (scrollTrigger) {
        const observer = new IntersectionObserver(async (entries) => {
            const isMainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
            const isProductGridVisible = document.getElementById('productsContainer')?.style.display === 'grid';
            const isHomeAllProductsVisible = document.querySelector('.all-products-grid');

            if (entries[0].isIntersecting && isMainPageActive && (isProductGridVisible || isHomeAllProductsVisible) && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 document.getElementById('loader').style.display = 'block';
                 const result = await fetchProducts(state.currentSearch, false); 
                 document.getElementById('loader').style.display = 'none'; 
                 
                 if(result && result.products.length > 0) {
                     if (isHomeAllProductsVisible) {
                         result.products.forEach(product => {
                             const card = createProductCardElementUI(product); 
                             card.classList.add('product-card-reveal');
                             isHomeAllProductsVisible.appendChild(card);
                         });
                         setupScrollAnimations();
                     } else {
                         await updateProductViewUI(false); 
                     }
                 }
                 scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
            }
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    }

    setupGpsButtonUI();
}

async function handleSetLanguage(lang) {
    setLanguageCore(lang);
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const translation = t(element.dataset.translateKey);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') { if(element.placeholder) element.placeholder = translation; } 
        else { element.textContent = translation; }
    });
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
    
    if (document.getElementById('categoriesPage').classList.contains('page-active')) renderSplitCategoriesPageUI();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCartUI();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPageUI();
    await updateProductViewUI(true, true);
    await renderContactLinksUI();
}

function setupGpsButtonUI() {
     const getLocationBtn = document.getElementById('getLocationBtn');
     const profileAddressInput = document.getElementById('profileAddress');
     if (!getLocationBtn || !profileAddressInput) return;

     const btnSpan = getLocationBtn.querySelector('span');
     const originalBtnText = btnSpan ? btnSpan.textContent : 'وەرگرتنی ناونیشانم بە GPS';

     getLocationBtn.addEventListener('click', () => {
         if (!('geolocation' in navigator)) { showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error'); return; }
         if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
         getLocationBtn.disabled = true;

         navigator.geolocation.getCurrentPosition(
              async (position) => { 
                   const { latitude, longitude } = position.coords;
                   try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                        const data = await response.json();
                        if (data && data.display_name) {
                             profileAddressInput.value = data.display_name;
                             showNotification('ناونیشان وەرگیرا', 'success');
                        } else { showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error'); }
                   } catch (error) { showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error'); } 
                   finally { if(btnSpan) btnSpan.textContent = originalBtnText; getLocationBtn.disabled = false; }
               },
               (error) => { 
                   let message = t('error_generic'); 
                   if(error.code === 1) message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                   showNotification(message, 'error');
                   if(btnSpan) btnSpan.textContent = originalBtnText;
                   getLocationBtn.disabled = false;
               }
         );
     });
}

// --- Startup ---

async function handleInitialPageLoadUI() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    if (hash === 'settingsPage') { showPage('settingsPage', t('settings_title')); } 
    else if (hash === 'chat') { openChatPage(); showPage('chatPage', t('chat_title')); }
    else if (hash === 'admin-chats') { showPage('adminChatListPage', t('conversations_title')); }
    else if (hash === 'categories') { showPage('categoriesPage', t('nav_categories')); await renderSplitCategoriesPageUI(); updateActiveNav('categoriesBtn'); }
    else if (params.get('product')) { showProductDetailsUI({id: params.get('product')}, true); }
    else if (hash.startsWith('subcategory_')) {
         // Fallback handling handled by history stack usually, or reload to main page
         showPage('mainPage'); await updateProductViewUI(true, true);
    } else {
         showPage('mainPage');
         const initialState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         history.replaceState(initialState, '');
         applyFilterStateCore(initialState);
         await updateProductViewUI(true, true);
    }
}

async function initializeUI() {
    await initCore();
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    setLanguageCore(state.currentLanguage);
    
    setupUIEventListeners();
    await handleInitialPageLoadUI();
    renderContactLinksUI();
    initChatSystem();

    const announcements = await fetchAnnouncements();
    if(announcements.length > 0 && checkNewAnnouncementsCore(announcements[0].createdAt)) {
         notificationBadge.style.display = 'block';
    }

    // Global Listeners
    document.addEventListener('authChange', (e) => updateAdminUIAuth(e.detail.isAdmin));
    document.addEventListener('userChange', () => { if (document.getElementById('profileSheet')?.classList.contains('show')) updateProfileSheetUI(); });
    document.addEventListener('swUpdateReady', (e) => {
        document.getElementById('update-notification').classList.add('show');
        document.getElementById('update-now-btn').onclick = () => e.detail.registration?.waiting?.postMessage({ action: 'skipWaiting' });
    });
}

document.addEventListener('DOMContentLoaded', initializeUI);

// Global Tools for Admin.js
if (!window.globalAdminTools) window.globalAdminTools = {};
window.globalAdminTools.openPopup = openPopup;
window.globalAdminTools.closeCurrentPopup = closeCurrentPopup;
window.globalAdminTools.showNotification = showNotification; 
window.globalAdminTools.updateCartCountUI = updateCartCountUI;
