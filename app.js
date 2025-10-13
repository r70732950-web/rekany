import { auth, messaging } from './firebase-config.js';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";
import * as state from './state.js';
import * as ui from './ui-components.js';
import * as service from './firestore-service.js';
import * as admin from './admin.js';

// DOM Elements
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

// Debounce function
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Main App Logic
function setupEventListeners() {
    document.getElementById('homeBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
        ui.showPage('mainPage');
    };
    // ... all other event listeners from original file
    // Example:
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        } catch (error) {
            ui.showNotification(state.t('login_error'), 'error');
        }
    };

    const debouncedSearch = debounce((term) => {
        service.searchProductsInFirestore(term, true);
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        state.setCurrentSearch(searchTerm);
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };
    // ... etc for all other event listeners
}

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    const isAdminUser = user && user.uid === adminUID;

    state.setAdmin(isAdminUser);
    sessionStorage.setItem('isAdmin', isAdminUser.toString());
    
    if (isAdminUser) {
        admin.loadPoliciesForAdmin();
        if (loginModal.style.display === 'block') {
            ui.closeCurrentPopup();
        }
    } else {
        if (user) {
            await signOut(auth);
        }
    }

    admin.updateAdminUI(isAdminUser);
    service.searchProductsInFirestore(state.currentSearch, true);
});

function initializeAppLogic() {
    service.fetchCategories().then(() => {
        ui.populateCategoryDropdown();
        ui.renderMainCategories();
        // ... rest of the logic that depends on categories
    });

    service.searchProductsInFirestore('', true);
    
    // ... all other initialization logic
    state.updateCartCount();
    setupEventListeners();
    // ... etc
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initializeAppLogic);