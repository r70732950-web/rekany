// admin-helpers.js
// Contains helper functions used by or related to the admin logic (admin.js).

import { db, state } from './app-setup.js'; // Import necessary shared state/config
import { getCategories, fetchSubcategories, fetchSubSubcategories } from './data-logic.js'; // Import data fetching functions if needed by admin dropdowns
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Import necessary Firestore functions

/**
 * Clears the product cache and optionally triggers a UI refresh.
 * Called after admin actions that modify product/category/layout data.
 */
export function clearProductCache() {
    console.log("Admin action triggered: Clearing product cache and home page content.");
    state.productCache = {}; // Clear the local cache object

    // Clear the rendered home page sections to force re-render on next view
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = '';
         // Also clear any stored slider intervals associated with the old home page render
         Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
             if (state.sliderIntervals[layoutId]) {
                 clearInterval(state.sliderIntervals[layoutId]);
             }
         });
         state.sliderIntervals = {};
    }

    // Optionally, if the user is currently viewing the main page product list,
    // trigger a refresh immediately.
    const mainPage = document.getElementById('mainPage');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer'); // Re-check
    const productsContainer = document.getElementById('productsContainer'); // Get product container

    // Check if main page is active AND the product grid is currently displayed (not home sections)
    if (mainPage?.classList.contains('page-active') && productsContainer?.style.display === 'grid') {
        console.log("Refreshing product view after cache clear.");
        // Re-trigger the search/filter function from data-logic (need to import/call it properly from app-main)
        // This function needs access to the searchProducts function.
        // For simplicity now, we rely on the user navigating or the next data load.
        // A more robust solution might involve event emitters or callbacks.
         // Or, if searchProducts is globally accessible (less ideal):
         // if (typeof searchProducts === 'function') {
         //     searchProducts(state.currentSearch, true);
         // }
         // Best approach: The admin action in admin.js should call this,
         // and then potentially call a refresh function exposed from app-main.js.
    } else if (mainPage?.classList.contains('page-active') && homeSectionsContainer?.style.display !== 'none'){
         // If home page sections were displayed, re-render them
         console.log("Refreshing home page sections after cache clear.");
         // Need access to renderHomePageContent function, likely call via app-main
         // if (typeof renderHomePageContent === 'function') {
         //     renderHomePageContent();
         // }
    }
}


/**
 * Populates category dropdowns used within the admin interface (settings page).
 */
export function updateAdminCategoryDropdowns() {
    const categories = getCategories(); // Assumes getCategories is exported from data-logic.js
    if (!categories || categories.length <= 1) return; // Wait until categories are loaded

    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

    // List of dropdown IDs and their default option text
    const dropdowns = [
        // For adding subcategory
        { id: 'parentCategorySelect', defaultText: '-- جۆرێک هەڵبژێرە --', includeAll: false, selectedValue: '' },
        // For adding sub-subcategory (Main Category dropdown)
        { id: 'parentMainCategorySelectForSubSub', defaultText: '-- جۆرێک هەڵبژێرە --', includeAll: false, selectedValue: '' },
         // For adding/editing Promo Card target
         { id: 'promoCardTargetCategory', defaultText: '-- جۆرێک هەڵبژێرە --', includeAll: false, selectedValue: '' },
          // For adding/editing Brand target (Main Category)
          { id: 'brandTargetMainCategory', defaultText: '-- هەموو جۆرەکان --', includeAll: true, allValue: '', selectedValue: '' }, // Include "All" for brands
          // For adding/editing Shortcut Card target (Main Category)
          { id: 'shortcutCardMainCategory', defaultText: '-- هەموو کاڵاکان --', includeAll: true, allValue: '', selectedValue: '' } // Include "All" for shortcuts

    ];

    dropdowns.forEach(d => {
        const select = document.getElementById(d.id);
        if (select) {
             const currentValue = select.value; // Store current value before clearing
            let firstOptionHTML = '';
             if (d.includeAll) {
                 firstOptionHTML = `<option value="${d.allValue || ''}">${d.defaultText}</option>`; // Use specified value for "all" or empty string
             } else {
                 firstOptionHTML = `<option value="" disabled selected>${d.defaultText}</option>`;
             }

            select.innerHTML = firstOptionHTML; // Set the default/all option

            categoriesWithoutAll.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                 // Use Sorani name as the primary display name in admin dropdowns
                option.textContent = cat.name_ku_sorani || cat.name_ku_badini || cat.name_ar || cat.id; // Fallback chain
                select.appendChild(option);
            });

             // Try to restore the previously selected value if it exists
             if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                 select.value = currentValue;
             } else {
                 select.value = d.selectedValue || (d.includeAll ? (d.allValue || '') : ''); // Set default selected value
             }
        } else {
            console.warn(`Admin dropdown with ID "${d.id}" not found.`);
        }
    });

    // --- Special handling for dependent dropdowns (Subcategory for SubSubcategory form) ---
     const parentMainSelect = document.getElementById('parentMainCategorySelectForSubSub');
     const parentSubSelect = document.getElementById('parentSubcategorySelectForSubSub');

     if (parentMainSelect && parentSubSelect) {
         parentMainSelect.addEventListener('change', async (e) => {
             const mainCatId = e.target.value;
             parentSubSelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
             parentSubSelect.disabled = true;
             if (mainCatId) {
                 const subcategories = await fetchSubcategories(mainCatId); // Fetch subcategories
                 parentSubSelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
                 subcategories.forEach(subcat => {
                     const option = document.createElement('option');
                     option.value = subcat.id;
                     option.textContent = subcat.name_ku_sorani || subcat.id;
                     parentSubSelect.appendChild(option);
                 });
                 parentSubSelect.disabled = false;
             } else {
                 parentSubSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا جۆری سەرەکی هەڵبژێرە --</option>';
             }
         });
     }

      // --- Special handling for Brand Subcategory Dropdown ---
      const brandMainCatSelect = document.getElementById('brandTargetMainCategory');
      const brandSubCatContainer = document.getElementById('brandSubcategoryContainer');
      const brandSubCatSelect = document.getElementById('brandTargetSubcategory');

      if (brandMainCatSelect && brandSubCatContainer && brandSubCatSelect) {
           brandMainCatSelect.addEventListener('change', async (e) => {
               const mainCatId = e.target.value;
               if (mainCatId) {
                   brandSubCatContainer.style.display = 'block';
                   brandSubCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                   const subcategories = await fetchSubcategories(mainCatId);
                   brandSubCatSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>';
                   subcategories.forEach(subcat => {
                       const option = document.createElement('option');
                       option.value = subcat.id;
                       option.textContent = subcat.name_ku_sorani;
                       brandSubCatSelect.appendChild(option);
                   });
               } else {
                   brandSubCatContainer.style.display = 'none';
                   brandSubCatSelect.innerHTML = ''; // Clear options
               }
           });
      }
}

/**
 * Populates category dropdowns specifically for the "Add Card to Row" form.
 */
export function updateShortcutCardCategoryDropdowns() {
    const categories = getCategories();
    if (!categories || categories.length <= 1) return;

    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    const mainSelect = document.getElementById('shortcutCardMainCategory');
    const subContainer = document.getElementById('shortcutCardSubContainer');
    const subSelect = document.getElementById('shortcutCardSubcategory');
    const subSubContainer = document.getElementById('shortcutCardSubSubContainer');
    const subSubSelect = document.getElementById('shortcutCardSubSubcategory');

    if (!mainSelect || !subContainer || !subSelect || !subSubContainer || !subSubSelect) {
        console.warn("Shortcut card category dropdown elements not found.");
        return;
    }

    // Populate Main Category Select
    const currentMainValue = mainSelect.value; // Store current value
    mainSelect.innerHTML = '<option value="">-- هەموو کاڵاکان --</option>'; // Default "All Products"
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name_ku_sorani || cat.id;
        mainSelect.appendChild(option);
    });
     // Restore value if possible
     if (currentMainValue && mainSelect.querySelector(`option[value="${currentMainValue}"]`)) {
         mainSelect.value = currentMainValue;
     }

    // --- Event Listener for Main Category Change ---
    mainSelect.addEventListener('change', async (e) => {
        const mainCatId = e.target.value;

        // Reset and hide sub and sub-sub dropdowns initially
        subSelect.innerHTML = '';
        subSubSelect.innerHTML = '';
        subContainer.style.display = 'none';
        subSubContainer.style.display = 'none';

        if (mainCatId) {
            // Show subcategory dropdown and populate it
            subContainer.style.display = 'block';
            subSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
            try {
                const subcategories = await fetchSubcategories(mainCatId); // Fetch subcategories
                subSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>'; // Default "All Subcategories"
                subcategories.forEach(subcat => {
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    option.textContent = subcat.name_ku_sorani || subcat.id;
                    subSelect.appendChild(option);
                });
            } catch (error) {
                console.error("Error fetching subcategories for shortcut card form:", error);
                subSelect.innerHTML = '<option value="" disabled>هەڵە!</option>';
            }
        }
    });

    // --- Event Listener for Subcategory Change ---
    subSelect.addEventListener('change', async (e) => {
        const mainCatId = mainSelect.value; // Get main category ID again
        const subCatId = e.target.value;

        // Reset and hide sub-subcategory dropdown initially
        subSubSelect.innerHTML = '';
        subSubContainer.style.display = 'none';

        if (mainCatId && subCatId) {
            // Show sub-subcategory dropdown and populate it
            subSubContainer.style.display = 'block';
            subSubSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
            try {
                const subSubcategories = await fetchSubSubcategories(mainCatId, subCatId); // Fetch sub-subcategories
                subSubSelect.innerHTML = '<option value="">-- هەموو لاوەکی لاوەکییەکان --</option>'; // Default "All Sub-Subcategories"
                subSubcategories.forEach(subSubcat => {
                    const option = document.createElement('option');
                    option.value = subSubcat.id;
                    option.textContent = subSubcat.name_ku_sorani || subSubcat.id;
                    subSubSelect.appendChild(option);
                });
            } catch (error) {
                console.error("Error fetching sub-subcategories for shortcut card form:", error);
                subSubSelect.innerHTML = '<option value="" disabled>هەڵە!</option>';
            }
        }
    });
}
