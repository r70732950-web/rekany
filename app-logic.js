// app-logic.js: Fonksiyon û mentiqê serekî yê bernameyê (Kontrolker)

// Import dependencies from app-setup.js
import {
    db, auth, messaging, productsCollection, announcementsCollection,
    translations, state, // state object might need sliderIntervals: {} added in app-setup.js
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer, // Keep this if needed elsewhere
} from './app-setup.js';

// Import Firebase Auth, Firestore and Messaging functions separately
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import functions from categories.js
import {
    fetchCategories, renderMainCategories, renderCategoriesSheet, renderSubcategories,
    renderSubSubcategoriesOnDetailPage, // Assuming this is needed for detail page
    populateCategoryDropdown, populateSubcategoriesDropdown, populateSubSubcategoriesDropdown
} from './categories.js';

// Import functions from home.js
import { renderHomePageContent } from './home.js';

// --- Utility Functions ---

function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Function to translate text
function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

// --- Navigation and Page Management ---

function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state
    if (document.getElementById('mainPage')?.classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) return;

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

export function showPage(pageId, pageTitle = '') { // Export needed for history popstate
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Nûvekirina headerê li gorî rûpelê
    if (pageId === 'settingsPage') {
        updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        updateHeaderView('subcategoryDetailPage', pageTitle);
    } else {
        updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
}

function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// --- Popup Management ---

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if(sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

export function openPopup(id, type = 'sheet') { // Export for admin.js
    saveCurrentScrollPosition();
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();
    if (type === 'sheet') {
        if(sheetOverlay) sheetOverlay.classList.add('show');
        element.classList.add('show');
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet(); // Use imported function
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

export function closeCurrentPopup() { // Export for admin.js
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
}

// --- Filter/Search State Management ---

async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    if(searchInput) searchInput.value = state.currentSearch;
    if(clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories(); // Use imported function
    await renderSubcategories(state.currentCategory); // Use imported function

    // Fetch and render products based on the new state
    await searchProductsInFirestore(state.currentSearch, true); // True indicates a new search/filter

    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50); // Restore scroll position
    } else if (!fromPopState) {
         window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for new filter
    }
}

export async function navigateToFilter(newState) { // Export for categories.js and home.js
    // Save current scroll before changing state
    history.replaceState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY
    }, '');

    // Combine current state with new state changes, reset scroll
    const finalState = { ...history.state, ...newState, scroll: 0 };

    // Build URL parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Push the new state and URL
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state to the UI
    await applyFilterState(finalState);
}


// --- Product Rendering and Details ---

function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

// Function to create a single product card element (Exported for home.js, favorites, etc.)
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_unnamed', { id: product.id }); // Fallback name
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price?.toLocaleString() || 'N/A'} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.price && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

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

    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

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

    // --- Event Listeners for Card ---
    productCard.querySelector('.share-btn-card')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`,
            url: productUrl,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = productUrl;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    showNotification('لينكى کاڵا کۆپى کرا!', 'success');
                } catch (err) {
                    showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error');
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Share error:', err);
             if (err.name !== 'AbortError') {
                 showNotification(t('share_error'), 'error');
             }
        }
    });

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            event.stopPropagation(); // Prevent opening details view
            addToCart(product.id);
            // Add visual feedback for adding to cart
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`;
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent;
                        addToCartButton.disabled = false;
                    }, 1500);
                }, 500);
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
             event.stopPropagation();
             window.AdminLogic?.editProduct(product.id); // Call admin function if available
        } else if (isAdminNow && target.closest('.delete-btn')) {
             event.stopPropagation();
             window.AdminLogic?.deleteProduct(product.id); // Call admin function if available
        } else if (target.closest('.favorite-btn')) {
            event.stopPropagation();
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
            // Already handled by separate listener
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link
            showProductDetails(product.id); // Open details view
        }
    });
    return productCard;
}

// Function to create promo card element (Exported for home.js)
export function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Use product-card for base styling
    const currentCard = cardData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    cardElement.addEventListener('click', async (e) => {
        // Use currentCard from the closure
        if (!e.target.closest('button')) { // Don't navigate if clicking slider buttons
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    // Add event listeners for slider buttons if they exist
    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;
        });

        cardElement.querySelector('.promo-slider-btn.next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;
        });
    }

    return cardElement;
}


function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
     if (!container) return;
    container.innerHTML = '';
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
    container.style.display = 'grid';
    if (productsContainer) productsContainer.style.display = 'none'; // Hide real products
    if (loader) loader.style.display = 'none'; // Hide spinner
}

// Renders the products currently in state.products
function renderProducts() {
     if (!productsContainer) return;
    productsContainer.innerHTML = ''; // Clear previous products first
    if (!state.products || state.products.length === 0) {
        // Display message if needed (handled by searchProductsInFirestore usually)
        return;
    }

    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Setup animations for newly added cards
}

async function showProductDetails(productId) {
    // Attempt to find product in already loaded state first
    const product = state.products.find(p => p.id === productId);

    if (product) {
        showProductDetailsWithData(product);
    } else {
        // If not found, fetch from Firestore
        console.log("Product not in local state. Fetching from Firestore...");
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
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

async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    if (!section || !container) return;

    container.innerHTML = '';
    section.style.display = 'none';

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Cannot find related if no category info
    }

    let q;
    let queryField, queryValue;

    // Prioritize most specific category match
    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = currentProduct.subcategoryId;
    } else {
        queryField = 'categoryId';
        queryValue = currentProduct.categoryId;
    }

    q = query(
        productsCollection,
        where(queryField, '==', queryValue),
        where('__name__', '!=', currentProduct.id), // Exclude the current product
        limit(6) // Limit number of related products
    );


    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use shared card creation
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the section

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}


function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    if (!imageContainer || !thumbnailContainer) return;
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    // Populate images and thumbnails
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index.toString();
            thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Show placeholder if no images
        imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="No Image" class="active">`;
    }

    // Slider logic
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || (thumbnails.length > 0 && !thumbnails[index])) return;
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        if(thumbnails[index]) thumbnails[index].classList.add('active'); // Check thumbnail exists
        currentIndex = index;
    }

    if (prevBtn && nextBtn) {
        if (imageUrls.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
            prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
            nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    }
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index || '0')));

    // Populate text details
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    // Populate price
    const priceContainer = document.getElementById('sheetProductPrice');
    if (priceContainer) {
        if (product.originalPrice && product.price && product.originalPrice > product.price) {
            priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
        } else {
            priceContainer.innerHTML = `<span>${product.price?.toLocaleString() || 'N/A'} د.ع</span>`;
        }
    }

    // Setup Add to Cart button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    if (addToCartButton) {
        addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
        addToCartButton.onclick = () => {
            addToCart(product.id);
            closeCurrentPopup(); // Close sheet after adding
        };
    }

    renderRelatedProducts(product); // Fetch and display related products

    openPopup('productDetailSheet'); // Open the sheet
}


// Function to fetch products based on filters and search, handles pagination
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    // --- Home Page Rendering Logic ---
    if (shouldShowHomeSections) {
        if (productsContainer) productsContainer.style.display = 'none'; // Hide grid
        if (skeletonLoader) skeletonLoader.style.display = 'none'; // Hide skeleton
        if (scrollTrigger) scrollTrigger.style.display = 'none'; // Hide pagination trigger
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'block'; // Show home sections

        // Render home content only if container is empty (or force refresh if needed)
        if (homeSectionsContainer && homeSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent(); // Use imported function from home.js
        }
        return; // Stop execution, home page is shown
    } else {
         // Hide home sections if not on the main home view
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'none';
        // --- Interval Cleanup for Home Page Sliders ---
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object when leaving home view
        // --- End Interval Cleanup ---
    }
    // --- End Home Page Rendering Logic ---

    // Prevent concurrent loading
    if (state.isLoadingMoreProducts) return;

    // Reset state for a new search/filter
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show skeleton for new search
    }

    // Stop if all products already loaded for current filter (on pagination attempt)
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    if (loader) loader.style.display = isNewSearch ? 'none' : 'block'; // Show spinner only on pagination

    try {
        let productsQuery = collection(db, "products");

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Apply ordering - IMPORTANT: First orderBy must match inequality field if searching
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (startAfter)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Apply limit
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // Execute query
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update state
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Check if all products loaded
        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;
        if (scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';


        // Update last visible doc for pagination
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Render the fetched products
        renderProducts();

        // Show "no products" message if needed
        if (state.products.length === 0 && isNewSearch) {
             if (productsContainer) productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching products:", error);
         if (productsContainer) productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        if (loader) loader.style.display = 'none';
        if (skeletonLoader) skeletonLoader.style.display = 'none'; // Hide skeleton after loading
        if (productsContainer) productsContainer.style.display = 'grid'; // Ensure product grid is visible
    }
}


// --- Cart Logic ---

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems.toString(); });
}

function addToCart(productId) {
    let productData = state.products.find(p => p.id === productId);

    const handleAddToCart = (productInfo) => {
        const mainImage = (productInfo.imageUrls && productInfo.imageUrls.length > 0) ? productInfo.imageUrls[0] : (productInfo.image || '');
        const existingItem = state.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            state.cart.push({
                id: productInfo.id,
                name: productInfo.name, // Store the name object
                price: productInfo.price,
                image: mainImage,
                quantity: 1
            });
        }
        saveCart();
        showNotification(t('product_added_to_cart'));
    };

    if (productData) {
        handleAddToCart(productData);
    } else {
        // Fetch product if not in local state
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                handleAddToCart({ id: docSnap.id, ...docSnap.data() });
            } else {
                 console.warn(`Product ${productId} not found for cart.`);
                 showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(err => {
             console.error("Error fetching product for cart:", err);
             showNotification(t('error_generic'), 'error');
        });
    }
}

function renderCart() {
     if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return;

    cartItemsContainer.innerHTML = '';
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Render action buttons dynamically

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = (item.price || 0) * item.quantity; // Handle potential missing price
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get name in current language or fallback
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('product_unnamed', { id: item.id }));

        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${(item.price || 0).toLocaleString()} د.ع.</div>
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
    totalAmount.textContent = total.toLocaleString();

    // Re-attach event listeners for quantity buttons and remove button
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart(); // Re-render cart to show updated quantity and total
        }
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // Re-render cart after removal
}

function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'Unknown Product');
        const itemDetails = t('order_item_details', { price: (item.price || 0).toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`; // Use textContent which is already formatted

    // Add user profile info if available
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

// Fetches and renders dynamic action buttons based on Firestore settings
async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    if (!container) return;
    container.innerHTML = ''; // Clear previous buttons

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Order might need adjustment based on desired display order
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a more generic class or keep whatsapp-btn if styling is shared
            btn.className = 'whatsapp-btn'; // Consider renaming this class if styles differ significantly
            btn.style.backgroundColor = method.color || '#4CAF50'; // Default color

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Default icon

            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber deeplinks can be inconsistent across platforms
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Will prompt user to call
                        break;
                    case 'url': // For custom URLs (e.g., website order form)
                        link = value; // Assume the value is the full URL
                        // You might want to append order details as query params if the target URL supports it
                        break;
                    default:
                        console.warn("Unknown contact method type:", method.type);
                }

                if (link) {
                    window.open(link, '_blank'); // Open in new tab/app
                }
            };

            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching cart action buttons:", error);
        container.innerHTML = '<p>هەڵە لە بارکردنی دوگمەکان ڕوویدا.</p>';
    }
}


// --- Favorites Logic ---

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

function toggleFavorite(productId, event) {
    if(event) event.stopPropagation(); // Prevent card click when clicking heart

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update heart icon on all instances of this product card on the page
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Target the icon directly
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
            heartIcon.classList.toggle('far', !isNowFavorite); // Outline heart
        }
    });

    // If the favorites sheet is open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage();
    }
}

async function renderFavoritesPage() {
    if (!favoritesContainer || !emptyFavoritesMessage) return;

    favoritesContainer.innerHTML = '';

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Use grid layout

    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeleton while fetching

    try {
        // Fetch details for all favorited products
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Filter out products that might have been deleted
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // Update state if some favorites were not found
            if(favoritedProducts.length !== state.favorites.length) {
                 state.favorites = favoritedProducts.map(p => p.id);
                 saveFavorites();
            }
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product); // Use shared function
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; grid-column: 1 / -1;">${t('error_generic')}</p>`;
    }
}


// --- Notifications and Settings ---

function showNotification(message, type = 'success') { // Export for admin.js
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Trigger CSS transition
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition ends
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Fetches and displays Terms & Policies
async function renderPolicies() {
    if (!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

// Checks for new announcements to show the badge
function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                if(notificationBadge) notificationBadge.style.display = 'block';
            } else {
                if(notificationBadge) notificationBadge.style.display = 'none';
            }
        }
    });
}

// Renders the list of announcements in the notification sheet
async function renderUserNotifications() {
     if (!notificationsListContainer) return;
    notificationsListContainer.innerHTML = ''; // Clear previous

    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            const date = new Date(announcement.createdAt);
            // Format date as YYYY/MM/DD
            const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

            // Get translated title and content
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p>
            `;
            notificationsListContainer.appendChild(item);
        });

        // Update last seen timestamp and hide badge
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp.toString());
        if(notificationBadge) notificationBadge.style.display = 'none';

    } catch (error) {
         console.error("Error rendering user notifications:", error);
         notificationsListContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

// Renders social media links in settings
function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if (!contactLinksContainer) return;

    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order might need adjustment

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

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
            linkElement.rel = 'noopener noreferrer';
            linkElement.className = 'settings-item'; // Use existing style

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    }, (error) => {
         console.error("Error fetching contact links:", error);
         contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هەڵە لە بارکردنی لینکەکان.</p>';
    });
}

// --- Language and UI ---

function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL for ku and ar

    // Update all translatable elements
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    // Update active language button style
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render language-dependent content
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) homeContainer.innerHTML = ''; // Clear home to force re-render

    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (isHomeView) {
        renderHomePageContent(); // Use imported function
    } else {
        renderProducts(); // Re-render product grid if not on home view
    }

    renderMainCategories(); // Re-render main categories bar
    renderCategoriesSheet(); // Re-render categories in sheet
    if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart(); // Re-render cart if open
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage(); // Re-render favorites if open
    // Update admin UI elements if admin logic is active
     if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
         window.AdminLogic.updateAdminCategoryDropdowns?.();
         window.AdminLogic.updateShortcutCardCategoryDropdowns?.();
         // Add other admin UI updates if needed
     }
}

// --- PWA, Notifications, GPS ---

async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notification_permission_granted', { default: 'Notification permission granted' }), 'success'); // Assuming key exists
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification(t('notification_permission_denied', { default: 'Notification permission denied' }), 'error'); // Assuming key exists
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
         showNotification(t('notification_permission_error', { default: 'Error requesting notification permission' }), 'error'); // Assuming key exists
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID to prevent duplicates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add user ID here if users log in
            // userId: auth.currentUser?.uid || null
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            // Unregister service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            // Clear caches
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success');

            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload(true); // Force reload bypassing cache
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}


function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan?.textContent || 'Get Location';

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
             async (position) => { // Success Callback
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Using Nominatim for reverse geocoding (OpenStreetMap data)
                    // Make sure to respect their usage policy (e.g., rate limits)
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification('ناونیشان وەرگیرا', 'success');
                    } else {
                        profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coordinates
                        showNotification('نەتوانرا ناونیشانی ورد بدۆزرێتەوە، ک ordinate دانرا', 'warning');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback
                    showNotification('هەڵەیەک لە وەرگرتنی ناونیشانی ورد ڕوویدا', 'error');
                } finally {
                    if(btnSpan) btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error Callback
                let message = '';
                switch (error.code) {
                    case error.PERMISSION_DENIED: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                    case error.POSITION_UNAVAILABLE: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                    case error.TIMEOUT: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                    default: message = 'هەڵەیەکی نادیار ڕوویدا'; break;
                }
                showNotification(message, 'error');
                if(btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options
        );
    });
}


// --- Initialization and Event Listeners ---

function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Load more only if intersecting, not currently loading, and not all loaded
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
            searchProductsInFirestore(state.currentSearch, false); // Fetch next page
        }
    }, { threshold: 0.1 }); // Trigger when 10% visible

    observer.observe(trigger);
}

// Sets up main UI event listeners
function setupEventListeners() {

     // Bottom Navigation
    homeBtn?.addEventListener('click', async () => {
         if (!mainPage?.classList.contains('page-active')) {
             history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
             showPage('mainPage');
         }
         // Reset filters when clicking home explicitly
         await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
     });

    settingsBtn?.addEventListener('click', () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    });

    profileBtn?.addEventListener('click', () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn');
    });

    cartBtn?.addEventListener('click', () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn');
    });

    categoriesBtn?.addEventListener('click', () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn');
    });

    // Header Back Button
    document.getElementById('headerBackBtn')?.addEventListener('click', () => history.back());

    // Settings Page Links
    settingsFavoritesBtn?.addEventListener('click', () => openPopup('favoritesSheet'));
    settingsAdminLoginBtn?.addEventListener('click', () => openPopup('loginModal', 'modal'));
    termsAndPoliciesBtn?.addEventListener('click', () => openPopup('termsSheet'));
    notificationBtn?.addEventListener('click', () => openPopup('notificationsSheet'));
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate);

    // Popup Closing
    sheetOverlay?.addEventListener('click', closeCurrentPopup);
    document.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', closeCurrentPopup));
    window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); });

    // Login Form
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        if (!email || !password) return;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Admin logic init happens via onAuthStateChanged
        } catch (error) {
            console.error("Login failed:", error);
            showNotification(t('login_error'), 'error');
        }
    });

     // Search Input (Main Header)
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
    searchInput?.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        if(clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    });
    clearSearchBtn?.addEventListener('click', () => {
        if(searchInput) searchInput.value = '';
        if(clearSearchBtn) clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' }); // Clear search via navigation
    });

     // Subpage Search Logic
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            // Assuming renderProductsOnDetailPage exists or is imported
            if (typeof renderProductsOnDetailPage === 'function') {
                 await renderProductsOnDetailPage(subCatId, subSubCatId, term);
            } else {
                 console.warn("renderProductsOnDetailPage function not available for subpage search.");
            }
        }
    }, 500);

    subpageSearchInput?.addEventListener('input', () => {
        const searchTerm = subpageSearchInput.value;
        if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSubpageSearch(searchTerm);
    });

    subpageClearSearchBtn?.addEventListener('click', () => {
        if(subpageSearchInput) subpageSearchInput.value = '';
        if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';
        debouncedSubpageSearch(''); // Trigger search with empty term
    });


    // Contact Links Toggle (Settings)
    contactToggle?.addEventListener('click', () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container?.classList.toggle('open');
        chevron?.classList.toggle('open');
    });

    // Profile Form
    profileForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName')?.value || '',
            address: document.getElementById('profileAddress')?.value || '',
            phone: document.getElementById('profilePhone')?.value || '',
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    });

    // Language Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    // PWA Install Button
    const installBtn = document.getElementById('installAppBtn');
    installBtn?.addEventListener('click', async () => {
        if (state.deferredPrompt) {
            installBtn.style.display = 'none'; // Hide button after prompting
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            state.deferredPrompt = null;
        }
    });

    // Foreground FCM Messages
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title;
        const body = payload.notification?.body;
        if(title && body) {
            showNotification(`${title}: ${body}`, 'success');
        }
        if(notificationBadge) notificationBadge.style.display = 'block'; // Show badge immediately
    });

     // Category selection in Product Form -> load subcategories
    document.getElementById('productCategoryId')?.addEventListener('change', (e) => {
        populateSubcategoriesDropdown(e.target.value); // Use imported function
        populateSubSubcategoriesDropdown(null, null); // Clear sub-sub on main change
    });

     // Subcategory selection in Product Form -> load sub-subcategories
    document.getElementById('productSubcategoryId')?.addEventListener('change', (e) => {
        const mainCatId = document.getElementById('productCategoryId')?.value;
        populateSubSubcategoriesDropdown(mainCatId, e.target.value); // Use imported function
    });
}

// History/Navigation handling
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI(); // Close any open popups on navigation
    const popState = event.state;
    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            // Refetch title for subcategory page if missing (e.g., direct load)
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                try {
                    const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    const subCatSnap = await getDoc(subCatRef);
                    if (subCatSnap.exists()) {
                        const subCat = subCatSnap.data();
                        pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                    }
                } catch(e) { console.error("Could not refetch title on popstate", e) }
            }
            showPage(popState.id, pageTitle);
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Reopen the popup based on history state
            openPopup(popState.id, popState.type);
        } else {
            // It's a filter state for the main page
            showPage('mainPage');
            applyFilterState(popState, true); // True indicates it's from popstate
        }
    } else {
        // No state, assume default main page view
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
});

// Initial load handling based on URL
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const isSubcategoryDetail = hash.startsWith('subcategory_');
    const isSettings = hash === 'settingsPage';
    const productId = params.get('product');

    if (isSubcategoryDetail) {
         // Subcategory detail page logic is handled by the category listener after fetch
         // No need to call showSubcategoryDetailPage directly here anymore
    } else if (isSettings) {
         history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
         showPage('settingsPage', t('settings_title'));
    } else {
        // Main page or default view
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        history.replaceState(initialState, ''); // Set initial state for main page filters
        applyFilterState(initialState); // Apply filters immediately

         // Check if a popup needs to be opened based on hash
        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                 // Defer opening popup slightly to ensure page transition completes
                 setTimeout(() => openPopup(hash, isSheet ? 'sheet' : 'modal'), 50);
            }
        }
    }

    // Handle direct product link after a delay
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500); // Delay to allow initial rendering
    }
}


// --- Auth State Change ---
onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        // Ensure admin logic is loaded and initialize it
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Wait for DOM content to be fully loaded if not already
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                  window.addEventListener('DOMContentLoaded', window.AdminLogic.initialize, { once: true });
             }
        } else {
            console.warn("AdminLogic not found or initialize not a function when admin logged in.");
            // Optionally try loading admin.js dynamically here if needed
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        // If a non-admin user is signed in (shouldn't happen with current setup), sign them out.
        if (user) {
            try {
                await signOut(auth);
                console.log("Non-admin user signed out.");
            } catch (error) {
                 console.error("Error signing out non-admin user:", error);
            }
        }
        // Deinitialize admin UI if admin logic exists
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    // Close login modal if it's open and admin logs in
    if (loginModal?.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


// --- App Initialization ---

function init() {
    renderSkeletonLoader(); // Show skeleton immediately

    // Enable offline persistence first
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Start main logic after persistence setup
        })
        .catch((err) => {
            console.warn("Firestore offline persistence failed:", err.code, err.message);
            initializeAppLogic(); // Start main logic even if persistence fails
        });
}

// Core logic initialization (called after persistence setup)
async function initializeAppLogic() {
    // Ensure state object has necessary properties
    if (!state.sliderIntervals) state.sliderIntervals = {};

    setupEventListeners(); // Setup basic UI interactions
    setupScrollObserver(); // Setup infinite scroll
    setLanguage(state.currentLanguage); // Apply initial language
    renderContactLinks(); // Fetch and display contact links
    checkNewAnnouncements(); // Check for notification badge
    showWelcomeMessage(); // Show welcome on first visit
    setupGpsButton(); // Setup GPS functionality

    await fetchCategories(); // Fetch categories crucial for initial rendering

    // Handle initial page load based on URL *after* categories are fetched
    handleInitialPageLoad();

    updateCartCount(); // Update cart badge
}

// --- PWA and Service Worker ---

// PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex';
    console.log('`beforeinstallprompt` event fired.');
});

// Service Worker Registration and Update Handling
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered.');

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);
            newWorker?.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New worker waiting, show update prompt
                    if (updateNotification) updateNotification.classList.add('show');
                }
            });
        });

        // Button to activate the new worker
        updateNowBtn?.addEventListener('click', () => {
            registration.waiting?.postMessage({ action: 'skipWaiting' });
             if (updateNotification) updateNotification.classList.remove('show');
        });

    }).catch(err => console.log('Service Worker registration failed: ', err));

    // Reload page when controller changes (new worker activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading...');
        window.location.reload();
    });
}


// --- Start App ---
document.addEventListener('DOMContentLoaded', init);


// --- Global Admin Tools Exposure (Ensure this is AFTER function definitions) ---
window.globalAdminTools = window.globalAdminTools || {}; // Initialize if not already
Object.assign(window.globalAdminTools, {
    // Firebase services are already exported from app-setup.js and imported here if needed
    // We mainly need to expose functions used BY admin.js that are defined HERE
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    populateSubcategoriesDropdown, populateSubSubcategoriesDropdown, // Needed for admin category forms
    // Functions/State needed by admin.js that might come from setup or categories
    getCategories: () => state.categories,
    getCurrentLanguage: () => state.currentLanguage,
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    clearProductCache: () => {
        console.log("Product cache and home page cleared by admin action.");
        state.productCache = {};
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) homeContainer.innerHTML = ''; // Force re-render on next home view
        // Optionally trigger a re-render now if needed
        // searchProductsInFirestore(state.currentSearch, true);
    }
    // No need to re-export db, auth, firestore functions if admin.js imports them from app-setup.js
});
