// MODULE: user-actions.js
// Handles user-specific actions like cart management, favorites, profile updates, viewing notifications, etc.

import { db, state, CART_KEY, FAVORITES_KEY, PROFILE_KEY, announcementsCollection } from './app-setup.js';
import { doc, getDoc, collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { t, showNotification, createProductCardElement, formatDescription, renderSkeletonLoader } from './ui-manager.js'; // Import necessary UI functions

// === Cart Management ===

/**
 * Saves the current cart state to localStorage and updates the cart count display.
 */
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

/**
 * Updates the cart item count displayed in the UI.
 */
export function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Update all elements showing the cart count
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

/**
 * Adds a product to the cart or increments its quantity.
 * Fetches product details if not already available in the state.
 * @param {string} productId - The ID of the product to add.
 */
export async function addToCart(productId) {
    // Find product in the currently loaded products first
    let product = state.products.find(p => p.id === productId);

    // If not found, fetch minimal details from Firestore
    if (!product) {
        console.warn(`Product ${productId} not found in local state. Fetching details...`);
        try {
            const productRef = doc(db, "products", productId);
            const docSnap = await getDoc(productRef);
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() }; // Use fetched data
            } else {
                showNotification(t('product_not_found_error'), 'error');
                return; // Stop if product doesn't exist in DB
            }
        } catch (error) {
            console.error("Error fetching product details for cart:", error);
            showNotification(t('error_generic'), 'error');
            return; // Stop on error
        }
    }

    // Prepare item data for the cart
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || ''); // Get primary image
    const productName = product.name; // Keep name as object for multilingual support
    const productPrice = product.price;

    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++; // Increment quantity
    } else {
        // Add new item to cart
        state.cart.push({
            id: product.id,
            name: productName, // Store the name object
            price: productPrice,
            image: mainImage,
            quantity: 1
        });
    }
    saveCart(); // Save updated cart and update UI count
    showNotification(t('product_added_to_cart')); // Show confirmation
}

/**
 * Updates the quantity of an item in the cart. Removes if quantity drops to 0 or less.
 * @param {string} productId - The ID of the product to update.
 * @param {number} change - The amount to change the quantity by (+1 or -1).
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
 * Removes an item completely from the cart.
 * @param {string} productId - The ID of the product to remove.
 */
export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId); // Filter out the item
    saveCart(); // Save changes
    renderCart(); // Re-render the cart UI
}

/**
 * Renders the contents of the shopping cart in the cart sheet.
 */
export function renderCart() {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartTotal = document.getElementById('cartTotal');
    const totalAmount = document.getElementById('totalAmount');
    const cartActions = document.getElementById('cartActions');

    if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return;

    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block'; // Show empty message
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return; // Stop if cart is empty
    }

    // Cart is not empty, hide empty message and show totals/actions
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Render the send order buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get item name in current language or fallback
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('unknown_product'));
        const itemImage = item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'; // Placeholder if no image

        cartItem.innerHTML = `
            <img src="${itemImage}" alt="${itemNameInCurrentLang}" class="cart-item-image" loading="lazy">
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
                <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);

        // Add event listeners for buttons within this item
        cartItem.querySelector('.increase-btn').onclick = () => updateQuantity(item.id, 1);
        cartItem.querySelector('.decrease-btn').onclick = () => updateQuantity(item.id, -1);
        cartItem.querySelector('.cart-item-remove').onclick = () => removeFromCart(item.id);
    });

    totalAmount.textContent = total.toLocaleString(); // Display total price
}


/**
 * Generates the order message string including items and user profile info.
 * @returns {string} The formatted order message.
 */
export function generateOrderMessage() {
    if (state.cart.length === 0) return ""; // Return empty if cart is empty

    let message = t('order_greeting') + "\n\n"; // Start with greeting

    // Add each item details
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('unknown_product'));
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });

    // Add total price
    const totalAmountValue = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    message += `\n${t('order_total')}: ${totalAmountValue.toLocaleString()} د.ع.\n`;

    // Add user profile information if available
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        // Prompt user to add info if missing
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

/**
 * Fetches configured contact methods and renders buttons to send the cart order.
 */
export async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    if (!container) return;
    container.innerHTML = ''; // Clear previous buttons

    try {
        const methodsCollectionRef = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollectionRef, orderBy("createdAt")); // Order might be useful
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<p>${t('no_send_methods')}</p>`; // Assuming key exists
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a more generic class or apply styles directly
            btn.className = 'whatsapp-btn'; // Reusing class, maybe rename later
            btn.style.backgroundColor = method.color; // Set button color

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`; // Set icon and text

            // Set click handler to generate message and open link
            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return; // Don't proceed if message is empty

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                // Construct link based on method type
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber URI scheme might require '+' for international numbers
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; // Needs testing
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Opens dialer
                        break;
                    case 'url':
                        link = value; // Assume 'value' is the full URL
                        break;
                }

                if (link) {
                    window.open(link, '_blank'); // Open the link in a new tab/app
                }
            };

            container.appendChild(btn); // Add button to the container
        });
    } catch (error) {
        console.error("Error fetching/rendering cart action buttons:", error);
        container.innerHTML = `<p>${t('error_loading_send_methods')}</p>`; // Assuming key exists
    }
}


// === Favorites Management ===

/**
 * Saves the current favorites list to localStorage.
 */
export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

/**
 * Checks if a product ID is in the favorites list.
 * @param {string} productId - The product ID to check.
 * @returns {boolean} True if the product is favorited.
 */
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/**
 * Adds or removes a product from the favorites list and updates UI elements.
 * @param {string} productId - The product ID to toggle.
 * @param {Event} [event] - The click event (optional, used for stopping propagation).
 */
export function toggleFavorite(productId, event) {
    if (event) event.stopPropagation(); // Prevent card click when clicking button

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId); // Remove
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId); // Add
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites(); // Persist changes

    // Update heart icons on all matching product cards visible on the page
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Assuming Font Awesome structure
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite; // The new state
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular (outline) heart
        }
    });

    // If the favorites sheet is currently open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage();
    }
}

/**
 * Fetches full product details for favorited items and renders them in the favorites sheet.
 */
export async function renderFavoritesPage() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
    if (!favoritesContainer || !emptyFavoritesMessage) return;

    favoritesContainer.innerHTML = ''; // Clear previous items

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block'; // Show empty message
        favoritesContainer.style.display = 'none'; // Hide grid container
        return;
    }

    // Favorites exist, show container and hide message
    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Use grid layout
    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeletons while loading

    try {
        // Create promises to fetch details for each favorited product ID
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises); // Fetch in parallel

        favoritesContainer.innerHTML = ''; // Clear skeletons

        // Filter out any products that might have been deleted but still in localStorage favorites
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // If all favorited items were deleted
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            // Render product cards for existing favorited items
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product); // Use UI function
                favoritesContainer.appendChild(productCard);
            });
            setupScrollAnimations(); // Apply entrance animations
        }
    } catch (error) {
        console.error("Error fetching favorite product details:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    }
}


// === Profile Management ===

/**
 * Saves the user's profile information from the profile form to localStorage.
 */
export function saveProfile() {
    // This function assumes the form elements exist when called
    state.userProfile = {
        name: document.getElementById('profileName')?.value || '',
        address: document.getElementById('profileAddress')?.value || '',
        phone: document.getElementById('profilePhone')?.value || '',
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
    showNotification(t('profile_saved'), 'success');
    closeCurrentPopup(); // Close the profile sheet after saving
}


// === Notifications & Policies (User-facing rendering) ===

/**
 * Checks for new announcements and updates the notification badge indicator.
 */
export function checkNewAnnouncements() {
    // This might be better handled by a listener in app-core if real-time update is needed,
    // but for badge check on load/sheet open, this is okay here.
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    getDocs(q).then(snapshot => { // Using getDocs for a one-time check
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block'; // Show badge if new announcement exists
            } else {
                notificationBadge.style.display = 'none'; // Hide badge if up-to-date
            }
        } else {
            notificationBadge.style.display = 'none'; // Hide if no announcements ever
        }
    }).catch(error => {
        console.error("Error checking new announcements:", error);
        notificationBadge.style.display = 'none'; // Hide badge on error
    });
}

/**
 * Fetches and renders the list of announcements for the user in the notifications sheet.
 */
export async function renderUserNotifications() {
    const notificationsListContainer = document.getElementById('notificationsListContainer');
    if (!notificationsListContainer) return;

    notificationsListContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('loading_notifications')}</p>`; // Assuming key exists

    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc")); // Get all, newest first
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear loading message
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Track the latest timestamp to update localStorage later
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            // Format date
            const date = new Date(announcement.createdAt);
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`; // Simple YYYY/M/D format

            // Get title and content in current language or fallback
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            // Create notification item element
            const item = document.createElement('div');
            item.className = 'notification-item'; // Apply styling
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p>
            `;
            notificationsListContainer.appendChild(item);
        });

        // Update last seen timestamp and hide badge after viewing
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        notificationBadge.style.display = 'none';

    } catch (error) {
        console.error("Error fetching user notifications:", error);
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-exclamation-circle"></i><p>${t('error_generic')}</p></div>`;
    }
}

/**
 * Fetches and renders the terms and policies content in the dedicated sheet.
 */
export async function renderPolicies() {
    const termsContentContainer = document.getElementById('termsContentContainer');
    if (!termsContentContainer) return;

    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Show loading message

    try {
        const docRef = doc(db, "settings", "policies"); // Path to policies document
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language or fallback to Sorani, then empty string
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Render content, replacing newlines with <br>, or show 'not found' message
            termsContentContainer.innerHTML = content ? formatDescription(content) : `<p>${t('no_policies_found')}</p>`;
        } else {
            // Document doesn't exist or has no content field
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Show generic error on failure
    }
}

/**
 * Renders the category list inside the "Choose Category" bottom sheet.
 */
export function renderCategoriesSheet() {
    const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn'; // Apply styling
        btn.dataset.category = cat.id; // Store category ID

        // Highlight if this is the currently active category
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        // Get category name (handle 'all' case)
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Add icon and name

        // Set click handler to filter and close the sheet
        btn.onclick = async () => {
            await navigateToFilter({ // navigateToFilter from app-core
                category: cat.id,
                subcategory: 'all', // Reset subcategory when selecting from sheet
                subSubcategory: 'all',
                search: '' // Clear search
            });
            closeCurrentPopup(); // Close the sheet (from ui-manager)
            showPage('mainPage'); // Ensure main page is shown (from ui-manager)
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}