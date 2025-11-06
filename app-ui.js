// app-ui.js
// Rêveberiya UI Giştî, girêdana bûyeran (event listeners), û nûvekirina DOM

import {
    // Import DOM elements needed for general UI updates
    loginModal, addProductBtn, productFormModal, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer,
    
    // Elements needed specifically for admin UI rendering within app-ui
    adminPoliciesManagement, adminSocialMediaManagement, adminAnnouncementManagement, adminPromoCardsManagement,
    adminBrandsManagement, adminCategoryManagement, adminContactMethodsManagement, adminShortcutRowsManagement,
    adminHomeLayoutManagement, policiesForm, socialLinksListContainer, announcementForm,
    announcementsListContainer, contactMethodsListContainer, categoryListContainer, addCategoryForm,
    addSubcategoryForm, addSubSubcategoryForm, editCategoryForm,
    // New admin elements from updated HTML
    addPromoGroupForm, promoGroupsListContainer, addPromoCardForm,
    addBrandGroupForm, brandGroupsListContainer, addBrandForm,
    shortcutRowsListContainer, addShortcutRowForm, addCardToRowForm,
    homeLayoutListContainer, addHomeSectionBtn, addHomeSectionModal, addHomeSectionForm,
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em elementên nû yên ji bo rêveberiya dîzayna kategoriyan import dikin
    // ئێمە توخمە نوێیەکانی بەڕێوەبردنی دیزاینی جۆرەکان هاوردە دەکەین
    adminCategoryLayoutManagement, categoryLayoutSelect, categoryLayoutEditorContainer,
    selectedCategoryNameLabel, addCategorySectionBtn, categoryLayoutListContainer,
    saveCategoryLayoutBtn, addCategorySectionModal, addCategorySectionForm
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
} from './app-setup.js';

import {
    // Import state and core logic functions
    state, // *** Import state from app-setup ***
    t, debounce, formatDescription,
    handleLogin, handleLogout,
    fetchCategories, fetchProductById, fetchProducts, fetchSubcategories, // *** fetchSubcategories imported ***
    fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, fetchSubSubcategories,
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em fonksiyona nû ya ji bo anîna dîzayna kategoriyê import dikin
    // ئێمە فەنکشنە نوێیەکەی هێنانی دیزاینی جۆرەکە هاوردە دەکەین
    fetchCategoryLayout,
    // Em fonksyonên anîna daneyên ji bo beşan import dikin (چونku me ew ji home.js anîn)
    // ئێمە فەنکشنەکانی هێنانی داتا بۆ بەشەکان هاوردە دەکەین (چونکە لە home.js ەوە هێنامانن)
    fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    addToCartCore, updateCartQuantityCore, removeFromCartCore, generateOrderMessageCore,
    toggleFavoriteCore, isFavorite, saveFavorites,
    saveProfileCore, setLanguageCore,
    requestNotificationPermissionCore, checkNewAnnouncementsCore, updateLastSeenAnnouncementTimestamp,
    handleInstallPrompt, forceUpdateCore,
    saveCurrentScrollPositionCore, applyFilterStateCore, navigateToFilterCore,
    initCore,
    // Firestore functions exported from app-core.js
    db,
    collection, doc, getDoc, query, where, orderBy, getDocs, limit, startAfter, productsCollection
} from './app-core.js';

import {
    // Em êdî fonksyonên çêkirina beşan ji 'home.js' import NAKIN,
    // lê em wan ji 'app-ui.js' import dikin!
    // ئێمە ئیتر فەنکشنەکانی دروستکردنی بەشەکان لێرە هاوردە ناکەین،
    // بەڵکو لە 'app-ui.js' ەوە هاوردەیان دەکەین!
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em êdî vê fonksyonê ji 'home.js' import nakin
    // updateProductViewUI, 
    // Em van fonksyonên mayî ji 'home.js' import dikin
    // ئێمە ئیتر ئەم فەنکشنە لە 'home.js' هاوردە ناکەین
    // updateProductViewUI,
    // ئێمە ئەم فەنکشنانەی تر لە 'home.js' هاوردە دەکەین
    renderMainCategoriesUI, renderSubcategoriesUI, renderProductsGridUI, renderHomePageContentUI
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
} from './home.js'; // Import functions from home.js

// --- UI Helper Functions ---

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
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');
    const subpageSearch = document.querySelector('.subpage-search'); 

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;

        if (subpageSearch) {
            // === START: KODA NÛ / کۆدی نوێ ===
            // Em lêgerînê li ser rûpela hûrguliyên kategoriyê vedişêrin
            // ئێمە گەڕان لە پەڕەی وردەکاری جۆرەکان دەشارینەوە
            if (pageId === 'settingsPage' || pageId === 'subcategoryDetailPage') {
                subpageSearch.style.display = 'none'; // Li 'Settings' û 'Subcategory Detail' veşêre
            } else {
                subpageSearch.style.display = 'block'; 
            }
            // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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
    } else { // Includes mainPage
         updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
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
    let videoId = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        } 
        else if (urlObj.hostname.includes('youtu.be')) {
            videoId = urlObj.pathname.slice(1);
        }
    } catch (e) {
        console.warn("Neşiya URLyê bixwîne:", url, e);
        return null;
    }
    return videoId;
}


function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
    stopAllVideos(); 
}

export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPositionCore(); 
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); 

    const activePage = document.getElementById(state.currentPageId);
    if (activePage && id === 'categoriesSheet') { 
        activePage.scrollTo({ top: 0, behavior: 'instant' });
    }

    const newState = { type: type, id: id };
    state.currentPopupState = newState; 

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
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // type === 'modal'
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); 

    history.pushState(newState, '', `#${id}`);
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


// --- Rendering Functions (UI specific) ---

export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) {
        console.error("Skeleton loader container not found:", container);
        return;
     }
    container.innerHTML = ''; // Clear previous skeletons
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
    container.style.display = 'grid'; // Ensure it's visible
}

export function createProductCardElementUI(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // Get name in current language or fallback
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // Price and Discount Badge
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // Shipping Info Badge
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

    // Favorite Button State
    const isProdFavorite = isFavorite(product.id); // Use core function
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

    // --- Attach Event Listeners Directly Here ---
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
             console.error('Share error:', err);
              if (err.name !== 'AbortError') showNotification(t('share_error'), 'error');
         }
    });

    productCard.querySelector('.favorite-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        handleToggleFavoriteUI(product.id);
    });

    productCard.querySelector('.add-to-cart-btn-card').addEventListener('click', (event) => {
        event.stopPropagation();
        handleAddToCartUI(product.id, event.currentTarget); // Pass the button itself
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

    // Click on the card itself (excluding buttons) shows details
    productCard.addEventListener('click', (event) => {
         // Check if the click was on the card but not on any button inside it
        if (!event.target.closest('button')) {
            showProductDetailsUI(product);
        }
    });

    return productCard;
}

export function setupScrollAnimations() { // Exported
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% is visible
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

// === START: KODA NÛ / کۆدی نوێ ===
// Van fonksyonan ji 'home.js' hatin anîn da ku li vir werin parve kirin
// ئەم فەنکشنانە لە 'home.js' ەوە هێنران بۆ ئەوەی لێرە هاوبەش بن

export async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item layout
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID

    const sliderState = { currentIndex: 0, intervalId: null };
    const cardData = { cards };

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item'; // Styles for container

    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image-container';
    const imgElement = document.createElement('img');
    imgElement.className = 'product-image';
    imgElement.loading = 'lazy';
    imgElement.alt = 'Promotion';
    imageContainer.appendChild(imgElement);
    promoCardElement.appendChild(imageContainer);

    const updateImage = (index) => {
        const currentCard = cardData.cards[index];
        const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;
        imgElement.src = imageUrl;
    };
    updateImage(sliderState.currentIndex); // Initial image

    // Add buttons only if multiple cards
    if (cards.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'promo-slider-btn prev';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // Reset timer on manual navigation
        };
        promoCardElement.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'promo-slider-btn next';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // Reset timer on manual navigation
        };
        promoCardElement.appendChild(nextBtn);

        // Auto-rotation logic
        const rotate = () => {
             // Check if the element still exists and the interval is still tracked
             if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId); // Clear this specific interval
                 if (state.sliderIntervals && state.sliderIntervals[layoutId]) delete state.sliderIntervals[layoutId]; // Remove from global state
                return;
             }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]); // Clear previous if any
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[layoutId] = sliderState.intervalId; // Store globally
        };
        const resetInterval = () => {
             if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
            startInterval();
        };

        startInterval(); // Start on render
    }

    // Click on the card navigates
    promoCardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { // Ignore clicks on buttons
            const currentCard = cardData.cards[sliderState.currentIndex];
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                 await navigateToFilterCore({ category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                 
                 // === START: KODA NÛ / کۆدی نوێ ===
                 // Em êdî 'updateProductViewUI' bang nakin, ji ber ku ew di 'home.js' de ye
                 // Em hewce ne ku rêyek bibînin da ku vê yekê ji vir bikin
                 // TODO: Vê navîgasyonê baştir birêve bibe
                 // ئێمە ئیتر بانگی 'updateProductViewUI' ناکەین، چونکە لە 'home.js'ـە
                 // پێویستە ڕێگایەک بدۆزینەوە بۆ ئەوەی ئەمە لێرەوە بکەین
                 // TODO: ئەم گواستنەوەیە باشتر بەڕێوەببە
                 // Ji bo naha, em ê tenê 'reload' bikin heke em li ser rûpela malê nebin
                 // بۆ ئێستا، تەنها 'reload' دەکەین ئەگەر لە پەڕەی سەرەki نەبین
                 if (state.currentPageId !== 'mainPage') {
                     window.location.href = `${window.location.pathname}?category=${targetCategoryId}`;
                 } else {
                     // Em hewceyê 'updateProductViewUI' ne
                     // پێویستمان بە 'updateProductViewUI'ـە
                     // Ev dê bibe pirsgirêk
                 }
                 // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
            }
        }
    });

    promoGrid.appendChild(promoCardElement);
    return promoGrid;
}

export async function createBrandsSectionElement(groupId) {
    const brands = await fetchBrandGroupBrands(groupId);
    if (!brands || brands.length === 0) return null;

    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    brands.forEach(brand => {
        const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;
        const item = document.createElement('div');
        item.className = 'brand-item';
        item.innerHTML = `
            <div class="brand-image-wrapper">
                <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
            </div>
            <span>${brandName}</span>
        `;
        item.onclick = async () => {
             if (brand.subcategoryId && brand.categoryId) {
                 showSubcategoryDetailPageUI(brand.categoryId, brand.subcategoryId); // Ev fonksyon jixwe di vê pelê de ye (ئەم فەنکشنە هەر لێرەیە)
             } else if(brand.categoryId) {
                  await navigateToFilterCore({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                 // === START: KODA NÛ / کۆدی نوێ ===
                 // Dîsa, em nikarin 'updateProductViewUI' ji vir bang bikin
                 // جارێکی تر، ناتوانین لێرەوە بانگی 'updateProductViewUI' بکەین
                 if (state.currentPageId !== 'mainPage') {
                     window.location.href = `${window.location.pathname}?category=${brand.categoryId}`;
                 } else {
                    // TODO: Pêwîstî bi çareseriyek çêtir heye
                 }
                 // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
             }
        };
        brandsContainer.appendChild(item);
    });
    return sectionContainer;
}

export async function createNewestProductsSectionElement() {
    const products = await fetchNewestProducts();
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('newest_products')}</h3>
            </div>
        <div class="horizontal-products-container"></div>
    `;
    const productsScroller = container.querySelector('.horizontal-products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); // Fonksyona herêmî bikar bîne (فەنکشنە ناوخۆییەکە بەکاربهێنە)
        productsScroller.appendChild(card);
    });
    return container;
}

export async function createSingleShortcutRowElement(rowId, sectionNameObj) { // Receive name object
     const rowDocRef = doc(db, "shortcut_rows", rowId);
     const rowDocSnap = await getDoc(rowDocRef);
     if (!rowDocSnap.exists()) return null;

     const rowData = rowDocSnap.data();
     const cards = await fetchShortcutRowCards(rowId);
     if (!cards || cards.length === 0) return null;

     const sectionContainer = document.createElement('div');
     sectionContainer.className = 'shortcut-cards-section';
     // Use sectionNameObj from layout first, fallback to rowData title
     const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;
     sectionContainer.innerHTML = `<h3 class="shortcut-row-title">${rowTitle}</h3><div class="shortcut-cards-container"></div>`;
     const cardsContainer = sectionContainer.querySelector('.shortcut-cards-container');

     cards.forEach(cardData => {
         const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
         const item = document.createElement('div');
         item.className = 'shortcut-card';
         item.innerHTML = `
             <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
             <div class="shortcut-card-name">${cardName}</div>
         `;
         
         item.onclick = async () => {
            if (cardData.subcategoryId && cardData.categoryId) {
                showSubcategoryDetailPageUI(cardData.categoryId, cardData.subcategoryId); // Ev fonksyon jixwe di vê pelê de ye
            } else {
                await navigateToFilterCore({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all', 
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
                // === START: KODA NÛ / کۆدی نوێ ===
                 if (state.currentPageId !== 'mainPage') {
                     window.location.href = `${window.location.pathname}?category=${cardData.categoryId || 'all'}`;
                 } else {
                    // TODO: Pêwîstî bi çareseriyek çêtir heye
                 }
                 // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
            }
         };
         cardsContainer.appendChild(item);
     });
     return sectionContainer;
}

export async function createSingleCategoryRowElement(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData; // 'name' ئیتر بەکارناهێت
    const products = await fetchCategoryRowProducts(sectionData);
    if (!products || products.length === 0) return null;

    let title = ''; 
    try {
        let targetDocRef;
        if (subSubcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
        } else if (subcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
        } else {
            targetDocRef = doc(db, 'categories', categoryId); 
        }
        
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || 'کاڵاکان';
        } else {
            title = 'کاڵاکان'; 
        }
    } catch (e) {
        console.warn("Could not fetch specific title for category row", e);
        title = 'کاڵاکان'; 
    }

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${title}</h3>
            <a class="see-all-link">${t('see_all')}</a>
        </div>
        <div class="horizontal-products-container"></div>
    `;
    
    const productsScroller = container.querySelector('.horizontal-products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); // Fonksyona herêmî bikar bîne
        productsScroller.appendChild(card);
    });

    container.querySelector('.see-all-link').onclick = async () => {
         if(subcategoryId) { 
              showSubcategoryDetailPageUI(categoryId, subcategoryId); // Ev fonksyon jixwe di vê pelê de ye
         } else { 
              await navigateToFilterCore({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                // === START: KODA NÛ / کۆدی نوێ ===
                 if (state.currentPageId !== 'mainPage') {
                     window.location.href = `${window.location.pathname}?category=${categoryId}`;
                 } else {
                    // TODO: Pêwîstî bi çareseriyek çêtir heye
                 }
                 // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
         }
    };
    return container;
}

export async function createAllProductsSectionElement() {
    // Ev beş di dîzayna kategoriyê de tê bikaranîn da ku HEMÛ kaڵayên wê kategoriyê nîşan bide
    // (ne tenê yên destpêkê yên malê)
    // ئەم بەشە لە دیزاینی جۆرەکان بەکاردێت بۆ پیشاندانی هەموو کاڵاکانی ئەو جۆرە
    // (نەک تەنها هی پەڕەی سەرەki)
    const container = document.createElement('div');
    container.id = 'dynamicAllProductsContainer'; // Em ê vê IDyê paşê bikar bînin
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('all_products_section_title')}</h3>
            </div>
        <div class="products-container"></div>
    `;
    // Kaڵa dê paşê ji aliyê fonksyona `updateProductViewUI` (di home.js de) ve werin barkirin
    // کاڵاکان دواتر لەلایەن فەنکشن `updateProductViewUI` (لە home.js) بار دەکرێن
    return container;
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


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
    renderCartActionButtonsUI(); // Render action buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('total_price')}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalAmount.textContent = total.toLocaleString();

    // Attach listeners for quantity changes and removal
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => handleRemoveFromCartUI(e.currentTarget.dataset.id));
}

async function renderCartActionButtonsUI() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous buttons

    const methods = await fetchContactMethods(); // Get methods from core logic

    if (!methods || methods.length === 0) {
        container.innerHTML = '<p>هیچ ڕێگایەکی nardn دیاری نەکراوە.</p>';
        return;
    }

    methods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn'; // Use a generic class or adjust CSS
        btn.style.backgroundColor = method.color;

        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessageCore(); // Use core function
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

            switch (method.type) {
                case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; // Needs testing
                case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${value}`; break;
                case 'url': link = value; break; // Assume full URL
            }

            if (link) {
                window.open(link, '_blank');
            }
        };
        container.appendChild(btn);
    });
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
    renderSkeletonLoader(favoritesContainer, 4); // Show skeleton while fetching

    try {
        // Fetch details for all favorited products
        const fetchPromises = state.favorites.map(id => fetchProductById(id));
        const favoritedProducts = (await Promise.all(fetchPromises)).filter(p => p !== null);

        favoritesContainer.innerHTML = ''; // Clear skeleton

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // Optionally sync local storage if products were deleted
            state.favorites = [];
            saveFavorites(); // Use exported function from app-core
        } else {
             // Sync favorites if some were deleted
            if(favoritedProducts.length !== state.favorites.length) {
                 state.favorites = favoritedProducts.map(p => p.id);
                 saveFavorites(); // Use exported function from app-core
            }
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElementUI(product); // Use function from this file
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error rendering favorites:", error);
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
     container.innerHTML = ''; // Clear previous

     const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId); // Use function from app-core

     if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
           container.style.display = 'none';
           return;
     }

     container.style.display = 'flex';

     // Add "All" button
     const allBtn = document.createElement('button');
     allBtn.className = `subcategory-btn active`; // Default to active
     allBtn.dataset.id = 'all';
     const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
     allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
     allBtn.onclick = () => {
         container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
         allBtn.classList.add('active');
         const currentSearch = document.getElementById('subpageSearchInput').value;
         renderProductsOnDetailPageUI(subCatId, 'all', currentSearch); // Fetch products for the parent subcategory
     };
     container.appendChild(allBtn);

     // Add buttons for each sub-subcategory
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
               renderProductsOnDetailPageUI(subCatId, subSubcat.id, currentSearch); // Fetch products for this specific sub-subcategory
          };
          container.appendChild(btn);
     });
}

 async function renderProductsOnDetailPageUI(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    renderSkeletonLoader(productsContainer, 4); // Show skeleton while fetching

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

         productsContainer.innerHTML = ''; // Clear skeleton/previous content

         if (products.length === 0) {
             productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
         } else {
             products.forEach(product => {
                 const card = createProductCardElementUI(product); // Use function from this file
                 productsContainer.appendChild(product);
             });
         }
     } catch (error) {
         console.error(`Error rendering products on detail page:`, error);
         productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
     } finally {
         loader.style.display = 'none';
     }
}


// === START: KODA NÛ / کۆدی نوێ ===
// Ev fonksyon naha bi tevahî hatiye rakirin ji ber ku logîka wê çûye nav 'updateProductViewUI'
// ئەم فەنکشنە ئیتر بە تەواوی سڕاوەتەوە چونکە لۆجیکەکەی گواسترایەوە بۆ 'updateProductViewUI'
/*
export async function showSubcategoryDetailPageUI(mainCatId, subCatId, fromHistory = false) {
    // ... KODA KEVN HATE RAKIRIN ...
    // ... کۆدی کۆن سڕایەوە ...
}
*/
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


async function showProductDetailsUI(productData) {
    const product = productData || await fetchProductById(state.currentProductId); // Fetch if needed
    if (!product) { showNotification(t('product_not_found_error'), 'error'); return; }

    state.currentProductId = product.id; // Keep track of the currently viewed product

     const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = ''; // Paqij bike
    thumbnailContainer.innerHTML = ''; // Paqij bike

    let sliderElements = []; 
    let thumbnailElements = []; 
    
    const videoWrapper = document.createElement('div');
    videoWrapper.id = 'videoPlayerWrapper'; 
    videoWrapper.className = 'slider-element'; 
    videoWrapper.style.position = 'relative';
    videoWrapper.style.width = '100%';
    videoWrapper.style.backgroundColor = '#000';
    videoWrapper.style.display = 'none'; 
    videoWrapper.style.justifyContent = 'center';
    videoWrapper.style.alignItems = 'center';
    videoWrapper.style.overflow = 'hidden';
    videoWrapper.style.flexShrink = '0';
    videoWrapper.style.maxHeight = '350px';

    // 1. Hemî wêneyan zêde bike
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url; 
            img.alt = nameInCurrentLang; 
            img.classList.add('slider-element'); 
            if (index === 0) img.classList.add('active');
            
            img.style.width = '100%';
            img.style.flexShrink = '0';
            img.style.display = (index === 0) ? 'block' : 'none'; 
            img.style.objectFit = 'contain';
            img.style.maxHeight = '350px';
            img.style.transition = 'opacity 0.3s ease-in-out';
            
            imageContainer.appendChild(img);
            sliderElements.push(img); 

            const thumb = document.createElement('img');
            thumb.src = url; 
            thumb.alt = `Thumbnail ${index + 1}`; 
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); 
            thumb.dataset.index = index;
            
            thumbnailContainer.appendChild(thumb);
            thumbnailElements.push(thumb);
        });
    }

    // 2. Vîdyoyê zêde bike (eger hebe)
    const videoId = parseYouTubeId(product.externalLink); 

    if (videoId) {
        const videoIndex = sliderElements.length; 
        
        imageContainer.appendChild(videoWrapper);
        sliderElements.push(videoWrapper); 

        const thumb = document.createElement('img');
        thumb.src = `https://img.youtube.com/vi/${videoId}/0.jpg`; 
        thumb.alt = `Video Thumbnail`; 
        thumb.className = 'thumbnail';
        thumb.dataset.index = videoIndex;

        const thumbWrapper = document.createElement('div'); 
        thumbWrapper.style = "position: relative; display: inline-block; cursor: pointer;";
        
        const playIcon = document.createElement('i');
        playIcon.className = 'fas fa-play';
        playIcon.style = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 20px; text-shadow: 0 0 5px black; pointer-events: none;";
        
        thumbWrapper.appendChild(thumb);
        thumbWrapper.appendChild(playIcon);
        thumbnailContainer.appendChild(thumbWrapper);
        thumbnailElements.push(thumbWrapper);
    }

    let currentIndex = 0;
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!sliderElements[index]) return;

        const oldElement = sliderElements[currentIndex];
        if (oldElement.id === 'videoPlayerWrapper') {
            oldElement.innerHTML = ''; 
        }

        sliderElements.forEach(el => {
            el.style.display = 'none';
            el.classList.remove('active');
        });
        thumbnailElements.forEach(thumbEl => {
            const img = thumbEl.querySelector('.thumbnail') || thumbEl;
            img.classList.remove('active');
        });

        const activeElement = sliderElements[index];
        if (activeElement.id === 'videoPlayerWrapper') { 
            activeElement.style.display = 'flex';
            const videoSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&mute=1&controls=1`;
            activeElement.innerHTML = `
                <iframe 
                    src="${videoSrc}" 
                    title="YouTube video player" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen 
                    style="width: 100%; aspect-ratio: 16 / 9;"
                ></iframe>`;
        } else { 
            activeElement.style.display = 'block';
        }
        activeElement.classList.add('active');

        const activeThumb = thumbnailElements[index].querySelector('.thumbnail') || thumbnailElements[index];
        activeThumb.classList.add('active');
        
        currentIndex = index; 
    }

    const showSliderBtns = sliderElements.length > 1;
    prevBtn.style.display = showSliderBtns ? 'flex' : 'none';
    nextBtn.style.display = showSliderBtns ? 'flex' : 'none';

    prevBtn.onclick = null;
    nextBtn.onclick = null;
    
    if(showSliderBtns) {
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + sliderElements.length) % sliderElements.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % sliderElements.length);
    }
    thumbnailElements.forEach((el, index) => {
        el.onclick = () => updateSlider(index);
    });

    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); 

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    const oldLinkContainer = document.getElementById('sheetExternalLinkContainer');
    if (oldLinkContainer) {
        oldLinkContainer.remove();
    }

    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        handleAddToCartUI(product.id, addToCartButton); 
    };

    renderRelatedProductsUI(product);
    openPopup('productDetailSheet');
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
    const policies = await fetchPolicies(); // Ji core bîne
    if (policies) {
        const content = policies[state.currentLanguage] || policies.ku_sorani || '';
        termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
    } else {
        termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
    }
}

async function renderUserNotificationsUI() {
    const announcements = await fetchAnnouncements(); // Ji core bîne
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
         'adminCategoryLayoutManagement' // <-- Koda nû
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
    const detailSheet = document.getElementById('productDetailSheet');
    if (detailSheet?.classList.contains('show') && state.currentProductId) {
        fetchProductById(state.currentProductId).then(product => {
            if (product) showProductDetailsUI(product); 
        });
    }
}


// --- UI Event Handlers ---

async function handleAddToCartUI(productId, buttonElement) {
    const result = await addToCartCore(productId); 
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


// --- Setup Functions ---

function setupUIEventListeners() {
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilterCore({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        // === START: KODA NÛ / کۆدی نوێ ===
        // Em vê fonksyonê ji 'home.js' bang dikin
        // ئێمە ئەم فەنکشنە لە 'home.js' بانگ دەکەین
        await window.updateProductViewUI(true, true); 
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => { history.back(); };

    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    settingsFavoritesBtn.onclick = () => { openPopup('favoritesSheet'); };
    settingsAdminLoginBtn.onclick = () => { openPopup('loginModal', 'modal'); };
    notificationBtn.addEventListener('click', () => { openPopup('notificationsSheet'); });
    termsAndPoliciesBtn?.addEventListener('click', () => { openPopup('termsSheet'); });

    // Girtina Popupan
    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Forma Login
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await handleLogin(document.getElementById('email').value, document.getElementById('password').value);
            closeCurrentPopup(); 
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    // Lêgerîna Sereke (li ser rûpela malê)
    const debouncedSearch = debounce(async (term) => {
        await navigateToFilterCore({ search: term }); 
        // === START: KODA NÛ / کۆدی نوێ ===
        await window.updateProductViewUI(true, true); 
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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

     // Lêgerîna Rûpela Lawekî (ji bo rûpela detail)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            
            // === START: KODA NÛ / کۆدی نوێ ===
            // Em kontrol dikin ka dîzaynek xwerû tê nîşandan
            // ئێمە پشکنین دەکەین بزانین ئایا دیزاینێکی تایبەت پیشان دەدرێت
            // if (state.currentCategoryLayout) {
            //     // Heke dîzaynek xwerû hebe, em lêgerînê nakin (ji ber ku ew veşartî ye)
            //     // ئەگەر دیزاینێکی تایبەت هەبێت، گەڕان ناکەین (چونکە شاردراوەتەوە)
            //     return;
            // }
            // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
            
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


    // Forma Profaylê
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        const profileData = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        const message = saveProfileCore(profileData); 
        showNotification(message, 'success');
        closeCurrentPopup();
    };

    // Bişkokên Ziman
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            handleSetLanguage(btn.dataset.lang);
        };
    });

    // Vêkirina/Girtina Peywendiyê
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    // Bişkoka Install
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', () => handleInstallPrompt(installBtn));
    }

    // Bişkoka Çalakirina Agahdariyan
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', async () => {
        const result = await requestNotificationPermissionCore();
        showNotification(result.message, result.granted ? 'success' : 'error');
    });

    // Bişkoka Nûkirina Bi Zorê
    document.getElementById('forceUpdateBtn')?.addEventListener('click', async () => {
        const result = await forceUpdateCore();
        if (result.success) {
            showNotification(result.message, 'success');
            setTimeout(() => window.location.reload(true), 1500);
        } else if (result.message !== 'Update cancelled.') {
            showNotification(result.message, 'error');
        }
    });

    // --- Skrola Bêdawî ---
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    if (scrollTrigger) {
        const observer = new IntersectionObserver(async (entries) => {
            const isMainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
            const homeSectionsHidden = document.getElementById('homePageSectionsContainer')?.style.display === 'none';

            if (entries[0].isIntersecting && isMainPageActive && homeSectionsHidden && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 loader.style.display = 'block'; 
                 const result = await fetchProducts(state.currentSearch, false); 
                 loader.style.display = 'none'; 
                 if(result && result.products.length > 0) {
                     // === START: KODA NÛ / کۆدی نوێ ===
                     await window.updateProductViewUI(false); 
                     // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
                 }
                 scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
            }
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    }

    // --- Guhdarên Bûyerên Taybet (ji app-core) ---
    document.addEventListener('authChange', (e) => {
        updateAdminUIAuth(e.detail.isAdmin);
        if(e.detail.isAdmin && loginModal.style.display === 'block') {
             closeCurrentPopup();
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
             // === START: KODA NÛ / کۆدی نوێ ===
             await window.updateProductViewUI(true, true); 
             // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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
    // === START: KODA NÛ / کۆدی نوێ ===
    await window.updateProductViewUI(true, true); 
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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
         // === START: KODA NÛ / کۆدی نوێ ===
         window.AdminLogic.renderCategoryLayoutDropdown?.();
         if (window.AdminLogic.currentCategoryLayoutId) {
             window.AdminLogic.loadCategoryLayoutEditor?.(window.AdminLogic.currentCategoryLayoutId);
         }
         // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    }
}

window.addEventListener('popstate', async (event) => {
    const wasPopupOpen = state.currentPopupState !== null; 
    const previousPageId = state.currentPageId; 

    // === START: KODA NÛ / کۆدی نوێ ===
    // state.currentCategoryLayout = null; 
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    
    state.currentPopupState = null; 
    closeAllPopupsUI(); 

    const popState = event.state;
    const activePage = document.getElementById(state.currentPageId); 
    
    if (!activePage) {
        console.error("Popstate error: Could not find active page element.");
        return;
    }

    if (popState) {
        if (popState.type === 'page') {
            showPage(popState.id, popState.title); 
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true);
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type); 
        } else {
            showPage('mainPage'); 
            applyFilterStateCore(popState); 

            const cameFromPopup = wasPopupOpen;
            const cameFromPage = previousPageId !== 'mainPage';

            if (!cameFromPopup && !cameFromPage) {
                console.log("Popstate: Navigating between filter states, triggering refresh WITHOUT scroll.");
                // === START: KODA NÛ / کۆدی نوێ ===
                await window.updateProductViewUI(true, false); 
                // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
            } else {
                console.log(`Popstate: Returned from ${cameFromPopup ? 'popup' : (cameFromPage ? 'page' : 'unknown')}, restoring UI without full refresh.`);
                renderMainCategoriesUI();
                const subcats = await fetchSubcategories(state.currentCategory);
                await renderSubcategoriesUI(subcats);
            }

            if (!state.pendingFilterNav) { 
                if (typeof popState.scroll === 'number') {
                    requestAnimationFrame(() => {
                        activePage.scrollTo({ top: popState.scroll, behavior: 'instant' });
                    });
                } else {
                    requestAnimationFrame(() => {
                        activePage.scrollTo({ top: 0, behavior: 'instant' });
                    });
                }
            }
            
            if (state.pendingFilterNav) {
                console.log("Found pending filter navigation. Applying now.");
                const filterToApply = state.pendingFilterNav;
                state.pendingFilterNav = null; 
                
                setTimeout(async () => {
                    await navigateToFilterCore(filterToApply);
                    // === START: KODA NÛ / کۆدی نوێ ===
                    await window.updateProductViewUI(true, true); 
                    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
                }, 50); 
            }
        }
    } else {
        console.log("Popstate: No state found, loading default main page.");
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage'); 
        applyFilterStateCore(defaultState);
        // === START: KODA NÛ / کۆدی نوێ ===
        await window.updateProductViewUI(true, true); 
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
        requestAnimationFrame(() => {
             const homePage = document.getElementById('mainPage');
             if(homePage) homePage.scrollTo({ top: 0, behavior: 'instant' });
        });
    }
});


async function initializeUI() {
    await initCore(); 

    setLanguageCore(state.currentLanguage); 
     document.querySelectorAll('[data-translate-key]').forEach(element => { 
         const key = element.dataset.translateKey;
         const translation = t(key);
         if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') { if(element.placeholder) element.placeholder = translation; }
         else { element.textContent = translation; }
    });
     document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === state.currentLanguage)); 

    renderCategoriesSheetUI();
    setupUIEventListeners();
    handleInitialPageLoadUI(); 
    renderContactLinksUI();

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
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // state.currentCategoryLayout = null; 
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

    if (isSettings) {
         history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
         showPage('settingsPage', t('settings_title'));
    } else if (isSubcategoryDetail) {
         const ids = hash.split('_');
         const mainCatId = ids[1];
         const subCatId = ids[2];
         if (state.categories.length > 0) { 
              await showSubcategoryDetailPageUI(mainCatId, subCatId, true); 
         } else {
             console.warn("Categories not ready on initial load, showing main page instead of detail.");
             showPage('mainPage');
             // === START: KODA NÛ / کۆدی نوێ ===
             await window.updateProductViewUI(true, true); 
             // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
         }
    } else { // Default to main page
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
         // === START: KODA NÛ / کۆدی نوێ ===
         await window.updateProductViewUI(true, true); 
         // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

         const element = document.getElementById(hash);
         if (element) {
              const isSheet = element.classList.contains('bottom-sheet');
              const isModal = element.classList.contains('modal');
              if (isSheet || isModal) {
                   openPopup(hash, isSheet ? 'sheet' : 'modal');
              }
         }

          const productId = params.get('product');
          if (productId) {
               const product = await fetchProductById(productId);
               if (product) {
                    setTimeout(() => showProductDetailsUI(product), 300); 
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
              async (position) => { // Success callback
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
               (error) => { // Error callback
                   let message = t('error_generic'); // Default error
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

// --- Start UI Initialization ---
document.addEventListener('DOMContentLoaded', initializeUI);


// ======== PIRA JI BO ADMIN.JS (ÇARESERÎ) ========
// Ev kod fonksyonên ku ji app-ui.js hatine 'export' kirin
// ji bo faylê admin.js (ku module nîne) berdest dike.

// Heke globalAdminTools hîn nehatibe çêkirin, wê çêbike
if (!window.globalAdminTools) {
    window.globalAdminTools = {};
}

// Fonksyonên pêwîst li ser 'window' tomar bike da ku admin.js bikaribe bibîne
window.globalAdminTools.openPopup = openPopup;
window.globalAdminTools.closeCurrentPopup = closeCurrentPopup;
window.globalAdminTools.showNotification = showNotification; 

console.log('openPopup, closeCurrentPopup, & showNotification ji bo admin.js hatin zêdekirin.');
// ======== DAWÎYA PIRA ========