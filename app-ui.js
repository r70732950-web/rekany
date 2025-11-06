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
    addPromoGroupForm, promoGroupsListContainer, addPromoCardForm,
    addBrandGroupForm, brandGroupsListContainer, addBrandForm,
    shortcutRowsListContainer, addShortcutRowForm, addCardToRowForm,
    homeLayoutListContainer, addHomeSectionBtn, addHomeSectionModal, addHomeSectionForm,
    
    // === START: KODÊN NÛ YÊN DOM / کۆدە نوێیەکانی DOM ===
    phoneAuthModal, phoneAuthForm, sendCodeBtn, verifyCodeForm, verifyCodeBtn,
    cancelVerificationBtn, recaptchaContainer, localChatBtn, profileLoginPrompt,
    profileLoginBtn, userLogoutBtn, chatSheet, chatMessagesContainer,
    chatMessageForm, chatMessageInput, chatSendBtn, chatFabBtn,
    adminChatManagement, adminChatListContainer
    // === END: KODÊN NÛ YÊN DOM / کۆتایی کۆدە نوێیەکانی DOM ===

} from './app-setup.js';

import {
    // Import state and core logic functions
    state, // *** Import state from app-setup ***
    t, debounce, formatDescription,
    handleLogin, handleLogout,
    fetchCategories, fetchProductById, fetchProducts, fetchSubcategories, 
    fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, fetchSubSubcategories,
    addToCartCore, updateCartQuantityCore, removeFromCartCore, generateOrderMessageCore,
    toggleFavoriteCore, isFavorite, // saveFavorites êdî ne pêwîst e / ئیتر پێویست نییە
    saveProfileCore, setLanguageCore,
    requestNotificationPermissionCore, checkNewAnnouncementsCore, updateLastSeenAnnouncementTimestamp,
    handleInstallPrompt, forceUpdateCore,
    saveCurrentScrollPositionCore, applyFilterStateCore, navigateToFilterCore,
    initCore,
    
    // === START: KODÊN NÛ YÊN CORE / کۆدە نوێیەکانی CORE ===
    setupRecaptchaCore, sendVerificationCodeCore, verifyCodeCore, handleUserLogoutCore,
    sendChatMessageCore, generateCartSummaryMessageCore, listenForChatMessages,
    listenForAdminChatList, markChatAsReadCore,
    // === END: KODÊN NÛ YÊN CORE / کۆتایی کۆدە نوێیەکانی CORE ===

    // Firestore functions exported from app-core.js
    db,
    collection, doc, getDoc, query, where, orderBy, getDocs, limit, startAfter, productsCollection
} from './app-core.js';

import {
    renderHomePageContentUI, updateProductViewUI, renderMainCategoriesUI, renderSubcategoriesUI
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
            if (pageId === 'settingsPage') {
                subpageSearch.style.display = 'none'; 
            } else {
                subpageSearch.style.display = 'block';
            }
        }
    }
}

function showPage(pageId, pageTitle = '') {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    } else { 
         updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
}


function stopAllVideos() {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    const videoWrapper = document.getElementById('videoPlayerWrapper');
    if (videoWrapper) {
        videoWrapper.innerHTML = ''; 
    }
}

function parseYouTubeId(url) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
            // === START: KODA GÛHERTÎ / کۆدی گۆڕاو ===
            // Em êdî profîlê rasterast li vir dananîn, 'renderUserProfileUI' dê vê bike
            // ئێمە ئیتر پڕۆفایل ڕاستەوخۆ لێرە دانانێین، 'renderUserProfileUI' ئەمە دەکات
            renderUserProfileUI();
            // === END: KODA GÛHERTÎ / کۆتایی کۆدی گۆڕاو ===
        }
        // === START: KODA NÛ / کۆدی نوێ ===
        if (id === 'chatSheet') {
            // Dema ku bikarhêner bi destan li ser bişkoja chatê ya FAB bitikîne
            // کاتێک بەکارهێنەر بە دەستی کلیک لە دوگمەی چاتی FAB دەکات
            renderChatSheetUI();
        }
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    } else { // type === 'modal'
        element.style.display = 'block';
        
        // === START: KODA NÛ / کۆدی نوێ ===
        // Ger ew modala authê be, recaptcha saz bike
        // ئەگەر مۆداڵی Auth بێت، ڕیکاپچا دابنێ
        if (id === 'phoneAuthModal') {
            renderPhoneAuthUI('phone'); // Forma têlefonê nîşan bide (فۆڕمی مۆبایل پیشان بدە)
            setupRecaptchaCore('recaptcha-container');
        }
        // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function updateCartCountUI() {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}


// --- Rendering Functions (UI specific) ---

export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    if (!container) {
        console.error("Skeleton loader container not found:", container);
        return;
     }
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
            showProductDetailsUI(product);
        }
    });

    return productCard;
}

export function setupScrollAnimations() { 
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    // ... (Ev kod wek xwe dimîne, lê em ê renderCartActionButtonsUI bang bikin) ...
    // ... (ئەم کۆدە وەک خۆی دەمێنێتەوە، بەڵام بانگی renderCartActionButtonsUI دەکەین) ...
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
    renderCartActionButtonsUI(); // <<-- Ev girîng e / ئەمە گرنگە

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

    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => handleRemoveFromCartUI(e.currentTarget.dataset.id));
}

async function renderCartActionButtonsUI() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Paqij bike (پاکی بکەوە)
    
    // === START: KODA NÛ / کۆدی نوێ ===
    // Bişkoja Chata Navxweyî her gav pêşî lê zêde bike
    // دوگمەی چاتی ناوخۆیی هەمیشە سەرەتا زیاد بکە
    const chatBtn = document.createElement('button');
    chatBtn.id = 'localChatBtn'; // Me ev ID di HTMLyê de rakir, lê em dikarin wê li vir bikar bînin
    chatBtn.className = 'whatsapp-btn'; // Heman stîl bikar bîne (هەمان ستایل بەکاربهێنە)
    chatBtn.style.backgroundColor = 'var(--primary-color)';
    chatBtn.innerHTML = `<i class="fas fa-comments"></i> <span>${t('chat_in_app')}</span>`;
    chatBtn.onclick = handleLocalChatClick; // Fonksiyona nû bang bike (بانگی فەنکشنە نوێیەکە بکە)
    container.appendChild(chatBtn);
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

    const methods = await fetchContactMethods(); // Rêbazên din bîne (ڕێگا Pترەکان بهێنە)

    if (!methods || methods.length === 0) {
        if (container.innerHTML === '') { // Tenê heke chat jî tune be (تەنها ئەگەر چاتیش نەبێت)
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        }
        return;
    }

    methods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn'; 
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
}


async function renderFavoritesPageUI() {
    favoritesContainer.innerHTML = '';

    // === START: KODA GÛHERTÎ / کۆدی گۆڕاو ===
    // Em êdî profîlê ji stateya ku ji Firestore hatiye barkirin dixwînin
    // ئێمە ئیتر پڕۆفایل لەو ستەیتەوە دەخوێنینەوە کە لە فایەرستۆرەوە هاتووە
    const favoritesList = state.favorites; // State dê jixwe ji hêla onAuthStateChanged ve hatibe barkirin
                                        // ستەیت پێشتر لەلایەن onAuthStateChangedـەوە بارکراوە
    if (favoritesList.length === 0) {
    // === END: KODA GÛHERTÎ / کۆتایی کۆدی گۆڕاو ===
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';
    renderSkeletonLoader(favoritesContainer, favoritesList.length);

    try {
        const fetchPromises = favoritesList.map(id => fetchProductById(id));
        const favoritedProducts = (await Promise.all(fetchPromises)).filter(p => p !== null);

        favoritesContainer.innerHTML = ''; 

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
             // Ger hin jê hatibin jêbirin, stateyê hevdeng bike
             // ئەگەر هەندێکیان سڕابنەوە، ستەیتەکە هاوتا بکە
            if(favoritedProducts.length !== favoritesList.length) {
                 state.favorites = favoritedProducts.map(p => p.id);
                 // Em êdî hewce nakin ku li vir tomar bikin, ji ber ku ew ê di 'toggle' de were kirin
                 // ئیتر پێویست ناکات لێرە پاشەکەوتی بکەین، چونکە لە 'toggle'ـدا دەکرێت
            }
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElementUI(product); 
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error rendering favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    }
}

function renderCategoriesSheetUI() {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    sheetCategoriesContainer.innerHTML = '';
    const homeBtn = document.createElement('button');
    homeBtn.className = 'sheet-category-btn';
    homeBtn.dataset.category = 'all'; 
    homeBtn.innerHTML = `<i class="fas fa-home"></i> ${t('nav_home')}`;
    if (state.currentCategory === 'all') { homeBtn.classList.add('active'); }
    homeBtn.onclick = async () => {
         state.pendingFilterNav = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' };
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
             state.pendingFilterNav = { category: cat.id, subcategory: 'all', subSubcategory: 'all', search: '' };
             closeCurrentPopup();
        };
        sheetCategoriesContainer.appendChild(btn);
    });
}

 async function renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId) {
     // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    renderSkeletonLoader(productsContainer, 4); 

     try {
         let conditions = [];
         let orderByClauses = [];
         if (subSubCatId === 'all') { conditions.push(where("subcategoryId", "==", subCatId)); } 
         else { conditions.push(where("subSubcategoryId", "==", subSubCatId)); }

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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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

async function showProductDetailsUI(productData) {
    // ... (Ev kod wek xwe dimîne, tevî logika vîdyoyê / ئەم کۆدە وەک خۆی دەمێنێتەوە، لەگەڵ لۆجیکی ڤیدیۆ) ...
    const product = productData || await fetchProductById(state.currentProductId); 
    if (!product) { showNotification(t('product_not_found_error'), 'error'); return; }
    state.currentProductId = product.id; 
     const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; 
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = ''; 
    thumbnailContainer.innerHTML = ''; 
    let sliderElements = []; 
    let thumbnailElements = []; 
    const videoWrapper = document.createElement('div');
    videoWrapper.id = 'videoPlayerWrapper'; 
    videoWrapper.className = 'slider-element'; 
    videoWrapper.style.cssText = 'position: relative; width: 100%; background-color: #000; display: none; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; max-height: 350px;';
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url; 
            img.alt = nameInCurrentLang; 
            img.classList.add('slider-element'); 
            if (index === 0) img.classList.add('active');
            img.style.cssText = `width: 100%; flex-shrink: 0; display: ${(index === 0) ? 'block' : 'none'}; object-fit: contain; max-height: 350px; transition: opacity 0.3s ease-in-out;`;
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
        if (oldElement.id === 'videoPlayerWrapper') { oldElement.innerHTML = ''; }
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
            activeElement.innerHTML = `<iframe src="${videoSrc}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; aspect-ratio: 16 / 9;"></iframe>`;
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
    if (oldLinkContainer) { oldLinkContainer.remove(); }
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        handleAddToCartUI(product.id, addToCartButton);
    };
    renderRelatedProductsUI(product);
    openPopup('productDetailSheet');
}

async function renderRelatedProductsUI(currentProduct) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    const adminSections = [ 
         'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
         'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
         'adminContactMethodsManagement', 'adminShortcutRowsManagement',
         'adminHomeLayoutManagement',
         // === START: KODA NÛ / کۆدی نوێ ===
         'adminChatManagement' // Beşa chatê ya admin lê zêde bike (بەشی چاتی ئەدمین زیاد بکە)
         // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
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

// === START: KODA NÛ JI BO UIya BIKARHÊNER / کۆدی نوێ بۆ UIی بەکارهێنەر ===
/**
 * UIya profîla bikarhêner nû dike li gorî rewşa têketinê.
 * UIـی پڕۆفایلی بەکارهێنەر نوێ دەکاتەوە بەپێی دۆخی لۆگینبوون.
 */
function renderUserProfileUI() {
    if (state.currentUser) {
        // Bikarhêner têketî ye (بەکارهێنەر لۆگین بووە)
        profileLoginPrompt.style.display = 'none';
        profileForm.style.display = 'block';
        userLogoutBtn.style.display = 'block';
        
        // Daneyên ji stateyê bar bike (ku ji Firestore hatiye)
        // داتا لە ستەیتەوە بار بکە (کە لە فایەرستۆرەوە هاتووە)
        document.getElementById('profileName').value = state.userProfile.name || '';
        document.getElementById('profileAddress').value = state.userProfile.address || '';
        // Hejmara têlefonê ji 'auth' bixwîne û wê ne-guhêrbar bike
        // ژمارەی مۆبایل لە 'auth' بخوێنەوە و بیکە ناچالاک
        const phoneInput = document.getElementById('profilePhone');
        phoneInput.value = state.currentUser.phoneNumber || '';
        phoneInput.disabled = true;
        
    } else {
        // Bikarhêner ne têketî ye (بەکارهێنەر لۆگین نییە)
        profileLoginPrompt.style.display = 'block';
        profileForm.style.display = 'none';
        userLogoutBtn.style.display = 'none';
        
        // Forma profîlê paqij bike (فۆڕمی پڕۆفایل پاک بکەوە)
        document.getElementById('profileName').value = '';
        document.getElementById('profileAddress').value = '';
        const phoneInput = document.getElementById('profilePhone');
        phoneInput.value = '';
        phoneInput.disabled = false;
    }
}

/**
 * UIya modala piştrastkirina têlefonê birêve dibe.
 * UIـی مۆداڵی پشتڕاستکردنەوەی مۆبایل بەڕێوە دەبات.
 * @param {'phone' | 'code'} step - Qonaxa ku were nîşan dan ('phone' an 'code')
 */
function renderPhoneAuthUI(step) {
    if (step === 'phone') {
        phoneAuthForm.style.display = 'block';
        verifyCodeForm.style.display = 'none';
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = t('send_code_btn');
    } else {
        phoneAuthForm.style.display = 'none';
        verifyCodeForm.style.display = 'block';
        verifyCodeBtn.disabled = false;
        verifyCodeBtn.textContent = t('verify_code_btn');
    }
}

// === END: KODA NÛ JI BO UIya BIKARHÊNER / کۆتایی کۆدی نوێ بۆ UIی بەکارهێنەر ===

// --- UI Event Handlers ---

async function handleAddToCartUI(productId, buttonElement) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    if (updateCartQuantityCore(productId, change)) { 
        renderCartUI();
        updateCartCountUI();
    }
}

function handleRemoveFromCartUI(productId) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    if (removeFromCartCore(productId)) { 
        renderCartUI();
        updateCartCountUI();
    }
}

async function handleToggleFavoriteUI(productId) {
    // === START: KODA GÛHERTÎ / کۆدی گۆڕاو ===
    // Naha fonksiyona bingehîn asynkron e
    // ئێستا فەنکشنە سەرەکییەکە 'async'ـە
    const result = await toggleFavoriteCore(productId); 
    // === END: KODA GÛHERTÎ / کۆتایی کۆدی گۆڕاو ===
    
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

// === START: KODA NÛ JI BO CHAT / کۆدی نوێ بۆ چات ===

// Ev tê bang kirin dema ku li ser bişkoka "Chat di Appê de" tê tikandin
// ئەمە بانگ دەکرێت کاتێک کلیک لە دوگمەی "چات لەناو ئەپ" دەکرێت
function handleLocalChatClick() {
    if (state.currentUser) {
        // Bikarhêner têketî ye, chatê veke
        // بەکارهێنەر لۆگین بووە، چات بکەوە
        renderChatSheetUI(true); // true = kurteya sebetê bişîne (پوختەی سەبەتە بنێرە)
    } else {
        // Bikarhêner ne têketî ye, modala authê veke
        // بەکارهێنەر لۆگین نییە، مۆداڵی Auth بکەوە
        openPopup('phoneAuthModal', 'modal');
    }
}

// Global variable ji bo unsubscribekirina chatê (گڵۆباڵ ڤاریابڵ بۆ unsibscribeـی چات)
let activeChatListener = null;

// UIya chatê ji bo bikarhêneran nîşan dide
// UIـی چات بۆ بەکارهێنەران پیشان دەدات
function renderChatSheetUI(sendCartSummary = false) {
    if (!state.currentUser) {
        showNotification(t('chat_login_required'), 'error');
        openPopup('phoneAuthModal', 'modal');
        return;
    }

    const userId = state.currentUser.uid;
    const chatSpinner = document.getElementById('chatLoadingSpinner');
    chatMessagesContainer.innerHTML = ''; // Paqij bike (پاکی بکەوە)
    chatMessagesContainer.appendChild(chatSpinner); // Spinner nîşan bide (سپینەر پیشان بدە)
    chatSpinner.style.display = 'block';
    
    // Guhdarê kevn rake (گوێگری کۆن لابە)
    if (activeChatListener) {
        activeChatListener();
        activeChatListener = null;
    }

    // Guhdarê nû saz bike (گوێگری نوێ دابنێ)
    activeChatListener = listenForChatMessages(userId, (messages, error) => {
        chatSpinner.style.display = 'none';
        if (error) {
            chatMessagesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
            return;
        }
        renderMessagesUI(messages); // Peyaman nîşan bide (نامەکان پیشان بدە)
        
        // Chatê wekî "xwendî" nîşan bide (چاتەکە وەک "خوێندراوە" نیشان بدە)
        markChatAsReadCore(userId, 'user');
    });

    // Ger pêwîst be, kurteya sebetê bişîne
    // ئەگەر پێویست بوو، پوختەی سەبەتە بنێرە
    if (sendCartSummary && state.cart.length > 0) {
        const summaryMessage = generateCartSummaryMessageCore();
        sendChatMessageCore(summaryMessage, userId, userId);
        // Em ê hewce nekin ku sebetê vala bikin, dibe ku bikarhêner tenê pirsiyar dike
        // پێویست ناکات سەبەتە بەتاڵ بکەینەوە، لەوانەیە بەکارهێنەر تەنها پرسیار بکات
    }

    // Sheeta chatê veke (پەنجەرەی چات بکەوە)
    openPopup('chatSheet');
}

// Peyamên chatê di UIyê de nîşan dide
// نامەکانی چات لە UI پیشان دەدات
function renderMessagesUI(messages) {
    chatMessagesContainer.innerHTML = ''; // Pêşî paqij bike (سەرەتا پاکی بکەوە)
    if (messages.length === 0) {
        chatMessagesContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-comments"></i><p>هیچ نامەیەک نییە. یەکەم کەس بە!</p></div>`;
    }

    messages.forEach(msg => {
        const msgElement = document.createElement('div');
        
        let senderType = 'admin'; // Bi texmînî admin e ( گریمان ئەدمینە)
        if (msg.senderId === state.currentUser?.uid) {
            senderType = 'user'; // Na, ew bikarhênerê heyî ye (نەخێر، بەکارهێنەری ئێستایە)
        } else if (msg.text.includes(t('chat_cart_summary_message'))) {
            senderType = 'system'; // Ev peyamek sîstem e (ئەمە نامەیەکی سیستەمە)
        }

        msgElement.className = `chat-message ${senderType}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.innerHTML = formatDescription(msg.text); // formatDescription bikar bîne da ku \n û linkan birêve bibe
                                                        // formatDescription بەکاربهێنە بۆ کۆنترۆڵکردنی \n و لینکەکان
        
        // Dema peyamê lê zêde bike (کاتی نامەکە زیاد بکە)
        if (msg.timestamp) {
            const date = msg.timestamp.toDate();
            const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const timestampEl = document.createElement('span');
            timestampEl.className = 'chat-timestamp';
            timestampEl.textContent = timeString;
            bubble.appendChild(timestampEl);
        }
        
        msgElement.appendChild(bubble);
        chatMessagesContainer.appendChild(msgElement);
    });

    // Skrol bike xwarê (سکڕۆڵ بکە خوارەوە)
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}
// === END: KODA NÛ JI BO CHAT / کۆتایی کۆدی نوێ بۆ چات ===

// --- Setup Functions ---

function setupUIEventListeners() {
    homeBtn.onclick = async () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilterCore({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        await updateProductViewUI(true, true); 
    };

    settingsBtn.onclick = () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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

    // === START: KODÊN NÛ / کۆدی نوێ ===
    // Bişkoja chatê ya FAB (دوگمەی چاتی FAB)
    chatFabBtn.onclick = () => renderChatSheetUI(false); // false = Kurteyê neşîne (پوختە مەنێرە)
    
    // Bişkoja têketinê ya profîlê (دوگمەی چوونەژوورەوەی پڕۆفایل)
    profileLoginBtn.onclick = () => {
        openPopup('phoneAuthModal', 'modal');
    };

    // Bişkoja derketinê ya bikarhêner (دوگمەی دەرچوونی بەکارهێنەر)
    userLogoutBtn.onclick = async () => {
        const result = await handleUserLogoutCore();
        showNotification(result.message, result.success ? 'success' : 'error');
        if (result.success) {
            closeCurrentPopup(); // Sheeta profîlê bigire (پەنجەرەی پڕۆفایل دابخە)
        }
    };
    // === END: KODÊN NÛ / کۆتایی کۆدی نوێ ===

    // Girtina Popupan (داخستنی پۆپئەپەکان)
    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Forma Login (Admin)
    loginForm.onsubmit = async (e) => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        e.preventDefault();
        try {
            await handleLogin(document.getElementById('email').value, document.getElementById('password').value);
            closeCurrentPopup();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    // Lêgerîna Sereke (گەڕانی سەرەکی)
    const debouncedSearch = debounce(async (term) => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        await navigateToFilterCore({ search: term }); 
        await updateProductViewUI(true, true); 
    }, 500);
    searchInput.oninput = () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };
    clearSearchBtn.onclick = () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        debouncedSearch(''); 
    };

     // Lêgerîna Rûpela Lawekî (گەڕانی پەڕەی لاوەکی)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const searchTerm = subpageSearchInput.value;
        subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSubpageSearch(searchTerm);
    };
    subpageClearSearchBtn.onclick = () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        subpageSearchInput.value = '';
        subpageClearSearchBtn.style.display = 'none';
        debouncedSubpageSearch('');
    };


    // Forma Profaylê (فۆڕمی پڕۆفایل)
    profileForm.onsubmit = async (e) => {
        // === START: KODA GÛHERTÎ / کۆدی گۆڕاو ===
        // Naha em fonksiyona bingehîn a async bikar tînin
        // ئێستا فەنکشنە 'async'ـە سەرەکییەکە بەکاردەهێنین
        e.preventDefault();
        const profileData = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value, // Ev dê ne-guhêrbar be (ئەمە ناگۆڕدرێت)
        };
        const result = await saveProfileCore(profileData); // Logika core bang bike
        showNotification(result.message, result.success ? 'success' : 'error');
        if (result.success) {
            closeCurrentPopup();
        }
        // === END: KODA GÛHERTÎ / کۆتایی کۆدی گۆڕاو ===
    };
    
    // === START: KODÊN NÛ JI BO AUTH / کۆدی نوێ بۆ پشتڕاستکردنەوە ===
    
    // Forma şandina hejmara têlefonê (فۆڕمی ناردنی ژمارەی مۆبایل)
    phoneAuthForm.onsubmit = async (e) => {
        e.preventDefault();
        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = '...';
        
        const phoneNumber = document.getElementById('phoneNumber').value;
        const result = await sendVerificationCodeCore(phoneNumber);
        
        if (result.success) {
            showNotification('کۆد نێردرا، تکایە چاوەڕێی SMS بکە.', 'success');
            renderPhoneAuthUI('code'); // Forma kodê nîşan bide (فۆڕمی کۆد پیشان بدە)
        } else {
            showNotification(result.message, 'error');
            renderPhoneAuthUI('phone'); // Vegere forma têlefonê (بگەڕێوە سەر فۆڕمی مۆبایل)
        }
    };

    // Forma piştrastkirina kodê (فۆڕمی پشتڕاستکردنەوەی کۆد)
    verifyCodeForm.onsubmit = async (e) => {
        e.preventDefault();
        verifyCodeBtn.disabled = true;
        verifyCodeBtn.textContent = '...';
        
        const code = document.getElementById('verificationCode').value;
        const result = await verifyCodeCore(code);
        
        if (result.success) {
            showNotification('ژمارەکەت بە سەرکەوتوویی پشتڕاستکرایەوە!', 'success');
            closeCurrentPopup(); // Modala authê bigire (مۆداڵەکە دابخە)
            
            // Naha ku bikarhêner têketî ye, em chatê vedikin
            // ئێستا کە بەکارهێنەر لۆگین بووە، چاتەکە دەکەینەوە
            // (onAuthStateChanged dê UIya profîlê nû bike)
            // (onAuthStateChanged UIـی پڕۆفایل نوێ دەکاتەوە)
            
            // Kontrol bike ka sebet vala ye berî ku kurteyê bişîne
            // پشکنین بکە بزانە سەبەتە بەتاڵە پێش ناردنی پوختە
            const sendSummary = state.cart.length > 0;
            renderChatSheetUI(sendSummary); 
        } else {
            showNotification(result.message, 'error');
            renderPhoneAuthUI('code'); // Bila li ser forma kodê bimîne (با لەسەر فۆڕمی کۆد بمێنێتەوە)
        }
    };
    
    // Bişkoja betalkirinê (دوگمەی پاشگەزبوونەوە)
    cancelVerificationBtn.onclick = () => {
        renderPhoneAuthUI('phone');
    };
    
    // Forma şandina peyama chatê (فۆڕمی ناردنی نامەی چات)
    chatMessageForm.onsubmit = async (e) => {
        e.preventDefault();
        const text = chatMessageInput.value.trim();
        if (!text) return;
        
        if (!state.currentUser) {
            showNotification(t('chat_login_required'), 'error');
            handleLocalChatClick(); // Modala authê veke (مۆداڵی Auth بکەوە)
            return;
        }

        const tempMessage = text; // Peyamê hilîne (نامەکە پاشەکەوت بکە)
        chatMessageInput.value = '';
        chatSendBtn.disabled = true;
        chatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            await sendChatMessageCore(tempMessage, state.currentUser.uid, state.currentUser.uid);
            // Peyam dê ji hêla guhdarê 'onSnapshot' ve were nîşan dan
            // نامەکە لەلایەن گوێگری 'onSnapshot'ـەوە پیشان دەدرێت
        } catch (error) {
            showNotification(t('error_generic'), 'error');
            chatMessageInput.value = tempMessage; // Peyamê vegerîne (نامەکە بگەڕێنەوە)
        } finally {
            chatSendBtn.disabled = false;
            chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    };
    
    // === END: KODÊN NÛ JI BO AUTH & CHAT / کۆتایی کۆدی نوێ بۆ Auth & Chat ===

    // Bişkokên Ziman (دوگمەکانی زمان)
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            handleSetLanguage(btn.dataset.lang);
        };
    });

    // Vêkirina/Girtina Peywendiyê (کردنەوە/داخستنی پەیوەندی)
    contactToggle.onclick = () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    // Bişkoka Install (دوگمەی دامەزراندن)
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', () => handleInstallPrompt(installBtn));
    }

    // Bişkoka Çalakirina Agahdariyan (دوگمەی چالاککردنی ئاگەداری)
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', async () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const result = await requestNotificationPermissionCore();
        showNotification(result.message, result.granted ? 'success' : 'error');
    });

    // Bişkoka Nûkirina Bi Zorê (دوگمەی نوێکردنەوەی بەزۆر)
    document.getElementById('forceUpdateBtn')?.addEventListener('click', async () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const result = await forceUpdateCore();
        if (result.success) {
            showNotification(result.message, 'success');
            setTimeout(() => window.location.reload(true), 1500);
        } else if (result.message !== 'Update cancelled.') {
            showNotification(result.message, 'error');
        }
    });

    // --- Skrola Bêdawî (سکڕۆڵی بێ کۆتا) ---
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    if (scrollTrigger) {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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

    // --- Guhdarên Bûyerên Taybet (گوێگرانی ڕووداوە تایبەتەکان) ---
    document.addEventListener('authChange', (e) => {
        // === START: KODA GÛHERTÎ / کۆدی گۆڕاو ===
        // Naha em hem admin û hem jî bikarhêneran birêve dibin
        // ئێستا ئێمە هەم ئەدمین و هەم بەکارهێنەران بەڕێوە دەبەین
        const isAdmin = e.detail.isAdmin;
        const isUser = e.detail.isUser;
        
        console.log(`Auth Change: isAdmin=${isAdmin}, isUser=${isUser}`);

        // UIya Admin nû bike (UIـی ئەدمین نوێ بکەوە)
        updateAdminUIAuth(isAdmin);
        if(isAdmin && loginModal.style.display === 'block') {
             closeCurrentPopup();
        }

        // UIya Bikarhêner nû bike (UIـی بەکارهێنەر نوێ بکەوە)
        chatFabBtn.style.display = isUser ? 'flex' : 'none';
        renderUserProfileUI(); // Ev ê profîlê li gorî têketinê nîşan bide/veşêre (ئەمە پڕۆفایل بەپێی لۆگین پیشان دەدات/دەیشارێتەوە)
        
        // Ger sheeta favorites vekirî be, wê ji nû ve nîşan bide (ji ber ku dibe ku ew ji localStorage bo Firestore hatibe guhertin)
        // ئەگەر پەنجەرەی دڵخوازەکان کرابێتەوە، دووبارە پیشانی بدەوە (چونکە لەوانەیە لە لۆکاڵ ستۆرێجەوە بۆ فایەرستۆر گۆڕدرابێت)
        if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
            renderFavoritesPageUI();
        }
        // === END: KODA GÛHERTÎ / کۆتایی کۆدی گۆڕاو ===
    });

    document.addEventListener('fcmMessage', (e) => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const payload = e.detail;
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block'; 
    });

    document.addEventListener('installPromptReady', () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.style.display = 'flex';
    });

    document.addEventListener('swUpdateReady', (e) => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');
        updateNotification.classList.add('show');
        updateNowBtn.onclick = () => {
             e.detail.registration?.waiting?.postMessage({ action: 'skipWaiting' });
        };
    });

    document.addEventListener('clearCacheTriggerRender', async () => {
        // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
        console.log("UI received clearCacheTriggerRender event.");
        if(state.currentCategory === 'all' && !state.currentSearch) {
             await updateProductViewUI(true, true); 
        }
    });

    setupGpsButtonUI();
}

async function handleSetLanguage(lang) {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
         // === START: KODA NÛ / کۆدی نوێ ===
         window.AdminLogic.renderAdminChatListUI?.(); // Lîsteya chatê ya admin nû bike (لیستی چاتی ئەدمین نوێ بکەوە)
         // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    }
}

window.addEventListener('popstate', async (event) => {
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
    const wasPopupOpen = state.currentPopupState !== null; 
    const previousPageId = state.currentPageId; 
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
                await updateProductViewUI(true, false); 
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
                    await updateProductViewUI(true, true); 
                }, 50);
            }
        }
    } else {
        console.log("Popstate: No state found, loading default main page.");
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
         if (state.categories.length > 0) { 
              await showSubcategoryDetailPageUI(mainCatId, subCatId, true);
         } else {
             console.warn("Categories not ready on initial load, showing main page instead of detail.");
             showPage('mainPage');
             await updateProductViewUI(true, true); 
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
    // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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
     // ... (Ev kod wek xwe dimîne / ئەم کۆدە وەک خۆی دەمێنێتەوە) ...
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

// --- Start UI Initialization ---
document.addEventListener('DOMContentLoaded', initializeUI);


// ======== PIRA JI BO ADMIN.JS (ÇARESERÎ) ========
// === START: KODA NÛ / کۆدی نوێ ===
// Fonksiyonên chatê ji bo admin.js berdest dike
// فەنکشنەکانی چات بۆ admin.js بەردەست دەکات
if (!window.globalAdminTools) {
    window.globalAdminTools = {};
}
window.globalAdminTools.openPopup = openPopup;
window.globalAdminTools.closeCurrentPopup = closeCurrentPopup;
window.globalAdminTools.showNotification = showNotification; 
window.globalAdminTools.listenForAdminChatList = listenForAdminChatList;
window.globalAdminTools.listenForChatMessages = listenForChatMessages;
window.globalAdminTools.sendChatMessageCore = sendChatMessageCore;
window.globalAdminTools.markChatAsReadCore = markChatAsReadCore;
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===

console.log('Admin bridge updated with chat functions.');
// ======== DAWÎYA PIRA ========
