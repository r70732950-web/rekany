import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, query, orderBy, where, startAfter, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import * as state from './state.js';
import * as ui from './ui-components.js';
import { showNotification } from './ui-components.js';

const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");
export const promoCardsCollection = collection(db, "promo_cards");

export async function fetchCategories() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(categoriesQuery);
    const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.setCategories([{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]);
}

export async function fetchSubcategories(categoryId) {
    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        return [];
    }
}

export async function fetchSubSubcategories(mainCatId, subCatId) {
     try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching sub-subcategories:", error);
        return [];
    }
}


async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';

    const header = document.createElement('div');
    header.className = 'section-title-header';

    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = state.t('newest_products');
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
            const card = ui.createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderCategorySections() {
    const mainContainer = document.createElement('div');
    const categoriesToRender = state.categories.filter(cat => cat.id !== 'all');
    categoriesToRender.sort((a, b) => (a.order || 99) - (b.order || 99));

    for (const category of categoriesToRender) {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';
        
        const header = document.createElement('div');
        header.className = 'section-title-header';

        const title = document.createElement('h3');
        title.className = 'section-title-main';
        const categoryName = category['name_' + state.currentLanguage] || category.name_ku_sorani;
        title.innerHTML = `<i class="${category.icon}"></i> ${categoryName}`;
        header.appendChild(title);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = state.t('see_all');
        seeAllLink.onclick = () => {
            state.setCurrentCategory(category.id);
            state.setCurrentSubcategory('all');
            state.setCurrentSubSubcategory('all');
            ui.renderMainCategories();
            ui.renderSubcategories(state.currentCategory);
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
                    const card = ui.createProductCardElement(product);
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

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = state.t('all_products_section_title');
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
            const card = ui.createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

export async function renderHomePageContent() {
    if (state.isRenderingHomePage) {
        return;
    }
    state.setIsRenderingHomePage(true);

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    
    try {
        document.getElementById('skeletonLoader').style.display = 'grid';
        homeSectionsContainer.innerHTML = '';
        
        if (state.allPromoCards.length === 0) {
            const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
            const promoSnapshot = await getDocs(promoQuery);
            state.setAllPromoCards(promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true })));
        }

        if (state.allPromoCards.length > 0) {
            if (state.currentPromoCardIndex >= state.allPromoCards.length) state.setCurrentPromoCardIndex(0);
            const promoCardElement = ui.createPromoCardElement(state.allPromoCards[state.currentPromoCardIndex]);
            const promoGrid = document.createElement('div');
            promoGrid.className = 'products-container';  
            promoGrid.style.marginBottom = '24px';
            promoGrid.appendChild(promoCardElement);
            homeSectionsContainer.appendChild(promoGrid);
            ui.startPromoRotation();
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
        document.getElementById('skeletonLoader').style.display = 'none';
        state.setIsRenderingHomePage(false);
    }
}

export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const loader = document.getElementById('loader');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

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

    if (state.isLoadingMoreProducts) return;
    
    if (isNewSearch) {
        state.setAllProductsLoaded(false);
        state.setLastVisibleProductDoc(null);
        state.setProducts([]);
        ui.renderSkeletonLoader();
    }
    
    if (state.allProductsLoaded && !isNewSearch) return;

    state.setIsLoadingMoreProducts(true);
    loader.style.display = 'block';

    try {
        let q = query(productsCollection);
        
        if (state.currentCategory && state.currentCategory !== 'all') {
            q = query(q, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            q = query(q, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            q = query(q, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }
        
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            q = query(q, 
                where('searchableName', '>=', finalSearchTerm), 
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }
        
        if (finalSearchTerm) {
            q = query(q, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            q = query(q, orderBy("createdAt", "desc"));
        }

        if (state.lastVisibleProductDoc && !isNewSearch) {
            q = query(q, startAfter(state.lastVisibleProductDoc));
        }
        
        q = query(q, limit(state.PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(q);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        state.setProducts(isNewSearch ? newProducts : [...state.products, ...newProducts]);
        
        if (productSnapshot.docs.length < state.PRODUCTS_PER_PAGE) {
            state.setAllProductsLoaded(true);
            scrollTrigger.style.display = 'none';
        } else {
            state.setAllProductsLoaded(false);
            scrollTrigger.style.display = 'block';
        }

        state.setLastVisibleProductDoc(productSnapshot.docs[productSnapshot.docs.length - 1]);
        
        ui.renderProducts();

        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ కాڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.setIsLoadingMoreProducts(false);
        loader.style.display = 'none';
        document.getElementById('skeletonLoader').style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}

export function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);

    if (!product) {
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) { existingItem.quantity++; }
                else { state.cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 }); }
                state.saveCart();
                showNotification(state.t('product_added_to_cart'));
            }
        });
        return;
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) { existingItem.quantity++; }
    else { state.cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 }); }
    state.saveCart();
    showNotification(state.t('product_added_to_cart'));
}

export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { state.saveCart(); ui.renderCart(); }
    }
}

export function removeFromCart(productId) {
    state.setCart(state.cart.filter(item => item.id !== productId));
    state.saveCart();
    ui.renderCart();
}

export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

export function toggleFavorite(productId) {
    const productIndex = state.favorites.indexOf(productId);
    if (productIndex > -1) {
        state.favorites.splice(productIndex, 1);
        showNotification(state.t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(state.t('product_added_to_favorites'), 'success');
    }
    state.saveFavorites();

    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if(isHomeView) {
        renderHomePageContent();
    } else {
        ui.renderProducts();
    }

    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        ui.renderFavoritesPage();
    }
}

export async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = '';
    //... (The rest of this function remains the same)
}

// ... and other functions like renderPolicies, renderUserNotifications, etc.