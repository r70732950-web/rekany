// BEŞA DUYEM: ui-helpers.js
// Ev pel fonksiyonên alîkar ên UI, birêvebirina selikê, favoriyan, profîlê, popupan, û agahdariyan digire nav xwe.

// Imports from app-setup.js
import {
    db, auth, messaging, // Firebase services
    translations, state, // Global state and translations
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, // Local storage keys
    loginModal, addProductBtn, productFormModal, // Modals and buttons (might not all be needed here)
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions, // Cart elements
    favoritesContainer, emptyFavoritesMessage, // Favorites elements
    categoriesBtn, sheetOverlay, sheetCategoriesContainer, // Category sheet elements
    profileForm, // Profile form
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer, // Notification elements
    termsAndPoliciesBtn, termsSheet, termsContentContainer, // Terms elements
    // Import other necessary DOM elements from app-setup.js as needed
    announcementsCollection, // Needed for notifications
} from './app-setup.js';

// Imports from main-logic.js (Core utilities and state access)
import {
    t, showNotification, debounce, createProductCardElement, // Core utilities
    renderSkeletonLoader, updateActiveNav, // UI utilities potentially needed
    navigateToFilter, showPage, applyFilterState, // Navigation
    searchProductsInFirestore, // Might be needed if language change triggers search?
    renderMainCategories, renderSubcategories, // Might be needed if language change triggers category render?
    showProductDetailsWithData, // For showing details from favorites/cart
    productsCollection, // Needed for fetching product data
    // Import state or specific parts if direct access is preferred over passing arguments
    // state // Assuming state is imported and mutable as in original design
} from './main-logic.js';

// Firebase SDK functions needed in this file
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, getDocs, limit, where, addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- Popup and Sheet Management ---

/** Hemî popup (modal û sheet) û overlay digire. */
function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active'); // Destûrê dide scrollkirina body
}

/** Popupek (modal an sheet) vedike û dîroka gerokê nûve dike. */
function openPopup(id, type = 'sheet') {
    // saveCurrentScrollPosition(); // Ev fonksiyon nema li vir e, dibe ku ne hewce be ji bo popupan
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Popup element with id "${id}" not found.`);
        return;
    }

    closeAllPopupsUI(); // Pêşî hemî yên din bigire

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Naveroka sheet bar bike heke pêwîst be
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
    } else { // type === 'modal'
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Pêşî li scrollkirina body bigire
    history.pushState({ type: type, id: id }, '', `#${id}`); // State li dîrokê zêde bike
}

/** Popupa heyî (li gorî dîroka gerokê) digire. */
function closeCurrentPopup() {
    // Kontrol bike ka state a heyî popup e
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Vegere state a berê (ku dê popstate trigger bike û popup bigire)
    } else {
        // Heke state ne popup be (ji bo ewlehiyê), hemîyan bigire
        closeAllPopupsUI();
    }
}

// --- Cart Management ---

/** Jimara tiştên di sebetê de nûve dike. */
function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

/** Sebetê di local storage de tomar dike û jimara tiştan nûve dike. */
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

/** Hilberekê li sebetê zêde dike an hejmara wê nûve dike. */
async function addToCart(productId) {
    // Hewl bide ku hilberê ji state.products (cache) bibîne
    let product = state.products.find(p => p.id === productId);

    // Ger di cache de nebe, ji Firestore bistîne
    if (!product) {
        console.warn("Product not found in local cache for cart. Fetching...");
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                showNotification(t('product_not_found_error'), 'error');
                return;
            }
        } catch (error) {
            console.error("Error fetching product for cart:", error);
            showNotification(t('error_generic'), 'error');
            return;
        }
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++; // Hejmarê zêde bike
    } else {
        // Tiştek nû lê zêde bike
        state.cart.push({
            id: product.id,
            name: product.name, // Navê wekî objekt bihêle
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }
    saveCart(); // Sebetê tomar bike
    showNotification(t('product_added_to_cart')); // Agahdariyê nîşan bide
}

/** Hejmara tiştekî di sebetê de diguherîne. */
function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Ger hejmar 0 an kêmtir be, jê bibe
        } else {
            saveCart(); // Sebetê tomar bike
            renderCart(); // Sebetê ji nû ve nîşan bide
        }
    }
}

/** Tiştekî ji sebetê jê dibe. */
function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId); // Tiştê jê bibe
    saveCart(); // Sebetê tomar bike
    renderCart(); // Sebetê ji nû ve nîşan bide
}

/** Naveroka sebetê di bottom sheet de nîşan dide. */
function renderCart() {
    cartItemsContainer.innerHTML = ''; // Konteynerê paqij bike
    if (state.cart.length === 0) {
        // Ger sebet vala be, peyamek nîşan bide
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    // Ger sebet ne vala be, peyamê veşêre û total/actions nîşan bide
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Bişkokên şandinê nîşan bide

    let total = 0;
    // Li ser her tiştekî di sebetê de bigere û elementek çêbike
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Navê hilberê li gorî zimanê heyî bistîne
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('unnamed_product', {defaultValue: 'کاڵای بێ ناو'}));

        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=X'}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'">
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
    // Bihayê giştî nûve bike
    totalAmount.textContent = total.toLocaleString();
    // Guhdarên bûyeran ji bo bişkokan saz bike
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

/** Peyamek ji bo şandina daxwaziyê (order) çêdike. */
function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('unnamed_product', {defaultValue: 'کاڵای بێ ناو'}));
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

    // Agahiyên bikarhêner lê zêde bike heke hebin
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`; // Daxwaza agahiyan bike
    }
    return message;
}

/** Bişkokên ji bo şandina daxwaziyê bi rêyên cuda (WhatsApp, Viber, etc.) nîşan dide. */
async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Konteynerê paqij bike

    try {
        // Rêbazên têkiliyê ji Firestore bistîne
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Li gorî dema çêkirinê rêz bike
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        // Ji bo her rêbazekê bişkokek çêbike
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // Stîlek giştî bikar bîne
            btn.style.backgroundColor = method.color; // Rengê taybet bicîh bike

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

            // Klîka li ser bişkokê
            btn.onclick = () => {
                const message = generateOrderMessage(); // Peyamê çêbike
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Nirx (hejmar, username, an URL)

                // Lînkê li gorî cureyê rêbazê çêbike
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; // Dibe ku pêdivî bi ceribandinê hebe
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Ji bo têlefonkirinê
                        break;
                    case 'url':
                        link = value; // Nirx wekî URL a tevahî bikar bîne
                        break;
                }

                // Lînkê veke
                if (link) {
                    window.open(link, '_blank');
                }
            };
            container.appendChild(btn); // Bişkokê li konteynerê zêde bike
        });
    } catch (error) {
        console.error("Error rendering cart action buttons:", error);
        container.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}


// --- Favorites Management ---

/** Lîsteya dildaran di local storage de tomar dike. */
function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

/** Kontrol dike ka hilberek di lîsteya dildaran de ye yan na. */
function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/** Hilberekê li lîsteya dildaran zêde dike an jê jê dibe. */
function toggleFavorite(productId, event) {
    if(event) event.stopPropagation(); // Pêşî li bûyera klîka kartê bigire

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        // Jêbirin ji dildaran
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        // Zêdekirin li dildaran
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites(); // Lîsteyê tomar bike

    // UI-ya hemî kartên vê hilberê nûve bike
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart');
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Îkona tije
            heartIcon.classList.toggle('far', !isNowFavorite); // Îkona vala
        }
    });

    // Ger rûpela dildaran vekirî be, wê nûve bike
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

/** Rûpela lîsteya dildaran di bottom sheet de nîşan dide. */
async function renderFavoritesPage() {
    favoritesContainer.innerHTML = ''; // Konteynerê paqij bike

    if (state.favorites.length === 0) {
        // Ger lîste vala be, peyamek nîşan bide
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    // Ger lîste ne vala be, peyamê veşêre û grid nîşan bide
    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';

    // Skeleton loader nîşan bide heta ku daneyên hilberan werin
    renderSkeletonLoader(favoritesContainer, state.favorites.length);

    try {
        // Promise ji bo girtina daneyên her hilberekî dildar
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Skeleton loader rake

        // Hilberên ku hatine dîtin fîlter bike û nîşan bide
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Tenê yên ku hene
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // Ger piştî girtinê ti hilber nehat dîtin (dibe ku hatibin jêbirin)
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // Dibe ku lîsteya favorites jî were paqijkirin heke hemî jê hatine birin
             // state.favorites = [];
             // saveFavorites();
        } else {
            favoritedProducts.forEach(product => {
                // Karta hilberê çêbike (fonksiyon ji main-logic.js tê importkirin)
                const productCard = createProductCardElement(product);
                favoritesContainer.appendChild(productCard);
            });
             // Setup animations for newly added cards
             setupScrollAnimations(); // Assuming setupScrollAnimations is available
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}


// --- Profile Management ---

/** Agahiyên profîlê tomar dike. */
function saveProfile(event) {
    event.preventDefault(); // Pêşî li şandina formê bigire
    state.userProfile = {
        name: document.getElementById('profileName').value,
        address: document.getElementById('profileAddress').value,
        phone: document.getElementById('profilePhone').value,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile)); // Di local storage de tomar bike
    showNotification(t('profile_saved'), 'success');
    closeCurrentPopup(); // Popupa profîlê bigire
}

/** Fonksiyonê ji bo bişkoka GPS saz dike. */
function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn?.querySelector('span'); // Use optional chaining

     if (!getLocationBtn || !profileAddressInput || !btnSpan) {
         console.warn("Could not find all elements for GPS button setup.");
         return; // Ger element neyên dîtin, venegere
     }


    const originalBtnText = btnSpan.textContent;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('Geroka te piştgiriya GPS nake', 'error');
            return;
        }

        btnSpan.textContent = '...Çaverê be'; // Nivîsa bişkokê biguherîne
        getLocationBtn.disabled = true; // Bişkokê neçalak bike

        // Hewl bide ku pozîsyona heyî bistîne
        navigator.geolocation.getCurrentPosition(
             async (position) => { // successCallback
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Reverse geocoding bi karanîna Nominatim
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name; // Navnîşanê têxe inputê
                        showNotification('Navnîşan hate wergirtin', 'success');
                    } else {
                        showNotification('Navnîşan nehate dîtin', 'error');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    showNotification('Xeletiyek di wergirtina navnîşanê de çêbû', 'error');
                } finally {
                    // Bişkokê vegerîne rewşa normal
                    btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
             (error) => { // errorCallback
                let message = '';
                switch (error.code) {
                    case 1: message = 'Destûr nehate dayîn'; break;
                    case 2: message = 'Cih nehate dîtin'; break;
                    case 3: message = 'Dem derbas bû'; break;
                    default: message = 'Xeletiyek nenas';
                }
                showNotification(message, 'error');
                btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Vebijarkên ji bo rastbûnek bilindtir
        );
    });
}


// --- Notifications ---

/** Destûrê ji bo nîşandana agahdariyan dixwaze û token tomar dike. */
async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notification_permission_granted', {defaultValue:'Destûra agahdariyan hate dayîn'}), 'success');
            // Tokenê FCM bistîne
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Vapid key a xwe lê zêde bike
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken); // Token tomar bike
            } else {
                console.log('Token nehate wergirtin.');
                showNotification(t('notification_token_error', {defaultValue:'Token nehate wergirtin'}), 'error');

            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification(t('notification_permission_denied', {defaultValue:'Destûr nehate dayîn'}), 'error');
        }
    } catch (error) {
        console.error('Error requesting notification permission: ', error);
         showNotification(t('error_generic'), 'error');
    }
}

/** Tokenê FCM di Firestore de tomar dike. */
async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Token wekî ID-ya belgeyê bikar bîne da ku ji dubarebûnê dûr bikeve
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(), // Dema tomarkirinê tomar bike
            // Hûn dikarin agahiyên din ên bikarhêner an cîhazê jî tomar bikin
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

/** Agahdariyên giştî (announcements) ji bo bikarhêner nîşan dide. */
async function renderUserNotifications() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(20)); // Tenê 20 agahdariyên dawî bistîne
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = ''; // Konteynerê paqij bike
    if (snapshot.empty) {
        // Ger ti agahdarî tune bin, peyamek nîşan bide
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    // Li ser her agahdariyekê bigere û elementek çêbike
    snapshot.forEach(doc => {
        const announcement = doc.data();
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt; // Timestamp a herî dawî nûve bike
        }

        const date = new Date(announcement.createdAt);
        const formattedDate = date.toLocaleDateString(state.currentLanguage.startsWith('ar') ? 'ar-IQ' : 'ku-IQ'); // Formatkirina tarîxê li gorî ziman

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
            <p class="notification-content">${content.replace(/\n/g, '<br>')}</p> {/* Newlines veguherîne <br> */}
        `;
        notificationsListContainer.appendChild(item);
    });

    // Timestamp a herî dawî ya dîtî tomar bike û badge veşêre
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}

/** Kontrol dike ka agahdariyên nû hene yan na û badge nûve dike. */
function checkNewAnnouncements() {
    // Guhdariya tenê agahdariya herî dawî bike
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // Ger agahdariyek nûtir hebe, badge nîşan bide
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
             notificationBadge.style.display = 'none'; // Ger ti agahdarî tune bin veşêre
        }
    }, error => {
         console.error("Error checking new announcements: ", error);
         // Dibe ku hûn bixwazin xeletiyê bi rengekî birêve bibin
    });
    // Hûn dikarin unsubscribe paşê bang bikin heke pêwîst be
    // window.unsubscribeAnnouncements = unsubscribe;
}

// --- Settings and Misc ---

/** Zimanê sepanê diguherîne û UI nûve dike. */
function setLanguage(lang) {
    state.currentLanguage = lang; // Rewşa ziman nûve bike
    localStorage.setItem('language', lang); // Di local storage de tomar bike

    // Attrîbutên html û dir nûve bike
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Her tim RTL ye

    // Hemî elementên bi data-translate-key nûve bike
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key); // Wergerê bistîne
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder !== undefined) { // Kontrol bike ka placeholder heye
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation; // Naveroka nivîsê biguherîne
        }
    });


    // Bişkokên ziman nûve bike
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Naveroka girêdayî ziman ji nû ve nîşan bide
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) homeContainer.innerHTML = ''; // Naveroka malê paqij bike da ku ji nû ve were barkirin

    // Li gorî rewşa heyî ya sepanê naverokê ji nû ve bar bike
    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
     if (isHomeView) {
        // Fonksiyona ku naveroka rûpela serekî nîşan dide bang bike (li main-logic.js)
        if (typeof renderHomePageContent === 'function') { // Ji bo ewlehiyê kontrol bike
             renderHomePageContent();
         } else {
             console.error("renderHomePageContent function not available for language change.")
         }
     } else {
         // Fonksiyona ku lîsteya hilberan nîşan dide bang bike (li main-logic.js)
         if (typeof renderProducts === 'function') { // Ji bo ewlehiyê kontrol bike
             renderProducts(); // An jî dibe ku searchProductsInFirestore(state.currentSearch, true);
         } else {
              console.error("renderProducts function not available for language change.")
         }
     }


    // Kategoriyan ji nû ve nîşan bide (ji main-logic.js)
    if (typeof renderMainCategories === 'function') renderMainCategories();
    // if (typeof renderSubcategories === 'function') renderSubcategories(state.currentCategory); // Ev dibe ku bixweber ji hêla applyFilterState ve were kirin
    renderCategoriesSheet(); // Sheeta kategoriyan nûve bike

    // Popupan ji nû ve nîşan bide heke vekirî bin
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
    if (document.getElementById('termsSheet').classList.contains('show')) renderPolicies();
    if (document.getElementById('notificationsSheet').classList.contains('show')) renderUserNotifications();
    renderContactLinks(); // Lînkên têkiliyê nûve bike
    renderCartActionButtons(); // Bişkokên sebetê nûve bike

    // UI-ya admin nûve bike heke pêwîst be
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
         window.AdminLogic.renderCategoryManagementUI?.();
         window.AdminLogic.renderSocialMediaLinks?.();
         window.AdminLogic.renderContactMethodsAdmin?.();
         // Fonksiyonên din ên admin ku girêdayî ziman in...
    }
}

/** Cache paqij dike û rûpelê ji nû ve bar dike. */
async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            // Service Worker jê bibe
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            // Hemî cache paqij bike
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success');

            // Rûpelê ji nû ve bar bike piştî demek kurt
            setTimeout(() => {
                window.location.reload(true); // Barkirina dijwar
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

/** Merc û rêsayan ji Firestore digire û nîşan dide. */
async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Peyama barkirinê
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Naverokê li gorî zimanê heyî an fallback bistîne
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`; // Ger tiştek tune be
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Di rewşa xeletiyê de
    }
}

/** Lînkên têkiliyê yên dînamîk (social media) nîşan dide. */
function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Li gorî dema çêkirinê rêz bike

    // Guhdariya guhertinên di lînkan de bike
    const unsubscribe = onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Konteynerê paqij bike

        if (snapshot.empty) {
            // Ger ti lînk tune bin
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            // Ger konteyner vekirî be, wê bigire (optional)
            // contactLinksContainer.classList.remove('open');
            // document.querySelector('#contactToggle .contact-chevron')?.classList.remove('open');
            return;
        }

        // Ji bo her lînkekê elementek çêbike
        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani; // Navê li gorî ziman

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Di tabek nû de veke
            linkElement.rel = 'noopener noreferrer'; // Ji bo ewlehiyê
            linkElement.className = 'settings-item'; // Stîla heyî bikar bîne

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i> {/* Îkona lînka derve */}
            `;

            contactLinksContainer.appendChild(linkElement);
        });
         // Make sure the container is visible if it has links (might be initially hidden)
         // Assuming the 'open' class controls visibility based on the toggle button
    }, error => {
         console.error("Error fetching contact links: ", error);
         contactLinksContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    });
     // Hûn dikarin unsubscribe paşê tomar bikin heke pêwîst be
     // window.unsubscribeContactLinks = unsubscribe;
}

/** Peyama bi xêrhatinê ji bo serdana yekem nîşan dide. */
function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal'); // Modala bi xêrhatinê veke
        localStorage.setItem('hasVisited', 'true'); // Nîşan bike ku bikarhêner serdan kiriye
    }
}

/** Fonksiyonek ji bo formatkirina danasînê (guhertina URL û newlines). */
function formatDescription(text) {
    if (!text) return '';
    // Pêşî karakterên taybet escape bike
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // URLan bibîne û bike lînk
    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Newlines veguherîne <br>
    return textWithLinks.replace(/\n/g, '<br>');
}

/** Fonksiyonek ji bo birêvebirina parvekirina hilberê. */
async function handleShare(product, productName) {
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
    const shareData = {
        title: productName,
        text: `${t('share_text')}: ${productName}`,
        url: productUrl,
    };
    try {
        if (navigator.share) {
            // Web Share API bikar bîne heke piştgirî hebe
            await navigator.share(shareData);
        } else {
            // Fallback: Lînkê kopî bike
             const textArea = document.createElement('textarea');
             textArea.value = productUrl;
             document.body.appendChild(textArea);
             textArea.select();
             try {
                 document.execCommand('copy');
                 showNotification(t('link_copied', {defaultValue:'لینک کۆپی کرا!'}), 'success');
             } catch (err) {
                 showNotification(t('copy_failed', {defaultValue:'کۆپیکردن سەرنەکەوت!'}), 'error');
             }
             document.body.removeChild(textArea);
        }
    } catch (err) {
        console.error('Share error:', err);
         // Ger bikarhêner parvekirin betal bike, xeletiyê nîşan nede
        if (err.name !== 'AbortError') {
            showNotification(t('share_error'), 'error');
        }
    }
}

// --- Subcategory Detail Page Logic --- (Moved from main-logic)

/** Rûpela hûrguliyên binkategoriyê nîşan dide. */
async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = '';
    try {
        // Navê binkategoriyê ji bo sernavê bistîne
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
        subCatName = 'Details'; // Sernavê default
    }

    // State li dîrokê zêde bike heke ne ji popstate be
    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); // Rûpelê nîşan bide

    const detailPageLoader = document.getElementById('detailPageLoader');
    const detailProductsContainer = document.getElementById('productsContainerOnDetailPage');
    const detailSubSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Loader nîşan bide û konteyneran paqij bike
    if(detailPageLoader) detailPageLoader.style.display = 'block';
    if(detailProductsContainer) detailProductsContainer.innerHTML = '';
    if(detailSubSubContainer) detailSubSubContainer.innerHTML = '';

    // Lêgerîna subpage vesaz bike
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
     if(subpageSearchInput) subpageSearchInput.value = '';
     if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';

    // Sub-subkategoriyan û hilberan bar bike
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Di destpêkê de hemî hilberên subcategory nîşan bide

    // Loader veşêre
    if(detailPageLoader) detailPageLoader.style.display = 'none';
}

/** Sub-subkategoriyan li ser rûpela hûrguliyên binkategoriyê nîşan dide. */
async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
     if (!container) return; // Ger element tune be venegere
    container.innerHTML = ''; // Paqij bike

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        // Ger ti sub-subkategorî tune bin, konteynerê veşêre
        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex'; // Konteynerê nîşan bide

        // Bişkoka 'Hemî'
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Di destpêkê de çalak be
         const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;

        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // ID ji bo nasînê
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
            renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Hilberên 'all' nîşan bide
        };
        container.appendChild(allBtn);

        // Bişkokên ji bo her sub-subkategoriyekê
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // ID ji bo nasînê
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Hilberên vê sub-sub nîşan bide
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Di rewşa xeletiyê de veşêre
    }
}

/** Hilberan li ser rûpela hûrguliyên binkategoriyê nîşan dide. */
async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
     if(!productsContainer || !loader) return; // Ger element tune bin venegere

    loader.style.display = 'block'; // Loader nîşan bide
    productsContainer.innerHTML = ''; // Konteynerê paqij bike

    try {
        let productsQuery;
        // Query li gorî sub-subkategoriyê an binkategoriyê ava bike
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Lêgerînê lê zêde bike heke hebe
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Ger lêgerîn hebe, orderBy ya yekem divê li gorî qada lêgerînê be
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Rêzkirina default heke lêgerîn tune be
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

         // Limit bike (optional, heke hûn paging naxwazin hemîyan nîşan bidin)
         productsQuery = query(productsQuery, limit(50)); // Mînak: 50 hilberên pêşîn


        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // Karta hilberê çêbike
                productsContainer.appendChild(card);
            });
             setupScrollAnimations(); // Anîmasyonan saz bike
        }
    } catch (error) {
        console.error(`Error fetching products for detail page:`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loader.style.display = 'none'; // Loader veşêre
    }
}

// --- Category Sheet --- (Moved from main-logic as it's UI interaction)
/** Kategoriyan di bottom sheet de nîşan dide. */
function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = ''; // Paqij bike
    if (!state.categories) return; // Ger kategorî nehatibin barkirin venegere

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`;

        btn.onclick = async () => {
            // Vegere rûpela serekî û parzûn bike
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
            closeCurrentPopup(); // Sheet bigire
            showPage('mainPage'); // Piştrast bike ku rûpela serekî tê nîşandan
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}


// --- Event Listeners specific to UI Helpers ---
function setupUIEventListeners() {
    // Bişkoka profîlê di navîgasyona jêrîn de
    const profileBtn = document.getElementById('profileBtn'); // Ji app-setup tê
    if (profileBtn) {
        profileBtn.onclick = () => {
            openPopup('profileSheet');
            updateActiveNav('profileBtn');
        };
    }

    // Bişkoka sebetê di navîgasyona jêrîn de
    if (cartBtn) { // cartBtn ji app-setup tê
        cartBtn.onclick = () => {
            openPopup('cartSheet');
            updateActiveNav('cartBtn');
        };
    }

     // Bişkoka kategoriyan di navîgasyona jêrîn de
     if (categoriesBtn) { // categoriesBtn ji app-setup tê
         categoriesBtn.onclick = () => {
             openPopup('categoriesSheet');
             updateActiveNav('categoriesBtn');
         };
     }

     // Bişkokên di rûpela mîhengan de
     const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn'); // Ji app-setup tê
     if (settingsFavoritesBtn) {
         settingsFavoritesBtn.onclick = () => {
             openPopup('favoritesSheet');
         };
     }

     const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn'); // Ji app-setup tê
     if (settingsAdminLoginBtn) {
         settingsAdminLoginBtn.onclick = () => {
             openPopup('loginModal', 'modal');
         };
     }

    // Girtina popupan
    if (sheetOverlay) { // sheetOverlay ji app-setup tê
        sheetOverlay.onclick = closeCurrentPopup;
    }
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); }; // Girtina modal dema ku li derve tê klîkkirin

    // Forma profîlê
    if (profileForm) { // profileForm ji app-setup tê
        profileForm.onsubmit = saveProfile;
    }

    // Guhertina ziman
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
        };
    });

    // Toggle a lînkên têkiliyê (social media)
    const contactToggle = document.getElementById('contactToggle'); // Ji app-setup tê
    if (contactToggle) {
         contactToggle.onclick = () => {
             const container = document.getElementById('dynamicContactLinksContainer'); // Pêdivî ye ku were importkirin an gihîştin
             const chevron = contactToggle.querySelector('.contact-chevron');
             if(container && chevron) {
                 container.classList.toggle('open');
                 chevron.classList.toggle('open'); // Îkona chevron biguherîne
             }
         };
     }


    // Bişkoka sazkirina PWA
    const installBtn = document.getElementById('installAppBtn'); // Ji app-setup tê
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Bişkokê veşêre piştî klîkkirinê
                state.deferredPrompt.prompt(); // Pêşniyara sazkirinê nîşan bide
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Pêşniyara tomarkirî paqij bike
            }
        });
    }

    // Bişkoka agahdariyan
    if (notificationBtn) { // notificationBtn ji app-setup tê
        notificationBtn.addEventListener('click', () => {
            openPopup('notificationsSheet');
        });
    }

     // Bişkoka Merc û Rêsayan
     if (termsAndPoliciesBtn) { // termsAndPoliciesBtn ji app-setup tê
         termsAndPoliciesBtn.addEventListener('click', () => {
             openPopup('termsSheet');
         });
     }

    // Bişkoka çalakkirina agahdariyan
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn'); // Pêdivî ye ku were importkirin
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }

     // Bişkoka nûvekirina bi zorê
     const forceUpdateBtn = document.getElementById('forceUpdateBtn'); // Pêdivî ye ku were importkirin
     if (forceUpdateBtn) {
         forceUpdateBtn.addEventListener('click', forceUpdate);
     }

     // Guhdariya peyamên foreground ji FCM
     onMessage(messaging, (payload) => {
         console.log('Foreground message received: ', payload);
         const title = payload.notification?.title || 'Agahdarî';
         const body = payload.notification?.body || '';
         showNotification(`${title}: ${body}`, 'success'); // Agahdariyê nîşan bide
         notificationBadge.style.display = 'block'; // Badge nîşan bide
     });
}

// --- Destpêkirina UI Helpers ---
function initializeUIHelpers() {
    setupUIEventListeners(); // Guhdarên bûyeran saz bike
    updateCartCount(); // Jimara sebetê ya destpêkê nûve bike
    setLanguage(state.currentLanguage); // Zimanê destpêkê bicîh bike (dibe ku hin beşên UI hewce bike)
    renderContactLinks(); // Lînkên têkiliyê bar bike
    checkNewAnnouncements(); // Ji bo agahdariyên nû kontrol bike
    showWelcomeMessage(); // Peyama bi xêrhatinê nîşan bide heke pêwîst be
    setupGpsButton(); // Fonksiyoneliya GPS saz bike
}

// Piştî ku DOM amade bû dest pê bike
document.addEventListener('DOMContentLoaded', initializeUIHelpers);


// --- Exposure for main-logic.js ---
// Fonksiyonên ku main-logic.js an jî beşên din hewce dikin ku bang bikin, eşkere bike
window.UIHelpers = {
    openPopup,
    closeCurrentPopup,
    closeAllPopupsUI,
    addToCart,
    toggleFavorite,
    isFavorite,
    updateCartCount, // Dibe ku main hewce bike ku vê bang bike?
    setLanguage, // Pêdivî ye ku ji hêla main ve were bang kirin dema ku ziman diguhere?
    formatDescription,
    handleShare,
    showSubcategoryDetailPage, // Ji bo navîgasyonê ji main
    renderProductsOnDetailPage, // Ji bo lêgerîna subpage
    // Fonksiyonên din ên ku têne export kirin lê zêde bike...
     renderCategoriesSheet, // Ji bo nûvekirina li ser guhertina ziman?
     renderFavoritesPage, // Ji bo vekirina ji settings
     renderCart, // Ji bo vekirina ji nav
     renderUserNotifications, // Ji bo vekirina ji header
     renderPolicies, // Ji bo vekirina ji settings
     requestNotificationPermission, // Ji bo çalakkirina ji settings
     forceUpdate, // Ji bo çalakkirina ji settings
};

// Exportên ji bo importkirina potansiyel (dibe ku ne hewce be heke window tê bikar anîn)
export {
    openPopup,
    closeCurrentPopup,
    closeAllPopupsUI,
    addToCart,
    toggleFavorite,
    isFavorite,
    setLanguage,
    formatDescription,
    handleShare,
    showSubcategoryDetailPage,
    renderProductsOnDetailPage,
    updateCartCount,
    renderCart,
    renderFavoritesPage,
    renderUserNotifications,
    renderPolicies,
    requestNotificationPermission,
    forceUpdate,
    renderCategoriesSheet,
};
