// app-logic.js (The New Controller)
// ئەم فایلە هەموو مۆدیولەکان کۆدەکاتەوە و وەک کۆنترۆڵکەری سەرەکی کاردەکات.

// --- 1. IMPORTKIRINA GŞTÎ Û XIZMETÊN FIREBASE ---
import {
    // Xizmetên Firebase
    app, db, auth, messaging,
    // Koleksiyonên Firestore
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    // State û Mîhengên Sereke
    state, translations, PRODUCTS_PER_PAGE,
    // Tuخمە سەرەکییەکانی DOM
    loginModal, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, loader, cartBtn, categoriesBtn,
    profileBtn, homeBtn, settingsBtn, mainPage, settingsPage,
    sheetOverlay, subpageSearchInput, subpageClearSearchBtn,
    contactToggle, settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn,
    notificationBtn, termsAndPoliciesBtn, profileForm,
    appContainer, scrollLoaderTrigger,
} from './app-setup.js';

import {
    // Fonksiyonên Firebase (pêwîst in ji bo logîk û admin bridge)
    enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot,
    query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction,
    signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- 2. IMPORTKIRINA MODULÊN NÛ ---
import { t, debounce } from './utils.js';
import {
    setLanguage, showPage, openPopup, closeCurrentPopup, closeAllPopupsUI,
    updateHeaderView, showNotification, updateActiveNav, navigateToFilter,
    applyFilterState, handleInitialPageLoad, setupGpsButton, forceUpdate,
    requestNotificationPermission
} from './ui.js';
import { addToCart, updateCartCount } from './cart.js';
import { toggleFavorite } in './favorites.js';
import {
    createProductCardElement, renderSkeletonLoader, showProductDetails,
    setupScrollAnimations
} from './product.js';
import {
    renderMainCategories, renderSubcategories, renderSubSubcategoriesOnDetailPage,
    renderProductsOnDetailPage
} from './category.js';
import { renderHomePageContent } from './home.js';


// --- 3. FONKSIYONÊN SEREKÎ YÊN LOGÎKÊ ---

/**
 * Kałakan li ser rûpelê (di productsContainer de) nîşan dide
 * Li gorî 'state.products' a niha
 */
function renderProducts() {
    productsContainer.innerHTML = ''; // Paqijkirina konteynerê
    if (!state.products || state.products.length === 0) {
        return; // Heke tiştek tune be, tiştek nîşan nede
    }

    // Çêkirina kart ji bo her kałayekê
    state.products.forEach(item => {
        let element = createProductCardElement(item);
        // 'product-card-reveal' jixwe di 'createProductCardElement' de tê zêdekirin
        productsContainer.appendChild(element);
    });

    // Destpêkirina animasyonên scroll
    setupScrollAnimations();
}

/**
 * Li kałayan digere (di Firestore de) li gorî rewşa (state) ya niha
 * Ev fonksiyona sereke ye ji bo birêvebirina nîşandana kałayan an rûpela sereke
 * @param {string} [searchTerm=''] - Peyva lêgerînê
 * @param {boolean} [isNewSearch=false] - Gelo ev lêgerînek nû ye (ji bo paqijkirina rûpelê)
 */
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    // 1. Biryar: Gelo Rûpela Sereke (Home) nîşan bidin an Lîsteya Kałayan?
    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollLoaderTrigger.style.display = 'none';
        homePageSectionsContainer.style.display = 'block';

        // Heke rûpela sereke vala be, wê çêbike
        if (homePageSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent();
        }
        return; // Karê me li vir bi dawî tê
    } else {
        // Heke em li rûpela sereke nînin, hemî intervalên slideran bisekinînin
        homePageSectionsContainer.style.display = 'none';
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Paqijkirina objecta intervalan
    }

    // 2. Birêvebirina Cache (ji bo lezbûnê)
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        // Heke encamên vê lêgerînê di cache de hebin, wan bikar bîne
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';

        renderProducts(); // Kałayên ji cache nîşan bide
        scrollLoaderTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    // 3. Destpêkirina Barkirinê (Loading)
    if (state.isLoadingMoreProducts) return; // Heke jixwe di barkirinê de be, bisekine

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(skeletonLoader); // Skeleton loader nîşan bide
    }

    if (state.allProductsLoaded && !isNewSearch) return; // Heke hemî kała hatibin û ne lêgerînek nû be

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Lodera piçûk a binî nîşan bide

    try {
        // 4. Avakirina Query ya Firestore
        let productsQuery = collection(db, "products");

        // Fîlterkirina li gorî kategoriyan
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Fîlterkirina li gorî lêgerînê
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Rêzkirin (Ordering)
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Birêvebirina Rûpelkirinê (Pagination)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // 5. Anîna Daneyan (Fetching Data)
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Nûvekirina rewşa rûpelkirinê
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollLoaderTrigger.style.display = 'none';
        } else {
            state.allProductsLoaded = false;
            scrollLoaderTrigger.style.display = 'block';
        }

        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // 6. Cache kirina encamên lêgerîna nû
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // 7. Nîşandana Kałayan
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
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}

/**
 * Karê parvekirina kałayekê birêve dibe
 * @param {string} productId - ID ya kałayê
 */
async function handleShare(productId) {
    if (!productId) return;
    
    // Pêşî, kałayê ji state an Firestore bibîne ji bo navê wê
    let product = state.products.find(p => p.id === productId);
    if (!product) {
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                showNotification(t('product_not_found_error'), 'error');
                return;
            }
        } catch (e) {
            showNotification(t('error_generic'), 'error');
            return;
        }
    }

    const name = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'Kałayek';
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${productId}`;
    const shareData = {
        title: name,
        text: `${t('share_text')}: ${name}`,
        url: productUrl,
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData); // Bikaranîna Web Share API
        } else {
            // Fallback ji bo kopîkirina lînkê
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
         if (err.name !== 'AbortError') { // Heke bikarhêner betal neke
             showNotification(t('share_error'), 'error');
         }
    }
}

/**
 * Hemî agahdariyên nû ji bo nîşana (badge) ya agahdariyan kontrol dike
 */
function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBtn.querySelector('.notification-badge').style.display = 'block';
            } else {
                notificationBtn.querySelector('.notification-badge').style.display = 'none';
            }
        }
    });
}

/**
 * Hemî Event Listenerên sereke yên sepanê saz dike
 */
function setupEventListeners() {
    // --- Event Delegation (Birêvebirina Kiryarên Dînamîk) ---
    // Em guhdarekî sereke li ser konteynera sepanê saz dikin
    appContainer.addEventListener('click', async (e) => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) {
            // Heke tiştek bi 'data-action' nehate dîtin,
            // em kontrol dikin ka klîk li ser kartê kałayekê ye (ji bo nîşandana hûrguliyan)
            const productCard = e.target.closest('.product-card');
            if (productCard && !e.target.closest('button, a')) {
                e.preventDefault();
                showProductDetails(productCard.dataset.productId);
            }
            return;
        }

        const action = actionTarget.dataset.action;
        const productId = e.target.closest('.product-card')?.dataset.productId;

        // Ji bo rêgirtin li tevliheviyên klîkê
        e.preventDefault();
        e.stopPropagation();

        switch (action) {
            // Kiryarên Karta Kałayê
            case 'add-to-cart':
                addToCart(productId);
                if (!actionTarget.disabled) {
                    const originalContent = actionTarget.innerHTML;
                    actionTarget.disabled = true;
                    actionTarget.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                    setTimeout(() => {
                        actionTarget.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`;
                        setTimeout(() => {
                            actionTarget.innerHTML = originalContent;
                            actionTarget.disabled = false;
                        }, 1500);
                    }, 500);
                }
                break;
            case 'toggle-favorite':
                toggleFavorite(productId);
                break;
            case 'share-product':
                handleShare(productId);
                break;
            // Kiryarên Admin (ji ber ku admin.js nayê guhertin, divê ev li vir bin)
            case 'edit-product':
                window.AdminLogic?.editProduct(productId);
                break;
            case 'delete-product':
                window.AdminLogic?.deleteProduct(productId);
                break;

            // Kiryarên Navîgasyonê (Rêveçûn)
            case 'navigate-category': {
                const catId = actionTarget.dataset.categoryId;
                if (catId) {
                    await navigateToFilter({ category: catId, subcategory: 'all', subSubcategory: 'all', search: '' });
                    mainCategoriesContainer.scrollIntoView({ behavior: 'smooth' });
                }
                break;
            }
            case 'navigate-brand': {
                const { categoryId, subcategoryId } = actionTarget.dataset;
                if (subcategoryId && categoryId) {
                    showPage('subcategoryDetailPage', 'Brand Products', { mainCatId: categoryId, subCatId: subcategoryId });
                } else if (categoryId) {
                    await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                }
                break;
            }
            case 'navigate-filter': {
                const { categoryId, subcategoryId, subSubcategoryId } = actionTarget.dataset;
                await navigateToFilter({
                    category: categoryId || 'all',
                    subcategory: subcategoryId || 'all',
                    subSubcategoryId: subSubcategoryId || 'all',
                    search: ''
                });
                break;
            }
            case 'navigate-subcategory-detail': {
                const { mainCatId, subCatId } = actionTarget.dataset;
                showPage('subcategoryDetailPage', '', { mainCatId, subCatId });
                break;
            }
            case 'navigate-main-category': {
                await navigateToFilter({
                    category: actionTarget.dataset.category,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                break;
            }
            case 'navigate-sheet-category': {
                await navigateToFilter({
                    category: actionTarget.dataset.category,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                closeCurrentPopup();
                showPage('mainPage');
                break;
            }
            case 'navigate-sub-category': {
                const { mainCatId, subCatId } = actionTarget.dataset;
                if (subCatId === 'all') {
                    await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
                } else {
                    showPage('subcategoryDetailPage', '', { mainCatId, subCatId });
                }
                break;
            }
            case 'filter-sub-sub-category': {
                // Ji bo rûpela hûrguliyên kategoriyê
                const subSubCatId = actionTarget.dataset.id;
                document.querySelectorAll('#subSubCategoryContainerOnDetailPage .subcategory-btn').forEach(b => b.classList.remove('active'));
                actionTarget.classList.add('active');
                const currentSearch = subpageSearchInput.value;
                const { mainCatId, subCatId } = state.currentPageParams;
                renderProductsOnDetailPage(subCatId, subSubCatId, currentSearch);
                break;
            }
        }
    });

    // --- Listenerên ji bo Tuخمên Statîk ---

    // Navîgasyona Jêrîn
    homeBtn.onclick = async () => {
        if (!mainPage.classList.contains('page-active')) {
            showPage('mainPage');
        }
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };
    settingsBtn.onclick = () => showPage('settingsPage', t('settings_title'));
    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };

    // Header
    document.getElementById('headerBackBtn').onclick = () => history.back();
    notificationBtn.onclick = () => openPopup('notificationsSheet');

    // Popups & Modal
    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Formên Statîk
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // onAuthStateChanged dê karê mayî bike
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
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

    // Lêgerîn (Search)
    const debouncedSearch = debounce((term) => {
        navigateToFilter({ search: term });
    }, 500);
    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };
    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' });
    };
    
    // Lêgerîna Rûpela Navxweyî (Subpage Search)
    const debouncedSubpageSearch = debounce(async (term) => {
        if (state.currentPageId === 'subcategoryDetailPage') {
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            const { subCatId } = state.currentPageParams;
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
        debouncedSubpageSearch('');
    };

    // Mîhengên (Settings)
    settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    settingsLogoutBtn.onclick = async () => {
        await signOut(auth);
        showNotification(t('logout_success'), 'success');
    };
    termsAndPoliciesBtn.onclick = () => openPopup('termsSheet');
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => setLanguage(btn.dataset.lang);
    });

    // Scroll Observer ji bo barkirina bêtir kałayan
    setupScrollObserver();
}

/**
 * Fonksiyona sereke ji bo destpêkirina sepanê
 */
async function initializeAppLogic() {
    // 1. Sazkirina Pira Admin (Admin Bridge)
    // Ev divê berî her tiştî be da ku admin.js kar bike
    populateGlobalAdminTools();

    // 2. Destpêkirina state-ên bingehîn
    if (!state.sliderIntervals) state.sliderIntervals = {};
    updateCartCount();

    // 3. Sazkirina Guhdarên Bûyeran (Event Listeners)
    setupEventListeners();

    // 4. Sazkirina Ziman û UI ya bingehîn
    setLanguage(state.currentLanguage);
    setupGpsButton(); // Ji bo bişkoja GPS di profaylê de

    // 5. Destpêkirina Guhdarên Firebase (Firebase Listeners)
    
    // Guhdarîkirina li guhertinên kategoriyan
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]; // Zêdekirina "Hemî"
        
        // Nûvekirina UI ku bi kategoriyan ve girêdayî ye
        renderMainCategories();
        
        // Nûvekirina dropdownên admin (eger admin têketî be)
        if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic?.updateAdminCategoryDropdowns) {
            window.AdminLogic.updateAdminCategoryDropdowns();
            window.AdminLogic.updateShortcutCardCategoryDropdowns();
        }

        // Barkirina rûpela destpêkê piştî ku kategorî hatin
        if (!state.initialLoadDone) {
            handleInitialPageLoad();
            state.initialLoadDone = true;
        }
    });

    // Guhdarîkirina li lînkên têkiliyê (ji bo rûpela settings)
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const qSocial = query(socialLinksCollection, orderBy("createdAt", "desc"));
    onSnapshot(qSocial, (snapshot) => {
        const container = document.getElementById('dynamicContactLinksContainer');
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' 'state.currentLanguage'] || link.name_ku_sorani;
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
            container.appendChild(linkElement);
        });
    });

    // Guhdarîkirin ji bo agahdariyan
    checkNewAnnouncements();

    // 6. Destpêkirina PWA û Messaging
    setupPwaListeners();
    setupFcmListeners();
}

/**
 * Sazkirina Guhdarên PWA (Install Prompt û Service Worker)
 */
function setupPwaListeners() {
    // Ji bo PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.style.display = 'flex';
        console.log('`beforeinstallprompt` event fired.');
    });
    
    document.getElementById('installAppBtn')?.addEventListener('click', async () => {
        if (state.deferredPrompt) {
            document.getElementById('installAppBtn').style.display = 'none';
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            state.deferredPrompt = null;
        }
    });

    // Ji bo Nûvekirina Service Worker
    if ('serviceWorker' in navigator) {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered.');
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        updateNotification.classList.add('show'); // Nîşana nûvekirinê nîşan bide
                    }
                });
            });

            updateNowBtn.addEventListener('click', () => {
                registration.waiting.postMessage({ action: 'skipWaiting' });
            });
        }).catch(err => {
            console.log('Service Worker registration failed: ', err);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New Service Worker activated. Reloading...');
            window.location.reload();
        });
    }
}

/**
 * Sazkirina Guhdarên Firebase Cloud Messaging (FCM)
 */
function setupFcmListeners() {
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
        notificationBtn.querySelector('.notification-badge').style.display = 'block';
    });
}

/**
 * Fonksiyona Destpêkê (Entry Point)
 * Ev yekem tişt e ku piştî barkirina DOMê dixebite
 */
function init() {
    renderSkeletonLoader(skeletonLoader); // Skeleton loader nîşan bide tavilê

    // Hewl bide ku offline persistence çalak bike
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Dest bi logîka sepanê bike
        })
        .catch((err) => {
            console.warn("Offline persistence failed: ", err.code);
            initializeAppLogic(); // Her çawa be, dest bi sepanê bike
        });
}

// --- 4. PIRA ADMIN (ADMIN BRIDGE) ---
/**
 * Ev fonksiyon hemî pêdiviyên ku admin.js a neguhertî hewce dike, 
 * di bin 'window.globalAdminTools' de peyda dike.
 */
function populateGlobalAdminTools() {
    window.globalAdminTools = {
        // Xizmetên Firebase
        db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
        collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,

        // Koleksiyon
        productsCollection, categoriesCollection, announcementsCollection,
        promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,

        // Fonksiyonên Alîkar
        showNotification,
        t,
        openPopup,
        closeCurrentPopup,
        searchProductsInFirestore, // admin.js hewce dike ku vê bang bike

        // Fonksiyonên Alîkar ên Nû ji bo birêvebirina state
        clearProductCache: () => {
            console.log("Cache paqij bû ji ber kiryara admin.");
            state.productCache = {}; // Cache ya kałayan paqij bike
            homePageSectionsContainer.innerHTML = ''; // Rûpela sereke paqij bike da ku ji nû ve çêbibe
        },
        setEditingProductId: (id) => { state.editingProductId = id; },
        getEditingProductId: () => state.editingProductId,
        getCategories: () => state.categories, // Ji bo dropdownên admin
        getCurrentLanguage: () => state.currentLanguage // Ji bo wergerên admin
    };
}


// --- 5. GUHDARÊN GŞTÎ (GLOBAL LISTENERS) ---

// Guhdarê Sereke yê Firebase Auth (ji bo birêvebirina têketina Admin)
onAuthStateChanged(auth, async (user) => {
    // Divê ev UID bi UID ya adminê te re li hev be
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // VÊ BIGUHERÎNE
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        // Kontrol bike ka admin.js hatiye barkirin û fonksiyona initialize heye
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             window.AdminLogic.initialize();
        } else {
             console.warn("AdminLogic.initialize nehat dîtin. Li benda barkirina admin.js dimîne...");
             // Heke admin.js hîn nehatibe barkirin (ji ber 'defer'),
             // em dikarin guhdarekî 'load' saz bikin
             window.addEventListener('load', () => {
                if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                    window.AdminLogic.initialize();
                }
             });
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) {
            // Heke bikarhênerek ne-admin têketî be, wî derxe
            await signOut(auth);
            console.log("Bikarhênerê ne-admin hate derxistin.");
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // UI ya admin paqij bike
        }
    }

    // Ger têketin serketî bû, modalê bigire
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});

// Destpêkirina sepanê piştî ku DOM amade bû
document.addEventListener('DOMContentLoaded', init);
