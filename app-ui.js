// app-ui.js
// Ev pel ji bo rêveberiya hemî fonksiyonên pêwendîdarî navrûya bikarhêner (UI) ye.

import {
    db, // Needed for fetching category names in some UI functions
    state, translations, PRODUCTS_PER_PAGE // Assuming state is managed in app-data.js
} from './app-setup.js';

// Import necessary data/logic functions
import {
    t, isFavorite, toggleFavorite, addToCart, updateQuantity, removeFromCart,
    generateOrderMessage, navigateToFilter, applyFilterState, searchProductsInFirestore,
    saveProfile, checkNewAnnouncements, requestNotificationPermission, saveTokenToFirestore,
    forceUpdate, saveCurrentScrollPosition, renderProductsOnDetailPage // Added renderProductsOnDetailPage
} from './app-data.js'; // Assuming app-data.js exports these

import { getDoc, doc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";


// --- Core UI Functions ---

export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

export function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

export function showPage(pageId, pageTitle = '') {
    // Hide all pages, show the target page
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top for non-main pages
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Update header based on the page being shown
    updateHeaderView(pageId, pageTitle);


    // Update active state in bottom navigation
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    } else {
         // If navigating to a non-nav page (like subcategory detail), keep 'home' potentially active or clear all
         // Let's clear all for now if it's not main or settings
         if (pageId !== 'mainPage' && pageId !== 'settingsPage') {
             updateActiveNav(null); // Clear active state
         }
    }
}


export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    document.getElementById('sheet-overlay').classList.remove('show');
    document.body.classList.remove('overlay-active'); // Allow body scroll
}

export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening popup
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups

    if (type === 'sheet') {
        document.getElementById('sheet-overlay').classList.add('show');
        element.classList.add('show');
        // Lazy load content if needed
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies(); // Fetch and render policies
        if (id === 'profileSheet') { // Populate profile form
             document.getElementById('profileName').value = state.userProfile.name || '';
             document.getElementById('profileAddress').value = state.userProfile.address || '';
             document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }

    } else { // Modal
        element.style.display = 'block';
    }

    document.body.classList.add('overlay-active'); // Prevent body scroll
    // Push state for back button handling
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

export function closeCurrentPopup() {
    // If the current state is a popup, go back in history to close it
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        // Otherwise, just close any open popups (fallback)
        closeAllPopupsUI();
    }
}

export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    if (activeBtnId) {
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// --- Rendering Functions ---

export function renderSkeletonLoader(container = document.getElementById('skeletonLoader'), count = 8) {
    container.innerHTML = ''; // Clear previous skeletons
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
    container.style.display = 'grid'; // Ensure it's visible
     // Hide actual products and loader if rendering the main skeleton loader
    if (container.id === 'skeletonLoader') {
         document.getElementById('productsContainer').style.display = 'none';
         document.getElementById('loader').style.display = 'none';
    }
}

export function formatDescription(text) {
    if (!text) return '';
    // Escape HTML tags first
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    // Replace URLs with anchor tags
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        // Ensure URL starts with http(s):// for the href
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newline characters with <br> tags
    return textWithLinks.replace(/\n/g, '<br>');
}


// Make globally accessible TEMPORARILY for product detail onclick
// TODO: Refactor product detail logic to avoid global exposure
window.createProductCardElement = function(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

    // Get localized name or fallback
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // Price and Discount Badge
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

     // Shipping Info Badge
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


    // Favorite Button State
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // fas for solid, far for regular
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // Construct Inner HTML
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
             <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                 <i class="${heartIconClass} fa-heart"></i>
             </button>
             <button class="share-btn-card" aria-label="Share product">
                 <i class="fas fa-share-alt"></i>
             </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // Event Listener (delegated approach)
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Re-check admin status on click

        if (addToCartButton) {
            addToCart(product.id); // Call logic function
            // Add visual feedback to button
             if (!addToCartButton.disabled) {
                 const originalContent = addToCartButton.innerHTML;
                 addToCartButton.disabled = true;
                 addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state
                 setTimeout(() => {
                     addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Added state
                     setTimeout(() => {
                         addToCartButton.innerHTML = originalContent; // Revert state
                         addToCartButton.disabled = false;
                     }, 1500); // Duration of 'added' state
                 }, 500); // Duration of loading state
             }
        } else if (isAdminNow && target.closest('.edit-btn')) {
            window.AdminLogic.editProduct(product.id); // Call admin function
        } else if (isAdminNow && target.closest('.delete-btn')) {
            window.AdminLogic.deleteProduct(product.id); // Call admin function
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id, event); // Pass event to stop propagation if needed
        } else if (target.closest('.share-btn-card')) {
             event.stopPropagation(); // Prevent opening details
             const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
             const shareData = {
                 title: nameInCurrentLang,
                 text: `${t('share_text')}: ${nameInCurrentLang}`,
                 url: productUrl,
             };
             try {
                 if (navigator.share) {
                     navigator.share(shareData);
                 } else {
                      // Fallback: Copy URL to clipboard
                      navigator.clipboard.writeText(productUrl).then(() => {
                          showNotification('لينكى کاڵا کۆپى کرا!', 'success');
                      }).catch(err => {
                           console.error('Copy failed:', err);
                           showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error');
                      });
                 }
             } catch (err) {
                 console.error('Share error:', err);
                  if (err.name !== 'AbortError') showNotification(t('share_error'), 'error');
             }
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description
            showProductDetailsWithData(product); // Show details popup
        }
    });

    return productCard;
}

// Function to render products in a container
export function renderProducts() {
    const productsContainer = document.getElementById('productsContainer');
    productsContainer.innerHTML = ''; // Clear previous products

    if (!state.products || state.products.length === 0) {
        // Optionally display a "no products found" message if needed,
        // but searchProductsInFirestore already handles this.
        return;
    }

    state.products.forEach(item => {
        let element = createProductCardElement(item); // Use the UI function
        element.classList.add('product-card-reveal'); // Add class for scroll animation
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Set up animations for newly added cards
}

export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, { threshold: 0.1 }); // Trigger when 10% is visible

    // Observe all elements with the reveal class
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

// Function to show product details in the bottom sheet
// Make globally accessible TEMPORARILY
window.showProductDetailsWithData = function(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description.ku_sorani) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    // Populate image slider and thumbnails
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Main image
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            // Thumbnail image
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    }

    // Slider controls logic
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return; // Boundary check
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    // Show/hide slider buttons based on image count
    const showButtons = imageUrls.length > 1;
    prevBtn.style.display = showButtons ? 'flex' : 'none';
    nextBtn.style.display = showButtons ? 'flex' : 'none';

    // Event listeners for slider controls
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    // Populate other product details
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    // Price display (handle discounts)
    const priceContainer = document.getElementById('sheetProductPrice');
     if (product.originalPrice && product.originalPrice > product.price) {
         priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
     } else {
         priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
     }


    // Add to cart button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id); // Call logic function
        closeCurrentPopup(); // Close sheet after adding
    };

    // Render related products (async operation)
    renderRelatedProducts(product);

    // Open the sheet
    openPopup('productDetailSheet');
}

// Function to render related products (fetches data and creates cards)
export async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous
    section.style.display = 'none'; // Hide initially

    // Determine query based on available category IDs
    let q;
    if (currentProduct.subSubcategoryId) {
        q = query(productsCollection, where('subSubcategoryId', '==', currentProduct.subSubcategoryId), where('__name__', '!=', currentProduct.id), limit(6));
    } else if (currentProduct.subcategoryId) {
        q = query(productsCollection, where('subcategoryId', '==', currentProduct.subcategoryId), where('__name__', '!=', currentProduct.id), limit(6));
    } else if (currentProduct.categoryId) {
        q = query(productsCollection, where('categoryId', '==', currentProduct.categoryId), where('__name__', '!=', currentProduct.id), limit(6));
    } else {
        return; // Cannot find related products without category info
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) return; // No related products found

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use card creation function
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show section if products found
    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}


// --- Category Rendering ---

export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear existing buttons

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) btn.classList.add('active');

        // Get localized name or fallback to Sorani
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Use translation for "All"
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            // Navigate using the data function
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory when main changes
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search
            });
        };
        container.appendChild(btn);
    });
}

export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear previous
     document.getElementById('subSubcategoriesContainer').style.display = 'none'; // Hide sub-sub container

    if (categoryId === 'all') {
         subcategoriesContainer.style.display = 'none'; // Hide subcategory bar if 'All' is selected
        return; // No subcategories to show for 'All'
    }

     subcategoriesContainer.style.display = 'flex'; // Show the container


    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0) {
             subcategoriesContainer.style.display = 'none'; // Hide if no subcategories
            return;
        }

        // Create "All" button for subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.onclick = async () => {
             // Navigate to 'all' subcategory
            await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Create buttons for each subcategory
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;
            subcatBtn.innerHTML = `<img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subcatName}</span>`;
             subcatBtn.onclick = () => {
                 // Instead of navigating here, go to the detail page
                 window.showSubcategoryDetailPage(categoryId, subcat.id);
             };

            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

// Function to render categories in the bottom sheet
export function renderCategoriesSheet() {
    const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
    sheetCategoriesContainer.innerHTML = ''; // Clear existing

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) btn.classList.add('active');

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`;

        btn.onclick = async () => {
            // Navigate using the data function
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
            closeCurrentPopup(); // Close sheet after selection
            showPage('mainPage'); // Ensure main page is shown
        };
        sheetCategoriesContainer.appendChild(btn);
    });
}

// Function to populate category dropdown in product form (Used by Admin)
export function populateCategoryDropdown() {
    const productCategorySelect = document.getElementById('productCategoryId');
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>'; // Default option
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Use localized name or fallback
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

// --- Cart Rendering ---
export function renderCart() {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartTotal = document.getElementById('cartTotal');
    const totalAmount = document.getElementById('totalAmount');
    const cartActions = document.getElementById('cartActions');

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
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image">
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
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalAmount.textContent = total.toLocaleString(); // Update total display

    // Add event listeners for quantity buttons and remove button
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

// Fetch and render buttons for sending cart (WhatsApp, Viber etc.)
export async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Assuming order matters
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a generic class, specific styles handled by inline style
            btn.className = 'whatsapp-btn'; // Re-use existing style for simplicity
            btn.style.backgroundColor = method.color;

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

            btn.onclick = () => {
                const message = generateOrderMessage(); // Get message from data function
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                switch (method.type) {
                    case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                    case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; // Needs '+' for international format
                    case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                    case 'phone': link = `tel:${value}`; break; // Phone call, no message
                    case 'url': link = value; break; // Custom URL
                }

                if (link) window.open(link, '_blank'); // Open in new tab/app
            };
            container.appendChild(btn);
        });
    } catch (error) {
        console.error("Error fetching cart action methods:", error);
        container.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

// --- Favorites Rendering ---
export async function renderFavoritesPage() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
    favoritesContainer.innerHTML = ''; // Clear previous

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Use grid layout
    renderSkeletonLoader(favoritesContainer, 4); // Show skeletons while loading

    try {
        // Fetch details for each favorited product ID
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeletons

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Filter out products that might have been deleted
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
             // If all favorited products were deleted
             emptyFavoritesMessage.style.display = 'block';
             favoritesContainer.style.display = 'none';
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product); // Create card
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}

// --- Notifications & Policies Rendering ---
export async function renderUserNotifications() {
    const notificationsListContainer = document.getElementById('notificationsListContainer');
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));

    try {
        const snapshot = await getDocs(q);
        notificationsListContainer.innerHTML = ''; // Clear previous

        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            if (announcement.createdAt > latestTimestamp) latestTimestamp = announcement.createdAt;

            const date = new Date(announcement.createdAt);
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content}</p>
            `;
            notificationsListContainer.appendChild(item);
        });

        // Update last seen timestamp and hide badge
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        document.getElementById('notificationBadge').style.display = 'none';

    } catch (error) {
        console.error("Error fetching user notifications:", error);
        notificationsListContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

export async function renderPolicies() {
    const termsContentContainer = document.getElementById('termsContentContainer');
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Loading message
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content for current language or fallback to Sorani
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Display content, replace newlines with <br>
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`; // No policies set
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

// --- Other UI Helpers ---

export function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Update all elements with the cart-count class
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = totalItems;
        el.style.display = totalItems > 0 ? 'flex' : 'none'; // Show/hide badge
    });
}

// Function to update dropdowns that depend on categories (e.g., in admin forms)
export function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    populateCategoryDropdown(); // Update product form dropdown
    renderMainCategories(); // Update main category buttons
    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns();
    }
}

export async function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Fetch links

    try {
        const snapshot = await getDocs(q);
        contactLinksContainer.innerHTML = ''; // Clear previous

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Open in new tab
            linkElement.className = 'settings-item'; // Use existing style
            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;
            contactLinksContainer.appendChild(linkElement);
        });
    } catch (error) {
        console.error("Error fetching contact links:", error);
        contactLinksContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

export function showWelcomeMessage() {
    // Show welcome modal only on the very first visit
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    if (!getLocationBtn || !profileAddressInput) return; // Exit if elements not found

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan ? btnSpan.textContent : 'Get Location'; // Fallback text

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        if (btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success
                const { latitude, longitude } = position.coords;
                try {
                    // Use Nominatim reverse geocoding
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    const data = await response.json();
                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification('ناونیشان وەرگیرا', 'success');
                    } else {
                        showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    showNotification('هەڵەیەک لە وەرگرتنی ناونیشان', 'error');
                } finally {
                    if (btnSpan) btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error
                let message = t('error_generic'); // Default error message
                switch(error.code) {
                    case error.PERMISSION_DENIED: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                    case error.POSITION_UNAVAILABLE: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                    case error.TIMEOUT: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                }
                showNotification(message, 'error');
                if (btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            }
        );
    });
}

// Language Setting Function (Moved here as it primarily affects UI)
export function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    // Update HTML lang and dir attributes
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Always RTL for these languages

    // Update all elements with data-translate-key
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key); // Use t() from app-data.js
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });

    // Update active language button style
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

     // Rerender dynamic content that depends on language
     const homeContainer = document.getElementById('homePageSectionsContainer');
     if (homeContainer) homeContainer.innerHTML = ''; // Clear home content to force re-render

     // Determine if we should render home page or filtered products
     const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
     if (isHomeView) {
         renderHomePageContent(); // Rerender home page sections
     } else {
         renderProducts(); // Rerender filtered product list
     }

     // Rerender category displays
     renderMainCategories();
     renderCategoriesSheet();

     // Rerender open popups if their content is language-dependent
     if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
     if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
     if (document.getElementById('termsSheet').classList.contains('show')) renderPolicies();

     // Update category dependent UI in admin section if applicable
     updateCategoryDependentUI();
}