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
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, 
    // profileBtn, // <-- Ev êdî ne di nav-ê de ye (ئەمە ئیتر لە navـدا نییە)
    contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer,
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em elementên nû yên chatê import dikin
    // ئێمە توخمە نوێیەکانی چات هاوردە دەکەین
    phoneLoginModal, phoneLoginForm, phoneLoginError,
    verifyCodeModal, verifyCodeForm, verifyCodeError,
    chatSheet, chatMessagesContainer, chatLoadingSpinner, chatMessageForm, chatMessageInput,
    settingsProfileBtn, // Bişkoja Profaylê di 'Settings' de (دوگمەی پڕۆفایل لە 'Settings')
    chatBtn, // Bişkoja Chatê di nav-a jêrîn de (دوگمەی چات لە navـی خوارەوە)

    auth, // <-- **ÇARESERÎ 1: 'auth' لێرە زیادکرا (لە app-setup.js دێت)**

    // === END: KODA NÛ / کۆtایی کۆdi نوێ ===

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
} from './app-setup.js';

import {
    // Import state and core logic functions
    state, // *** Import state from app-setup ***
    t, debounce, formatDescription,
    handleLogin, handleLogout,
    fetchCategories, fetchProductById, fetchProducts, fetchSubcategories, // *** fetchSubcategories imported ***
    fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, fetchSubSubcategories,
    addToCartCore, updateCartQuantityCore, removeFromCartCore, generateOrderMessageCore,
    toggleFavoriteCore, isFavorite, saveFavorites,
    saveProfileCore, setLanguageCore,
    requestNotificationPermissionCore, checkNewAnnouncementsCore, updateLastSeenAnnouncementTimestamp,
    handleInstallPrompt, forceUpdateCore,
    saveCurrentScrollPositionCore, applyFilterStateCore, navigateToFilterCore,
    initCore,
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em 'auth' import dikin ji bo kontrolkirina bikarhênerê têketî
    // ئێمە 'auth' هاوردە دەکەین بۆ پشکنینی بەکارهێنەری لۆگینبوو
    
    // auth, // <-- **ÇARESERÎ 2: 'auth' لێرە سڕایەوە (چونکە لە app-core.js نییە)**

    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

    // Firestore functions exported from app-core.js
    db,
    collection, doc, getDoc, query, where, orderBy, getDocs, limit, startAfter, productsCollection
} from './app-core.js';

import {
    renderHomePageContentUI, updateProductViewUI, renderMainCategoriesUI, renderSubcategoriesUI
} from './home.js'; // Import functions from home.js

// === START: KODA NÛ / کۆدی نوێ ===
// Em fonksiyonên xwe yên chatê import dikin
// ئێمە فەنکشنەکانی چاتمان هاوردە دەکەین
import {
    initPhoneAuth,
    sendVerificationCode,
    verifyCode,
    getUserProfile,
    saveUserProfile,
    sendChatMessage,
    getChatMessagesListener,
    stopChatMessagesListener
} from './chat.js';
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// --- UI Helper Functions ---

// *** DESTPÊK: Fonksiyon hate EXPORT kirin da ku admin.js bikaribe bibîne ***
export function showNotification(message, type = 'success') {
// *** DAWÎ: Fonksiyon hate EXPORT kirin ***
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Add transition for showing
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition ends
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// *** START: Gۆڕanlکاری lێرە kra (Çareseriya ji bo Settings Page) ***
function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');
    // *** DESTPÊK: Lêgerrîna li (.subpage-search) hate zêdekirin ***
    const subpageSearch = document.querySelector('.subpage-search'); // Bara lêgerînê bibîne
    // *** DAWÎ: Lêgerrîna li (.subpage-search) hate zêdekirin ***

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;

        // *** DESTPÊK: Guhertina ji bo veşartina lêgerînê li 'Settings' ***
        // Ev mantiq piştrast dike ku bara lêgerînê TENÊ li ser rûpelên lawekî yên pêwîst xuya dike
        if (subpageSearch) {
            if (pageId === 'settingsPage') {
                subpageSearch.style.display = 'none'; // Li 'Settings' veşêre
            } else {
                subpageSearch.style.display = 'block'; // Li rûpelên din ên lawekî nîşan bide (mînak, hûrguliyên kategoriyê)
            }
        }
        // *** DAWÎ: Guhertina ji bo veşartina lêgerînê li 'Settings' ***
    }
}
// *** END: Gۆڕanlکاری lێرە kra ***

function showPage(pageId, pageTitle = '') {
    state.currentPageId = pageId; 
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top for new pages, except main page which handles scroll separately
    if (pageId !== 'mainPage') {
         requestAnimationFrame(() => { // Ensure layout is updated before scrolling
             // Em êdî ne window, lê rûpela çalak skrol dikin
             // ئێمە ئیتر window سکڕۆڵ ناکەین، بەڵکو پەڕە چالاکەکە سکڕۆڵ دەکەین
             const activePage = document.getElementById(pageId);
             if(activePage) activePage.scrollTo({ top: 0, behavior: 'instant' });
         });
    }

    // Update header based on the page
     if (pageId === 'settingsPage') {
         updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
         updateHeaderView('subcategoryDetailPage', pageTitle);
    } else { // Includes mainPage
         updateHeaderView('mainPage');
    }

    // Update active state in bottom navigation
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em 'chatBtn' li şûna 'profileBtn' bikar tînin
    // ئێمە 'chatBtn' لە جێگەی 'profileBtn' بەکاردێنین
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
}


// === START: KODA NÛ JI BO VÎDYOYÊ ===
// === دەستپێک: کۆدی نوێ بۆ ڤیدیۆ ===
/**
 * Fonksiyonek alîkar ji bo rawestandina vîdyoyan dema ku popup tê girtin.
 * فەنکشنێکی یاریدەدەر بۆ ڕاگرتنی ڤیدیۆکان کاتێک پۆپئەپ دادەخرێت.
 */
function stopAllVideos() {
    // === GUHERTINA DAWÎ LI VIR E ===
    // === دوا گۆڕانکاری لێرەدایە ===
    // Em êdî rasterast 'iframe' nagirin, lê em pêça (wrapper) wê vala dikin
    // ئێمە ئیتر ڕاستەوخۆ 'iframe'ـەکە ناگرین، بەڵکو کۆنتەینەرەکەی بەتاڵ دەکەینەوە
    const videoWrapper = document.getElementById('videoPlayerWrapper');
    if (videoWrapper) {
        videoWrapper.innerHTML = ''; // Rakirina iframe vîdyoyê disekinîne
    }
    // === DAWÎYA GUHERTINÊ ===
}

/**
 * Fonksiyonek alîkar ji bo derxistina IDya vîdyoya YouTube ji URLyên cihê.
 * فەنکشنێکی یاریدەدەر بۆ دەرهێنانی ئایدی ڤیدیۆی یوتیووب لە لینکە جیاوازەکان.
 * @param {string} url Linka vîdyoyê
 * @returns {string|null} IDya vîdyoyê
 */
function parseYouTubeId(url) {
    if (!url) return null;
    let videoId = null;
    try {
        // Lihevhatina bi URLya standard (youtube.com/watch?v=...)
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtube-nocookie.com')) {
            videoId = urlObj.searchParams.get('v');
        } 
        // Lihevhatina bi URLya kurt (youtu.be/...)
        else if (urlObj.hostname.includes('youtu.be')) {
            videoId = urlObj.pathname.slice(1);
        }
    } catch (e) {
        console.warn("Neşiya URLyê bixwîne:", url, e);
        return null;
    }
    return videoId;
}
// === END: KODA NÛ JI BO VÎDYOYÊ ===
// === کۆتایی: کۆدی نوێ بۆ ڤیدیۆ ===


function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
    
    // === KODA NÛ: Vîdyoyan û Chatê rawestîne ===
    // === کۆدی نوێ: ڤیدیۆکان و چات بوەستێنە ===
    stopAllVideos(); 
    stopChatMessagesListener(); // Guhdarê chatê radiwestîne (گوێگری چات ڕادەگرێت)
    // === DAWÎYA KODA NÛ ===
}

// =================================================================
// === ÇARESERÎ 1: `openPopup` HATE `export` KIRIN ===
// =================================================================
export function openPopup(id, type = 'sheet') {
    // 1. Cihê skrolê yê rûpela heyî tomar bike (Skrôla lapele calakeke pashekeut bike)
    saveCurrentScrollPositionCore(); 
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups first

    // 2. Rûpela çalak vegerîne jor (TENÊ JI BO 'categoriesSheet')
    // 2. لاپەڕە چالاکەکە بگەڕێنەوە سەرەوە (تەنها بۆ 'categoriesSheet')
    const activePage = document.getElementById(state.currentPageId);
    // Tenê eger 'categoriesSheet' hat vekirin, rûpelê skrol bike jor
    // تەنها ئەگەر 'categoriesSheet' کرایەوە، لاپەڕەکە سکڕۆڵ بکە سەرەوە
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
        
        // Trigger rendering content specifically for the opened sheet
        if (id === 'cartSheet') renderCartUI();
        if (id === 'favoritesSheet') renderFavoritesPageUI();
        if (id === 'categoriesSheet') renderCategoriesSheetUI();
        if (id === 'notificationsSheet') renderUserNotificationsUI();
        if (id === 'termsSheet') renderPoliciesUI();
        if (id === 'profileSheet') {
            // === START: KODA NÛ / کۆدی نوێ ===
            // Em profîla heyî bar dikin, û hejmara têlefonê ji authê tînin (eğer hebe)
            // ئێمە پڕۆفایلی ئێستا بار دەکەین، و ژمارەی مۆبایل لە authـەوە دەهێنین (ئەگەر هەبێت)
            const currentUser = auth.currentUser;
            const profile = state.userProfile;
            
            document.getElementById('profileName').value = profile.name || '';
            document.getElementById('profileAddress').value = profile.address || '';
            
            // Hejmara têlefonê ji profîlê bistîne, paşê ji authê
            // ژمارەی مۆبایل لە پڕۆفایل وەربگرە، پاشان لە auth
            const phoneInput = document.getElementById('profilePhone');
            phoneInput.value = profile.phone || (currentUser ? currentUser.phoneNumber : '');
            
            // Eger bikarhêner bi têlefonê têketibe, rê nede guhertina hejmarê
            // ئەگەر بەکارهێنەر بە mۆbایل لۆگین بووبێت، ڕێگە مەدە ژمارەکە بگۆڕێت
            if (currentUser && currentUser.phoneNumber) {
                phoneInput.disabled = true;
            } else {
                phoneInput.disabled = false;
            }
            // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
        }
        // === START: KODA NÛ / کۆدی نوێ ===
        // Em peyamên chatê bar dikin dema ku sheeta chatê vedibe
        // ئێمە نامەکانی چات بار دەکەین کاتێک شاشەی چات دەکرێتەوە
        if (id === 'chatSheet') {
            if (auth.currentUser) {
                renderChatMessagesUI(auth.currentUser.uid);
            } else {
                console.error("Bikarhêner têketî nîne, nikare chatê veke.");
                closeCurrentPopup(); // Divê ev çênebe
            }
        }
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

    } else { // type === 'modal'
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent body scroll

    history.pushState(newState, '', `#${id}`);
}


// =================================================================
// === ÇARESERÎ 2: `closeCurrentPopup` HATE `export` KIRIN ===
// =================================================================
export function closeCurrentPopup() {
    // If the current history state represents a popup, go back
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        // Otherwise, just close everything (fallback)
        closeAllPopupsUI();
        // Clear the tracked popup state
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
            <div class="skeleton-text shimmer"></div>
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

    // === START: KODA NÛ / کۆدی نوێ ===
    // 1. Bişkoka Chata Navxweyî zêde bike
    // 1. دوگمەی چاتی ناوخۆیی زیاد بکە
    const appChatBtn = document.createElement('button');
    appChatBtn.className = 'whatsapp-btn'; // Heman stîl bikar tîne
    appChatBtn.style.backgroundColor = 'var(--primary-color)'; // Rengek cuda
    appChatBtn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${t('send_via_app_chat')}</span>`;
    appChatBtn.onclick = handleSendOrderViaChat; // Fonksiyona alîkar a nû bang bike
    container.appendChild(appChatBtn);
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

    const methods = await fetchContactMethods(); // Get methods from core logic

    if (!methods || methods.length === 0) {
        if (container.innerHTML === '') { // Tenê eger bişkoka chatê jî tune be
             container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        }
        return;
    }

    // 2. Bişkokên din (WhatsApp, Viber...) zêde bike
    // 2. دوگمەکانی تر (واتسئاپ، ڤایبەر...) زیاد بکە
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

// *** START: Gۆڕanlکاری lێرە kra (Logica pendingFilterNav) ***
function renderCategoriesSheetUI() {
    sheetCategoriesContainer.innerHTML = '';

    // 1. Bişkoja "Serekî" (Home) bi destî lê zêde bike
    // 1. زیادکردنی دوگمەی "سەرەki" (Home) بە شێوەی دەستی
    const homeBtn = document.createElement('button');
    homeBtn.className = 'sheet-category-btn';
    homeBtn.dataset.category = 'all'; 
    homeBtn.innerHTML = `<i class="fas fa-home"></i> ${t('nav_home')}`;
    
    if (state.currentCategory === 'all') {
        homeBtn.classList.add('active');
    }
    
    homeBtn.onclick = async () => {
         // 1. Fîlterê di stateyê de tomar bike (فلتەرەکە لە state پاشەکەوت بکە)
         state.pendingFilterNav = {
             category: 'all',
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         };
         // 2. Tenê popupê bigire (تەنها پۆپئەپەکە دابخە)
         closeCurrentPopup();
    };
    sheetCategoriesContainer.appendChild(homeBtn);

    // 2. Hemî kategoriyên din ji stateyê lê zêde bike
    // 2. زیادکردنی هەموو جۆرەکانی تر لە state
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);
        const categoryIcon = cat.icon;

        btn.innerHTML = `<i class="${categoryIcon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             // 1. Fîlterê di stateyê de tomar bike (فلتەرەکە لە state پاشەکەوت بکە)
             state.pendingFilterNav = {
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
             };
             // 2. Tenê popupê bigire (تەنها پۆپئەپەکە دابخە)
             closeCurrentPopup();
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}
// *** END: Gۆڕanlکاری lێرە kra ***


 // Renders sub-subcategories on the **detail page** (kept here)
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

 // Renders products on the **detail page** based on fetched data (kept here)
 async function renderProductsOnDetailPageUI(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    renderSkeletonLoader(productsContainer, 4); // Show skeleton while fetching

     try {
         // Construct query parameters similar to fetchProducts logic
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
         orderByClauses.push(orderBy("createdAt", "desc")); // Always sort by creation date

         let detailQuery = query(productsCollection, ...conditions, ...orderByClauses); // Use imported productsCollection
         const productSnapshot = await getDocs(detailQuery);
         const products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

         productsContainer.innerHTML = ''; // Clear skeleton/previous content

         if (products.length === 0) {
             productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
         } else {
             products.forEach(product => {
                 const card = createProductCardElementUI(product); // Use function from this file
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


// Displays the subcategory detail page (kept here)
export async function showSubcategoryDetailPageUI(mainCatId, subCatId, fromHistory = false) { // Exported
    let subCatName = 'Details'; // Default title
    try {
        // Fetch subcategory name for the title
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) { console.error("Could not fetch subcategory name:", e); }

    // Push state only if navigating forward
    if (!fromHistory) {
         history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); // Show the page and set title

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Reset UI elements
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // Render content
    await renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId); // Render sub-sub buttons first
    await renderProductsOnDetailPageUI(subCatId, 'all', ''); // Then load initial products (all for this subcat)

    loader.style.display = 'none'; // Hide loader after content is loaded
}

async function showProductDetailsUI(productData) {
    const product = productData || await fetchProductById(state.currentProductId); // Fetch if needed
    if (!product) { showNotification(t('product_not_found_error'), 'error'); return; }

    state.currentProductId = product.id; // Keep track of the currently viewed product

     const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // === START: KODA NÛ JI BO SLAYDERA VÎDYOYÊ (GUHERTINA DAWÎ) ===
    // === دەستپێک: کۆدی نوێ بۆ سلایدەری ڤیدیۆ (دوا گۆڕانکاری) ===

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = ''; // Paqij bike
    thumbnailContainer.innerHTML = ''; // Paqij bike

    let sliderElements = []; // Dê <img> û pêça (wrapper) <iframe> bigire
    let thumbnailElements = []; // Dê <img> yên thumbnail bigire
    
    // === GUHERTINA 1: Em ê pêçek (wrapper) ji bo vîdyoyê çêkin ===
    // === گۆڕانکاری ١: ئێمە کۆنتەینەرێک بۆ ڤیدیۆکە دروست دەکەین ===
    const videoWrapper = document.createElement('div');
    videoWrapper.id = 'videoPlayerWrapper'; // IDyek taybet
    videoWrapper.className = 'slider-element'; // Klasa giştî
    videoWrapper.style.position = 'relative';
    videoWrapper.style.width = '100%';
    videoWrapper.style.backgroundColor = '#000';
    videoWrapper.style.display = 'none'; // Destpêkê veşartî be
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
            img.classList.add('slider-element'); // Klasa giştî
            if (index === 0) img.classList.add('active');
            
            img.style.width = '100%';
            img.style.flexShrink = '0';
            img.style.display = (index === 0) ? 'block' : 'none'; // Kontrola dîtinê
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
    const videoId = parseYouTubeId(product.externalLink); // Fonksiyona alîkar bikar bîne

    if (videoId) {
        const videoIndex = sliderElements.length; // Ev dibe îndeksa paşîn
        
        imageContainer.appendChild(videoWrapper);
        sliderElements.push(videoWrapper); // Têxe nav rêzê

        // Thumbnailek ji bo vîdyoyê çêke
        const thumb = document.createElement('img');
        thumb.src = `https://img.youtube.com/vi/${videoId}/0.jpg`; // Thumbnaila YouTube
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
    // === DAWÎYA GUHERTINA 2 ===

    let currentIndex = 0;
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    // === GUHERTINA 3: Logika `updateSlider` hate nûve kirin ===
    // === گۆڕانکاری ٣: لۆجیکی `updateSlider` نوێکرایەوە ===
    function updateSlider(index) {
        if (!sliderElements[index]) return;

        // Vîdyoya KEVN rawestîne (eger hebe)
        // ڤیدیۆ کۆنەکە بوەستێنە (ئەگەر هەبێت)
        const oldElement = sliderElements[currentIndex];
        if (oldElement.id === 'videoPlayerWrapper') {
            oldElement.innerHTML = ''; // iframe rake (iframeـەکە لادەبات)
        }

        // Hemî elementan veşêre
        sliderElements.forEach(el => {
            el.style.display = 'none';
            el.classList.remove('active');
        });
        // Hemî thumbnailan neçalak bike
        thumbnailElements.forEach(thumbEl => {
            const img = thumbEl.querySelector('.thumbnail') || thumbEl;
            img.classList.remove('active');
        });

        // Elementa nû nîşan bide
        const activeElement = sliderElements[index];
        if (activeElement.id === 'videoPlayerWrapper') { 
            // Ev vîdyo ye, loma em iframe çêdikin
            // ئەمە ڤیدیۆیە، بۆیە iframeـەکە دروست دەکەین
            activeElement.style.display = 'flex';
            
            // === GUHERTINA 4: `autoplay=1&mute=1` hate zêdekirin ===
            // === گۆڕانکاری ٤: `autoplay=1&mute=1` زیادکرا ===
            const videoSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&mute=1`;
            // === DAWÎYA GUHERTINA 4 ===
            
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
            // Ev wêne ye
            // ئەمە وێنەیە
            activeElement.style.display = 'block';
        }
        activeElement.classList.add('active');

        // Thumbnaila nû çalak bike
        const activeThumb = thumbnailElements[index].querySelector('.thumbnail') || thumbnailElements[index];
        activeThumb.classList.add('active');
        
        currentIndex = index; // Li dawiyê indexê nû bike
    }
    // === DAWÎYA GUHERTINA 3 ===

    // Bişkokên slayderê nîşan bide/veşêre
    const showSliderBtns = sliderElements.length > 1;
    prevBtn.style.display = showSliderBtns ? 'flex' : 'none';
    nextBtn.style.display = showSliderBtns ? 'flex' : 'none';

    // Guhdarên (listeners) kevn rake
    prevBtn.onclick = null;
    nextBtn.onclick = null;
    
    // Guhdarên nû zêde bike
    if(showSliderBtns) {
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + sliderElements.length) % sliderElements.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % sliderElements.length);
    }
    thumbnailElements.forEach((el, index) => {
        el.onclick = () => updateSlider(index);
    });

    // === DAWÎYA KODA SLAYDERA VÎDYOYÊ ===
    // === کۆتایی کۆدی سلایدەری ڤیدیۆ ===


    // Zanyariyên kaڵا nû bike (Ev koda te ya heyî ye)
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Formatter bikar bîne

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // === RAKIRINA BIŞKOKA LINKÊ DEREKÎ ===
    // === سڕینەوەی دوگمەی لینکی دەرەki ===
    const oldLinkContainer = document.getElementById('sheetExternalLinkContainer');
    if (oldLinkContainer) {
        oldLinkContainer.remove();
    }
    // === DAWÎYA RAKIRINÊ ===
    // === کۆتایی سڕینەوە ===


    // Bişkoka Zêdekirina bo Sebetê (Ev koda te ya heyî ye)
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        handleAddToCartUI(product.id, addToCartButton); // UI handler bikar bîne
    };

    // Beşa Kaڵayên Pêwendîdar nîşan bide
    renderRelatedProductsUI(product);

    // Sheetê veke û dîrokê nû bike
    openPopup('productDetailSheet');
}

async function renderRelatedProductsUI(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none'; // Destpêkê veşêre

    const relatedProducts = await fetchRelatedProducts(currentProduct); // Daneyan bîne

    if (relatedProducts && relatedProducts.length > 0) {
        relatedProducts.forEach(product => {
            const card = createProductCardElementUI(product); // Elementa UI çêke
            container.appendChild(card);
        });
        section.style.display = 'block'; // Beşê nîşan bide eger kaڵا hebin
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

    updateLastSeenAnnouncementTimestamp(latestTimestamp); // Timestamp di core/localStorage de nû bike
    notificationBadge.style.display = 'none'; // Piştî dîtinê badge veşêre
}

// === START: KODA NÛ / کۆدی نوێ ===
/**
 * Peyamên chatê di sheeta chatê de nîşan dide.
 * نامەکانی چات لە شاشەی چات پیشان دەدات.
 * @param {string} userId - IDya bikarhênerê têketî.
 */
async function renderChatMessagesUI(userId) {
    if (!userId) {
        chatLoadingSpinner.style.display = 'none';
        chatMessagesContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Ji kerema xwe têkeve da ku peyamên xwe bibînî.</p>';
        return;
    }
    
    chatLoadingSpinner.style.display = 'block';
    chatMessagesContainer.innerHTML = ''; // Paqij bike

    // Guhdarê peyaman saz bike
    // گوێگری نامەکان دابنێ
    getChatMessagesListener(userId, (messages) => {
        chatLoadingSpinner.style.display = 'none';
        chatMessagesContainer.innerHTML = ''; // Ji nû ve paqij bike ji bo nûvekirinan

        if (messages.length === 0) {
            chatMessagesContainer.innerHTML = '<div class="cart-empty" style="padding-top: 40px;"><i class="fas fa-comments"></i><p>هیچ نامەیەک نییە. یەکەم نامە بنێرە!</p></div>';
            return;
        }

        messages.forEach(msg => {
            const messageElement = document.createElement('div');
            const user = auth.currentUser;
            
            // Kontrol bike ka peyam ji aliyê bikarhênerê têketî ve hatiye şandin an ji aliyê admin ve
            // پشکنین بکە بزانە نامەکە لەلایەن بەکارهێنەری لۆگینبوو نێردراوە یان ئەدمین
            // Em texmîn dikin ku admin dê IDyek taybet wek 'ADMIN' hebe
            // ئێمە وا دادەنێین کە ئەدمین ئایدییەکی تایبەتی وەک 'ADMIN'ـی دەبێت
            const messageClass = (msg.senderId === user.uid) ? 'user' : 'admin';
            
            messageElement.className = `chat-message ${messageClass}`;
            
            const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            messageElement.innerHTML = `
                <div>${formatDescription(msg.text)}</div>
                <div class="chat-message-time">${time}</div>
            `;
            chatMessagesContainer.appendChild(messageElement);
        });

        // Skrol bike bo binê peyaman
        // سکڕۆڵ بکە بۆ خوارەوەی نامەکان
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    });
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


function updateAdminUIAuth(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

    const adminSections = [ /* ... hemî IDyên beşên admin ... */
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

    // Kaڵayên di favorites an detail de ji nû ve nîşan bide da ku bişkokên admin nîşan bide/veşêre
    const favoritesSheet = document.getElementById('favoritesSheet');
    if (favoritesSheet?.classList.contains('show')) {
        renderFavoritesPageUI();
    }
    const detailSheet = document.getElementById('productDetailSheet');
    if (detailSheet?.classList.contains('show') && state.currentProductId) {
        fetchProductById(state.currentProductId).then(product => {
            if (product) showProductDetailsUI(product); // Detail sheet ji nû ve nîşan bide
        });
    }
}


// --- UI Event Handlers ---

async function handleAddToCartUI(productId, buttonElement) {
    const result = await addToCartCore(productId); // Logika core bang bike
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) {
        updateCartCountUI(); // Hejmara UI nû bike
        // Animasyona bişkokê eger hatibe dayîn
        if (buttonElement && !buttonElement.disabled) {
            const originalContent = buttonElement.innerHTML;
            buttonElement.disabled = true;
            buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Rewşa barkirinê
            setTimeout(() => {
                buttonElement.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Rewşa zêdekirî
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent; // Vegerandina rewşê
                    buttonElement.disabled = false;
                }, 1500);
            }, 500);
        }
    }
}

function handleUpdateQuantityUI(productId, change) {
    if (updateCartQuantityCore(productId, change)) { // Logika core bang bike
        renderCartUI(); // UIya sebetê ji nû ve nîşan bide
        updateCartCountUI(); // Hejmara giştî nû bike
    }
}

function handleRemoveFromCartUI(productId) {
    if (removeFromCartCore(productId)) { // Logika core bang bike
        renderCartUI(); // UIya sebetê ji nû ve nîşan bide
        updateCartCountUI(); // Hejmara giştî nû bike
    }
}

function handleToggleFavoriteUI(productId) {
    const result = toggleFavoriteCore(productId); // Logika core bang bike
    showNotification(result.message, result.favorited ? 'success' : 'error');

    // Hemî îkonên dilê yên pêwendîdar li ser rûpelê nû bike
    document.querySelectorAll(`[data-product-id="${productId}"] .favorite-btn`).forEach(btn => {
        btn.classList.toggle('favorited', result.favorited);
        const icon = btn.querySelector('.fa-heart');
        if (icon) {
            icon.classList.toggle('fas', result.favorited);
            icon.classList.toggle('far', !result.favorited);
        }
    });

    // Eger sheeta favorites vekirî be, wê ji nû ve nîşan bide
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPageUI();
    }
}


// === START: KODA NÛ / کۆدی نوێ ===
// Fonksiyonên alîkar ji bo birêvebirina herikîna chatê
// فەنکشنە یاریدەدەرەکان بۆ بەڕێوەبردنی ڕێڕەوی چات

/**
 * Dema ku bikarhêner hewl dide bi rêya chata navxweyî fermanekê bişîne, tê bang kirin.
 * کاتێک بەکارهێنەر هەوڵ دەدات لەڕێگەی چاتی ناوخۆییەوە داواکارییەک بنێرێت، بانگ دەکرێت.
 */
async function handleSendOrderViaChat() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        // Bikarhêner têketî nîne. Em wî dişînin bo têketina bi têlefonê.
        // بەکارهێنەر لۆگین نییە. دەینێرین بۆ لۆگینکردن بە مۆبایل.
        showNotification(t('login_to_chat'), 'success');
        state.pendingChatAction = 'send_order'; // Em armanca wî tomar dikin
        openPopup('phoneLoginModal', 'modal');
        return;
    }

    // Bikarhêner têketî ye. Em fermanê dişînin.
    // بەکارهێنەر لۆگین بووە. داواکارییەکە دەنێرین.
    const orderMessage = generateOrderMessageCore();
    if (!orderMessage) {
        showNotification("Sebeteya we vala ye!", "error");
        return;
    }

    const sendingNotification = document.createElement('div');
    sendingNotification.className = 'notification success show';
    sendingNotification.textContent = '...خەریکی ناردنی داواکارییەکەتە';
    document.body.appendChild(sendingNotification);

    const success = await sendChatMessage(currentUser.uid, orderMessage);

    if (success) {
        sendingNotification.textContent = 'داواکارییەکەت بە سەرکەوتوویی نێردرا!';
        setTimeout(() => {
            sendingNotification.classList.remove('show');
            setTimeout(() => document.body.removeChild(sendingNotification), 300);
        }, 2000);
        
        state.cart = []; // Sebete vala bike
        saveCart(); // Sebete tomar bike
        updateCartCountUI(); // Hejmarê nû bike
        
        closeCurrentPopup(); // Sheeta sebetê bigire
        openPopup('chatSheet'); // Sheeta chatê veke da ku peyamê bibîne
    } else {
        sendingNotification.textContent = 'هەڵەیەک ڕوویدا لە ناردنی داواکاری!';
        sendingNotification.classList.remove('success');
        sendingNotification.classList.add('error');
        setTimeout(() => {
            sendingNotification.classList.remove('show');
            setTimeout(() => document.body.removeChild(sendingNotification), 300);
        }, 3000);
    }
}

/**
 * Dema ku bikarhêner li ser bişkoka "Namekan" di nav-a jêrîn de bitikîne, tê bang kirin.
 * کاتێک بەکارهێنER کلیک لە دوگمەی "نامەکان" لە navـی خوارەوە دەکات، بانگ دەکرێت.
 */
async function handleOpenChatSheet() {
    updateActiveNav('chatBtn'); // Bişkokê çalak bike
    const currentUser = auth.currentUser;

    if (!currentUser) {
        // Bikarhêner têketî nîne. Wî bişîne bo têketinê.
        // بەکارهێنەر لۆگین نییە. بینێرە بۆ لۆگینکردن.
        state.pendingChatAction = 'open_chat'; // Armancê tomar bike
        openPopup('phoneLoginModal', 'modal');
        return;
    }

    // Bikarhêner têketî ye. Sheeta chatê veke.
    // بەکارهێنەر لۆگین بووە. شاشەی چات بکەوە.
    openPopup('chatSheet');
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// --- Setup Functions ---

function setupUIEventListeners() {
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        // Fîlteran sifir bike û refresh bike
        await navigateToFilterCore({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        await updateProductViewUI(true, true); // Piştrast bike ku home ji nû ve tê nîşandan
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => { history.back(); };

    // === START: KODA NÛ / کۆدی نوێ ===
    // Em bişkoka profaylê ya kevn bi ya chatê diguherînin
    // ئێمە دوگمە کۆنەکەی پڕۆفایل بە هی چات دەگۆڕین
    // profileBtn.onclick = () ... (HATE RAKIRIN)
    chatBtn.onclick = handleOpenChatSheet; // Bişkoka chatê ya nav-ê girê bide
    settingsProfileBtn.onclick = () => { openPopup('profileSheet'); }; // Bişkoka profaylê ya 'Settings' girê bide
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

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

    // Forma Login (Admin)
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await handleLogin(document.getElementById('email').value, document.getElementById('password').value);
            closeCurrentPopup(); // Modalê bigire
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    // Lêgerîna Sereke (li ser rûpela malê)
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
            await renderProductsOnDetailPageUI(subCatId, subSubCatId, term); // Kaڵayên li ser rûpela detail ji nû ve nîşan bide
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
    profileForm.onsubmit = async (e) => {
        e.preventDefault();
        
        // === START: KODA NÛ / کۆدی نوێ ===
        // Em logica profaylê nû dikin da ku ji bo bikarhênerên nû yên têlefonê jî kar bike
        // ئێمە لۆجیکی پڕۆفایل نوێ دەکەینەوە بۆ ئەوەی بۆ بەکارهێنەرانی نوێی mۆbایلیش کار بکات
        const currentUser = auth.currentUser;
        let userId;
        let userPhone;

        if (currentUser) {
            // Bikarhêner bi têlefonê têketî ye
            // بەکارهێنەر بە مۆbایل لۆگین بووە
            userId = currentUser.uid;
            userPhone = currentUser.phoneNumber;
        } else {
            // Bikarhênerê normal (profîla kevn)
            // بەکارهێنەری ئاسایی (پڕۆفایلی کۆن)
            userId = 'localUser'; // IDyek giştî
            userPhone = document.getElementById('profilePhone').value;
        }
        
        const profileData = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: userPhone, // Hejmara têlefonê ya tomarkirî bikar bîne
        };

        let message;
        if (currentUser) {
            // Profîlê di Firestore de tomar bike
            // پڕۆفایل لە فایەرستۆر پاشەکەوت بکە
            const success = await saveUserProfile(userId, profileData.name, profileData.phone);
            message = success ? t('profile_saved') : t('error_generic');
            if (success) {
                // Daneyên profîla herêmî jî nû bike
                // داتای پڕۆفایلی ناوخۆیش نوێ بکەوە
                saveProfileCore(profileData); 
            }
        } else {
            // Profîla herêmî (localStorage) tomar bike
            // پڕۆفایلی ناوخۆیی (localStorage) پاشەکەوت بکە
            message = saveProfileCore(profileData);
        }
        
        showNotification(message, 'success');
        closeCurrentPopup();

        // Piştî tomarkirina profîlê, kontrol bike ka karek li bendê ye
        // دوای پاشەکەوتکردنی پڕۆفایل، پشکنین بکە بزانە کارێک چاوەڕێیە
        if (state.pendingChatAction === 'send_order') {
            state.pendingChatAction = null; // Sifir bike
            await handleSendOrderViaChat(); // Fermanê bişîne
        } else if (state.pendingChatAction === 'open_chat') {
            state.pendingChatAction = null; // Sifir bike
            await handleOpenChatSheet(); // Chatê veke
        }
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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

    // Biškoka Install
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', () => handleInstallPrompt(installBtn));
    }

    // Biškoka Çalakirina Agahdariyan
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', async () => {
        const result = await requestNotificationPermissionCore();
        showNotification(result.message, result.granted ? 'success' : 'error');
    });

    // Biškoka Nûkirina Bi Zorê
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
                     await updateProductViewUI(false); 
                 }
                 scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
            }
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    }
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // --- Guhdarên Bûyerên Chata Nû ---
    // --- گوێگرە نوێیەکانی چات ---

    phoneLoginForm.onsubmit = async (e) => {
        e.preventDefault();
        const phoneNumber = document.getElementById('phoneNumber').value;
        const submitButton = phoneLoginForm.querySelector('button[type="submit"]');
        phoneLoginError.style.display = 'none';

        submitButton.disabled = true;
        submitButton.textContent = '...چاوەڕێ بە';
        
        const result = await sendVerificationCode(phoneNumber);

        if (result.success) {
            closeCurrentPopup(); // Moda têlefonê bigire
            openPopup('verifyCodeModal', 'modal'); // Moda kodê veke
        } else {
            phoneLoginError.textContent = result.message;
            phoneLoginError.style.display = 'block';
        }
        
        submitButton.disabled = false;
        submitButton.textContent = t('send_code_button');
    };

    verifyCodeForm.onsubmit = async (e) => {
        e.preventDefault();
        const code = document.getElementById('verificationCode').value;
        const submitButton = verifyCodeForm.querySelector('button[type="submit"]');
        verifyCodeError.style.display = 'none';

        submitButton.disabled = true;
        submitButton.textContent = '...پشتڕاست دەکرێتەوە';
        
        const result = await verifyCode(code);

        if (result.success) {
            // Têketin serketî bû!
            // لۆگین سەرکەوتوو بوو!
            const userProfile = await getUserProfile(result.userId);
            closeCurrentPopup(); // Moda kodê bigire

            if (!userProfile || !userProfile.name) {
                // Bikarhênerek nû ye, wî bişîne bo profaylê da ku navê xwe tomar bike
                // بەکارهێنەرێکی نوێیە، بینێرە بۆ پڕۆفایل با ناوی خۆی تۆمار بکات
                showNotification("تکایە ناوی خۆت تۆمار بکە", "success");
                openPopup('profileSheet');
                // Hejmara têlefonê jixweber di `openPopup` de tê dagirtin
            } else {
                // Bikarhênerê kevn e û profîla wî heye
                // بەکارهێنەری کۆنە و پڕۆفایلی هەیە
                
                // Tiştê ku berî têketinê hewl dida bike, temam bike
                // ئەو شتەی پێش لۆگینکردن هەوڵی بۆ دەدا، تەواوی بکە
                if (state.pendingChatAction === 'send_order') {
                    state.pendingChatAction = null; // Sifir bike
                    await handleSendOrderViaChat(); // Fermanê bişîne
                } else if (state.pendingChatAction === 'open_chat') {
                    state.pendingChatAction = null; // Sifir bike
                    await handleOpenChatSheet(); // Chatê veke
                } else {
                    // Tenê têketî bû, sheeta chatê veke
                    // تەنها لۆگین بوو، شاشەی چات بکەوە
                    await handleOpenChatSheet();
                }
            }
        } else {
            verifyCodeError.textContent = result.message;
            verifyCodeError.style.display = 'block';
        }
        
        submitButton.disabled = false;
        submitButton.textContent = t('verify_button');
    };

    chatMessageForm.onsubmit = async (e) => {
        e.preventDefault();
        const text = chatMessageInput.value;
        if (text.trim() === "" || !auth.currentUser) return;
        
        const tempMessageText = text; // Peyamê tomar bike
        chatMessageInput.value = ""; // Inputê vala bike
        
        const success = await sendChatMessage(auth.currentUser.uid, tempMessageText);
        
        if (!success) {
            // Peyam nehat şandin, wê vegerîne inputê
            // نامەکە نەنێردرا، بیگەڕێنەوە بۆ ئینپوت
            chatMessageInput.value = tempMessageText;
            showNotification(t('error_generic'), 'error');
        }
        // Guhdarê onSnapshot dê UIyê bixweber nû bike
        // گوێگری onSnapshot خۆکارانە UI نوێ دەکاتەوە
    };
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===


    // --- Guhdarên Bûyerên Taybet (ji app-core) ---
    document.addEventListener('authChange', (e) => {
        updateAdminUIAuth(e.detail.isAdmin);
        if(e.detail.isAdmin && loginModal.style.display === 'block') {
             closeCurrentPopup();
        }
        
        // === START: KODA NÛ / کۆدی نوێ ===
        // Eger bikarhêner ji her derê derkeve (mînak, admin), em wî ji chatê jî derdixin
        // ئەگەر بەکارهێنەر لە هەر شوێنێک چووە دەرەوە (بۆ نموونە، ئەدمین)، ئێمە لە چاتیش دەریدەکەین
        if (!auth.currentUser) {
            stopChatMessagesListener(); // Guhdarê chatê bigire
            if (chatSheet.classList.contains('show')) {
                closeCurrentPopup(); // Sheeta chatê bigire eger vekirî be
            }
        }
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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
    setLanguageCore(lang); // Stata core û localStorage nû bike

    // Nivîsara statîk tavilê nû bike
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if(element.placeholder) element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });

    // Bişkoka zimanê çalak nû bike
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Naveroka dînamîk a ku bi ziman ve girêdayî ye ji nû ve nîşan bide
    renderCategoriesSheetUI(); 
    if (document.getElementById('cartSheet').classList.contains('show')) renderCartUI();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPageUI();
    await updateProductViewUI(true, true); // Wekî lêgerînek nû bihesibîne da ku her tiştî bi zimanê nû nîşan bide
    await renderContactLinksUI();

    // Lîsteyên admin ji nû ve nîşan bide eger admin çalak be
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

// *** START: Gۆڕanlکاری lێرە kra (Logica Popstate bi tevahî hate nûve kirin) ***
// *** دەستپێک: گۆڕانکاری لێرە کرا (لۆجیکی Popstate بە تەواوی نوێکرایەوە) ***
window.addEventListener('popstate', async (event) => {
    const wasPopupOpen = state.currentPopupState !== null; 
    const previousPageId = state.currentPageId; 

    state.currentPopupState = null; 
    closeAllPopupsUI(); // Her gav hemî popupên dîtbar bigire (هەمیشە هەموو پۆپئەپە دیارەکان دابخە)

    const popState = event.state;
    const activePage = document.getElementById(state.currentPageId); // Rûpela çalak a *niha* bistîne (پەڕەی چالاکی *ئێستا* وەربگرە)
    
    if (!activePage) {
        console.error("Popstate error: Could not find active page element.");
        return;
    }

    if (popState) {
        if (popState.type === 'page') {
            // Vegerîna li rûpelek (mînak, Settings)
            // گەڕانەوە بۆ پەڕەیەک (بۆ نموونە، ڕێکخستنەکان)
            showPage(popState.id, popState.title); 
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true);
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Ev rewş divê çênebe eger em bişkoja 'paş' bikar bînin, lê ji bo pêşveçûnê
            // ئەم حاڵەتە نابێت ڕووبدات ئەگەر دوگمەی 'گەڕانەوە' بەکاربهێنین، بەڵام بۆ 'پێشەوە'
            openPopup(popState.id, popState.type); 
        } else {
            // Gihîştina rewşek filterê ya rûpela serekî (mainPage)
            // گەیشتن بە دۆخێکی فلتەری لاپەڕەی سەرەki
            showPage('mainPage'); 
            applyFilterStateCore(popState); 

            const cameFromPopup = wasPopupOpen;
            const cameFromPage = previousPageId !== 'mainPage';

            if (!cameFromPopup && !cameFromPage) {
                // Li ser rûpela serekî bû û çû rewşek filterê ya din
                // لەسەر لاپەڕەی سەرەki بوویت و چوویتە دۆخێکی تری فلتەر
                console.log("Popstate: Navigating between filter states, triggering refresh WITHOUT scroll.");
                await updateProductViewUI(true, false); // false = skrol neke jor (سکڕۆڵ مەکە سەرەوە)
            } else {
                // Ji popupê an rûpelek din vegeriya
                // لە پۆپئەپێک یان پەڕەیەکی تر گەڕایتەوە
                console.log(`Popstate: Returned from ${cameFromPopup ? 'popup' : (cameFromPage ? 'page' : 'unknown')}, restoring UI without full refresh.`);
                renderMainCategoriesUI();
                const subcats = await fetchSubcategories(state.currentCategory);
                await renderSubcategoriesUI(subcats);
            }

            // *** Logica Vegerandina Skrolê (Logica nû) ***
            // *** لۆجیکی گەڕاندنەوەی سکڕۆڵ (لۆجیکی نوێ) ***
            
            // ***************************************************************
            // *** DESTPÊKA GUHERTINA JI BO KÊŞEYA SKROLÊ ***
            // *** PO EV BEŞ HATE GUHERTIN ***
            // TENÊ skrolê vegerîne EGER fîlterek nû li bendê NEBE
            // چاکسازی: تەنها سکڕۆڵ بگەڕێنەوە ئەگər فلتەرێکی نوێ چاوەڕێ نەبێت
            if (!state.pendingFilterNav) { 
                if (typeof popState.scroll === 'number') {
                    requestAnimationFrame(() => {
                        // Rûpela çalak skrol bike (پەڕە چالاکەکە سکڕۆڵ بکە)
                        activePage.scrollTo({ top: popState.scroll, behavior: 'instant' });
                    });
                } else {
                    requestAnimationFrame(() => {
                        activePage.scrollTo({ top: 0, behavior: 'instant' });
                    });
                }
            }
            // *** DAWÎYA GUHERTINÊ ***
            // ***************************************************************
            
            // *** Logica Fîltera Li Bendê (Logica nû) ***
            // *** لۆجیکی فلتەری چاوەڕوانکراو (لۆجیکی نوێ) ***
            if (state.pendingFilterNav) {
                console.log("Found pending filter navigation. Applying now.");
                const filterToApply = state.pendingFilterNav;
                state.pendingFilterNav = null; // Berî navîgasyonê paqij bike (پێش گواستنەوە پاکی بکەوە)
                
                // Hinekî bisekine da ku vegerandina skrolê biqede, paşê fîlterê bicîh bîne
                // کەمێک بوەستە با گەڕانەوەی سکڕۆڵ تەواو بێت، پاشان فلتەرەکە جێبەجێ بکە
                setTimeout(async () => {
                    await navigateToFilterCore(filterToApply);
                    await updateProductViewUI(true, true); // true, true = lêgerîna nû, skrol bike jor (گەڕانی نوێ، سکڕۆڵ بکە سەرەوە)
                }, 50); // 50ms derengî (50 میلی چرکە دواکەوتن)
            }
        }
    } else {
        // Rewşa destpêkê (default)
        // دۆخی سەرەتایی
        console.log("Popstate: No state found, loading default main page.");
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage'); 
        applyFilterStateCore(defaultState);
        await updateProductViewUI(true, true); 
        requestAnimationFrame(() => {
             // Rûpela çalak skrol bike jor (پەڕە چالاکەکە سکڕۆڵ بکە سەرەوە)
             const homePage = document.getElementById('mainPage');
             if(homePage) homePage.scrollTo({ top: 0, behavior: 'instant' });
        });
    }
});
// *** END: Gۆڕanlکاری lێرە kra ***
// *** کۆتایی: Gۆڕanlکاری lێرە kra ***


async function initializeUI() {
    // Await core initialization first
    await initCore(); // Initialize core logic (enables persistence, fetches initial data)
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em reCAPTCHA ji bo têketina bi têlefonê amade dikin
    // ئێمە reCAPTCHA بۆ لۆگینکردن بە مۆbایل ئامادە دەکەین
    // Em vê yekê piştî initCore bang dikin da ku piştrast bin ku 'auth' amade ye
    // ئێمە ئەمە دوای initCore بانگ دەکەین بۆ دڵنیابوون لەوەی 'auth' ئامادەیە
    try {
        await initPhoneAuth();
    } catch (e) {
        console.error("Failed to initialize reCAPTCHA on load:", e);
    }
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===


    // Initial language application (static text)
    setLanguageCore(state.currentLanguage); // Set core state
     document.querySelectorAll('[data-translate-key]').forEach(element => { // Apply static text
         const key = element.dataset.translateKey;
         const translation = t(key);
         if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') { if(element.placeholder) element.placeholder = translation; }
         else { element.textContent = translation; }
    });
     document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === state.currentLanguage)); // Set active lang button

    // Render initial dynamic UI elements that are NOT home-specific
    renderCategoriesSheetUI();

    // Setup basic UI event listeners
    setupUIEventListeners();

    // Handle initial page load based on URL (hash/query params) AFTER core init
    handleInitialPageLoadUI(); // Categories should be ready now

    // Render dynamic contact links
    renderContactLinksUI();

    // Check notification status
    const announcements = await fetchAnnouncements();
     if(announcements.length > 0 && checkNewAnnouncementsCore(announcements[0].createdAt)) {
         notificationBadge.style.display = 'block';
     }

    // Show welcome message only on first visit
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

    if (isSettings) {
         history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
         showPage('settingsPage', t('settings_title'));
    } else if (isSubcategoryDetail) {
         const ids = hash.split('_');
         const mainCatId = ids[1];
         const subCatId = ids[2];
         // Ensure categories are loaded before showing detail page
         if (state.categories.length > 0) { // Check if categories are loaded (state.categories includes 'all')
              await showSubcategoryDetailPageUI(mainCatId, subCatId, true); // true = fromHistory/initial load
         } else {
             // Fallback to main page if categories aren't ready (should be rare now)
             console.warn("Categories not ready on initial load, showing main page instead of detail.");
             showPage('mainPage');
             await updateProductViewUI(true, true); // (imported from home.js)
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
         history.replaceState(initialState, ''); // Set initial history state for main page
         applyFilterStateCore(initialState); // Apply the state
         await updateProductViewUI(true, true); // Render content based on state (imported from home.js)

         // Check if a specific popup needs to be opened on initial load
         const element = document.getElementById(hash);
         if (element) {
              const isSheet = element.classList.contains('bottom-sheet');
              const isModal = element.classList.contains('modal');
              if (isSheet || isModal) {
                   // === START: KODA NÛ / کۆدی نوێ ===
                   // Em nahêlin ku pop-upên taybet bixweber vebin
                   // ئێمە ڕێگە نادەین پۆپئەپە تایبەتەکان خۆکارانە بکرێنەوە
                   if (hash !== 'phoneLoginModal' && hash !== 'verifyCodeModal') {
                        // Em chatê tenê vedikin eger bikarhêner têketî be
                        // ئێمە چات تەنها دەکەینەوە ئەگەر بەکارهێنەر لۆگین بووبێت
                        if (hash === 'chatSheet' && !auth.currentUser) {
                            // Veke neke
                        } else {
                           openPopup(hash, isSheet ? 'sheet' : 'modal');
                        }
                   }
                   // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
              }
         }

         // Check if a specific product detail needs to be shown
          const productId = params.get('product');
          if (productId) {
               const product = await fetchProductById(productId);
               if (product) {
                    setTimeout(() => showProductDetailsUI(product), 300); // Delay slightly
               }
          }
    }
}

async function renderContactLinksUI() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    // Fetch social links data
     try {
         // *** Ensure collection is correctly imported/available ***
         const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
         const q = query(socialLinksCollection, orderBy("createdAt", "desc"));
         const snapshot = await getDocs(q); // Use getDocs for one-time fetch

         contactLinksContainer.innerHTML = ''; // Clear previous links

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
window.globalAdminTools.showNotification = showNotification; // *** Ev hate zêdekirin ***

console.log('openPopup, closeCurrentPopup, & showNotification ji bo admin.js hatin zêdekirin.');
// ======== DAWÎYA PIRA ========
