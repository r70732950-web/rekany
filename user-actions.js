// user-actions.js (کارێن بکارهێنەری)
// بەرپرسیارەتی: کونترۆلکرنا Cart (add, remove, update, render, generate message),
// کونترۆلکرنا Favorites (toggle, render), نیشاندانا Notifications و Policies یێن بکارهێنەری.

import {
    db, // Firestore instance
    state, // Global state object
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, // Constants
    announcementsCollection // Firestore collection for notifications
} from './app-setup.js';

import { // Firestore functions needed for notifications/policies
    doc, getDoc, getDocs, collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebase/9.15.0/firebase-firestore.js"; // Correct path if needed

import { // UI functions needed from ui-manager.js
    showNotification, t, updateCartCountUI, updateFavoriteButtonUI,
    showNotificationBadge, closeCurrentPopup // ZÊDEKIRÎ: closeCurrentPopup
} from './ui-manager.js';

// --- Cart Management ---

/**
 * Saves the current cart state to local storage and updates the UI count.
 */
function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch (e) {
        console.error("Error saving cart to localStorage:", e);
        // Maybe show a user notification if storage is full?
    }
    updateCartCountUI(); // Update UI badge
}

/**
 * Adds a product to the cart or increments its quantity.
 * Fetches product details if not available locally.
 * @param {string} productId - The ID of the product to add.
 */
export async function addToCart(productId) {
    // Find product in already loaded state first
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        // If not found locally, fetch details from Firestore
        console.warn("Product details not found locally for cart. Fetching...");
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                console.error(`Product with ID ${productId} not found in Firestore.`);
                showNotification(t('product_not_found_error', {default: 'هەڵە: کاڵاکە نەدۆزرایەوە!'}), 'error');
                return;
            }
        } catch (error) {
            console.error(`Error fetching product ${productId} for cart:`, error);
            showNotification(t('error_generic', {default: 'هەڵەیەک ڕوویدا!'}), 'error');
            return;
        }
    }

    // Now proceed with adding to cart
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++; // Increment quantity
    } else {
        // Add new item to cart
        state.cart.push({
            id: product.id,
            name: product.name, // Store the multilingual name object
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }

    saveCart(); // Save and update UI count
    showNotification(t('product_added_to_cart', {default: 'کاڵاکە زیادکرا بۆ سەبەتە'})); // Use UI function
}

/**
 * Updates the quantity of a product in the cart. Removes if quantity drops to 0 or less.
 * @param {string} productId - The ID of the product.
 * @param {number} change - The change in quantity (+1 or -1).
 */
export function updateQuantity(productId, change) {
    const cartItemIndex = state.cart.findIndex(item => item.id === productId);
    if (cartItemIndex > -1) {
        state.cart[cartItemIndex].quantity += change;
        if (state.cart[cartItemIndex].quantity <= 0) {
            // Remove item if quantity is zero or less
            state.cart.splice(cartItemIndex, 1);
        }
        saveCart(); // Save changes
        renderCart(); // Re-render the cart UI
    }
}

/**
 * Removes a product completely from the cart.
 * @param {string} productId - The ID of the product to remove.
 */
export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart(); // Save changes
    renderCart(); // Re-render the cart UI
}

/**
 * Generates the order message string based on cart content and user profile.
 * @returns {string} - The formatted order message.
 */
export function generateOrderMessage() {
    if (!state.cart || state.cart.length === 0) return ""; // Ensure state.cart exists

    let message = t('order_greeting', {default: "سڵاو! من پێویستم بەم کاڵایانەی خوارەوەیە:"}) + "\n\n";
    let total = 0;

    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('unknown_product',{default:'کاڵای نەناسراو'}));
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });

    message += `\n${t('order_total', {default: 'کۆی گشتی'})}: ${total.toLocaleString()} د.ع.\n`; // Use calculated total

    // Add user profile info if available
    if (state.userProfile && state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info', {default: '--- زانیاری داواکار ---'})}\n`;
        message += `${t('order_user_name', {default: 'ناو'})}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address', {default: 'ناونیشان'})}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone', {default: 'ژمارەی تەلەفۆن'})}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info', {default: 'تکایە ناونیشان و زانیارییەکانت بنێرە بۆ گەیاندن.'})}\n`;
    }

    return message;
}

/**
 * Renders the cart items and total in the cart bottom sheet.
 */
export function renderCart() {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartTotal = document.getElementById('cartTotal');
    const totalAmount = document.getElementById('totalAmount');
    const cartActions = document.getElementById('cartActions'); // Actions container (buttons)

    if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return; // Ensure elements exist

    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (!state.cart || state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }

    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block'; // Show action buttons container
    renderCartActionButtons(); // Fetch and render action buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('unknown_product',{default:'کاڵای نەناسراو'}));
        const itemImage = item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'; // Placeholder image

        cartItem.innerHTML = `
            <img src="${itemImage}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=N/A';">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-action="increase-quantity" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-action="decrease-quantity" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                 <div>${t('total_price',{default: 'کۆی گشتی:'})}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-action="remove-from-cart" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalAmount.textContent = total.toLocaleString(); // Update total display
    // Event listeners for quantity/remove buttons will be handled by delegation in app-logic.js
}

/**
 * Fetches contact methods from Firestore and renders action buttons in the cart.
 */
export async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    if (!container) return;
    container.innerHTML = ''; // Clear previous buttons

    try {
        const methodsCollectionRef = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollectionRef, orderBy("createdAt")); // Order by creation time or a specific order field if added
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align: center; color: var(--dark-gray);">${t('no_contact_methods', {default: 'هیچ ڕێگایەکی ناردن دیاری نەکراوە.'})}</p>`;
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a more generic class name or style based on method.color
            btn.className = 'whatsapp-btn'; // Reusing style, consider renaming class later
            btn.style.backgroundColor = method.color || '#ccc'; // Default color
            btn.dataset.action = "send-order"; // Action for event listener
            btn.dataset.methodType = method.type;
            btn.dataset.methodValue = method.value;

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name || method.type}</span>`; // Default icon and name

            container.appendChild(btn);
        });
        // Event listeners for these buttons will be handled by delegation in app-logic.js
    } catch (error) {
        console.error("Error fetching contact methods for cart:", error);
        container.innerHTML = `<p style="text-align: center; color: var(--danger-color);">${t('error_fetching_methods', {default: 'هەڵە لە هێنانی ڕێگاکانی ناردن.'})}</p>`;
    }
}

// --- Favorites Management ---

/**
 * Saves the current favorites list to local storage.
 */
function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
    } catch (e) {
        console.error("Error saving favorites to localStorage:", e);
    }
}

/**
 * Checks if a product is in the favorites list.
 * @param {string} productId - The ID of the product.
 * @returns {boolean} - True if the product is favorited.
 */
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/**
 * Adds or removes a product from the favorites list.
 * Updates local storage and UI button state.
 * @param {string} productId - The ID of the product.
 */
export function toggleFavorite(productId) {
    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites', {default: 'لە لیستی دڵخوازەکان سڕدرایەوە'}), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites', {default: 'زیادکرا بۆ لیستی دڵخوازەکان'}), 'success');
    }

    saveFavorites(); // Save the updated list
    updateFavoriteButtonUI(productId, !isCurrentlyFavorite); // Update UI for this product ID across the app

    // If the favorites sheet is currently open, re-render it
    const favoritesSheet = document.getElementById('favoritesSheet');
    if (favoritesSheet && favoritesSheet.classList.contains('show')) {
        renderFavoritesPage();
    }
}

/**
 * Fetches details for favorited products and renders them in the favorites bottom sheet.
 */
export async function renderFavoritesPage() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');

    if (!favoritesContainer || !emptyFavoritesMessage) return;

    favoritesContainer.innerHTML = ''; // Clear previous items

    if (!state.favorites || state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Use grid layout
    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeleton loader

    try {
        // Create promises to fetch details for each favorited product ID
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton loader

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Filter out products that might have been deleted
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
            // Update the state if some favorites were not found (optional)
            // state.favorites = favoritedProducts.map(p => p.id);
            // saveFavorites();
        } else {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            favoritedProducts.forEach(product => {
                const isFav = true; // All products here are favorites
                const productCard = createProductCardElement(product, isAdmin, isFav); // Use UI function
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites details:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic', {default: 'هەڵەیەک ڕوویدا!'})}</p>`;
    }
}

// --- Profile Management ---

/**
 * Saves user profile data from the form to local storage.
 * (Triggered by event listener in app-logic.js)
 */
export function saveProfile() {
    const nameInput = document.getElementById('profileName');
    const addressInput = document.getElementById('profileAddress');
    const phoneInput = document.getElementById('profilePhone');

    if (!nameInput || !addressInput || !phoneInput) return; // Ensure elements exist

    state.userProfile = {
        name: nameInput.value.trim(),
        address: addressInput.value.trim(),
        phone: phoneInput.value.trim(),
    };
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved', {default: 'زانیارییەکانی پڕۆفایل پاشەکەوتکران'}), 'success');
        closeCurrentPopup(); // Close profile sheet after saving
    } catch (e) {
        console.error("Error saving profile to localStorage:", e);
        showNotification(t('error_saving_profile', {default: 'هەڵە لە پاشەکەوتکردنی پڕۆفایل ڕوویدا.'}), 'error');
    }
}


// --- User Notifications & Policies ---

/**
 * Checks for new announcements and updates the notification badge visibility.
 * Uses Firestore real-time listener.
 */
export function checkNewAnnouncements() {
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
        // Use onSnapshot for real-time updates
        onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const latestAnnouncement = snapshot.docs[0].data();
                const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

                // Show badge if the latest announcement is newer than the last seen one
                showNotificationBadge(latestAnnouncement.createdAt > lastSeenTimestamp);
            } else {
                 showNotificationBadge(false); // Hide badge if no announcements exist
            }
        }, (error) => {
             console.error("Error listening for new announcements:", error);
             // Optionally handle the error, e.g., hide the badge
              showNotificationBadge(false);
        });
    } catch (error) {
         console.error("Error setting up announcement listener:", error);
          showNotificationBadge(false);
    }
}

/**
 * Fetches announcements from Firestore and renders them in the notifications sheet.
 * Updates the last seen timestamp.
 */
export async function renderUserNotifications() {
    const notificationsListContainer = document.getElementById('notificationsListContainer');
    if (!notificationsListContainer) return;

    notificationsListContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('loading_notifications', {default:'...خەریکی بارکردنی ئاگەدارییەکانە'})}</p>`; // Loading state

    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear loading state
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found', {default:'هیچ ئاگەهدارییەک نییە'})}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Keep track of the latest timestamp among fetched announcements
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            const date = new Date(announcement.createdAt);
            // Simple date format, adjust as needed
            const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

            // Get title and content in the current language, falling back to Sorani
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            // Create notification item HTML
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title || t('untitled_notification',{default:'ئاگەداری بێ ناونیشان'})}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content || t('no_content',{default:'بێ ناوەڕۆک'})}</p>
            `;
            notificationsListContainer.appendChild(item);
        });

        // Update last seen timestamp after rendering
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        showNotificationBadge(false); // Hide badge after viewing

    } catch (error) {
        console.error("Error fetching user notifications:", error);
        notificationsListContainer.innerHTML = `<p style="text-align:center; color: var(--danger-color); padding: 20px;">${t('error_generic', {default:'هەڵەیەک ڕوویدا!'})}</p>`;
    }
}

/**
 * Fetches and renders the terms and policies content in the dedicated sheet.
 */
export async function renderPolicies() {
    const termsContentContainer = document.getElementById('termsContentContainer');
    if (!termsContentContainer) return;

    termsContentContainer.innerHTML = `<p>${t('loading_policies', {default:'...خەریکی بارکردنی ڕێساکانە'})}</p>`; // Loading state

    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language, fallback to Sorani, then empty string
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Render content (replace newlines with <br>) or show "not found" message
            termsContentContainer.innerHTML = content
                ? content.replace(/\n/g, '<br>')
                : `<p>${t('no_policies_found', {default: 'هیچ مەرج و ڕێسایەک دانەنراوە.'})}</p>`;
        } else {
            // Document doesn't exist or has no content field
            termsContentContainer.innerHTML = `<p>${t('no_policies_found', {default:'هیچ مەرج و ڕێسایەک دانەنراوە.'})}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p style="color: var(--danger-color);">${t('error_generic', {default: 'هەڵەیەک ڕوویدا!'})}</p>`;
    }
}