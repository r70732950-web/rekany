// cart.js
import { 
    state, 
    t, 
    fetchContactMethods, 
    generateOrderMessageCore, 
    addToCartCore, 
    updateCartQuantityCore, 
    removeFromCartCore,
    calculateCartTotals // <--- زیاد کراوە
} from './app-core.js';

import { 
    cartItemsContainer, 
    emptyCartMessage, 
    cartTotal, 
    totalAmount 
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
    
    // پشکنین ئەگەر سەبەتە بەتاڵ بێت
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

    // --- گۆڕانکاری: بەکارهێنانی فەنکشنی نوێ بۆ حیسابکردن ---
    const totals = calculateCartTotals(); 
    // ----------------------------------------------------

    state.cart.forEach(item => {
        // لێرەدا تەنها نرخی کاڵاکە و ژمارەکەی حیساب دەکەین بۆ پیشاندان لەسەر کارتەکە
        // نرخی گەیاندن لێرە کۆ ناکەینەوە چونکە لە کۆتاییدا بەپێی مارکێت حیساب دەکرێت
        const itemLineTotal = (item.price * item.quantity);
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        const itemNameInCurrentLang = (typeof item.name === 'string') 
            ? item.name 
            : ((item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || 'کاڵای بێ ناو');

        // پیشاندانی زانیاری گەیاندن تەنها وەک زانیاری (نەک بۆ کۆکردنەوە)
        let shippingInfoDisplay = '';
        if (item.shippingCost > 0) {
            shippingInfoDisplay = `<div style="font-size:11px; color:#888;">(گەیاندن: ${item.shippingCost.toLocaleString()})</div>`;
        } else {
            shippingInfoDisplay = `<div style="font-size:11px; color:#38a169;">(گەیاندن بێ بەرامبەر)</div>`;
        }

        // --- [MARKET CODE DISPLAY] ---
        let marketCodeHtml = '';
        if (item.marketCode) {
            marketCodeHtml = `<span style="font-size: 11px; background-color: #e2e8f0; padding: 2px 8px; border-radius: 4px; color: #2d3748; font-weight: bold; display:inline-block; margin-top:4px;">🏪 ${item.marketCode}</span>`;
        }
        // -----------------------------

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">
                    ${itemNameInCurrentLang}
                    <div>${marketCodeHtml}</div>
                </div>
                <div class="cart-item-price">
                    ${item.price.toLocaleString()} د.ع <span style="font-size:11px; color:#666;">x ${item.quantity}</span>
                    ${shippingInfoDisplay}
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>کۆی کاڵا</div>
                <span style="color:var(--primary-color); font-size:16px;">${itemLineTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    // نوێکردنەوەی نرخی کۆتایی بەپێی حیساباتە نوێیەکە (کاڵا + گەیاندنی مارکێت)
    totalAmount.textContent = totals.grandTotal.toLocaleString();

    // Event Listeners
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
