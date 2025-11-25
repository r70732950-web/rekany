// cart.js
import { 
    state, 
    t, 
    fetchContactMethods, 
    generateOrderMessageCore, 
    addToCartCore, 
    updateCartQuantityCore, 
    removeFromCartCore 
} from './app-core.js';

import { 
    cartItemsContainer, 
    emptyCartMessage, 
    cartTotal, 
    totalAmount,
    cartActions
} from './app-setup.js';

import { initChatSystem } from './chat.js';
import { showNotification } from './app-ui.js'; 

// نوێکردنەوەی ژمارەی سەر ئایکۆنی سەبەتە
export function updateCartCountUI() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

// پیشاندانی ناوەڕۆکی سەبەتە
export function renderCartUI() {
    if (!cartItemsContainer) return;
    
    cartItemsContainer.innerHTML = '';
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        document.getElementById('cartActions').style.display = 'none';
        return;
    }

    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    document.getElementById('cartActions').style.display = 'block';
    
    renderCartActionButtonsUI(); 

    // --- 1. Pre-calculate Max Shipping per Market ---
    let totalItemPrice = 0;
    const marketMaxMap = {}; // Map to store max shipping cost for each market code

    state.cart.forEach(item => {
        totalItemPrice += (item.price * item.quantity);
        const mCode = item.marketCode || 'default';
        const cost = item.shippingCost || 0;
        
        // Find the highest shipping cost in this market group
        if (marketMaxMap[mCode] === undefined || cost > marketMaxMap[mCode]) {
            marketMaxMap[mCode] = cost;
        }
    });

    // Calculate Total Shipping Sum
    let totalShipping = 0;
    for (const m in marketMaxMap) {
        totalShipping += marketMaxMap[m];
    }
    const finalTotal = totalItemPrice + totalShipping;

    // --- 2. Render Items ---
    // We need to track which markets have already been "charged" so we don't charge twice
    const marketsCharged = new Set(); 

    state.cart.forEach(item => {
        const itemTotal = (item.price * item.quantity); 
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        const itemNameInCurrentLang = (typeof item.name === 'string') 
            ? item.name 
            : ((item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || 'کاڵای بێ ناو');

        // --- LOGIC: Determine if THIS item displays the shipping price or "Free" ---
        const mCode = item.marketCode || 'default';
        let shippingDisplay = '';
        
        // Check if this item's shipping matches the max for the market
        // AND if we haven't already assigned the charge to a previous item in this loop
        const isPayer = (item.shippingCost || 0) === marketMaxMap[mCode] && !marketsCharged.has(mCode);

        if (isPayer && (item.shippingCost > 0)) {
            // ئەم کاڵایە پارەی گەیاندنەکەی دەدرێت
            shippingDisplay = `<span style="font-size:11px; color:#e53e3e;">(+ ${item.shippingCost.toLocaleString()} گەیاندن)</span>`;
            marketsCharged.add(mCode); // Mark this market as charged
        } else {
            // ئەم کاڵایە دەبێتە بێ بەرامبەر (چونکە کاڵایەکی تر پارەکەی داوە یان گەیاندنی نەبووە)
            shippingDisplay = `<span style="font-size:11px; color:#38a169;">(گەیاندن بێ بەرامبەر)</span>`;
        }

        // Market Code Badge
        let marketCodeHtml = '';
        if (item.marketCode) {
            marketCodeHtml = `<span style="font-size: 11px; background-color: #f0f0f0; padding: 2px 6px; border-radius: 4px; margin-right: 5px; color: #555; border: 1px solid #ddd;">🏪 ${item.marketCode}</span>`;
        }

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">
                    ${itemNameInCurrentLang}
                    <div style="margin-top: 4px;">${marketCodeHtml}</div>
                </div>
                <div class="cart-item-price">
                    ${item.price.toLocaleString()} د.ع <span style="font-size:11px; color:#666;">x ${item.quantity}</span>
                    <br>
                    ${shippingDisplay}
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>کۆی کاڵا</div>
                <span style="color:var(--primary-color); font-size:16px;">${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalAmount.textContent = finalTotal.toLocaleString();

    // Listeners
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => handleRemoveFromCartUI(e.currentTarget.dataset.id));
}

// پیشاندانی دوگمەکانی ناردنی داواکاری (Whatsapp, Viber, etc.)
export async function renderCartActionButtonsUI() {
    const container = document.getElementById('cartActions');
    const oldButtons = container.querySelectorAll('.contact-method-btn');
    oldButtons.forEach(btn => btn.remove());

    const methods = await fetchContactMethods(); 

    if (!methods || methods.length === 0) {
        if (container.children.length === 0) {
             container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        }
        return;
    }

    methods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn contact-method-btn'; 
        btn.style.backgroundColor = method.color;

        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessageCore(); 
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

            switch (method.type) {
                case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; 
                case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${value}`; break;
                case 'url': link = value; break; 
            }

            if (link) {
                window.open(link, '_blank');
            }
        };
        container.appendChild(btn);
    });
    
    initChatSystem();
}

// زیادکردن بۆ سەبەتە (UI Logic)
export async function handleAddToCartUI(productId, buttonElement, selectedVariationInfo = null) {
    const result = await addToCartCore(productId, selectedVariationInfo); 
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) {
        updateCartCountUI(); 
        if (buttonElement && !buttonElement.disabled) {
            const originalContent = buttonElement.innerHTML;
            buttonElement.disabled = true;
            buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; 
            setTimeout(() => {
                buttonElement.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; 
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent; 
                    buttonElement.disabled = false;
                }, 1500);
            }, 500);
        }
    }
}

// گۆڕینی ژمارە
export function handleUpdateQuantityUI(productId, change) {
    if (updateCartQuantityCore(productId, change)) { 
        renderCartUI(); 
        updateCartCountUI(); 
    }
}

// سڕینەوە لە سەبەتە
export function handleRemoveFromCartUI(productId) {
    if (removeFromCartCore(productId)) { 
        renderCartUI(); 
        updateCartCountUI(); 
    }
}
