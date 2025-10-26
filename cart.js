// cart.js: Cart management functions / فەنکشنەکانی بەڕێوەبردنی سەبەتە

import { state, CART_KEY, db, doc, getDoc } from './app-setup.js'; // Import Firestore functions if needed directly
import { t } from './utils.js';
import { showNotification, renderCartActionButtons } from './ui.js'; // Import UI functions used here

/**
 * Saves the current cart state to local storage and updates the cart count badge.
 * پاشەکەوتکردنی دۆخی ئێستای سەبەتە لە local storage و نوێکردنەوەی نیشانەی ژمارەی سەبەتە.
 */
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

/**
 * Updates the cart count badge(s) in the UI based on the total quantity of items in the cart.
 * نوێکردنەوەی نیشانەی ژمارەی سەبەتە لە UI بە پشت بەستن بە کۆی ژمارەی کاڵاکان لە سەبەتەکەدا.
 */
export function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Update all elements with the class 'cart-count'
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

/**
 * Adds a product to the cart by its ID. Fetches product details if not already loaded.
 * زیادکردنی کاڵایەک بۆ سەبەتە بەکارهێنانی ID یەکەی. زانیاری کاڵاکە وەردەگرێت ئەگەر پێشتر بارنەکرابێت.
 * @param {string} productId The ID of the product to add. / ID ی ئەو کاڵایەی زیاد دەکرێت.
 */
export function addToCart(productId) {
    // Find product in the locally stored products list first
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        // If not found locally, fetch details from Firestore
        console.warn(`Product ${productId} not in local state. Fetching details...`);
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                // Add the fetched product to the cart state
                _addItemToCartState({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 });
                saveCart(); // Save updated cart
                showNotification(t('product_added_to_cart')); // Show confirmation
            } else {
                console.error(`Product with ID ${productId} not found in Firestore.`);
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(error => {
            console.error("Error fetching product details for cart:", error);
            showNotification(t('error_generic'), 'error');
        });
        return; // Exit function while fetching
    }

    // Product found in state.products, add it
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    _addItemToCartState({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 });
    saveCart(); // Save updated cart
    // No need for showNotification here as it's handled by the caller in product card click
}

/**
 * Internal helper function to manage the cart state array (add or increment quantity).
 * فەنکشنێکی ناوخۆیی یارمەتیدەر بۆ بەڕێوەبردنی زنجیرەی دۆخی سەبەتە (زیادکردن یان زۆرکردنی ژمارە).
 * @param {object} itemToAdd The item object to add to the cart state. / ئەو ئایتمەی کە بۆ دۆخی سەبەتە زیاد دەکرێت.
 */
function _addItemToCartState(itemToAdd) {
    const existingItem = state.cart.find(item => item.id === itemToAdd.id);
    if (existingItem) {
        // If item already exists, increment its quantity
        existingItem.quantity += itemToAdd.quantity;
    } else {
        // If item is new, add it to the cart array
        state.cart.push(itemToAdd);
    }
}


/**
 * Renders the cart items in the cart sheet UI.
 * پیشاندانی کاڵاکانی ناو سەبەتە لە ڕووکاری بەکارهێنەری پەڕەی سەبەتەدا.
 */
export function renderCart() {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartTotal = document.getElementById('cartTotal');
    const cartActions = document.getElementById('cartActions');
    const totalAmount = document.getElementById('totalAmount');

    cartItemsContainer.innerHTML = ''; // Clear previous items
    if (state.cart.length === 0) {
        // If cart is empty, show empty message and hide total/actions
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    // If cart has items, hide empty message and show total/actions
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Render action buttons (e.g., WhatsApp, Viber)

    let total = 0;
    // Loop through each item in the cart state
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity; // Calculate subtotal for the item
        total += itemTotal; // Add to overall total
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Handle multilingual product names
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                      || (item.name && item.name.ku_sorani) // Fallback to Sorani
                                      || (typeof item.name === 'string' ? item.name : t('product_unnamed', {id: item.id})); // Fallback if name object is missing

        // Set the inner HTML for the cart item element
        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}" aria-label="Increase quantity">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('total_price')}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem); // Add the item element to the container
    });
    // Display the calculated total amount
    totalAmount.textContent = total.toLocaleString();

    // Attach event listeners to the newly created buttons after rendering
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

/**
 * Updates the quantity of a specific item in the cart.
 * نوێکردنەوەی ژمارەی کاڵایەکی دیاریکراو لە سەبەتەکەدا.
 * @param {string} productId The ID of the product to update. / ID ی کاڵاکە.
 * @param {number} change The amount to change the quantity by (e.g., 1 or -1). / بڕی گۆڕانکاری لە ژمارەدا.
 */
export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            // If quantity drops to 0 or less, remove the item
            removeFromCart(productId); // This already saves and re-renders
        } else {
            // Otherwise, save the updated cart and re-render the UI
            saveCart();
            renderCart(); // Re-render to show updated quantity and total
        }
    }
}

/**
 * Removes an item completely from the cart.
 * سڕینەوەی کاڵایەک بەتەواوی لە سەبەتەکەدا.
 * @param {string} productId The ID of the product to remove. / ID ی کاڵاکە.
 */
export function removeFromCart(productId) {
    // Filter out the item with the matching productId
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart(); // Save the modified cart
    renderCart(); // Re-render the cart UI
}

/**
 * Generates a formatted order message string containing cart items and user profile info (if available).
 * دروستکردنی نامەیەکی داواکاری ڕێکخراو کە لیستی کاڵاکانی سەبەتە و زانیاری پڕۆفایلی بەکارهێنەر (ئەگەر هەبێت) لەخۆدەگرێت.
 * @returns {string} The generated order message. / نامەی داواکاری دروستکراو.
 */
export function generateOrderMessage() {
    const totalAmountElement = document.getElementById('totalAmount'); // Get the element displaying the total
    const currentTotalText = totalAmountElement ? totalAmountElement.textContent : '0'; // Get current total text

    if (state.cart.length === 0) return ""; // Return empty if cart is empty

    // Start building the message
    let message = t('order_greeting') + "\n\n";
    // Add details for each item in the cart
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                      || (item.name && item.name.ku_sorani)
                                      || (typeof item.name === 'string' ? item.name : t('product_unnamed', {id: item.id}));
        // Format item details using translation function
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    // Add the total amount
    message += `\n${t('order_total')}: ${currentTotalText} د.ع.\n`;

    // Add user profile information if available
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        // Prompt user to provide info if profile is incomplete
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message; // Return the complete message string
}
