// فایلی admin.js (نوێکراوە بە بەشی بەڕێوەبردنی پەڕەی سەرەکی)

// Access the shared tools from app.js
const {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, // زیادکرا where
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache
} = window.globalAdminTools;

// کۆڵەکشنە نوێیەکان بۆ بەڕێوەبردنی پەڕەی سەرەکی
const homePageLayoutCollection = collection(db, "homePageLayout");
const shortcutRowsCollection = collection(db, "shortcut_rows"); // ئەمە لێرە بوو

window.AdminLogic = {
    listenersAttached: false, // بۆ ڕێگری لە دووبارە زیادکردنی event listener

    initialize: function() {
        console.log("Admin logic initialized.");
        this.updateAdminUI(true);
        this.setupAdminEventListeners(); // تەنها یەکجار بانگ دەکرێت
        this.loadPoliciesForAdmin();
        this.renderCategoryManagementUI();
        this.renderAdminAnnouncementsList();
        this.renderSocialMediaLinks();
        this.renderPromoCardsAdminList();
        this.renderBrandsAdminList();
        this.renderContactMethodsAdmin();
        this.renderShortcutRowsAdminList();
        this.updateAdminCategoryDropdowns();
        this.updateShortcutCardCategoryDropdowns();
        this.renderHomePageLayoutEditor(); // <-- بانگکردنی فەنکشنی نوێ
    },

    deinitialize: function() {
        console.log("Admin logic de-initialized.");
        this.updateAdminUI(false);
        // لێرەدا دەتوانین event listenerـەکان لاببەین ئەگەر پێویست بوو
    },

    updateAdminUI: function(isAdmin) {
        document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

        const adminSectionsContainer = document.getElementById('adminSectionsContainer'); // <<-- زیادکرا
        const adminSpecificSections = [ // <<-- ناوی گۆڕدرا
            'adminHomePageLayoutManagement', // <<-- زیادکرا
            'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
            'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
            'adminContactMethodsManagement', 'adminShortcutRowsManagement'
        ];

        // سەرەتا هەموو کۆنتەینەری بەشەکانی ئەدمین بشارەوە یان پیشانی بدە
        if (adminSectionsContainer) {
            adminSectionsContainer.style.display = isAdmin ? 'block' : 'none';
        }

        // پاشان هەر بەشێکی ناو کۆنتەینەرەکە پیشان بدە (ئەمە وا دەکات دڵنیابین کە لەکاتی لۆگئاوت هەمووی دەشاردرێتەوە)
        adminSpecificSections.forEach(id => {
            const section = document.getElementById(id);
            if (section) section.style.display = isAdmin ? 'block' : 'none';
        });

        const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
        const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
        const addProductBtn = document.getElementById('addProductBtn');

        if (isAdmin) {
            settingsLogoutBtn.style.display = 'flex';
            settingsAdminLoginBtn.style.display = 'none';
            addProductBtn.style.display = 'flex';
        } else {
            settingsLogoutBtn.style.display = 'none';
            settingsAdminLoginBtn.style.display = 'flex';
            addProductBtn.style.display = 'none';
        }
    },

    // --- (فەنکشنەکانی editProduct, deleteProduct, createProductImageInputs, populateSubcategoriesDropdown, populateSubSubcategoriesDropdown وەک خۆیان دەمێننەوە) ---
    // تەنها دڵنیابە کە clearProductCache() لە شوێنی گونجاودا بانگ دەکرێت دوای گۆڕانکاری

    editProduct: async function(productId) {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            showNotification(t('product_not_found_error'), 'error');
            return;
        }
        const product = { id: productSnap.id, ...productSnap.data() };

        setEditingProductId(productId);
        document.getElementById('formTitle').textContent = 'دەستکاری کردنی کاڵا';
        document.getElementById('productForm').reset();

        if (product.name && typeof product.name === 'object') {
            document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
            document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
            document.getElementById('productNameAr').value = product.name.ar || '';
        } else {
            document.getElementById('productNameKuSorani').value = product.name; // Fallback for old structure
            document.getElementById('productNameKuBadini').value = '';
            document.getElementById('productNameAr').value = '';
        }

        document.getElementById('productPrice').value = product.price;
        document.getElementById('productOriginalPrice').value = product.originalPrice || '';

        const categoryId = product.categoryId || product.category; // Handle potential old data structure
        document.getElementById('productCategoryId').value = categoryId;

        if (product.description && typeof product.description === 'object') {
            document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
            document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
            document.getElementById('productDescriptionAr').value = product.description.ar || '';
        } else {
             document.getElementById('productDescriptionKuSorani').value = product.description || ''; // Fallback
        }

        const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
        this.createProductImageInputs(imageUrls);
        document.getElementById('productExternalLink').value = product.externalLink || '';

        if (product.shippingInfo && typeof product.shippingInfo === 'object') {
            document.getElementById('shippingInfoKuSorani').value = product.shippingInfo.ku_sorani || '';
            document.getElementById('shippingInfoKuBadini').value = product.shippingInfo.ku_badini || '';
            document.getElementById('shippingInfoAr').value = product.shippingInfo.ar || '';
        } else {
            document.getElementById('shippingInfoKuSorani').value = '';
            document.getElementById('shippingInfoKuBadini').value = '';
            document.getElementById('shippingInfoAr').value = '';
        }

        // Populate dropdowns and wait for them to potentially load data
        await this.populateSubcategoriesDropdown(categoryId, product.subcategoryId);
        await this.populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);

        document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        openPopup('productFormModal', 'modal');
    },

    deleteProduct: async function(productId) {
        if (!confirm(t('delete_confirm'))) return;
        try {
            await deleteDoc(doc(db, "products", productId));
            showNotification(t('product_deleted'), 'success');
            clearProductCache(); // Clear cache as product list changed
            searchProductsInFirestore(document.getElementById('searchInput').value, true); // Refresh current view
        } catch (error) {
            showNotification(t('product_delete_error') + ': ' + error.message, 'error');
            console.error("Error deleting product:", error);
        }
    },

    createProductImageInputs: function(imageUrls = []) {
        const imageInputsContainer = document.getElementById('imageInputsContainer');
        imageInputsContainer.innerHTML = ''; // Clear previous inputs
        for (let i = 0; i < 4; i++) {
            const url = imageUrls[i] || '';
            const isRequired = i === 0 ? 'required' : ''; // Only first image is required
            const placeholder = i === 0 ? 'لینکی وێنەی یەکەم (سەرەکی)' : `لینکی وێنەی ${['دووەم', 'سێیەم', 'چوارەم'][i-1]}`;
            // Use a placeholder image or the actual URL for preview
            const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
            const inputGroup = document.createElement('div');
            inputGroup.className = 'image-input-group';
            inputGroup.innerHTML = `
                <input type="url" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}>
                <img src="${previewSrc}" class="image-preview-small" alt="Preview ${i+1}" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">`;
            imageInputsContainer.appendChild(inputGroup);
        }
    },

    populateSubcategoriesDropdown: async function(categoryId, selectedSubcategoryId = null) {
        const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
        const productSubcategorySelect = document.getElementById('productSubcategoryId');
        const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer'); // Get sub-sub container

        // Reset and hide sub-subcategory dropdown first
        subSubcategorySelectContainer.style.display = 'none';
        document.getElementById('productSubSubcategoryId').innerHTML = '';


        if (!categoryId) {
            subcategorySelectContainer.style.display = 'none';
            productSubcategorySelect.innerHTML = ''; // Clear options
            return;
        }

        productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        productSubcategorySelect.disabled = true;
        subcategorySelectContainer.style.display = 'block'; // Show the container

        try {
            const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
            const q = query(subcategoriesQuery, orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);

            // Populate with a default option first
             productSubcategorySelect.innerHTML = '<option value="">-- هیچ یان هەموو جۆرە لاوەکییەکان --</option>'; // Changed default text

            if (querySnapshot.empty) {
                 productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
                 subcategorySelectContainer.style.display = 'none'; // Hide if no options
            } else {
                 querySnapshot.docs.forEach(doc => {
                    const subcat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    // Display name based on current language, fallback to Sorani
                    option.textContent = subcat['name_' + getCurrentLanguage()] || subcat.name_ku_sorani || subcat.id; // Use helper
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
            productSubcategorySelect.disabled = false; // Enable dropdown
        }
    },

    populateSubSubcategoriesDropdown: async function(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
        const container = document.getElementById('subSubcategorySelectContainer');
        const select = document.getElementById('productSubSubcategoryId');

        if (!mainCategoryId || !subcategoryId) {
            container.style.display = 'none';
            select.innerHTML = '';
            return;
        }

        select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        select.disabled = true;
        container.style.display = 'block'; // Show the container

        try {
            const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
            const q = query(ref, orderBy("order", "asc"));
            const snapshot = await getDocs(q);

            select.innerHTML = '<option value="">-- هیچ --</option>'; // Default option
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const subSubcat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subSubcat.id;
                     // Display name based on current language, fallback to Sorani
                    option.textContent = subSubCat['name_' + getCurrentLanguage()] || subSubCat.name_ku_sorani || subSubCat.id; // Use helper
                    if (subSubcat.id === selectedSubSubcategoryId) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            } else {
                 container.style.display = 'none'; // Hide if no sub-subs exist
            }
        } catch (error) {
            console.error("Error fetching sub-subcategories for form:", error);
            select.innerHTML = '<option value="" disabled>هەڵەیەک ڕوویدا</option>';
            container.style.display = 'none'; // Hide on error
        } finally {
            select.disabled = false; // Enable dropdown
        }
    },


    // --- (فەنکشنەکانی loadPoliciesForAdmin, deleteAnnouncement, renderAdminAnnouncementsList وەک خۆیان) ---
    loadPoliciesForAdmin: async function() {
        try {
            const docRef = doc(db, "settings", "policies");
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
    },

    deleteAnnouncement: async function(id) {
        if (confirm(t('announcement_delete_confirm'))) {
            try {
                await deleteDoc(doc(db, "announcements", id));
                showNotification(t('announcement_deleted_success'), 'success');
                // No need to call clearProductCache here as announcements don't affect product cache
            } catch (e) {
                showNotification(t('error_generic') + ': ' + e.message, 'error');
                console.error("Error deleting announcement:", e);
            }
        }
    },

    renderAdminAnnouncementsList: function() {
        const container = document.getElementById('announcementsListContainer');
        if (!container) return; // Add check
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
                return;
            }
            snapshot.forEach(doc => {
                const announcement = { id: doc.id, ...doc.data() };
                const title = (announcement.title && announcement.title.ku_sorani) || 'بێ ناونیشان'; // Fallback title
                const item = document.createElement('div');
                item.className = 'admin-notification-item'; // Re-use style
                item.innerHTML = `
                    <div class="admin-notification-details">
                        <div class="notification-title">${title}</div>
                        </div>
                    <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button> `;
                item.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent potential parent clicks
                    this.deleteAnnouncement(announcement.id);
                 });
                container.appendChild(item);
            });
        }, (error) => {
            console.error("Error fetching announcements for admin:", error);
            container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە بارکردنی ئاگەدارییەکان</p>`;
        });
    },

    // --- (فەنکشنەکانی deleteSocialMediaLink, renderSocialMediaLinks, deleteContactMethod, renderContactMethodsAdmin وەک خۆیان) ---
    deleteSocialMediaLink: async function(linkId) {
        if (confirm('دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟')) {
            try {
                const linkRef = doc(db, 'settings', 'contactInfo', 'socialLinks', linkId);
                await deleteDoc(linkRef);
                showNotification('لینکەکە سڕدرایەوە', 'success');
            } catch (error) {
                console.error("Error deleting social link: ", error);
                showNotification(t('error_generic') + ': ' + error.message, 'error');
            }
        }
    },

    renderSocialMediaLinks: function() {
        const socialLinksListContainer = document.getElementById('socialLinksListContainer');
        if (!socialLinksListContainer) return;
        const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order by creation time

        onSnapshot(q, (snapshot) => {
            socialLinksListContainer.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const link = { id: doc.id, ...doc.data() };
                const name = link['name_' + getCurrentLanguage()] || link.name_ku_sorani; // Use helper

                const item = document.createElement('div');
                item.className = 'social-link-item'; // Use specific class
                item.innerHTML = `
                    <div class="item-info">
                        <i class="${link.icon || 'fas fa-link'}"></i> <div class="item-details">
                            <span class="item-name">${name}</span>
                            <span class="item-value">${link.url}</span>
                        </div>
                    </div>
                    <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button> `;

                item.querySelector('.delete-btn').onclick = (e) => {
                     e.stopPropagation();
                     this.deleteSocialMediaLink(link.id);
                };
                socialLinksListContainer.appendChild(item);
            });
        }, (error) => {
             console.error("Error fetching social media links:", error);
             socialLinksListContainer.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە بارکردنی لینکەکان</p>`;
        });
    },

     deleteContactMethod: async function(methodId) {
        if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
            try {
                const methodRef = doc(db, 'settings', 'contactInfo', 'contactMethods', methodId);
                await deleteDoc(methodRef);
                showNotification('شێوازەکە سڕدرایەوە', 'success');
                 clearProductCache(); // Clear cache as contact methods might be displayed differently
            } catch (error) {
                console.error("Error deleting contact method: ", error);
                showNotification('هەڵەیەک لە سڕینەوە ڕوویدا' + ': ' + error.message, 'error');
            }
        }
    },

    renderContactMethodsAdmin: function() {
        const container = document.getElementById('contactMethodsListContainer');
         if (!container) return;
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt", "desc")); // Order by creation

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear list
            if (snapshot.empty) {
                container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const method = { id: doc.id, ...doc.data() };
                const name = method['name_' + getCurrentLanguage()] || method.name_ku_sorani; // Use helper

                const item = document.createElement('div');
                item.className = 'social-link-item'; // Re-use style
                item.innerHTML = `
                    <div class="item-info">
                        <i class="${method.icon || 'fas fa-phone'}" style="color: ${method.color || 'inherit'};"></i> <div class="item-details">
                            <span class="item-name">${name} (${method.type})</span>
                            <span class="item-value">${method.value}</span>
                        </div>
                    </div>
                    <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button> `;

                item.querySelector('.delete-btn').onclick = (e) => {
                    e.stopPropagation();
                    this.deleteContactMethod(method.id);
                };
                container.appendChild(item);
            });
        }, (error) => {
             console.error("Error fetching contact methods:", error);
             container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە بارکردنی شێوازەکان</p>`;
        });
    },

    // --- (فەنکشنەکانی renderPromoCardsAdminList, editPromoCard, deletePromoCard وەک خۆیان، دڵنیابە clearProductCache() بانگ دەکرێت) ---
     renderPromoCardsAdminList: function() {
        const container = document.getElementById('promoCardsListContainer');
        if (!container) return;
        const q = query(promoCardsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear list
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ کاردێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const card = { id: doc.id, ...doc.data() };
                 // Find category name, handle if category deleted
                const category = getCategories().find(c => c.id === card.categoryId);
                const categoryName = category ? (category['name_' + getCurrentLanguage()] || category.name_ku_sorani) : 'جۆری سڕاوە';

                const item = document.createElement('div');
                item.className = 'admin-notification-item'; // Re-using style
                item.innerHTML = `
                    <div class="admin-notification-details" style="align-items: center; display: flex; gap: 10px; overflow: hidden;">
                        <img src="${card.imageUrls?.ku_sorani || '#'}" style="width: 50px; height: 30px; object-fit: cover; border-radius: 4px; flex-shrink: 0;" alt="Promo">
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                           <span style="font-weight: bold;">ڕیز: ${card.order}</span> | ${categoryName}
                        </div>
                    </div>
                    <div style="flex-shrink: 0;">
                        <button class="edit-btn small-btn"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                item.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); this.editPromoCard(card); };
                item.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); this.deletePromoCard(card.id); };
                container.appendChild(item);
            });
        }, (error) => {
            console.error("Error fetching promo cards for admin:", error);
            container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە بارکردنی کارتەکان</p>`;
        });
    },

    editPromoCard: function(card) {
        document.getElementById('editingPromoCardId').value = card.id;
        document.getElementById('promoCardImageKuSorani').value = card.imageUrls?.ku_sorani || '';
        document.getElementById('promoCardImageKuBadini').value = card.imageUrls?.ku_badini || '';
        document.getElementById('promoCardImageAr').value = card.imageUrls?.ar || '';
        document.getElementById('promoCardTargetCategory').value = card.categoryId || '';
        document.getElementById('promoCardOrder').value = card.order || 1; // Default order 1
        document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        // Scroll to the form for better UX
        document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    deletePromoCard: async function(cardId) {
        if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "promo_cards", cardId));
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home page layout changed
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                console.error("Error deleting promo card:", error);
            }
        }
    },


    // --- (فەنکشنەکانی renderBrandsAdminList, editBrand, deleteBrand وەک خۆیان، دڵنیابە clearProductCache() بانگ دەکرێت) ---
    renderBrandsAdminList: function() {
        const container = document.getElementById('brandsListContainer');
        if (!container) return;
        const q = query(brandsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear list
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ براندێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const brand = { id: doc.id, ...doc.data() };
                const brandName = brand.name?.ku_sorani || 'بێ ناو'; // Use Sorani as fallback display

                const item = document.createElement('div');
                item.className = 'admin-notification-item'; // Re-use style
                item.innerHTML = `
                    <div class="admin-notification-details" style="align-items: center; display: flex; gap: 10px;">
                        <img src="${brand.imageUrl || '#'}" style="width: 30px; height: 30px; object-fit: contain; border-radius: 50%; background: #eee; flex-shrink: 0;" alt="Brand Logo">
                        <span>${brandName} (ڕیز: ${brand.order})</span>
                    </div>
                     <div style="flex-shrink: 0;">
                        <button class="edit-btn small-btn"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                item.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); this.editBrand(brand); };
                item.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); this.deleteBrand(brand.id); };
                container.appendChild(item);
            });
        }, (error) => {
            console.error("Error fetching brands for admin:", error);
            container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە بارکردنی براندەکان</p>`;
        });
    },

    editBrand: function(brand) {
        document.getElementById('editingBrandId').value = brand.id;
        document.getElementById('brandNameKuSorani').value = brand.name?.ku_sorani || '';
        document.getElementById('brandNameKuBadini').value = brand.name?.ku_badini || '';
        document.getElementById('brandNameAr').value = brand.name?.ar || '';
        document.getElementById('brandImageUrl').value = brand.imageUrl || '';
        document.getElementById('brandOrder').value = brand.order || 10;

        const mainCatSelect = document.getElementById('brandTargetMainCategory');
        mainCatSelect.value = brand.categoryId || '';

        // Trigger change event to load subcategories, then set subcategory value after a short delay
        mainCatSelect.dispatchEvent(new Event('change'));

        setTimeout(() => {
            document.getElementById('brandTargetSubcategory').value = brand.subcategoryId || '';
        }, 300); // Delay might need adjustment based on subcategory loading speed

        document.getElementById('addBrandForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        document.getElementById('addBrandForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    deleteBrand: async function(brandId) {
        if (confirm('دڵنیایت دەتەوێت ئەم براندە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "brands", brandId));
                showNotification('براندەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home page layout changed
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                console.error("Error deleting brand: ", error);
            }
        }
    },


    // --- (فەنکشنەکانی renderCategoryManagementUI, openEditCategoryModal, handleDeleteCategory وەک خۆیان، دڵنیابە clearProductCache() بانگ دەکرێت) ---
    renderCategoryManagementUI: async function() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

        let content = '';
        try {
            const mainCategoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
            const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);

            for (const mainDoc of mainCategoriesSnapshot.docs) {
                const mainCategory = { id: mainDoc.id, ...mainDoc.data() };
                const mainPath = `categories/${mainCategory.id}`;
                const mainName = mainCategory['name_' + getCurrentLanguage()] || mainCategory.name_ku_sorani;
                content += `
                    <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <strong><i class="${mainCategory.icon}"></i> ${mainName} (ڕیز: ${mainCategory.order || 0})</strong>
                            <div>
                                <button class="edit-btn small-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn" data-path="${mainPath}" data-name="${mainName}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;

                const subCategoriesQuery = query(collection(db, mainPath, "subcategories"), orderBy("order", "asc"));
                const subCategoriesSnapshot = await getDocs(subCategoriesQuery);
                for (const subDoc of subCategoriesSnapshot.docs) {
                    const subCategory = { id: subDoc.id, ...subDoc.data() };
                    const subPath = `${mainPath}/subcategories/${subCategory.id}`;
                    const subName = subCategory['name_' + getCurrentLanguage()] || subCategory.name_ku_sorani;
                    content += `
                        <div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>- ${subName} (ڕیز: ${subCategory.order || 0})</span>
                                <div>
                                    <button class="edit-btn small-btn" data-path="${subPath}" data-level="2"><i class="fas fa-edit"></i></button>
                                    <button class="delete-btn small-btn" data-path="${subPath}" data-name="${subName}"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>`;

                    const subSubCategoriesQuery = query(collection(db, subPath, "subSubcategories"), orderBy("order", "asc"));
                    const subSubCategoriesSnapshot = await getDocs(subSubCategoriesQuery);
                    for (const subSubDoc of subSubCategoriesSnapshot.docs) {
                        const subSubCategory = { id: subSubDoc.id, ...subSubDoc.data() };
                        const subSubPath = `${subPath}/subSubcategories/${subSubCategory.id}`;
                        const subSubName = subSubCategory['name_' + getCurrentLanguage()] || subSubCategory.name_ku_sorani;
                        content += `
                            <div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>-- ${subSubName} (ڕیز: ${subSubCategory.order || 0})</span>
                                    <div>
                                        <button class="edit-btn small-btn" data-path="${subSubPath}" data-level="3"><i class="fas fa-edit"></i></button>
                                        <button class="delete-btn small-btn" data-path="${subSubPath}" data-name="${subSubName}"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>
                            </div>`;
                    }
                }
            }
             container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';

            // Add event listeners after content is set
            container.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => this.openEditCategoryModal(btn.dataset.path, btn.dataset.level));
            });
            container.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => this.handleDeleteCategory(btn.dataset.path, btn.dataset.name));
            });

        } catch (error) {
             console.error("Error rendering category management UI:", error);
             container.innerHTML = `<p style="color: var(--danger-color);">هەڵە لە بارکردنی جۆرەکان</p>`;
        }
    },

    openEditCategoryModal: async function(docPath, level) {
        try {
            const docRef = doc(db, docPath);
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
            const imageUrlField = document.getElementById('editImageUrlField');

            if (level === '1') {
                iconField.style.display = 'block';
                imageUrlField.style.display = 'none';
                document.getElementById('editCategoryIcon').value = category.icon || '';
            } else { // Level 2 or 3
                iconField.style.display = 'none';
                imageUrlField.style.display = 'block';
                document.getElementById('editCategoryImageUrl').value = category.imageUrl || '';
            }

            openPopup('editCategoryModal', 'modal');
        } catch (error) {
             console.error("Error opening edit category modal:", error);
             showNotification('هەڵە لە کردنەوەی مۆداڵ', 'error');
        }
    },

    handleDeleteCategory: async function(docPath, categoryName) {
        const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانی ناو ئەم جۆرەش دەسڕێتەوە، هەروەها کاڵاکانی ناو ئەم جۆرە چیتر جۆریان نامێنێت.`);
        if (confirmation) {
            try {
                // !Important: Firestore doesn't automatically delete subcollections.
                // This requires a more complex solution (like a Cloud Function or careful client-side recursion)
                // to delete all subcategories and sub-subcategories first.
                // For now, this only deletes the main document, potentially leaving orphaned subcollections.
                 console.warn(`Deleting category document at ${docPath}. Subcollections might be orphaned.`);

                await deleteDoc(doc(db, docPath));
                showNotification('جۆرەکە سڕدرایەوە (بەڵام ڕەنگە جۆرە لاوەکییەکانی مابن)', 'warning');
                clearProductCache(); // Clear cache as categories affect filtering and display
                this.renderCategoryManagementUI(); // Re-render the list
                this.updateAdminCategoryDropdowns(); // Update dropdowns
            } catch (error) {
                console.error("Error deleting category: ", error);
                showNotification('هەڵەیەک ڕوویدا لە کاتی سڕینەوە' + ': ' + error.message, 'error');
            }
        }
    },

    // --- (updateAdminCategoryDropdowns وەک خۆی) ---
    updateAdminCategoryDropdowns: function() {
        const categories = getCategories(); // Assumes getCategories fetches the latest list
        if (!categories || categories.length <= 1) return; // Need at least 'all' + one category

        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

        const dropdowns = [
            { id: 'parentCategorySelect', defaultText: '-- جۆری سەرەکی هەڵبژێرە --', addEmptyOption: false }, // No empty needed if required
            { id: 'parentMainCategorySelectForSubSub', defaultText: '-- جۆری سەرەکی هەڵبژێرە --', addEmptyOption: false },
            { id: 'promoCardTargetCategory', defaultText: '-- جۆرێک هەڵبژێرە --', addEmptyOption: false },
            { id: 'brandTargetMainCategory', defaultText: '-- هەموو جۆرەکان --', addEmptyOption: true } // Allow 'all' equivalent
        ];

        dropdowns.forEach(dInfo => {
            const select = document.getElementById(dInfo.id);
            if (select) {
                // Store current value if exists
                const currentValue = select.value;

                select.innerHTML = ''; // Clear existing options

                // Add the default/empty option
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = dInfo.defaultText;
                defaultOption.disabled = !dInfo.addEmptyOption; // Disable if it's just a placeholder
                defaultOption.selected = true; // Make it selected initially
                select.appendChild(defaultOption);

                // Add actual categories
                categoriesWithoutAll.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat['name_' + getCurrentLanguage()] || cat.name_ku_sorani || cat.id; // Use helper
                    select.appendChild(option);
                });

                 // Try to restore previous value if it's still valid
                 if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                    select.value = currentValue;
                 }
            }
        });
    },

    // --- (renderShortcutRowsAdminList, deleteShortcutRow, deleteShortcutCard, updateShortcutCardCategoryDropdowns وەک خۆیان، دڵنیابە clearProductCache() بانگ دەکرێت) ---
     renderShortcutRowsAdminList: function() {
        const container = document.getElementById('shortcutRowsListContainer');
        const rowSelect = document.getElementById('selectRowForCard'); // Select for adding cards
         if (!container || !rowSelect) return;

        const q = query(shortcutRowsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear rows list
            // Clear and add default option to the card form's row selector
            rowSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا ڕیزێک هەڵبژێرە --</option>';

            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ ڕیزێک زیاد نەکراوە.</p>';
                return;
            }

            snapshot.forEach(rowDoc => {
                const row = { id: rowDoc.id, ...rowDoc.data() };
                const rowTitle = row.title?.[getCurrentLanguage()] || row.title?.ku_sorani || 'بێ ناونیشان';

                // Add row to the selector in the card form
                const option = document.createElement('option');
                option.value = row.id;
                option.textContent = rowTitle;
                rowSelect.appendChild(option);

                // Create the row element for display in the list
                const rowElement = document.createElement('div');
                rowElement.className = 'shortcut-row-admin-item'; // Use a specific class
                rowElement.style.border = '1px solid #ddd';
                rowElement.style.borderRadius = '6px';
                rowElement.style.marginBottom = '10px';
                rowElement.style.backgroundColor = '#fff';

                rowElement.innerHTML = `
                    <div style="background: #f0f2f5; padding: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd;">
                        <strong>${rowTitle} (ڕیز: ${row.order})</strong>
                        <div>
                            <button class="edit-row-btn edit-btn small-btn" data-id="${row.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-row-btn delete-btn small-btn" data-id="${row.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="cards-list-container" style="padding: 10px;">
                       <p style="font-size: 12px; color: gray;">...خەریکی بارکردنی کارتەکانە</p>
                    </div>
                `;
                container.appendChild(rowElement);

                // Add event listeners for row edit/delete
                 rowElement.querySelector('.edit-row-btn').onclick = (e) => { e.stopPropagation(); this.editShortcutRow(row); };
                 rowElement.querySelector('.delete-row-btn').onclick = (e) => { e.stopPropagation(); this.deleteShortcutRow(row.id); };

                // Fetch and render cards for this row
                const cardsContainer = rowElement.querySelector('.cards-list-container');
                const cardsQuery = query(collection(db, "shortcut_rows", row.id, "cards"), orderBy("order", "asc"));
                onSnapshot(cardsQuery, (cardsSnapshot) => {
                    cardsContainer.innerHTML = ''; // Clear previous cards
                    if(cardsSnapshot.empty) {
                        cardsContainer.innerHTML = '<p style="font-size: 12px; color: gray;">هیچ کارتێک بۆ ئەم ڕیزە زیاد نەکراوە.</p>';
                    } else {
                        cardsSnapshot.forEach(cardDoc => {
                            const card = { id: cardDoc.id, ...cardDoc.data() };
                            const cardName = card.name?.[getCurrentLanguage()] || card.name?.ku_sorani || 'بێ ناو';
                            const cardElement = document.createElement('div');
                            cardElement.className = 'shortcut-card-admin-item'; // Use specific class
                            cardElement.style.display = 'flex';
                            cardElement.style.justifyContent = 'space-between';
                            cardElement.style.alignItems = 'center';
                            cardElement.style.padding = '5px 0';
                            cardElement.style.borderBottom = '1px dashed #eee';
                            cardElement.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 8px;">
                                 <img src="${card.imageUrl || '#'}" alt="Icon" style="width: 25px; height: 25px; object-fit: cover; border-radius: 4px;">
                                 <span>${cardName} (ڕیز: ${card.order})</span>
                                </div>
                                <div>
                                    <button class="edit-card-btn edit-btn small-btn"><i class="fas fa-edit"></i></button>
                                    <button class="delete-card-btn delete-btn small-btn"><i class="fas fa-trash"></i></button>
                                </div>
                            `;
                             // Pass full card data to edit function
                            cardElement.querySelector('.edit-card-btn').onclick = (e) => { e.stopPropagation(); this.editShortcutCard(row.id, card); };
                            cardElement.querySelector('.delete-card-btn').onclick = (e) => { e.stopPropagation(); this.deleteShortcutCard(row.id, card.id); };

                            cardsContainer.appendChild(cardElement);
                        });
                    }
                }, (error) => {
                    console.error(`Error fetching cards for row ${row.id}:`, error);
                    cardsContainer.innerHTML = `<p style="color: var(--danger-color);">هەڵە لە بارکردنی کارتەکان</p>`;
                });
            });
        }, (error) => {
             console.error("Error fetching shortcut rows:", error);
             container.innerHTML = `<p style="color: var(--danger-color);">هەڵە لە بارکردنی ڕیزەکان</p>`;
             rowSelect.innerHTML = '<option value="" disabled selected>هەڵە ڕوویدا</option>';
        });
    },

    editShortcutRow: function(row) {
        document.getElementById('editingShortcutRowId').value = row.id;
        document.getElementById('shortcutRowTitleKuSorani').value = row.title?.ku_sorani || '';
        document.getElementById('shortcutRowTitleKuBadini').value = row.title?.ku_badini || '';
        document.getElementById('shortcutRowTitleAr').value = row.title?.ar || '';
        document.getElementById('shortcutRowOrder').value = row.order || 10;
        document.getElementById('cancelRowEditBtn').style.display = 'inline-block'; // Show cancel button
        document.getElementById('addShortcutRowForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوەی ڕیز';
        // Scroll to form
        document.getElementById('addShortcutRowForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    editShortcutCard: async function(rowId, card) {
         document.getElementById('selectRowForCard').value = rowId;
         document.getElementById('selectRowForCard').disabled = true; // Disable row selection during edit
         document.getElementById('editingShortcutCardId').value = card.id;

         document.getElementById('shortcutCardNameKuSorani').value = card.name?.ku_sorani || '';
         document.getElementById('shortcutCardNameKuBadini').value = card.name?.ku_badini || '';
         document.getElementById('shortcutCardNameAr').value = card.name?.ar || '';
         document.getElementById('shortcutCardImageUrl').value = card.imageUrl || '';
         document.getElementById('shortcutCardOrder').value = card.order || 10;

         // Set category dropdowns
         const mainCatSelect = document.getElementById('shortcutCardMainCategory');
         mainCatSelect.value = card.categoryId || '';
         // Trigger change to load subcategories, then set subcategory, then trigger change for sub-sub
         mainCatSelect.dispatchEvent(new Event('change'));

         // Use setTimeout to allow subcategory options to load before setting the value
         setTimeout(() => {
             const subCatSelect = document.getElementById('shortcutCardSubcategory');
             subCatSelect.value = card.subcategoryId || '';
             subCatSelect.dispatchEvent(new Event('change')); // Trigger to load sub-sub

             // Another timeout for sub-sub categories
             setTimeout(() => {
                 document.getElementById('shortcutCardSubSubcategory').value = card.subSubcategoryId || '';
             }, 300); // Adjust delay if needed

         }, 300); // Adjust delay if needed


         document.getElementById('addCardToRowForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوەی کارت';
         document.getElementById('cancelCardEditBtn').style.display = 'inline-block'; // Show cancel button
         // Scroll to form
         document.getElementById('addCardToRowForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
     },


    deleteShortcutRow: async function(rowId) {
        if (confirm('دڵنیایت دەتەوێت ئەم ڕیزە بسڕیتەوە؟ هەموو کارتەکانی ناویشی دەسڕێنەوە!')) {
            try {
                // First, delete all cards in the subcollection
                const cardsRef = collection(db, "shortcut_rows", rowId, "cards");
                const cardsSnapshot = await getDocs(cardsRef);
                const deletePromises = [];
                cardsSnapshot.forEach(doc => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                await Promise.all(deletePromises);

                // Then, delete the row document itself
                await deleteDoc(doc(db, "shortcut_rows", rowId));
                showNotification('ڕیزەکە بە تەواوی سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home page layout changed
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                console.error("Error deleting shortcut row and its cards: ", error);
            }
        }
    },

    deleteShortcutCard: async function(rowId, cardId) {
         if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home page layout changed
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                console.error("Error deleting shortcut card: ", error);
            }
        }
    },

    updateShortcutCardCategoryDropdowns: function() {
        const categories = getCategories();
        if (!categories || categories.length <= 1) return;

        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        const mainSelect = document.getElementById('shortcutCardMainCategory');
        if (!mainSelect) return;

        const currentValue = mainSelect.value; // Preserve selection if possible

        mainSelect.innerHTML = '<option value="">-- هەموو کاڵاکان --</option>'; // Default/empty option
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat['name_' + getCurrentLanguage()] || cat.name_ku_sorani || cat.id; // Use helper
            mainSelect.appendChild(option);
        });

        // Restore selection
        if (currentValue && mainSelect.querySelector(`option[value="${currentValue}"]`)) {
            mainSelect.value = currentValue;
        }

        // Reset sub and sub-sub dropdowns initially
        document.getElementById('shortcutCardSubContainer').style.display = 'none';
        document.getElementById('shortcutCardSubSubContainer').style.display = 'none';
        document.getElementById('shortcutCardSubcategory').innerHTML = '';
        document.getElementById('shortcutCardSubSubcategory').innerHTML = '';
    },


    // <<-- START: فەنکشنە نوێیەکان بۆ بەڕێوەبردنی پەڕەی سەرەکی -->>
    renderHomePageLayoutEditor: function() {
        const container = document.getElementById('homePageLayoutEditorContainer');
        if (!container) return;
        container.innerHTML = ''; // پاککردنەوەی ناوەڕۆکی پێشوو

        const addSectionButton = document.createElement('button');
        addSectionButton.textContent = 'زیادکردنی بەشی نوێ';
        addSectionButton.style.marginBottom = '15px';
        addSectionButton.onclick = () => this.openAddEditSectionModal(); // فەنکشنێک بۆ کردنەوەی مۆداڵ
        container.appendChild(addSectionButton);

        const sectionsList = document.createElement('div');
        sectionsList.id = 'homeLayoutSectionsList';
        container.appendChild(sectionsList);

        const q = query(homePageLayoutCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            sectionsList.innerHTML = ''; // پاککردنەوەی لیستی پێشوو
            if (snapshot.empty) {
                sectionsList.innerHTML = '<p>هیچ بەشێک بۆ پەڕەی سەرەکی دیاری نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const section = { id: doc.id, ...doc.data() };
                const item = this.createLayoutItemElement(section); // فەنکشنێکی یارمەتیدەر
                sectionsList.appendChild(item);
            });
            // لێرەدا دەتوانین کتێبخانەیەکی drag-and-drop وەک SortableJS بەکاربهێنین
            // بۆ ڕێکخستنی ڕیزبەندی ئایتمەکان.
        }, (error) => {
            console.error("Error fetching home page layout:", error);
            sectionsList.innerHTML = `<p style="color: var(--danger-color);">هەڵە لە بارکردنی ڕێکخستنەکان</p>`;
        });
    },

    createLayoutItemElement: function(section) {
        const item = document.createElement('div');
        item.className = 'home-layout-item';
        item.dataset.id = section.id; // بۆ بەکارهێنان لە drag-and-drop

        const typeName = this.getSectionTypeName(section.type); // وەرگێڕانی ناوی جۆرەکە
        const enabledText = section.enabled ? 'چالاک' : 'ناچالاک';
        const enabledColor = section.enabled ? 'var(--accent-color)' : 'var(--dark-gray)';

        // زانیاری زیاتر پیشان بدەین بەپێی جۆری بەش
        let details = '';
        if (section.type === 'category_products' && section.config?.categoryId) {
             const category = getCategories().find(c => c.id === section.config.categoryId);
             details = ` | جۆر: ${category ? (category['name_' + getCurrentLanguage()] || category.name_ku_sorani) : section.config.categoryId}`;
        } else if (section.type === 'shortcut_row' && section.config?.rowId) {
             // لێرەدا دەتوانین ناوی shortcut row بهێنین ئەگەر پێویست بوو
             details = ` | IDی ڕیز: ${section.config.rowId}`;
        }

        item.innerHTML = `
            <div class="home-layout-item-info">
                <i class="fas fa-grip-vertical" style="cursor: move; color: var(--dark-gray);"></i> <span><strong>${typeName}</strong>${details} (ڕیز: ${section.order})</span>
                <span style="color: ${enabledColor}; font-size: 12px; margin-right: 10px;">(${enabledText})</span>
            </div>
            <div class="home-layout-item-actions">
                <button class="toggle-btn small-btn" title="${section.enabled ? 'ناچالاککردن' : 'چالاککردن'}">
                    <i class="fas ${section.enabled ? 'fa-eye-slash' : 'fa-eye'}" style="color: ${enabledColor};"></i>
                </button>
                <button class="edit-btn small-btn"><i class="fas fa-edit"></i></button>
                <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
            </div>
        `;

        item.querySelector('.toggle-btn').onclick = (e) => {
            e.stopPropagation();
            this.toggleSectionEnabled(section.id, !section.enabled);
        };
        item.querySelector('.edit-btn').onclick = (e) => {
            e.stopPropagation();
            this.openAddEditSectionModal(section); // کردنەوەی مۆداڵ بۆ دەستکاری
        };
        item.querySelector('.delete-btn').onclick = (e) => {
            e.stopPropagation();
            this.deleteHomePageSection(section.id, typeName);
        };

        return item;
    },

    getSectionTypeName: function(type) {
        // وەرگێڕانی ناوی جۆرەکان بۆ ناوێکی خوێنەرەوە
        switch (type) {
            case 'promo_slider': return 'سلایدەری وێنە';
            case 'brands': return 'لیستی براندەکان';
            case 'newest_products': return 'نوێترین کاڵاکان';
            case 'category_products': return 'کاڵای جۆرێکی دیاریکراو';
            case 'shortcut_row': return 'ڕیزی کارتی میانبەر';
            case 'all_products': return 'هەموو کاڵاکان';
            default: return type; // ئەگەر جۆرێکی نەناسراو بوو
        }
    },

    toggleSectionEnabled: async function(sectionId, newEnabledState) {
        try {
            await updateDoc(doc(db, "homePageLayout", sectionId), { enabled: newEnabledState });
            showNotification(`بەش ${newEnabledState ? 'چالاککرا' : 'ناچالاککرا'}`, 'success');
            clearProductCache(); // <- گرنگە بۆ نوێکردنەوەی پەڕەی سەرەکی
        } catch (error) {
            console.error("Error toggling section enabled state:", error);
            showNotification('هەڵە لە گۆڕینی دۆخی بەش', 'error');
        }
    },

    deleteHomePageSection: async function(sectionId, sectionName) {
        if (confirm(`دڵنیایت دەتەوێت بەشی "${sectionName}" بسڕیتەوە؟`)) {
            try {
                await deleteDoc(doc(db, "homePageLayout", sectionId));
                showNotification('بەشەکە سڕدرایەوە', 'success');
                clearProductCache(); // <- گرنگە بۆ نوێکردنەوەی پەڕەی سەرەکی
            } catch (error) {
                console.error("Error deleting home page section:", error);
                showNotification('هەڵە لە سڕینەوەی بەش', 'error');
            }
        }
    },

    // فەنکشن بۆ کردنەوەی مۆداڵ/فۆرم بۆ زیادکردن یان دەستکاریکردنی بەش
    openAddEditSectionModal: function(section = null) {
        // لێرەدا پێویستە مۆداڵێک یان فۆرمێک دروست بکەین
        // کە ڕێگە بە ئەدمین دەدات جۆری بەش هەڵبژێرێت، order دابنێت، enabled دیاری بکات،
        // و configـی پێویست پڕ بکاتەوە (بۆ نموونە categoryId یان rowId).
        // ئەگەر sectionـی پێدرا، فۆرمەکە بە زانیارییەکانی ئەو پڕ دەکرێتەوە بۆ دەستکاری.

        // نموونەیەکی سادە:
        const isEditing = section !== null;
        const title = isEditing ? `دەستکاریکردنی بەشی: ${this.getSectionTypeName(section.type)}` : 'زیادکردنی بەشی نوێ';
        const sectionId = isEditing ? section.id : null;

        // دروستکردنی HTMLـی فۆرمەکە (دەتوانرێت لە index.html دابنرێت و لێرە پیشان بدرێت)
        let formHtml = `
            <h2>${title}</h2>
            <form id="sectionForm">
                <input type="hidden" id="sectionId" value="${sectionId || ''}">
                <div class="form-group">
                    <label for="sectionType">جۆری بەش:</label>
                    <select id="sectionType" required ${isEditing ? 'disabled' : ''}>
                        <option value="promo_slider" ${isEditing && section.type === 'promo_slider' ? 'selected' : ''}>سلایدەری وێنە</option>
                        <option value="brands" ${isEditing && section.type === 'brands' ? 'selected' : ''}>لیستی براندەکان</option>
                        <option value="newest_products" ${isEditing && section.type === 'newest_products' ? 'selected' : ''}>نوێترین کاڵاکان</option>
                        <option value="category_products" ${isEditing && section.type === 'category_products' ? 'selected' : ''}>کاڵای جۆرێکی دیاریکراو</option>
                        <option value="shortcut_row" ${isEditing && section.type === 'shortcut_row' ? 'selected' : ''}>ڕیزی کارتی میانبەر</option>
                        <option value="all_products" ${isEditing && section.type === 'all_products' ? 'selected' : ''}>هەموو کاڵاکان</option>
                        </select>
                </div>
                <div class="form-group">
                    <label for="sectionOrder">ڕیزبەندی:</label>
                    <input type="number" id="sectionOrder" value="${isEditing ? section.order : 10}" required>
                </div>
                 <div class="form-group">
                    <label for="sectionTitleKuSorani">ناونیشانی بەش (سۆرانی - ئارەزوومەندانە):</label>
                    <input type="text" id="sectionTitleKuSorani" value="${isEditing ? (section.title?.ku_sorani || '') : ''}">
                </div>
                 <div class="form-group">
                    <label for="sectionTitleKuBadini">ناونیشانی بەش (بادینی - ئارەزوومەندانە):</label>
                    <input type="text" id="sectionTitleKuBadini" value="${isEditing ? (section.title?.ku_badini || '') : ''}">
                </div>
                 <div class="form-group">
                    <label for="sectionTitleAr">ناونیشانی بەش (عربی - ئارەزوومەندانە):</label>
                    <input type="text" id="sectionTitleAr" value="${isEditing ? (section.title?.ar || '') : ''}">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="sectionEnabled" ${isEditing ? (section.enabled ? 'checked' : '') : 'checked'}> چالاک بێت؟</label>
                </div>
                <div id="sectionConfigContainer">
                    </div>
                <button type="submit">${isEditing ? 'پاشەکەوتکردنی گۆڕانکاری' : 'زیادکردن'}</button>
            </form>
        `;

        // کردنەوەی مۆداڵێک و دانانی HTMLـەکە تێیدا
        // (پێویستە مۆداڵێکی گشتی دروست بکرێت یان یەکێکی نوێ)
        // بۆ سادەیی، لێرە تەنها لۆگ دەکرێت
        console.log("Form HTML would be:", formHtml);
        alert("فۆرمی زیادکردن/دەستکاریکردنی بەش لێرە پیشان دەدرێت.\nتکایە UIـی پێویست دروست بکە.");

        // دوای دروستکردنی فۆرمەکە لە HTML، ئەم بەشە چالاک بکە:
        /*
        const modal = document.getElementById('generalAdminModal'); // بۆ نموونە
        const modalContent = modal.querySelector('.modal-content-inner'); // بۆ نموونە
        modalContent.innerHTML = formHtml;
        openPopup('generalAdminModal', 'modal');

        const sectionTypeSelect = modal.querySelector('#sectionType');
        const configContainer = modal.querySelector('#sectionConfigContainer');
        const sectionForm = modal.querySelector('#sectionForm');

        const renderConfigFields = async (type) => {
             configContainer.innerHTML = ''; // پاککردنەوە
             if (type === 'category_products') {
                 const categories = getCategories().filter(c => c.id !== 'all');
                 let options = categories.map(cat => `<option value="${cat.id}" ${isEditing && section.config?.categoryId === cat.id ? 'selected' : ''}>${cat.name_ku_sorani}</option>`).join('');
                 configContainer.innerHTML = `
                     <div class="form-group">
                         <label for="configCategoryId">جۆری کاڵا هەڵبژێرە:</label>
                         <select id="configCategoryId" required>${options}</select>
                     </div>`;
             } else if (type === 'shortcut_row') {
                 // هێنانی shortcut rows
                 const rowsSnapshot = await getDocs(query(shortcutRowsCollection, orderBy("order")));
                 let options = rowsSnapshot.docs.map(doc => {
                     const row = {id: doc.id, ...doc.data()};
                     return `<option value="${row.id}" ${isEditing && section.config?.rowId === row.id ? 'selected' : ''}>${row.title.ku_sorani}</option>`
                 }).join('');
                  configContainer.innerHTML = `
                     <div class="form-group">
                         <label for="configRowId">ڕیزی کارتی میانبەر هەڵبژێرە:</label>
                         <select id="configRowId" required>${options}</select>
                     </div>`;
             }
             // جۆری تر لێرە زیاد بکە...
        };

        sectionTypeSelect.onchange = (e) => renderConfigFields(e.target.value);

        // پیشاندانی فیڵدی configـی سەرەتایی ئەگەر لە دۆخی دەستکاریدا بووین
        if (isEditing) {
            renderConfigFields(section.type);
        }

        sectionForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const type = sectionTypeSelect.value;
            let config = {};
            // وەرگرتنی زانیاری config بەپێی جۆر
            if (type === 'category_products') {
                config.categoryId = document.getElementById('configCategoryId').value;
            } else if (type === 'shortcut_row') {
                config.rowId = document.getElementById('configRowId').value;
            }
            // جۆری تر لێرە زیاد بکە...

            const sectionData = {
                type: type,
                order: parseInt(document.getElementById('sectionOrder').value) || 0,
                enabled: document.getElementById('sectionEnabled').checked,
                title: {
                    ku_sorani: document.getElementById('sectionTitleKuSorani').value.trim(),
                    ku_badini: document.getElementById('sectionTitleKuBadini').value.trim(),
                    ar: document.getElementById('sectionTitleAr').value.trim(),
                },
                config: config
            };

            try {
                const currentSectionId = document.getElementById('sectionId').value;
                if (currentSectionId) { // دەستکاری
                    await setDoc(doc(db, "homePageLayout", currentSectionId), sectionData, { merge: true });
                    showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                } else { // زیادکردن
                    sectionData.createdAt = Date.now();
                    await addDoc(homePageLayoutCollection, sectionData);
                    showNotification('بەشی نوێ زیادکرا', 'success');
                }
                closeCurrentPopup();
                clearProductCache(); // <- گرنگە
            } catch (error) {
                console.error("Error saving home page section:", error);
                showNotification('هەڵە لە پاشەکەوتکردن', 'error');
            } finally {
                submitButton.disabled = false;
            }
        };
        */
    },
    // <<-- END: فەنکشنە نوێیەکان -->>


    setupAdminEventListeners: function() {
        if (this.listenersAttached) return; // Ensure listeners are added only once

        const self = this; // Store 'this' context

        // --- Event Listener for Add Product Button ---
        const addProductBtnElem = document.getElementById('addProductBtn');
        if (addProductBtnElem) {
            addProductBtnElem.onclick = () => {
                setEditingProductId(null); // Clear editing ID
                const productFormElem = document.getElementById('productForm');
                if (productFormElem) productFormElem.reset(); // Reset the form
                self.createProductImageInputs(); // Reset image inputs
                // Hide sub/sub-sub category dropdowns initially
                document.getElementById('subcategorySelectContainer').style.display = 'none';
                document.getElementById('subSubcategorySelectContainer').style.display = 'none';
                document.getElementById('formTitle').textContent = t('add_new_product') || 'زیادکردنی کاڵای نوێ'; // Use translation
                const submitButton = document.getElementById('productForm')?.querySelector('button[type="submit"]');
                 if(submitButton) submitButton.textContent = t('save_button') || 'پاشەکەوتکردن'; // Use translation
                openPopup('productFormModal', 'modal'); // Open the modal
            };
        } else {
             console.warn("Add product button not found.");
        }


        // --- Event Listener for Logout Button ---
        const logoutBtn = document.getElementById('settingsLogoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                try {
                    await signOut(auth);
                    showNotification(t('logout_success'), 'success');
                    // UI updates are handled by onAuthStateChanged
                } catch (error) {
                     console.error("Logout failed:", error);
                     showNotification(t('error_generic'), 'error');
                }
            };
        }

        // --- Event Listeners for Category Dropdowns in Product Form ---
        const mainCatSelect = document.getElementById('productCategoryId');
        if (mainCatSelect) {
            mainCatSelect.addEventListener('change', (e) => {
                self.populateSubcategoriesDropdown(e.target.value);
                // Reset sub-sub when main changes
                self.populateSubSubcategoriesDropdown(null, null);
            });
        }

        const subCatSelect = document.getElementById('productSubcategoryId');
        if (subCatSelect) {
            subCatSelect.addEventListener('change', (e) => {
                const mainCatId = mainCatSelect ? mainCatSelect.value : null;
                self.populateSubSubcategoriesDropdown(mainCatId, e.target.value);
            });
        }

        // --- Event Listener for Product Form Submission ---
        const productFormElem = document.getElementById('productForm');
        if (productFormElem) {
            productFormElem.onsubmit = async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                if(submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '...چاوەڕێ بە';
                }

                const imageUrls = Array.from(document.querySelectorAll('.productImageUrl'))
                                     .map(input => input.value.trim())
                                     .filter(url => url !== '');

                if (imageUrls.length === 0) {
                    showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
                     if(submitButton) {
                         submitButton.disabled = false;
                         submitButton.textContent = getEditingProductId() ? 'نوێکردنەوە' : (t('save_button') || 'پاشەکەوتکردن');
                     }
                    return;
                }

                const productNameKuSorani = document.getElementById('productNameKuSorani').value;
                const productData = {
                    name: {
                        ku_sorani: productNameKuSorani,
                        ku_badini: document.getElementById('productNameKuBadini').value,
                        ar: document.getElementById('productNameAr').value
                    },
                    searchableName: productNameKuSorani.toLowerCase().trim(), // Ensure it's lowercase and trimmed
                    price: parseInt(document.getElementById('productPrice').value) || 0, // Default to 0 if invalid
                    originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null, // Default to null if invalid/empty
                    categoryId: document.getElementById('productCategoryId').value,
                    subcategoryId: document.getElementById('productSubcategoryId').value || null,
                    subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                    description: {
                        ku_sorani: document.getElementById('productDescriptionKuSorani').value,
                        ku_badini: document.getElementById('productDescriptionKuBadini').value,
                        ar: document.getElementById('productDescriptionAr').value
                    },
                    imageUrls: imageUrls,
                    externalLink: document.getElementById('productExternalLink').value.trim() || null,
                    shippingInfo: {
                        ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                        ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                        ar: document.getElementById('shippingInfoAr').value.trim()
                    },
                    // Add/update timestamp only if it's a new product or you want to track updates
                    // updatedAt: Date.now() // Optional: Track last update
                };

                const editingId = getEditingProductId();
                try {
                    if (editingId) {
                        // Update existing product
                        await updateDoc(doc(db, "products", editingId), productData);
                        showNotification('کاڵا نوێکرایەوە', 'success');
                    } else {
                        // Add new product
                        productData.createdAt = Date.now(); // Set creation timestamp for new products
                        await addDoc(productsCollection, productData);
                        showNotification('کاڵا زیادکرا', 'success');
                    }
                    clearProductCache(); // Clear cache after adding/editing
                    closeCurrentPopup(); // Close the modal
                    // Refresh the product list with current filters/search
                    searchProductsInFirestore(document.getElementById('searchInput').value, true);
                } catch (error) {
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                    console.error("Error saving product:", error);
                } finally {
                     if(submitButton) {
                         submitButton.disabled = false;
                         submitButton.textContent = editingId ? 'نوێکردنەوە' : (t('save_button') || 'پاشەکەوتکردن');
                     }
                    setEditingProductId(null); // Clear editing ID after operation
                }
            };
        } else {
             console.warn("Product form not found.");
        }


        // --- Event Listener for Image URL Input -> Preview ---
        const imgInputsContainer = document.getElementById('imageInputsContainer');
        if(imgInputsContainer) {
            imgInputsContainer.addEventListener('input', (e) => {
                if (e.target.classList.contains('productImageUrl')) {
                    const previewImg = e.target.nextElementSibling;
                    const url = e.target.value.trim();
                    if (previewImg) {
                        if (url) {
                             previewImg.src = url;
                        } else {
                             // Find index for placeholder number
                             const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                             previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
                        }
                    }
                }
            });
        }

        // --- Event Listener for Add Main Category Form ---
        const addCategoryFormElem = document.getElementById('addCategoryForm');
        if (addCategoryFormElem) {
            addCategoryFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '...پاشەکەوت دەکرێت';
                }

                const categoryData = {
                    name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                    name_ar: document.getElementById('mainCategoryNameAr').value,
                    icon: document.getElementById('mainCategoryIcon').value,
                    order: parseInt(document.getElementById('mainCategoryOrder').value) || 0
                };

                try {
                    await addDoc(categoriesCollection, categoryData);
                    showNotification('جۆری سەرەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addCategoryFormElem.reset(); // Reset form
                    clearProductCache(); // Clear cache as categories changed
                    // No need to manually refresh UI, onSnapshot handles it
                } catch (error) {
                    console.error("Error adding main category: ", error);
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
                    }
                }
            });
        }

        // --- Event Listener for Add Subcategory Form ---
        const addSubcategoryFormElem = document.getElementById('addSubcategoryForm');
        if (addSubcategoryFormElem) {
            addSubcategoryFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                const parentCategoryId = document.getElementById('parentCategorySelect').value;

                if (!parentCategoryId) {
                    showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error');
                    return;
                }

                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '...پاشەکەوت دەکرێت';
                }

                const subcategoryData = {
                    name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subcategoryNameAr').value,
                    order: parseInt(document.getElementById('subcategoryOrder').value) || 0,
                    imageUrl: document.getElementById('subcategoryImageUrl').value.trim() || null
                };

                try {
                    const subcategoriesCollectionRef = collection(db, "categories", parentCategoryId, "subcategories");
                    await addDoc(subcategoriesCollectionRef, subcategoryData);
                    showNotification('جۆری لاوەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addSubcategoryFormElem.reset(); // Reset form
                    clearProductCache(); // Clear cache as categories changed
                    // No need to manually refresh UI, onSnapshot handles it
                } catch (error) {
                    console.error("Error adding subcategory: ", error);
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
                    }
                }
            });
        }

        // --- Event Listener for Add Sub-Subcategory Form ---
        const addSubSubcategoryFormElem = document.getElementById('addSubSubcategoryForm');
         const parentMainSelectForSubSub = document.getElementById('parentMainCategorySelectForSubSub');
         const parentSubSelectForSubSub = document.getElementById('parentSubcategorySelectForSubSub');

         // Populate subcategory dropdown when main category changes
         if(parentMainSelectForSubSub && parentSubSelectForSubSub) {
             parentMainSelectForSubSub.addEventListener('change', async (e) => {
                 const mainCatId = e.target.value;
                 parentSubSelectForSubSub.innerHTML = '<option value="" disabled selected>...بارکردن</option>'; // Loading state
                 parentSubSelectForSubSub.disabled = true;
                 if (mainCatId) {
                     try {
                         const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                         const snapshot = await getDocs(subCatQuery);
                         parentSubSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
                         if (!snapshot.empty) {
                             snapshot.forEach(doc => {
                                 const subcat = { id: doc.id, ...doc.data() };
                                 const option = document.createElement('option');
                                 option.value = subcat.id;
                                 option.textContent = subcat.name_ku_sorani || subcat.id;
                                 parentSubSelectForSubSub.appendChild(option);
                             });
                         } else {
                              parentSubSelectForSubSub.innerHTML = '<option value="" disabled selected>-- هیچ جۆرێکی لاوەکی نییە --</option>';
                         }
                     } catch (error) {
                          console.error("Error populating subcategory dropdown for sub-sub form:", error);
                          parentSubSelectForSubSub.innerHTML = '<option value="" disabled selected>-- هەڵە --</option>';
                     } finally {
                         parentSubSelectForSubSub.disabled = false;
                     }
                 } else {
                     parentSubSelectForSubSub.innerHTML = '<option value="" disabled selected>-- چاوەڕێی جۆری سەرەکی بە --</option>';
                 }
             });
         }

        if (addSubSubcategoryFormElem) {
            addSubSubcategoryFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mainCatId = parentMainSelectForSubSub?.value;
                const subCatId = parentSubSelectForSubSub?.value;

                if (!mainCatId || !subCatId) {
                    showNotification('تکایە هەردوو جۆری سەرەکی و لاوەکی هەڵبژێرە', 'error');
                    return;
                }
                const submitButton = e.target.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '...پاشەکەوت دەکرێت';
                }


                const subSubcategoryData = {
                    name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subSubcategoryNameAr').value,
                    order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
                    imageUrl: document.getElementById('subSubcategoryImageUrl').value.trim() || null,
                    // createdAt: Date.now() // Add timestamp if needed
                };

                try {
                    const subSubcategoriesRef = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
                    await addDoc(subSubcategoriesRef, subSubcategoryData);
                    showNotification('جۆری نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addSubSubcategoryFormElem.reset(); // Reset form
                    // Reset dropdowns
                    if(parentMainSelectForSubSub) parentMainSelectForSubSub.value = '';
                    if(parentSubSelectForSubSub) parentSubSelectForSubSub.innerHTML = '<option value="" disabled selected>-- چاوەڕێی جۆری سەرەکی بە --</option>';
                    clearProductCache(); // Clear cache as categories changed
                    // No need to manually refresh UI, onSnapshot handles it
                } catch (error) {
                    console.error("Error adding sub-subcategory: ", error);
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'پاشەکەوتکردنی جۆری نوێ';
                    }
                }
            });
        }

        // --- Event Listener for Edit Category Form ---
        const editCategoryFormElem = document.getElementById('editCategoryForm');
        if (editCategoryFormElem) {
            editCategoryFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '...پاشەکەوت دەکرێت';
                }

                const docPath = document.getElementById('editCategoryDocPath').value;
                const level = document.getElementById('editCategoryLevel').value;
                if (!docPath) {
                    showNotification('هەڵە: شوێنی دۆکیومێنت دیار نییە!', 'error');
                     if (submitButton) submitButton.disabled = false; // Re-enable button
                    return;
                }


                let updateData = {
                    name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('editCategoryNameKuBadini').value,
                    name_ar: document.getElementById('editCategoryNameAr').value,
                    order: parseInt(document.getElementById('editCategoryOrder').value) || 0
                };

                // Add level-specific fields
                if (level === '1') {
                    updateData.icon = document.getElementById('editCategoryIcon').value;
                } else { // Level 2 or 3
                    updateData.imageUrl = document.getElementById('editCategoryImageUrl').value.trim() || null;
                }

                try {
                    await updateDoc(doc(db, docPath), updateData);
                    showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                    closeCurrentPopup(); // Close the modal
                    clearProductCache(); // Clear cache as categories changed
                    // No need to manually refresh list, onSnapshot handles it in renderCategoryManagementUI
                } catch (error) {
                    console.error("Error updating category: ", error);
                    showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
                    }
                }
            });
        }

        // --- Event Listener for Announcement Form ---
        const announcementFormElem = document.getElementById('announcementForm');
        if (announcementFormElem) {
            announcementFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                 if (submitButton) {
                     submitButton.disabled = true;
                     submitButton.textContent = '...ناردن';
                 }

                const announcementData = {
                    title: {
                        ku_sorani: document.getElementById('announcementTitleKuSorani').value,
                        ku_badini: document.getElementById('announcementTitleKuBadini').value,
                        ar: document.getElementById('announcementTitleAr').value,
                    },
                    content: {
                        ku_sorani: document.getElementById('announcementContentKuSorani').value,
                        ku_badini: document.getElementById('announcementContentKuBadini').value,
                        ar: document.getElementById('announcementContentAr').value,
                    },
                    createdAt: Date.now()
                };

                try {
                    await addDoc(announcementsCollection, announcementData);
                    showNotification('ئاگەداری بە سەرکەوتوویی نێردرا', 'success');
                    announcementFormElem.reset(); // Reset form
                } catch (error) {
                    console.error("Error sending announcement: ", error);
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                } finally {
                     if (submitButton) {
                         submitButton.disabled = false;
                         submitButton.textContent = t('send_announcement_button');
                     }
                }
            });
        }

        // --- Event Listener for Policies Form ---
        const policiesFormElem = document.getElementById('policiesForm');
        if (policiesFormElem) {
            policiesFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                 if (submitButton) {
                     submitButton.disabled = true;
                     submitButton.textContent = '...پاشەکەوت دەکرێت'; // Loading state
                 }

                const policiesData = {
                    content: {
                        ku_sorani: document.getElementById('policiesContentKuSorani').value,
                        ku_badini: document.getElementById('policiesContentKuBadini').value,
                        ar: document.getElementById('policiesContentAr').value,
                    },
                    // Add a timestamp for last update if needed
                    // lastUpdatedAt: Date.now()
                };

                try {
                    const docRef = doc(db, "settings", "policies");
                    // Use setDoc with merge: true to create or update the document
                    await setDoc(docRef, policiesData, { merge: true });
                    showNotification(t('policies_saved_success'), 'success');
                } catch (error) {
                    console.error("Error saving policies:", error);
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                } finally {
                     if (submitButton) {
                         submitButton.disabled = false;
                         submitButton.textContent = t('save_button'); // Reset button text
                     }
                }
            });
        }

        // --- Event Listener for Social Media Section Toggle ---
        const socialMediaToggleElem = document.getElementById('socialMediaToggle');
        if (socialMediaToggleElem) {
            socialMediaToggleElem.onclick = () => {
                const container = document.getElementById('adminSocialMediaManagement')?.querySelector('.contact-links-container');
                const chevron = socialMediaToggleElem.querySelector('.contact-chevron');
                if (container && chevron) {
                    container.classList.toggle('open');
                    chevron.classList.toggle('open');
                }
            };
        }

        // --- Event Listener for Add Social Media Form ---
        const addSocialMediaFormElem = document.getElementById('addSocialMediaForm');
        if (addSocialMediaFormElem) {
            addSocialMediaFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                 const submitButton = e.target.querySelector('button[type="submit"]');
                 if(submitButton) submitButton.disabled = true; // Disable on submit

                const socialData = {
                    name_ku_sorani: document.getElementById('socialNameKuSorani').value,
                    name_ku_badini: document.getElementById('socialNameKuBadini').value,
                    name_ar: document.getElementById('socialNameAr').value,
                    url: document.getElementById('socialUrl').value,
                    icon: document.getElementById('socialIcon').value,
                    createdAt: Date.now() // Add timestamp
                };
                try {
                    const socialLinksRef = collection(db, 'settings', 'contactInfo', 'socialLinks');
                    await addDoc(socialLinksRef, socialData);
                    showNotification('لینک زیادکرا', 'success');
                    addSocialMediaFormElem.reset(); // Reset form
                } catch (error) {
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                    console.error("Error adding social media link:", error);
                } finally {
                     if(submitButton) submitButton.disabled = false; // Re-enable
                }
            });
        }

        // --- Event Listener for Add Contact Method Form ---
         const addContactMethodFormElem = document.getElementById('addContactMethodForm');
        if (addContactMethodFormElem) {
            addContactMethodFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                 if(submitButton) submitButton.disabled = true;

                const methodData = {
                    type: document.getElementById('contactMethodType').value,
                    value: document.getElementById('contactMethodValue').value,
                    name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value,
                    name_ku_badini: document.getElementById('contactMethodNameKuBadini').value,
                    name_ar: document.getElementById('contactMethodNameAr').value,
                    icon: document.getElementById('contactMethodIcon').value,
                    color: document.getElementById('contactMethodColor').value,
                    createdAt: Date.now() // Add timestamp
                };

                try {
                    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
                    await addDoc(methodsCollection, methodData);
                    showNotification('شێوازی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addContactMethodFormElem.reset(); // Reset form
                     clearProductCache(); // Clear cache as this affects cart actions
                } catch (error) {
                    console.error("Error adding contact method: ", error);
                    showNotification(t('error_generic') + ': ' + error.message, 'error');
                } finally {
                     if(submitButton) submitButton.disabled = false;
                }
            });
        }


        // --- Event Listener for Add/Edit Promo Card Form ---
         const addPromoCardFormElem = document.getElementById('addPromoCardForm');
        if(addPromoCardFormElem) {
            addPromoCardFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                 if(submitButton) {
                     submitButton.disabled = true;
                     submitButton.textContent = '...پاشەکەوت دەکرێت';
                 }

                const editingId = document.getElementById('editingPromoCardId').value;
                const cardData = {
                    imageUrls: {
                        ku_sorani: document.getElementById('promoCardImageKuSorani').value,
                        ku_badini: document.getElementById('promoCardImageKuBadini').value,
                        ar: document.getElementById('promoCardImageAr').value,
                    },
                    categoryId: document.getElementById('promoCardTargetCategory').value,
                    order: parseInt(document.getElementById('promoCardOrder').value) || 0, // Default order 0
                    // Add/update timestamp only if needed
                    // lastUpdatedAt: Date.now()
                };

                try {
                    if (editingId) {
                         // Update existing card
                        await setDoc(doc(db, "promo_cards", editingId), cardData, { merge: true }); // Use setDoc with merge
                        showNotification('کارتەکە نوێکرایەوە', 'success');
                    } else {
                        // Add new card
                        cardData.createdAt = Date.now(); // Add timestamp for new cards
                        await addDoc(promoCardsCollection, cardData);
                        showNotification('کارتی نوێ زیادکرا', 'success');
                    }
                    addPromoCardFormElem.reset(); // Reset form
                    document.getElementById('editingPromoCardId').value = ''; // Clear editing ID
                    if(submitButton) submitButton.textContent = 'پاشەکەوتکردن'; // Reset button text
                    clearProductCache(); // Clear cache as home page layout changed
                } catch (error) {
                    showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                    console.error("Error saving promo card:", error);
                } finally {
                    if(submitButton) {
                        submitButton.disabled = false;
                        // Reset text based on whether it was editing or adding
                        submitButton.textContent = document.getElementById('editingPromoCardId').value ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                    }
                     // Clear editing ID just in case
                     if (!document.getElementById('editingPromoCardId').value) {
                         addPromoCardFormElem.reset();
                         if(submitButton) submitButton.textContent = 'پاشەکەوتکردن';
                     }
                }
            });
        }

        // --- Event Listener for Add/Edit Brand Form ---
        const addBrandFormElem = document.getElementById('addBrandForm');
        if (addBrandFormElem) {
            addBrandFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                if(submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '...پاشەکەوت دەکرێت';
                }

                const editingId = document.getElementById('editingBrandId').value;
                const brandData = {
                    name: {
                        ku_sorani: document.getElementById('brandNameKuSorani').value,
                        ku_badini: document.getElementById('brandNameKuBadini').value,
                        ar: document.getElementById('brandNameAr').value,
                    },
                    imageUrl: document.getElementById('brandImageUrl').value,
                    categoryId: document.getElementById('brandTargetMainCategory').value || null,
                    subcategoryId: document.getElementById('brandTargetSubcategory').value || null,
                    order: parseInt(document.getElementById('brandOrder').value) || 0, // Default order 0
                    // lastUpdatedAt: Date.now() // Optional update timestamp
                };

                try {
                    if (editingId) {
                        await setDoc(doc(db, "brands", editingId), brandData, { merge: true }); // Use setDoc with merge
                        showNotification('براند نوێکرایەوە', 'success');
                    } else {
                        brandData.createdAt = Date.now(); // Add timestamp for new brands
                        await addDoc(brandsCollection, brandData);
                        showNotification('براندی نوێ زیادکرا', 'success');
                    }
                    addBrandFormElem.reset(); // Reset form
                    document.getElementById('editingBrandId').value = ''; // Clear editing ID
                    document.getElementById('brandSubcategoryContainer').style.display = 'none'; // Hide subcat dropdown
                    if(submitButton) submitButton.textContent = 'پاشەکەوتکردن'; // Reset button text
                    clearProductCache(); // Clear cache as home page layout changed
                } catch (error) {
                    showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                    console.error("Error saving brand:", error);
                } finally {
                     if(submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = document.getElementById('editingBrandId').value ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                    }
                     // Clear editing ID if saving failed or succeeded
                     if (!document.getElementById('editingBrandId').value) {
                         addBrandFormElem.reset();
                         document.getElementById('brandSubcategoryContainer').style.display = 'none';
                         if(submitButton) submitButton.textContent = 'پاشەکەوتکردن';
                     }
                }
            });

            // --- Event Listener for Brand's Main Category Select -> Populate Subcategory ---
            const brandMainCatSelectElem = document.getElementById('brandTargetMainCategory');
            if (brandMainCatSelectElem) {
                 brandMainCatSelectElem.addEventListener('change', async (e) => {
                    const mainCatId = e.target.value;
                    const brandSubCatContainer = document.getElementById('brandSubcategoryContainer');
                    const brandSubCatSelect = document.getElementById('brandTargetSubcategory');
                    if (!brandSubCatContainer || !brandSubCatSelect) return;

                    if (mainCatId) {
                        brandSubCatContainer.style.display = 'block';
                        brandSubCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>'; // Loading state
                        brandSubCatSelect.disabled = true;
                        try {
                            const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                            const snapshot = await getDocs(subCatQuery);
                            brandSubCatSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>'; // Default option
                            snapshot.forEach(doc => {
                                const subcat = { id: doc.id, ...doc.data() };
                                const option = document.createElement('option');
                                option.value = subcat.id;
                                option.textContent = subcat['name_' + getCurrentLanguage()] || subcat.name_ku_sorani || subcat.id; // Use helper
                                brandSubCatSelect.appendChild(option);
                            });
                        } catch (error) {
                             console.error("Error loading subcategories for brand form:", error);
                             brandSubCatSelect.innerHTML = '<option value="">-- هەڵە --</option>';
                        } finally {
                            brandSubCatSelect.disabled = false;
                        }
                    } else {
                        // Hide and clear subcategory dropdown if no main category is selected
                        brandSubCatContainer.style.display = 'none';
                        brandSubCatSelect.innerHTML = '';
                    }
                });
            }
        }


        // --- Event Listeners for Shortcut Rows & Cards Management ---
        const addShortcutRowFormElem = document.getElementById('addShortcutRowForm');
        if(addShortcutRowFormElem) {
            addShortcutRowFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                if(submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '...پاشەکەوت دەکرێت';
                }
                const editingId = document.getElementById('editingShortcutRowId').value;
                const rowData = {
                    title: {
                        ku_sorani: document.getElementById('shortcutRowTitleKuSorani').value,
                        ku_badini: document.getElementById('shortcutRowTitleKuBadini').value,
                        ar: document.getElementById('shortcutRowTitleAr').value,
                    },
                    order: parseInt(document.getElementById('shortcutRowOrder').value) || 0,
                    // updatedAt: Date.now() // Optional timestamp
                };

                try {
                    if (editingId) {
                        await setDoc(doc(db, "shortcut_rows", editingId), rowData, { merge: true });
                        showNotification('ڕیز نوێکرایەوە', 'success');
                    } else {
                        rowData.createdAt = Date.now(); // Add timestamp for new rows
                        await addDoc(shortcutRowsCollection, rowData);
                        showNotification('ڕیزی نوێ زیادکرا', 'success');
                    }
                    addShortcutRowFormElem.reset(); // Reset form
                    document.getElementById('editingShortcutRowId').value = ''; // Clear editing ID
                    document.getElementById('cancelRowEditBtn').style.display = 'none'; // Hide cancel
                    if(submitButton) submitButton.textContent = 'پاشەکەوتکردنی ڕیز'; // Reset button text
                    clearProductCache(); // Clear cache as home page layout changed
                } catch (error) {
                     console.error("Error saving shortcut row:", error);
                     showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                } finally {
                     if(submitButton) {
                         submitButton.disabled = false;
                         // Reset text based on mode
                         submitButton.textContent = document.getElementById('editingShortcutRowId').value ? 'نوێکردنەوەی ڕیز' : 'پاشەکەوتکردنی ڕیز';
                     }
                      // Clear editing ID if needed
                     if (!document.getElementById('editingShortcutRowId').value) {
                         addShortcutRowFormElem.reset();
                         document.getElementById('cancelRowEditBtn').style.display = 'none';
                         if(submitButton) submitButton.textContent = 'پاشەکەوتکردنی ڕیز';
                     }
                }
            });
        }

        const addCardToRowFormElem = document.getElementById('addCardToRowForm');
        if(addCardToRowFormElem) {
             addCardToRowFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                 const submitButton = e.target.querySelector('button[type="submit"]');
                 if(submitButton) {
                     submitButton.disabled = true;
                     submitButton.textContent = '...پاشەکەوت دەکرێت';
                 }

                const rowId = document.getElementById('selectRowForCard').value;
                if (!rowId) {
                    showNotification('تکایە ڕیزێک هەڵبژێرە', 'error');
                     if(submitButton) submitButton.disabled = false; // Re-enable
                    return;
                }
                const editingId = document.getElementById('editingShortcutCardId').value;
                const cardData = {
                     name: {
                        ku_sorani: document.getElementById('shortcutCardNameKuSorani').value,
                        ku_badini: document.getElementById('shortcutCardNameKuBadini').value,
                        ar: document.getElementById('shortcutCardNameAr').value,
                    },
                    imageUrl: document.getElementById('shortcutCardImageUrl').value,
                    categoryId: document.getElementById('shortcutCardMainCategory').value || null,
                    subcategoryId: document.getElementById('shortcutCardSubcategory').value || null,
                    subSubcategoryId: document.getElementById('shortcutCardSubSubcategory').value || null,
                    order: parseInt(document.getElementById('shortcutCardOrder').value) || 0,
                    // updatedAt: Date.now() // Optional timestamp
                };

                try {
                    const cardsCollectionRef = collection(db, "shortcut_rows", rowId, "cards");
                    if (editingId) {
                        await setDoc(doc(cardsCollectionRef, editingId), cardData, { merge: true });
                        showNotification('کارت نوێکرایەوە', 'success');
                    } else {
                        cardData.createdAt = Date.now(); // Add timestamp for new cards
                        await addDoc(cardsCollectionRef, cardData);
                        showNotification('کارتی نوێ زیادکرا بۆ ڕیزەکە', 'success');
                    }
                    addCardToRowFormElem.reset(); // Reset form
                    document.getElementById('editingShortcutCardId').value = ''; // Clear editing ID
                    document.getElementById('selectRowForCard').disabled = false; // Re-enable row selection
                    document.getElementById('cancelCardEditBtn').style.display = 'none'; // Hide cancel
                    // Reset category dropdowns visually
                    document.getElementById('shortcutCardSubContainer').style.display = 'none';
                    document.getElementById('shortcutCardSubSubContainer').style.display = 'none';
                    document.getElementById('shortcutCardSubcategory').innerHTML = '';
                    document.getElementById('shortcutCardSubSubcategory').innerHTML = '';
                    if(submitButton) submitButton.textContent = 'زیادکردنی کارت'; // Reset button text
                    clearProductCache(); // Clear cache as home page layout changed
                } catch (error) {
                    console.error("Error saving shortcut card:", error);
                    showNotification('هەڵەیەک ڕوویدا' + ': ' + error.message, 'error');
                } finally {
                     if(submitButton) {
                        submitButton.disabled = false;
                         submitButton.textContent = document.getElementById('editingShortcutCardId').value ? 'نوێکردنەوەی کارت' : 'زیادکردنی کارت';
                    }
                     // Clear editing ID if needed
                     if (!document.getElementById('editingShortcutCardId').value) {
                         addCardToRowFormElem.reset();
                         document.getElementById('selectRowForCard').disabled = false;
                         document.getElementById('cancelCardEditBtn').style.display = 'none';
                         document.getElementById('shortcutCardSubContainer').style.display = 'none';
                         document.getElementById('shortcutCardSubSubContainer').style.display = 'none';
                         if(submitButton) submitButton.textContent = 'زیادکردنی کارت';
                     }
                }
            });
        }

        // --- Event Delegation for Shortcut Row/Card Edit/Delete Buttons ---
        const shortcutRowsListContainerElem = document.getElementById('shortcutRowsListContainer');
        if(shortcutRowsListContainerElem) {
            shortcutRowsListContainerElem.addEventListener('click', async (e) => {
                const editRowBtn = e.target.closest('.edit-row-btn');
                const deleteRowBtn = e.target.closest('.delete-row-btn');
                const editCardBtn = e.target.closest('.edit-card-btn');
                const deleteCardBtn = e.target.closest('.delete-card-btn');

                if (editRowBtn) {
                    const rowId = editRowBtn.dataset.id;
                    try {
                        const rowSnap = await getDoc(doc(db, "shortcut_rows", rowId));
                        if(rowSnap.exists()) {
                            self.editShortcutRow({ id: rowSnap.id, ...rowSnap.data() }); // Pass full data
                        } else {
                             showNotification('ڕیزەکە نەدۆزرایەوە', 'error');
                        }
                    } catch (error) { console.error("Error fetching row to edit:", error); showNotification('هەڵە', 'error');}

                } else if (deleteRowBtn) {
                    self.deleteShortcutRow(deleteRowBtn.dataset.id);

                } else if (editCardBtn) {
                     const rowId = editCardBtn.closest('.shortcut-row-admin-item')?.querySelector('.edit-row-btn')?.dataset.id; // Find row ID from parent
                     const cardId = editCardBtn.dataset.cardId;
                     if(rowId && cardId) {
                         try {
                             const cardSnap = await getDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
                             if(cardSnap.exists()) {
                                 self.editShortcutCard(rowId, { id: cardSnap.id, ...cardSnap.data() }); // Pass rowId and full card data
                             } else {
                                 showNotification('کارتەکە نەدۆزرایەوە', 'error');
                             }
                         } catch(error) { console.error("Error fetching card to edit:", error); showNotification('هەڵە', 'error');}
                     }

                } else if (deleteCardBtn) {
                     const rowId = deleteCardBtn.closest('.shortcut-row-admin-item')?.querySelector('.delete-row-btn')?.dataset.id; // Find row ID
                     const cardId = deleteCardBtn.dataset.cardId;
                     if(rowId && cardId) {
                         self.deleteShortcutCard(rowId, cardId);
                     }
                }
            });
        }


        // --- Event Listeners for Cancel Buttons (Shortcut Row/Card) ---
        const cancelRowEditBtnElem = document.getElementById('cancelRowEditBtn');
        if(cancelRowEditBtnElem) {
             cancelRowEditBtnElem.addEventListener('click', () => {
                 if(addShortcutRowFormElem) addShortcutRowFormElem.reset();
                 document.getElementById('editingShortcutRowId').value = '';
                 cancelRowEditBtnElem.style.display = 'none';
                 const submitBtn = addShortcutRowFormElem?.querySelector('button[type="submit"]');
                 if(submitBtn) submitBtn.textContent = 'پاشەکەوتکردنی ڕیز';
            });
        }

        const cancelCardEditBtnElem = document.getElementById('cancelCardEditBtn');
        if(cancelCardEditBtnElem) {
            cancelCardEditBtnElem.addEventListener('click', () => {
                 if(addCardToRowFormElem) addCardToRowFormElem.reset();
                 document.getElementById('editingShortcutCardId').value = '';
                 const rowSelect = document.getElementById('selectRowForCard');
                 if(rowSelect) rowSelect.disabled = false;
                 cancelCardEditBtnElem.style.display = 'none';
                 // Reset category dropdowns visually
                 document.getElementById('shortcutCardSubContainer').style.display = 'none';
                 document.getElementById('shortcutCardSubSubContainer').style.display = 'none';
                  const submitBtn = addCardToRowFormElem?.querySelector('button[type="submit"]');
                  if(submitBtn) submitBtn.textContent = 'زیادکردنی کارت';
            });
        }


        // --- Event Listeners for Shortcut Card Category Dropdowns ---
        const shortcutMainCatSelectElem = document.getElementById('shortcutCardMainCategory');
        if (shortcutMainCatSelectElem) {
            shortcutMainCatSelectElem.addEventListener('change', async (e) => {
                const mainCatId = e.target.value;
                const subContainer = document.getElementById('shortcutCardSubContainer');
                const subSubContainer = document.getElementById('shortcutCardSubSubContainer');
                const subSelect = document.getElementById('shortcutCardSubcategory');
                const subSubSelect = document.getElementById('shortcutCardSubSubcategory');
                if(!subContainer || !subSubContainer || !subSelect || !subSubSelect) return;

                // Reset and hide sub-sub first
                subSubContainer.style.display = 'none';
                subSubSelect.innerHTML = '';

                if (mainCatId) {
                    subContainer.style.display = 'block';
                    subSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>'; // Loading
                    subSelect.disabled = true;
                    try {
                        const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                        const snapshot = await getDocs(subCatQuery);
                        subSelect.innerHTML = '<option value="">-- هەموو جۆرە لاوەکییەکان --</option>'; // Default
                        snapshot.forEach(doc => {
                            const subcat = { id: doc.id, ...doc.data() };
                            const option = document.createElement('option');
                            option.value = subcat.id;
                            option.textContent = subcat['name_' + getCurrentLanguage()] || subcat.name_ku_sorani || subcat.id;
                            subSelect.appendChild(option);
                        });
                    } catch (error) { console.error("Error loading subcats for shortcut card:", error); subSelect.innerHTML = '<option value="">-- هەڵە --</option>';}
                    finally { subSelect.disabled = false; }

                } else {
                    subContainer.style.display = 'none';
                    subSelect.innerHTML = '';
                }
            });
        }

        const shortcutSubCatSelectElem = document.getElementById('shortcutCardSubcategory');
         if (shortcutSubCatSelectElem) {
             shortcutSubCatSelectElem.addEventListener('change', async(e) => {
                 const mainCatId = shortcutMainCatSelectElem?.value;
                 const subCatId = e.target.value;
                 const subSubContainer = document.getElementById('shortcutCardSubSubContainer');
                 const subSubSelect = document.getElementById('shortcutCardSubSubcategory');
                 if(!subSubContainer || !subSubSelect || !mainCatId) return;


                 if(subCatId) {
                     subSubContainer.style.display = 'block';
                     subSubSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>'; // Loading
                     subSubSelect.disabled = true;
                     try {
                         const subSubQuery = query(collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"), orderBy("order", "asc"));
                         const snapshot = await getDocs(subSubQuery);
                         subSubSelect.innerHTML = '<option value="">-- هەموو جۆرەکان --</option>'; // Default
                         if (!snapshot.empty) {
                             snapshot.forEach(doc => {
                                 const subSubCat = { id: doc.id, ...doc.data() };
                                 const option = document.createElement('option');
                                 option.value = subSubCat.id;
                                 option.textContent = subSubCat['name_' + getCurrentLanguage()] || subSubCat.name_ku_sorani || subSubCat.id;
                                 subSubSelect.appendChild(option);
                             });
                         } else {
                              subSubContainer.style.display = 'none'; // Hide if no sub-subs
                         }
                     } catch(error) { console.error("Error loading sub-subcats for shortcut card:", error); subSubSelect.innerHTML = '<option value="">-- هەڵە --</option>';}
                     finally { subSubSelect.disabled = false; }

                 } else {
                     subSubContainer.style.display = 'none';
                     subSubSelect.innerHTML = '';
                 }
             });
         }


        this.listenersAttached = true; // Mark as attached
        console.log("Admin event listeners attached.");
    }
};

// Initialize admin logic if user is already admin (e.g., page refresh)
if (sessionStorage.getItem('isAdmin') === 'true') {
    // Wait for DOM content to be fully loaded AND shared tools to be available
    const checkReady = setInterval(() => {
        if (document.readyState === "complete" && window.globalAdminTools) {
            clearInterval(checkReady);
            window.AdminLogic.initialize();
        }
    }, 100);
}

// Ensure deinitialize is called if auth state changes to non-admin
auth.onAuthStateChanged(user => {
    const isAdminNow = user && user.uid === "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with actual admin UID
    const wasAdmin = sessionStorage.getItem('isAdmin') === 'true';

    if (!isAdminNow && wasAdmin) {
        // User logged out or changed, and they were previously admin
        sessionStorage.removeItem('isAdmin');
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    } else if (isAdminNow && !wasAdmin) {
        // User just logged in as admin
        sessionStorage.setItem('isAdmin', 'true');
         if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Ensure DOM is ready before initializing fully
             if (document.readyState === "complete") {
                 window.AdminLogic.initialize();
             } else {
                 document.addEventListener('DOMContentLoaded', () => window.AdminLogic.initialize());
             }
        }
    }
    // Update UI based on current admin status (redundant with initialize/deinitialize but safe)
    if (window.AdminLogic && typeof window.AdminLogic.updateAdminUI === 'function') {
        window.AdminLogic.updateAdminUI(isAdminNow);
    }

     // Close login modal if login was successful
     if (isAdminNow && document.getElementById('loginModal')?.style.display === 'block') {
         closeCurrentPopup();
     }
});