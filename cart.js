// cart.js
import { showNotification } from './ui.js';
import { db } from './firebase.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const CART_KEY = "maten_store_cart";
let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
let contactMethods = [];

async function loadContactMethods() {
    if (contactMethods.length > 0) return;
    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt"));
        const snapshot = await getDocs(q);
        contactMethods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error loading contact methods:", error);
    }
}

export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

export function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
        cartCountEl.textContent = totalItems;
        cartCountEl.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

export function addToCart(product, t) {
    if (!product) {
        showNotification(t('product_not_found_error'), 'error');
        return;
    }
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
        cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 });
    }
    saveCart();
    showNotification(t('product_added_to_cart'));
}

function removeFromCart(productId, t, currentLanguage, userProfile) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(t, currentLanguage, userProfile);
}

function updateQuantity(productId, change, t, currentLanguage, userProfile) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId, t, currentLanguage, userProfile);
        } else {
            saveCart();
            renderCart(t, currentLanguage, userProfile);
        }
    }
}

function generateOrderMessage(t, currentLanguage, userProfile) {
    let message = t('order_greeting') + "\n\n";
    let total = 0;
    cart.forEach(item => {
        const itemName = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || 'کاڵای بێ ناو';
        message += `- ${itemName} | ${t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity })}\n`;
        total += item.price * item.quantity;
    });
    message += `\n${t('order_total')}: ${total.toLocaleString()} د.ع.\n`;

    if (userProfile.name && userProfile.address && userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${userProfile.name}\n`;
        message += `${t('order_user_address')}: ${userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

function renderCartActionButtons(t, currentLanguage, userProfile) {
    const container = document.getElementById('cartActions');
    container.innerHTML = '';
    if (contactMethods.length === 0) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    contactMethods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn';
        btn.style.backgroundColor = method.color;
        const name = method['name_' + currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessage(t, currentLanguage, userProfile);
            if (!message) return;
            const encodedMessage = encodeURIComponent(message);
            let link = '';
            switch (method.type) {
                case 'whatsapp': link = `https://wa.me/${method.value}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${method.value}&text=${encodedMessage}`; break;
                case 'telegram': link = `https://t.me/${method.value}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${method.value}`; break;
                case 'url': link = method.value; break;
            }
            if (link) window.open(link, '_blank');
        };
        container.appendChild(btn);
    });
}

export async function renderCart(t, currentLanguage, userProfile) {
    await loadContactMethods();
    
    const container = document.getElementById('cartItemsContainer');
    container.innerHTML = '';
    const emptyMsg = document.getElementById('emptyCartMessage');
    const cartTotalEl = document.getElementById('cartTotal');
    const cartActionsEl = document.getElementById('cartActions');

    if (cart.length === 0) {
        emptyMsg.style.display = 'block';
        cartTotalEl.style.display = 'none';
        cartActionsEl.style.display = 'none';
        return;
    }
    emptyMsg.style.display = 'none';
    cartTotalEl.style.display = 'block';
    cartActionsEl.style.display = 'block';

    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
        const itemName = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || 'کاڵای بێ ناو';
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="${item.image}" alt="${itemName}" class="cart-item-image" onerror="this.onerror=null;this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=X';">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemName}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('total_price')}</div>
                <span>${(item.price * item.quantity).toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        container.appendChild(itemEl);
    });

    document.getElementById('totalAmount').textContent = total.toLocaleString();

    container.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = () => updateQuantity(btn.dataset.id, 1, t, currentLanguage, userProfile));
    container.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = () => updateQuantity(btn.dataset.id, -1, t, currentLanguage, userProfile));
    container.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = () => removeFromCart(btn.dataset.id, t, currentLanguage, userProfile));

    renderCartActionButtons(t, currentLanguage, userProfile);
}