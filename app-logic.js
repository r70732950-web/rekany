// BEŞÊ DUYEM: app-logic.js (کۆدی تەواو و نوێکراوە بۆ چارەسەرکردنی کێشەی دیزاین و زیادکردنی گرووپکردن)
// Fonksiyon û mentiqê serekî yê bernameyê

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";


function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}


function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function updateHeaderView(pageId, title = '') {
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

function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Nûvekirina headerê li gorî rûpelê
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


function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition();
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();
    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
}

// *** GORRANKARIYA SEREKE LI VÊRÊ YE ***
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Nûvekirina UIya kategoriyan (highlightkirin)
    renderMainCategories();
    await renderSubcategories(state.currentCategory); // Ev dê piştrast bike ku subcategory ya rast hatiye highlight kirin

    // *** KONTROLA NÛ: Ger kategoriyek sereke hebe lê subcategory 'all' be û lêgerîn nebe ***
    if (state.currentCategory !== 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all' && !state.currentSearch) {
        console.log(`Rendering grouped subcategory rows for main category: ${state.currentCategory}`);
        // Li şûna nîşandana grid-a sereke, rêzên horizontal nîşan bide
        await renderGroupedSubcategoryRows(state.currentCategory);

        // Piştrast be ku UI ya din veşartî ye
        productsContainer.style.display = 'block'; // Divê ev block be ji ber ku renderGrouped... naverokê têxe vir
        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        document.getElementById('scroll-loader-trigger').style.display = 'none';
        document.getElementById('homePageSectionsContainer').style.display = 'none';

        // Vegerandina pozîsyona scroll an çûna jor
        if (fromPopState && typeof filterState.scroll === 'number') {
            setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
        } else if (!fromPopState) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return; // Ji fonksiyonê derkeve
    }

    // Ger rewşa jorîn ne rast be, wekî berê berdewam bike
    await searchProductsInFirestore(state.currentSearch, true);

    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


async function navigateToFilter(newState) {
    history.replaceState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY
    }, '');

    const finalState = { ...history.state, ...newState, scroll: 0 };

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    history.pushState(finalState, '', newUrl);

    await applyFilterState(finalState); // applyFilterState dê kontrol bike ka renderGrouped an searchProducts were bang kirin
}

window.addEventListener('popstate', async (event) => { // Guhertin bo async
    closeAllPopupsUI();
    const popState = event.state;
    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            // Eger ew rûpela jêr-kategoriyê be û sernav tune be, ji nû ve bistîne
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                    const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    const subCatSnap = await getDoc(subCatRef);
                    if (subCatSnap.exists()) {
                        const subCat = subCatSnap.data();
                        pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                    }
                } catch(e) { console.error("Could not refetch title on popstate", e) }
            }
            showPage(popState.id, pageTitle);
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type);
        } else {
            // Dema vedigere rewşek filterê li ser rûpela sereke
            showPage('mainPage');
            await applyFilterState(popState, true); // applyFilterState dê kontrol bike ka renderGrouped... were bang kirin
        }
    } else {
        // Rewşa destpêkê ya bê state
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        await applyFilterState(defaultState); // Ev dê renderHomePageContent bang bike
    }
});

function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // The actual rendering will be triggered by onSnapshot in initializeAppLogic
    } else if (pageId === 'settingsPage') {
         history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
         showPage(pageId, t('settings_title'));
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
        applyFilterState(initialState); // applyFilterState dê rewşê kontrol bike
    }

    const element = document.getElementById(hash);
    if (element && pageId === 'mainPage') {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopup(hash, isSheet ? 'sheet' : 'modal');
        }
    }

    const productId = params.get('product');
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500);
    }
}


function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';

    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = ''; // Force re-render on language change
    }

    // Force re-render based on current state after language change
    applyFilterState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch
    });

    renderCategoriesSheet(); // Update category names in sheet
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
}

async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success');

            setTimeout(() => {
                window.location.reload(true);
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

function updateContactLinksUI() {
    if (!state.contactInfo) return;
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

function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // VAPID key'ê xwe li vir têxe
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification('مۆڵەت نەدرا', 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now()
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

function toggleFavorite(productId, event) {
    if(event) event.stopPropagation();

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Tenê UI-ya bişkojên têkildar nûve bike
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart');
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite);
            heartIcon.classList.toggle('far', !isNowFavorite);
        }
    });

    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

async function renderFavoritesPage() {
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
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = '';

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product);
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}


function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function showNotification(message, type = 'success') {
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

function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Her dem 'all' bike da ku applyFilterState kontrol bike
                subSubcategory: 'all',
                search: ''
            });
            closeCurrentPopup();
            showPage('mainPage');
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

async function renderSubSubcategories(mainCatId, subCatId) {
    // This function is no longer needed on the main page for rendering sub-subcategories directly.
    subSubcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.style.display = 'none'; // Ensure it's hidden
}

async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = '';
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
        subCatName = 'Details';
    }

    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName);

    const loaderElement = document.getElementById('detailPageLoader');
    const productsDetailContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainerDetail = document.getElementById('subSubCategoryContainerOnDetailPage');

    loaderElement.style.display = 'block';
    productsDetailContainer.innerHTML = '';
    subSubContainerDetail.innerHTML = '';

    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Destpêkê hemûyan nîşan bide

    loaderElement.style.display = 'none';
}

async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = '';

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Ji bo nasîna bişkojê
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(subCatId, 'all', currentSearch);
        };
        container.appendChild(allBtn);

        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Ji bo nasîna bişkojê
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch);
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none';
    }
}

async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsDetailContainer = document.getElementById('productsContainerOnDetailPage');
    const loaderElement = document.getElementById('detailPageLoader');
    loaderElement.style.display = 'block';
    productsDetailContainer.innerHTML = ''; // Paqij bike berî lêgerîna nû

    try {
        let productsQuery;
        // Çêkirina query ya bingehîn li gorî subcategory an subSubcategory
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            // Zêdekirina filtera lêgerînê
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Rêzkirin dema lêgerîn hebe
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Rêzkirina normal dema lêgerîn nebe
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Limit zêde bike ji bo ku hemûyan bîne (an jî pagînasyonê li vir zêde bike ger hewce be)
        // productsQuery = query(productsQuery, limit(50)); // Wek mînak

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsDetailContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsDetailContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsDetailContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loaderElement.style.display = 'none';
    }
}


async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = '';

    if (categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Veşêre dema kategoriya 'all' hilbijartî be
        return;
    }

    subcategoriesContainer.style.display = 'flex'; // Nîşan bide dema kategoriyek din hilbijartî be

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0 && categoryId !== 'all') {
            subcategoriesContainer.style.display = 'none'; // Ger subcategory tune bin veşêre
            return;
        }

        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        // *** GORRANKARI LI VIR: navigateToFilter bang bike da ku applyFilterState kontrol bike ***
        allBtn.onclick = async () => {
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`; // Highlight based on state

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            // Klika li ser subcategory ya taybet dê rûpela hûrguliyan veke
            subcatBtn.onclick = () => {
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
    }
}


function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Her dem 'all' bike dema ku kategoriya sereke tê guhertin
                subSubcategory: 'all',
                search: ''
            });
        };

        container.appendChild(btn);
    });
}

function showProductDetails(productId) {
    const allFetchedProducts = [...state.products];
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found for details view. Trying to fetch...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct);
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        });
        return;
    }
    showProductDetailsWithData(product);
}

async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none';

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Ger kategorî nebin, tiştekî nîşan nede
    }

    let q;
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Kaڵaya heyî derxe
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else { // Tenê categoryId heye
        q = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("هیچ کاڵایەکی هاوشێوە نەدۆزرایەوە.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            container.appendChild(card);
        });

        section.style.display = 'block';

    } catch (error) {
        console.error("هەڵە لە هێنانی کاڵا هاوشێوەکان:", error);
    }
}

function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0; // Her dem scroll bike jor
    }

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    }

    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return;
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }

    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

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
        addToCart(product.id);
        closeCurrentPopup();
    };

    renderRelatedProducts(product); // Kaڵayên pêwendîdar nîşan bide

    openPopup('productDetailSheet');
}

function createPromoCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';

    const imageUrl = card.imageUrls[state.currentLanguage] || card.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
    `;

    cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { // Ne klik li ser bişkokên sliderê be
            const targetCategoryId = card.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                document.getElementById('mainCategoriesContainer').scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(-1);
    });

    cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(1);
    });

    return cardElement;
}

function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card'; // Kلاصê bingehîn
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
                navigator.clipboard.writeText(productUrl);
                showNotification('لينكى کاڵا کۆپى کرا!', 'success');
            }
        } catch (err) {
            console.error('Share error:', err);
             if (err.name !== 'AbortError') {
                  showNotification(t('share_error'), 'error');
             }
        }
    });

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            addToCart(product.id);
            // Animation ji bo bişkokê
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`;
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent;
                        addToCartButton.disabled = false;
                    }, 1500);
                }, 500);
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
            // Jixwe event listenerê xwe heye
        } else if (!target.closest('a')) { // Nehêle ku klik li ser lînkan rûpela hûrguliyan veke
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}


function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // Karta hinekî xuya bibe animation dest pê bike
    });

    // Piştrast be ku ev tenê li ser kartên ku divê animation hebin tê sepandin
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
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
    container.style.display = 'grid'; // Piştrast be grid e
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none'; // Veşêre dema skeleton tê nîşandan
      loader.style.display = 'none'; // Veşêre dema skeleton tê nîşandan
    }
}

function renderProducts() {
    productsContainer.innerHTML = ''; // Paqij bike berî renderkirinê
    if (!state.products || state.products.length === 0) {
        // Heke piştî lêgerînê tiştek nemabe, peyamek nîşan bide (ev di searchProductsInFirestore de tê kirin)
        return;
    }

    state.products.forEach(item => {
        let element;
        if (item.isPromoCard) {
            // Logic ji bo promo card (wekî berê)
            element = createPromoCardElement(item);
        } else {
            element = createProductCardElement(item);
        }
        element.classList.add('product-card-reveal'); // Ji bo animation
        productsContainer.appendChild(element);
    });

    productsContainer.style.display = 'grid'; // Piştrast be ku grid e
    setupScrollAnimations(); // Animationê ji nû ve saz bike
}

// =======================================================
// == ** FONKSİYONA NÛ JI BO NÎŞANDANA RÊZÊN HORIZONTAL ** ==
// =======================================================
async function renderGroupedSubcategoryRows(mainCatId) {
    productsContainer.innerHTML = ''; // Konteynara sereke paqij bike
    productsContainer.style.display = 'block'; // Wek block nîşan bide, ne grid
    skeletonLoader.style.display = 'none';
    loader.style.display = 'none';
    document.getElementById('scroll-loader-trigger').style.display = 'none';
    document.getElementById('homePageSectionsContainer').style.display = 'none';

    try {
        // Subcategories ji bo vê main category bistîne
        const subcategoriesQuery = collection(db, "categories", mainCatId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (subcategories.length === 0) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ جۆرێکی لاوەکی بۆ ئەم بەشە نییە.</p>';
            return;
        }

        // Ji bo her subcategory, beşek çêbike
        for (const subcat of subcategories) {
            const sectionContainer = document.createElement('div');
            sectionContainer.className = 'dynamic-section'; // Heman style wekî home page
            sectionContainer.style.backgroundColor = 'var(--section-bg)'; // Rengê paşxanê zêde bike
            sectionContainer.style.marginBottom = '16px'; // Hinek valahî li jêr
            sectionContainer.style.padding = '16px 0'; // Padding top/bottom

            const header = document.createElement('div');
            header.className = 'section-title-header';

            const title = document.createElement('h3');
            title.className = 'section-title-main';
            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            title.textContent = subcatName;
            header.appendChild(title);

            const seeAllLink = document.createElement('a');
            seeAllLink.className = 'see-all-link';
            seeAllLink.textContent = t('see_all');
            seeAllLink.onclick = () => {
                showSubcategoryDetailPage(mainCatId, subcat.id);
            };
            header.appendChild(seeAllLink);
            sectionContainer.appendChild(header);

            const productsScroller = document.createElement('div');
            productsScroller.className = 'horizontal-products-container';
            sectionContainer.appendChild(productsScroller);

            // Çend (mînak 10) kaڵayên vê subcategory bistîne
            const productsQuery = query(
                productsCollection,
                where('subcategoryId', '==', subcat.id),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const productSnapshot = await getDocs(productsQuery);

            if (productSnapshot.empty) {
                productsScroller.innerHTML = `<p style="padding: 0 12px; font-size: 14px; color: grey;">هیچ کاڵایەک بۆ ئەم بەشە نییە.</p>`;
            } else {
                productSnapshot.forEach(doc => {
                    const product = { id: doc.id, ...doc.data() };
                    const card = createProductCardElement(product);
                    // Piştrast be ku style ji bo horizontal container baş e
                    // width: 160px; ji CSS tê
                    productsScroller.appendChild(card);
                });
            }

            productsContainer.appendChild(sectionContainer);
        }

    } catch (error) {
        console.error("Error rendering grouped subcategory rows:", error);
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    }
}


// Fonksiyonên din ên wekî renderSingleShortcutRow, renderSingleCategoryRow, renderBrandsSection, hwd. li vir dimînin...
// ... (Koda van fonksiyonan wekî berê ye) ...
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) {
            return null; // Don't render empty rows
        }

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            item.onclick = async () => {
                await navigateToFilter({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
            };
            cardsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

async function renderSingleCategoryRow(categoryId, sectionNameObj) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';

    const title = document.createElement('h3');
    title.className = 'section-title-main';
    const categoryName = sectionNameObj[state.currentLanguage] || category['name_' + state.currentLanguage] || category.name_ku_sorani;
    title.innerHTML = `<i class="${category.icon}"></i> ${categoryName}`;
    header.appendChild(title);

    const seeAllLink = document.createElement('a');
    seeAllLink.className = 'see-all-link';
    seeAllLink.textContent = t('see_all');
    seeAllLink.onclick = async () => {
        await navigateToFilter({
            category: category.id,
            subcategory: 'all',
            subSubcategory: 'all',
            search: ''
        });
    };
    header.appendChild(seeAllLink);
    container.appendChild(header);

    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container';
    container.appendChild(productsScroller);

    try {
        const q = query(
            productsCollection,
            where('categoryId', '==', categoryId),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Don't render empty sections
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error(`Error fetching products for single category row ${categoryId}:`, error);
        return null;
    }
}

async function renderBrandsSection() {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = 'brandsContainer';
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(brandsCollection, orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
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
                await navigateToFilter({
                    category: brand.categoryId || 'all',
                    subcategory: brand.subcategoryId || 'all',
                    subSubcategory: 'all',
                    search: ''
                });
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands:", error);
        return null;
    }
}

async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    container.appendChild(header);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        const productsScroller = document.createElement('div');
        if (snapshot.empty) {
            return null; // Do not render if there are no new products
        } else {
            productsScroller.className = 'horizontal-products-container';
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsScroller.appendChild(card);
            });
        }
        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    container.appendChild(productsGrid);

    try {
        // Li vir em ê tenê çend heb nîşan bidin, ne hemûyan
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

async function renderHomePageContent() {
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Loader nîşan bide
        homeSectionsContainer.innerHTML = ''; // Paqij bike

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            // Dibe ku em bixwazin beşek default nîşan bidin ger tiştek neyê config kirin
            const defaultAllProducts = await renderAllProductsSection();
            if (defaultAllProducts) homeSectionsContainer.appendChild(defaultAllProducts);
        } else {
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        sectionElement = await renderPromoCardsSectionForHome();
                        break;
                    case 'brands':
                        sectionElement = await renderBrandsSection();
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                        if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                        }
                        break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section.categoryId, section.name);
                        }
                        break;
                    case 'all_products':
                        sectionElement = await renderAllProductsSection();
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        // skeletonLoader.style.display = 'none'; // Re-enable if needed elsewhere
        state.isRenderingHomePage = false;
    }
}


async function renderPromoCardsSectionForHome() {
    if (state.allPromoCards.length === 0) {
        const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
        const promoSnapshot = await getDocs(promoQuery);
        state.allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
    }

    if (state.allPromoCards.length > 0) {
        if (state.currentPromoCardIndex >= state.allPromoCards.length) state.currentPromoCardIndex = 0;
        const promoCardElement = createPromoCardElement(state.allPromoCards[state.currentPromoCardIndex]);
        const promoGrid = document.createElement('div');
        promoGrid.className = 'products-container'; // Reuse products-container for grid layout
        promoGrid.style.marginBottom = '24px'; // Add some space below
        promoGrid.appendChild(promoCardElement);
        startPromoRotation(); // Destpêkirina rotationê
        return promoGrid;
    }
    return null; // Ger promo card tune be, tiştek venegerîne
}

async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    // Kontrol bike ka divê rûpela sereke were nîşandan
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // Rûpela sereke nîşan bide
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        if (homeSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent();
        } else {
            // Ger naverok jixwe hebe, tenê rotationê dest pê bike (ger hebe)
            startPromoRotation();
        }
        return; // Ji fonksiyonê derkeve
    }

    // Ger ne rûpela sereke be, beşa home veşêre û grid-a hilberan amade bike
    homeSectionsContainer.style.display = 'none';
    productsContainer.style.display = 'grid'; // Piştrast be ku grid e

    // Logic ji bo cache (wekî berê)
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';

        renderProducts(); // Render bike ji cache
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    if (state.isLoadingMoreProducts) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Skeleton nîşan bide ji bo lêgerîna nû
    }

    if (state.allProductsLoaded && !isNewSearch) return; // Ger hemû hatibin barkirin, venegere

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Loader ji bo barkirina zêdetir nîşan bide

    try {
        let productsQuery = collection(db, "products");

        // Filterên kategoriyê zêde bike
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        // Bala xwe bidê: Dema subcategory 'all' be, ev filter nayê bikaranîn (ji ber ku applyFilterState ew rewş ji hev cuda dike)
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Filterên lêgerînê zêde bike
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Rêzkirinê zêde bike
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Ji bo barkirina zêdetir (infinite scroll)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Nûvekirina rewşa barkirinê
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block';
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Nûvekirina cache ji bo lêgerîna nû
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render bike (an jî lê zêde bike ger ne lêgerîna nû be)
        renderProducts();

        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none'; // Piştrast be skeleton veşartî ye piştî barkirinê
        productsContainer.style.display = 'grid'; // Piştrast be grid e
    }
}


function addToCart(productId) {
    // Logic ji bo zêdekirina hilberê li sepetê (wekî berê)
    const allFetchedProducts = [...state.products];
    let product = allFetchedProducts.find(p => p.id === productId);

    // Heke hilber di state.products de nebe (mînak, ji rûpela favorites hatibe zêdekirin)
    if (!product) {
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) { existingItem.quantity++; }
                else { state.cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 }); }
                saveCart();
                showNotification(t('product_added_to_cart'));
            }
        });
        return;
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) { existingItem.quantity++; }
    else { state.cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 }); }
    saveCart();
    showNotification(t('product_added_to_cart'));
}

function renderCart() {
    // Logic ji bo renderkirina sepetê (wekî berê)
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
    renderCartActionButtons(); // Ji bo renderkirina bişkokên şandinê

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Navê hilberê li gorî zimanê heyî bistîne
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=N/A';">
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

    // Event listeners ji nû ve girê bide
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}


function updateQuantity(productId, change) {
    // Logic ji bo nûvekirina hejmarê (wekî berê)
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { saveCart(); renderCart(); }
    }
}

function removeFromCart(productId) {
    // Logic ji bo rakirina ji sepetê (wekî berê)
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function generateOrderMessage() {
    // Logic ji bo çêkirina peyama fermanê (wekî berê)
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

    // Zêdekirina agahiyên profîlê
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

async function renderCartActionButtons() {
    // Logic ji bo renderkirina bişkokên şandinê (wekî berê)
    const container = document.getElementById('cartActions');
    container.innerHTML = '';

    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt")); // Bi rêzkirina createdAt da ku rêz bigire

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // Heman class ji bo style'ê bingehîn
            btn.style.backgroundColor = method.color; // Rengê taybet

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value;

                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber link format might need adjustments based on device/OS
                        link = `viber://chat?number=%2B${value}`; // Text might not always work reliably
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`;
                        break;
                    case 'url':
                        link = value; // Assume it's a direct link
                        break;
                }

                if (link) {
                    window.open(link, '_blank');
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
        console.error("Error fetching contact methods:", error);
        container.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

async function renderPolicies() {
    // Logic ji bo renderkirina polîtîkayan (wekî berê)
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

function checkNewAnnouncements() {
    // Logic ji bo kontrolkirina agahiyên nû (wekî berê)
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
            notificationBadge.style.display = 'none'; // Ger ti agahî tune be
        }
    }, error => {
        console.error("Error checking new announcements: ", error); // Handling potential errors
        notificationBadge.style.display = 'none';
    });
}

async function renderUserNotifications() {
    // Logic ji bo renderkirina agahiyên bikarhêner (wekî berê)
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    try {
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = '';
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
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

        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        notificationBadge.style.display = 'none'; // Badge veşêre piştî dîtinê
    } catch (error) {
        console.error("Error rendering user notifications:", error);
        notificationsListContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

function renderContactLinks() {
    // Logic ji bo renderkirina lînkên têkiliyê (wekî berê)
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Rêzkirin li gorî dema çêkirinê

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Paqij bike berî nûvekirinê

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Di tabek nû de veke
            linkElement.rel = 'noopener noreferrer'; // Ji bo ewlehiyê
            linkElement.className = 'settings-item';

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    }, error => {
        console.error("Error fetching contact links: ", error); // Handling potential errors
        contactLinksContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    });
}


function showWelcomeMessage() {
    // Logic ji bo peyama xêrhatinê (wekî berê)
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

function setupGpsButton() {
    // Logic ji bo bişkoka GPS (wekî berê)
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    if (!getLocationBtn || !profileAddressInput) return;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
            enableHighAccuracy: true, // Hewl bide cihê rasttir bistîne
            timeout: 10000, // Dem ji bo bersivdanê
            maximumAge: 0 // Her gav cihê nû bistîne
        });
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            // Bikaranîna Nominatim API ji bo wergerandina koordinatan bo navnîşan
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data && data.display_name) {
                profileAddressInput.value = data.display_name;
                showNotification('ناونیشان وەرگیرا', 'success');
            } else {
                profileAddressInput.value = `${latitude}, ${longitude}`; // Ger navnîşan neyê dîtin, koordînat nîşan bide
                showNotification('نەتوانرا ناونیشان بدۆزرێتەوە, تەنها کۆردینات دانرا', 'error');
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            profileAddressInput.value = `${latitude}, ${longitude}`; // Ger xeletî çêbibe, koordînat nîşan bide
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'زانیاری شوێن بەردەست نییە';
                break;
            case error.TIMEOUT:
                message = 'کاتی داواکارییەکە تەواو بوو';
                break;
            default:
                message = 'هەڵەیەکی نادیار ڕوویدا';
                break;
        }
        showNotification(message, 'error');
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}


function setupScrollObserver() {
    // Logic ji bo observera scrollê (wekî berê)
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Ger trigger xuya bibe û em ne di nav barkirinê de bin û hemû hilber nehatibin barkirin
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
            console.log("Scroll trigger intersected, loading more products...");
            // Tenê searchProductsInFirestore bang bike dema ku em di rewşa grid-a normal de ne
            const isNormalGridMode = !(state.currentCategory !== 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all' && !state.currentSearch);
            const isHomePageMode = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

            if (isNormalGridMode && !isHomePageMode) {
                searchProductsInFirestore(state.currentSearch, false); // false ji bo barkirina zêdetir
            }
        }
    }, {
        root: null, // Li gorî viewport
        threshold: 0.1 // 10% ji trigger xuya bibe
    });

    observer.observe(trigger);
}

function updateCategoryDependentUI() {
    // Logic ji bo nûvekirina UIya girêdayî kategoriyan (wekî berê)
    if (state.categories.length === 0) return; // Ger kategorî tune bin, venegere
    populateCategoryDropdown(); // Dropdown ji bo forma hilberê
    renderMainCategories(); // Rêza kategoriyên sereke li ser rûpela sereke
    // Ger admin têketibe, dropdownên admin jî nûve bike
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Ev jî nûve bike
    }
}

function setupEventListeners() {
    // Event listeners ji bo bişkokên navîgasyonê yên jêrîn
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            // Ger ne li ser rûpela sereke be, state biguherîne bo rûpela sereke
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        // Her dem filteran paqij bike û vegere rewşa destpêkê ya rûpela sereke
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Vegere state'a berê ya history
    };

    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn'); // Highlight bike
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn'); // Highlight bike
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn'); // Highlight bike
    };

    // Event listeners ji bo popupan
    settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); }; // Dema li derveyî modalê tê klîk kirin bigire

    // Forma têketinê
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            // Hewl bide têkeve bi email û password
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Ger serkeftî be, onAuthStateChanged dê UI nûve bike
        } catch (error) {
            showNotification(t('login_error'), 'error'); // Peyama xeletiyê nîşan bide
        }
    };

    // Lêgerîna sereke (rûpela sereke)
    const debouncedSearch = debounce((term) => {
        navigateToFilter({ search: term }); // State biguherîne bo lêgerînê
    }, 500); // Piştî 500ms ji nivîsandina dawî

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Bişkoka paqijkirinê nîşan bide/veşêre
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' }); // Vegere rewşa bê lêgerîn
    };

    // Lêgerîna di rûpelên din de (mînak, rûpela hûrguliyên subcategory)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        // Tenê dema li ser rûpela hûrguliyên subcategory be lêgerînê bike
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];

            // Sub-subcategory ya heyî bistîne (ger hebe)
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';

            // Hilberan li gorî lêgerînê render bike
            await renderProductsOnDetailPage(subCatId, subSubCatId, term);
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
        debouncedSubpageSearch(''); // Lêgerînê paqij bike
    };

    // Veguhastina lînkên têkiliyê
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    // Forma profîlê
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile)); // Di localStorage de hilîne
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup(); // Popup bigire
    };

    // Bişkokên guhertina ziman
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang); // Ziman biguherîne
        };
    });

    // Bişkoka sazkirina sepanê (PWA)
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Bişkokê veşêre piştî klîkê
                state.deferredPrompt.prompt(); // Prompt nîşan bide
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Promptê paqij bike
            }
        });
    }

    // Bişkoka agahdariyan
    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
    });

    // Bişkoka merc û polîtîkayan
    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet');
        });
    }

    // Bişkoka çalakkirina agahdariyan (Push Notifications)
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }

    // Bişkoka nûvekirina bi zorê (paqijkirina cache)
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    // Guhdarîkirina peyamên push dema sepan vekirî ye
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'Agahdariyek Nû';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        // Dibe ku em bixwazin badge nîşan bidin heta ku bikarhêner bişkokê klîk bike
        notificationBadge.style.display = 'block';
    });
}

onAuthStateChanged(auth, async (user) => {
    // Logic ji bo kontrolkirina statûsa admin (wekî berê)
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // UID ya xwe li vir têxe
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        console.log("Admin logged in.");
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            window.AdminLogic.initialize(); // Fonksiyonên admin çalak bike
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        console.log("User is not admin or logged out.");
        if (user) { // Ger bikarhênerek hebe lê ne admin be, derxe
            await signOut(auth);
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Fonksiyonên admin neçalak bike
        }
    }

    // Ger modalê têketinê vekirî be û admin têkeve, bigire
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});

function init() {
    // Destpêkirina sepanê
    renderSkeletonLoader(); // Skeleton nîşan bide heta ku daneyên yekem werin

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            initializeAppLogic(); // Piştî çalakkirina persistence, sepanê dest pê bike
        })
        .catch((err) => {
            // Handling errors ji bo persistence (wekî berê)
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open?');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported?');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            initializeAppLogic(); // Her hal, sepanê dest pê bike
        });
}

function initializeAppLogic() {
    // Guhdarîkirina guhertinên di kategoriyan de
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]; // 'All' zêde bike
        updateCategoryDependentUI(); // UIya girêdayî kategoriyan nûve bike

        // Piştî ku kategorî hatin barkirin, rewşa destpêkê ya rûpelê kontrol bike
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            // Ger URL rûpela subcategory nîşan bide, wê render bike
            const ids = hash.split('_');
            const mainCatId = ids[1];
            const subCatId = ids[2];
            // Li benda barkirina kategoriyan nemîne, jixwe hatine barkirin
            showSubcategoryDetailPage(mainCatId, subCatId, true); // true ji bo ku dîsa push neke nav history
        } else if (!document.getElementById('mainPage').classList.contains('page-active') && !document.getElementById('settingsPage').classList.contains('page-active')) {
            // Ger ne li ser subcategory page be û ne jî li ser rûpela sereke/settings be (mînak piştî refresh), rewşa destpêkê ji URL bistîne
            handleInitialPageLoad();
        } else if (document.getElementById('mainPage').classList.contains('page-active')) {
            // Ger jixwe li ser rûpela sereke be (mînak piştî guhertina ziman), naverokê ji nû ve render bike
            applyFilterState({ ...history.state });
        }

    }, error => {
        console.error("Error fetching categories: ", error); // Handling errors
        // Dibe ku em bixwazin peyamek xeletiyê nîşan bidin
    });

    // Fonksiyonên din ên destpêkê bang bike
    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    setLanguage(state.currentLanguage); // Zimanê destpêkê saz bike
    renderContactLinks(); // Lînkên têkiliyê render bike
    checkNewAnnouncements(); // Kontrol bike ka agahiyên nû hene
    showWelcomeMessage(); // Peyama xêrhatinê nîşan bide (ger cara yekem be)
    setupGpsButton(); // Bişkoka GPS saz bike
}

// Amûrên Global ji bo admin.js (wekî berê)
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, limit, where, runTransaction,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,

    clearProductCache: () => {
        console.log("Product cache and home page content cleared due to admin action.");
        state.productCache = {};
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Naveroka rûpela sereke paqij bike
        }
        // Dibe ku em bixwazin naverokê ji nû ve render bikin piştî paqijkirinê
        // applyFilterState({ ...history.state });
    },

    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Fonksiyonek ji bo gihîştina kategoriyan
    getCurrentLanguage: () => state.currentLanguage // Fonksiyonek ji bo gihîştina zimanê heyî
});


document.addEventListener('DOMContentLoaded', init); // Destpêkirina sepanê piştî barkirina DOM

// Guhdarîkirina eventa 'beforeinstallprompt' ji bo PWA (wekî berê)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Pêşî li prompta otomatîk bigire
    state.deferredPrompt = e; // Eventê hilîne
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex'; // Bişkokê nîşan bide
    }
});

// Logic ji bo Service Worker (wekî berê)
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                // Ger karkerek nû were sazkirin û karkerek kevn hebe
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Agahdariya nûvekirinê nîşan bide
                    updateNotification.classList.add('show');
                }
            });
        });

        // Klika li ser bişkoka "Nûve bike"
        updateNowBtn.addEventListener('click', () => {
            // Ji karkerê li bendê re bêje ku xwe çalak bike
            if (registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
            }
            updateNotification.classList.remove('show'); // Agahdariyê veşêre
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    // Dema ku karkerek nû kontrolê digire, rûpelê ji nû ve bar bike
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
        refreshing = true;
    });
}

// Fonksiyonên ji bo slidera promo (wekî berê)
function displayPromoCard(index) {
    const promoCardSlot = document.querySelector('.promo-card-grid-item');
    if (!promoCardSlot || !state.allPromoCards[index]) return; // Piştrast be ku element û dane hene

    const cardData = state.allPromoCards[index];
    const newCardElement = createPromoCardElement(cardData);
    newCardElement.classList.add('product-card-reveal'); // Ji bo animation (ger hewce be)

    // Animationa fade out/in
    promoCardSlot.style.transition = 'opacity 0.3s ease-in-out';
    promoCardSlot.style.opacity = 0;

    setTimeout(() => {
        if (promoCardSlot.parentNode) {
            promoCardSlot.parentNode.replaceChild(newCardElement, promoCardSlot);
            // Piştî ku hate guhertin, fade in bike
            setTimeout(() => {
                newCardElement.style.opacity = 1;
                newCardElement.classList.add('visible'); // Ji bo scroll animation (ger hebe)
            }, 10); // Demeke kurt bide ji bo ku DOM nûve bibe
        }
    }, 300); // Li benda qedandina fade out bimîne
}

function rotatePromoCard() {
    if (state.allPromoCards.length <= 1) return; // Ger tenê yek an kêmtir hebe, rotationê neke
    state.currentPromoCardIndex = (state.currentPromoCardIndex + 1) % state.allPromoCards.length;
    displayPromoCard(state.currentPromoCardIndex);
}

function changePromoCard(direction) {
    if (state.allPromoCards.length <= 1) return;
    state.currentPromoCardIndex += direction;
    // Kontrol bike ka index ji sînor derketiye
    if (state.currentPromoCardIndex >= state.allPromoCards.length) {
        state.currentPromoCardIndex = 0;
    } else if (state.currentPromoCardIndex < 0) {
        state.currentPromoCardIndex = state.allPromoCards.length - 1;
    }
    displayPromoCard(state.currentPromoCardIndex);
    startPromoRotation(); // Demjimêrê ji nû ve dest pê bike piştî guhertina manual
}

function startPromoRotation() {
    // Intervala heyî paqij bike
    if (state.promoRotationInterval) {
        clearInterval(state.promoRotationInterval);
    }
    // Ger ji yekê zêdetir promo card hebe, intervalek nû dest pê bike
    if (state.allPromoCards.length > 1) {
        state.promoRotationInterval = setInterval(rotatePromoCard, 5000); // Her 5 çirkeyan biguherîne
    }
}