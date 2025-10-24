// admin.js
// Logika taybet bo rêveberê (admin)
// Pişt bi window.globalAdminTools dibestit ku ji app-logic.js hatîye amadekirin

// --- Destpêkirin û Înîşiyalîzasyon ---

const {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection,
    query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction, // Firestore functions
    showNotification, t, openPopup, closeCurrentPopup, createProductImageInputs, // UI Utilities
    clearProductCache, // Core Logic utility
    setEditingProductId, getEditingProductId, // Editing state accessors
    getCategories, getCurrentLanguage, // Data accessors
    productsCollection, categoriesCollection, announcementsCollection, // Collections
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection // Collections
} = window.globalAdminTools || {}; // Use || {} as fallback if not ready yet

window.AdminLogic = {
    listenersAttached: false, // Flag to prevent attaching listeners multiple times

    initialize: function() {
        // Check if dependencies are loaded
        if (!db || !auth || !showNotification || !t || !collection) {
            console.error("globalAdminTools is not fully populated. Admin logic cannot initialize.");
            this.updateAdminUI(false); // Ensure admin UI is hidden
            return;
        }
        console.log("Admin logic initializing...");

        this.updateAdminUI(true); // Called by app-logic, but ensure it's set
        this.setupAdminEventListeners(); // Attach listeners

        // Load data and render admin-specific sections
        this.migrateAndSetupDefaultHomeLayout();
        this.loadPoliciesForAdmin();
        this.renderCategoryManagementUI();
        this.renderAdminAnnouncementsList();
        this.renderSocialMediaLinks();
        this.renderContactMethodsAdmin();
        this.renderPromoGroupsAdminList();
        this.renderBrandGroupsAdminList();
        this.renderShortcutRowsAdminList();
        this.renderHomeLayoutAdmin();

        // Populate dropdowns
        this.updateAdminCategoryDropdowns(); // Needs categories from getCategories()
        this.updateShortcutCardCategoryDropdowns(); // Needs categories

        console.log("Admin logic initialized.");
    },

    deinitialize: function() {
        console.log("Admin logic de-initializing.");
        this.updateAdminUI(false); // Hide admin elements
        // Consider removing listeners if needed, though hiding elements often suffices
        // this.listenersAttached = false;
    },

    // --- Product Management (Called via delegation from app-logic.js) ---
    editProduct: async function(productId) {
        if (!sessionStorage.getItem('isAdmin') === 'true') return;

        try {
            const productRef = doc(db, "products", productId);
            const productSnap = await getDoc(productRef);

            if (!productSnap.exists()) {
                showNotification(t('product_not_found_error', {default:'هەڵە: کاڵاکە نەدۆزرایەوە!'}), 'error');
                return;
            }
            const product = { id: productSnap.id, ...productSnap.data() };

            setEditingProductId(productId); // Use global state accessor
            const formTitleEl = document.getElementById('formTitle');
            if(formTitleEl) formTitleEl.textContent = t('edit_product_title', {default:'دەستکاری کردنی کاڵا'});
            const productForm = document.getElementById('productForm');
            if(productForm) productForm.reset(); // Reset form

            // Populate fields (check if elements exist first)
            const nameKuSorani = document.getElementById('productNameKuSorani');
            const nameKuBadini = document.getElementById('productNameKuBadini');
            const nameAr = document.getElementById('productNameAr');
            const price = document.getElementById('productPrice');
            const originalPrice = document.getElementById('productOriginalPrice');
            const categorySelect = document.getElementById('productCategoryId');
            const descKuSorani = document.getElementById('productDescriptionKuSorani');
            const descKuBadini = document.getElementById('productDescriptionKuBadini');
            const descAr = document.getElementById('productDescriptionAr');
            const externalLink = document.getElementById('productExternalLink');
            const shippingKuSorani = document.getElementById('shippingInfoKuSorani');
            const shippingKuBadini = document.getElementById('shippingInfoKuBadini');
            const shippingAr = document.getElementById('shippingInfoAr');
            const submitButton = productForm?.querySelector('button[type="submit"]');

            if (product.name && typeof product.name === 'object') {
                if (nameKuSorani) nameKuSorani.value = product.name.ku_sorani || '';
                if (nameKuBadini) nameKuBadini.value = product.name.ku_badini || '';
                if (nameAr) nameAr.value = product.name.ar || '';
            } else if (nameKuSorani) {
                nameKuSorani.value = product.name || ''; // Fallback for old string format
                if (nameKuBadini) nameKuBadini.value = '';
                if (nameAr) nameAr.value = '';
            }

            if (price) price.value = product.price || 0;
            if (originalPrice) originalPrice.value = product.originalPrice || '';

            const categoryId = product.categoryId || product.category; // Handle potential old field name
            if (categorySelect) categorySelect.value = categoryId;

            if (product.description && typeof product.description === 'object') {
                 if(descKuSorani) descKuSorani.value = product.description.ku_sorani || '';
                 if(descKuBadini) descKuBadini.value = product.description.ku_badini || '';
                 if(descAr) descAr.value = product.description.ar || '';
            } else if (descKuSorani) {
                 descKuSorani.value = product.description || ''; // Fallback
                 if(descKuBadini) descKuBadini.value = '';
                 if(descAr) descAr.value = '';
            }


            const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
            createProductImageInputs(imageUrls); // Use UI function from globalAdminTools
            if (externalLink) externalLink.value = product.externalLink || '';

            if (product.shippingInfo && typeof product.shippingInfo === 'object') {
                if(shippingKuSorani) shippingKuSorani.value = product.shippingInfo.ku_sorani || '';
                if(shippingKuBadini) shippingKuBadini.value = product.shippingInfo.ku_badini || '';
                if(shippingAr) shippingAr.value = product.shippingInfo.ar || '';
            } else { // Clear if not object or doesn't exist
                 if(shippingKuSorani) shippingKuSorani.value = '';
                 if(shippingKuBadini) shippingKuBadini.value = '';
                 if(shippingAr) shippingAr.value = '';
            }

            // Populate sub/sub-sub categories after main category is set
            // Need to ensure these functions exist and are populated in globalAdminTools if they aren't part of AdminLogic
            await this.populateSubcategoriesDropdown(categoryId, product.subcategoryId); // Assuming these are part of AdminLogic now
            await this.populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId); // Assuming these are part of AdminLogic now

            if (submitButton) submitButton.textContent = t('update_button', {default:'نوێکردنەوە'});
            openPopup('productFormModal', 'modal'); // Use UI function from globalAdminTools
        } catch (error) {
            console.error("Error opening edit product modal:", error);
            showNotification(t('error_generic'), 'error');
        }
    },

    deleteProduct: async function(productId) {
        if (!sessionStorage.getItem('isAdmin') === 'true') return;
        if (!confirm(t('delete_confirm', {default:"دڵنیایت دەتەوێت ئەم کاڵایە بسڕیتەوە؟"}))) return;

        try {
            await deleteDoc(doc(db, "products", productId));
            showNotification(t('product_deleted', {default:"کاڵا سڕدرایەوە"}), 'success');
            clearProductCache(); // Clear cache and trigger re-render
        } catch (error) {
            console.error("Error deleting product:", error);
            showNotification(t('product_delete_error', {default:"هەڵە لە سڕینەوەی کاڵا"}), 'error');
        }
    },

    // --- Category Management ---
    renderCategoryManagementUI: async function() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        container.innerHTML = `<p>${t('loading_categories',{default:'...خەریکی بارکردنی جۆرەکانە'})}</p>`;

        let content = '';
        try {
            const mainCategoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
            const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);

            if (mainCategoriesSnapshot.empty) {
                 container.innerHTML = `<p>${t('no_categories_added',{default:'هیچ جۆرێک زیاد نەکراوە.'})}</p>`;
                 return;
            }

            for (const mainDoc of mainCategoriesSnapshot.docs) {
                const mainCategory = { id: mainDoc.id, ...mainDoc.data() };
                const mainPath = `categories/${mainCategory.id}`;
                const mainName = mainCategory.name_ku_sorani || mainCategory.id;
                content += `
                    <div class="admin-list-group" style="margin-bottom: 10px;">
                       <div class="admin-list-group-header">
                            <strong><i class="${mainCategory.icon || 'fas fa-folder'}"></i> ${mainName} (Order: ${mainCategory.order || 0})</strong>
                            <div>
                                <button class="edit-btn small-btn edit-category-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn delete-category-btn" data-path="${mainPath}" data-name="${mainName}"><i class="fas fa-trash"></i></button>
                            </div>
                       </div>
                       <div class="category-children-container" style="padding: 0 10px 10px 10px;">`; // Container for children

                // Fetch Subcategories
                const subCategoriesQuery = query(collection(db, mainPath, "subcategories"), orderBy("order", "asc"));
                const subCategoriesSnapshot = await getDocs(subCategoriesQuery);
                if (subCategoriesSnapshot.empty) {
                     content += `<p class="empty-list-text">${t('no_subcategories',{default:'هیچ جۆرێکی لاوەکی نییە'})}</p>`;
                }

                for (const subDoc of subCategoriesSnapshot.docs) {
                    const subCategory = { id: subDoc.id, ...subDoc.data() };
                    const subPath = `${mainPath}/subcategories/${subCategory.id}`;
                    const subName = subCategory.name_ku_sorani || subCategory.id;
                    content += `
                        <div class="admin-list-item" style="padding-left: 15px;">
                            <span>- ${subName} (Order: ${subCategory.order || 0})</span>
                            <div>
                                <button class="edit-btn small-btn edit-category-btn" data-path="${subPath}" data-level="2"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn delete-category-btn" data-path="${subPath}" data-name="${subName}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>`;

                    // Fetch Sub-Subcategories
                    const subSubCategoriesQuery = query(collection(db, subPath, "subSubcategories"), orderBy("order", "asc"));
                    const subSubCategoriesSnapshot = await getDocs(subSubCategoriesQuery);
                    for (const subSubDoc of subSubCategoriesSnapshot.docs) {
                        const subSubCategory = { id: subSubDoc.id, ...subSubDoc.data() };
                        const subSubPath = `${subPath}/subSubcategories/${subSubCategory.id}`;
                         const subSubName = subSubCategory.name_ku_sorani || subSubCategory.id;
                        content += `
                            <div class="admin-list-item" style="padding-left: 30px;">
                                <span>-- ${subSubName} (Order: ${subSubCategory.order || 0})</span>
                                <div>
                                    <button class="edit-btn small-btn edit-category-btn" data-path="${subSubPath}" data-level="3"><i class="fas fa-edit"></i></button>
                                    <button class="delete-btn small-btn delete-category-btn" data-path="${subSubPath}" data-name="${subSubName}"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>`;
                    }
                }
                content += `</div></div>`; // Close category-children-container and admin-list-group
            }
            container.innerHTML = content;

        } catch (error) {
            console.error("Error rendering category management UI:", error);
            container.innerHTML = `<p style="color: red;">${t('error_loading_categories', {default:'هەڵە لە بارکردنی جۆرەکان ڕوویدا.'})}</p>`;
        }
    },

    openEditCategoryModal: async function(docPath, level) {
         // This logic seems complete from the skeleton
         if (!sessionStorage.getItem('isAdmin') === 'true') return;
         try {
             const docRef = doc(db, docPath);
             const docSnap = await getDoc(docRef);
             if (!docSnap.exists()) { showNotification(t('category_not_found', {default:'جۆرەکە نەدۆزرایەوە!'}), 'error'); return; }
             const category = docSnap.data();
             document.getElementById('editCategoryDocPath').value = docPath;
             document.getElementById('editCategoryLevel').value = level;
             document.getElementById('editCategoryNameKuSorani').value = category.name_ku_sorani || '';
             document.getElementById('editCategoryNameKuBadini').value = category.name_ku_badini || '';
             document.getElementById('editCategoryNameAr').value = category.name_ar || '';
             document.getElementById('editCategoryOrder').value = category.order || 0;
             const iconField = document.getElementById('editIconField');
             const imageUrlField = document.getElementById('editImageUrlField');
             if (level === '1') {
                 iconField.style.display = 'block';
                 imageUrlField.style.display = 'none';
                 document.getElementById('editCategoryIcon').value = category.icon || '';
             } else {
                 iconField.style.display = 'none';
                 imageUrlField.style.display = 'block';
                 document.getElementById('editCategoryImageUrl').value = category.imageUrl || '';
             }
             const modalTitle = document.getElementById('editCategoryFormTitle');
             if(modalTitle) modalTitle.textContent = t('edit_category_title', { default: 'دەستکاریکردنی جۆر' });
             openPopup('editCategoryModal', 'modal');
         } catch (error) {
              console.error("Error opening edit category modal:", error);
              showNotification(t('error_generic'), 'error');
         }
    },

    handleDeleteCategory: async function(docPath, categoryName) {
        // This logic seems complete from the skeleton, but WARNING about orphans
        if (!sessionStorage.getItem('isAdmin') === 'true') return;
        const confirmationMsg = t('delete_category_confirm', { name: categoryName, default: `دڵنیایت دەتەوێت جۆری "{name}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.` }).replace('{name}', categoryName);
        if (confirm(confirmationMsg)) {
            try {
                // WARNING: Client-side delete doesn't remove subcollections easily. Cloud Function recommended.
                await deleteDoc(doc(db, docPath));
                showNotification(t('category_deleted_success', {default:'جۆرەکە سڕدرایەوە'}), 'success');
                this.renderCategoryManagementUI();
                clearProductCache();
            } catch (error) {
                console.error("Error deleting category (document only): ", error);
                showNotification(t('error_deleting_category', {default:'هەڵەیەک ڕوویدا لە کاتی sڕینەوە'}), 'error');
            }
        }
    },

    updateAdminCategoryDropdowns: function() {
        // This logic seems complete from the skeleton
        const categories = getCategories();
        if (!categories || categories.length <= 1) return;
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        const dropdownConfigs = [
            // ... (configs from skeleton) ...
             { id: 'parentCategorySelect', defaultTextKey: 'select_main_category_prompt', defaultText: '-- جۆرێک هەڵبژێرە --' },
             { id: 'parentMainCategorySelectForSubSub', defaultTextKey: 'select_main_category_prompt', defaultText: '-- جۆرێک هەڵبژێرە --' },
             { id: 'promoCardTargetCategory', defaultTextKey: 'select_main_category_prompt', defaultText: '-- جۆرێک هەڵبژێرە --' },
             { id: 'brandTargetMainCategory', defaultTextKey: 'all_categories_label', defaultText: '-- هەموو جۆرەکان --' },
             { id: 'newSectionMainCategory', defaultTextKey: 'select_main_category_required', defaultText: '-- جۆری سەرەکی هەڵبژێرە (پێویستە) --' }
        ];
        dropdownConfigs.forEach(config => {
            const select = document.getElementById(config.id);
            if (select) {
                 const defaultOptionText = t(config.defaultTextKey, { default: config.defaultText });
                 const selectedValue = select.value;
                 select.innerHTML = `<option value="">${defaultOptionText}</option>`;
                 categoriesWithoutAll.forEach(cat => {
                     const option = document.createElement('option');
                     option.value = cat.id;
                     option.textContent = cat.name_ku_sorani || cat.name_ku_badini || cat.id;
                     select.appendChild(option);
                 });
                 if (selectedValue && select.querySelector(`option[value="${selectedValue}"]`)) {
                     select.value = selectedValue;
                 } else if (config.id === 'brandTargetMainCategory') {
                     select.value = "";
                 }
            }
        });
    },

    // --- Populate Sub/SubSubcategories for Admin Forms ---
    populateAdminSubcategories: async function(mainCatId, subSelectElementId, includeEmptyOption = true, emptyOptionTextKey = 'select_subcategory_prompt') {
        // This logic seems complete from the skeleton
         const subSelect = document.getElementById(subSelectElementId);
         if (!subSelect) return;
         subSelect.innerHTML = `<option value="">${t('loading',{default:'...چاوەڕێ بە'})}</option>`;
         subSelect.disabled = true;
         if (!mainCatId) {
             subSelect.innerHTML = `<option value="" disabled selected>${t('select_main_category_first',{default:'-- سەرەتا جۆری سەرەکی هەڵبژێرە --'})}</option>`;
             subSelect.disabled = true; return;
         }
         try {
             const subcategoriesRef = collection(db, "categories", mainCatId, "subcategories");
             const q = query(subcategoriesRef, orderBy("order", "asc"));
             const snapshot = await getDocs(q);
             const emptyText = t(emptyOptionTextKey, { default: '-- لاوەکی هەڵبژێرە --' });
             subSelect.innerHTML = includeEmptyOption ? `<option value="">${emptyText}</option>` : '';
             if (snapshot.empty && !includeEmptyOption) {
                 subSelect.innerHTML = `<option value="" disabled selected>${t('no_subcategories_exist',{default:'هیچ جۆری لاوەکی نییە'})}</option>`;
             } else {
                 snapshot.forEach(doc => { /* ... populate options ... */
                     const subcat = { id: doc.id, ...doc.data() };
                     const option = document.createElement('option');
                     option.value = subcat.id;
                     option.textContent = subcat.name_ku_sorani || subcat.id;
                     subSelect.appendChild(option);
                 });
             }
         } catch (error) { /* ... handle error ... */
             console.error(`Error populating subcategories for ${subSelectElementId}:`, error);
              subSelect.innerHTML = `<option value="" disabled selected>${t('error_loading',{default:'هەڵە لە بارکردن'})}</option>`;
         } finally { subSelect.disabled = false; }
    },
    populateAdminSubSubcategories: async function(mainCatId, subCatId, subSubSelectElementId, includeEmptyOption = true, emptyOptionTextKey = 'select_subsubcategory_prompt') {
        // This logic seems complete from the skeleton
         const subSubSelect = document.getElementById(subSubSelectElementId);
         if (!subSubSelect) return;
         subSubSelect.innerHTML = `<option value="">${t('loading',{default:'...چاوەڕێ بە'})}</option>`;
         subSubSelect.disabled = true;
         if (!mainCatId || !subCatId) {
             subSubSelect.innerHTML = `<option value="" disabled selected>${t('select_subcategory_first',{default:'-- سەرەتا جۆری لاوەکی هەڵبژێرە --'})}</option>`;
             subSubSelect.disabled = true; return;
         }
         try {
             const subSubcategoriesRef = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
             const q = query(subSubcategoriesRef, orderBy("order", "asc"));
             const snapshot = await getDocs(q);
             const emptyText = t(emptyOptionTextKey, { default: '-- لاوەکی لاوەکی هەڵبژێرە --' });
              subSubSelect.innerHTML = includeEmptyOption ? `<option value="">${emptyText}</option>` : '';
             if (snapshot.empty && !includeEmptyOption) {
                 subSubSelect.innerHTML = `<option value="" disabled selected>${t('no_subsubcategories_exist',{default:'هیچ جۆری لاوەکی لاوەکی نییە'})}</option>`;
             } else {
                 snapshot.forEach(doc => { /* ... populate options ... */
                     const subSubcat = { id: doc.id, ...doc.data() };
                     const option = document.createElement('option');
                     option.value = subSubcat.id;
                     option.textContent = subSubcat.name_ku_sorani || subSubcat.id;
                     subSubSelect.appendChild(option);
                 });
             }
         } catch (error) { /* ... handle error ... */
             console.error(`Error populating sub-subcategories for ${subSubSelectElementId}:`, error);
              subSubSelect.innerHTML = `<option value="" disabled selected>${t('error_loading')}</option>`;
         } finally { subSubSelect.disabled = false; }
    },
    // Populate dropdowns used in Product Form specifically
     populateSubcategoriesDropdown: async function(categoryId, selectedSubcategoryId = null) {
          await this.populateAdminSubcategories(categoryId, 'productSubcategoryId', true, 'select_subcategory_prompt');
          // Set the selected value after population
          const select = document.getElementById('productSubcategoryId');
          if(select && selectedSubcategoryId) select.value = selectedSubcategoryId;
     },
     populateSubSubcategoriesDropdown: async function(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
          await this.populateAdminSubSubcategories(mainCategoryId, subcategoryId, 'productSubSubcategoryId', true, 'select_subsubcategory_prompt_optional'); // Optional selection
           // Set the selected value after population
          const select = document.getElementById('productSubSubcategoryId');
          if(select && selectedSubSubcategoryId) select.value = selectedSubSubcategoryId;
     },


    // --- Announcement Management ---
    renderAdminAnnouncementsList: function() {
        // This logic seems complete from the skeleton
        const container = document.getElementById('announcementsListContainer');
        if (!container) return;
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) { container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent',{default:"هیچ ئاگەهدارییەک نەنێردراوە"})}</p>`; return; }
            snapshot.forEach(doc => {
                const announcement = { id: doc.id, ...doc.data() };
                const title = (announcement.title && announcement.title.ku_sorani) || t('untitled_notification',{default:'ئاگەداری بێ ناونیشان'});
                const item = document.createElement('div');
                item.className = 'admin-notification-item';
                item.innerHTML = `
                    <div class="admin-notification-details"> <div class="notification-title">${title}</div> <small>${new Date(announcement.createdAt).toLocaleDateString()}</small> </div>
                    <button class="delete-btn small-btn delete-announcement-btn" data-id="${announcement.id}"><i class="fas fa-trash"></i></button>`;
                container.appendChild(item);
            });
        }, (error) => { /* ... handle error ... */
             console.error("Error fetching admin announcements:", error);
             if(container) container.innerHTML = `<p style="color: red;">${t('error_loading_announcements',{default:'هەڵە لە بارکردنی ئاگەدارییەکان'})}</p>`;
        });
    },

    deleteAnnouncement: async function(id) {
        // This logic seems complete from the skeleton
        if (!sessionStorage.getItem('isAdmin') === 'true') return;
        if (confirm(t('announcement_delete_confirm', {default:"دڵنیایت دەتەوێت ئەم ئاگەهدارییە بسڕیتەوە؟"}))) {
            try { await deleteDoc(doc(db, "announcements", id)); showNotification(t('announcement_deleted_success', {default:"ئاگەهدارییەکە سڕدرایەوە"}), 'success'); }
            catch (e) { console.error("Error deleting announcement:", e); showNotification(t('error_generic'), 'error'); }
        }
    },

    // --- Policy Management ---
    loadPoliciesForAdmin: async function() {
        // This logic seems complete from the skeleton
        const soraniTextarea = document.getElementById('policiesContentKuSorani');
        const badiniTextarea = document.getElementById('policiesContentKuBadini');
        const arTextarea = document.getElementById('policiesContentAr');
        if (!soraniTextarea || !badiniTextarea || !arTextarea) return;
        try {
            const docRef = doc(db, "settings", "policies");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().content) { /* ... populate textareas ... */
                const policies = docSnap.data().content;
                soraniTextarea.value = policies.ku_sorani || '';
                badiniTextarea.value = policies.ku_badini || '';
                arTextarea.value = policies.ar || '';
            } else { /* ... clear textareas ... */
                 soraniTextarea.value = ''; badiniTextarea.value = ''; arTextarea.value = '';
            }
        } catch (error) { /* ... handle error ... */
            console.error("Error loading policies for admin:", error);
            showNotification(t('error_loading_policies', {default:'هەڵە لە بارکردنی ڕێساکان'}), 'error');
        }
    },

    // --- Social Media Link Management ---
    renderSocialMediaLinks: function() {
        // This logic seems complete from the skeleton
        const container = document.getElementById('socialLinksListContainer');
        if (!container) return;
        const socialLinksCollectionRef = collection(db, 'settings', 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollectionRef, orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) { container.innerHTML = `<p class="empty-list-text">${t('no_social_links', {default:'هیچ لینکێکی سۆشیال میدیا زیاد نەکراوە.'})}</p>`; return; }
            snapshot.forEach(doc => {
                const link = { id: doc.id, ...doc.data() };
                const name = link['name_' + getCurrentLanguage()] || link.name_ku_sorani;
                const item = document.createElement('div');
                item.className = 'social-link-item';
                item.innerHTML = `
                    <div class="item-info"> <i class="${link.icon || 'fas fa-link'}"></i> <div class="item-details"> <span class="item-name">${name}</span> <span class="item-value">${link.url}</span> </div> </div>
                    <button class="delete-btn small-btn delete-social-link-btn" data-id="${link.id}"><i class="fas fa-trash"></i></button>`;
                container.appendChild(item);
            });
        }, (error) => { /* ... handle error ... */
             console.error("Error fetching social links:", error);
             if(container) container.innerHTML = `<p style="color:red;">${t('error_loading_links',{default:'هەڵە لە بارکردنی لینکەکان'})}</p>`;
        });
    },

    deleteSocialMediaLink: async function(linkId) {
        // This logic seems complete from the skeleton
        if (!sessionStorage.getItem('isAdmin') === 'true') return;
        if (confirm(t('delete_social_link_confirm', {default:'دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟'}))) {
            try { await deleteDoc(doc(db, 'settings', 'contactInfo', 'socialLinks', linkId)); showNotification(t('link_deleted_success', {default:'لینکەکە سڕدرایەوە'}), 'success'); }
            catch (error) { console.error("Error deleting social link: ", error); showNotification(t('error_generic'), 'error'); }
        }
    },

    // --- Contact Method Management ---
    renderContactMethodsAdmin: function() {
        // This logic seems complete from the skeleton
        const container = document.getElementById('contactMethodsListContainer');
        if (!container) return;
        const methodsCollectionRef = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollectionRef, orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) { container.innerHTML = `<p class="empty-list-text">${t('no_contact_methods_added', {default:'هیچ شێوازێکی پەیوەندی زیاد نەکراوە.'})}</p>`; return; }
            snapshot.forEach(doc => {
                const method = { id: doc.id, ...doc.data() };
                const name = method['name_' + getCurrentLanguage()] || method.name_ku_sorani;
                const item = document.createElement('div');
                item.className = 'social-link-item';
                item.innerHTML = `
                    <div class="item-info"> <i class="${method.icon || 'fas fa-phone'}" style="color: ${method.color || 'inherit'};"></i> <div class="item-details"> <span class="item-name">${name} (${method.type})</span> <span class="item-value">${method.value}</span> </div> </div>
                    <button class="delete-btn small-btn delete-contact-method-btn" data-id="${method.id}"><i class="fas fa-trash"></i></button>`;
                container.appendChild(item);
            });
        }, (error) => { /* ... handle error ... */
             console.error("Error fetching contact methods:", error);
             if(container) container.innerHTML = `<p style="color:red;">${t('error_loading_methods',{default:'هەڵە لە بارکردنی شێوازەکان'})}</p>`;
        });
    },

    deleteContactMethod: async function(methodId) {
        // This logic seems complete from the skeleton
        if (!sessionStorage.getItem('isAdmin') === 'true') return;
        if (confirm(t('delete_contact_method_confirm', {default:'دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟'}))) {
            try { await deleteDoc(doc(db, 'settings', 'contactInfo', 'contactMethods', methodId)); showNotification(t('method_deleted_success', {default:'شێوازەکە سڕدرایەوە'}), 'success'); }
            catch (error) { console.error("Error deleting contact method: ", error); showNotification(t('error_generic'), 'error'); }
        }
    },

    // --- Promo Group/Card Management ---
    renderPromoGroupsAdminList: function() {
        // Logic seems complete in skeleton
        const container = document.getElementById('promoGroupsListContainer');
        const groupSelect = document.getElementById('promoCardGroupSelect');
        if(!container || !groupSelect) return;
        const q = query(promoGroupsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';
            if (snapshot.empty) { container.innerHTML = '<p>هیچ گرووپێکی سلایدەر زیاد نەکراوە.</p>'; return; }

            snapshot.forEach(groupDoc => { /* ... render group and nested cards ... */
                const group = { id: groupDoc.id, ...groupDoc.data() };
                const option = document.createElement('option'); option.value = group.id; option.textContent = group.name; groupSelect.appendChild(option);
                const groupElement = document.createElement('div'); groupElement.className = 'admin-list-group';
                groupElement.innerHTML = `<div class="admin-list-group-header"> <strong><i class="fas fa-images"></i> ${group.name}</strong> <div> <button class="edit-btn small-btn edit-promo-group-btn" data-id="${group.id}"><i class="fas fa-edit"></i></button> <button class="delete-btn small-btn delete-promo-group-btn" data-id="${group.id}"><i class="fas fa-trash"></i></button> </div> </div> <div class="cards-list-container" style="padding: 10px;">...</div>`; container.appendChild(groupElement);
                const cardsContainer = groupElement.querySelector('.cards-list-container');
                const cardsQuery = query(collection(db, "promo_groups", group.id, "cards"), orderBy("order", "asc"));
                onSnapshot(cardsQuery, (cardsSnapshot) => {
                    cardsContainer.innerHTML = '';
                    if (cardsSnapshot.empty) { cardsContainer.innerHTML = '<p class="empty-list-text">هیچ کاردێک بۆ ئەم گرووپە زیاد نەکراوە.</p>'; }
                    else { cardsSnapshot.forEach(cardDoc => { /* ... render card item ... */
                        const card = { id: cardDoc.id, ...cardDoc.data() }; const cardElement = document.createElement('div'); cardElement.className = 'admin-list-item';
                        cardElement.innerHTML = `<span>- کارت (ڕیز: ${card.order})</span> <div> <button class="edit-btn small-btn edit-promo-card-btn" data-group-id="${group.id}" data-card-id="${card.id}"><i class="fas fa-edit"></i></button> <button class="delete-btn small-btn delete-promo-card-btn" data-group-id="${group.id}" data-card-id="${card.id}"><i class="fas fa-trash"></i></button> </div>`; cardsContainer.appendChild(cardElement);
                    }); }
                });
            });
        }, (error) => { /* Handle error */ });
    },
    editPromoGroup: async function(groupId) {
         // Logic seems complete in skeleton
         const groupRef = doc(promoGroupsCollection, groupId); const groupSnap = await getDoc(groupRef); const currentName = groupSnap.data().name;
         const newName = prompt(t('enter_new_group_name', {default:'ناوی نوێی گرووپ بنووسە:'}), currentName);
         if (newName && newName.trim() !== '') { await updateDoc(groupRef, { name: newName.trim() }); showNotification(t('group_name_updated', {default:'ناوی گرووپ نوێکرایەوە'}), 'success'); clearProductCache(); }
    },
    deletePromoGroup: async function(groupId) {
         // Logic seems complete in skeleton
         if (confirm(t('delete_group_confirm', {default:'دڵنیایت دەتەوێت ئەم گرووپە و هەموو کارتەکانی بسڕیتەوە؟'}))) {
             try {
                 const cardsRef = collection(db, "promo_groups", groupId, "cards"); const cardsSnapshot = await getDocs(cardsRef); const deletePromises = cardsSnapshot.docs.map(d => deleteDoc(d.ref)); await Promise.all(deletePromises);
                 await deleteDoc(doc(promoGroupsCollection, groupId)); showNotification(t('group_deleted_success', {default:'گرووپ بە تەواوی سڕدرایەوە'}), 'success'); clearProductCache();
             } catch (error) { console.error("Error deleting promo group:", error); showNotification(t('error_generic'), 'error'); }
         }
    },
    editPromoCard: async function(groupId, cardId) {
         // Logic seems complete in skeleton
         try {
             const cardSnap = await getDoc(doc(db, "promo_groups", groupId, "cards", cardId));
             if (cardSnap.exists()) {
                 const card = cardSnap.data();
                 document.getElementById('editingPromoCardId').value = cardId;
                 document.getElementById('promoCardGroupSelect').value = groupId;
                 document.getElementById('promoCardImageKuSorani').value = card.imageUrls?.ku_sorani || ''; // Use optional chaining
                 document.getElementById('promoCardImageKuBadini').value = card.imageUrls?.ku_badini || '';
                 document.getElementById('promoCardImageAr').value = card.imageUrls?.ar || '';
                 document.getElementById('promoCardTargetCategory').value = card.categoryId || '';
                 document.getElementById('promoCardOrder').value = card.order || 1;
                 document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = t('update_button', {default:'نوێکردنەوە'});
                 document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth' });
             } else { showNotification(t('card_not_found', {default:'کارتەکە نەدۆزرایەوە'}), 'error'); }
         } catch (error) { console.error("Error loading promo card for edit:", error); showNotification(t('error_generic'), 'error'); }
    },
    deletePromoCard: async function(groupId, cardId) {
         // Logic seems complete in skeleton
         if (confirm(t('delete_card_confirm', {default:'دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟'}))) {
             try { await deleteDoc(doc(db, "promo_groups", groupId, "cards", cardId)); showNotification(t('card_deleted_success', {default:'کارتەکە سڕدرایەوە'}), 'success'); clearProductCache(); }
             catch (error) { console.error("Error deleting promo card:", error); showNotification(t('error_generic'), 'error'); }
         }
    },

    // --- Brand Group/Brand Management ---
    renderBrandGroupsAdminList: function() {
        // Logic seems complete in skeleton
        const container = document.getElementById('brandGroupsListContainer');
        const groupSelect = document.getElementById('brandGroupSelect');
        if(!container || !groupSelect) return;
        const q = query(brandGroupsCollection, orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';
            if (snapshot.empty) { container.innerHTML = '<p>هیچ گرووپێکی براند زیاد نەکراوە.</p>'; return; }
            snapshot.forEach(groupDoc => { /* ... render group and nested brands ... */
                 const group = { id: groupDoc.id, ...groupDoc.data() }; const option = document.createElement('option'); option.value = group.id; option.textContent = group.name; groupSelect.appendChild(option);
                 const groupElement = document.createElement('div'); groupElement.className = 'admin-list-group';
                 groupElement.innerHTML = `<div class="admin-list-group-header"> <strong><i class="fas fa-tags"></i> ${group.name}</strong> <div> <button class="edit-btn small-btn edit-brand-group-btn" data-id="${group.id}"><i class="fas fa-edit"></i></button> <button class="delete-btn small-btn delete-brand-group-btn" data-id="${group.id}"><i class="fas fa-trash"></i></button> </div> </div> <div class="brands-list-container" style="padding: 10px;">...</div>`; container.appendChild(groupElement);
                 const brandsContainer = groupElement.querySelector('.brands-list-container'); const brandsQuery = query(collection(db, "brand_groups", group.id, "brands"), orderBy("order", "asc"));
                 onSnapshot(brandsQuery, (brandsSnapshot) => {
                     brandsContainer.innerHTML = '';
                     if (brandsSnapshot.empty) { brandsContainer.innerHTML = '<p class="empty-list-text">هیچ براندێک بۆ ئەم گرووپە زیاد نەکراوە.</p>'; }
                     else { brandsSnapshot.forEach(brandDoc => { /* ... render brand item ... */
                          const brand = { id: brandDoc.id, ...brandDoc.data() }; const brandElement = document.createElement('div'); brandElement.className = 'admin-list-item';
                          brandElement.innerHTML = `<span>- ${brand.name?.ku_sorani || 'Brand'} (ڕیز: ${brand.order})</span> <div> <button class="edit-btn small-btn edit-brand-btn" data-group-id="${group.id}" data-brand-id="${brand.id}"><i class="fas fa-edit"></i></button> <button class="delete-btn small-btn delete-brand-btn" data-group-id="${group.id}" data-brand-id="${brand.id}"><i class="fas fa-trash"></i></button> </div>`; brandsContainer.appendChild(brandElement);
                     }); }
                 });
            });
        }, (error) => { /* Handle error */ });
    },
    editBrandGroup: async function(groupId) {
         // Logic seems complete in skeleton
         const groupRef = doc(brandGroupsCollection, groupId); const groupSnap = await getDoc(groupRef); const currentName = groupSnap.data().name;
         const newName = prompt(t('enter_new_brand_group_name', {default:'ناوی نوێی گرووپی براند بنووسە:'}), currentName);
         if (newName && newName.trim() !== '') { await updateDoc(groupRef, { name: newName.trim() }); showNotification(t('group_name_updated'), 'success'); clearProductCache(); }
    },
    deleteBrandGroup: async function(groupId) {
         // Logic seems complete in skeleton
         if (confirm(t('delete_brand_group_confirm', {default:'دڵنیایت دەتەوێت ئەم گرووپە و هەموو براندەکانی بسڕیتەوە؟'}))) {
             try {
                 const brandsRef = collection(db, "brand_groups", groupId, "brands"); const brandsSnapshot = await getDocs(brandsRef); const deletePromises = brandsSnapshot.docs.map(d => deleteDoc(d.ref)); await Promise.all(deletePromises);
                 await deleteDoc(doc(brandGroupsCollection, groupId)); showNotification(t('brand_group_deleted', {default:'گرووپی براند بە تەواوی سڕدرایەوە'}), 'success'); clearProductCache();
             } catch (error) { console.error("Error deleting brand group:", error); showNotification(t('error_generic'), 'error'); }
         }
    },
    editBrand: async function(groupId, brandId) {
         // Logic seems complete in skeleton
         try {
             const brandSnap = await getDoc(doc(db, "brand_groups", groupId, "brands", brandId));
             if (brandSnap.exists()) {
                 const brand = brandSnap.data();
                 document.getElementById('editingBrandId').value = brandId; document.getElementById('brandGroupSelect').value = groupId;
                 document.getElementById('brandNameKuSorani').value = brand.name?.ku_sorani || ''; document.getElementById('brandNameKuBadini').value = brand.name?.ku_badini || ''; document.getElementById('brandNameAr').value = brand.name?.ar || '';
                 document.getElementById('brandImageUrl').value = brand.imageUrl || ''; document.getElementById('brandOrder').value = brand.order || 10;
                 const mainCatSelect = document.getElementById('brandTargetMainCategory'); mainCatSelect.value = brand.categoryId || ''; mainCatSelect.dispatchEvent(new Event('change')); // Trigger subcategory load
                 // Delay setting subcategory value slightly to allow options to populate
                 setTimeout(() => { document.getElementById('brandTargetSubcategory').value = brand.subcategoryId || ''; }, 500);
                 document.getElementById('addBrandForm').querySelector('button[type="submit"]').textContent = t('update_button');
                 document.getElementById('addBrandForm').scrollIntoView({ behavior: 'smooth' });
             } else { showNotification(t('brand_not_found',{default:'براند نەدۆزرایەوە'}), 'error'); }
         } catch (error) { console.error("Error loading brand for edit:", error); showNotification(t('error_generic'), 'error'); }
    },
    deleteBrand: async function(groupId, brandId) {
         // Logic seems complete in skeleton
         if (confirm(t('delete_brand_confirm', {default:'دڵنیایت دەتەوێت ئەم براندە بسڕیتەوە؟'}))) {
             try { await deleteDoc(doc(db, "brand_groups", groupId, "brands", brandId)); showNotification(t('brand_deleted',{default:'براندەکە سڕدرایەوە'}), 'success'); clearProductCache(); }
             catch (error) { console.error("Error deleting brand:", error); showNotification(t('error_generic'), 'error'); }
         }
    },

    // --- Shortcut Row/Card Management ---
    renderShortcutRowsAdminList: function() {
        // Logic seems complete in skeleton
        const container = document.getElementById('shortcutRowsListContainer');
        const rowSelect = document.getElementById('selectRowForCard');
        if(!container || !rowSelect) return;
        const q = query(shortcutRowsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; rowSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا ڕیزێک هەڵبژێرە --</option>';
            if (snapshot.empty) { container.innerHTML = '<p>هیچ ڕیزێک زیاد نەکراوە.</p>'; return; }

            snapshot.forEach(rowDoc => { /* ... render row and nested cards ... */
                 const row = { id: rowDoc.id, ...rowDoc.data() }; const option = document.createElement('option'); option.value = row.id; option.textContent = row.title?.ku_sorani || 'Row'; rowSelect.appendChild(option);
                 const rowElement = document.createElement('div'); rowElement.className = 'admin-list-group';
                 rowElement.innerHTML = `<div class="admin-list-group-header"> <strong><i class="fas fa-layer-group"></i> ${row.title?.ku_sorani || 'Row'} (ڕیز: ${row.order})</strong> <div> <button class="edit-row-btn edit-btn small-btn" data-id="${row.id}"><i class="fas fa-edit"></i></button> <button class="delete-row-btn delete-btn small-btn" data-id="${row.id}"><i class="fas fa-trash"></i></button> </div> </div> <div class="cards-list-container" style="padding: 10px;">...</div>`; container.appendChild(rowElement);
                 const cardsContainer = rowElement.querySelector('.cards-list-container'); const cardsQuery = query(collection(db, "shortcut_rows", row.id, "cards"), orderBy("order", "asc"));
                 onSnapshot(cardsQuery, (cardsSnapshot) => {
                     cardsContainer.innerHTML = '';
                     if(cardsSnapshot.empty) { cardsContainer.innerHTML = '<p class="empty-list-text">هیچ کارتێک بۆ ئەم ڕیزە زیاد نەکراوە.</p>'; }
                     else { cardsSnapshot.forEach(cardDoc => { /* ... render card item ... */
                          const card = { id: cardDoc.id, ...cardDoc.data() }; const cardElement = document.createElement('div'); cardElement.className = 'admin-list-item';
                          cardElement.innerHTML = `<span>- ${card.name?.ku_sorani || 'Card'} (ڕیز: ${card.order})</span> <div> <button class="edit-card-btn edit-btn small-btn" data-row-id="${row.id}" data-card-id="${card.id}"><i class="fas fa-edit"></i></button> <button class="delete-card-btn delete-btn small-btn" data-row-id="${row.id}" data-card-id="${card.id}"><i class="fas fa-trash"></i></button> </div>`; cardsContainer.appendChild(cardElement);
                     }); }
                 });
            });
        }, (error) => { /* Handle error */ });
    },
    editShortcutRow: async function(rowId) {
        // Logic seems complete in skeleton
        try {
            const rowSnap = await getDoc(doc(db, "shortcut_rows", rowId));
            if (rowSnap.exists()) {
                const row = rowSnap.data();
                document.getElementById('editingShortcutRowId').value = rowId;
                document.getElementById('shortcutRowTitleKuSorani').value = row.title?.ku_sorani || ''; document.getElementById('shortcutRowTitleKuBadini').value = row.title?.ku_badini || ''; document.getElementById('shortcutRowTitleAr').value = row.title?.ar || '';
                document.getElementById('shortcutRowOrder').value = row.order || 10;
                document.getElementById('addShortcutRowForm').querySelector('button[type="submit"]').textContent = t('update_row', {default:'نوێکردنەوەی ڕیز'});
                document.getElementById('cancelRowEditBtn').style.display = 'inline-block';
                document.getElementById('addShortcutRowForm').scrollIntoView({ behavior: 'smooth' });
            } else { showNotification(t('row_not_found',{default:'ڕیزەکە نەدۆزرایەوە'}), 'error'); }
        } catch (error) { console.error("Error loading shortcut row for edit:", error); showNotification(t('error_generic'), 'error'); }
    },
    deleteShortcutRow: async function(rowId) {
        // Logic seems complete in skeleton
        if (confirm(t('delete_row_confirm',{default:'دڵنیایت دەتەوێت ئەم ڕیزە بسڕیتەوە؟ هەموو کارتەکانی ناویشی دەسڕێنەوە!'}))) {
            try {
                const cardsRef = collection(db, "shortcut_rows", rowId, "cards"); const cardsSnapshot = await getDocs(cardsRef); const deletePromises = cardsSnapshot.docs.map(d => deleteDoc(d.ref)); await Promise.all(deletePromises);
                await deleteDoc(doc(db, "shortcut_rows", rowId)); showNotification(t('row_deleted_success',{default:'ڕیزەکە بە تەواوی سڕدرایەوە'}), 'success'); clearProductCache();
            } catch (error) { console.error("Error deleting shortcut row: ", error); showNotification(t('error_generic'), 'error'); }
        }
    },
    editShortcutCard: async function(rowId, cardId) {
        // Logic seems complete in skeleton
        try {
            const cardSnap = await getDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
            if (cardSnap.exists()) {
                const card = cardSnap.data();
                document.getElementById('editingShortcutCardId').value = cardId; document.getElementById('selectRowForCard').value = rowId;
                document.getElementById('shortcutCardNameKuSorani').value = card.name?.ku_sorani || ''; document.getElementById('shortcutCardNameKuBadini').value = card.name?.ku_badini || ''; document.getElementById('shortcutCardNameAr').value = card.name?.ar || '';
                document.getElementById('shortcutCardImageUrl').value = card.imageUrl || ''; document.getElementById('shortcutCardOrder').value = card.order || 10;
                const mainCatSelect = document.getElementById('shortcutCardMainCategory'); mainCatSelect.value = card.categoryId || ''; mainCatSelect.dispatchEvent(new Event('change'));
                setTimeout(() => {
                    const subCatSelect = document.getElementById('shortcutCardSubcategory'); subCatSelect.value = card.subcategoryId || ''; subCatSelect.dispatchEvent(new Event('change'));
                    setTimeout(() => { document.getElementById('shortcutCardSubSubcategory').value = card.subSubcategoryId || ''; }, 500); // Allow sub-sub to populate
                }, 500); // Allow sub to populate
                document.getElementById('addCardToRowForm').querySelector('button[type="submit"]').textContent = t('update_card',{default:'نوێکردنەوەی کارت'});
                document.getElementById('cancelCardEditBtn').style.display = 'inline-block';
                document.getElementById('addCardToRowForm').scrollIntoView({ behavior: 'smooth' });
            } else { showNotification(t('card_not_found'), 'error'); }
        } catch(error) { console.error("Error loading shortcut card for edit:", error); showNotification(t('error_generic'), 'error'); }
    },
    deleteShortcutCard: async function(rowId, cardId) {
        // Logic seems complete in skeleton
        if (confirm(t('delete_card_confirm',{default:'دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟'}))) {
            try { await deleteDoc(doc(db, "shortcut_rows", rowId, "cards", cardId)); showNotification(t('card_deleted_success',{default:'کارتەکە سڕدرایەوە'}), 'success'); clearProductCache(); }
            catch (error) { console.error("Error deleting shortcut card: ", error); showNotification(t('error_generic'), 'error'); }
        }
    },
    updateShortcutCardCategoryDropdowns: function() {
        // Logic seems complete in skeleton
        const categories = getCategories(); if (!categories || categories.length <= 1) return;
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all'); const mainSelect = document.getElementById('shortcutCardMainCategory'); if (!mainSelect) return;
        const selectedValue = mainSelect.value; mainSelect.innerHTML = `<option value="">${t('all_products',{default:'-- هەموو کاڵاکان --'})}</option>`;
        categoriesWithoutAll.forEach(cat => { const option = document.createElement('option'); option.value = cat.id; option.textContent = cat.name_ku_sorani || cat.id; mainSelect.appendChild(option); });
         if (selectedValue && mainSelect.querySelector(`option[value="${selectedValue}"]`)) { mainSelect.value = selectedValue; }
    },

    // --- Home Layout Management ---
     migrateAndSetupDefaultHomeLayout: async function() {
        // Logic seems complete in skeleton
         const layoutCollectionRef = collection(db, 'home_layout'); const snapshot = await getDocs(query(layoutCollectionRef, limit(1)));
         if (snapshot.empty) { console.log("Creating default layout."); await this.createDefaultHomeLayout(layoutCollectionRef); return; }
         const firstDocData = snapshot.docs[0].data(); const isOldStructure = typeof firstDocData.name === 'string' || !firstDocData.hasOwnProperty('name');
         if (isOldStructure) {
             console.warn("Old layout detected. Migrating..."); showNotification('خەریکی نوێکردنەوەی سیستەمی ڕیزبەندییە...', 'success');
             const allDocsSnapshot = await getDocs(layoutCollectionRef); const deletePromises = allDocsSnapshot.docs.map(doc => deleteDoc(doc.ref)); await Promise.all(deletePromises);
             await this.createDefaultHomeLayout(layoutCollectionRef); console.log("New default layout created after migration.");
         } else { console.log("Layout structure is up to date."); }
     },
     createDefaultHomeLayout: async function(collectionRef) {
          // Logic seems complete in skeleton
          const defaultLayout = [ /* ... default items ... */
                { name: { ku_sorani: 'سلایدەری ڕێکلام', ku_badini: 'سلایدەرێ ڕێکلاما', ar: 'سلايدر الإعلانات' }, order: 1, type: 'promo_slider', enabled: true, groupId: 'default' },
                { name: { ku_sorani: 'بەشی براندەکان', ku_badini: 'پشکا براندا', ar: 'قسم الماركات' }, order: 2, type: 'brands', enabled: true, groupId: 'default' },
                { name: { ku_sorani: 'نوێترین کاڵاکان', ku_badini: 'نووترین کاڵا', ar: 'أحدث المنتجات' }, order: 3, type: 'newest_products', enabled: true },
                { name: { ku_sorani: 'هەموو کاڵاکان', ku_badini: 'هەمی کاڵا', ar: 'كل المنتجات' }, order: 4, type: 'all_products', enabled: true }
           ];
          const addPromises = defaultLayout.map(item => addDoc(collectionRef, item));
          // Ensure default groups exist
          await setDoc(doc(promoGroupsCollection, 'default'), { name: 'گرووپی سەرەکی', createdAt: Date.now() }, { merge: true });
          await setDoc(doc(brandGroupsCollection, 'default'), { name: 'گرووپی سەرەکی', createdAt: Date.now() }, { merge: true });
          await Promise.all(addPromises);
     },
     renderHomeLayoutAdmin: function() {
        // Logic seems complete in skeleton - renders draggable list using onSnapshot
        const container = document.getElementById('homeLayoutListContainer');
        if(!container) return;
        const layoutCollection = collection(db, 'home_layout'); const q = query(layoutCollection, orderBy("order", "asc"));
        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) { container.innerHTML = '<p>هیچ بەشێک زیاد نەکراوە.</p>'; return; }
            snapshot.forEach(doc => { /* ... render draggable item ... */
                const item = { id: doc.id, ...doc.data() }; const itemElement = document.createElement('div'); itemElement.className = 'layout-item'; itemElement.dataset.id = item.id; itemElement.draggable = true;
                const itemName = (item.name && typeof item.name === 'object') ? (item.name[getCurrentLanguage()] || item.name.ku_sorani) : item.name;
                itemElement.innerHTML = `<div class="layout-item-info"> <i class="fas fa-grip-vertical drag-handle"></i> <span>${itemName}</span> </div> <div class="layout-item-actions"> <label class="switch"> <input type="checkbox" class="enabled-toggle" ${item.enabled ? 'checked' : ''}> <span class="slider"></span> </label> <button class="delete-layout-item-btn delete-btn small-btn"><i class="fas fa-trash"></i></button> </div>`; container.appendChild(itemElement);
            });
            // Attach drag listeners after rendering
            const items = container.querySelectorAll('.layout-item');
            items.forEach(item => { item.addEventListener('dragstart', () => setTimeout(() => item.classList.add('dragging'), 0)); item.addEventListener('dragend', () => item.classList.remove('dragging')); });
        }, (error) => { /* Handle error */ });
     },
     getDragAfterElement: function(container, y) {
           // Logic seems complete in skeleton
            const draggableElements = [...container.querySelectorAll('.layout-item:not(.dragging)')];
            return draggableElements.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element;
     },
     deleteHomeLayoutItem: async function(itemId) {
         // Logic seems complete in skeleton
         if (confirm(t('delete_layout_item_confirm', {default:'دڵنیایت دەتەوێت ئەم بەشە بسڕیتەوە؟'}))) {
             try { await deleteDoc(doc(db, 'home_layout', itemId)); showNotification(t('layout_item_deleted', {default:'بەشەکە سڕدرایەوە'}), 'success'); clearProductCache(); }
             catch (error) { console.error("Error deleting layout item:", error); showNotification(t('error_generic'), 'error'); }
         }
     },
     saveHomeLayout: async function() {
          // Logic seems complete in skeleton
           const container = document.getElementById('homeLayoutListContainer'); const saveBtn = document.getElementById('saveLayoutBtn'); if (!container || !saveBtn) return;
           const originalText = saveBtn.textContent; saveBtn.disabled = true; saveBtn.textContent = t('saving', {default:'...پاشەکەوت دەکرێت'});
           const items = container.querySelectorAll('.layout-item'); const updatePromises = [];
           items.forEach((item, index) => { const docId = item.dataset.id; const isEnabled = item.querySelector('.enabled-toggle')?.checked ?? true; const newOrder = index + 1; const docRef = doc(db, 'home_layout', docId); updatePromises.push(updateDoc(docRef, { order: newOrder, enabled: isEnabled })); });
           try { await Promise.all(updatePromises); showNotification(t('layout_saved_success', {default:'ڕیزبەندی پاشەکەوت کرا'}), 'success'); clearProductCache(); }
           catch (error) { console.error("Error saving layout:", error); showNotification(t('error_saving_layout', {default:'هەڵەیەک ڕوویدا'}), 'error'); }
           finally { saveBtn.disabled = false; saveBtn.textContent = originalText; }
     },


    // --- Event Listeners Setup ---
    setupAdminEventListeners: function() {
        if (this.listenersAttached) return;
        console.log("Attaching admin event listeners...");
        const self = this; // Reference to AdminLogic object for callbacks

        // --- Product Form ---
        const productForm = document.getElementById('productForm');
        if (productForm) productForm.onsubmit = async (e) => {
             e.preventDefault();
             const submitButton = e.target.querySelector('button[type="submit"]');
             if(submitButton.disabled) return; // Prevent double submit
             submitButton.disabled = true;
             submitButton.textContent = t('saving',{default:'...چاوەڕێ بە'});

             const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
             if (imageUrls.length === 0) {
                 showNotification(t('error_at_least_one_image',{default:'پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت'}), 'error');
                 submitButton.disabled = false; submitButton.textContent = getEditingProductId() ? t('update_button') : t('save_button'); return;
             }

             const productNameKuSorani = document.getElementById('productNameKuSorani')?.value || '';
             const productData = {
                 name: {
                     ku_sorani: productNameKuSorani,
                     ku_badini: document.getElementById('productNameKuBadini')?.value || '',
                     ar: document.getElementById('productNameAr')?.value || ''
                 },
                 searchableName: productNameKuSorani.toLowerCase(), // Use Sorani for search
                 price: parseInt(document.getElementById('productPrice')?.value) || 0,
                 originalPrice: parseInt(document.getElementById('productOriginalPrice')?.value) || null,
                 categoryId: document.getElementById('productCategoryId')?.value || null,
                 subcategoryId: document.getElementById('productSubcategoryId')?.value || null,
                 subSubcategoryId: document.getElementById('productSubSubcategoryId')?.value || null,
                 description: {
                     ku_sorani: document.getElementById('productDescriptionKuSorani')?.value || '',
                     ku_badini: document.getElementById('productDescriptionKuBadini')?.value || '',
                     ar: document.getElementById('productDescriptionAr')?.value || ''
                 },
                 imageUrls: imageUrls,
                 externalLink: document.getElementById('productExternalLink')?.value.trim() || null,
                 shippingInfo: {
                     ku_sorani: document.getElementById('shippingInfoKuSorani')?.value.trim() || '',
                     ku_badini: document.getElementById('shippingInfoKuBadini')?.value.trim() || '',
                     ar: document.getElementById('shippingInfoAr')?.value.trim() || ''
                 },
                 // createdAt handled differently for add/update
             };

             try {
                 const editingId = getEditingProductId();
                 if (editingId) {
                     productData.updatedAt = Date.now(); // Add updated timestamp
                     await updateDoc(doc(db, "products", editingId), productData);
                     showNotification(t('product_updated_success',{default:'کاڵا نوێکرایەوە'}), 'success');
                 } else {
                     productData.createdAt = Date.now(); // Add created timestamp
                     await addDoc(productsCollection, productData);
                     showNotification(t('product_added_success',{default:'کاڵا زیادکرا'}), 'success');
                 }
                 clearProductCache(); // Clear cache and trigger re-render
                 closeCurrentPopup(); // Close the modal
                 // searchProductsInFirestore() will be called by clearProductCache
                 setEditingProductId(null); // Reset editing state
                 productForm.reset(); // Reset form for next time
             } catch (error) {
                 showNotification(t('error_generic'), 'error');
                 console.error("Error saving product:", error);
             } finally {
                 submitButton.disabled = false;
                 submitButton.textContent = getEditingProductId() ? t('update_button') : t('save_button'); // Reset text based on potential (failed) edit state
             }
        };
        // Image preview update listener
         const imageInputsContainer = document.getElementById('imageInputsContainer');
         if(imageInputsContainer) imageInputsContainer.addEventListener('input', (e) => {
             if (e.target.classList.contains('productImageUrl')) {
                 const previewImg = e.target.nextElementSibling;
                 const url = e.target.value;
                 const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                 if (previewImg) previewImg.src = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
             }
         });
         // Dependent dropdowns for Product Form
         const productCatSelect = document.getElementById('productCategoryId');
         if(productCatSelect) productCatSelect.addEventListener('change', (e) => {
             self.populateSubcategoriesDropdown(e.target.value); // Populate sub
             self.populateSubSubcategoriesDropdown(null, null); // Clear sub-sub
             document.getElementById('subSubcategorySelectContainer').style.display = 'none'; // Hide sub-sub container
         });
         const productSubCatSelect = document.getElementById('productSubcategoryId');
         if(productSubCatSelect) productSubCatSelect.addEventListener('change', (e) => {
             const mainCatId = productCatSelect.value;
             self.populateSubSubcategoriesDropdown(mainCatId, e.target.value); // Populate sub-sub
         });


        // --- Category Management Forms & Buttons ---
        const addCategoryForm = document.getElementById('addCategoryForm');
        if (addCategoryForm) addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
            const categoryData = { name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value, name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value, name_ar: document.getElementById('mainCategoryNameAr').value, icon: document.getElementById('mainCategoryIcon').value, order: parseInt(document.getElementById('mainCategoryOrder').value) };
            try { await addDoc(categoriesCollection, categoryData); showNotification('جۆری سەرەکی زیادکرا', 'success'); addCategoryForm.reset(); clearProductCache(); self.renderCategoryManagementUI(); self.updateAdminCategoryDropdowns(); }
            catch (error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });

        const addSubcategoryForm = document.getElementById('addSubcategoryForm');
        if (addSubcategoryForm) addSubcategoryForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; const parentId = document.getElementById('parentCategorySelect').value; if (!parentId) { showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error'); btn.disabled = false; return; }
             const subCategoryData = { name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value, name_ku_badini: document.getElementById('subcategoryNameKuBadini').value, name_ar: document.getElementById('subcategoryNameAr').value, imageUrl: document.getElementById('subcategoryImageUrl').value || null, order: parseInt(document.getElementById('subcategoryOrder').value) };
             try { await addDoc(collection(db, `categories/${parentId}/subcategories`), subCategoryData); showNotification('جۆری لاوەکی زیادکرا', 'success'); addSubcategoryForm.reset(); clearProductCache(); self.renderCategoryManagementUI(); }
             catch (error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });

        const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
        if (addSubSubcategoryForm) addSubSubcategoryForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; const mainId = document.getElementById('parentMainCategorySelectForSubSub').value; const subId = document.getElementById('parentSubcategorySelectForSubSub').value; if (!mainId || !subId) { showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error'); btn.disabled = false; return; }
             const subSubData = { name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value, name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value, name_ar: document.getElementById('subSubcategoryNameAr').value, imageUrl: document.getElementById('subSubcategoryImageUrl').value || null, order: parseInt(document.getElementById('subSubcategoryOrder').value) };
             try { await addDoc(collection(db, `categories/${mainId}/subcategories/${subId}/subSubcategories`), subSubData); showNotification('جۆری لاوەکی لاوەکی زیادکرا', 'success'); addSubSubcategoryForm.reset(); document.getElementById('parentSubcategorySelectForSubSub').innerHTML = '<option value="" disabled selected>-- ... --</option>'; clearProductCache(); self.renderCategoryManagementUI(); }
             catch (error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });

        const editCategoryForm = document.getElementById('editCategoryForm');
        if (editCategoryForm) editCategoryForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
             const docPath = document.getElementById('editCategoryDocPath').value; const level = document.getElementById('editCategoryLevel').value;
             let updateData = { name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value, name_ku_badini: document.getElementById('editCategoryNameKuBadini').value, name_ar: document.getElementById('editCategoryNameAr').value, order: parseInt(document.getElementById('editCategoryOrder').value) };
             if (level === '1') { updateData.icon = document.getElementById('editCategoryIcon').value; }
             else { updateData.imageUrl = document.getElementById('editCategoryImageUrl').value || null; }
             try { await updateDoc(doc(db, docPath), updateData); showNotification('گۆڕانکاری پاشەکەوت کرا', 'success'); closeCurrentPopup(); clearProductCache(); self.renderCategoryManagementUI(); self.updateAdminCategoryDropdowns(); }
             catch (error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });

        // Category List Edit/Delete Button Delegation (already in skeleton)
        const categoryListContainer = document.getElementById('categoryListContainer');
        if (categoryListContainer) categoryListContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-category-btn');
            const deleteBtn = e.target.closest('.delete-category-btn');
            if (editBtn) self.openEditCategoryModal(editBtn.dataset.path, editBtn.dataset.level);
            else if (deleteBtn) self.handleDeleteCategory(deleteBtn.dataset.path, deleteBtn.dataset.name);
        });
        // Dependent Dropdowns for SubSubcategory Form (already in skeleton)
        const parentMainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
        const parentSubCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
        if(parentMainCatSelect) parentMainCatSelect.addEventListener('change', (e) => {
            if(parentSubCatSelect) self.populateAdminSubcategories(e.target.value, 'parentSubcategorySelectForSubSub', false, 'select_subcategory_required');
        });


        // --- Announcement Form & List ---
        const announcementForm = document.getElementById('announcementForm');
        if (announcementForm) announcementForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
             const data = { title: { ku_sorani: document.getElementById('announcementTitleKuSorani').value, ku_badini: document.getElementById('announcementTitleKuBadini').value, ar: document.getElementById('announcementTitleAr').value }, content: { ku_sorani: document.getElementById('announcementContentKuSorani').value, ku_badini: document.getElementById('announcementContentKuBadini').value, ar: document.getElementById('announcementContentAr').value }, createdAt: Date.now() };
             try { await addDoc(announcementsCollection, data); showNotification('ئاگەداری نێردرا', 'success'); announcementForm.reset(); }
             catch(error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });
        // Delete button delegation (already in skeleton)
        const announcementsListContainer = document.getElementById('announcementsListContainer');
        if (announcementsListContainer) announcementsListContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-announcement-btn');
            if (deleteBtn) self.deleteAnnouncement(deleteBtn.dataset.id);
        });

        // --- Policies Form ---
        const policiesForm = document.getElementById('policiesForm');
        if (policiesForm) policiesForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
            const data = { content: { ku_sorani: document.getElementById('policiesContentKuSorani').value, ku_badini: document.getElementById('policiesContentKuBadini').value, ar: document.getElementById('policiesContentAr').value } };
            try { await setDoc(doc(db, "settings", "policies"), data, { merge: true }); showNotification(t('policies_saved_success'), 'success'); }
            catch(error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });

        // --- Social Media Form & List ---
        const addSocialMediaForm = document.getElementById('addSocialMediaForm');
        if (addSocialMediaForm) addSocialMediaForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
            const data = { name_ku_sorani: document.getElementById('socialNameKuSorani').value, name_ku_badini: document.getElementById('socialNameKuBadini').value, name_ar: document.getElementById('socialNameAr').value, url: document.getElementById('socialUrl').value, icon: document.getElementById('socialIcon').value, createdAt: Date.now() };
            try { await addDoc(collection(db, 'settings/contactInfo/socialLinks'), data); showNotification('لینک زیادکرا', 'success'); addSocialMediaForm.reset(); }
            catch(error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });
        // Delete button delegation (already in skeleton)
        const socialLinksListContainer = document.getElementById('socialLinksListContainer');
        if (socialLinksListContainer) socialLinksListContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-social-link-btn');
            if (deleteBtn) self.deleteSocialMediaLink(deleteBtn.dataset.id);
        });
        // Toggle (already in skeleton)
        const socialMediaToggle = document.getElementById('socialMediaToggle');
        if (socialMediaToggle) socialMediaToggle.onclick = () => { /* Reuse logic */
            const container = document.getElementById('adminSocialMediaManagement')?.querySelector('.contact-links-container');
            const chevron = socialMediaToggle.querySelector('.contact-chevron');
            if(container && chevron) { container.classList.toggle('open'); chevron.classList.toggle('open'); }
        };

        // --- Contact Methods Form & List ---
        const addContactMethodForm = document.getElementById('addContactMethodForm');
        if (addContactMethodForm) addContactMethodForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
            const data = { type: document.getElementById('contactMethodType').value, value: document.getElementById('contactMethodValue').value, name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value, name_ku_badini: document.getElementById('contactMethodNameKuBadini').value, name_ar: document.getElementById('contactMethodNameAr').value, icon: document.getElementById('contactMethodIcon').value, color: document.getElementById('contactMethodColor').value, createdAt: Date.now() };
            try { await addDoc(collection(db, 'settings/contactInfo/contactMethods'), data); showNotification('شێواز زیادکرا', 'success'); addContactMethodForm.reset(); }
            catch(error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });
        // Delete button delegation (already in skeleton)
        const contactMethodsListContainer = document.getElementById('contactMethodsListContainer');
        if (contactMethodsListContainer) contactMethodsListContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-contact-method-btn');
            if (deleteBtn) self.deleteContactMethod(deleteBtn.dataset.id);
        });

        // --- Promo Cards Forms & Lists --- (Submit logic filled)
        const addPromoGroupForm = document.getElementById('addPromoGroupForm');
        if(addPromoGroupForm) addPromoGroupForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; const name = document.getElementById('promoGroupName').value;
             if (name.trim()) { try { await addDoc(promoGroupsCollection, { name: name.trim(), createdAt: Date.now() }); showNotification('گرووپ زیادکرا', 'success'); e.target.reset(); } catch(error){console.error(error); showNotification(t('error_generic'),'error');} } else { showNotification('تکایە ناوێک بنووسە','error'); } btn.disabled = false;
        });
        const addPromoCardForm = document.getElementById('addPromoCardForm');
        if(addPromoCardForm) addPromoCardForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; const groupId = document.getElementById('promoCardGroupSelect').value; if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); btn.disabled = false; return; }
             const editingId = document.getElementById('editingPromoCardId').value;
             const cardData = { imageUrls: { ku_sorani: document.getElementById('promoCardImageKuSorani').value, ku_badini: document.getElementById('promoCardImageKuBadini').value, ar: document.getElementById('promoCardImageAr').value }, categoryId: document.getElementById('promoCardTargetCategory').value || null, order: parseInt(document.getElementById('promoCardOrder').value) || 0 };
             try { const ref = collection(db, `promo_groups/${groupId}/cards`); if (editingId) { await setDoc(doc(ref, editingId), cardData, { merge: true }); showNotification('کارت نوێکرایەوە', 'success'); } else { cardData.createdAt = Date.now(); await addDoc(ref, cardData); showNotification('کارت زیادکرا', 'success'); } e.target.reset(); document.getElementById('editingPromoCardId').value = ''; btn.textContent = t('save_button'); clearProductCache(); }
             catch(error) { console.error(error); showNotification(t('error_generic'),'error'); } finally { btn.disabled = false; }
        });
        // Delegation for lists (already in skeleton)
        const promoGroupsListContainer = document.getElementById('promoGroupsListContainer');
        if(promoGroupsListContainer) promoGroupsListContainer.addEventListener('click', (e) => { /* ... delegation logic ... */
             if (e.target.closest('.edit-promo-group-btn')) self.editPromoGroup(e.target.closest('.edit-promo-group-btn').dataset.id);
             if (e.target.closest('.delete-promo-group-btn')) self.deletePromoGroup(e.target.closest('.delete-promo-group-btn').dataset.id);
             if (e.target.closest('.edit-promo-card-btn')) { const btn = e.target.closest('.edit-promo-card-btn'); self.editPromoCard(btn.dataset.groupId, btn.dataset.cardId); }
             if (e.target.closest('.delete-promo-card-btn')) { const btn = e.target.closest('.delete-promo-card-btn'); self.deletePromoCard(btn.dataset.groupId, btn.dataset.cardId); }
        });


        // --- Brands Forms & Lists --- (Submit logic filled)
        const addBrandGroupForm = document.getElementById('addBrandGroupForm');
        if(addBrandGroupForm) addBrandGroupForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; const name = document.getElementById('brandGroupName').value;
             if (name.trim()) { try { await addDoc(brandGroupsCollection, { name: name.trim(), createdAt: Date.now() }); showNotification('گرووپی براند زیادکرا', 'success'); e.target.reset(); } catch(error){console.error(error); showNotification(t('error_generic'),'error');} } else { showNotification('تکایە ناوێک بنووسە','error'); } btn.disabled = false;
        });
        const addBrandForm = document.getElementById('addBrandForm');
        if(addBrandForm) addBrandForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; const groupId = document.getElementById('brandGroupSelect').value; if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); btn.disabled = false; return; }
             const editingId = document.getElementById('editingBrandId').value;
             const brandData = { name: { ku_sorani: document.getElementById('brandNameKuSorani').value, ku_badini: document.getElementById('brandNameKuBadini').value, ar: document.getElementById('brandNameAr').value }, imageUrl: document.getElementById('brandImageUrl').value, categoryId: document.getElementById('brandTargetMainCategory').value || null, subcategoryId: document.getElementById('brandTargetSubcategory').value || null, order: parseInt(document.getElementById('brandOrder').value) || 0 };
             try { const ref = collection(db, `brand_groups/${groupId}/brands`); if (editingId) { await setDoc(doc(ref, editingId), brandData, { merge: true }); showNotification('براند نوێکرایەوە', 'success'); } else { brandData.createdAt = Date.now(); await addDoc(ref, brandData); showNotification('براند زیادکرا', 'success'); } e.target.reset(); document.getElementById('editingBrandId').value = ''; document.getElementById('brandSubcategoryContainer').style.display = 'none'; btn.textContent = t('save_button'); clearProductCache(); }
             catch(error) { console.error(error); showNotification(t('error_generic'),'error'); } finally { btn.disabled = false; }
        });
        // Delegation for lists (already in skeleton)
        const brandGroupsListContainer = document.getElementById('brandGroupsListContainer');
        if(brandGroupsListContainer) brandGroupsListContainer.addEventListener('click', (e) => { /* ... delegation logic ... */
            if (e.target.closest('.edit-brand-group-btn')) self.editBrandGroup(e.target.closest('.edit-brand-group-btn').dataset.id);
            if (e.target.closest('.delete-brand-group-btn')) self.deleteBrandGroup(e.target.closest('.delete-brand-group-btn').dataset.id);
            if (e.target.closest('.edit-brand-btn')) { const btn = e.target.closest('.edit-brand-btn'); self.editBrand(btn.dataset.groupId, btn.dataset.brandId); }
            if (e.target.closest('.delete-brand-btn')) { const btn = e.target.closest('.delete-brand-btn'); self.deleteBrand(btn.dataset.groupId, btn.dataset.brandId); }
        });
        // Brand form dependent dropdown (already in skeleton)
        const brandMainCatSelect = document.getElementById('brandTargetMainCategory');
        if(brandMainCatSelect) brandMainCatSelect.addEventListener('change', (e) => { /* ... logic to show/populate subcat ... */
            const mainCatId = e.target.value; const container = document.getElementById('brandSubcategoryContainer'); if(!container) return; container.style.display = mainCatId ? 'block' : 'none'; self.populateAdminSubcategories(mainCatId, 'brandTargetSubcategory', true, 'all_subcategories');
        });

        // --- Shortcut Rows Forms & Lists --- (Submit logic filled)
        const addShortcutRowForm = document.getElementById('addShortcutRowForm');
        if(addShortcutRowForm) addShortcutRowForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
            const editingId = document.getElementById('editingShortcutRowId').value;
            const rowData = { title: { ku_sorani: document.getElementById('shortcutRowTitleKuSorani').value, ku_badini: document.getElementById('shortcutRowTitleKuBadini').value, ar: document.getElementById('shortcutRowTitleAr').value }, order: parseInt(document.getElementById('shortcutRowOrder').value) || 0 };
            try { if (editingId) { await updateDoc(doc(shortcutRowsCollection, editingId), rowData); showNotification('ڕیز نوێکرایەوە', 'success'); } else { rowData.createdAt = Date.now(); await addDoc(shortcutRowsCollection, rowData); showNotification('ڕیز زیادکرا', 'success'); } addShortcutRowForm.reset(); document.getElementById('editingShortcutRowId').value = ''; btn.textContent = t('save_row',{default:'پاشەکەوتکردنی ڕیز'}); document.getElementById('cancelRowEditBtn').style.display = 'none'; clearProductCache(); }
            catch(error) { console.error(error); showNotification(t('error_generic'),'error'); } finally { btn.disabled = false; }
        });
        const addCardToRowForm = document.getElementById('addCardToRowForm');
        if(addCardToRowForm) addCardToRowForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; const rowId = document.getElementById('selectRowForCard').value; if (!rowId) { showNotification('تکایە ڕیزێک هەڵبژێرە', 'error'); btn.disabled = false; return; }
             const editingId = document.getElementById('editingShortcutCardId').value;
             const cardData = { name: { ku_sorani: document.getElementById('shortcutCardNameKuSorani').value, ku_badini: document.getElementById('shortcutCardNameKuBadini').value, ar: document.getElementById('shortcutCardNameAr').value }, imageUrl: document.getElementById('shortcutCardImageUrl').value, categoryId: document.getElementById('shortcutCardMainCategory').value || null, subcategoryId: document.getElementById('shortcutCardSubcategory').value || null, subSubcategoryId: document.getElementById('shortcutCardSubSubcategory').value || null, order: parseInt(document.getElementById('shortcutCardOrder').value) || 0 };
             try { const ref = collection(db, `shortcut_rows/${rowId}/cards`); if (editingId) { await setDoc(doc(ref, editingId), cardData, { merge: true }); showNotification('کارت نوێکرایەوە', 'success'); } else { cardData.createdAt = Date.now(); await addDoc(ref, cardData); showNotification('کارت زیادکرا', 'success'); } addCardToRowForm.reset(); document.getElementById('editingShortcutCardId').value = ''; btn.textContent = t('add_card',{default:'زیادکردنی کارت'}); document.getElementById('cancelCardEditBtn').style.display = 'none'; document.getElementById('shortcutCardSubContainer').style.display='none'; document.getElementById('shortcutCardSubSubContainer').style.display='none'; clearProductCache(); }
             catch(error) { console.error(error); showNotification(t('error_generic'),'error'); } finally { btn.disabled = false; }
        });
         // Cancel Edit Buttons (filled logic)
         const cancelRowEditBtn = document.getElementById('cancelRowEditBtn');
         if(cancelRowEditBtn) cancelRowEditBtn.onclick = () => { addShortcutRowForm.reset(); document.getElementById('editingShortcutRowId').value = ''; addShortcutRowForm.querySelector('button[type="submit"]').textContent = t('save_row'); cancelRowEditBtn.style.display = 'none'; };
         const cancelCardEditBtn = document.getElementById('cancelCardEditBtn');
         if(cancelCardEditBtn) cancelCardEditBtn.onclick = () => { addCardToRowForm.reset(); document.getElementById('editingShortcutCardId').value = ''; addCardToRowForm.querySelector('button[type="submit"]').textContent = t('add_card'); cancelCardEditBtn.style.display = 'none'; document.getElementById('shortcutCardSubContainer').style.display='none'; document.getElementById('shortcutCardSubSubContainer').style.display='none'; };
        // Delegation for lists (already in skeleton)
        const shortcutRowsListContainer = document.getElementById('shortcutRowsListContainer');
        if(shortcutRowsListContainer) shortcutRowsListContainer.addEventListener('click', (e) => { /* ... delegation logic ... */
            const editRowBtn = e.target.closest('.edit-row-btn'); if (editRowBtn) self.editShortcutRow(editRowBtn.dataset.id);
            const deleteRowBtn = e.target.closest('.delete-row-btn'); if (deleteRowBtn) self.deleteShortcutRow(deleteRowBtn.dataset.id);
            const editCardBtn = e.target.closest('.edit-card-btn'); if (editCardBtn) self.editShortcutCard(editCardBtn.dataset.rowId, editCardBtn.dataset.cardId);
            const deleteCardBtn = e.target.closest('.delete-card-btn'); if (deleteCardBtn) self.deleteShortcutCard(deleteCardBtn.dataset.rowId, deleteCardBtn.dataset.cardId);
        });
        // Shortcut card form dependent dropdowns (already in skeleton)
        const shortcutCardMainCatSelect = document.getElementById('shortcutCardMainCategory');
        const shortcutCardSubCatSelect = document.getElementById('shortcutCardSubcategory');
        if(shortcutCardMainCatSelect) shortcutCardMainCatSelect.addEventListener('change', (e) => { /* ... logic ... */
             const subContainer = document.getElementById('shortcutCardSubContainer'); const subSubContainer = document.getElementById('shortcutCardSubSubContainer'); const mainId = e.target.value; if(subContainer) subContainer.style.display = mainId ? 'block' : 'none'; if(subSubContainer) subSubContainer.style.display = 'none'; self.populateAdminSubcategories(mainId, 'shortcutCardSubcategory', true, 'all_subcategories_optional');
        });
        if(shortcutCardSubCatSelect) shortcutCardSubCatSelect.addEventListener('change', (e) => { /* ... logic ... */
             const mainCatId = shortcutCardMainCatSelect.value; const subCatId = e.target.value; const subSubContainer = document.getElementById('shortcutCardSubSubContainer'); if (mainCatId && subCatId) { if(subSubContainer) subSubContainer.style.display = 'block'; self.populateAdminSubSubcategories(mainCatId, subCatId, 'shortcutCardSubSubcategory', true, 'all_subsubcategories_optional'); } else { if(subSubContainer) subSubContainer.style.display = 'none'; }
        });

        // --- Home Layout Management --- (Submit logic filled)
        const saveLayoutBtn = document.getElementById('saveLayoutBtn');
        if(saveLayoutBtn) saveLayoutBtn.addEventListener('click', () => self.saveHomeLayout());

        const addHomeSectionBtn = document.getElementById('addHomeSectionBtn');
        if(addHomeSectionBtn) addHomeSectionBtn.addEventListener('click', () => {
             document.getElementById('addHomeSectionForm').reset(); document.getElementById('specificItemGroupSelectContainer').style.display = 'none'; document.getElementById('specificCategorySelectContainer').style.display = 'none';
             // Reset sub/sub-sub category dropdowns in modal
             const subCatModal = document.getElementById('newSectionSubcategoryContainer'); if(subCatModal) subCatModal.style.display = 'none';
             const subSubCatModal = document.getElementById('newSectionSubSubcategoryContainer'); if(subSubCatModal) subSubCatModal.style.display = 'none';
             openPopup('addHomeSectionModal', 'modal');
        });

        const addHomeSectionForm = document.getElementById('addHomeSectionForm');
        if(addHomeSectionForm) addHomeSectionForm.addEventListener('submit', async (e) => {
             e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
             const type = document.getElementById('newSectionType').value; const nameInput = document.getElementById('newSectionName').value; let nameObj = { ku_sorani: nameInput, ku_badini: nameInput, ar: nameInput }; let specificIdData = {};
             // ... (logic from skeleton to determine specificIdData based on type) ...
               if (type === 'promo_slider' || type === 'brands') { const groupId = document.getElementById('specificItemGroupId').value; if (!groupId) { showNotification(t('select_group_prompt',{default:'تکایە گرووپێک هەڵبژێرە'}), 'error'); btn.disabled = false; return; } specificIdData = { groupId }; }
               else if (type === 'single_shortcut_row') { const rowId = document.getElementById('specificItemGroupId').value; if (!rowId) { showNotification(t('select_row_prompt',{default:'تکایە ڕیزێک هەڵبژێرە'}), 'error'); btn.disabled = false; return; } specificIdData = { rowId }; }
               else if (type === 'single_category_row') { const catId = document.getElementById('newSectionMainCategory').value; const subCatId = document.getElementById('newSectionSubcategory').value; const subSubCatId = document.getElementById('newSectionSubSubcategory').value; if (!catId) { showNotification(t('select_main_category_required',{default:'تکایە جۆری سەرەکی هەڵبژێرە'}), 'error'); btn.disabled = false; return; } specificIdData = { categoryId: catId, subcategoryId: subCatId || null, subSubcategoryId: subSubCatId || null }; }

             try { const layoutRef = collection(db, 'home_layout'); const q = query(layoutRef, orderBy('order', 'desc'), limit(1)); const lastSnap = await getDocs(q); const lastOrder = lastSnap.empty ? 0 : lastSnap.docs[0].data().order; const newData = { name: nameObj, type, order: lastOrder + 1, enabled: true, ...specificIdData }; await addDoc(layoutRef, newData); showNotification(t('section_added_success',{default:'بەشی نوێ زیادکرا'}), 'success'); closeCurrentPopup(); clearProductCache(); }
             catch(error) { console.error(error); showNotification(t('error_generic'), 'error'); } finally { btn.disabled = false; }
        });

        // Dependent dropdowns in Add Home Section Modal (already in skeleton)
        const newSectionTypeSelect = document.getElementById('newSectionType');
        if(newSectionTypeSelect) newSectionTypeSelect.addEventListener('change', async (e) => { /* ... logic from skeleton ... */
             const type = e.target.value; const groupContainer = document.getElementById('specificItemGroupSelectContainer'); const categoryContainer = document.getElementById('specificCategorySelectContainer'); const groupSelect = document.getElementById('specificItemGroupId'); const mainCatSelect = document.getElementById('newSectionMainCategory'); const groupLabel = document.getElementById('specificItemGroupLabel'); groupSelect.required = false; mainCatSelect.required = false; groupContainer.style.display = 'none'; categoryContainer.style.display = 'none';
             if (type === 'promo_slider' || type === 'brands' || type === 'single_shortcut_row') {
                 groupContainer.style.display = 'block'; groupSelect.required = true; groupSelect.innerHTML = `<option value="">${t('loading')}</option>`; let collectionRef, orderField, nameFieldAccessor;
                 if (type === 'promo_slider') { collectionRef = promoGroupsCollection; groupLabel.textContent = t('select_promo_group'); orderField = 'name'; nameFieldAccessor = (data) => data.name; }
                 else if (type === 'brands') { collectionRef = brandGroupsCollection; groupLabel.textContent = t('select_brand_group'); orderField = 'name'; nameFieldAccessor = (data) => data.name; }
                 else { collectionRef = shortcutRowsCollection; groupLabel.textContent = t('select_shortcut_row'); orderField = 'order'; nameFieldAccessor = (data) => data.title?.ku_sorani || 'Row'; }
                 const snapshot = await getDocs(query(collectionRef, orderBy(orderField))); groupSelect.innerHTML = `<option value="" disabled selected>${t('select_group_or_row')}</option>`; snapshot.forEach(doc => { const data = doc.data(); const name = nameFieldAccessor(data); groupSelect.innerHTML += `<option value="${doc.id}">${name}</option>`; });
             } else if (type === 'single_category_row') {
                 categoryContainer.style.display = 'block'; mainCatSelect.required = true; mainCatSelect.innerHTML = `<option value="">${t('select_main_category_required')}</option>`; getCategories().filter(c => c.id !== 'all').forEach(cat => { mainCatSelect.innerHTML += `<option value="${cat.id}">${cat.name_ku_sorani}</option>`; });
                 // Reset sub/sub-sub dropdowns in modal
                 const subCatModal = document.getElementById('newSectionSubcategoryContainer'); if(subCatModal) subCatModal.style.display = 'none';
                 const subSubCatModal = document.getElementById('newSectionSubSubcategoryContainer'); if(subSubCatModal) subSubCatModal.style.display = 'none';
             }
        });
        const newSectionMainCatSelect = document.getElementById('newSectionMainCategory');
        if(newSectionMainCatSelect) newSectionMainCatSelect.addEventListener('change', async (e) => { /* ... logic to show/populate subcat ... */
             const mainCatId = e.target.value; const subContainer = document.getElementById('newSectionSubcategoryContainer'); const subSubContainer = document.getElementById('newSectionSubSubcategoryContainer'); const subSelect = document.getElementById('newSectionSubcategory'); if(!subContainer || ! subSelect || !subSubContainer) return;
             if(subSubContainer) subSubContainer.style.display = 'none'; // Hide sub-sub when main changes
             if (mainCatId) { subContainer.style.display = 'block'; self.populateAdminSubcategories(mainCatId, 'newSectionSubcategory', true, 'all_subcategories_optional'); }
             else { subContainer.style.display = 'none'; subSelect.innerHTML = ''; }
        });
        const newSectionSubCatSelect = document.getElementById('newSectionSubcategory');
        if(newSectionSubCatSelect) newSectionSubCatSelect.addEventListener('change', async (e) => { /* ... logic to show/populate sub-subcat ... */
             const mainCatId = newSectionMainCatSelect.value; const subCatId = e.target.value; const subSubContainer = document.getElementById('newSectionSubSubcategoryContainer'); if(!subSubContainer) return;
             if (mainCatId && subCatId) { subSubContainer.style.display = 'block'; self.populateAdminSubSubcategories(mainCatId, subCatId, 'newSectionSubSubcategory', true, 'all_subsubcategories_optional'); }
             else { subSubContainer.style.display = 'none'; }
        });

        // Drag and drop for Home Layout (already in skeleton)
        const homeLayoutListContainer = document.getElementById('homeLayoutListContainer');
        if(homeLayoutListContainer) {
            homeLayoutListContainer.addEventListener('click', (e) => { /* ... delete delegation ... */
                 const deleteBtn = e.target.closest('.delete-layout-item-btn'); if(deleteBtn) { const itemId = deleteBtn.closest('.layout-item').dataset.id; self.deleteHomeLayoutItem(itemId); }
            });
            homeLayoutListContainer.addEventListener('dragover', e => { /* ... dragover logic ... */
                 e.preventDefault(); const afterElement = self.getDragAfterElement(homeLayoutListContainer, e.clientY); const dragging = document.querySelector('.dragging'); if (afterElement == null) { if (dragging) homeLayoutListContainer.appendChild(dragging); } else { if (dragging) homeLayoutListContainer.insertBefore(dragging, afterElement); }
            });
            // Dragstart/end attached dynamically during render
        }

        this.listenersAttached = true; // Set flag
        console.log("Admin event listeners attached.");
    }
};

// Initialization is triggered by app-logic.js when admin logs in