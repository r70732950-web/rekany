// app-ui.js
import {
    loginModal, addProductBtn, productFormModal, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
    homePageSectionsContainer, categoryLayoutContainer,
    // ... Admin Elements
    adminPoliciesManagement, policiesForm, adminSocialMediaManagement, addSocialMediaForm, socialLinksListContainer, socialMediaToggle,
    adminAnnouncementManagement, announcementForm, announcementsListContainer, adminPromoCardsManagement, addPromoGroupForm, promoGroupsListContainer, addPromoCardForm,
    adminBrandsManagement, addBrandGroupForm, brandGroupsListContainer, addBrandForm, adminCategoryManagement, categoryListContainer, addCategoryForm,
    addSubcategoryForm, addSubSubcategoryForm, editCategoryForm, adminContactMethodsManagement, contactMethodsListContainer, adminShortcutRowsManagement, shortcutRowsListContainer, addShortcutRowForm, addCardToRowForm,
    adminHomeLayoutManagement, homeLayoutListContainer, addHomeSectionBtn, addHomeSectionModal, addHomeSectionForm, adminCategoryLayoutManagement, categoryLayoutSelect, categoryLayoutEditorContainer, categoryLayoutEnableToggle, categoryLayoutListContainer, addCategorySectionBtn
} from './app-setup.js';

import {
    state, t, debounce, formatDescription, handleLogin, handleUserLogin, handleUserSignUp, handleUserLogout, handlePasswordReset,
    fetchCategories, fetchProductById, fetchProducts, fetchSubcategories, fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, fetchSubSubcategories,
    addToCartCore, updateCartQuantityCore, removeFromCartCore, generateOrderMessageCore, toggleFavoriteCore, isFavorite, saveFavorites,
    saveProfileCore, setLanguageCore, requestNotificationPermissionCore, checkNewAnnouncementsCore, updateLastSeenAnnouncementTimestamp,
    handleInstallPrompt, forceUpdateCore, saveCurrentScrollPositionCore, applyFilterStateCore, navigateToFilterCore, initCore,
    db, collection, doc, getDoc, query, where, orderBy, getDocs, limit, startAfter, productsCollection
} from './app-core.js';

import { updateProductViewUI, renderMainCategoriesUI, renderSubcategoriesUI, renderPageContentUI } from './home.js';
import { initChatSystem, openChatPage } from './chat.js';

// --- Import New Modules ---
import { renderSplitCategoriesPageUI } from './categories.js';
import { renderCartUI, updateCartCountUI, handleUpdateQuantityUI, handleRemoveFromCartUI } from './cart.js';
import { createProductCardElementUI, showProductDetailsUI, setupScrollAnimations, handleToggleFavoriteUI } from './products.js';

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

// --- Header & Navigation ---

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

    if (pageId === 'settingsPage') updateHeaderView('settingsPage', t('settings_title'));
    else if (pageId === 'subcategoryDetailPage') updateHeaderView('subcategoryDetailPage', pageTitle);
    else if (pageId === 'productDetailPage') updateHeaderView('productDetailPage', pageTitle);
    else if (pageId === 'chatPage') updateHeaderView('chatPage', pageTitle);
    else if (pageId === 'adminChatListPage') updateHeaderView('adminChatListPage', t('conversations_title'));
    else if (pageId === 'categoriesPage') updateHeaderView('categoriesPage', t('nav_categories'));
    else updateHeaderView('mainPage');

    let activeBtnId = null;
    if (pageId === 'mainPage') activeBtnId = 'homeBtn';
    else if (pageId === 'settingsPage') activeBtnId = 'settingsBtn';
    else if (pageId === 'categoriesPage') activeBtnId = 'categoriesBtn';
    else if (pageId === 'chatPage' || pageId === 'adminChatListPage') activeBtnId = 'chatBtn';

    if (activeBtnId) updateActiveNav(activeBtnId);
}

function stopAllVideos() {
    const videoWrapper = document.getElementById('videoPlayerWrapper');
    if (videoWrapper) {
        videoWrapper.innerHTML = ''; 
    }
}

export function openPopup(id, type = 'sheet', addToHistory = true) {
    saveCurrentScrollPositionCore(); 
    const element = document.getElementById(id);
    if (!element) return;

    if (addToHistory) {
        closeAllPopupsUI(); 
    } else {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    }

    const activePage = document.getElementById(state.currentPageId);
    if (activePage && id === 'categoriesSheet') { 
        activePage.scrollTo({ top: 0, behavior: 'instant' });
    }

    if (type === 'sheet') {
        const sheetContent = element.querySelector('.sheet-content');
        if (sheetContent) {
            sheetContent.scrollTop = 0;
        }

        sheetOverlay.classList.add('show');
        element.classList.add('show');
        
        if (id === 'cartSheet') renderCartUI();
        if (id === 'favoritesSheet') renderFavoritesPageUI();
        if (id === 'categoriesSheet') renderSplitCategoriesPageUI();
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

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
    stopAllVideos(); 
}

export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
        state.currentPopupState = null;
    }
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

// --- [چاککراوە] Subcategory Detail Logic ---

// ڕەندەرکردنی جۆرە لاوەکییە لاوەکییەکان
async function renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId) {
     const container = document.getElementById('subSubCategoryContainerOnDetailPage');
     container.innerHTML = ''; 

     const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId); 

     if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
           container.style.display = 'none';
           return;
     }

     container.style.display = 'flex';

     // دوگمەی "هەموو"
     const allBtn = document.createElement('button');
     allBtn.className = `subcategory-btn active`; 
     allBtn.dataset.id = 'all';
     const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
     allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
     allBtn.onclick = () => {
         container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
         allBtn.classList.add('active');
         const currentSearch = document.getElementById('subpageSearchInput').value;
         renderProductsOnDetailPageUI(subCatId, 'all', currentSearch); 
     };
     container.appendChild(allBtn);

     // دروستکردنی دوگمەی لاوەکی لاوەکی
     subSubcategoriesData.forEach(subSubcat => {
          const btn = document.createElement('button');
          btn.className = `subcategory-btn`;
          btn.dataset.id = subSubcat.id;
          const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
          const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
          const imageUrl = subSubcat.imageUrl || placeholderImg;
          btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

          btn.onclick = () => {
               container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
               btn.classList.add('active');
               const currentSearch = document.getElementById('subpageSearchInput').value;
               renderProductsOnDetailPageUI(subCatId, subSubcat.id, currentSearch); 
          };
          container.appendChild(btn);
     });
}

// ڕەندەرکردنی کاڵاکان لە پەڕەی وردەکاری جۆر
async function renderProductsOnDetailPageUI(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    renderSkeletonLoader(productsContainer, 4); 

     try {
         let conditions = [];
         let orderByClauses = [];

         if (subSubCatId === 'all') {
             conditions.push(where("subcategoryId", "==", subCatId));
         } else {
             conditions.push(where("subSubcategoryId", "==", subSubCatId));
         }

         const finalSearchTerm = searchTerm.trim().toLowerCase();
         if (finalSearchTerm) {
             conditions.push(where('searchableName', '>=', finalSearchTerm));
             conditions.push(where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
             orderByClauses.push(orderBy("searchableName", "asc"));
         }
         orderByClauses.push(orderBy("createdAt", "desc")); 

         let detailQuery = query(productsCollection, ...conditions, ...orderByClauses); 

         const productSnapshot = await getDocs(detailQuery);
         const products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

         productsContainer.innerHTML = ''; 

         if (products.length === 0) {
             productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
         } else {
             products.forEach(product => {
                 const card = createProductCardElementUI(product); 
                 productsContainer.appendChild(card);
             });
         }
     } catch (error) {
         console.error(`Error rendering products on detail page:`, error);
         productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
     } finally {
         loader.style.display = 'none';
     }
}

// [چاککراوە] کردنەوەی پەڕەی وردەکاری جۆر
export async function showSubcategoryDetailPageUI(mainCatId, subCatId, fromHistory = false) { 
    let subCatName = 'Details'; 
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) { console.error("Could not fetch subcategory name:", e); }

    if (!fromHistory) {
         saveCurrentScrollPositionCore(); 
         // زیادکردنی بۆ History
         history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    } else {
        if (!history.state || history.state.id !== 'subcategoryDetailPage') {
             history.replaceState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
        }
    }

    const page = document.getElementById('subcategoryDetailPage');
    
    // [چاکسازی] پشکنین ئایا ئەم پەڕەیە پێشتر بارکراوە؟
    const isSamePage = page.dataset.loadedMain === mainCatId && page.dataset.loadedSub === subCatId;

    if (fromHistory && isSamePage) {
        // ئەگەر هەمان پەڕە بوو، تەنها نیشانی دەدەین و Scroll دەگەڕێنینەوە
        // false واتە Scroll مەکە بۆ سەرەوە
        showPage('subcategoryDetailPage', subCatName, false); 
        
        if (history.state && history.state.scroll) {
            setTimeout(() => {
                page.scrollTo({ top: history.state.scroll, behavior: 'instant' });
            }, 10);
        }
        return; // ناهێڵین دووبارە کاڵاکان بارببنەوە
    }

    // ئەگەر پەڕەیەکی نوێ بوو، داتای نوێ تۆمار دەکەین
    page.dataset.loadedMain = mainCatId;
    page.dataset.loadedSub = subCatId;

    showPage('subcategoryDetailPage', subCatName, true); 

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';
    subSubContainer.style.display = 'flex'; 

    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // [چاکسازی] هێنانی بەشە لاوەکییە لاوەکییەکان
    await renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId); 
    
    // هێنانی کاڵاکان
    await renderProductsOnDetailPageUI(subCatId, 'all', ''); 

    loader.style.display = 'none'; 
}

// --- Favorites Rendering ---

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
        const fetchPromises = state.favorites.map(id => fetchProductById(id));
        const favoritedProducts = (await Promise.all(fetchPromises)).filter(p => p !== null);

        favoritesContainer.innerHTML = ''; 

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
            state.favorites = [];
            saveFavorites(); 
        } else {
            if(favoritedProducts.length !== state.favorites.length) {
                 state.favorites = favoritedProducts.map(p => p.id);
                 saveFavorites(); 
            }
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElementUI(product); 
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    }
}

// --- Other Rendering Functions ---

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
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt;
        }

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

function updateAdminUIAuth(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

    const adminSections = [
         'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
         'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
         'adminContactMethodsManagement', 'adminShortcutRowsManagement',
         'adminHomeLayoutManagement',
         'adminCategoryLayoutManagement',
         'adminChatsManagement'
    ];
    
    adminSections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = isAdmin ? 'block' : 'none';
    });

    settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
    settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
    addProductBtn.style.display = isAdmin ? 'flex' : 'none';

    const favoritesSheet = document.getElementById('favoritesSheet');
    if (favoritesSheet?.classList.contains('show')) {
        renderFavoritesPageUI();
    }
}

function updateProfileSheetUI() {
    const authView = document.getElementById('authView');
    const profileView = document.getElementById('profileView');
    
    if (!state.currentUser) {
        authView.style.display = 'block';
        profileView.style.display = 'none';

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

// --- Initialization & Listeners ---

function setupUIEventListeners() {
    
    homeBtn.onclick = async () => {
        saveCurrentScrollPositionCore();

        const resetState = { 
            category: 'all', 
            subcategory: 'all', 
            subSubcategory: 'all', 
            search: '', 
            scroll: 0 
        };

        history.pushState(resetState, '', window.location.pathname);
        
        state.currentCategory = 'all';
        state.currentSubcategory = 'all';
        state.currentSubSubcategory = 'all';
        state.currentSearch = '';
        showPage('mainPage');
        await updateProductViewUI(true, true);
    };

    settingsBtn.onclick = () => {
        saveCurrentScrollPositionCore(); 
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => { history.back(); };

    const settingsProfileBtn = document.getElementById('settingsProfileBtn');
    if (settingsProfileBtn) {
        settingsProfileBtn.onclick = () => { openPopup('profileSheet'); };
    }

    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    
    categoriesBtn.onclick = async () => {
        saveCurrentScrollPositionCore();
        history.pushState({ type: 'page', id: 'categoriesPage', title: t('nav_categories') }, '', '#categories');
        showPage('categoriesPage', t('nav_categories'));
        await renderSplitCategoriesPageUI();
        updateActiveNav('categoriesBtn');
    };

    settingsFavoritesBtn.onclick = () => { openPopup('favoritesSheet'); };
    settingsAdminLoginBtn.onclick = () => { openPopup('loginModal', 'modal'); };
    notificationBtn.addEventListener('click', () => { openPopup('notificationsSheet'); });
    termsAndPoliciesBtn?.addEventListener('click', () => { openPopup('termsSheet'); });

    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await handleLogin(document.getElementById('email').value, document.getElementById('password').value);
            closeCurrentPopup(); 
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const authTabLogin = document.getElementById('authTabLogin');
    const authTabSignUp = document.getElementById('authTabSignUp');
    const userLoginForm = document.getElementById('userLoginForm');
    const userSignUpForm = document.getElementById('userSignUpForm');

    authTabLogin.onclick = () => {
        authTabLogin.classList.add('active');
        authTabLogin.style.color = 'var(--primary-color)';
        authTabLogin.style.borderBottomColor = 'var(--primary-color)';
        authTabSignUp.classList.remove('active');
        authTabSignUp.style.color = 'var(--dark-gray)';
        authTabSignUp.style.borderBottomColor = 'transparent';
        userLoginForm.style.display = 'block';
        userSignUpForm.style.display = 'none';
    };

    authTabSignUp.onclick = () => {
        authTabSignUp.classList.add('active');
        authTabSignUp.style.color = 'var(--primary-color)';
        authTabSignUp.style.borderBottomColor = 'var(--primary-color)';
        authTabLogin.classList.remove('active');
        authTabLogin.style.color = 'var(--dark-gray)';
        authTabLogin.style.borderBottomColor = 'transparent';
        userLoginForm.style.display = 'none';
        userSignUpForm.style.display = 'block';
    };

    userLoginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('userLoginEmail').value;
        const password = document.getElementById('userLoginPassword').value;
        const errorP = document.getElementById('userLoginError');
        const submitBtn = userLoginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        errorP.style.display = 'none';
        
        const result = await handleUserLogin(email, password);
        
        if (result.success) {
            closeCurrentPopup(); 
        } else {
            errorP.textContent = result.message;
            errorP.style.display = 'block';
            submitBtn.disabled = false;
        }
    };

    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.onclick = async () => {
            const email = document.getElementById('userLoginEmail').value;
            const errorP = document.getElementById('userLoginError');
            errorP.style.display = 'none';

            if (!email) {
                showNotification(t('password_reset_enter_email'), 'error');
                errorP.textContent = t('password_reset_enter_email');
                errorP.style.display = 'block';
                return;
            }
            
            const result = await handlePasswordReset(email);
            
            showNotification(result.message, result.success ? 'success' : 'error');
            
            if (!result.success) {
                errorP.textContent = result.message;
                errorP.style.display = 'block';
            }
        };
    }

    userSignUpForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('userSignUpName').value;
        const email = document.getElementById('userSignUpEmail').value;
        const password = document.getElementById('userSignUpPassword').value;
        const errorP = document.getElementById('userSignUpError');
        const submitBtn = userSignUpForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        errorP.style.display = 'none';

        const result = await handleUserSignUp(name, email, password);
        
        if (result.success) {
            showNotification(result.message, 'success');
            closeCurrentPopup(); 
        } else {
            errorP.textContent = result.message;
            errorP.style.display = 'block';
            submitBtn.disabled = false;
        }
    };

    document.getElementById('userLogoutBtn').onclick = async () => {
        const result = await handleUserLogout();
        showNotification(result.message, result.success ? 'success' : 'error');
    };


    const debouncedSearch = debounce(async (term) => {
        await navigateToFilterCore({ search: term }); 
        await updateProductViewUI(true, true); 
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

    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            await renderProductsOnDetailPageUI(subCatId, subSubCatId, term); 
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

    profileForm.onsubmit = async (e) => {
        e.preventDefault();
        const profileData = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        
        const submitBtn = profileForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const result = await saveProfileCore(profileData); 
        
        showNotification(result.message, result.success ? 'success' : 'error');
        if(result.success) {
            closeCurrentPopup();
        }
        submitBtn.disabled = false;
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            handleSetLanguage(btn.dataset.lang);
        };
    });

    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', () => handleInstallPrompt(installBtn));
    }

    document.getElementById('enableNotificationsBtn')?.addEventListener('click', async () => {
        const result = await requestNotificationPermissionCore();
        showNotification(result.message, result.granted ? 'success' : 'error');
    });

    document.getElementById('forceUpdateBtn')?.addEventListener('click', async () => {
        const result = await forceUpdateCore();
        if (result.success) {
            showNotification(result.message, 'success');
            setTimeout(() => window.location.reload(true), 1500);
        } else if (result.message !== 'Update cancelled.') {
            showNotification(result.message, 'error');
        }
    });

    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    if (scrollTrigger) {
        const observer = new IntersectionObserver(async (entries) => {
            const isMainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
            
            const isProductGridVisible = document.getElementById('productsContainer')?.style.display === 'grid';
            
            const isHomeAllProductsVisible = document.querySelector('.all-products-grid');

            if (entries[0].isIntersecting && isMainPageActive && (isProductGridVisible || isHomeAllProductsVisible) && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 
                 loader.style.display = 'block'; 
                 const result = await fetchProducts(state.currentSearch, false); 
                 
                 loader.style.display = 'none'; 
                 
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

    document.addEventListener('authChange', (e) => {
        updateAdminUIAuth(e.detail.isAdmin);
        if(e.detail.isAdmin && loginModal.style.display === 'block') {
             closeCurrentPopup();
        }
    });
    
    document.addEventListener('userChange', () => {
        if (document.getElementById('profileSheet')?.classList.contains('show')) {
            updateProfileSheetUI();
        }
    });
    
    document.addEventListener('profileLoaded', () => {
        if (document.getElementById('profileSheet')?.classList.contains('show')) {
            updateProfileSheetUI();
        }
    });


    document.addEventListener('fcmMessage', (e) => {
        const payload = e.detail;
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
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
        if(state.currentCategory === 'all' && !state.currentSearch) {
             await updateProductViewUI(true, true); 
        }
    });

    setupGpsButtonUI();
}

async function handleSetLanguage(lang) {
    setLanguageCore(lang); 

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

    if (document.getElementById('categoriesPage').classList.contains('page-active')) renderSplitCategoriesPageUI();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCartUI();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPageUI();
    await updateProductViewUI(true, true); 
    await renderContactLinksUI();

    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
         window.AdminLogic.renderAdminAnnouncementsList?.();
         window.AdminLogic.renderSocialMediaLinks?.();
         window.AdminLogic.renderContactMethodsAdmin?.();
         window.AdminLogic.renderCategoryManagementUI?.();
         window.AdminLogic.renderPromoGroupsAdminList?.();
         window.AdminLogic.renderBrandGroupsAdminList?.();
         window.AdminLogic.renderShortcutRowsAdminList?.();
         window.AdminLogic.renderHomeLayoutAdmin?.();
         window.AdminLogic.renderCategoryLayoutAdmin?.();
    }
    
    const authTabLogin = document.getElementById('authTabLogin');
    const authTabSignUp = document.getElementById('authTabSignUp');
    if (authTabLogin) authTabLogin.textContent = t('auth_tab_login');
    if (authTabSignUp) authTabSignUp.textContent = t('auth_tab_signup');
}

window.addEventListener('popstate', async (event) => {
    const wasPopupOpen = state.currentPopupState !== null; 
    const previousPageId = state.currentPageId; 

    state.currentPopupState = null; 
    closeAllPopupsUI(); 

    const popState = event.state;
    const activePage = document.getElementById(state.currentPageId); 
    
    if (!activePage) {
        return;
    }

    if (popState) {
        if (popState.type === 'page') {
            showPage(popState.id, popState.title, false); 

            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true);
            }
            if (popState.id === 'productDetailPage' && popState.productId) {
                 setTimeout(() => {
                    showProductDetailsUI({id: popState.productId}, true);
                 }, 50);
            }
            if (popState.id === 'chatPage') {
                openChatPage();
            }
            if (popState.id === 'categoriesPage') {
                await renderSplitCategoriesPageUI();
            }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type, false);
        
        } else { 
            showPage('mainPage', '', false); 
            
            const stateToApply = popState || { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
            applyFilterStateCore(stateToApply); 

            const prodContainer = document.getElementById('productsContainer');
            const homeContainer = document.getElementById('homePageSectionsContainer');
            const catContainer = document.getElementById('categoryLayoutContainer');
            
            const hasProducts = prodContainer && prodContainer.children.length > 0;
            const hasHome = homeContainer && homeContainer.children.length > 0;
            const hasCatLayout = catContainer && catContainer.children.length > 0;
            
            const isContentAvailable = hasProducts || hasHome || hasCatLayout;

            if (isContentAvailable) {
                const isHomeState = state.currentCategory === 'all' && !state.currentSearch;
                const isCatLayoutState = state.currentCategory !== 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all' && !state.currentSearch;
                
                if(prodContainer) prodContainer.style.display = 'none';
                if(homeContainer) homeContainer.style.display = 'none';
                if(catContainer) catContainer.style.display = 'none';
                if(document.getElementById('skeletonLoader')) document.getElementById('skeletonLoader').style.display = 'none';

                if (isHomeState) {
                    if(homeContainer) homeContainer.style.display = 'block';
                    document.getElementById('subcategoriesContainer').style.display = 'none';
                    document.getElementById('subSubcategoriesContainer').style.display = 'none';
                } else if (isCatLayoutState) {
                    if(catContainer) {
                        catContainer.style.display = 'block';
                        Array.from(catContainer.children).forEach(child => {
                             child.style.display = (child.id === `layout-cache-${state.currentCategory}`) ? 'block' : 'none';
                        });
                    }
                    const subcats = await fetchSubcategories(state.currentCategory);
                    renderSubcategoriesUI(subcats);
                } else {
                    if(prodContainer) prodContainer.style.display = 'grid';
                    const subcats = await fetchSubcategories(state.currentCategory);
                    renderSubcategoriesUI(subcats);
                }
                
                renderMainCategoriesUI();
                
            } else {
                await updateProductViewUI(true, false);
            }

            if (!state.pendingFilterNav) { 
                if (typeof stateToApply.scroll === 'number') {
                    setTimeout(() => {
                         const homePage = document.getElementById('mainPage');
                         if(homePage) homePage.scrollTo({ top: stateToApply.scroll, behavior: 'instant' });
                    }, 50);
                } else {
                    requestAnimationFrame(() => {
                        activePage.scrollTo({ top: 0, behavior: 'instant' });
                    });
                }
            }
            
            if (state.pendingFilterNav) {
                const filterToApply = state.pendingFilterNav;
                state.pendingFilterNav = null; 
                setTimeout(async () => {
                    await navigateToFilterCore(filterToApply);
                    await updateProductViewUI(true, true); 
                }, 50); 
            }
        }
    } else {
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage'); 
        applyFilterStateCore(defaultState); 
        await updateProductViewUI(true, true); 
        requestAnimationFrame(() => {
             const homePage = document.getElementById('mainPage');
             if(homePage) homePage.scrollTo({ top: 0, behavior: 'instant' });
        });
    }
});

async function initializeUI() {
    await initCore(); 
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    setLanguageCore(state.currentLanguage); 
     document.querySelectorAll('[data-translate-key]').forEach(element => { 
         const key = element.dataset.translateKey;
         const translation = t(key);
         if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') { if(element.placeholder) element.placeholder = translation; }
         else { element.textContent = translation; }
    });
     document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === state.currentLanguage)); 
    
    const authTabLogin = document.getElementById('authTabLogin');
    const authTabSignUp = document.getElementById('authTabSignUp');
    if (authTabLogin) authTabLogin.textContent = t('auth_tab_login');
    if (authTabSignUp) authTabSignUp.textContent = t('auth_tab_signup');

    setupUIEventListeners();

    handleInitialPageLoadUI(); 

    renderContactLinksUI();

    initChatSystem();

    const announcements = await fetchAnnouncements();
     if(announcements.length > 0 && checkNewAnnouncementsCore(announcements[0].createdAt)) {
         notificationBadge.style.display = 'block';
     }

    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

async function handleInitialPageLoadUI() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const isSettings = hash === 'settingsPage';
    const isSubcategoryDetail = hash.startsWith('subcategory_');
    const isChat = hash === 'chat'; 
    const isAdminChat = hash === 'admin-chats'; 
    const isProductDetail = params.get('product');
    const isCategories = hash === 'categories';

    if (isSettings) {
         history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
         showPage('settingsPage', t('settings_title'));
    } else if (isChat) { 
         history.replaceState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', `#chat`);
         showPage('chatPage', t('chat_title'));
         openChatPage(); 
    } else if (isAdminChat) { 
         history.replaceState({ type: 'page', id: 'adminChatListPage', title: t('conversations_title') }, '', `#admin-chats`);
         showPage('adminChatListPage', t('conversations_title'));
         if(sessionStorage.getItem('isAdmin') === 'true') {
            openChatPage(); 
         }
    } else if (isCategories) {
         history.replaceState({ type: 'page', id: 'categoriesPage', title: t('nav_categories') }, '', `#categories`);
         showPage('categoriesPage', t('nav_categories'));
         await renderSplitCategoriesPageUI();
         updateActiveNav('categoriesBtn');
    } else if (isSubcategoryDetail) {
         const ids = hash.split('_');
         const mainCatId = ids[1];
         const subCatId = ids[2];
         if (state.categories.length > 0) { 
              await showSubcategoryDetailPageUI(mainCatId, subCatId, true); 
         } else {
             console.warn("Categories not ready on initial load, showing main page instead of detail.");
             showPage('mainPage');
             await updateProductViewUI(true, true); 
         }
    } else if (isProductDetail) {
        const productId = isProductDetail;
        if (productId) {
            showPage('productDetailPage'); 
            const product = await fetchProductById(productId);
            if (product) {
                showProductDetailsUI(product, true);
            } else {
                 showPage('mainPage');
                 await updateProductViewUI(true, true);
            }
        }
    } else { 
         showPage('mainPage');
         const initialState = {
             category: params.get('category') || 'all',
             subcategory: params.get('subcategory') || 'all',
             subSubcategory: params.get('subSubcategory') || 'all',
             search: params.get('search') || '',
             scroll: 0
         };
         history.replaceState(initialState, ''); 
         applyFilterStateCore(initialState); 
         await updateProductViewUI(true, true); 

         const element = document.getElementById(hash);
         if (element) {
              const isSheet = element.classList.contains('bottom-sheet');
              const isModal = element.classList.contains('modal');
              if (isSheet || isModal) {
                   openPopup(hash, isSheet ? 'sheet' : 'modal');
              }
         }
    }
}

function setupGpsButtonUI() {
     const getLocationBtn = document.getElementById('getLocationBtn');
     const profileAddressInput = document.getElementById('profileAddress');

     if (!getLocationBtn || !profileAddressInput) return;

     const btnSpan = getLocationBtn.querySelector('span');
     const originalBtnText = btnSpan ? btnSpan.textContent : 'وەرگرتنی ناونیشانم بە GPS';

     getLocationBtn.addEventListener('click', () => {
         if (!('geolocation' in navigator)) {
             showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
             return;
         }

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
                        } else {
                             showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
                        }
                   } catch (error) {
                        console.error('Reverse Geocoding Error:', error);
                        showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
                   } finally {
                        if(btnSpan) btnSpan.textContent = originalBtnText;
                       getLocationBtn.disabled = false;
                   }
               },
               (error) => { 
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

document.addEventListener('DOMContentLoaded', initializeUI);

if (!window.globalAdminTools) {
    window.globalAdminTools = {};
}

window.globalAdminTools.openPopup = openPopup;
window.globalAdminTools.closeCurrentPopup = closeCurrentPopup;
window.globalAdminTools.showNotification = showNotification; 
window.globalAdminTools.updateCartCountUI = updateCartCountUI;