// ui.js

// Import ALL logic functions and state from app.js using the 'app' namespace
import * as app from './app.js';

// --- DOM ELEMENT GETTERS ---
const getEl = (id) => document.getElementById(id);

// --- UI STATE ---
let mainPageScrollPosition = 0;

// --- CORE UI FUNCTIONS ---
export function showPage(pageId) {
    if (!getEl('mainPage').classList.contains('page-hidden')) {
        mainPageScrollPosition = window.scrollY;
    }
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('page-hidden', page.id !== pageId);
    });
    if (pageId === 'mainPage') {
        setTimeout(() => window.scrollTo(0, mainPageScrollPosition), 0);
    } else {
        window.scrollTo(0, 0);
    }
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : 'settingsBtn';
    updateActiveNav(activeBtnId);
}

export function openPopup(id, type = 'sheet') {
    const element = getEl(id);
    if (!element) return;
    closeAllPopupsUI();
    if (type === 'sheet') {
        getEl('sheet-overlay').classList.add('show');
        element.classList.add('show');
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            getEl('profileName').value = app.userProfile.name || '';
            getEl('profileAddress').value = app.userProfile.address || '';
            getEl('profilePhone').value = app.userProfile.phone || '';
        }
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
}

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    getEl('sheet-overlay').classList.remove('show');
    document.body.classList.remove('overlay-active');
}

export function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const element = getEl(hash);
    if (hash === 'settingsPage') {
        showPage('settingsPage');
        history.replaceState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
    } else {
        showPage('mainPage');
        history.replaceState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
    }
    if (element) {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopup(hash, isSheet ? 'sheet' : 'modal');
        }
    }
}

export function showNotification(message, type = 'success') {
    // ... (This function is complete and correct)
}

export function updateCartCount() {
    const totalItems = app.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

export function updateLanguageUI() {
    document.documentElement.lang = app.currentLanguage.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = app.t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === app.currentLanguage);
    });
    const fetchedCategories = app.categories.filter(cat => cat.id !== 'all');
    app.categories.splice(1, app.categories.length - 1, ...fetchedCategories);
    app.categories[0].name = app.t('all_categories_label');
    
    renderProducts();
    renderMainCategories();
}

// --- ALL OTHER RENDERING FUNCTIONS ---
// ... (All render... functions go here, like renderProducts, renderCart, etc.)
// Remember to use `app.` for state and logic.

// --- EVENT LISTENER SETUP ---
export function setupAllEventListeners() {
    const debouncedSearch = app.debounce((term) => {
        app.searchProductsInFirestore(term, true);
    }, 500);

    getEl('searchInput').oninput = () => {
        const searchTerm = getEl('searchInput').value;
        getEl('clearSearchBtn').style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    getEl('clearSearchBtn').onclick = () => {
        getEl('searchInput').value = '';
        getEl('clearSearchBtn').style.display = 'none';
        app.searchProductsInFirestore('', true);
    };
    
    getEl('loginForm').onsubmit = (e) => app.handleLogin(e);
    getEl('settingsLogoutBtn').onclick = () => app.handleLogout();
    getEl('productForm').onsubmit = (e) => app.handleProductFormSubmit(e);
    
    // Navigation
    getEl('homeBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
        showPage('mainPage');
    };
    getEl('settingsBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
        showPage('settingsPage');
    };
    getEl('cartBtn').onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    getEl('categoriesBtn').onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    getEl('profileBtn').onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };

    // Popups & Overlays
    getEl('sheet-overlay').onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Forms & Admin Actions
    getEl('addProductBtn').onclick = () => { /* open empty product form */ };
    getEl('profileForm').onsubmit = (e) => {
        e.preventDefault();
        const newProfile = { name: getEl('profileName').value, address: getEl('profileAddress').value, phone: getEl('profilePhone').value, };
        app.saveProfile(newProfile);
        showNotification(app.t('profile_saved'), 'success');
        closeCurrentPopup();
    };

    // ... All other event listeners go here...
    // Make sure to copy them ALL from your original file.
}