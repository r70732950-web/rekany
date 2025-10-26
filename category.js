// category.js
// ئەم مۆدیولە بەرپرسە لە پیشاندانی جۆرەکان (Categories) لە بەشە جیاوازەکانی UI.

import {
    db,
    state,
    productsCollection,
    categoriesCollection,
    mainCategoriesContainer,
    subcategoriesContainer,
    sheetCategoriesContainer,
    productsContainerOnDetailPage,
    subSubCategoryContainerOnDetailPage,
    detailPageLoader
} from './app-setup.js';
import { t } from './utils.js';
// پشت بە product.js دەبەستین بۆ دروستکردنی کارتی کاڵاکان
import { createProductCardElement } from './product.js'; 
import { collection, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

/**
 * جۆرە سەرەکییەکان (Main Categories) لە بەشی سەرەوەی لاپەڕەی سەرەکی پیشان دەدات
 */
export function renderMainCategories() {
    if (!mainCategoriesContainer) return;
    mainCategoriesContainer.innerHTML = ''; // بەتاڵکردنەوە

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id; // دانانی ئایدی جۆر بۆ event listener

        // چالاککردنی دوگمەی جۆری هەڵبژێردراو
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // وەرگێڕانی ناوی جۆر (بۆ جۆری "هەموو")
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;
        
        // Event listener لە 'app-logic.js' (controller) ەوە لکێندراوە
        mainCategoriesContainer.appendChild(btn);
    });
}

/**
 * جۆرە لاوەکییەکان (Subcategories) لە لاپەڕەی سەرەکی پیشان دەدات
 * @param {string} categoryId - ئایدی جۆری سەرەکی
 */
export async function renderSubcategories(categoryId) {
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // بەتاڵکردنەوە

    // ئەگەر "هەموو جۆرەکان" هەڵبژێردرابوو، ئەم بەشە پیشان نادرێت
    if (categoryId === 'all') {
        return;
    }

    try {
        // هێنانی جۆرە لاوەکییەکان لە فایەربەیس
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        // پاشەکەوتکردنیان لە state بۆ بەکارهێنانی دواتر
        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0) return; // ئەگەر هیچی تێدا نەبوو، پیشانی مەدە

        // دروستکردنی دوگمەی "هەموو" بۆ جۆرە لاوەکییەکان
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        allBtn.dataset.mainCatId = categoryId;
        allBtn.dataset.subCatId = 'all'; // ئایدی "هەموو"
        
        // ئایکۆنی "هەموو" (Grid icon)
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        subcategoriesContainer.appendChild(allBtn);

        // دروستکردنی دوگمە بۆ هەر جۆرێکی لاوەکی
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
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
 * لیستی جۆرەکان لەناو "Bottom Sheet"ی جۆرەکان (Categories Sheet) پیشان دەدات
 */
export function renderCategoriesSheet() {
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // بەتاڵکردنەوە

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id; // دانانی ئایدی جۆر بۆ event listener
        
        if (state.currentCategory === cat.id) { 
            btn.classList.add('active'); 
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;
        
        // Event listener لە 'app-logic.js' (controller) ەوە لکێندراوە
        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * جۆرە لاوەکییەکانی-لاوەکی (Sub-Subcategories) لەناو لاپەڕەی وردەکاریی جۆر پیشان دەدات
 * @param {string} mainCatId - ئایدی جۆری سەرەکی
 * @param {string} subCatId - ئایدی جۆری لاوەکی
 */
export async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = subSubCategoryContainerOnDetailPage;
    if (!container) return;
    container.innerHTML = '';

    try {
        // هێنانی جۆرەکان لە فایەربەیس
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // شاردنەوەی بەشەکە ئەگەر بەتاڵ بێت
            return;
        }

        container.style.display = 'flex'; // پیشاندانی بەشەکە

        // دروستکردنی دوگمەی "هەموو"
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // "هەموو" بە شێوەی بنەڕەت چالاکە
        allBtn.dataset.id = 'all'; // ئایدی تایبەت
        
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        container.appendChild(allBtn);

        // دروستکردنی دوگمە بۆ هەر جۆرێکی لاوەکیی-لاوەکی
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // دانانی ئایدی جۆر
            
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;
            
            container.appendChild(btn);
        });
        
        // Event listenerەکان لە 'app-logic.js' ەوە لکێندراون

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none';
    }
}

/**
 * کاڵاکان لەناو لاپەڕەی وردەکاریی جۆر پیشان دەدات (بەپێی جۆری هەڵبژێردراو و گەڕان)
 * @param {string} subCatId - ئایدی جۆری لاوەکی (پێویستە)
 * @param {string} [subSubCatId='all'] - ئایدی جۆری لاوەکیی-لاوەکی (ئەگەر 'all' بێت، هەموو کاڵاکانی جۆرە لاوەکییەکە دێنێت)
 * @param {string} [searchTerm=''] - وشەی گەڕان (ئەگەر هەبێت)
 */
export async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    if (!productsContainerOnDetailPage || !detailPageLoader) return;
    
    detailPageLoader.style.display = 'block';
    productsContainerOnDetailPage.innerHTML = '';

    try {
        let productsQuery;
        
        // دیاریکردنی کوێری بنەڕەت بەپێی جۆری هەڵبژێردراو
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // زیادکردنی فلتەری گەڕان ئەگەر هەبێت
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // ئەگەر گەڕان هەبوو، پێویستە 'orderBy'ی یەکەم لەسەر 'searchableName' بێت
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // ئەگەر گەڕان نەبوو، تەنها بەپێی کاتی دروستکردن ڕیزیان دەکەین
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainerOnDetailPage.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // بەکارهێنانی فەنکشنی هاوبەش
                productsContainerOnDetailPage.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page:`, error);
        productsContainerOnDetailPage.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        detailPageLoader.style.display = 'none'; // شاردنەوەی لۆدەر
    }
}
