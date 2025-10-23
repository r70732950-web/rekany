// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Çakkirî bo rûpela kategoriyan - Guhertoya 3.1 - Çareserkirina xeletiya deklarasyonê)

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, // Ensure these are imported from app-setup
    translations, state, // state object needs sliderIntervals: {} added in app-setup.js
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer
    // === START: Jêbirina xelet ===
    // categoryDetailPage // <<< Ev rêze hate jêbirin ji ber ku divê neyê import kirin
    // === END: Jêbirina xelet ===
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// === START: Deklarasyona rast ===
const categoryDetailPage = document.getElementById('categoryDetailPage');
// === END: Deklarasyona rast ===


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
    // Tenê ji bo rewşa filtera rûpela sereke pozîsyona scroll biparêze
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');
    const subpageSearchContainer = subpageHeader.querySelector('.subpage-search'); // Destnîşankirina qutiya lêgerînê

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
        // Vêvekirin an veşartina lêgerîna jêr-rûpelê li gorî rûpelê
        if (pageId === 'subcategoryDetailPage') {
            subpageSearchContainer.style.display = 'block'; // Lêgerînê nîşan bide
        } else {
            subpageSearchContainer.style.display = 'none'; // Lêgerînê veşêre (bo settings, categoryDetailPage)
        }
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
    } else if (pageId === 'categoryDetailPage') { // === START: Beşa nû ===
        updateHeaderView('categoryDetailPage', pageTitle); // Headerê ji bo rûpela nû nûve bike
    } // === END: Beşa nû ===
    else {
        updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    } else {
        // Ji bo rûpelên din (wek categoryDetailPage), tu bişkokek navîgasyonê çalak nake
        updateActiveNav(null);
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

async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all'; // Ev êdî li rûpela sereke bandorê nake
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories(); // Divê ev hîn jî were nûve kirin da ku bişkojka çalak were nîşandan
    // renderSubcategories êdî rasterast nayê bang kirin ji ber ku ew ê tenê li ser rûpela categoryDetailPage xuya bibe
    document.getElementById('subcategoriesContainer')?.remove(); // Ger hîn jî li DOMê be, jê bibe

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
        // subcategory: state.currentSubcategory, // Subcategory êdî ne beşek ji rewşa fîltera sereke ye
        search: state.currentSearch,
        scroll: window.scrollY
    }, '');

    const finalState = { ...history.state, ...newState, scroll: 0 };

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    // if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory); // Jêbirin
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    history.pushState(finalState, '', newUrl);

    await applyFilterState(finalState);
}

// === START: Guhertinên di popstate de ===
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI();
    const popState = event.state;
    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            // Ji nû ve girtina sernavê ji bo rûpelên hûrgulî
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
            // === START: Beşa nû ji bo categoryDetailPage ===
            else if (popState.id === 'categoryDetailPage' && !pageTitle && popState.categoryId) {
                 try {
                     const catRef = doc(db, "categories", popState.categoryId);
                     const catSnap = await getDoc(catRef);
                     if (catSnap.exists()) {
                         const cat = catSnap.data();
                         pageTitle = cat['name_' + state.currentLanguage] || cat.name_ku_sorani || 'Category';
                     }
                 } catch(e) { console.error("Could not refetch category title on popstate", e) }
                 // Dibe ku pêwîst be ku em naveroka rûpelê ji nû ve bar bikin
                 showPage(popState.id, pageTitle);
                 await renderSubcategoriesOnCategoryPage(popState.categoryId); // Subkategoriyan ji nû ve bar bike
                 await renderProductsOnCategoryPage(popState.categoryId, 'all'); // Berheman ji nû ve bar bike (ji bo hemî subkategoriyan)
                 return; // Vegere da ku showPage du caran neyê bang kirin
            }
             // === END: Beşa nû ===
            showPage(popState.id, pageTitle);
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type);
        } else {
            // Rewşa fîltera rûpela sereke
            showPage('mainPage');
            applyFilterState(popState, true);
        }
    } else {
        // Rewşa destpêkê ya rûpela sereke
        const defaultState = { category: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
});
// === END: Guhertinên di popstate de ===

// === START: Guhertinên di handleInitialPageLoad ===
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    let pageId = 'mainPage';
    let pageTitle = '';
    let categoryId = null; // Ji bo rûpela kategoriyê
    let subMainCatId = null, subCatId = null; // Ji bo rûpela jêr-kategoriyê

    if (hash === 'settingsPage') {
        pageId = 'settingsPage';
        pageTitle = t('settings_title');
    } else if (hash.startsWith('category_')) {
        pageId = 'categoryDetailPage';
        categoryId = hash.split('_')[1];
        // Sernav dê paşê were girtin
    } else if (hash.startsWith('subcategory_')) {
        pageId = 'subcategoryDetailPage';
        const ids = hash.split('_');
        subMainCatId = ids[1];
        subCatId = ids[2];
        // Sernav dê paşê were girtin
    }

    if (pageId === 'mainPage') {
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            // subcategory êdî tune
            search: params.get('search') || '',
            scroll: 0
        };
        history.replaceState(initialState, '');
        applyFilterState(initialState); // Ev dê searchProductsInFirestore bang bike
    } else {
         // Ji bo rûpelên din, rewşa rûpelê tê danîn
         // showPage dê di nav onSnapshot-a kategoriyan de were bang kirin da ku pêşî sernavê bigire
         history.replaceState({ type: 'page', id: pageId, title: pageTitle, categoryId: categoryId, mainCatId: subMainCatId, subCatId: subCatId }, '', `#${hash}`);
         // Pêşî loadingê nîşan bide
         if (pageId === 'categoryDetailPage') {
            const loader = document.getElementById('categoryPageLoader');
            if(loader) loader.style.display = 'block';
         } else if (pageId === 'subcategoryDetailPage') {
            const loader = document.getElementById('detailPageLoader');
            if(loader) loader.style.display = 'block';
         }
         showPage(pageId, pageTitle); // Pêşî rûpelê nîşan bide, paşê naverokê bar bike
    }

    // Germahiya vekirina popupan li ser rûpela sereke
    if (pageId === 'mainPage') {
        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                openPopup(hash, isSheet ? 'sheet' : 'modal');
            }
        }
    }

    const productId = params.get('product');
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500); // Ger hebe, hûrguliyên berhemê nîşan bide
    }
}
// === END: Guhertinên di handleInitialPageLoad ===

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

    // Vegerandina naveroka rûpela malê an berheman piştî guhertina ziman
    const currentPageId = document.querySelector('.page-active')?.id;
    if (currentPageId === 'mainPage') {
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) homeContainer.innerHTML = ''; // Ji nû ve vala bike
        searchProductsInFirestore(state.currentSearch, true); // Ji nû ve bar bike an rûpela malê nîşan bide
    } else if (currentPageId === 'categoryDetailPage') {
        const categoryId = history.state?.categoryId;
        if(categoryId) {
            renderSubcategoriesOnCategoryPage(categoryId);
            renderProductsOnCategoryPage(categoryId, 'all'); // Ji nû ve bi 'all' dest pê bike
        }
    } else if (currentPageId === 'subcategoryDetailPage') {
        const { mainCatId, subCatId } = history.state || {};
        if(mainCatId && subCatId) {
            renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
            renderProductsOnDetailPage(subCatId, 'all', ''); // Ji nû ve bi 'all' û bê lêgerîn dest pê bike
        }
    }

    renderMainCategories(); // Her gav kategoriyên sereke nûve bike
    renderCategoriesSheet();
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
    if (activeBtnId) {
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
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
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ'
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
        if (state.currentCategory === cat.id && document.getElementById('mainPage').classList.contains('page-active')) {
             btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             // === START: Guhertina fonksiyona klîkê ===
             if (cat.id === 'all') {
                 // Ger 'Hemî' be, wekî berê filter bike
                 await navigateToFilter({
                     category: cat.id,
                     search: ''
                 });
                 showPage('mainPage'); // Piştrast be ku li rûpela sereke yî
             } else {
                 // Wekî din, rûpela hûrguliyên kategoriyê nîşan bide
                 showCategoryDetailPage(cat.id, categoryName);
             }
             // === END: Guhertina fonksiyona klîkê ===
            closeCurrentPopup();
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

async function renderSubSubcategories(mainCatId, subCatId) {
    // Ev fonksiyon êdî ji bo rûpela sereke ne pêwîst e
    subSubcategoriesContainer.innerHTML = '';
}

// === START: Fonksiyona nû: showCategoryDetailPage ===
async function showCategoryDetailPage(categoryId, categoryName, fromHistory = false) {
    // Ger nav nehatiye dayîn (mînak ji popstate), hewl bide ku ji Firestore bigire
    if (!categoryName) {
        try {
            const catRef = doc(db, "categories", categoryId);
            const catSnap = await getDoc(catRef);
            if (catSnap.exists()) {
                const cat = catSnap.data();
                categoryName = cat['name_' + state.currentLanguage] || cat.name_ku_sorani || 'Category';
            } else {
                categoryName = 'Category';
            }
        } catch (e) {
            console.error("Could not fetch category name:", e);
            categoryName = 'Category';
        }
    }

    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'categoryDetailPage', title: categoryName, categoryId: categoryId }, '', `#category_${categoryId}`);
    }
    showPage('categoryDetailPage', categoryName);

    const loader = document.getElementById('categoryPageLoader');
    const productsContainer = document.getElementById('productsContainerOnCategoryPage');
    const subCatContainer = document.getElementById('subCategoryContainerOnDetailPage');

    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subCatContainer.innerHTML = '';

    // Di vê rûpelê de lêgerîn tune ye, ji ber vê yekê input tune ku were vala kirin

    await renderSubcategoriesOnCategoryPage(categoryId); // Subkategoriyan bar bike
    await renderProductsOnCategoryPage(categoryId, 'all'); // Berheman bar bike (ji bo hemî subkategoriyan dest pê bike)

    loader.style.display = 'none';
}
// === END: Fonksiyona nû ===

// === START: Fonksiyona nû: renderSubcategoriesOnCategoryPage ===
async function renderSubcategoriesOnCategoryPage(categoryId) {
    const container = document.getElementById('subCategoryContainerOnDetailPage');
    container.innerHTML = '';

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (subcategories.length === 0) {
            container.style.display = 'none'; // Ger subkategorî tune bin, veşêre
            return;
        }

        container.style.display = 'flex'; // Ger hebin, nîşan bide

        // Bişkojka 'Hemî'
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Bi default 'Hemî' çalak e
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            await renderProductsOnCategoryPage(categoryId, 'all'); // Berhemên hemî subkategoriyan nîşan bide
        };
        container.appendChild(allBtn);

        // Bişkojkên subkategoriyên din
        subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            subcatBtn.onclick = async () => {
                 container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                 subcatBtn.classList.add('active');
                 // Germahiya vekirina rûpela hûrgulî ya subkategoriyê dema klîk tê kirin
                 showSubcategoryDetailPage(categoryId, subcat.id);
            };
            container.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories for category detail page: ", error);
        container.style.display = 'none'; // Ger xeletiyek hebe, veşêre
    }
}
// === END: Fonksiyona nû ===

// === START: Fonksiyona nû: renderProductsOnCategoryPage ===
async function renderProductsOnCategoryPage(mainCategoryId, subCategoryId = 'all') {
    const productsContainer = document.getElementById('productsContainerOnCategoryPage');
    const loader = document.getElementById('categoryPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';

    try {
        let productsQuery;
        if (subCategoryId === 'all') {
            // Hemî berhemên di kategoriya sereke de bigire
            productsQuery = query(productsCollection, where("categoryId", "==", mainCategoryId));
        } else {
            // Tenê berhemên subkategoriya hilbijartî bigire
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCategoryId));
        }

        // Rêzkirin li gorî dema çêkirinê (nûtirîn pêşî)
        productsQuery = query(productsQuery, orderBy("createdAt", "desc"));

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک بۆ ئەم جۆرە نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for category page (mainCatId: ${mainCategoryId}, subCatId: ${subCategoryId}):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا لە کاتی هێنانی کاڵاکان.</p>';
    } finally {
        loader.style.display = 'none';
    }
}
// === END: Fonksiyona nû ===


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
        // Zêdekirina mainCatId li rewşa dîrokê da ku dema vegere were zanîn
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

    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Hemî berhemên subkategoriyê nîşan bide

    loader.style.display = 'none';
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
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';

    try {
        let productsQuery;
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Ger lêgerîn hebe, rêzkirina yekem divê li gorî qada newekheviyê be
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Ger lêgerîn tune be, rêzkirina orîjînal bikar bîne
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loader.style.display = 'none';
    }
}


// === START: Guhertina fonksiyona renderSubcategories ===
async function renderSubcategories(categoryId) {
    // Ev fonksiyon êdî ji bo rûpela sereke nayê bikar anîn.
    // Dibe ku di pêşerojê de were jêbirin, lê ji bo niha vala dihêlin.
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (subcategoriesContainer) {
        subcategoriesContainer.innerHTML = '';
        subcategoriesContainer.style.display = 'none'; // Bi tevahî veşêre
    }
}
// === END: Guhertina fonksiyona renderSubcategories ===


// === START: Guhertina fonksiyona renderMainCategories ===
function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Tenê heke li rûpela sereke bin û fîlter li ser vê kategoriyê be, çalak nîşan bide
        if (document.getElementById('mainPage').classList.contains('page-active') && state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
             // === START: Guhertina çalakiya klîkê ===
             if (cat.id === 'all') {
                 // Ger li rûpelek din bin, vegere rûpela sereke
                 if (!document.getElementById('mainPage').classList.contains('page-active')) {
                     history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
                     showPage('mainPage');
                 }
                 // Her gav filtera 'Hemî' bicîh bîne
                 await navigateToFilter({
                     category: cat.id,
                     search: ''
                 });
             } else {
                 // Rûpela hûrguliyên kategoriyê nîşan bide
                 showCategoryDetailPage(cat.id, categoryName);
             }
             // === END: Guhertina çalakiya klîkê ===
        };

        container.appendChild(btn);
    });
}
// === END: Guhertina fonksiyona renderMainCategories ===


function showProductDetails(productId) {
    // Hewl bide ku berhemê ji cache an lîsteya niha bigire
    let product = state.products.find(p => p.id === productId);
    if (!product) {
         product = state.productCache && Object.values(state.productCache).flatMap(cache => cache.products).find(p => p.id === productId);
    }

    if (!product) {
        console.log("Product not found locally. Trying to fetch...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct);
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(err => {
            console.error("Error fetching product details:", err);
            showNotification(t('error_generic'), 'error');
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
        return;
    }

    let q;
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Ji bo ku xwe nîşan nede
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else { // Ger tenê categoryId hebe
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
            console.log("No related products found.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            container.appendChild(card);
        });

        section.style.display = 'block';

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}


function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0; // Scroll bike jorê dema vedibe
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
        if (!images[index] || !thumbnails[index]) return; // Kontrol bike ku index derbasdar e
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

    // Piştrast be ku event listenerên kevn jê dibin berî ku yên nû lê zêde bikin
    prevBtn.onclick = null;
    nextBtn.onclick = null;
    thumbnails.forEach(thumb => thumb.onclick = null);

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
    addToCartButton.onclick = null; // Listenera kevn jê bibe
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Popupê bigire piştî zêdekirinê
    };

    renderRelatedProducts(product); // Kaڵای هاوشێوە nîşan bide

    openPopup('productDetailSheet');
}

// Function to create promo card element (now takes sliderState)
function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';
    const currentCard = cardData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) {
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                 // === START: Guhertina çûna rûpela kategoriyê ===
                 const targetCategory = state.categories.find(cat => cat.id === targetCategoryId);
                 const targetCategoryName = targetCategory ? (targetCategory['name_' + state.currentLanguage] || targetCategory.name_ku_sorani) : '';
                 showCategoryDetailPage(targetCategoryId, targetCategoryName);
                 // === END: Guhertina çûna rûpela kategoriyê ===
            }
        }
    });

    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;
        });
    }

    return cardElement;
}


function createProductCardElement(product) {
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
                 try {
                     document.execCommand('copy');
                     showNotification('لينكى کاڵا کۆپى کرا!', 'success');
                 } catch (err) {
                     showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error');
                 }
                 document.body.removeChild(textArea);
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
            // Event listener jixwe pêvekirî ye
        } else if (!target.closest('a')) { // Pêşî lê bigire ku heke li ser lînka di danasînê de were klîk kirin, were çalak kirin
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
        threshold: 0.1
    });

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
    container.style.display = 'grid';
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none';
    }
}

function renderProducts() {
    productsContainer.innerHTML = '';
    if (!state.products || state.products.length === 0) {
        return; // Heke berhem tune bin, tiştekî neke
    }

    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });

    setupScrollAnimations();
}

async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Sernavê ji objectê bigire ger hebe, wekî din ji daneyên rêzê
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

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
            return null; // Rêzên vala nîşan nede
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
                 // === START: Guhertina çûna rûpela kategoriyê ===
                 const targetCategoryId = cardData.categoryId;
                 const targetSubcategoryId = cardData.subcategoryId;

                 if (targetSubcategoryId && targetCategoryId) {
                     showSubcategoryDetailPage(targetCategoryId, targetSubcategoryId);
                 } else if (targetCategoryId) {
                     const targetCategory = state.categories.find(cat => cat.id === targetCategoryId);
                     const targetCategoryName = targetCategory ? (targetCategory['name_' + state.currentLanguage] || targetCategory.name_ku_sorani) : '';
                     showCategoryDetailPage(targetCategoryId, targetCategoryName);
                 } else {
                     // Ger tu kategorî nehatiye girêdan, vegere rûpela sereke bi filtera 'Hemî'
                     if (!document.getElementById('mainPage').classList.contains('page-active')) {
                         history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
                         showPage('mainPage');
                     }
                     await navigateToFilter({ category: 'all', search: '' });
                 }
                 // === END: Guhertina çûna rûpela kategoriyê ===
            };
            cardsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani;
    let targetDocRef;

    if (subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
    } else if (subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
        targetDocRef = doc(db, `categories/${categoryId}`);
    } else {
        return null;
    }

    try {
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
             // === START: Guhertina çalakiya 'Binêre Hemî' ===
             if(subcategoryId) {
                 showSubcategoryDetailPage(categoryId, subcategoryId);
             } else {
                 showCategoryDetailPage(categoryId, title); // Sernavê jixwe girtî bikar bîne
             }
             // === END: Guhertina çalakiya 'Binêre Hemî' ===
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}


async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`;
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

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
                 // === START: Guhertina çalakiya klîka brandê ===
                 if (brand.subcategoryId && brand.categoryId) {
                     showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                 } else if(brand.categoryId) {
                     const targetCategory = state.categories.find(cat => cat.id === brand.categoryId);
                     const targetCategoryName = targetCategory ? (targetCategory['name_' + state.currentLanguage] || targetCategory.name_ku_sorani) : '';
                     showCategoryDetailPage(brand.categoryId, targetCategoryName);
                 }
                 // === END: Guhertina çalakiya klîka brandê ===
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands for group:", error);
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
    // Vebijarka 'Binêre Hemî' ji bo 'Nûtirîn' nayê zêdekirin
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
            return null;
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
        // Tenê çend berheman ji bo beşa rûpela malê bigire
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Ger tu berhem tune bin, render neke
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
        renderSkeletonLoader(homeSectionsContainer, 4);
        homeSectionsContainer.innerHTML = ''; // Naveroka berê paqij bike

        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             // Ger tu beş nebin, tenê beşa 'Hemî Berhem' nîşan bide
             const allProductsElem = await renderAllProductsSection();
             if (allProductsElem) homeSectionsContainer.appendChild(allProductsElem);
        } else {
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id);
                        } else { console.warn("Promo slider section is missing groupId."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section is missing groupId."); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                        if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                        } else { console.warn("Single shortcut row section is missing rowId."); }
                        break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        } else { console.warn("Single category row section is missing categoryId."); }
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
        state.isRenderingHomePage = false;
    }
}

async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container';
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`;

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards };

            const promoCardElement = createPromoCardElement(cardData, sliderState);
            promoGrid.appendChild(promoCardElement);

            if (cards.length > 1) {
                const rotate = () => {
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return;
                    }
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                sliderState.intervalId = setInterval(rotate, 5000);
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }

            return promoGrid;
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null;
}


async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    // Guhertin: Nîşandana beşan tenê heke lêgerîn tune be û kategoriya 'Hemî' be
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all';

    if (shouldShowHomeSections && document.getElementById('mainPage').classList.contains('page-active')) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Tenê heke vala be an naveroka wê kevn be, ji nû ve bar bike
        if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) {
             await renderHomePageContent();
        }
        return;
    } else {
        homeSectionsContainer.style.display = 'none';
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};
    }

    const cacheKey = `${state.currentCategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';

        renderProducts();
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    if (state.isLoadingMoreProducts) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader();
    }

    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block';

    try {
        let productsQuery = collection(db, "products");

        // Fîlterkirin li gorî kategoriya sereke (ger ne 'Hemî' be)
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }

        // Fîlterkirin li gorî lêgerînê
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Rêzkirin
        if (finalSearchTerm) {
            // Ger lêgerîn hebe, pêşî li gorî navê rêz bike
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Wekî din, li gorî dema çêkirinê rêz bike
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Pagination
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

        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block';
        }

        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Cachekirin (tenê ji bo lêgerînên nû)
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        renderProducts(); // Berheman li ser rûpela sereke nîşan bide

        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}


function addToCart(productId) {
    // Hewl bide ku berhemê ji cache an lîsteya niha bigire
    let product = state.products.find(p => p.id === productId);
    if (!product) {
         product = state.productCache && Object.values(state.productCache).flatMap(cache => cache.products).find(p => p.id === productId);
    }

    const processAddToCart = (prod) => {
        const mainImage = (prod.imageUrls && prod.imageUrls.length > 0) ? prod.imageUrls[0] : (prod.image || '');
        const existingItem = state.cart.find(item => item.id === productId);
        if (existingItem) { existingItem.quantity++; }
        else { state.cart.push({ id: prod.id, name: prod.name, price: prod.price, image: mainImage, quantity: 1 }); }
        saveCart();
        showNotification(t('product_added_to_cart'));
    };

    if (product) {
         processAddToCart(product);
    } else {
        console.warn("Product not found locally. Fetching...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                processAddToCart(fetchedProduct);
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(err => {
             console.error("Error fetching product to add to cart:", err);
             showNotification(t('error_generic'), 'error');
        });
    }
}


function renderCart() {
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
    renderCartActionButtons(); // Bişkokên çalakiyê nîşan bide

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
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { saveCart(); renderCart(); }
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

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
    const container = document.getElementById('cartActions');
    container.innerHTML = '';

    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt"));

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const method = { id: doc.id, ...doc.data() };
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn'; // Use a generic class or adjust dynamically
        btn.style.backgroundColor = method.color;

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
                    link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                    break;
                case 'telegram':
                    link = `https://t.me/${value}?text=${encodedMessage}`;
                    break;
                case 'phone':
                    link = `tel:${value}`;
                    break;
                case 'url':
                    link = value;
                    break;
            }

            if (link) {
                window.open(link, '_blank');
            }
        };

        container.appendChild(btn);
    });
}

async function renderPolicies() {
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
        }
    });
}

async function renderUserNotifications() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
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
    notificationBadge.style.display = 'none';
}

function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
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
    });
}

function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    if (!getLocationBtn) return;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

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
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case 1: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
            case 2: message = 'شوێنەکەت نەدۆزرایەوە'; break;
            case 3: message = 'کاتی داواکارییەکە تەواو بوو'; break;
            default: message = 'هەڵەیەکی نادیار ڕوویدا'; break;
        }
        showNotification(message, 'error');
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}

function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Tenê li rûpela sereke barkirina zêdetir bike
        if (entries[0].isIntersecting && document.getElementById('mainPage').classList.contains('page-active')) {
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 searchProductsInFirestore(state.currentSearch, false);
            }
        }
    }, {
        root: null,
        threshold: 0.1
    });

    observer.observe(trigger);
}

function updateCategoryDependentUI() {
    if (state.categories.length === 0) return;
    populateCategoryDropdown();
    renderMainCategories();
    // Dropdownên admin nûve bike tenê heke mantiqê admin hatibe barkirin û bikarhêner admin be
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
         window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Dropdownên karta shortcut jî nûve bike
    }
}

function setupEventListeners() {
    homeBtn.onclick = async () => {
        // Ger li rûpelek din bin, vegere rûpela sereke
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
             // === START: Ji bo vegera li rûpela sereke ===
             // Rewşa kevn a rûpelê (mînak categoryDetailPage) ji dîrokê jê bibe an na?
             // Ji bo sadebûnê, em tenê rewşa nû ya rûpela sereke datînin
             history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
             showPage('mainPage');
             // === END ===
        }
        // Fîlteran sifir bike
        await navigateToFilter({ category: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Bişkojka paşveçûnê ya headerê
    };

    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn');
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn');
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn');
    };

    settingsFavoritesBtn.onclick = () => {
        openPopup('favoritesSheet');
    };

    settingsAdminLoginBtn.onclick = () => {
        openPopup('loginModal', 'modal');
    };

    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Destpêkirina mantiqê admin dê bi riya onAuthStateChanged pêk were
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
    };

    const debouncedSearch = debounce((term) => {
        // Tenê li rûpela sereke lêgerînê bike
        if (document.getElementById('mainPage').classList.contains('page-active')) {
             navigateToFilter({ search: term });
        }
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        // Tenê li rûpela sereke lêgerînê bike
        if (document.getElementById('mainPage').classList.contains('page-active')) {
             navigateToFilter({ search: '' });
        }
    };

    // Mantiqê lêgerîna jêr-rûpelê (ji bo rûpela subcategoryDetailPage)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            await renderProductsOnDetailPage(subCatId, subSubCatId, term);
        }
        // Ji bo categoryDetailPage lêgerîn nehatiye çalak kirin
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


    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };


    profileForm.onsubmit = (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
        };
    });

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none';
                state.deferredPrompt.prompt();
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null;
            }
        });
    }

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
    });

    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet');
        });
    }

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }

    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block';
    });
}

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Piştrast be ku DOM amade ye berî ku initialize bang bike
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                   window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
             console.warn("AdminLogic not found or initialize not a function.");
             // Ger admin.js hîn nehatiye barkirin, demekê bisekine û dîsa hewl bide
             setTimeout(() => {
                if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                    window.AdminLogic.initialize();
                } else {
                     console.error("AdminLogic still not available after delay.");
                }
             }, 500);
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) {
            // Ger bikarhênerek ne-admin bi awayekî ketibe hundur, wî derxe.
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Hêmanên UI yên admin paqij bike
        }
    }

    // Modal login bigire heke bikarhêner bi serkeftî wekî admin têkeve
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


function init() {
    renderSkeletonLoader(); // Skeleton loaderê yekser nîşan bide

    // Hewl bide ku persistansa offline çalak bike
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            // Mantiqê sereke yê sepanê piştî ku persistans hate saz kirin (an bi keremî têk çû) dest pê bike
            initializeAppLogic();
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                // Gelek tab vekirî ne, persistans tenê di yek tabê de dikare were çalak kirin.
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                // Geroka heyî hemî taybetmendiyên pêwîst ji bo çalakkirina persistansê piştgirî nake.
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            // Mantiqê sereke yê sepanê dest pê bike hetta ku persistans têk biçe
            initializeAppLogic();
        });
}

function initializeAppLogic() {
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Kategoriyan bigire û UI-ya destpêkê li gorî wan saz bike
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]; // Kategoriya 'Hemî' lê zêde bike
        updateCategoryDependentUI(); // Dropdown û bişkokên kategoriyê nûve bike

        // Barkirina rûpela destpêkê li gorî URL (hash an pîvanên query)
        // Pêdivî ye ku ev *piştî* barkirina kategoriyan were meşandin da ku potansiyel bi rêkûpêk fîlter bike
        const currentState = history.state; // Rewşa heyî ya dîrokê kontrol bike

        // Ger rewşek hebe û ew ne popupek be, hewl bide ku li gorî wê rewşê render bike
        if (currentState && currentState.type === 'page' && !document.querySelector('.page-active')) {
             console.log("Initializing page based on history state:", currentState);
             let pageTitle = currentState.title;

             // Germahiya ji nû ve girtina sernavê
             if (currentState.id === 'categoryDetailPage' && !pageTitle && currentState.categoryId) {
                 const cat = state.categories.find(c => c.id === currentState.categoryId);
                 pageTitle = cat ? (cat['name_' + state.currentLanguage] || cat.name_ku_sorani) : 'Category';
             } else if (currentState.id === 'subcategoryDetailPage' && !pageTitle && currentState.subCatId) {
                  try {
                     const subCatRef = doc(db, "categories", currentState.mainCatId, "subcategories", currentState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         const subCat = subCatSnap.data();
                         pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                     }
                  } catch(e) { console.error("Could not fetch subcat title on init state", e) }
             }

             showPage(currentState.id, pageTitle);
             // Germahiya ji nû ve barkirina naverokê
             if (currentState.id === 'categoryDetailPage' && currentState.categoryId) {
                 await renderSubcategoriesOnCategoryPage(currentState.categoryId);
                 await renderProductsOnCategoryPage(currentState.categoryId, 'all');
             } else if (currentState.id === 'subcategoryDetailPage' && currentState.mainCatId && currentState.subCatId) {
                  await renderSubSubcategoriesOnDetailPage(currentState.mainCatId, currentState.subCatId);
                  await renderProductsOnDetailPage(currentState.subCatId, 'all', '');
             } else if (currentState.id === 'mainPage') {
                 // Dibe ku pêwîst be ku em rewşa fîltera rûpela sereke bicîh bînin ger di dîrokê de hebe
                 const filterState = { category: currentState.category || 'all', search: currentState.search || '', scroll: currentState.scroll || 0};
                 applyFilterState(filterState);
             }
        }
        // Ger rewşek tune be an ew popupek be, barkirina rûpela destpêkê ya normal bike
        else if (!document.querySelector('.page-active')) {
            console.log("Initializing page based on URL (handleInitialPageLoad)");
            handleInitialPageLoad();
        }

        // Ziman bicîh bike piştî barkirina destpêkê (dibe ku ji nû ve were bang kirin lê baş e)
        setLanguage(state.currentLanguage);
    });

    // Beşên din ên sepanê saz bike
    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    setLanguage(state.currentLanguage); // Zimanê destpêkê bicîh bike
    renderContactLinks(); // Lînkên têkiliyê bigire û nîşan bide
    checkNewAnnouncements(); // Ji bo nîşana agahdariyê kontrol bike
    showWelcomeMessage(); // Tenê di serdana yekem de nîşan bide
    setupGpsButton(); // Fonksiyona GPS li navnîşana profîlê zêde bike
}

// Fonksiyon/guhêrbarên pêwîst ji bo admin.js eşkere bike
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // Koleksiyonên nû derbas bike

    // Fonksiyonên alîkar ji bo mantiqê admin
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Cache paqij bike
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Rûpela malê paqij bike da ku ji nû ve render bike
        }
        // Vebijêrk: Ji nû ve render bike ger bikarhêner li rûpela malê be
        if (document.getElementById('mainPage').classList.contains('page-active')) {
            searchProductsInFirestore(state.currentSearch, true);
        }
    },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Kategoriyan ji admin re peyda bike
    getCurrentLanguage: () => state.currentLanguage // Ziman ji admin re peyda bike
});

// Pêvajoya destpêkirina sepanê dest pê bike
document.addEventListener('DOMContentLoaded', init);

// Germahiya daxwaza sazkirina PWA
window.addEventListener('beforeinstallprompt', (e) => {
    // Pêşî li xuya bûna mini-infobarê li ser mobîlê bigire
    e.preventDefault();
    // Bûyerê hilîne da ku paşê were çalak kirin.
    state.deferredPrompt = e;
    // UI nûve bike da ku bikarhêner agahdar bike ku ew dikarin PWA saz bikin
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex'; // Bişkojka sazkirinê di mîhengan de nîşan bide
    }
    console.log('`beforeinstallprompt` event was fired.');
});


// Germahiya nûvekirina Service Worker
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        // Nûvekirinên Service Worker bişopîne.
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                // Rewşa network.state guheriye?
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Karkera nû hatiye sazkirin û li bendê ye (hebûna controller tê wateya ku rûpela heyî tê kontrol kirin)
                    // Bara agahdariya nûvekirinê nîşan bide
                    updateNotification.classList.add('show');
                }
            });
        });

        // Event listener ji bo bişkojka nûvekirinê
        updateNowBtn.addEventListener('click', () => {
             // Ger karkerek li benda çalakkirinê be, peyamê jê re bişîne
             if (registration.waiting) {
                 registration.waiting.postMessage({ action: 'skipWaiting' });
             } else {
                 // Ger karkerek li benda nebe, dibe ku nûvekirin hîn nehatiye daxistin. Tenê rûpelê ji nû ve bar bike.
                 console.log("No waiting service worker found, attempting reload for update.");
                 window.location.reload();
             }
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    // Guhdarî bike ji bo guherîna controllerê ku piştî skipWaiting tê bang kirin
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Ev dema ku service workerê ku vê rûpelê kontrol dike diguhere tê çalak kirin
        // Pêdivî ye ku rûpel ji nû ve were barkirin da ku service workera nû bikar bîne.
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
    });
}

