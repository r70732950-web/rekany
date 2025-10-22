// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Çakkirî bo çareserkirina کێشەی گەڕانەوەی سکڕۆڵ - Hewldana 3)

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
    // *** GUHERTIN: Piştrast be ku em tenê pozîsyona ji bo rûpela serekiyê tomar dikin ***
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        // console.log("Saving scroll for main page:", window.scrollY);
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

    // *** GUHERTIN: Skrolkirina bo jorê ji vir hat rakirin, dê ji applyFilterState were kirin ***
    // if (pageId !== 'mainPage') {
    //     window.scrollTo(0, 0); // Ev rêze êdî ne pêwîst e li vir
    // }

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
    saveCurrentScrollPosition(); // Tomarkirina pozîsyona skrolê berî vekirina popup
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
        history.back(); // Bihêle popstate birêve bibe
    } else {
        closeAllPopupsUI(); // Wekî din, hemûyan bigire
    }
}

// *** GUHERTINA Sereke 1: applyFilterState ***
async function applyFilterState(filterState, fromPopState = false) {
    // 1. Nûvekirina guherbarên state
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // 2. Nûvekirina hêmanên UI yên bingehîn
    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';
    renderMainCategories();
    await renderSubcategories(state.currentCategory); // Ev dê barê jêr-kategoriyan nîşan bide/veşêre

    // 3. Anîn û nîşandana berheman yan beşên rûpela serekiyê
    // Nîşeya 'true' wek isNewSearch tê şandin ji bo ku cache were bikaranîn an nûvekirin
    // Em êdî pozîsyona skrolê naşînin; dê piştî renderkirinê were birêvebirin
    await searchProductsInFirestore(state.currentSearch, true, fromPopState);

    // 4. Skrolkirin PIŞTÎ ku searchProductsInFirestore qediya û render kir
    // Em ê hewl bidin skrolkirinê hinekî din dereng bixin, nemaze dema vedigerin rûpela serekiyê
    const shouldShowHomeSections = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    const scrollRestoreDelay = shouldShowHomeSections ? 250 : 150; // Derengiyek dirêjtir ji bo rûpela serekiyê

    if (fromPopState && typeof filterState.scroll === 'number') {
        // console.log(`Restoring scroll from popstate: ${filterState.scroll} after ${scrollRestoreDelay}ms`);
        setTimeout(() => window.scrollTo(0, filterState.scroll), scrollRestoreDelay);
    } else if (!fromPopState) {
         // Ji bo filterên nû yên rasterast (ne ji popstate), here jor
         // console.log("Scrolling to top for new filter/search");
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


async function navigateToFilter(newState) {
    // Tomarkirina pozîsyona skrolê ya heyî berî guhertina state
    saveCurrentScrollPosition(); // Ev girîng e

    const finalState = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
         // scroll: window.scrollY // Êdî ne pêwîst e li vir tomar bikî, saveCurrentScrollPosition dike
         ...newState, // Guhertinên nû li ser yên kevin zêde bike
         scroll: 0 // Pozîsyona skrolê ya armanc ji bo state nû sifir bike
    };

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    history.pushState(finalState, '', newUrl); // State nû bi skrol=0 tomar bike

    await applyFilterState(finalState, false); // Nîşan bide ku ev ne ji popstate ye
}

window.addEventListener('popstate', async (event) => { // Guhertin bo async
    closeAllPopupsUI(); // Pêşî hemû popupan bigire
    const popState = event.state;
    // console.log("Popstate triggered:", popState);

    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            // Koda ji bo anîna sernavê rûpela jêr-kategoriyê wek xwe dimîne
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
            // Vegerîna ji popupê, divê em vegerin state berî popupê
            // Dibe ku pêwîstî bi mentiqek zêdetir hebe li vir heger state berî popupê filter bû
            // Lê ji bo niha, tenê popupê vedike (an jî divê bê girtin, ku closeAllPopupsUI dike)
             // openPopup(popState.id, popState.type); // Dibe ku ev ne hewce be heger em tenê popupê digirin
        } else {
            // Vegerîna navbera filteran an rûpela serekiyê
            showPage('mainPage'); // Her dem rûpela serekiyê nîşan bide ji bo filteran
            await applyFilterState(popState, true); // Nîşan bide ku ev ji popstate ye
        }
    } else {
        // Heger state tune be (mînak, gava yekem car rûpel tê barkirin û paşê vedigerî)
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        await applyFilterState(defaultState, true); // Bihesibîne ku ev wek popstate ye
    }
});

// Fonksiyona handleInitialPageLoad hinekî sade dibe
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    let initialState;

    // Ger hash hebe û ne popup be, hewl bide rûpelê veke
    if (hash && !document.getElementById(hash)?.classList.contains('bottom-sheet') && !document.getElementById(hash)?.classList.contains('modal')) {
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const mainCatId = ids[1];
            const subCatId = ids[2];
            // Em li benda barkirina kategoriyan dimînin berî ku rûpela detail nîşan bidin
            // Lê em state tomar dikin
            initialState = { type: 'page', id: 'subcategoryDetailPage', mainCatId: mainCatId, subCatId: subCatId, scroll: 0 };
        } else if (hash === 'settingsPage') {
            initialState = { type: 'page', id: 'settingsPage', title: t('settings_title'), scroll: 0 };
        }
    }

    // Ger initialState nehatibe danîn, ango em li rûpela serekiyê ne
    if (!initialState) {
        initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Destpêkê skrol sifir e
        };
        // Rûpela serekiyê nîşan bide
        showPage('mainPage');
        // Filterên destpêkê bicîh bîne (lê ne wek popstate)
        // applyFilterState(initialState, false); // isNewSearch dê bibe true di searchProductsInFirestore de
        // *** GUHERTIN: Bangkirina applyFilterState dê di initializeAppLogic de be piştî barkirina kategoriyan ***
    }

    // State destpêkê tomar bike di history de
    history.replaceState(initialState, '');

    // Barkirina popupan heger di hash de bin piştî barkirina rûpela serekiyê
    const element = document.getElementById(hash);
    if (element && initialState && !initialState.type) { // Tenê popupan veke heger em li rûpela serekiyê bin
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            // Derengiyek biçûk bide berî vekirina popupê da ku piştrast bî rûpel barkiriye
            setTimeout(() => openPopup(hash, isSheet ? 'sheet' : 'modal'), 100);
        }
    }

    // Barkirina hûrguliyên berhemê heger di URL de be
    const productId = params.get('product');
    if (productId) {
        // Derengiyek bide berî nîşandana hûrguliyan
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
        homeContainer.innerHTML = ''; // Paqijkirina beşên kevin
    }

    // Ji nû ve renderkirina naverokê li gorî state heyî
    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (isHomeView) {
        renderHomePageContent(); // Ji nû ve renderkirina rûpela serekiyê
    } else {
        // Ji bo dîtinên filterkirî, divê em ji nû ve lê bigerin da ku berheman bi zimanê rast nîşan bidin
        // Lê ji bo performansê, em dikarin tenê berhemên heyî ji nû ve render bikin
        renderProducts(); // Tenê UI nûve bike, daneyan ji nû ve neyne
    }

    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
    // Hûn dikarin li vir nûvekirinên din ên UI yên girêdayî ziman lê zêde bikin
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
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // VAPID key wek xwe bimîne
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
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
        // Dokumanek bi ID ya tokenê çêbike da ku pêşî li dubarebûnê bigire
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now() // Timestamp ji bo zanîna dema dawî ya dîtinê
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
    if(event) event.stopPropagation(); // Pêşî li bûyera clickê ya kartê bigire

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        // Rakirin ji favorîtan
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error'); // Peyama rakirinê
    } else {
        // Zêdekirin bo favorîtan
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success'); // Peyama zêdekirinê
    }
    saveFavorites(); // Guhertinan tomar bike

    // UI nûve bike ji bo hemû kartên bi heman IDyê
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Îkona dil bibîne
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite; // Rewşa nû
            favButton.classList.toggle('favorited', isNowFavorite); // Classê lê zêde bike/rake
            // Classên îkonê biguherîne ji bo tijî/vala
            heartIcon.classList.toggle('fas', isNowFavorite); // fas = tijî
            heartIcon.classList.toggle('far', !isNowFavorite); // far = vala
        }
    });

    // Heger rûpela favorîtan vekirî be, wê nûve bike
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

async function renderFavoritesPage() {
    favoritesContainer.innerHTML = ''; // Paqij bike berî renderkirinê

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block'; // Peyama vala nîşan bide
        favoritesContainer.style.display = 'none'; // Konteynirê veşêre
        return;
    }

    emptyFavoritesMessage.style.display = 'none'; // Peyama vala veşêre
    favoritesContainer.style.display = 'grid'; // Grid display bikar bîne

    renderSkeletonLoader(favoritesContainer, 4); // Skeleton loader nîşan bide

    try {
        // Hemû daxwazên anîna berheman bi hev re bişîne
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Skeleton loaderê rake

        // Tenê berhemên ku hene û nehatine jêbirin, filter bike
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // Heger hemû favorît hatibin jêbirin
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
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`; // Peyama xeletiyê
    }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount(); // Jimara ser selikê nûve bike
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Hemû hêmanên ku jimara selikê nîşan didin nûve bike
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`; // Classê li gorî cureyê (success/error)
    notification.textContent = message;
    document.body.appendChild(notification);
    // Derengiyek biçûk bide berî nîşandana bi animasyonê
    setTimeout(() => notification.classList.add('show'), 10);
    // Piştî 3 çirkeyan, animasyona veşartinê dest pê bike
    setTimeout(() => {
        notification.classList.remove('show');
        // Piştî ku animasyona veşartinê qediya, hêmanê rake
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all'); // 'Hemû' derxe
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Navê li gorî zimanê heyî yan fallback bo soranî nîşan bide
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = ''; // Paqij bike berî renderkirinê
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id; // ID ya kategoriyê tomar bike
        if (state.currentCategory === cat.id) { btn.classList.add('active'); } // Bişkoka çalak highlight bike

        // Navê kategoriyê li gorî zimanê heyî yan fallback
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Wergera 'Hemû'
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`; // Îkon û nav

        // Event listener ji bo klikkirinê
        btn.onclick = async () => {
            // Filter bike li gorî kategoriya hilbijartî
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Jêr-kategorî û jêr-jêr-kategorî reset bike
                subSubcategory: 'all',
                search: '' // Lêgerînê vala bike
            });
            closeCurrentPopup(); // Sheetê bigire
            showPage('mainPage'); // Vegere rûpela serekiyê
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

// *** GUHERTIN: Fonksiyon êdî ne hewce ye li rûpela serekiyê ***
async function renderSubSubcategories(mainCatId, subCatId) {
     // Ev fonksiyon êdî li rûpela serekiyê nayê bikaranîn ji ber ku jêr-jêr-kategorî tenê li rûpela detail têne nîşandan
     subSubcategoriesContainer.innerHTML = ''; // Tenê vala bike heger were bangkirin
     subSubcategoriesContainer.style.display = 'none'; // Veşêre
}
// *** DAWÎYA GUHERTINÊ ***

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

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';

    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Destpêkê hemû berhemên vê jêr-kategoriyê nîşan bide

    loader.style.display = 'none';
}

async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = ''; // Paqij bike

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc")); // Li gorî rêzê rêz bike
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Heger tune bin, veşêre
            return;
        }

        container.style.display = 'flex'; // Nîşan bide heger hebin

        // Bişkoka "Hemû" lê zêde bike
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Destpêkê çalak be
        // Îkona SVG ji bo "Hemû"
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Ji bo nasîna bişkojê
        allBtn.onclick = () => {
            // Hemû bişkokan neçalak bike û vê çalak bike
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            // Berhemên hemû jêr-jêr-kategoriyan nîşan bide
            renderProductsOnDetailPage(subCatId, 'all', currentSearch);
        };
        container.appendChild(allBtn);

        // Bişkokên ji bo her jêr-jêr-kategoriyekê çêbike
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Ji bo nasîna bişkojê
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Wêneya vala
            const imageUrl = subSubcat.imageUrl || placeholderImg; // Wêne yan placeholder
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                 // Hemû bişkokan neçalak bike û vê çalak bike
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                // Tenê berhemên vê jêr-jêr-kategoriyê nîşan bide
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch);
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Di rewşa xeletiyê de veşêre
    }
}

async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block'; // Loaderê nîşan bide
    productsContainer.innerHTML = ''; // Konteynirê paqij bike

    try {
        let productsQuery;
        // Query ava bike li gorî ka "Hemû" hatiye hilbijartin an jêr-jêr-kategoriyek taybet
        if (subSubCatId === 'all') {
            // Hemû berhemên di bin vê jêr-kategoriyê de (categoryId ne pêwîst e ji ber ku subcategoryId têra xwe taybet e)
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            // Tenê berhemên vê jêr-jêr-kategoriyê
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Lêgerînê lê zêde bike heger hebe
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff') // Ji bo lêgerîna pêşgir
            );
            // Heger lêgerîn hebe, divê orderBy ya yekem li gorî searchableName be
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Heger lêgerîn tune be, tenê li gorî dema çêkirinê rêz bike
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // Karta berhemê çêbike
                productsContainer.appendChild(card);
            });
        }
    } catch (error) {
        // Logkirina xeletiyek berfirehtir
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loader.style.display = 'none'; // Loaderê veşêre
    }
}

async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Paqij bike

    // Heger kategoriya serekiyê "Hemû" be, jêr-kategoriyan nîşan nede
    if (categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Veşêre
        return;
    }
    subcategoriesContainer.style.display = 'flex'; // Nîşan bide

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc")); // Li gorî rêzê rêz bike
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Heger jêr-kategorî tune bin, barê nîşan nede (yan jî dibe ku bişkoka "Hemû" tenê bimîne)
        // if (state.subcategories.length === 0) {
        //     subcategoriesContainer.style.display = 'none';
        //     return;
        // }

        // Bişkoka "Hemû" ya jêr-kategoriyan (ji bo vegerînê)
        const allBtn = document.createElement('button');
        // Eger jêr-kategoriya heyî 'all' be, vê çalak bike
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
             // Tenê jêr-kategorî û jêr-jêr-kategorî reset bike, kategoriya serekiyê bihêle
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
                // categoryId wek xwe dimîne
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Bişkokên ji bo her jêr-kategoriyekê
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            // Eger jêr-kategoriya heyî ev be, çalak bike
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            // Dema klik tê kirin, here rûpela detail ya vê jêr-kategoriyê
            subcatBtn.onclick = () => {
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Di rewşa xeletiyê de veşêre
    }
}

function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Paqij bike

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id; // ID tomar bike

        // Heger kategoriya heyî ev be, çalak bike
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // Navê li gorî zimanê heyî yan fallback
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`; // Îkon û nav

        // Dema klik tê kirin, filter bike
        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset bike
                subSubcategory: 'all', // Reset bike
                search: '' // Reset bike
            });
        };

        container.appendChild(btn);
    });
}

function showProductDetails(productId) {
    // Hewl bide berhemê ji lîsteya barkirî bibîne
    const product = state.products.find(p => p.id === productId);

    if (!product) {
        // Heger nehat dîtin, ji Firestore bîne
        console.log("Product not found in current list for details view. Fetching from Firestore...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct); // Bi daneyên anî nîşan bide
            } else {
                showNotification(t('product_not_found_error'), 'error'); // Heger li Firestore jî tune be
            }
        }).catch(error => {
            console.error("Error fetching product details:", error);
            showNotification(t('error_generic'), 'error');
        });
        return;
    }
    // Heger di lîsteyê de hat dîtin, rasterast nîşan bide
    showProductDetailsWithData(product);
}

// ... (renderRelatedProducts, showProductDetailsWithData, createPromoCardElement, createProductCardElement, setupScrollAnimations, renderSkeletonLoader, renderProducts, renderSingleShortcutRow, renderSingleCategoryRow, renderBrandsSection, renderNewestProductsSection, renderAllProductsSection, renderHomePageContent, renderPromoCardsSectionForHome wek guhertoya berê dimînin) ...
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
            where('__name__', '!=', currentProduct.id), // Berhema heyî derxe
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else { // Fallback bo kategoriya serekiyê heger yên din tune bin
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

        section.style.display = 'block'; // Beşê nîşan bide

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}

function showProductDetailsWithData(product) {
    // Skrolkirina sheetê bo jorê
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    // Nav û wesfê li gorî zimanê heyî bistîne
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    // Lîsteya URLên wêneyan bistîne (fallback bo image heger imageUrls tune be)
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // Konteynirên wêneyan û thumbnailan vala bike
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    // Wêneyan û thumbnailan lê zêde bike heger hebin
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Wêneya mezin
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active'); // Wêneya yekem çalak be
            imageContainer.appendChild(img);

            // Thumbnail
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); // Thumbnaileya yekem çalak be
            thumb.dataset.index = index; // Index tomar bike ji bo klikkirinê
            thumbnailContainer.appendChild(thumb);
        });
    }

    // Mentiqê sliderê
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return; // Piştrast be index derbasdar e
        // Hemûyan neçalak bike
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        // Ya hilbijartî çalak bike
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index; // Indexa heyî nûve bike
    }

    // Bişkokên next/prev nîşan bide/veşêre li gorî hejmara wêneyan
    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }

    // Event listener ji bo bişkokan û thumbnailan
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length); // Loop bike
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length); // Loop bike
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    // Nav, wesf û bihayan nûve bike
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // HTML format bike

    const priceContainer = document.getElementById('sheetProductPrice');
    // Bihayê bi daşikandinê yan bê daşikandin nîşan bide
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Bişkoka "Zêdekirin bo Selikê" saz bike
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Sheetê bigire piştî zêdekirinê
    };

    // Beşa berhemên pêwendîdar render bike
    renderRelatedProducts(product);

    // Sheetê veke
    openPopup('productDetailSheet');
}

// Function to create promo card element (now takes sliderState)
function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';
    const currentCard = cardData.cards[sliderState.currentIndex];
    // URLê wêneyê li gorî zimanê heyî bistîne
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

    // Event listener ji bo klikkirina li ser kartê (ne bişkokan)
    cardElement.addEventListener('click', async (e) => {
        // Heger klik ne li ser bişkokekê be
        if (!e.target.closest('button')) {
            const targetCategoryId = currentCard.categoryId; // ID ya kategoriya armanc
            // Piştrast be ku kategorî heye
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                // Filter bike li gorî kategoriya armanc
                await navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                // Skrol bike bo beşa kategoriyên serekiyê
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    // Heger zêdetirî kartekê hebe, event listeneran ji bo bişkokên sliderê lê zêde bike
    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation(); // Pêşî li klikkirina kartê bigire
            // Here wêneya berê (loop bike)
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            // URLê wêneyê nû bistîne
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl; // Çavkaniya wêneyê nûve bike
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation(); // Pêşî li klikkirina kartê bigire
            // Here wêneya paşê (loop bike)
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            // URLê wêneyê nû bistîne
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl; // Çavkaniya wêneyê nûve bike
        });
    }

    return cardElement;
}

function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // ID tomar bike
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Rewşa admin kontrol bike

    // Navê li gorî zimanê heyî yan fallback
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    // Wêneya serekiyê bistîne (fallback bo image heger imageUrls tune be, yan placeholder)
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // HTML ji bo bihayê amade bike
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = ''; // Destpêkê badge vala be
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    // Heger daşikandin hebe, bihayê kevin û badge lê zêde bike
    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // HTML ji bo agahiyên zêde (mînak, shipping)
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

    // Rewşa favorît kontrol bike û classên îkonê û bişkokê diyar bike
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // fas=tijî, far=vala
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // Struktura HTML ya kartê ava bike
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

    // Event listener ji bo bişkoka parvekirinê
    productCard.querySelector('.share-btn-card').addEventListener('click', async (event) => {
        event.stopPropagation(); // Pêşî li klikkirina kartê bigire
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`; // URLê berhemê
        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`, // Peyama parvekirinê
            url: productUrl,
        };
        try {
            if (navigator.share) { // Heger APIya Share piştgirîkirî be
                await navigator.share(shareData);
            } else {
                // Fallback: URLê kopî bike bo clipboard
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
            // Xeletiyê nîşan nede heger bikarhêner parvekirin betal bike
             if (err.name !== 'AbortError') {
                 showNotification(t('share_error'), 'error');
             }
        }
    });

    // Event listener ji bo klikkirina li ser kartê bi giştî
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Rewşa admin ji nû ve kontrol bike

        if (addToCartButton) { // Heger li bişkoka selikê hatibe klikkirin
            addToCart(product.id);
            // Anîmasyona bişkokê
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
        } else if (isAdminNow && target.closest('.edit-btn')) { // Heger admin be û li bişkoka edit klik bike
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) { // Heger admin be û li bişkoka delete klik bike
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) { // Heger li bişkoka favorît klik bike
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
            // Jixwe event listenerê wê heye
        } else if (!target.closest('a')) { // Heger li deverek din a kartê (ne lînkek di wesfê de) klik bike
            showProductDetailsWithData(product); // Hûrguliyan nîşan bide
        }
    });
    return productCard;
}

function setupScrollAnimations() {
    // Observer ji bo animasyona fade-in dema kart xuya dibin
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible'); // Classê lê zêde bike
                observer.unobserve(entry.target); // Êdî temaşe neke
            }
        });
    }, {
        threshold: 0.1 // Dema %10 xuya bû
    });

    // Li hemû kartên bi classê 'product-card-reveal' temaşe bike
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = ''; // Paqij bike
    // Hejmarek skeleton card çêbike
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
    container.style.display = 'grid'; // Grid display
    // Heger konteynira serekî ya skeleton be, konteynira rastî veşêre
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none';
    }
}

function renderProducts() {
    // Heger state.products vala be, konteynirê paqij bike
    if (!state.products || state.products.length === 0) {
        productsContainer.innerHTML = '';
        return;
    }

    // Tenê berhemên ku hîn nehatine renderkirin lê zêde bike
    const existingProductIds = new Set(Array.from(productsContainer.children).map(card => card.dataset.productId));
    const productsToRender = state.products.filter(item => !existingProductIds.has(item.id));

    productsToRender.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Classê animasyonê lê zêde bike
        productsContainer.appendChild(element);
    });

    // Animasyonê ji bo kartên nû saz bike
    setupScrollAnimations();
}

async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null; // Heger rêz tune be, tiştek render neke

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Sernavê rêzê bistîne li gorî zimanê heyî yan fallback
        const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        // Hêmana sernavê çêbike
        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        // Konteynira kartan çêbike
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        // Kartên vê rêzê ji Firestore bîne
        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        // Heger kart tune bin, beşê render neke
        if (cardsSnapshot.empty) {
            return null;
        }

        // Ji bo her kartê, hêmanek çêbike
        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            // Navê kartê li gorî zimanê heyî yan fallback
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            // Dema klik li kartê tê kirin, filter bike li gorî kategoriya girêdayî
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

        return sectionContainer; // Hêmana beşê vegerîne
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null; // Di rewşa xeletiyê de tiştek venegerîne
    }
}

async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani; // Sernavê destpêkê
    let targetDocRef; // Referansa ji bo anîna navê rastîn ê kategoriyê

    // Diyarkirina query û referansê li gorî ID ya herî taybet
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
        return null; // Heger kategorî neyê diyarkirin
    }

    try {
        // Navê rastîn ê kategorî/jêr-kategoriyê ji Firestore bîne
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             // Sernavê nûve bike heger navê rastîn hat dîtin
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        // Hêmanên HTML çêbike
        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title; // Sernavê nûvekirî bikar bîne
        header.appendChild(titleEl);

        // Bişkoka "Binêre Hemû"
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Li gorî ID ya herî taybet navîgasyon bike
            if(subcategoryId) { // Heger jêr-kategorî yan jêr-jêr-kategorî be
                showSubcategoryDetailPage(categoryId, subcategoryId); // Here rûpela detail
            } else { // Heger tenê kategoriya serekiyê be
                 // Filter bike li rûpela serekiyê
                 await navigateToFilter({
                     category: categoryId,
                     subcategory: 'all',
                     subSubcategory: 'all',
                     search: ''
                 });
            }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        // Konteynira ji bo skrolkirina horizontal a berheman
        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Berhemên pêwendîdar bîne (max 10)
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Filter li gorî ID ya diyarkirî
            orderBy('createdAt', 'desc'), // Li gorî dema dawî rêz bike
            limit(10) // Tenê 10 berheman bîne
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Heger berhem tune bin, beşê render neke

        // Kartên berheman çêbike û lê zêde bike
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container; // Hêmana beşê vegerîne

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null; // Di rewşa xeletiyê de tiştek venegerîne
    }
}

async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // IDyek bêhempa
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        // Branda ji koma diyarkirî bîne (max 30)
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Heger brand tune bin, render neke

        // Ji bo her brandê, hêmanek çêbike
        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            // Navê li gorî zimanê heyî yan fallback
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;

            // Dema klik tê kirin, here kategoriya girêdayî (eger hebe)
            item.onclick = async () => {
                if (brand.subcategoryId && brand.categoryId) {
                    // Here rûpela detail ya jêr-kategoriyê
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if(brand.categoryId) {
                     // Filter bike li gorî kategoriya serekiyê
                    await navigateToFilter({
                        category: brand.categoryId,
                        subcategory: 'all',
                        subSubcategory: 'all',
                        search: ''
                    });
                }
                // Heger ti kategorî ne girêdayî be, tiştek nake
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer; // Hêmana beşê vegerîne
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null; // Di rewşa xeletiyê de tiştek venegerîne
    }
}

async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    // Sernavê beşê çêbike
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products'); // Wergera "Nûtirîn Berhem"
    header.appendChild(title);
    container.appendChild(header);

    try {
        // Berhemên ku di 15 rojên dawî de hatine zêdekirin bîne (max 10)
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo), // Tenê yên nû
            orderBy('createdAt', 'desc'), // Yên herî nû pêşî
            limit(10) // Max 10
        );
        const snapshot = await getDocs(q);

        // Konteynira ji bo skrolkirina horizontal
        const productsScroller = document.createElement('div');
        if (snapshot.empty) {
            return null; // Heger berhemên nû tune bin, render neke
        } else {
            productsScroller.className = 'horizontal-products-container';
            // Kartên berheman çêbike û lê zêde bike
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsScroller.appendChild(card);
            });
        }
        container.appendChild(productsScroller);
        return container; // Hêmana beşê vegerîne

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null; // Di rewşa xeletiyê de tiştek venegerîne
    }
}

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Hinek valahî berî beşê

    // Sernavê beşê çêbike
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title'); // Wergera "Hemû Berhem"
    header.appendChild(title);
    container.appendChild(header);

    // Konteynira grid ji bo berheman
    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container'; // Heman style wek lîsteya serekiyê
    container.appendChild(productsGrid);

    try {
        // Tenê çend berhemên destpêkê bîne ji bo nîşandanê li rûpela serekiyê
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Heger ti berhem tune bin, render neke
        }

        // Kartan çêbike û lê zêde bike
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container; // Hêmana beşê vegerîne
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null; // Di rewşa xeletiyê de tiştek venegerîne
    }
}

async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Heger jixwe render dibe, raweste
    state.isRenderingHomePage = true; // Ala danîne

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Skeleton loader nîşan bide
        homeSectionsContainer.innerHTML = ''; // Naveroka kevin paqij bike

        // Hemû intervalên sliderên kevin rawestîne berî renderkirina nû
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Objeya intervalan vala bike

        // Rêzeya beşên rûpela serekiyê ji Firestore bîne
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            // Dibe ku li vir peyamek bê nîşandan
        } else {
            // Ji bo her beşê di rêzê de, hêmana wê render bike
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                // Li gorî cureyê beşê, fonksiyona renderkirinê ya guncaw bang bike
                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                             // ID ya dokumanê (layoutId) bişîne ji bo birêvebirina intervalê
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
                            // Navê beşê jî bişîne ji bo sernavê
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

                // Heger hêman hatibe çêkirin, lê zêde bike li konteynirê
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        // Ala renderkirinê rake
        state.isRenderingHomePage = false;
    }
}

async function renderPromoCardsSectionForHome(groupId, layoutId) { // layoutId ji bo birêvebirina intervalê
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Heman style wek gridê berheman
    promoGrid.style.marginBottom = '24px'; // Valahî li jêr
    promoGrid.id = `promoSliderLayout_${layoutId}`; // IDyek bêhempa ji bo vê beşê

    try {
        // Kartên girêdayî vê komê bîne
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) { // Tenê heger kart hebin
            const sliderState = { currentIndex: 0, intervalId: null }; // State herêmî ji bo indexê
            const cardData = { cards }; // Daneyên kartê

            // Hêmana kartê/sliderê çêbike
            const promoCardElement = createPromoCardElement(cardData, sliderState);
            promoGrid.appendChild(promoCardElement);

            // Heger zêdetirî kartekê hebe, intervalê ji bo zivirandinê saz bike
            if (cards.length > 1) {
                const rotate = () => {
                    // Berî zivirandinê, kontrol bike ka hêman hîn heye û interval nehatiye rawestandin
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        // Heger hêman hatibe rakirin an interval hatibe paqijkirin, intervalê rawestîne
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            // Ji state giştî jî rake heger hîn tê de be
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Raweste
                    }
                    // Here indexa paşê (loop bike)
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    // URLê wêneyê nû bistîne
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl; // Wêneyê nûve bike
                };

                // Intervala kevin a ji bo vê layoutId (heger hebe) rawestîne
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Intervala nû saz bike û ID ya wê tomar bike
                sliderState.intervalId = setInterval(rotate, 5000); // Her 5 çirkeyan
                // ID ya intervalê di state giştî de tomar bike bi bikaranîna layoutId wek key
                if (!state.sliderIntervals) state.sliderIntervals = {}; // Piştrast be objeya state heye
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }

            return promoGrid; // Hêmana beşê vegerîne
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Di rewşa xeletiyê de yan nebûna kartan de tiştek venegerîne
}

// *** GUHERTINA Sereke 2: searchProductsInFirestore ***
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false, fromPopState = false) {
    // *** Parametera scrollYToRestore hat rakirin, em ê ji history.state bixwînin ***
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    // 1. Birêvebirina dîtina rûpela serekiyê yan lîsteya berheman
    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Render bike tenê heger vala be yan jî ne ji popstate be (ji bo nûvekirinê)
        if (homeSectionsContainer.innerHTML.trim() === '' || !fromPopState) {
             await renderHomePageContent();
        }
        // Pozîsyona skrolê venegerîne ji ber ku beşên rûpela serekiyê dibe ku cuda bin
        return; // Ji fonksyonê derkeve
     } else {
        // Heger ne rûpela serekiyê be, beşên wê veşêre û slideran rawestîne
        homeSectionsContainer.style.display = 'none';
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};
     }

    // 2. Kontrolkirina Cache (bê guhertin)
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.innerHTML = ''; // Paqij bike berî renderkirina ji cache
        productsContainer.style.display = 'grid';
        renderProducts();
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';

        // Vegerandina skrolê ji bo cache jî pêwîst e
        // *** Êdî scrollYToRestore bikar nayne ***
        const scrollYToRestoreFromState = history.state?.scroll;
        if (fromPopState && typeof scrollYToRestoreFromState === 'number') {
            setTimeout(() => window.scrollTo(0, scrollYToRestoreFromState), 150); // Derengî
        } else if (!fromPopState) {
             // Ji bo lêgerîn/filterên nû, here jor
             window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
    }

    // 3. Mentiqê barkirinê (bê guhertin)
    if (state.isLoadingMoreProducts) return;
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        productsContainer.innerHTML = ''; // Paqij bike berî skeleton
        renderSkeletonLoader();
    }
    if (state.allProductsLoaded && !isNewSearch) return;
    state.isLoadingMoreProducts = true;
    loader.style.display = 'block';

    // 4. Anîna daneyan ji Firestore
    try {
        // ... (Koda avakirina query wek xwe dimîne) ...
        let productsQuery = collection(db, "products");
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));
        // ... (Dawîya koda query) ...

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Nûvekirina state.products (bê guhertin)
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            const existingIds = new Set(state.products.map(p => p.id));
            const uniqueNewProducts = newProducts.filter(p => !existingIds.has(p.id));
            state.products = [...state.products, ...uniqueNewProducts];
        }

        // Nûvekirina allProductsLoaded û lastVisibleProductDoc (bê guhertin)
        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Nûvekirina Cache (bê guhertin)
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // 5. Renderkirina Berheman
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
        if (isNewSearch) {
             productsContainer.innerHTML = ''; // Piştrast be konteynir vala ye berî renderkirina encamên nû
        }
        renderProducts(); // Renderkirina berheman (yan yên nû yan yên lêzêdekirî)

        // Peyama "Berhem tune" (bê guhertin)
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

        // *** Vegerandina Skrolê êdî ne li vir e ***

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none';
        // Piştrast be ku skeleton loader veşartî ye
        skeletonLoader.style.display = 'none';
        // Piştrast be ku konteynira berheman xuya ye (eger ne vala be)
        if (state.products.length > 0 || !isNewSearch) {
            productsContainer.style.display = 'grid';
        }
    }
}


// ... (Fonksiyonên mayî yên addToCart, renderCart, hwd. wek xwe dimînin) ...
function addToCart(productId) {
    // Hewl bide berhemê ji lîsteya barkirî ya heyî bibîne
    let product = state.products.find(p => p.id === productId);

    // Heger di lîsteya heyî de nehat dîtin (mînak, ji rûpela favorîtan an detail hatibe)
    if (!product) {
        console.warn("Product not found in local 'products' array. Fetching details to add to cart.");
        // Ji Firestore bîne da ku nav, biha, û wêneyê bistîne
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                // Wêneya serekiyê bistîne
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                // Kontrol bike ka berhem jixwe di selikê de ye
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) {
                    existingItem.quantity++; // Jimarê zêde bike
                } else {
                    // Wekî din, wekî hêmanek nû lê zêde bike
                    state.cart.push({
                        id: fetchedProduct.id,
                        name: fetchedProduct.name, // Objeya navê tomar bike
                        price: fetchedProduct.price,
                        image: mainImage,
                        quantity: 1
                    });
                }
                saveCart(); // Selikê tomar bike
                showNotification(t('product_added_to_cart')); // Agahdarî nîşan bide
            } else {
                 showNotification(t('product_not_found_error'), 'error'); // Heger berhem li Firestore jî tune be
            }
        }).catch(error => {
            console.error("Error fetching product details for cart:", error);
             showNotification(t('error_generic'), 'error');
        });
        return; // Raweste heta ku dane tên anîn (an jî xeletî çêdibe)
    }

    // Heger berhem di lîsteya heyî de hat dîtin
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++; // Jimarê zêde bike
    } else {
        // Wekî hêmanek nû lê zêde bike
        state.cart.push({
            id: product.id,
            name: product.name, // Objeya navê tomar bike
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }
    saveCart(); // Selikê tomar bike
    // showNotification(t('product_added_to_cart')); // Dibe ku anîmasyona bişkokê têra xwe bike
}

function renderCart() {
    cartItemsContainer.innerHTML = ''; // Paqij bike
    if (state.cart.length === 0) { // Heger selik vala be
        emptyCartMessage.style.display = 'block'; // Peyama vala nîşan bide
        cartTotal.style.display = 'none'; // Bihayê giştî veşêre
        cartActions.style.display = 'none'; // Bişkokên çalakiyê veşêre
        return;
    }
    // Heger selik ne vala be
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Bişkokên wek Whatsapp, Viber, hwd. render bike

    let total = 0; // Bihayê giştî sifir bike
    // Ji bo her hêmanekê di selikê de
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity; // Bihayê vê hêmanê hesab bike
        total += itemTotal; // Lê zêde bike li ser bihayê giştî
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Navê hêmanê li gorî zimanê heyî bistîne
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        // Struktura HTML ya hêmanê selikê
        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'">
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
    // Bihayê giştî yê dawî nîşan bide
    totalAmount.textContent = total.toLocaleString();

    // Event listeneran ji bo bişkokên +/-/rakirinê saz bike
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change; // Jimarê biguherîne
        if (cartItem.quantity <= 0) { // Heger jimar bibe sifir yan kêmtir
            removeFromCart(productId); // Ji selikê rake
        } else {
            saveCart(); // Guhertinan tomar bike
            renderCart(); // UI ya selikê nûve bike
        }
    }
}

function removeFromCart(productId) {
    // Hêmana bi ID ya diyarkirî ji selikê derxe
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart(); // Guhertinan tomar bike
    renderCart(); // UI ya selikê nûve bike
}

function generateOrderMessage() {
    if (state.cart.length === 0) return ""; // Heger selik vala be, tiştek venegerîne
    // Destpêka peyamê
    let message = t('order_greeting') + "\n\n";
    // Ji bo her hêmanekê, hûrguliyan lê zêde bike
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    // Bihayê giştî lê zêde bike
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

    // Agahiyên bikarhêner lê zêde bike heger hebin
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        // Heger agahî tune bin, daxwaz bike
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message; // Peyama dawî vegerîne
}

async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Paqij bike

    try {
        // Rêbazên têkiliyê ji Firestore bîne
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Li gorî dema çêkirinê rêz bike

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        // Ji bo her rêbazekê, bişkokek çêbike
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // Dibe ku pêwîst be class cuda bê danîn
            btn.style.backgroundColor = method.color; // Rengê bişkokê

            // Navê bişkokê li gorî zimanê heyî
            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`; // Îkon û nav

            // Dema klik li bişkokê tê kirin
            btn.onclick = () => {
                const message = generateOrderMessage(); // Peyama fermanê çêbike
                if (!message) return; // Heger peyam vala be, raweste

                let link = '';
                const encodedMessage = encodeURIComponent(message); // Peyamê encode bike ji bo URL
                const value = method.value; // Nirxa rêbazê (hejmar, username, yan URL)

                // Lînkê çêbike li gorî cureyê rêbazê
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Lînkên Viber dibe ku tevlihev bin û pêwîstî bi testkirinê hebe
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Ji bo banga telefonê
                        break;
                    case 'url': // Ji bo URLên taybet
                        link = value; // Bihesibîne nirx URLek temam e
                        break;
                }

                // Heger lînk hatibe çêkirin, wê veke di tabek nû de
                if (link) {
                    window.open(link, '_blank');
                }
            };

            container.appendChild(btn); // Bişkokê lê zêde bike li konteynirê
        });
    } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Peyama barkirinê
    try {
        const docRef = doc(db, "settings", "policies"); // Referansa dokumanê
        const docSnap = await getDoc(docRef);

        // Heger dokuman hebe û naverok tê de be
        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Naverokê li gorî zimanê heyî yan fallback bistîne
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Newline biguherîne bo <br> û nîşan bide
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            // Heger naverok tune be
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Peyama xeletiyê
    }
}

function checkNewAnnouncements() {
    // Li guhertinên dawî yên agahdariyan temaşe bike (tenê ya herî dawî)
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Timestampa agahdariya herî dawî ya dîtî ji localStorage bistîne
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // Heger agahdariya nû ji ya dîtî nûtir be
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block'; // Badge nîşan bide
            } else {
                notificationBadge.style.display = 'none'; // Badge veşêre
            }
        }
    });
}

async function renderUserNotifications() {
    // Hemû agahdariyan bîne, yên herî nû pêşî
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = ''; // Paqij bike
    if (snapshot.empty) { // Heger agahdarî tune bin
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0; // Ji bo tomarkirina timestampa ya herî nû
    // Ji bo her agahdariyekê, hêmanek çêbike
    snapshot.forEach(doc => {
        const announcement = doc.data();
        // Timestampa herî nû nûve bike
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt;
        }

        // Dîrokê format bike
        const date = new Date(announcement.createdAt);
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

        // Sernav û naverokê li gorî zimanê heyî bistîne
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

    // Timestampa herî nû tomar bike wekî ya dawî ya dîtî
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none'; // Badge veşêre piştî vekirina sheetê
}

function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    // Li guhertinên lînkên sosyal medya temaşe bike
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Paqij bike

        if (snapshot.empty) { // Heger lînk tune bin
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        // Ji bo her lînkekê, hêmanek <a> çêbike
        snapshot.forEach(doc => {
            const link = doc.data();
            // Navê li gorî zimanê heyî
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url; // URLê lînkê
            linkElement.target = '_blank'; // Di tabek nû de veke
            linkElement.className = 'settings-item'; // Heman style wek hêmanên din ên settings

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i> <!-- Îkona lînkê derve -->
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    });
}

function showWelcomeMessage() {
    // Tenê carekê peyama bi xêrhatinê nîşan bide
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal'); // Modalê veke
        localStorage.setItem('hasVisited', 'true'); // Ala tomar bike
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    if (!getLocationBtn) return; // Heger bişkok tune be, raweste

    getLocationBtn.addEventListener('click', () => {
        // Piştrast be ku geolocation piştgirîkirî ye
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        // Rewşa barkirinê nîşan bide
        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        // Daxwaza pozîsyona heyî bike
        navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
             enableHighAccuracy: true, // Hewl bide pozîsyonek rasttir bistîne
             timeout: 10000, // Max 10 çirke çaverê be
             maximumAge: 0 // Pozîsyona kevin bikar neyne
        });
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            // APIya Nominatim bikar bîne ji bo reverse geocoding
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            const data = await response.json();

            // Heger nav û nîşan hat dîtin, inputê dagire
            if (data && data.display_name) {
                profileAddressInput.value = data.display_name;
                showNotification('ناونیشان وەرگیرا', 'success');
            } else {
                showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
                // Alternatîf: Koordînatên têxe inputê heger nav nehat dîtin
                // profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            // Rewşa bişkokê vegerîne wekî berê
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        // Peyamek guncaw li gorî koda xeletiyê nîşan bide
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'شوێنەکەت نەدۆزرایەوە';
                break;
            case error.TIMEOUT:
                message = 'کاتی داواکارییەکە تەواو بوو';
                break;
            default:
                message = 'هەڵەیەکی نادیار ڕوویدا';
                break;
        }
        showNotification(message, 'error');
        // Rewşa bişkokê vegerîne wekî berê
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}


function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return; // Heger trigger tune be

    // IntersectionObserver ji bo detektkirina dema trigger xuya dibe
    const observer = new IntersectionObserver((entries) => {
        // Heger trigger xuya bû
        if (entries[0].isIntersecting) {
            // Tenê berhemên zêdetir bar bike heger barkirin ne çalak be û hemû nehatibin barkirin
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 // console.log("Scroll trigger intersected, loading more products...");
                 searchProductsInFirestore(state.currentSearch, false); // Rûpela paşê bîne
            }
        }
    }, {
        root: null, // Li gorî viewport
        threshold: 0.1 // Dema %10 xuya bû
    });

    // Dest bi temaşekirina trigger bike
    observer.observe(trigger);
}

function updateCategoryDependentUI() {
    // Piştrast be ku kategorî hatine barkirin
    if (state.categories.length === 0) return;
    // Dropdowna kategoriyan di forma berhemê de dagire
    populateCategoryDropdown();
    // Barê kategoriyên serekiyê li rûpela serekiyê render bike
    renderMainCategories();
    // Heger admin têketibe û mentiqê admin hatibe barkirin, dropdownên admin nûve bike
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Dropdownên ji bo kartên shortcut jî nûve bike
    }
}


function setupEventListeners() {
    // ... (Event listenersên din wek xwe dimînin) ...
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            // State nû biafirîne bêyî type ji bo rûpela serekiyê
            history.pushState({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        // Filteran reset bike
        await applyFilterState({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 }, false);
        // *** GUHERTIN: navigateToFilter bikar neyne ji ber ku ew ê dîsa push bike ***
        // await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Tenê vegere state berê
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
    // Modalê bigire heger li derveyî naverokê hat klikkirin
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Forma têketina admin
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Piştî têketina serkeftî, onAuthStateChanged dê mentiqê admin dest pê bike
            // Modal dê ji hêla onAuthStateChanged ve were girtin
        } catch (error) {
            showNotification(t('login_error'), 'error'); // Peyama xeletiyê
        }
    };

    // Fonksiyona debounce ji bo kêmkirina bangên lêgerînê
    const debouncedSearch = debounce((term) => {
        // navigateToFilter bikar bîne ji bo nûvekirina URL û state
        navigateToFilter({ search: term });
    }, 500); // Piştî 500ms bêdengî

    // Dema nivîs di inputa lêgerînê de tê nivîsandin
    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        // Bişkoka paqijkirinê nîşan bide/veşêre
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        // Fonksiyona debounce bang bike
        debouncedSearch(searchTerm);
    };

    // Dema li bişkoka paqijkirinê tê klikkirin
    clearSearchBtn.onclick = () => {
        searchInput.value = ''; // Inputê vala bike
        clearSearchBtn.style.display = 'none'; // Bişkokê veşêre
        // Filter bike bêyî terma lêgerînê
        navigateToFilter({ search: '' });
    };

    // Mentiqê lêgerînê ji bo rûpelên detail
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        // Piştrast be ku em li rûpela detail ya jêr-kategoriyê ne
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2]; // ID ya jêr-kategoriyê

            // ID ya jêr-jêr-kategoriya çalak bibîne
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';

            // Berheman li gorî terma lêgerînê û jêr-jêr-kategoriya çalak render bike
            await renderProductsOnDetailPage(subCatId, subSubCatId, term);
        }
    }, 500); // Piştî 500ms

    subpageSearchInput.oninput = () => {
        const searchTerm = subpageSearchInput.value;
        subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSubpageSearch(searchTerm);
    };

    subpageClearSearchBtn.onclick = () => {
        subpageSearchInput.value = '';
        subpageClearSearchBtn.style.display = 'none';
        debouncedSubpageSearch(''); // Bi terma vala lê bigere
    };


    // Vekirin/girtina beşa "Pêwendî" li settings
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open'); // Îkona chevron bizivirîne
    };


    // Tomarkirina profîla bikarhêner
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        // Agahiyan ji forman bistîne
        state.userProfile = {
            name: document.getElementById('profileName').value.trim(),
            address: document.getElementById('profileAddress').value.trim(),
            phone: document.getElementById('profilePhone').value.trim(),
        };
        // Di localStorage de tomar bike
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success'); // Agahdarî nîşan bide
        closeCurrentPopup(); // Sheetê bigire
    };

    // Guhertina zimanê
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang); // Zimanê hilbijartî saz bike
        };
    });

    // Bişkoka sazkirina PWA
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            // Heger prompta sazkirinê hatibe hilanîn
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Bişkokê veşêre
                state.deferredPrompt.prompt(); // Promptê nîşan bide
                // Li benda bersiva bikarhêner be
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Prompta hilanî paqij bike
            }
        });
    }

    // Bişkoka agahdariyan
    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet'); // Sheeta agahdariyan veke
    });

    // Bişkoka Merc & Rêsa
    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet'); // Sheeta mercan veke
        });
    }

    // Bişkoka çalakkirina agahdariyan
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }

    // Bişkoka force update
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    // Birêvebirina peyamên push dema ku app vekirî ye
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        // Agahdariyek hundirîn nîşan bide
        const title = payload.notification?.title || 'Agahdarî';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        // Badge nûve bike
        notificationBadge.style.display = 'block';
    });
}


onAuthStateChanged(auth, async (user) => {
    // UID ya adminê ya rastî ji projeya Firebase bistîne
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // *** UID ya xwe li vir binivîse ***
    const isAdmin = user && user.uid === adminUID; // Kontrol bike ka bikarhêner admin e

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Rewşa admin tomar bike
        // Heger mentiqê admin hebe û fonksiyonê initialize hebe
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Piştrast be ku rûpel bi tevahî barkiriye berî destpêkirinê
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                  window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
             console.warn("AdminLogic not found or initialize is not a function. Admin features might not work.");
        }
    } else {
        // Heger bikarhêner ne admin be yan têketî nebe
        sessionStorage.removeItem('isAdmin'); // Rewşa admin rake
        // Heger bikarhênerek ne-admin têketibe (ku divê nebe), derxe
        if (user) {
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        // Heger mentiqê admin hebe û fonksiyonê deinitialize hebe, bang bike
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Hêmanên UI yên admin paqij bike
        }
    }

    // Modalê têketinê bigire heger admin bi serkeftî têkeve
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


function init() {
    renderSkeletonLoader(); // Skeleton loaderê yekser nîşan bide

    // Hewl bide moda offline ya Firestore çalak bike
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
        })
        .catch((err) => {
            // Xeletiyên hevpar ji bo neçalakkirina persistence
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open?');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not fully supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
        })
        .finally(() => {
             // Her çi qewimî, mentiqê serekiyê appê dest pê bike
             initializeAppLogic();
        });
}

function initializeAppLogic() {
    // Piştrast be ku objeya ji bo intervalên sliderê heye
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Kategoriyan bîne û li guhertinên wan temaşe bike
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Kategorîya "Hemû" lê zêde bike
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani:'هەموو', name_ku_badini:'هەمی', name_ar:'الكل' }, ...fetchedCategories];
        updateCategoryDependentUI(); // UI yên girêdayî kategoriyan nûve bike

        // *** GUHERTIN: Barkirina rûpela destpêkê û bicîhanîna filteran li vir ***
        const initialState = history.state; // State ku ji hêla handleInitialPageLoad ve hat danîn bistîne
        if (initialState) {
            if (initialState.type === 'page') {
                // Heger rûpelek taybet be (settings yan detail)
                if (initialState.id === 'subcategoryDetailPage') {
                     let pageTitle = initialState.title;
                     if (!pageTitle && initialState.mainCatId && initialState.subCatId) {
                         try {
                             const subCatRef = doc(db, "categories", initialState.mainCatId, "subcategories", initialState.subCatId);
                             const subCatSnap = await getDoc(subCatRef);
                             if (subCatSnap.exists()) {
                                 const subCat = subCatSnap.data();
                                 pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                                 history.replaceState({ ...initialState, title: pageTitle }, ''); // Sernavê nûve bike
                             }
                         } catch(e) { console.error("Could not fetch title on init after categories loaded", e) }
                     }
                     showPage(initialState.id, pageTitle);
                } else if (initialState.id === 'settingsPage') {
                     showPage(initialState.id, initialState.title);
                }
            } else {
                 // Heger rûpela serekiyê be (bê type)
                 showPage('mainPage'); // Piştrast be rûpela serekiyê xuya ye
                 await applyFilterState(initialState, false); // Filterên destpêkê bicîh bîne
            }
        } else {
             // Wekî fallback, rûpela serekiyê bê filter nîşan bide
             console.warn("Initial history state not found, loading default main page.");
             showPage('mainPage');
             await applyFilterState({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 }, false);
        }

        // Zimanê bicîh bîne piştî ku kategorî û naveroka destpêkê hatine barkirin
        setLanguage(state.currentLanguage);
    }, error => {
         console.error("Error fetching categories:", error);
         // Dibe ku li vir pêwîst be peyamek xeletiyê ji bikarhêner re bê nîşandan
         document.getElementById('mainCategoriesContainer').innerHTML = '<p>Error loading categories.</p>';
         skeletonLoader.style.display = 'none'; // Skeleton loaderê veşêre
    });

    // Beşên din ên appê saz bike
    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    // setLanguage(state.currentLanguage); // Êdî ne li vir, piştî barkirina kategoriyan e
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
}

// Fonksiyon û guherbarên pêwîst ji bo admin.js derxe
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction, // Firestore û Auth
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore, // Fonksiyonên Utility
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Koleksiyon
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage, // Fonksiyonên Helper ji bo Admin
    clearProductCache // Fonksiyona paqijkirina cache
});

// Destpêkirina appê
document.addEventListener('DOMContentLoaded', init); // init dê initializeAppLogic bang bike piştî persistence

// ... (Koda PWA û Service Worker wek xwe dimîne) ...
// PWA install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
    console.log('`beforeinstallprompt` event was fired.');
});


// Service Worker update handling
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show');
                }
            });
        });

        updateNowBtn.addEventListener('click', () => {
            registration.waiting?.postMessage({ action: 'skipWaiting' });
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
        refreshing = true;
    });
}

