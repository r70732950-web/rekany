// categories.js: Fonksiyonên taybet bi kategoriyan

import { db, collection, query, orderBy, getDocs, doc, getDoc } from './app-setup.js';
import { state, t } from './app-setup.js'; // state û t import bikin
import { navigateToFilter, showSubcategoryDetailPage, closeCurrentPopup } from './app-logic.js'; // Fonksiyonên pêwîst import bikin

// Function to fetch all category levels
export async function fetchCategories() {
    const categoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
    const snapshot = await getDocs(categoriesQuery);
    const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]; // Add 'All' category
    console.log("Categories fetched and updated:", state.categories);
}

// Function to render main category buttons
export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
             // Use navigateToFilter from app-logic.js
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
        };

        container.appendChild(btn);
    });
}

// Function to render categories in the bottom sheet
export function renderCategoriesSheet() {
    const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
            // Use navigateToFilter from app-logic.js
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
            // Use closeCurrentPopup from app-logic.js
            closeCurrentPopup();
            // Assuming showPage is handled in app-logic.js or called after navigation
            // showPage('mainPage');
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

// Function to render subcategory buttons (used on main page)
export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = '';

    if (categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Hide if 'all' is selected
        return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show otherwise

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const fetchedSubcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (fetchedSubcategories.length === 0) {
            subcategoriesContainer.style.display = 'none'; // Hide if no subcategories
            return;
        }

        // Add 'All' button for subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
            // Use navigateToFilter from app-logic.js
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Add actual subcategory buttons
        fetchedSubcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            subcatBtn.onclick = () => {
                // Use showSubcategoryDetailPage from app-logic.js
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories for main page: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

// Function to populate category dropdown in product form
export function populateCategoryDropdown() {
    const productCategorySelect = document.getElementById('productCategoryId');
    if (!productCategorySelect) return;

    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

// Function to populate subcategories dropdown in product/admin forms
export async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
    const subcategorySelectContainer = document.getElementById('subcategorySelectContainer'); // Used in product form
    const productSubcategorySelect = document.getElementById('productSubcategoryId'); // Used in product form
    const parentSubcategorySelect = document.getElementById('parentSubcategorySelectForSubSub'); // Used in admin form

    if (!categoryId) {
        if(subcategorySelectContainer) subcategorySelectContainer.style.display = 'none';
        if(document.getElementById('subSubcategorySelectContainer')) document.getElementById('subSubcategorySelectContainer').style.display = 'none'; // Product form
        if (parentSubcategorySelect) {
             parentSubcategorySelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
             parentSubcategorySelect.disabled = true;
        }
        return;
    }

    const selectElement = productSubcategorySelect || parentSubcategorySelect; // Choose the correct select
    if (!selectElement) return; // Exit if neither select exists

    if(subcategorySelectContainer) subcategorySelectContainer.style.display = 'block'; // Show product form container
    selectElement.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    selectElement.disabled = true;

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const defaultOptionText = selectElement === productSubcategorySelect ? '-- جۆری لاوەکی هەڵبژێرە --' : '-- جۆری لاوەکی هەڵبژێرە (پێویستە) --';
        selectElement.innerHTML = `<option value="" disabled selected>${defaultOptionText}</option>`;

        if (querySnapshot.empty) {
            selectElement.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
            if(document.getElementById('subSubcategorySelectContainer')) document.getElementById('subSubcategorySelectContainer').style.display = 'none'; // Hide sub-sub in product form
        } else {
            querySnapshot.docs.forEach(doc => {
                const subcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subcat.id;
                option.textContent = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
                if (subcat.id === selectedSubcategoryId) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching subcategories for dropdown:", error);
        selectElement.innerHTML = '<option value="" disabled selected>هەڵەیەک ڕوویدا</option>';
    } finally {
        selectElement.disabled = false;
    }
}

// Function to populate sub-subcategories dropdown in product/admin forms
export async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
    const container = document.getElementById('subSubcategorySelectContainer'); // Product form
    const select = document.getElementById('productSubSubcategoryId'); // Product form

    // Exit if the product form elements don't exist (e.g., when called from admin)
    if (!container || !select) return;

    if (!mainCategoryId || !subcategoryId) {
        container.style.display = 'none';
        select.innerHTML = '';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    select.disabled = true;
    container.style.display = 'block';

    try {
        const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        select.innerHTML = '<option value="">-- هیچ --</option>'; // Allow not selecting a sub-sub
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const subSubcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subSubcat.id;
                option.textContent = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
                if (subSubcat.id === selectedSubSubcategoryId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching sub-subcategories for dropdown:", error);
        select.innerHTML = '<option value="" disabled>هەڵەیەک ڕوویدا</option>';
    } finally {
        select.disabled = false;
    }
}

// Function to update admin category dropdowns (Moved from admin.js)
export function updateAdminCategoryDropdowns() {
    const categories = state.categories; // Use state directly
    if (categories.length <= 1) return; // Wait until categories are loaded
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

    const dropdowns = [
        { id: 'parentCategorySelect', defaultText: '-- جۆرێک هەڵبژێرە --' }, // Add Subcategory form
        { id: 'parentMainCategorySelectForSubSub', defaultText: '-- جۆرێک هەڵبژێرە --' }, // Add SubSubcategory form
        { id: 'promoCardTargetCategory', defaultText: '-- جۆرێک هەڵبژێرە --' }, // Promo Card form
        { id: 'brandTargetMainCategory', defaultText: '-- هەموو جۆرەکان --' } // Brand form
    ];

    dropdowns.forEach(d => {
        const select = document.getElementById(d.id);
        if (select) {
            const currentVal = select.value; // Preserve selection if possible
            const firstOptionHTML = d.id === 'brandTargetMainCategory'
                ? `<option value="">${d.defaultText}</option>` // Allow 'all' for brands
                : `<option value="" disabled selected>${d.defaultText}</option>`;
            select.innerHTML = firstOptionHTML;
            categoriesWithoutAll.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
                select.appendChild(option);
            });
            // Try to restore previous selection
            if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
                select.value = currentVal;
            } else if (d.id !== 'brandTargetMainCategory') { // Don't reset brand target if 'all' was selected
                select.value = '';
            }
        }
    });
}

// Function to update shortcut card category dropdowns (Moved from admin.js)
export function updateShortcutCardCategoryDropdowns() {
    const categories = state.categories; // Use state directly
    if (categories.length <= 1) return;
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    const mainSelect = document.getElementById('shortcutCardMainCategory');
    if (!mainSelect) return;

    const currentVal = mainSelect.value; // Preserve selection
    mainSelect.innerHTML = '<option value="">-- هەموو کاڵاکان --</option>'; // Default option
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        mainSelect.appendChild(option);
    });
    // Try to restore previous selection
    if (currentVal && mainSelect.querySelector(`option[value="${currentVal}"]`)) {
        mainSelect.value = currentVal;
    } else {
        mainSelect.value = '';
    }
    // Trigger change event if value was restored to load subcategories
    if (mainSelect.value) {
        mainSelect.dispatchEvent(new Event('change'));
    }
}
