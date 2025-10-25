// user-actions.js - Handles user-specific actions like cart, favorites, profile, notifications.
import {
    db, state, translations, CART_KEY, FAVORITES_KEY, PROFILE_KEY, // State and constants
    cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions, // Cart UI
    favoritesContainer, emptyFavoritesMessage, // Favorites UI
    sheetCategoriesContainer, // Categories Sheet UI
    notificationsListContainer, notificationBadge, // Notifications UI
    termsContentContainer, // Terms UI
} from './app-setup.js';

import { // Import UI functions needed
    t, showNotification, formatDescription, closeCurrentPopup, updateActiveNav, renderCategoriesSheet as renderCategoriesSheetUI // Rename to avoid conflict
} from './ui-manager.js';

import {
    getDoc, doc, collection, query, orderBy, getDocs, setDoc // Firestore functions
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Cart Management ---

/**
 * Saves the current cart state to localStorage and updates the count badge.
 */
function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
        updateCartCount();
    } catch (e) {
        console.error("Error saving cart to localStorage:", e);
        showNotification(t('error_saving_cart', { default: 'هەڵە لە پاشەکەوتکردنی سەبەتە ڕوویدا' }), 'error');
    }
}

/**
 * Updates the cart count badge(s) in the UI.
 */
export function updateCartCount() {
    try {
        const totalItems = state.cart.reduce((total, item) => total + (item.quantity || 0), 0);
        document.querySelectorAll('.cart-count').forEach(el => {
            el.textContent = totalItems;
            el.style.display = totalItems > 0 ? 'flex' : 'none'; // Show/hide badge
        });
    } catch (e) {
        console.error("Error updating cart count:", e);
    }
}

/**
 * Adds a product to the cart or increments its quantity.
 * @param {string} productId - The ID of the product to add.
 * @param {HTMLElement} [buttonElement] - Optional button element for UI feedback.
 */
export async function addToCart(productId, buttonElement) {
    try {
        const existingItemIndex = state.cart.findIndex(item => item.id === productId);

        if (existingItemIndex > -1) {
            state.cart[existingItemIndex].quantity++;
        } else {
            // Fetch product details if not already in cart
            const productRef = doc(db, "products", productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                const product = { id: productSnap.id, ...productSnap.data() };
                const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
                state.cart.push({
                    id: product.id,
                    name: product.name, // Keep the name object
                    price: product.price,
                    image: mainImage,
                    quantity: 1
                });
            } else {
                console.error(`Product with ID ${productId} not found in Firestore.`);
                showNotification(t('product_not_found_error'), 'error');
                return; // Stop if product doesn't exist
            }
        }

        saveCart();
        showNotification(t('product_added_to_cart'));

        // UI Feedback on button
        if (buttonElement && !buttonElement.disabled) {
            const originalContent = buttonElement.innerHTML;
            buttonElement.disabled = true;
            buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state
            setTimeout(() => {
                buttonElement.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Added state
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent; // Revert state
                    buttonElement.disabled = false;
                }, 1500);
            }, 500);
        }

    } catch (error) {
        console.error("Error adding to cart:", error);
        showNotification(t('error_adding_cart', { default: 'هەڵە لە زیادکردنی بۆ سەبەتە ڕوویدا' }), 'error');
         // Re-enable button on error
         if (buttonElement) {
            buttonElement.disabled = false;
            // Optionally revert content immediately or after a short delay
            // buttonElement.innerHTML = originalContent;
         }
    }
}

/**
 * Updates the quantity of an item in the cart. Removes if quantity <= 0.
 * @param {string} productId - The ID of the product to update.
 * @param {number} change - The change in quantity (+1 or -1).
 */
export function updateQuantity(productId, change) {
    const itemIndex = state.cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        state.cart[itemIndex].quantity += change;
        if (state.cart[itemIndex].quantity <= 0) {
            removeFromCart(productId); // Remove if quantity is zero or less
        } else {
            saveCart();
            renderCart(); // Re-render the cart UI
        }
    }
}

/**
 * Removes an item completely from the cart.
 * @param {string} productId - The ID of the product to remove.
 */
export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // Re-render the cart UI
}

/**
 * Renders the contents of the cart sheet.
 */
export function renderCart() {
    if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return;

    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }

    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Fetch and render action buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = (item.price || 0) * (item.quantity || 0); // Handle potential missing price/qty
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get name in current language, fallback to Sorani, then handle potential string name
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                    || (item.name && item.name.ku_sorani)
                                    || (typeof item.name === 'string' ? item.name : t('unnamed_product', {default: 'کاڵای بێ ناو'}));

        const placeholderImg = "https://placehold.co/60x60/e2e8f0/2d3748?text=N/A";

        cartItem.innerHTML = `
            <img src="${item.image || placeholderImg}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='${placeholderImg}'">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${(item.price || 0).toLocaleString()} ${t('currency', {default:'د.ع.'})}</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}" aria-label="${t('increase_quantity', {default:'Increase Quantity'})}">+</button>
                    <span class="quantity-text">${item.quantity || 0}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}" aria-label="${t('decrease_quantity', {default:'Decrease Quantity'})}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('subtotal', {default:'Subtotal'})}:</div>
                <span>${itemTotal.toLocaleString()} ${t('currency', {default:'د.ع.'})}</span>
                <button class="cart-item-remove" data-id="${item.id}" aria-label="${t('remove_item', {default:'Remove Item'})}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalAmount.textContent = total.toLocaleString(); // Update total display

    // Re-attach event listeners for quantity and remove buttons
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

/**
 * Generates the order message string based on cart contents and user profile.
 * @returns {string} The formatted order message.
 */
function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                    || (item.name && item.name.ku_sorani)
                                    || (typeof item.name === 'string' ? item.name : t('unnamed_product', {default: 'کاڵای بێ ناو'}));
        const itemDetails = t('order_item_details', { price: (item.price || 0).toLocaleString(), quantity: (item.quantity || 0) });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    const currentTotal = state.cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    message += `\n${t('order_total')}: ${currentTotal.toLocaleString()} ${t('currency', {default: 'د.ع.'})}\n`;

    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`; // Prompt user to add info
    }
    return message;
}

/**
 * Fetches contact methods from Firestore and renders action buttons in the cart.
 */
async function renderCartActionButtons() {
    if (!cartActions) return;
    cartActions.innerHTML = ''; // Clear previous buttons

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Assuming order is needed
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            cartActions.innerHTML = `<p>${t('no_order_methods', { default: 'هیچ ڕێگایەک بۆ ناردنی داواکاری دیاری نەکراوە.' })}</p>`;
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a generic class and rely on inline style for color
            btn.className = 'action-btn'; // Consider a more descriptive class like 'order-method-btn'
            btn.style.backgroundColor = method.color || 'var(--primary-color)'; // Default color
            btn.style.color = 'white'; // Assume white text works for most colors
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.gap = '8px';
            btn.style.padding = '10px';
            btn.style.borderRadius = '6px';
            btn.style.fontWeight = 'bold';
            btn.style.cursor = 'pointer';
            btn.style.marginTop = '10px';
            btn.style.width = '100%';
            btn.style.border = 'none';


            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani || method.type; // Fallback to type
            const icon = method.icon || 'fas fa-paper-plane'; // Default icon

            btn.innerHTML = `<i class="${icon}"></i> <span>${name}</span>`;

            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                if (!value) {
                    console.error(`Contact method '${name}' is missing a value.`);
                    showNotification(t('error_contact_method_misconfigured', { default: 'هەڵە لە ڕێکخستنی شێوازی پەیوەندی.'}), 'error');
                    return;
                }

                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber link for initiating chat with text (might not work reliably on all platforms/desktop)
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                         // Fallback or alternative link if needed:
                         // link = `viber://add?number=${value}`; // Just adds contact
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`;
                        break;
                    case 'url': // Assumes 'value' is a full, valid URL
                        link = value; // Needs careful configuration in admin panel
                        break;
                    default:
                         console.warn(`Unsupported contact method type: ${method.type}`);
                         showNotification(t('error_unsupported_contact_method', { default: 'شێوازی پەیوەندی نەناسراوە.' }), 'error');
                         return; // Don't try to open a link
                }

                if (link) {
                    window.open(link, '_blank');
                    // Optionally clear cart after sending?
                    // state.cart = [];
                    // saveCart();
                    // renderCart();
                    // closeCurrentPopup(); // Close cart after sending
                }
            };

            cartActions.appendChild(btn);
        });
    } catch (error) {
        console.error("Error fetching or rendering cart action buttons:", error);
        cartActions.innerHTML = `<p>${t('error_loading_order_methods', { default: 'هەڵە لە بارکردنی شێوازەکانی داواکاری.' })}</p>`;
    }
}


// --- Favorites Management ---

/**
 * Saves the current favorites list to localStorage.
 */
function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites || []));
    } catch (e) {
        console.error("Error saving favorites to localStorage:", e);
        showNotification(t('error_saving_favorites', { default: 'هەڵە لە پاشەکەوتکردنی دڵخوازەکان ڕوویدا' }), 'error');
    }
}

/**
 * Checks if a product ID is in the favorites list.
 * @param {string} productId - The ID to check.
 * @returns {boolean} True if the product is a favorite.
 */
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/**
 * Adds or removes a product from the favorites list and updates UI.
 * @param {string} productId - The ID of the product.
 * @param {Event} [event] - Optional event object to stop propagation.
 */
export function toggleFavorite(productId, event) {
    if (event) event.stopPropagation(); // Prevent card click when toggling favorite

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites')); // Use default type (success) or specify 'info'?
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update heart icon on all cards for this product
    document.querySelectorAll(`.product-card[data-product-id="${productId}"]`).forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = favButton?.querySelector('.fa-heart'); // Query within button
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
            heartIcon.classList.toggle('far', !isNowFavorite); // Outline heart
            // Update aria-label for accessibility
            favButton.setAttribute('aria-label', isNowFavorite ? t('remove_from_favorites', {default: 'Remove from Favorites'}) : t('add_to_favorites', {default: 'Add to Favorites'}));
        }
    });

    // Re-render favorites page if it's currently open
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage(); // Assumes actions needed by card are available
    }
}

/**
 * Renders the favorites page/sheet content.
 * Requires product card actions to be passed or globally available.
 */
export async function renderFavoritesPage() {
    if (!favoritesContainer || !emptyFavoritesMessage) return;

    favoritesContainer.innerHTML = ''; // Clear previous

    if (!state.favorites || state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Use grid layout

    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeletons

    try {
        // Fetch details for all favorited products
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeletons

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Filter out products that might have been deleted
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // Update state if fetched count differs from stored count (due to deleted products)
             if (favoritedProducts.length !== state.favorites.length) {
                 state.favorites = favoritedProducts.map(p => p.id);
                 saveFavorites();
             }
        } else {
             // Assume actions are available globally or passed down
             const actions = window.appActions; // Placeholder
             if (!actions) {
                 console.error("Product card actions not available for rendering favorites.");
                 favoritesContainer.innerHTML = `<p>${t('error_generic')}</p>`;
                 return;
             }
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product, actions); // Use UI function
                 if (productCard) favoritesContainer.appendChild(productCard);
            });
             setupScrollAnimations(); // Apply animations
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_fetching_favorites', {default: 'هەڵە لە هێنانی دڵخوازەکان ڕوویدا.'})}</p>`;
         emptyFavoritesMessage.style.display = 'none'; // Ensure empty message is hidden on error
         favoritesContainer.style.display = 'block'; // Ensure container is visible for error message
    }
}

// --- Profile Management ---

/**
 * Saves the user's profile information from the form to localStorage.
 */
export function saveProfile() {
    try {
        state.userProfile = {
            name: document.getElementById('profileName')?.value || '',
            address: document.getElementById('profileAddress')?.value || '',
            phone: document.getElementById('profilePhone')?.value || '',
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup(); // Close the profile sheet after saving
    } catch (error) {
        console.error("Error saving profile:", error);
        showNotification(t('error_saving_profile', { default: 'هەڵە لە پاشەکەوتکردنی پڕۆفایل ڕوویدا' }), 'error');
    }
}


// --- Notifications & Policies Rendering ---

/**
 * Fetches and renders user notifications (announcements) in the sheet.
 */
export async function renderUserNotifications() {
    if (!notificationsListContainer) return;
    notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-spinner fa-spin"></i><p>${t('loading_notifications', {default:'...بارکردنی ئاگەدارییەکان'})}</p></div>`; // Loading state

    try {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear loading state
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            if (notificationBadge) notificationBadge.style.display = 'none'; // Hide badge if empty
            localStorage.setItem('lastSeenAnnouncementTimestamp', Date.now()); // Mark as seen even if empty
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            const date = new Date(announcement.createdAt);
            // Simple date format (YYYY/MM/DD)
            const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${formatDescription(content)}</p> <!-- Use formatter for links/newlines -->
            `;
            notificationsListContainer.appendChild(item);
        });

        // Mark the latest timestamp as seen and hide the badge
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        if (notificationBadge) notificationBadge.style.display = 'none';

    } catch (error) {
        console.error("Error fetching user notifications:", error);
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-exclamation-circle"></i><p>${t('error_loading_notifications', {default:'هەڵە لە بارکردنی ئاگەدارییەکان'})}</p></div>`;
        if (notificationBadge) notificationBadge.style.display = 'none'; // Hide badge on error too
    }
}

/**
 * Fetches and renders the terms and policies content in the sheet.
 */
export async function renderPolicies() {
    if (!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Loading state

    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage] || policies.ku_sorani || ''; // Fallback to Sorani
            // Use formatDescription to handle potential links and ensure proper line breaks
            termsContentContainer.innerHTML = content ? formatDescription(content) : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_loading_policies', {default: 'هەڵە لە بارکردنی ڕێساکان.'})}</p>`;
    }
}

/**
 * Renders the list of categories in the categories bottom sheet.
 * Requires `MapsToFilter` function from app-logic.
 */
export function renderCategoriesSheetContent(navigateToFilter) {
    // This uses the renamed UI function
    renderCategoriesSheetUI(navigateToFilter);
}

// Helper function to check for new announcements and show badge
// (Called from app-logic during initialization)
export function checkNewAnnouncements() {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(1));
     // Use getDocs instead of onSnapshot if you only need to check on load/refresh
     getDocs(q).then(snapshot => {
         if (!snapshot.empty) {
             const latestAnnouncement = snapshot.docs[0].data();
             const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

             if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                 if (notificationBadge) notificationBadge.style.display = 'block';
             } else {
                 if (notificationBadge) notificationBadge.style.display = 'none';
             }
         } else {
             if (notificationBadge) notificationBadge.style.display = 'none'; // No announcements at all
         }
     }).catch(error => {
         console.error("Error checking new announcements:", error);
         if (notificationBadge) notificationBadge.style.display = 'none'; // Hide badge on error
     });
}
