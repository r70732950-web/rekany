// product.js
// ئەم مۆدیولە بەرپرسە لە دروستکردن و پیشاندانی توخمەکانی کاڵا و وردەکارییەکانیان.

import { 
    state, 
    db, 
    productsCollection, 
    productDetailSheet,
    sheetImageContainer,
    sheetThumbnailContainer,
    sheetPrevBtn,
    sheetNextBtn,
    sheetProductName,
    sheetProductDescription,
    sheetProductPrice,
    sheetAddToCartBtn,
    relatedProductsSection,
    relatedProductsContainer
} from './app-setup.js';
import { t, formatDescription } from './utils.js';
import { openPopup, showNotification } from './ui.js';
import { addToCart } from './cart.js';
// دڵنیا دەبینەوە کە 'favorites.js' پێشتر 'load' بووە
import { isFavorite } from './favorites.js'; 
import { getDocs, getDoc, doc, query, where, limit, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

/**
 * سکێلێتۆن لۆدەر (Skeleton Loader) بۆ چاوەڕوانیکردن دروست دەکات
 * @param {HTMLElement} container - ئەو شوێنەی کە سکێلێتۆنەکانی تێدا پیشان دەدرێت
 * @param {number} [count=8] - ژمارەی ئەو سکێلێتۆنانەی کە دروست دەکرێن
 */
export function renderSkeletonLoader(container, count = 8) {
    container.innerHTML = ''; // بەتاڵکردنەوەی شوێنەکە
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // دڵنیابوونەوە لەوەی کە بە شێوەی 'grid' پیشان دەدرێت
    
    // ئەگەر ئەمە لۆدەری سەرەکی بێت، ئەوا کۆنتەینەری کاڵاکان بشارەوە
    if (container.id === 'skeletonLoader') {
      document.getElementById('productsContainer').style.display = 'none';
      document.getElementById('loader').style.display = 'none';
    }
}

/**
 * توخمێکی HTMLی کارتی کاڵا دروست دەکات (بەبێ Event Listeners)
 * @param {Object} product - ئۆبجێکتی زانیاری کاڵا
 * @returns {HTMLElement} - توخمی HTMLی کارتی کاڵا
 */
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // دانانی ئایدی کاڵا بۆ بەکارهێنان لە event delegation

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // وەرگێڕانی ناو
    const name = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    // دۆزینەوەی وێنەی سەرەکی
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // لۆجیکی داشکاندن و نرخ
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // زانیاری گەیاندن
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>
        `;
    }

    // پشکنینی دۆخی دڵخواز (Favorite)
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // دروستکردنی HTMLی تەواوی کارتەکە
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${name}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
             <!-- دوگمەی دڵخوازەکان لەگەڵ data-action -->
             <button class="${favoriteBtnClass}" aria-label="Add to favorites" data-action="toggle-favorite">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
            <!-- دوگمەی هاوبەشیپێکردن لەگەڵ data-action -->
            <button class="share-btn-card" aria-label="Share product" data-action="share-product">
                <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${name}</div>
            ${priceHTML}
            <!-- دوگمەی زیادکردن بۆ سەبەتە لەگەڵ data-action -->
            <button class="add-to-cart-btn-card" data-action="add-to-cart">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <!-- دوگمەکانی ئەدمین لەگەڵ data-action -->
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product" data-action="edit-product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product" data-action="delete-product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // زیادکردنی کلاس بۆ ئەنیمەیشن
    productCard.classList.add('product-card-reveal');

    return productCard;
}

/**
 * کاڵا پەیوەندیدارەکان (Related Products) دەهێنێت و لەناو لاپەڕەی وردەکاری پیشانیان دەدات
 * @param {Object} currentProduct - کاڵای ئێستا، بۆ دۆزینەوەی هاوشێوەکانی
 */
export async function renderRelatedProducts(currentProduct) {
    relatedProductsContainer.innerHTML = '';
    relatedProductsSection.style.display = 'none';

    // ئەگەر کاڵاکە هیچ جۆرێکی نەبێت، ناتوانین هاوشێوەی بۆ بدۆزینەوە
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return;
    }

    let q;
    // هەوڵدەدەین لە وردترین جۆرەوە (sub-sub-category) بگەڕێین
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // دڵنیابوونەوە لەوەی هەمان کاڵا نایەتەوە
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        // ئەگەر نا، لە جۆری لاوەکی (sub-category) دەگەڕێین
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else {
        // ئەگەر نا، لە جۆری سەرەکی (main-category) دەگەڕێین
        q = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("هیچ کاڵایەکی هاوشێوە نەدۆزرایەوە.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // لێرەدا createProductCardElement بەکاردێنین بۆ دروستکردنی کارتەکان
            // Event listenerەکان بە شێوەی 'delegation' لە app-logic.jsەوە کار دەکەن
            const card = createProductCardElement(product);
            relatedProductsContainer.appendChild(card);
        });

        relatedProductsSection.style.display = 'block'; // پیشاندانی بەشی کاڵا هاوشێوەکان

    } catch (error) {
        console.error("هەڵە لە هێنانی کاڵا هاوشێوەکان:", error);
    }
}

/**
 * لاپەڕەی وردەکاریی کاڵا (bottom sheet) پڕ دەکاتەوە و پیشانی دەدات
 * @param {Object} product - ئۆبجێکتی زانیاری کاڵا
 */
export function showProductDetailsWithData(product) {
    // سکڕۆڵکردن بۆ سەرەوەی شییتەکە
    const sheetContent = productDetailSheet.querySelector('.sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    // وەرگێڕانی ناو و وەسف
    const name = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const description = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // بەتاڵکردنەوە و پڕکردنەوەی سلایدەری وێنەکان
    sheetImageContainer.innerHTML = '';
    sheetThumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = name;
            if (index === 0) img.classList.add('active'); // یەکەم وێنە چالاک دەبێت
            sheetImageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            sheetThumbnailContainer.appendChild(thumb);
        });
    }

    let currentIndex = 0;
    const images = sheetImageContainer.querySelectorAll('img');
    const thumbnails = sheetThumbnailContainer.querySelectorAll('.thumbnail');

    // فەنکشنی ناوخۆیی بۆ گۆڕینی وێنەی سلایدەر
    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return;
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    // پیشاندانی دوگمەکانی سلایدەر تەنها ئەگەر زیاتر لە وێنەیەک هەبێت
    const showSliderButtons = imageUrls.length > 1;
    sheetPrevBtn.style.display = showSliderButtons ? 'flex' : 'none';
    sheetNextBtn.style.display = showSliderButtons ? 'flex' : 'none';

    // لکاندنی Event Listener تەنها بە توخمەکانی ناو ئەم شییتە
    sheetPrevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    sheetNextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    // پڕکردنەوەی زانیارییەکانی تر
    sheetProductName.textContent = name;
    sheetProductDescription.innerHTML = formatDescription(description);

    // پڕکردنەوەی نرخ (لەگەڵ داشکاندن ئەگەر هەبێت)
    if (product.originalPrice && product.originalPrice > product.price) {
        sheetProductPrice.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        sheetProductPrice.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // دوگمەی زیادکردن بۆ سەبەتە (تایبەت بەم شییتە)
    sheetAddToCartBtn.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    sheetAddToCartBtn.onclick = ()H => {
        addToCart(product.id);
        // لێرەدا closeCurrentPopup بانگ ناکەین، بەڵکو لە app-logic.jsەوە بانگی دەکەین
        // بەڵام بۆ سادەیی، وا باشترە لێرە بانگی بکەین
        // نا، با لە ui.js بانگی بکەین
        // بۆ ئەمجارە، با لە app-logic.js بانگ بکرێت
        // باشترین ڕێگە ئەوەیە کە فەنکشنێک لە ui.js هەبێت بۆ داخستن
        
        // لەبەر ئەوەی ui.js فەنکشنی closeCurrentPopupی تێدایە، دەتوانین لێرە بانگی بکەین
        // بەڵام ui.js ئەم فەنکشنە import ناکات
        // باشە، با وازی لێ بێنین. فەنکشنی داخستن لە app-logic.js جێبەجێ دەکرێت
        
        // چاکسازی: addToCart تەنها زیاد دەکات، با لێرە پۆپئەپەکە دابخەین
        // بەڵام ui.js ئەم مۆدیولە import ناکات
        // باشە، با فەنکشنی داخستن لە app-logic.js جێبەجێ بکەین
        
        // چاکسازی کۆتایی: addToCart لە cart.js ەوە هاتووە، با فەنکشنی closeCurrentPopup لە ui.js ەوە بهێنین
        // بەڵام ui.js ئەم مۆدیولە import ناکات
        
        // باشترین چارەسەر: دوگمەی 'زیادکردن' تەنها زیاد دەکات
        // بەکارهێنەر خۆی پۆپئەپەکە دادەخات
        // یان دوای زیادکردن، پەیامێک پیشان دەدەین و خۆی دایدەخەین
        showNotification(t('product_added_to_cart'), 'success');
        // closeCurrentPopup(); // ئەمە لادەبەین بۆ ئەوەی بەکارهێنەر بتوانێت بڕیار بدات
    };

    // هێنانی کاڵا پەیوەندیدارەکان
    renderRelatedProducts(product);

    // کردنەوەی پۆپئەپی وردەکارییەکان
    openPopup('productDetailSheet');
}

/**
 * کاڵایەک لە فایەربەیس دەهێنێت و پاشان وردەکارییەکانی پیشان دەدات
 * @param {string} productId - ئایدی کاڵا
 */
export async function showProductDetails(productId) {
    // سەرەتا لە لیستی کاڵا بارکراوەکاندا بۆی دەگەڕێین
    let product = state.products.find(p => p.id === productId);

    if (product) {
        // ئەگەر دۆزرایەوە، ڕاستەوخۆ پیشانی دەدەین
        showProductDetailsWithData(product);
    } else {
        // ئەگەر نا، لە فایەربەیس دەیهێنین
        try {
            const docRef = doc(db, "products", productId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                // زیادکردنی بۆ لیستی کاڵاکان بۆ ئەوەی جاری دووەم پێویست بە هێنان نەکات
                state.products.push(fetchedProduct); 
                showProductDetailsWithData(fetchedProduct);
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        } catch (error) {
            console.error("Error fetching product details:", error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

/**
 * ئەنیمەیشنی دەرکەوتنی کاڵاکان لە کاتی سکڕۆڵکردندا جێبەجێ دەکات
 */
export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible'); // زیادکردنی کلاس 'visible' بۆ ئەنیمەیشن
                observer.unobserve(entry.target); // وەستاندنی چاودێری کردن
            }
        });
    }, {
        threshold: 0.1 // 10%ی توخمەکە ببینرێت
    });

    // چاودێری کردنی هەموو ئەو کارتانەی کە کلاسی 'product-card-reveal' یان هەیە
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}
