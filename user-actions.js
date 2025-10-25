// user-actions.js - Handles user-specific interactions like cart, favorites, profile

import {
    state, // Global state
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, // Local storage keys
    cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions, // Cart UI elements
    favoritesContainer, emptyFavoritesMessage, // Favorites UI elements
    profileForm, // Profile form element
    sheetCategoriesContainer, // Categories sheet container
    notificationBadge, notificationsListContainer, // Notifications UI
    termsContentContainer, // Terms UI
    // Firestore functions needed
    db, collection, doc, getDoc, setDoc, query, orderBy, getDocs,
} from './app-setup.js';

// Import UI functions needed by user actions
import {
    showNotification,
    t, // Translation function
    renderSkeletonLoader, // For favorites page
    createProductCardElement, // For favorites page
    renderCategoriesSheetContent, // Renders the categories list in the sheet
    renderUserNotifications, // Renders notifications list
    renderPolicies // Renders policies content
    // closeCurrentPopup // *** REMOVED IMPORT ***
} from './ui-manager.js';

// --- Cart Management ---

/** Saves the current cart state to local storage and updates the count badge. */
function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
        updateCartCount();
    } catch (error) {
        console.error("Error saving cart to localStorage:", error);
        showNotification(t('error_saving_cart', { default: 'هەڵە لە پاشەکەوتکردنی سەبەتە ڕوویدا' }), 'error');
    }
}

/** Updates the cart item count displayed in the UI. */
export function updateCartCount() {
    try {
        const totalItems = state.cart.reduce((total, item) => total + (item.quantity || 0), 0);
        // Update all elements with the cart-count class
        document.querySelectorAll('.cart-count').forEach(el => {
            el.textContent = totalItems;
            // Optionally, hide badge if count is 0
            // el.style.display = totalItems > 0 ? 'flex' : 'none';
        });
    } catch (error) {
        console.error("Error updating cart count:", error);
        // Avoid showing notification for this minor UI update failure
    }
}

/**
 * Adds a product to the cart or increments its quantity.
 * @param {string} productId - The ID of the product to add.
 * @param {HTMLElement} [buttonElement] - Optional button element for UI feedback.
 */
export async function addToCart(productId, buttonElement = null) {
    // Find product in already loaded products first
    let product = state.products.find(p => p.id === productId);

    // If not found locally, try fetching from Firestore
    if (!product) {
        console.warn(`Product ${productId} not found locally, fetching...`);
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                showNotification(t('product_not_found_error'), 'error');
                return; // Stop if product doesn't exist
            }
        } catch (error) {
            console.error(`Error fetching product ${productId}:`, error);
            showNotification(t('error_adding_cart'), 'error');
            return;
        }
    }

    // Determine image URL
    const mainImage = (product.imageUrls && product.imageUrls.length > 0)
                     ? product.imageUrls[0]
                     : (product.image || ''); // Use empty string if no image

    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 0) + 1; // Ensure quantity is a number
    } else {
        // Ensure name and price exist before adding
        const productName = product.name || {}; // Default to empty object if name is missing
        const productPrice = product.price ?? 0; // Default to 0 if price is missing

        state.cart.push({
            id: product.id,
            name: productName, // Store the name object
            price: productPrice,
            image: mainImage,
            quantity: 1
        });
    }

    saveCart();
    showNotification(t('product_added_to_cart'));

    // --- UI Feedback for Button ---
    if (buttonElement && !buttonElement.disabled) {
        const originalContent = buttonElement.innerHTML;
        buttonElement.disabled = true;
        buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state

        setTimeout(() => {
            buttonElement.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Added state
            setTimeout(() => {
                // Check if button still exists before resetting
                if (document.body.contains(buttonElement)) {
                    buttonElement.innerHTML = originalContent;
                    buttonElement.disabled = false;
                }
            }, 1500); // Duration of "Added" state
        }, 500); // Duration of "Loading" state
    }
}


/**
 * Updates the quantity of an item in the cart.
 * @param {string} productId - The ID of the product.
 * @param {number} change - Amount to change quantity by (+1 or -1).
 */
function updateQuantity(productId, change) {
    const cartItemIndex = state.cart.findIndex(item => item.id === productId);
    if (cartItemIndex > -1) {
        state.cart[cartItemIndex].quantity += change;
        if (state.cart[cartItemIndex].quantity <= 0) {
            // Remove item if quantity drops to 0 or below
            removeFromCart(productId);
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
function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // Re-render the cart UI
}

/** Renders the items currently in the cart UI. */
export function renderCart() {
    if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return;

    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }

    // Cart has items, update UI accordingly
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Render order buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemQuantity = item.quantity || 0; // Default to 0 if undefined
        const itemPrice = item.price ?? 0; // Default to 0 if undefined
        const itemTotal = itemPrice * itemQuantity;
        total += itemTotal;

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get name in current language, fallback to Sorani, then ID
        const itemName = item.name?.[state.currentLanguage]
                      || item.name?.ku_sorani
                      || item.id; // Fallback to ID if name object missing

        const itemImage = item.image || `https://placehold.co/60x60/e2e8f0/2d3748?text=${t('no_image',{default:'No Img'})}`;

        cartItem.innerHTML = `
            <img src="${itemImage}" alt="${itemName}" class="cart-item-image" loading="lazy" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Error';">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemName}</div>
                <div class="cart-item-price">${itemPrice.toLocaleString()} ${t('currency',{default:'د.ع.'})}</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}" aria-label="${t('increase_quantity',{default:'Increase quantity'})}">+</button>
                    <span class="quantity-text">${itemQuantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}" aria-label="${t('decrease_quantity',{default:'Decrease quantity'})}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('subtotal',{default:'Subtotal'})}</div>
                <span>${itemTotal.toLocaleString()} ${t('currency',{default:'د.ع.'})}</span>
                <button class="cart-item-remove" data-id="${item.id}" aria-label="${t('remove_item',{default:'Remove item'})}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalAmount.textContent = total.toLocaleString(); // Update total display

    // Add event listeners after rendering all items
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => {
        btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1);
    });
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1);
    });
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id);
    });
}


/** Generates the order message string based on cart contents and profile. */
function generateOrderMessage() {
    if (state.cart.length === 0) return "";

    let message = t('order_greeting') + "\n\n"; // "Hello! I need these items:"

    state.cart.forEach(item => {
        const itemName = item.name?.[state.currentLanguage]
                      || item.name?.ku_sorani
                      || t('unnamed_product',{default:'Unnamed Product'});
        const itemDetails = t('order_item_details', {
            price: item.price?.toLocaleString() ?? 'N/A',
            quantity: item.quantity || 0
        }); // "Price: {price} IQD | Quantity: {quantity}"
        message += `- ${itemName} | ${itemDetails}\n`;
    });

    const totalText = totalAmount.textContent || '0'; // Get current total from UI
    message += `\n${t('order_total')}: ${totalText} ${t('currency',{default:'د.ع.'})}\n`; // "Total: {total} IQD"

    // Add user info if available
    const profile = state.userProfile;
    if (profile.name && profile.address && profile.phone) {
        message += `\n${t('order_user_info')}\n`; // "--- Customer Info ---"
        message += `${t('order_user_name')}: ${profile.name}\n`; // "Name: ..."
        message += `${t('order_user_address')}: ${profile.address}\n`; // "Address: ..."
        message += `${t('order_user_phone')}: ${profile.phone}\n`; // "Phone: ..."
    } else {
        message += `\n${t('order_prompt_info')}\n`; // "Please send your details for delivery."
    }
    return message;
}

/** Fetches contact methods from Firestore and renders order buttons. */
async function renderCartActionButtons() {
    if (!cartActions) return;
    cartActions.innerHTML = `<p>${t('loading_order_methods', { default: '...بارکردنی شێوازەکان' })}</p>`; // Loading state

    try {
        const methodsCollectionRef = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollectionRef, orderBy("createdAt")); // Assuming createdAt exists, otherwise order might be needed
        const snapshot = await getDocs(q);

        cartActions.innerHTML = ''; // Clear loading/previous buttons

        if (snapshot.empty) {
            cartActions.innerHTML = `<p>${t('no_order_methods')}</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const method = { id: docSnap.id, ...docSnap.data() };
            const btn = document.createElement('button');
            // Use a generic class and rely on inline style for color
            btn.className = 'whatsapp-btn'; // Reusing class, maybe rename to 'order-action-btn'
            btn.style.backgroundColor = method.color || '#cccccc'; // Default color if missing

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name || method.type}</span>`; // Fallback name to type

            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                if (!value) {
                     showNotification(t('error_contact_method_misconfigured'), 'error');
                     return;
                }

                switch (method.type) {
                    case 'whatsapp':
                        // Ensure number includes country code, remove '+' if present for wa.me
                        const whatsappNumber = value.replace('+', '');
                        link = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                         // Viber link format might need testing
                         const viberNumber = value.includes('+') ? value : `+${value}`; // Ensure '+'
                         // Desktop link vs mobile might differ
                         link = `viber://chat?number=${encodeURIComponent(viberNumber)}`; // Text might not work reliably
                        break;
                    case 'telegram':
                        // Assumes value is the username (without @)
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`;
                        break;
                    case 'url': // For custom URLs (e.g., forms, other apps)
                        link = value; // Assume 'value' is the full URL
                        // Append message if it's a known structure? (e.g., ?message=...) - Risky
                        break;
                    default:
                        showNotification(t('error_unsupported_contact_method'), 'error');
                        return; // Don't open if type is unknown
                }

                if (link) {
                    window.open(link, '_blank');
                }
            };

            cartActions.appendChild(btn);
        });
    } catch (error) {
        console.error("Error fetching/rendering cart action buttons:", error);
        cartActions.innerHTML = `<p>${t('error_loading_order_methods')}</p>`;
    }
}


// --- Favorites Management ---

/** Saves the current favorites list to local storage. */
function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
    } catch (error) {
        console.error("Error saving favorites to localStorage:", error);
        showNotification(t('error_saving_favorites'), 'error');
    }
}

/**
 * Checks if a product ID is in the favorites list.
 * @param {string} productId - The product ID to check.
 * @returns {boolean} True if the product is favorited.
 */
export function isFavorite(productId) {
    // Ensure state.favorites is always an array
    if (!Array.isArray(state.favorites)) {
        state.favorites = [];
    }
    return state.favorites.includes(productId);
}

/**
 * Toggles a product's favorite status.
 * @param {string} productId - The ID of the product.
 * @param {Event} [event] - Optional event object (to stop propagation).
 */
export function toggleFavorite(productId, event = null) {
    if (event) event.stopPropagation(); // Prevent card click if toggling favorite

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error'); // Use 'error' style for removal
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update UI for all cards representing this product
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Assuming icon has fa-heart class
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            favButton.setAttribute('aria-label', isNowFavorite ? t('remove_from_favorites') : t('add_to_favorites'));
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular heart (outline)
        }
    });

    // If the favorites sheet is currently open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage();
    }
}

/** Renders the user's favorite products in the favorites sheet. */
export async function renderFavoritesPage() {
    if (!favoritesContainer || !emptyFavoritesMessage) return;

    favoritesContainer.innerHTML = ''; // Clear previous content

    if (!Array.isArray(state.favorites) || state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none'; // Hide grid container
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Show grid container
    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeletons

    try {
        // Fetch details for each favorited product ID
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeletons

        const favoritedProductsData = productSnaps
            .filter(snap => snap.exists()) // Filter out products that might have been deleted
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProductsData.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // If fetched favorites are empty but local storage wasn't, sync local storage
             if(state.favorites.length > 0) {
                 state.favorites = [];
                 saveFavorites();
             }
        } else {
            favoritedProductsData.forEach(product => {
                // Pass actions needed by the card (toggleFavorite, addToCart, etc.)
                const productCard = createProductCardElement(product, window.appActions);
                favoritesContainer.appendChild(productCard);
            });
             // Sync local storage if some items were not found in Firestore
             if(favoritedProductsData.length !== state.favorites.length) {
                 state.favorites = favoritedProductsData.map(p => p.id);
                 saveFavorites();
             }
        }
    } catch (error) {
        console.error("Error fetching favorites details:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; color: var(--danger-color);">${t('error_fetching_favorites')}</p>`;
        emptyFavoritesMessage.style.display = 'none'; // Hide empty message on error
    }
}


// --- Profile Management ---

/** Saves the user profile data from the form to local storage. */
export function saveProfile() {
    if (!profileForm) return;
    try {
        state.userProfile = {
            name: document.getElementById('profileName')?.value || '',
            address: document.getElementById('profileAddress')?.value || '',
            phone: document.getElementById('profilePhone')?.value || '',
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        window.appActions?.closeCurrentPopup(); // Use global close function *** CHANGED ***
    } catch (error) {
        console.error("Error saving profile:", error);
        showNotification(t('error_saving_profile'), 'error');
    }
}

// --- Other User Actions ---

/** Renders the category list in the categories sheet */
export function renderCategoriesSheet() {
    renderCategoriesSheetContent(window.appActions?.navigateToFilter); // Pass navigation function
}

/** Handles the click on the notification button */
export function handleNotificationClick() {
     // Render function is async, call it directly
     renderUserNotifications(); // Fetch and render content
     window.appActions?.openPopupAndPushState('notificationsSheet', 'sheet'); // Open sheet via app-logic
}

/** Handles the click on the terms button */
export function handleTermsClick() {
     renderPolicies(); // Fetch and render content
     window.appActions?.openPopupAndPushState('termsSheet', 'sheet'); // Open sheet via app-logic
}

/**
 * Handles sharing a product using the Web Share API or copying link.
 * @param {object} product - The product object to share.
 */
export async function shareProduct(product) {
    if (!product) return;

     const nameInCurrentLang = (product.name && product.name[state.currentLanguage])
                           || (product.name && product.name.ku_sorani)
                           || t('unnamed_product');
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`; // Generate product specific URL

    const shareData = {
        title: nameInCurrentLang,
        text: `${t('share_text')}: ${nameInCurrentLang}`, // "Check out this product: ..."
        url: productUrl,
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
            console.log('Product shared successfully');
        } else {
            // Fallback: Copy link to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                 await navigator.clipboard.writeText(productUrl);
                 showNotification(t('product_link_copied'), 'success');
            } else {
                 // Older fallback using execCommand (less reliable)
                 const textArea = document.createElement('textarea');
                 textArea.value = productUrl;
                 textArea.style.position = 'fixed'; // Prevent scrolling
                 textArea.style.opacity = '0';
                 document.body.appendChild(textArea);
                 textArea.select();
                 try {
                     document.execCommand('copy');
                     showNotification(t('product_link_copied'), 'success');
                 } catch (err) {
                     showNotification(t('copy_failed'), 'error');
                 }
                 document.body.removeChild(textArea);
            }
        }
    } catch (err) {
        console.error('Share error:', err);
        // Don't show error if the user cancelled the share action
        if (err.name !== 'AbortError') {
            showNotification(t('share_error'), 'error');
        }
    }
}

