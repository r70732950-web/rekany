// cart.js
// ئەم مۆدیولە هەموو لۆجیکی تایبەت بە سەبەتەی کڕین (Cart) بەڕێوەدەبات.

import { 
    state, 
    CART_KEY, 
    cartItemsContainer, 
    emptyCartMessage, 
    cartTotal, 
    totalAmount, 
    cartActions, 
    db,
    productsCollection
} from './app-setup.js';
import { t } from './utils.js';
import { showNotification } from './ui.js';
import { collection, query, orderBy, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

/**
 * سەبەتەی کڕین لە Local Storage پاشەکەوت دەکات و ژمژێرەی سەبەتە نوێ دەکاتەوە
 */
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

/**
 * ژمارەی سەر ئایکۆنی سەبەتەکە نوێ دەکاتەوە بە کۆی گشتی ژمارەی کاڵاکان
 */
export function updateCartCount() {
    // کۆی گشتی *دانە*ی کاڵاکان، نەک *جۆر*ی کاڵاکان
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // نوێکردنەوەی هەموو ئەو توخمانەی کە ئەم کلاسەیان هەیە
    document.querySelectorAll('.cart-count').forEach(el => { 
        el.textContent = totalItems; 
    });
}

/**
 * کاڵایەک زیاد دەکات بۆ سەبەتەی کڕین
 * @param {string} productId - ئایدی ئەو کاڵایەی کە زیاد دەکرێت
 */
export async function addToCart(productId) {
    // سەرەتا هەوڵدەدەین کاڵاکە لە لیستی کاڵا بارکراوەکان بدۆزینەوە
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        // ئەگەر کاڵاکە لە لیستی ناوخۆیی نەبوو (بۆ نموونە، لە ڕێگەی لینکی ڕاستەوخۆوە کراوەتەوە)
        // هەوڵدەدەین ڕاستەوخۆ لە فایەربەیس بیهێنین
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                console.error("Product not found in Firestore.");
                showNotification(t('product_not_found_error'), 'error');
                return;
            }
        } catch (error) {
            console.error("Error fetching product details:", error);
            showNotification(t('error_generic'), 'error');
            return;
        }
    }

    // وێنەی سەرەکی کاڵاکە دیاری دەکەین
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) 
        ? product.imageUrls[0] 
        : (product.image || 'https://placehold.co/100x100/e2e8f0/2d3748?text=No+Image');
        
    // پشکنین دەکەین بزانین ئایە کاڵاکە پێشتر لە سەبەتەدا هەیە
    const existingItem = state.cart.find(item => item.id === productId);
    
    if (existingItem) {
        // ئەگەر هەبوو، تەنها ژمارەکەی زیاد دەکەین
        existingItem.quantity++;
    } else {
        // ئەگەر نەبوو، وەک کاڵایەکی نوێ زیادی دەکەین
        state.cart.push({ 
            id: product.id, 
            name: product.name, // ناوی وەرگێڕدراو نییە، تەنها ئۆبجێکتی ناوە
            price: product.price, 
            image: mainImage, 
            quantity: 1 
        });
    }
    
    saveCart(); // پاشەکەوتکردن لە Local Storage
    showNotification(t('product_added_to_cart'), 'success');
}

/**
 * ژمارەی کاڵایەک لە سەبەتەدا دەگۆڕێت (زیاد یان کەم)
 * @param {string} productId - ئایدی کاڵا
 * @param {number} change - بڕی گۆڕان (1 بۆ زیادکردن، -1 بۆ کەمکردن)
 */
export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            // ئەگەر ژمارە گەیشتە سفر، کاڵاکە لە سەبەتە لادەبەین
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart(); // سەبەتەکە نوێ دەکەینەوە بۆ پیشاندانی گۆڕانکاری
        }
    }
}

/**
 * کاڵایەک بە تەواوی لە سەبەتە لادەبات
 * @param {string} productId - ئایدی کاڵا
 */
export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // سەبەتەکە نوێ دەکەینەوە
}

/**
 * پەیامی داواکاری (Order Message) دروست دەکات بۆ ناردن
 * @returns {string} - پەیامی ئامادەکراو
 */
// === ÇARESERÎ / FIX ===
// 1. 'export' lê zêde kirin
// 2. Navê fonksiyonê guhertî bo 'generateorderMessage' da ku bi app-logic.js re bigunce
export function generateorderMessage() {
    if (state.cart.length === 0) return "";
    
    let message = t('order_greeting') + "\n\n";
    let currentTotal = 0; // کۆی گشتی لێرەدا هەژمار دەکەینەوە بۆ دڵنیایی
    
    state.cart.forEach(item => {
        // وەرگێڕانی ناوی کاڵا
        const itemName = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { 
            price: item.price.toLocaleString(), 
            quantity: item.quantity 
        });
        message += `- ${itemName} | ${itemDetails}\n`;
        currentTotal += item.price * item.quantity;
    });
    
    message += `\n${t('order_total')}: ${currentTotal.toLocaleString()} د.ع.\n`;

    // زیادکردنی زانیاری پڕۆفایلی بەکارهێنەر ئەگەر هەبێت
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    
    return message;
}

/**
 * دوگمەکانی ناردنی داواکاری (وەک واتسئاپ) لەناو سەبەتەدا دروست دەکات
 */
async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // بەتاڵکردنەوەی پێشوو

    try {
        // ڕێگاکانی ناردن لە فایەربەیس دەهێنین
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // ڕیزکردن بەپێی کاتی دروستکردن
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // هەمان ستایلی پێشوو بەکاردێنین
            btn.style.backgroundColor = method.color; // ڕەنگی تایبەت بە هەر دوگمەیەک

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

            btn.onclick = () => {
                // لێرەدا ناوی نوێی فەنکشنەکە بەکاردێنین
                const message = generateorderMessage();
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // ژمارە یان یوزەرنەیم یان لینک

                // دروستکردنی لینکی گونجاو بەپێی جۆری ڕێگاکە
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`;
                        break;
                    case 'url':
                        link = value; // گریمانە دەکەین کە لینکێکی تەواوە
                        break;
                }

                if (link) {
                    window.open(link, '_blank');
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
        console.error("Error fetching contact methods: ", error);
        container.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

/**
 * ناوەڕۆکی سەبەتەی کڕین لە شاشە پیشان دەدات
 */
export function renderCart() {
    cartItemsContainer.innerHTML = '';
    
    // پشکنین ئەگەر سەبەتە بەتاڵ بێت
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    
    // پیشاندانی بەشە پێویستەکان
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // دروستکردنی دوگمەکانی nardn

    let total = 0;
    // خولانەوە بەناو هەموو کاڵاکانی ناو سەبەتە
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // وەرگێڕانی ناوی کاڵا
        const itemName = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemName}" class="cart-item-image">
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
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
  S });
    
    // نوێکردنەوەی کۆی گشتی نرخ
    totalAmount.textContent = total.toLocaleString();
    
    // زیادکردنی Event Listener بۆ دوگمەکانی ناو سەبەتە
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}
