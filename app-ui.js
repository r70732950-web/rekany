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
    termsAndPoliciesBtn, termsSheet, termsContentContainer,
    homePageSectionsContainer, 
    categoryLayoutContainer,  
    adminPoliciesManagement, adminSocialMediaManagement, adminAnnouncementManagement, adminPromoCardsManagement,
    adminBrandsManagement, adminCategoryManagement, adminContactMethodsManagement, adminShortcutRowsManagement,
    adminHomeLayoutManagement, policiesForm, socialLinksListContainer, announcementForm,
    announcementsListContainer, contactMethodsListContainer, categoryListContainer, addCategoryForm,
    addSubcategoryForm, addSubSubcategoryForm, editCategoryForm,
    addPromoGroupForm, promoGroupsListContainer, addPromoCardForm,
    addBrandGroupForm, brandGroupsListContainer, addBrandForm,
    shortcutRowsListContainer, addShortcutRowForm, addCardToRowForm,
    homeLayoutListContainer, addHomeSectionBtn, addHomeSectionModal, addHomeSectionForm,
    adminCategoryLayoutManagement, 
} from './app-setup.js';

import {
    state, 
    t, debounce, formatDescription,
    handleLogin, 
    handleUserLogin, handleUserSignUp, handleUserLogout, handlePasswordReset,
    fetchCategories, fetchProductById, fetchProducts, fetchSubcategories, 
    fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, fetchSubSubcategories,
    addToCartCore, updateCartQuantityCore, removeFromCartCore, generateOrderMessageCore,
    toggleFavoriteCore, isFavorite, saveFavorites,
    saveProfileCore, 
    setLanguageCore,
    requestNotificationPermissionCore, checkNewAnnouncementsCore, updateLastSeenAnnouncementTimestamp,
    handleInstallPrompt, forceUpdateCore,
    saveCurrentScrollPositionCore, applyFilterStateCore, navigateToFilterCore,
    initCore,
    db,
    collection, doc, getDoc, query, where, orderBy, getDocs, limit, startAfter, productsCollection
} from './app-core.js';

import {
    renderPageContentUI, updateProductViewUI, renderMainCategoriesUI, renderSubcategoriesUI
} from './home.js'; 

import { initChatSystem, openChatPage } from './chat.js';

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

function showPage(pageId, pageTitle = '') {
    state.currentPageId = pageId; 
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        if (pageId === 'chatPage') {
            bottomNav.style.display = 'none';
        } else {
            bottomNav.style.display = 'flex';
        }
    }

    if (pageId !== 'mainPage') {
         requestAnimationFrame(() => { 
             const activePage = document.getElementById(pageId);
             if(activePage) activePage.scrollTo({ top: 0, behavior: 'instant' });
         });
    }

     if (pageId === 'settingsPage') {
         updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
         updateHeaderView('subcategoryDetailPage', pageTitle);
    } else if (pageId === 'productDetailPage') {
         updateHeaderView('productDetailPage', pageTitle);
    } else if (pageId === 'chatPage') { 
         updateHeaderView('chatPage', pageTitle);
    } else if (pageId === 'adminChatListPage') { 
         updateHeaderView('adminChatListPage', t('conversations_title'));
    } else { 
         updateHeaderView('mainPage');
    }

    let activeBtnId = null;
    if (pageId === 'mainPage') activeBtnId = 'homeBtn';
    else if (pageId === 'settingsPage') activeBtnId = 'settingsBtn';
    else if (pageId === 'chatPage' || pageId === 'adminChatListPage') activeBtnId = 'chatBtn';

    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
}

function stopAllVideos() {
    const videoWrapper = document.getElementById('videoPlayerWrapper');
    if (videoWrapper) {
        videoWrapper.innerHTML = ''; 
    }
}

function parseYouTubeId(url) {
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
            if (urlObj.searchParams.has('v')) {
                return urlObj.searchParams.get('v');
            }
            if (urlObj.pathname.startsWith('/shorts/')) {
                return urlObj.pathname.split('/')[2];
            }
            if (urlObj.pathname.startsWith('/embed/')) {
                return urlObj.pathname.split('/')[2];
            }
        } 
        else if (urlObj.hostname.includes('youtu.be')) {
            return urlObj.pathname.slice(1);
        }
    } catch (e) {
        return null;
    }
    return null;
}

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
    
    stopAllVideos(); 
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
        if (id === 'categoriesSheet') renderCategoriesSheetUI();
        if (id === 'notificationsSheet') renderUserNotificationsUI();
        if (id === 'termsSheet') renderPoliciesUI();
        if (id === 'profileSheet') {
            updateProfileSheetUI();
        }
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

function updateCartCountUI() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) { return; }
    container.innerHTML = ''; 
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class.skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; 
}

export function createProductCardElementUI(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>
        `;
    }

    const isProdFavorite = isFavorite(product.id); 
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
             <button class="share-btn-card" aria-label="Share product">
                 <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

     productCard.querySelector('.share-btn-card').addEventListener('click', async (event) => {
         event.stopPropagation();
         const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
         const shareData = {
             title: nameInCurrentLang,
             text: `${t('share_text')}: ${nameInCurrentLang}`,
             url: productUrl,
         };
         try {
             if (navigator.share) {
                  await navigator.share(shareData);
             } else {
                 const textArea = document.createElement('textarea');
                  textArea.value = productUrl;
                  document.body.appendChild(textArea);
                  textArea.select();
                  try { document.execCommand('copy'); showNotification('لينكى کاڵا کۆپى کرا!', 'success'); }
                  catch (err) { showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error'); }
                  document.body.removeChild(textArea);
             }
         } catch (err) {
              if (err.name !== 'AbortError') showNotification(t('share_error'), 'error');
         }
    });

    productCard.querySelector('.favorite-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        handleToggleFavoriteUI(product.id);
    });

    productCard.querySelector('.add-to-cart-btn-card').addEventListener('click', (event) => {
        event.stopPropagation();
        handleAddToCartUI(product.id, event.currentTarget); 
    });

    if (isAdmin) {
        productCard.querySelector('.edit-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
             if (window.AdminLogic && window.AdminLogic.editProduct) {
                 window.AdminLogic.editProduct(product.id);
             }
        });
        productCard.querySelector('.delete-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
             if (window.AdminLogic && window.AdminLogic.deleteProduct) {
                 window.AdminLogic.deleteProduct(product.id);
             }
        });
    }

    productCard.addEventListener('click', (event) => {
        if (!event.target.closest('button')) {
            saveCurrentScrollPositionCore(); 
            showProductDetailsUI(product);
        }
    });

    return productCard;
}

export function setupScrollAnimations() { 
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); 
            }
        });
    }, {
        threshold: 0.1 
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderCartUI() {
    cartItemsContainer.innerHTML = '';
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }

    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtonsUI(); 

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = (item.price * item.quantity) + (item.shippingCost || 0);
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        const itemNameInCurrentLang = (typeof item.name === 'string') 
            ? item.name 
            : ((item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || 'کاڵای بێ ناو');

        let shippingDisplay = '';
        if (item.shippingCost > 0) {
            shippingDisplay = `<span style="font-size:12px; color:#e53e3e;">(+ ${item.shippingCost.toLocaleString()} گەیاندن)</span>`;
        } else {
            shippingDisplay = `<span style="font-size:12px; color:#38a169;">(گەیاندن بێ بەرامبەر)</span>`;
        }

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">
                    ${item.price.toLocaleString()} د.ع <span style="font-size:11px; color:#666;">x ${item.quantity}</span>
                    <br>
                    ${shippingDisplay}
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>کۆی گشتی</div>
                <span style="color:var(--primary-color); font-size:16px;">${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalAmount.textContent = total.toLocaleString();

    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => handleRemoveFromCartUI(e.currentTarget.dataset.id));
}

async function renderCartActionButtonsUI() {
    const container = document.getElementById('cartActions');
    const oldButtons = container.querySelectorAll('.contact-method-btn');
    oldButtons.forEach(btn => btn.remove());

    const methods = await fetchContactMethods(); 

    if (!methods || methods.length === 0) {
        if (container.children.length === 0) {
             container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        }
        return;
    }

    methods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn contact-method-btn'; 
        btn.style.backgroundColor = method.color;

        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessageCore(); 
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

            switch (method.type) {
                case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; 
                case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${value}`; break;
                case 'url': link = value; break; 
            }

            if (link) {
                window.open(link, '_blank');
            }
        };
        container.appendChild(btn);
    });
    
    initChatSystem();
}

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

function renderCategoriesSheetUI() {
    sheetCategoriesContainer.innerHTML = '';

    const homeBtn = document.createElement('button');
    homeBtn.className = 'sheet-category-btn';
    homeBtn.dataset.category = 'all'; 
    homeBtn.innerHTML = `<i class="fas fa-home"></i> ${t('nav_home')}`;
    
    if (state.currentCategory === 'all') {
        homeBtn.classList.add('active');
    }
    
    homeBtn.onclick = async () => {
         state.pendingFilterNav = {
             category: 'all',
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         };
         closeCurrentPopup();
    };
    sheetCategoriesContainer.appendChild(homeBtn);

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);
        const categoryIcon = cat.icon;

        btn.innerHTML = `<i class="${categoryIcon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             state.pendingFilterNav = {
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
             };
             closeCurrentPopup();
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

 async function renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId) {
     const container = document.getElementById('subSubCategoryContainerOnDetailPage');
     container.innerHTML = ''; 

     const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId); 

     if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
           container.style.display = 'none';
           return;
     }

     container.style.display = 'flex';

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
         history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); 

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    await renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId); 
    await renderProductsOnDetailPageUI(subCatId, 'all', ''); 

    loader.style.display = 'none'; 
}

async function showProductDetailsUI(productData, fromHistory = false) {
    const product = productData || await fetchProductById(state.currentProductId); 
    if (!product) { showNotification(t('product_not_found_error'), 'error'); return; }

    state.currentProductId = product.id; 
    const productName = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';

    if (!fromHistory) {
        saveCurrentScrollPositionCore();
        const newUrl = `?product=${product.id}`;
        history.pushState({ type: 'page', id: 'productDetailPage', title: productName, productId: product.id }, '', newUrl);
    }
    
    showPage('productDetailPage', productName);

    const baseProduct = {
        name: productName,
        description: (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '',
        basePrice: product.price,
        originalPrice: product.originalPrice || null,
        baseImages: (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []),
        videoLink: product.externalLink || null
    };
    
    document.getElementById('detailProductDescription').innerHTML = formatDescription(baseProduct.description); 
    
    const variationSelectorContainer = document.getElementById('variationSelectorContainer');
    const lvl1Container = document.getElementById('variationLvl1Container');
    const lvl1Buttons = document.getElementById('variationLvl1Buttons');
    const lvl2Container = document.getElementById('variationLvl2Container');
    const lvl2Buttons = document.getElementById('variationLvl2Buttons');
    
    lvl1Buttons.innerHTML = '';
    lvl2Buttons.innerHTML = '';
    lvl1Container.style.display = 'none';
    lvl2Container.style.display = 'none';
    variationSelectorContainer.style.display = 'none';

    let selectedLvl1Id = null;
    let selectedLvl2Id = null;

    renderSliderImages(baseProduct.baseImages, baseProduct.videoLink, baseProduct.name);
    renderProductPrice(baseProduct.basePrice, baseProduct.originalPrice);

    const variations = product.variations || [];
    if (variations.length > 0) {
        variationSelectorContainer.style.display = 'flex';
        lvl1Container.style.display = 'block';

        variations.forEach(lvl1Var => {
            const btn = document.createElement('button');
            btn.className = 'variation-btn';
            btn.dataset.lvl1Id = lvl1Var.id;
            btn.textContent = (lvl1Var.name && lvl1Var.name[state.currentLanguage]) || lvl1Var.name.ku_sorani;
            
            btn.onclick = () => {
                lvl1Buttons.querySelectorAll('.variation-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                selectedLvl1Id = lvl1Var.id;
                selectedLvl2Id = null; 

                const newImages = (lvl1Var.imageUrls && lvl1Var.imageUrls.length > 0) ? lvl1Var.imageUrls : baseProduct.baseImages;
                renderSliderImages(newImages, baseProduct.videoLink, baseProduct.name);

                lvl2Buttons.innerHTML = '';
                const options = lvl1Var.options || [];
                
                if (options.length > 0) {
                    options.forEach(lvl2Opt => {
                        const optBtn = document.createElement('button');
                        optBtn.className = 'variation-btn';
                        optBtn.dataset.lvl2Id = lvl2Opt.id;
                        optBtn.textContent = lvl2Opt.name;
                        
                        optBtn.onclick = () => {
                            lvl2Buttons.querySelectorAll('.variation-btn').forEach(b => b.classList.remove('active'));
                            optBtn.classList.add('active');
                            selectedLvl2Id = lvl2Opt.id;
                            renderProductPrice(lvl2Opt.price, null); 
                        };
                        lvl2Buttons.appendChild(optBtn);
                    });
                    lvl2Container.style.display = 'block';
                } else {
                    lvl2Container.style.display = 'none';
                    renderProductPrice(baseProduct.basePrice, baseProduct.originalPrice);
                }
            };
            lvl1Buttons.appendChild(btn);
        });
    }

    const addToCartButton = document.getElementById('detailAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        let selectedVariationInfo = null;
        if (variations.length > 0) {
            if (!selectedLvl1Id) { showNotification('تکایە سەرەتا جۆرێک (ڕەنگ) هەڵبژێرە', 'error'); return; }
            const lvl1Var = variations.find(v => v.id === selectedLvl1Id);
            if (!lvl1Var) return;

            selectedVariationInfo = {
                lvl1Id: lvl1Var.id,
                lvl1Name: (lvl1Var.name && lvl1Var.name[state.currentLanguage]) || lvl1Var.name.ku_sorani,
                price: baseProduct.basePrice 
            };

            const lvl2Options = lvl1Var.options || [];
            if (lvl2Options.length > 0) {
                if (!selectedLvl2Id) { showNotification('تکایە قەبارەیەک هەڵبژێرە', 'error'); return; }
                const lvl2Opt = lvl2Options.find(o => o.id === selectedLvl2Id);
                if (!lvl2Opt) return;
                
                selectedVariationInfo.lvl2Id = lvl2Opt.id;
                selectedVariationInfo.lvl2Name = lvl2Opt.name;
                selectedVariationInfo.price = lvl2Opt.price; 
            }
        }
        handleAddToCartUI(product.id, addToCartButton, selectedVariationInfo); 
    };

    renderRelatedProductsUI(product);
}

function renderSliderImages(imageUrls, videoLink, productName) {
    const imageContainer = document.getElementById('detailImageContainer');
    const indicatorsContainer = document.getElementById('detailImageIndicators');
    
    imageContainer.innerHTML = ''; 
    indicatorsContainer.innerHTML = ''; 

    let sliderElements = []; 
    let indicatorElements = []; 
    
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url; 
            img.alt = productName; 
            img.className = index === 0 ? 'active' : ''; 
            
            imageContainer.appendChild(img);
            sliderElements.push(img); 
            
            const line = document.createElement('div');
            line.className = `indicator-line ${index === 0 ? 'active' : ''}`;
            line.dataset.index = index;
            indicatorsContainer.appendChild(line);
            indicatorElements.push(line);
        });
    }

    const videoId = parseYouTubeId(videoLink); 
    if (videoId) {
        const videoWrapper = document.createElement('div');
        videoWrapper.id = 'videoPlayerWrapper'; 
        videoWrapper.style.cssText = "position: relative; width: 100%; background-color: #000; display: none; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; max-height: 350px;";
        
        const videoIndex = sliderElements.length; 
        imageContainer.appendChild(videoWrapper);
        sliderElements.push(videoWrapper); 

        const line = document.createElement('div');
        line.className = `indicator-line`;
        line.innerHTML = ''; 
        line.dataset.index = videoIndex;
        indicatorsContainer.appendChild(line);
        indicatorElements.push(line);
    }

    let currentIndex = 0;
    const prevBtn = document.getElementById('detailPrevBtn');
    const nextBtn = document.getElementById('detailNextBtn');

    function updateSlider(index) {
        if (!sliderElements[index]) return;

        const oldElement = sliderElements[currentIndex];
        if (oldElement && oldElement.id === 'videoPlayerWrapper') {
            oldElement.innerHTML = ''; 
        }

        sliderElements.forEach(el => el.classList.remove('active'));
        
        indicatorElements.forEach(el => el.classList.remove('active'));

        const activeElement = sliderElements[index];
        if (activeElement.id === 'videoPlayerWrapper') { 
            const videoSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&mute=1&controls=1`;
            activeElement.innerHTML = `<iframe src="${videoSrc}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; aspect-ratio: 16 / 9; max-height: 350px;"></iframe>`;
        }
        activeElement.classList.add('active');
        indicatorElements[index].classList.add('active');
        
        currentIndex = index; 
    }

    const showSliderBtns = sliderElements.length > 1;
    prevBtn.style.display = showSliderBtns ? 'flex' : 'none';
    nextBtn.style.display = showSliderBtns ? 'flex' : 'none';
    indicatorsContainer.style.display = showSliderBtns ? 'flex' : 'none';

    if(showSliderBtns) {
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + sliderElements.length) % sliderElements.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % sliderElements.length);
        
        indicatorElements.forEach((indicator, idx) => {
            indicator.onclick = () => updateSlider(idx);
        });
    }
}

function renderProductPrice(price, originalPrice = null) {
    const priceContainer = document.getElementById('detailProductPrice');
    if (originalPrice && originalPrice > price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${price.toLocaleString()} د.ع</span>`;
    }
}

async function renderRelatedProductsUI(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none'; 

    const relatedProducts = await fetchRelatedProducts(currentProduct); 

    if (relatedProducts && relatedProducts.length > 0) {
        relatedProducts.forEach(product => {
            const card = createProductCardElementUI(product); 
            container.appendChild(card);
        });
        section.style.display = 'block'; 
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

async function handleAddToCartUI(productId, buttonElement, selectedVariationInfo = null) {
    const result = await addToCartCore(productId, selectedVariationInfo); 
    
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) {
        updateCartCountUI(); 
        if (buttonElement && !buttonElement.disabled) {
            const originalContent = buttonElement.innerHTML;
            buttonElement.disabled = true;
            buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; 
            setTimeout(() => {
                buttonElement.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; 
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent; 
                    buttonElement.disabled = false;
                }, 1500);
            }, 500);
        }
    }
}

function handleUpdateQuantityUI(productId, change) {
    if (updateCartQuantityCore(productId, change)) { 
        renderCartUI(); 
        updateCartCountUI(); 
    }
}

function handleRemoveFromCartUI(productId) {
    if (removeFromCartCore(productId)) { 
        renderCartUI(); 
        updateCartCountUI(); 
    }
}

function handleToggleFavoriteUI(productId) {
    const result = toggleFavoriteCore(productId); 
    showNotification(result.message, result.favorited ? 'success' : 'error');

    document.querySelectorAll(`[data-product-id="${productId}"] .favorite-btn`).forEach(btn => {
        btn.classList.toggle('favorited', result.favorited);
        const icon = btn.querySelector('.fa-heart');
        if (icon) {
            icon.classList.toggle('fas', result.favorited);
            icon.classList.toggle('far', !result.favorited);
        }
    });

    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPageUI();
    }
}


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
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
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

            if (entries[0].isIntersecting && isMainPageActive && isProductGridVisible && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 loader.style.display = 'block'; 
                 const result = await fetchProducts(state.currentSearch, false); 
                 loader.style.display = 'none'; 
                 if(result && result.products.length > 0) {
                     await updateProductViewUI(false); 
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

    renderCategoriesSheetUI(); 
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
            showPage(popState.id, popState.title); 
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true);
            }
            // [ 💡 نوێ ] - Handled Product Detail Page
            if (popState.id === 'productDetailPage' && popState.productId) {
                 setTimeout(() => {
                    showProductDetailsUI({id: popState.productId}, true);
                 }, 50);
            }
            if (popState.id === 'chatPage') {
                openChatPage();
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type, false);
        
        } else { 
            showPage('mainPage'); 
            
            const stateToApply = popState || { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
            applyFilterStateCore(stateToApply); 

            const cameFromPage = previousPageId !== 'mainPage'; 
            const shouldReloadData = cameFromPage; 
            const shouldScrollToTop = false; 
            
            // [ 🛠️ چاککرا ] - ڕێگری لە نوێبوونەوەی بێزارکەر (Refresh)
            await updateProductViewUI(false, false);

            if (!state.pendingFilterNav) { 
                // [ 💡 چاککرا ] - دڵنیابوونەوە لە گەڕاندنەوەی Scroll
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
    // [ 💡 چاککرا ] - ناچالاککردنی خۆکارانەی وێبگەڕ بۆ ئەوەی ئێمە کۆنترۆڵی بکەین
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


    renderCategoriesSheetUI();

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
        // [ 💡 نوێ ] - Initial Load for Product Detail Page
        const productId = isProductDetail;
        if (productId) {
            showPage('productDetailPage'); // Show empty page first to reduce flicker
            const product = await fetchProductById(productId);
            if (product) {
                showProductDetailsUI(product, false);
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

console.log('openPopup, closeCurrentPopup, & showNotification ji bo admin.js hatin zêdekirin.');