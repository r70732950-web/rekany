// app-ui.js
// Rêveberiya UI Giştî, girêdana bûyeran (event listeners), û nûvekirina DOM

import {
    // === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
    // Em elementên nû yên UI ji bo pêkhateya nû (new structure) import dikin
    // ئێمە توخمە نوێیەکانی UI بۆ پێکهاتە نوێیەکە هاوردە دەکەین
    loginModal, addProductBtn, productFormModal, 
    // Konteynirên Rûpela Sereke (کۆنتەینەرەکانی پەڕەی سەرەکی)
    mainPageLoader, homePageLayoutContainer, categoryPageLayoutContainer, productGridPageContainer,
    // Konteynirên Nav Grida Berheman (کۆنتەینەرەکانی ناو لیستی بەرهەمەکان)
    skeletonLoader, productsContainer, loader, // 'loader' êdî ji bo 'scroll-loader-trigger' e ('loader' ئیتر بۆ 'scroll-loader-trigger'ـە)
    subcategoriesContainer, subSubcategoriesContainer, // <-- KODA NÛ / کۆدی نوێ
    
    searchInput, clearSearchBtn, loginForm, productForm, formTitle, 
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer,
    // === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===
} from './app-setup.js';

import {
    // Import state and core logic functions
    state, // *** Import state from app-setup ***
    t, debounce, formatDescription,
    handleLogin, handleLogout,
    fetchCategories, fetchProductById, fetchProducts, fetchSubcategories, 
    fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods, fetchSubSubcategories,
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

// === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
// Em fonksîyonên renderkirina dîzaynê ji 'home.js' import dikin
// ئێمە فەنکشنەکانی ڕێندەرکردنی دیزاین لە 'home.js' هاوردە دەکەین
import {
    renderPageContentUI, 
    renderProductsGridUI, 
    renderSubcategoriesUI, // <-- Em vê ji 'home.js' import dikin (ئێمە ئەمە لە 'home.js' هاوردە دەکەین)
    renderMainCategoriesUI // <-- Em vê ji 'home.js' import dikin (ئێمە ئەمە لە 'home.js' هاوردە دەکەین)
} from './home.js'; 
// === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===


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
            if (pageId === 'settingsPage') {
                subpageSearch.style.display = 'none'; 
            } else {
                subpageSearch.style.display = 'block'; 
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
        if (sheetContent) sheetContent.scrollTop = 0;
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
    } else { 
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

// === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
// Em van fonksîyonan ji 'home.js' vediqetînin ji ber ku 'home.js' hewceyê wan e
// ئێمە ئەم فەنکشنانە لە 'home.js' جیا دەکەینەوە چونکە 'home.js' پێویستی پێیانە
export function renderSkeletonLoader(container, count = 8) {
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
// === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===



// === START: GۆڕANkARIYA MEZIN / گۆڕانکاریی گەورە ===
// Ev fonksîyona sereke ye ku biryarê dide ka çi nîşan bide
// ئەمە فەنکشنی سەرەکییە کە بڕیار دەدات چی پیشان بدات
export async function updateProductViewUI(isNewSearch = false, shouldScrollToTop = true) {
    
    // 1. Hemî konteyniran veşêre û loaderê nîşan bide
    // 1. هەموو کۆنتەینەرەکان بشارەوە و لۆدەر پیشان بدە
    mainPageLoader.style.display = 'block';
    homePageLayoutContainer.style.display = 'none';
    categoryPageLayoutContainer.style.display = 'none';
    productGridPageContainer.style.display = 'none';
    
    // Ger lêgerînek nû be (an guhertina kategoriyê), her gav loader nîşan bide
    // ئەگەر گەڕانێکی نوێ بوو (یان گۆڕینی پۆلێن)، هەمیشە لۆدەر پیشان بدە
    if (isNewSearch) {
        loader.style.display = 'none'; // 'loader' barkirina bêdawî veşêre ('loader'ـی سکڕۆڵی بێکۆتا بشارەوە)
    }

    // 2. Daneyan ji Core bipirse
    // 2. داتا لە Core داوا بکە
    const result = await fetchProducts(state.currentSearch, isNewSearch);
    if (result === null && !isNewSearch) {
         // Barkirin jixwe di pêşveçûnê de ye (بارکردن پێشتر دەستی پێکردووە)
         mainPageLoader.style.display = 'none';
         productGridPageContainer.style.display = 'grid'; // Tenê grida berheman nîşan bide (تەنها لیستی بەرهەمەکان پیشان بدە)
         return; 
    }

    // 3. Li gorî 'viewMode' biryarê bide
    // 3. بەپێی 'viewMode' بڕیار بدە
    switch (result.viewMode) {
        case 'HOME':
            // Pêdivî ye ku em Dîzayna Malê (Home Layout) nîşan bidin
            // پێویستە دیزاینی ماڵەوە پیشان بدەین
            if (homePageLayoutContainer.dataset.cached !== 'true') {
                // Heke cache nebe, wê çêbike (ئەگەر کاش نەبوو، دروستی بکە)
                await renderPageContentUI(null, homePageLayoutContainer, 'home'); // `null` ji bo 'home' ( `null` بۆ 'home')
            }
            homePageLayoutContainer.style.display = 'block';
            break;

        case 'CATEGORY_LAYOUT':
            // Pêdivî ye ku em Dîzayna Kategoriyê (Category Layout) nîşan bidin
            // پێویستە دیزاینی پۆلێن پیشان بدەین
            const layoutId = result.layoutId;
            if (categoryPageLayoutContainer.dataset.cachedLayoutId !== layoutId) {
                // Heke cache nebe an cacheya kevn be, wê çêbike
                // ئەگەر کاش نەبوو یان کاشی کۆن بوو، دروستی بکە
                await renderPageContentUI(result.layout, categoryPageLayoutContainer, layoutId);
            }
            categoryPageLayoutContainer.style.display = 'block';
            break;

        case 'PRODUCT_GRID':
            // Pêdivî ye ku em Grida Berheman (Product Grid) nîşan bidin
            // پێویستە لیستی بەرهەمەکان پیشان بدەین
            productGridPageContainer.style.display = 'block';
            
            if (result.error) {
                productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
            } else {
                 // Append bike eger ne lêgerînek nû be, replace bike eger be
                 // زیاد بکە ئەگەر گەڕانێکی نوێ نەبوو، بیگۆڕە ئەگər بوو
                 renderProductsGridUI(result.products, isNewSearch); // Bangî fonksîyona 'home.js' bike (بانگی فەنکشنی 'home.js' بکە)
            }
            
            // Pêşekên jêr-kategoriyan nûve bike (مینیوی جۆرە لاوەکییەکان نوێ بکەوە)
            const subcats = await fetchSubcategories(state.currentCategory);
            await renderSubcategoriesUI(subcats); // Bangî fonksîyona 'home.js' bike (بانگی فەنکشنی 'home.js' بکە)
            
            loader.style.display = result.allLoaded ? 'none' : 'block'; // Trîgera skrolê nîşan bide/veşêre (تریگەری سکڕۆڵ پیشان بدە/بشارەوە)
            break;
    }

    // 4. Loaderê giştî veşêre
    // 4. لۆدەری گشتی بشارەوە
    mainPageLoader.style.display = 'none';

    // 5. Pêşeka kategoriyên sereke nûve bike (هەمیشە)
    // 5. مینیوی پۆلێنە سەرەکییەکان نوێ بکەوە (هەمیشە)
    renderMainCategoriesUI(); 

    // 6. Skrol bike jor (eger pêwîst be)
    // 6. سکڕۆڵ بکە سەرەوە (ئەگەر پێویست بوو)
    if (isNewSearch && shouldScrollToTop) {
        requestAnimationFrame(() => {
             // Konteynira ku NIHA xuya ye bibîne û wê skrol bike
             // ئەو کۆنتەینەرەی کە ئێستا دیارە بیدۆزەرەوە و سکڕۆڵی بکە
             let activeContainer = null;
             if (homePageLayoutContainer.style.display !== 'none') activeContainer = homePageLayoutContainer;
             else if (categoryPageLayoutContainer.style.display !== 'none') activeContainer = categoryPageLayoutContainer;
             else if (productGridPageContainer.style.display !== 'none') activeContainer = productGridPageContainer;
             
             if (activeContainer) {
                 activeContainer.scrollTo({ top: 0, behavior: 'auto' });
             } else {
                // Wekî paşverû (وەک یەدەگ)
                document.getElementById('mainPage').scrollTo({ top: 0, behavior: 'auto' });
             }
         });
    }
}
// === END: GۆڕANkARIYA MEZIN / کۆتایی گۆڕانکاریی گەورە ===



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
    container.innerHTML = ''; 

    const methods = await fetchContactMethods(); 

    if (!methods || methods.length === 0) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
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

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';
    renderSkeletonLoader(favoritesContainer, 4); // Use function from this file

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
    renderSkeletonLoader(productsContainer, 4); // Use function from this file

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
            img.style.cssText = `width: 100%; flex-shrink: 0; display: ${index === 0 ? 'block' : 'none'}; object-fit: contain; max-height: 350px; transition: opacity 0.3s ease-in-out;`;
            
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
                <iframe src="${videoSrc}" title="YouTube video player" frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen style="width: 100%; aspect-ratio: 16 / 9;">
                </iframe>`;
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
         'adminCategoryLayoutManagement' 
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
        await updateProductViewUI(true, true); // (imported from this file)
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

    const debouncedSearch = debounce(async (term) => {
        await navigateToFilterCore({ search: term }); 
        await updateProductViewUI(true, true); // (imported from this file)
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

    // --- Skrola Bêdawî (NOVA LOGIC / لۆجیکی نوێ) ---
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    if (scrollTrigger) {
        const observer = new IntersectionObserver(async (entries) => {
            const isMainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
            // *** KONTROLA NÛ: Tenê gava grida berheman xuya ye barke ***
            // *** پشکنینی نوێ: تەنها کاتێک لیستی بەرهەمەکان دیارە بار بکە ***
            const isProductGridVisible = productGridPageContainer.style.display !== 'none';

            if (entries[0].isIntersecting && isMainPageActive && isProductGridVisible && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 loader.style.display = 'block'; 
                 const result = await fetchProducts(state.currentSearch, false); 
                 loader.style.display = 'none'; 
                 if(result && result.products.length > 0) {
                     // Em êdî updateProductViewUI bang nakin, tenê berheman zêde dikin
                     // ئیتر بانگی updateProductViewUI ناکەین، تەنها بەرهەمەکان زیاد دەکەین
                     renderProductsGridUI(result.products, false); // false = append
                 }
                 scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
            }
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    }
    // --- DAWÎYA Skrola Bêdawî / کۆتایی سکڕۆڵی بێکۆتا ---


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

    // === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
    // Guhdarê ji bo paqijkirina cacheyê (گوێگر بۆ پاککردنەوەی کاش)
    document.addEventListener('clearCacheTriggerRender', async () => {
        console.log("UI received clearCacheTriggerRender event. Forcing re-render.");
        // Em tenê updateProductViewUI bang dikin; ew ê bibîne ku cache paqij e
        // ئێمە تەنها بانگی updateProductViewUI دەکەین؛ ئەو دەبینێت کە کاش پاکە
        await updateProductViewUI(true, true); 
    });
    // === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===

    setupGpsButtonUI();

    // === START: GۆڕANkARI LI VIR (POPSTATE) / گۆڕانکاری لێرە (POPSTATE) ===
    window.addEventListener('popstate', async (event) => {
        const wasPopupOpen = state.currentPopupState !== null; 
        const previousPageId = state.currentPageId; 
    
        state.currentPopupState = null; 
        closeAllPopupsUI(); 
    
        const popState = event.state;
        
        if (!popState) {
            // Rewşa destpêkê (default) - vegere malê
            // دۆخی سەرەتایی - بگەڕێوە ماڵەوە
            const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
            showPage('mainPage'); 
            applyFilterStateCore(defaultState);
            await updateProductViewUI(true, true); // (true, true) = nû, skrol bike jor
            return;
        }

        if (popState.type === 'page') {
            // Vegerîna li rûpelek (mînak, Settings)
            // گەڕانەوە بۆ پەڕەیەک (بۆ نموونە، ڕێکخستنەکان)
            showPage(popState.id, popState.title); 
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true);
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Dema ku 'paş' tê pêl kirin, em tenê popupê digirin (li jor hate kirin)
            // lê heke 'pêş' were pêl kirin, em wê dîsa vedikin
            // کاتێک "گەڕانەوە" لێدەدرێت، ئێمە تەنها پۆپئەپەکە دادەخەین (لە سەرەوە کرا)
            // بەڵام ئەگەر "پێشەوە" لێدرا، ئێمە دووبارە دەیکەینەوە
            openPopup(popState.id, popState.type); 
        
        } else {
            // Gihîştina rewşek filterê ya rûpela serekî (mainPage)
            // گەیشتن بە دۆخێکی فلتەری لاپەڕەی سەرەki
            showPage('mainPage'); 
            applyFilterStateCore(popState); 
    
            const cameFromPopup = wasPopupOpen;
            const cameFromPage = previousPageId !== 'mainPage';

            // Em hertim UIyê nû dikin, lê bêyî skrolkirina otomatîk
            // ئێمە هەمیشە UI نوێ دەکەینەوە، بەڵام بێ سکڕۆڵی ئۆتۆماتیک
            await updateProductViewUI(true, false); // (true, false) = nû, skrol NEKE jor
            
            // *** Logica Vegerandina Skrolê (Logica nû) ***
            // *** لۆجیکی گەڕاندنەوەی سکڕۆڵ (لۆجیکی نوێ) ***
            if (!state.pendingFilterNav) { 
                const scroll = popState.scroll || 0;
                
                // Hinekî bisekine da ku 'updateProductViewUI' konteynirê rast nîşan bide
                // کەمێک بوەستە با 'updateProductViewUI' کۆنتەینەرە ڕاستەکە پیشان بدات
                requestAnimationFrame(() => {
                    let containerToScroll = null;
                    if (homePageLayoutContainer.style.display !== 'none') {
                        containerToScroll = homePageLayoutContainer;
                    } else if (categoryPageLayoutContainer.style.display !== 'none') {
                        containerToScroll = categoryPageLayoutContainer;
                    } else if (productGridPageContainer.style.display !== 'none') {
                        containerToScroll = productGridPageContainer;
                    }
                    
                    if (containerToScroll) {
                        containerToScroll.scrollTo({ top: scroll, behavior: 'instant' });
                    }
                });
            }
            
            // *** Logica Fîltera Li Bendê (Logica nû) ***
            // *** لۆجیکی فلتەری چاوەڕوانکراو (لۆجیکی نوێ) ***
            if (state.pendingFilterNav) {
                console.log("Found pending filter navigation. Applying now.");
                const filterToApply = state.pendingFilterNav;
                state.pendingFilterNav = null; 
                
                setTimeout(async () => {
                    await navigateToFilterCore(filterToApply);
                    await updateProductViewUI(true, true); // true, true = nû, skrol bike jor
                }, 50); 
            }
        }
    });
    // === END: GۆڕANkARI LI VIR (POPSTATE) / کۆتایی گۆڕانکاری لێرە (POPSTATE) ===
}
// --- DAWÎYA Guhdarên Bûyeran / کۆتایی گوێگرەکانی ڕووداوەکان ---

async function handleSetLanguage(lang) {
    // 1. Core state nû bike (ئەمە cacheya dîzaynê paqij dike)
    // 1. Core state نوێ بکەوە (ئەمە کاشی دیزاین پاک دەکاتەوە)
    setLanguageCore(lang); 

    // 2. Nivîsara statîk nû bike
    // 2. دەقی وەستاو نوێ بکەوە
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if(element.placeholder) element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });

    // 3. Bişkokên ziman nû bike
    // 3. دوگمەکانی زمان نوێ بکەوە
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // 4. Naveroka dînamîk a popupan nû bike
    // 4. ناوەڕۆکی داینامیکی پۆپئەپەکان نوێ بکەوە
    renderCategoriesSheetUI(); 
    if (document.getElementById('cartSheet').classList.contains('show')) renderCartUI();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPageUI();
    await renderContactLinksUI();

    // 5. Nîşandana sereke (main view) bi tevahî ji nû ve render bike
    // 5. پیشاندانی سەرەکی بە تەواوی دووبارە ڕێندەر بکەوە
    await updateProductViewUI(true, true); // (true, true) = nû, skrol bike jor

    // 6. Lîsteyên admin ji nû ve render bike (ئەگەر چالاک بێت)
    // 6. لیستەکانی ئەدمین دووبارە ڕێندەر بکەوە (ئەگەر چالاک بێت)
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
}

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
         await updateProductViewUI(true, true); // (imported from this file)

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
// Ev kod fonksyonên ku ji app-ui.js hatine 'export' kirin
// ji bo faylê admin.js (ku module nîne) berdest dike.

if (!window.globalAdminTools) {
    window.globalAdminTools = {};
}

// Em van fonksîyonan li 'globalAdminTools' zêde dikin (ji ber ku admin.js wan bikar tîne)
// ئێمە ئەم فەنکشنانە بۆ 'globalAdminTools' زیاد دەکەین (چونکە admin.js بەکاریان دێنێت)
window.globalAdminTools.openPopup = openPopup;
window.globalAdminTools.closeCurrentPopup = closeCurrentPopup;
// showNotification jixwe di app-setup.js de hatiye zêdekirin (showNotification پێشتر لە app-setup.js زیاد کراوە)

console.log('openPopup & closeCurrentPopup ji bo admin.js hatin zêdekirin.');
// ======== DAWÎYA PIRA ========