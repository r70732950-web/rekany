// category.js
// Berpirs e ji bo nîşandana hemî beşên têkildarî kategoriyan

import {
    db,
    state,
    productsCollection
} from './app-setup.js';
import { getDocs, collection, query, orderBy, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { t } from './utils.js';
// === START: ÇAKKIRIN / FIX ===
// Em êdî van ji app-setup import nakin, ji ber ku ew taybet in ji bo vê modulê
/*
import {
    detailPageLoader,
    productsContainerOnDetailPage,
    subSubCategoryContainerOnDetailPage
} from './app-setup.js';
*/
// === END: ÇAKKIRIN / FIX ===
import { createProductCardElement } from './product.js'; // Ji bo nîşandana kałayan

/**
 * Kategoriyên sereke di rûpela malê de (home page) nîşan dide
 */
export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Paqij bike

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.action = 'navigate-main-category'; // Action ji bo event delegation
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;
        container.appendChild(btn);
    });
}

/**
 * Jêr-kategoriyan (subcategories) di rûpela malê de nîşan dide
 * @param {string} categoryId - ID ya kategoriya sereke ya hilbijartî
 */
export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = '';

    // Heke 'Hemî' hatibe hilbijartin, jêr-kategoriyan nîşan nede
    if (categoryId === 'all') {
        return;
    }

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0) return; // Heke vala be, tiştek nîşan nede

        // Bişkoka "Hemî" ji bo jêr-kategoriyan
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        allBtn.dataset.action = 'navigate-sub-category';
        allBtn.dataset.mainCatId = categoryId;
        allBtn.dataset.subCatId = 'all';
        
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        subcategoriesContainer.appendChild(allBtn);

        // Bişkokên jêr-kategoriyên din
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
            subcatBtn.dataset.action = 'navigate-sub-category';
            subcatBtn.dataset.mainCatId = categoryId;
            subcatBtn.dataset.subCatId = subcat.id;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
    }
}

/**
 * Kategoriyan di nav 'Categories Bottom Sheet' de nîşan dide
 */
export function renderCategoriesSheet() {
    const container = document.getElementById('sheetCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';
    
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        btn.dataset.action = 'navigate-sheet-category'; // Action ji bo event delegation
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;
        container.appendChild(btn);
    });
}

/**
 * Merc û Rêbazan (Policies) di nav 'Terms Sheet' de nîşan dide
 */
export async function renderPolicies() {
    // === START: ÇAKKIRIN / FIX ===
    // Em êdî ji app-setup import nakin, em bi rêya ID dibînin
    const termsContentContainer = document.getElementById('termsContentContainer');
    if (!termsContentContainer) return;
    // === END: ÇAKKIRIN / FIX ===

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


// --- Fonksiyonên Taybet bi Rûpela Hûrguliyên Kategoriyê ---

/**
 * Jêr-jêr-kategoriyan (sub-subcategories) di rûpela hûrguliyên kategoriyê de nîşan dide
 * @param {string} mainCatId - ID ya kategoriya sereke
 * @param {string} subCatId - ID ya jêr-kategoriya hilbijartî
 */
export async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    // === START: ÇAKKIRIN / FIX ===
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    // === END: ÇAKKIRIN / FIX ===
    
    container.innerHTML = '';

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        // Bişkoka "Hemî"
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Bi default "Hemî" çalak e
        allBtn.dataset.action = 'filter-sub-sub-category';
        allBtn.dataset.id = 'all';
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        container.appendChild(allBtn);

        // Bişkokên din
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.action = 'filter-sub-sub-category';
            btn.dataset.id = subSubcat.id;
            
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none';
    }
}

/**
 * Kałayan di rûpela hûrguliyên kategoriyê de li gorî fîltera hilbijartî nîşan dide
 * @param {string} subCatId - ID ya jêr-kategoriya sereke ya rûpelê
 * @param {string} [subSubCatId='all'] - ID ya jêr-jêr-kategoriya hilbijartî
 * @param {string} [searchTerm=''] - Peyva lêgerînê
 */
export async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    // === START: ÇAKKIRIN / FIX ===
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    if (!productsContainer || !loader) return;
    // === END: ÇAKKIRIN / FIX ===
    
    loader.style.display = 'block';
    productsContainer.innerHTML = '';

    try {
        let productsQuery;
        // Sazkirina query li gorî fîlterê
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Zêdekirina lêgerînê (search)
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Divê 'orderBy' ya yekem li gorî 'where' ya lêgerînê be
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Rêzkirina normal heke lêgerîn nebe
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page:`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loader.style.display = 'none';
    }
}

