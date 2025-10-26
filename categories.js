// categories.js: Fonksiyonên taybet bi curan (categories)

// Import Firestore functions directly from Firebase SDK
import {
    collection, query, orderBy, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Import necessary variables and shared functions
import {
    db, // Firestore instance
    state, // Global state (for language, categories)
    categoriesCollection // Collection reference
} from './app-setup.js';

import {
    t,                // Translation function
    navigateToFilter, // Navigation function
    closeCurrentPopup, // Popup closing function
    showPage,         // Page navigation
    updateCategoryDependentUI // Function to update UI after categories load
} from './app-logic.js'; // Assuming app-logic exports these

// Fetches main categories from Firestore and updates the global state
export async function fetchCategories() {
    try {
        const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
        const snapshot = await getDocs(categoriesQuery);
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Add the 'All' category at the beginning
        state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories];
        console.log("Categories fetched and updated:", state.categories);
        updateCategoryDependentUI(); // Call function to update relevant UI parts
    } catch (error) {
        console.error("Error fetching main categories:", error);
        // Optionally show an error to the user
    }
}

// Renders the main category buttons (usually at the top)
export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous buttons

    if (!state.categories || state.categories.length === 0) {
        console.warn("renderMainCategories called before categories were loaded.");
        return; // Don't render if categories aren't loaded yet
    }


    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Highlight the currently active category button
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // Get the category name in the current language, fallback to Sorani or ID
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani || cat.id); // Added fallback to id

        // Set button content with icon and name
        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Added default icon

        // Add click event to navigate/filter
        btn.onclick = async () => {
             // Reset search and sub/subsub categories when a main category is clicked
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: '' // Clear search when changing main category
            });
             // Ensure the main page is shown (in case navigation came from elsewhere)
             showPage('mainPage');
        };

        container.appendChild(btn);
    });
}

// Renders the category list inside the bottom sheet
export function renderCategoriesSheet() {
    const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous list

    if (!state.categories || state.categories.length === 0) {
        console.warn("renderCategoriesSheet called before categories were loaded.");
        return; // Don't render if categories aren't loaded yet
    }

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        // Highlight active category in the sheet as well
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani || cat.id);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Added default icon

        // Click handler for sheet buttons
        btn.onclick = async () => {
             // Reset filters and navigate
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
            closeCurrentPopup(); // Close the sheet after selection
            showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

// Renders the subcategory buttons below the main categories
// (Only shows if a main category other than 'all' is selected)
export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // Clear previous subcategories
    subcategoriesContainer.style.display = 'none'; // Hide by default

    // Don't show subcategories if 'all' main category is selected or no categoryId provided
    if (!categoryId || categoryId === 'all') {
        return;
    }

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const fetchedSubcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Only display the container if there are subcategories
        if (fetchedSubcategories.length === 0) return;

        subcategoriesContainer.style.display = 'flex'; // Show the container

        // Add 'All' button for the subcategory level
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        // Click handler for 'All' subcategory button
        allBtn.onclick = async () => {
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all' // Reset sub-subcategory as well
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Render actual subcategory buttons
        fetchedSubcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani || subcat.id;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent pixel
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            // Click handler for specific subcategory buttons
            subcatBtn.onclick = () => {
                 // Navigate to the subcategory detail page
                 if (typeof showSubcategoryDetailPage === 'function') {
                    showSubcategoryDetailPage(categoryId, subcat.id);
                 } else { // Fallback if detail page function isn't available
                    navigateToFilter({ subcategory: subcat.id, subSubcategory: 'all' });
                 }
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error(`Error fetching subcategories for category ${categoryId}: `, error);
        subcategoriesContainer.style.display = 'none'; // Hide if error
    }
}

// Function to populate category dropdowns used in Admin forms
export function populateAdminCategoryDropdowns() {
    const categories = state.categories; // Get categories from global state
     if (!categories || categories.length <= 1) { // Check if categories are loaded (length > 1 because of 'all')
          console.warn("Admin category dropdowns cannot be populated yet - categories not loaded.");
          return;
     }
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

    const dropdownsInfo = [
        { id: 'parentCategorySelect', defaultTextKey: 'choose_category_first' }, // For adding subcategory
        { id: 'parentMainCategorySelectForSubSub', defaultTextKey: 'choose_main_category_first' }, // For adding sub-subcategory
        { id: 'productCategoryId', defaultTextKey: 'choose_main_category_product' }, // For product form
        { id: 'promoCardTargetCategory', defaultTextKey: 'choose_category_link' }, // For promo card form
        { id: 'brandTargetMainCategory', defaultTextKey: 'all_categories_label', includeAll: true }, // For brand form
        { id: 'shortcutCardMainCategory', defaultTextKey: 'all_products', includeAll: true } // For shortcut card form
    ];

     // Default texts (add more keys as needed)
     const defaultTexts = {
          choose_category_first: '-- جۆری سەرەکی هەڵبژێرە --',
          choose_main_category_first: '-- جۆری سەرەکی هەڵبژێرە --',
          choose_main_category_product: '-- جۆری سەرەکی هەڵبژێرە --',
          choose_category_link: '-- جۆرێک هەڵبژێرە بۆ لینک --',
          all_categories_label: t('all_categories_label') || 'هەموو جۆرەکان', // Use translation
          all_products: t('all_products') || 'هەموو کاڵاکان' // Use translation
     };


    dropdownsInfo.forEach(info => {
        const select = document.getElementById(info.id);
        if (select) {
            const defaultText = defaultTexts[info.defaultTextKey] || '-- هەڵبژێرە --';
            // Set the first option (default/placeholder)
             select.innerHTML = `<option value="" ${info.includeAll ? '' : 'disabled selected'}>${defaultText}</option>`;

            // Populate with actual categories
            categoriesWithoutAll.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                // Display name in current language or fallback
                option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani || cat.id;
                select.appendChild(option);
            });
        } else {
             console.warn(`Admin dropdown with ID "${info.id}" not found.`);
        }
    });

     // Special handling for the sub-subcategory parent dropdown (initially disabled)
     const subSubParentSelect = document.getElementById('parentSubcategorySelectForSubSub');
     if (subSubParentSelect) {
          subSubParentSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی جۆری سەرەکی بە --</option>';
          subSubParentSelect.disabled = true;
     }
}

// Function to populate subcategory dropdown based on selected main category (for Admin forms)
export async function populateAdminSubcategoriesDropdown(mainCategoryId, subCategorySelectId, includeEmptyOption = true, defaultText = '-- جۆری لاوەکی --') {
    const select = document.getElementById(subCategorySelectId);
    if (!select) return;

    select.innerHTML = `<option value="" disabled selected>...چاوەڕێ بە</option>`;
    select.disabled = true;

    if (!mainCategoryId) {
        select.innerHTML = `<option value="" disabled selected>${defaultText}</option>`;
        select.disabled = true;
        return;
    }

    try {
        const subcategoriesQuery = collection(db, "categories", mainCategoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        if (includeEmptyOption) {
             select.innerHTML = `<option value="">${defaultText}</option>`; // E.g., "-- هەموو --" or "-- هیچ --"
        } else {
             select.innerHTML = `<option value="" disabled selected>${defaultText}</option>`; // E.g., "-- هەڵبژێرە --"
        }


        if (querySnapshot.empty && !includeEmptyOption) {
             select.innerHTML = `<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>`;
        } else {
            querySnapshot.docs.forEach(doc => {
                const subcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subcat.id;
                option.textContent = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani || subcat.id;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error(`Error fetching subcategories for admin dropdown ${subCategorySelectId}:`, error);
        select.innerHTML = '<option value="" disabled selected>هەڵەیەک ڕوویدا</option>';
    } finally {
        select.disabled = false;
    }
}


// Function to populate sub-subcategory dropdown (for Admin forms)
export async function populateAdminSubSubcategoriesDropdown(mainCategoryId, subcategoryId, subSubCategorySelectId, includeEmptyOption = true, defaultText = '-- جۆری لاوەکی لاوەکی --') {
     const select = document.getElementById(subSubCategorySelectId);
     if (!select) return;

     select.innerHTML = `<option value="" disabled selected>...چاوەڕێ بە</option>`;
     select.disabled = true;

     if (!mainCategoryId || !subcategoryId) {
          select.innerHTML = `<option value="">${defaultText}</option>`; // Show empty option if parent not selected
          select.disabled = true; // Keep disabled
          return;
     }

     try {
          const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
          const q = query(ref, orderBy("order", "asc"));
          const snapshot = await getDocs(q);

          if (includeEmptyOption) {
               select.innerHTML = `<option value="">${defaultText}</option>`;
          } else {
               select.innerHTML = `<option value="" disabled selected>${defaultText}</option>`;
          }


          if (snapshot.empty && !includeEmptyOption) {
               select.innerHTML = `<option value="" disabled selected>هیچ جۆری سێیەم نییە</option>`;
          } else {
               snapshot.forEach(doc => {
                    const subSubcat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subSubcat.id;
                    option.textContent = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani || subSubcat.id;
                    select.appendChild(option);
               });
          }
     } catch (error) {
          console.error(`Error fetching sub-subcategories for admin dropdown ${subSubCategorySelectId}:`, error);
          select.innerHTML = '<option value="" disabled selected>هەڵەیەک ڕوویدا</option>';
     } finally {
          select.disabled = false;
     }
}

