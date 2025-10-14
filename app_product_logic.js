// app_product_logic.js

import {
    productsCollection, promoCardsCollection, products, categories, currentLanguage, t,
    showNotification, currentSearch, currentCategory, currentSubcategory, currentSubSubcategory,
    isAdmin, editingProductId, categoriesCollection, subcategories, dbRef, authRef,
    userProfile, cart, saveCart, closeCurrentPopup, imageInputsContainer, productCategorySelect,
    subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, allPromoCards, currentPromoCardIndex, promoRotationInterval,
    productsContainer, skeletonLoader, loader, PRODUCTS_PER_PAGE, lastVisibleProductDoc,
    allProductsLoaded, isLoadingMoreProducts, formTitle, productForm, favorites, FAVORITES_KEY,
    favoritesContainer, emptyFavoritesMessage, cartItemsContainer, emptyCartMessage, cartTotal,
    cartActions, totalAmount, sheetOverlay, updateCartCount, isRenderingHomePage,
    updateActiveNav, setLanguage
} from './app_config.js';

import { getDocs, query, orderBy, where, limit, getDoc, doc, deleteDoc, addDoc, updateDoc, setDoc, startAfter, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { renderAdminAnnouncementsList, renderSocialMediaLinks, renderMainCategories, renderSubcategories } from './app_events.js';


export function createPromoCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';

    const imageUrl = card.imageUrls[currentLanguage] || card.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
    `;

    cardElement.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            const targetCategoryId = card.categoryId;
            const categoryExists = categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                currentCategory = targetCategoryId;
                currentSubcategory = 'all';
                currentSubSubcategory = 'all';

                renderMainCategories();
                renderSubcategories(currentCategory);
                renderSubSubcategories(currentCategory, currentSubcategory);
                searchProductsInFirestore('', true);

                document.getElementById('mainCategoriesContainer').scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(-1);
    });
    
    cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(1);
    });

    return cardElement;
}

export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';

    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }
    
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[currentLanguage] && product.shippingInfo[currentLanguage].trim();

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
        <div class="product-actions" style="display: ${sessionStorage.getItem('isAdmin') === 'true' ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');

        if (addToCartButton) {
            addToCart(product.id);
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
        } else if (target.closest('.edit-btn')) {
            editProduct(product.id);
        } else if (target.closest('.delete-btn')) {
            deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id);
        } else if (!target.closest('a')) {
            showProductDetails(product);
        }
    });
    return productCard;
}

export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

export function renderSkeletonLoader() {
    skeletonLoader.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        skeletonLoader.appendChild(skeletonCard);
    }
    skeletonLoader.style.display = 'grid';
    productsContainer.style.display = 'none';
    loader.style.display = 'none';
}

export function renderProducts() {
    productsContainer.innerHTML = '';
    if (!products || products.length === 0) {
        return;
    }

    products.forEach(item => {
        let element;
        if (item.isPromoCard) {
            element = createPromoCardElement(item);
        } else {
            element = createProductCardElement(item);
        }
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });

    setupScrollAnimations();
}

export async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';

    const header = document.createElement('div');
    header.className = 'section-title-header';

    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    
    container.appendChild(header);

    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container';
    container.appendChild(productsScroller);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

export async function renderCategorySections() {
    const mainContainer = document.createElement('div');
    const categoriesToRender = categories.filter(cat => cat.id !== 'all');
    categoriesToRender.sort((a, b) => (a.order || 99) - (b.order || 99));

    for (const category of categoriesToRender) {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';
        
        const header = document.createElement('div');
        header.className = 'section-title-header';

        const title = document.createElement('h3');
        title.className = 'section-title-main';
        const categoryName = category['name_' + currentLanguage] || category.name_ku_sorani;
        title.innerHTML = `<i class="${category.icon}"></i> ${categoryName}`;
        header.appendChild(title);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = () => {
            currentCategory = category.id;
            currentSubcategory = 'all';
            currentSubSubcategory = 'all';
            renderMainCategories();
            renderSubcategories(currentCategory);
            searchProductsInFirestore('', true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        header.appendChild(seeAllLink);

        sectionContainer.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        sectionContainer.appendChild(productsScroller);

        try {
            const q = query(
                productsCollection,
                where('categoryId', '==', category.id),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const product = { id: doc.id, ...doc.data() };
                    const card = createProductCardElement(product);
                    productsScroller.appendChild(card);
                });
                mainContainer.appendChild(sectionContainer);
            }
        } catch (error) {
            console.error(`Error fetching products for category ${category.id}:`, error);
        }
    }
    return mainContainer;
}

export async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    container.appendChild(productsGrid);

    try {
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

export async function renderHomePageContent() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (isRenderingHomePage) {
        console.log("HomePage is already rendering. Skipping duplicate call.");
        return;
    }
    isRenderingHomePage = true;
    
    try {
        renderSkeletonLoader();
        homeSectionsContainer.innerHTML = '';
        
        if (allPromoCards.length === 0) {
            const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
            const promoSnapshot = await getDocs(promoQuery);
            allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
        }

        if (allPromoCards.length > 0) {
            if (currentPromoCardIndex >= allPromoCards.length) currentPromoCardIndex = 0;
            const promoCardElement = createPromoCardElement(allPromoCards[currentPromoCardIndex]);
            const promoGrid = document.createElement('div');
            promoGrid.className = 'products-container';  
            promoGrid.style.marginBottom = '24px';
            promoGrid.appendChild(promoCardElement);
            homeSectionsContainer.appendChild(promoGrid);
            startPromoRotation();
        }

        const [newestSection, categorySections, allProductsSection] = await Promise.all([
            renderNewestProductsSection(),
            renderCategorySections(),
            renderAllProductsSection()
        ]);
        
        if (newestSection) homeSectionsContainer.appendChild(newestSection);
        if (categorySections) homeSectionsContainer.appendChild(categorySections);
        if (allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p>هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        skeletonLoader.style.display = 'none';
        isRenderingHomePage = false;
    }
}

export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && currentCategory === 'all' && currentSubcategory === 'all' && currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        if (isNewSearch) {
            productsContainer.style.display = 'none';
            scrollTrigger.style.display = 'none';
            homeSectionsContainer.style.display = 'block';
            await renderHomePageContent();
        }
        return;
    } else {
        homeSectionsContainer.innerHTML = '';
        homeSectionsContainer.style.display = 'none';
    }

    if (isLoadingMoreProducts) return;
    
    if (isNewSearch) {
        allProductsLoaded = false;
        lastVisibleProductDoc = null;
        products.splice(0, products.length);
        renderSkeletonLoader();
    }
    
    if (allProductsLoaded && !isNewSearch) return;

    isLoadingMoreProducts = true;
    loader.style.display = 'block';

    try {
        let productsQuery = collection(dbRef, "products");
        
        if (currentCategory && currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", currentCategory));
        }
        if (currentSubcategory && currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", currentSubcategory));
        }
        if (currentSubSubcategory && currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", currentSubSubcategory));
        }
        
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, 
                where('searchableName', '>=', finalSearchTerm), 
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }
        
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        if (lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(lastVisibleProductDoc));
        }
        
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            products.splice(0, products.length, ...newProducts);
        } else {
            products.push(...newProducts); 
        }
        
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
            allProductsLoaded = false;
            scrollTrigger.style.display = 'block';
        }

        lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        
        renderProducts();

        if (products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ కాڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}


export function addToCart(productId) {
    const allFetchedProducts = [...products]; 
    let product = allFetchedProducts.find(p => p.id === productId);

    if(!product){
        console.warn("Product not found in local 'products' array. Trying to fetch...");
        getDoc(doc(dbRef, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = cart.find(item => item.id === productId);
                if (existingItem) { existingItem.quantity++; }
                else { cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 }); }
                saveCart();
                showNotification(t('product_added_to_cart'));
            }
        });
        return;
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) { existingItem.quantity++; }
    else { cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 }); }
    saveCart();
    showNotification(t('product_added_to_cart'));
}

export function createProductImageInputs(imageUrls = []) {
    imageInputsContainer.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const url = imageUrls[i] || '';
        const isRequired = i === 0 ? 'required' : '';
        const placeholder = i === 0 ? 'لینکی وێنەی یەکەم (سەرەکی)' : `لینکی وێنەی ${['دووەم', 'سێیەم', 'چوارەم'][i-1]}`;
        const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group';
        inputGroup.innerHTML = `<input type="text" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}><img src="${previewSrc}" class="image-preview-small" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">`;
        imageInputsContainer.appendChild(inputGroup);
    }
}

export async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
    const container = document.getElementById('subSubcategorySelectContainer');
    const select = document.getElementById('productSubSubcategoryId');
    
    if (!mainCategoryId || !subcategoryId) {
        container.style.display = 'none';
        select.innerHTML = '';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    select.disabled = true;
    container.style.display = 'block';

    try {
        const ref = collection(dbRef, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        select.innerHTML = '<option value="">-- هیچ --</option>'; 
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const subSubcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subSubcat.id;
                option.textContent = subSubcat.name_ku_sorani;
                if (subSubcat.id === selectedSubSubcategoryId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching sub-subcategories for form:", error);
        select.innerHTML = '<option value="" disabled>هەڵەیەک ڕوویدا</option>';
    } finally {
        select.disabled = false;
    }
}

export async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
    if (!categoryId) {
        subcategorySelectContainer.style.display = 'none';
        subSubcategorySelectContainer.style.display = 'none';
        return;
    }

    productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    productSubcategorySelect.disabled = true;
    subcategorySelectContainer.style.display = 'block';

    try {
        const subcategoriesQuery = collection(dbRef, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';

        if (querySnapshot.empty) {
            productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
            subSubcategorySelectContainer.style.display = 'none';
        } else {
            querySnapshot.docs.forEach(doc => {
                const subcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subcat.id;
                option.textContent = subcat.name_ku_sorani || subcat.id;
                if (subcat.id === selectedSubcategoryId) {
                    option.selected = true;
                }
                productSubcategorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching subcategories for form:", error);
        productSubcategorySelect.innerHTML = '<option value="" disabled selected>هەڵەیەک ڕوویدا</option>';
    } finally {
        productSubcategorySelect.disabled = false;
    }
}

export async function editProduct(productId) {
    const productRef = doc(dbRef, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        showNotification(t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };

    editingProductId = productId;
    formTitle.textContent = 'دەستکاری کردنی کاڵا';
    productForm.reset();

    if (product.name && typeof product.name === 'object') {
        document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
        document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
        document.getElementById('productNameAr').value = product.name.ar || '';
    } else {
        document.getElementById('productNameKuSorani').value = product.name;
        document.getElementById('productNameKuBadini').value = '';
        document.getElementById('productNameAr').value = '';
    }
    
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.originalPrice || '';

    const categoryId = product.categoryId || product.category;
    document.getElementById('productCategoryId').value = categoryId;

    if (product.description) {
        document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
        document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
        document.getElementById('productDescriptionAr').value = product.description.ar || '';
    }

    const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
    createProductImageInputs(imageUrls);
    document.getElementById('productExternalLink').value = product.externalLink || '';
    
    if (product.shippingInfo) {
        document.getElementById('shippingInfoKuSorani').value = product.shippingInfo.ku_sorani || '';
        document.getElementById('shippingInfoKuBadini').value = product.shippingInfo.ku_badini || '';
        document.getElementById('shippingInfoAr').value = product.shippingInfo.ar || '';
    } else {
        document.getElementById('shippingInfoKuSorani').value = '';
        document.getElementById('shippingInfoKuBadini').value = '';
        document.getElementById('shippingInfoAr').value = '';
    }

    await populateSubcategoriesDropdown(categoryId, product.subcategoryId);
    await populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);

    productForm.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    openPopup('productFormModal', 'modal');
}


export async function deleteProduct(productId) {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(dbRef, "products", productId));
        showNotification(t('product_deleted'), 'success');
        searchProductsInFirestore(searchInput.value, true);
    } catch (error) {
        showNotification(t('product_delete_error'), 'error');
    }
}

export function renderCart() {
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons();

    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

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
    totalAmount.textContent = total.toLocaleString();
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

export function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { saveCart(); renderCart(); }
    }
}

export function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

export function generateOrderMessage() {
    if (cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

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

export function populateParentCategorySelect() {
    const select = document.getElementById('parentCategorySelect');
    select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
    try {
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat['name_' + currentLanguage] || cat.name_ku_sorani;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating parent category select:", error);
        select.innerHTML = '<option value="">-- هەڵەیەک ڕوویدا --</option>';
    }
}

export async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = '';

    const methodsCollection = collection(dbRef, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt"));

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const method = { id: doc.id, ...doc.data() };
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn';
        btn.style.backgroundColor = method.color;

        const name = method['name_' + currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessage();
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

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
                    link = value;
                    break;
            }

            if (link) {
                window.open(link, '_blank');
            }
        };

        container.appendChild(btn);
    });
}

export async function deleteContactMethod(methodId) {
    if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
        try {
            const methodRef = doc(dbRef, 'settings', 'contactInfo', 'contactMethods', methodId);
            await deleteDoc(methodRef);
            showNotification('شێوازەکە سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting contact method: ", error);
            showNotification('هەڵەیەک لە сڕینەوە ڕوویدا', 'error');
        }
    }
}

export function renderContactMethodsAdmin() {
    const container = document.getElementById('contactMethodsListContainer');
    const methodsCollection = collection(dbRef, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const name = method['name_' + currentLanguage] || method.name_ku_sorani;

            const item = document.createElement('div');
            item.className = 'social-link-item';
            item.innerHTML = `
                <div class="item-info">
                    <i class="${method.icon}" style="color: ${method.color};"></i>
                    <div class="item-details">
                        <span class="item-name">${name}</span>
                        <span class="item-value">${method.value}</span>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;

            item.querySelector('.delete-btn').onclick = () => deleteContactMethod(method.id);
            container.appendChild(item);
        });
    });
}

export async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(dbRef, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

export async function loadPoliciesForAdmin() {
    try {
        const docRef = doc(dbRef, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            document.getElementById('policiesContentKuSorani').value = policies.ku_sorani || '';
            document.getElementById('policiesContentKuBadini').value = policies.ku_badini || '';
            document.getElementById('policiesContentAr').value = policies.ar || '';
        }
    } catch (error) {
        console.error("Error loading policies for admin:", error);
    }
}

export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    if (!getLocationBtn) return;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
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
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case 1:
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                break;
            case 2:
                message = 'شوێنەکەت نەدۆزرایەوە';
                break;
            case 3:
                message = 'کاتی داواکارییەکە تەواو بوو';
                break;
            default:
                message = 'هەڵەیەکی نادیار ڕوویدا';
                break;
        }
        showNotification(message, 'error');
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}

export function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            searchProductsInFirestore(currentSearch, false);
        }
    }, {
        root: null,
        threshold: 0.1
    });

    observer.observe(trigger);
}

export function renderPromoCardsAdminList() {
    const container = document.getElementById('promoCardsListContainer');
    const q = query(promoCardsCollection, orderBy("order", "asc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ کاردێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const card = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'admin-notification-item'; // Re-using style
            item.innerHTML = `
                <div class="admin-notification-details" style="align-items: center; display: flex;">
                    <img src="${card.imageUrls.ku_sorani}" style="width: 40px; height: 40px; object-fit: cover; margin-left: 10px; border-radius: 4px;">
                    <div class="notification-title">کارتی ڕیزبەندی: ${card.order}</div>
                </div>
                <div>
                    <button class="edit-btn small-btn" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn small-btn" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            item.querySelector('.edit-btn').onclick = () => editPromoCard(card);
            item.querySelector('.delete-btn').onclick = () => deletePromoCard(card.id);
            container.appendChild(item);
        });
    });
}

export function editPromoCard(card) {
    document.getElementById('editingPromoCardId').value = card.id;
    document.getElementById('promoCardImageKuSorani').value = card.imageUrls.ku_sorani;
    document.getElementById('promoCardImageKuBadini').value = card.imageUrls.ku_badini;
    document.getElementById('promoCardImageAr').value = card.imageUrls.ar;
    document.getElementById('promoCardTargetCategory').value = card.categoryId;
    document.getElementById('promoCardOrder').value = card.order;
    document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    
    document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth' });
}

export async function deletePromoCard(cardId) {
    if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
        try {
            await deleteDoc(doc(dbRef, "promo_cards", cardId));
            showNotification('کارتەکە سڕدرایەوە', 'success');
        } catch (error) {
            showNotification('هەڵەیەک ڕوویدا', 'error');
        }
    }
}

export async function renderCategoryManagementUI() {
    const container = document.getElementById('categoryListContainer');
    if (!container) return;
    container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

    let content = '';
    const mainCategoriesQuery = query(collection(dbRef, "categories"), orderBy("order", "asc"));
    const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);

    for (const mainDoc of mainCategoriesSnapshot.docs) {
        const mainCategory = { id: mainDoc.id, ...mainDoc.data() };
        const mainPath = `categories/${mainCategory.id}`;
        content += `
            <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong><i class="${mainCategory.icon}"></i> ${mainCategory.name_ku_sorani} (ڕیزبەندی: ${mainCategory.order || 0})</strong>
                    <div>
                        <button class="edit-btn small-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn" data-path="${mainPath}" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;

        const subCategoriesQuery = query(collection(dbRef, mainPath, "subcategories"), orderBy("order", "asc"));
        const subCategoriesSnapshot = await getDocs(subCategoriesQuery);
        for (const subDoc of subCategoriesSnapshot.docs) {
            const subCategory = { id: subDoc.id, ...subDoc.data() };
            const subPath = `${mainPath}/subcategories/${subCategory.id}`;
            content += `
                <div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>- ${subCategory.name_ku_sorani} (ڕیزبەندی: ${subCategory.order || 0})</span>
                        <div>
                            <button class="edit-btn small-btn" data-path="${subPath}" data-level="2"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn" data-path="${subPath}" data-name="${subCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            
            const subSubCategoriesQuery = query(collection(dbRef, subPath, "subSubcategories"), orderBy("order", "asc"));
            const subSubCategoriesSnapshot = await getDocs(subSubCategoriesQuery);
            for (const subSubDoc of subSubCategoriesSnapshot.docs) {
                const subSubCategory = { id: subSubDoc.id, ...subSubDoc.data() };
                const subSubPath = `${subPath}/subSubcategories/${subSubCategory.id}`;
                content += `
                    <div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>-- ${subSubCategory.name_ku_sorani} (ڕیزبەندی: ${subSubCategory.order || 0})</span>
                            <div>
                                <button class="edit-btn small-btn" data-path="${subSubPath}" data-level="3"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn" data-path="${subSubPath}" data-name="${subSubCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;
            }
        }
    }

    container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.path, btn.dataset.level));
    });
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteCategory(btn.dataset.path, btn.dataset.name));
    });
}

export async function openEditCategoryModal(docPath, level) {
    const docRef = doc(dbRef, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        showNotification('جۆرەکە نەدۆزرایەوە!', 'error');
        return;
    }
    const category = docSnap.data();
    
    document.getElementById('editCategoryDocPath').value = docPath;
    document.getElementById('editCategoryLevel').value = level;
    
    document.getElementById('editCategoryNameKuSorani').value = category.name_ku_sorani || '';
    document.getElementById('editCategoryNameKuBadini').value = category.name_ku_badini || '';
    document.getElementById('editCategoryNameAr').value = category.name_ar || '';
    document.getElementById('editCategoryOrder').value = category.order || 0;

    const iconField = document.getElementById('editIconField');
    if (level === '1') {
        iconField.style.display = 'block';
        document.getElementById('editCategoryIcon').value = category.icon || '';
    } else {
        iconField.style.display = 'none';
    }

    openPopup('editCategoryModal', 'modal');
}

export async function handleDeleteCategory(docPath, categoryName) {
    const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.`);
    if (confirmation) {
        try {
            await deleteDoc(doc(dbRef, docPath));
            showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting category: ", error);
            showNotification('هەڵەیەک ڕوویدا لە کاتی sڕینەوە', 'error');
        }
    }
}

export function startPromoRotation() {
    if (promoRotationInterval) {
        clearInterval(promoRotationInterval);
    }
    if (allPromoCards.length > 1) {
        promoRotationInterval = setInterval(rotatePromoCard, 5000);
    }
}

export function rotatePromoCard() {
    if (allPromoCards.length <= 1) return;
    currentPromoCardIndex = (currentPromoCardIndex + 1) % allPromoCards.length;
    displayPromoCard(currentPromoCardIndex);
}

export function changePromoCard(direction) {
    if (allPromoCards.length <= 1) return;

    currentPromoCardIndex += direction;

    if (currentPromoCardIndex >= allPromoCards.length) {
        currentPromoCardIndex = 0;
    } else if (currentPromoCardIndex < 0) {
        currentPromoCardIndex = allPromoCards.length - 1;
    }

    displayPromoCard(currentPromoCardIndex);
    startPromoRotation(); // Reset the timer
}

export function displayPromoCard(index) {
    const promoCardSlot = document.querySelector('.promo-card-grid-item');
    if (!promoCardSlot) return;

    const cardData = allPromoCards[index];
    const newCardElement = createPromoCardElement(cardData);
    newCardElement.classList.add('product-card-reveal');

    promoCardSlot.style.opacity = 0;
    setTimeout(() => {
        if (promoCardSlot.parentNode) {
            promoCardSlot.parentNode.replaceChild(newCardElement, promoCardSlot);
            setTimeout(() => {
                newCardElement.classList.add('visible');
            }, 10);
        }
    }, 300);
}