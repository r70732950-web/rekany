// فایلی admin.js (تەواو و نوێکراوە بۆ سیستەمی پێشکەوتووی ڕیزبەندی و بانەری ناوخۆیی)

const {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, limit, where,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache
} = window.globalAdminTools;

// Define collections used in this file
const shortcutRowsCollection = collection(db, "shortcut_rows");
const internalAdsCollection = collection(db, "internal_ads"); // زیادکرا
const homeLayoutCollection = collection(db, 'home_layout'); // زیادکرا

window.AdminLogic = {
    listenersAttached: false,

    initialize: function() {
        console.log("Admin logic initialized.");
        this.migrateAndSetupDefaultHomeLayout();
        this.updateAdminUI(true);
        this.setupAdminEventListeners(); // Make sure this is called only ONCE
        this.loadPoliciesForAdmin();
        this.renderCategoryManagementUI();
        this.renderAdminAnnouncementsList();
        this.renderSocialMediaLinks();
        this.renderPromoCardsAdminList();
        this.renderBrandsAdminList();
        this.renderContactMethodsAdmin();
        this.renderShortcutRowsAdminList();
        this.renderInternalAdsAdminList(); // *** زیادکرا ***
        this.updateAdminCategoryDropdowns();
        this.updateShortcutCardCategoryDropdowns();
        this.renderHomeLayoutAdmin();
    },

    deinitialize: function() {
        console.log("Admin logic de-initialized.");
        this.updateAdminUI(false);
        // Consider removing listeners if re-initialization might occur without page reload
    },

    migrateAndSetupDefaultHomeLayout: async function() {
        const layoutCollectionRef = collection(db, 'home_layout');
        const snapshot = await getDocs(query(layoutCollectionRef, limit(1)));

        if (snapshot.empty) {
            console.log("`home_layout` collection is empty. Creating default layout.");
            await this.createDefaultHomeLayout(layoutCollectionRef);
            return;
        }

        const firstDocData = snapshot.docs[0].data();
        // Check if the structure lacks the 'name' object or has 'name' as a string
        const isOldStructure = typeof firstDocData.name === 'string' || !firstDocData.hasOwnProperty('name') || !firstDocData.name.hasOwnProperty('ku_sorani');

        if (isOldStructure) {
            console.warn("Old home_layout structure detected. Migrating to new structure...");
            showNotification('خەریکی نوێکردنەوەی سیستەمی ڕیزبەندییە...', 'success');

            const allDocsSnapshot = await getDocs(layoutCollectionRef);
            const deletePromises = allDocsSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            console.log("Old layout deleted.");

            await this.createDefaultHomeLayout(layoutCollectionRef);
            console.log("New default layout created after migration.");
        } else {
            console.log("`home_layout` structure is up to date.");
        }
    },

    createDefaultHomeLayout: async function(collectionRef) {
        const defaultLayout = [
            { name: { ku_sorani: 'سلایدەری ڕێکلام', ku_badini: 'سلایدەرێ ڕێکلاما', ar: 'سلايدر الإعلانات' }, order: 1, type: 'promo_slider', enabled: true },
            { name: { ku_sorani: 'بەشی براندەکان', ku_badini: 'پشکا براندا', ar: 'قسم الماركات' }, order: 2, type: 'brands', enabled: true },
            { name: { ku_sorani: 'نوێترین کاڵاکان', ku_badini: 'نووترین کاڵا', ar: 'أحدث المنتجات' }, order: 3, type: 'newest_products', enabled: true },
            { name: { ku_sorani: 'هەموو کاڵاکان', ku_badini: 'هەمی کاڵا', ar: 'كل المنتجات' }, order: 4, type: 'all_products', enabled: true }
        ];
        const addPromises = defaultLayout.map(item => addDoc(collectionRef, item));
        await Promise.all(addPromises);
    },

    updateAdminUI: function(isAdmin) {
        document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

        const adminSections = [
            'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
            'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
            'adminContactMethodsManagement', 'adminShortcutRowsManagement',
            'adminHomeLayoutManagement',
            'adminInternalAdsManagement' // *** زیادکرا ***
        ];
        adminSections.forEach(id => {
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

        const categoryId = product.categoryId || product.category; // Handle old 'category' field
        document.getElementById('productCategoryId').value = categoryId;

        if (product.description && typeof product.description === 'object') {
            document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
            document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
            document.getElementById('productDescriptionAr').value = product.description.ar || '';
        } else {
             document.getElementById('productDescriptionKuSorani').value = product.description; // Fallback
             document.getElementById('productDescriptionKuBadini').value = '';
             document.getElementById('productDescriptionAr').value = '';
        }


        const imageUrls = product.imageUrls || (product.image ? [product.image] : []); // Handle old 'image' field
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

        // Populate dropdowns and wait
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
            clearProductCache(); // Clear cache as products changed
            searchProductsInFirestore(document.getElementById('searchInput').value, true); // Refresh product list
        } catch (error) {
            showNotification(t('product_delete_error'), 'error');
            console.error("Error deleting product:", error);
        }
    },

    createProductImageInputs: function(imageUrls = []) {
        const imageInputsContainer = document.getElementById('imageInputsContainer');
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
    },

    populateSubcategoriesDropdown: async function(categoryId, selectedSubcategoryId = null) {
        const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
        const productSubcategorySelect = document.getElementById('productSubcategoryId');

        if (!categoryId) {
            subcategorySelectContainer.style.display = 'none';
            document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- سەرەتا جۆری سەرەکی هەڵبژێرە --</option>'; // Reset
            return;
        }

        productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        productSubcategorySelect.disabled = true;
        subcategorySelectContainer.style.display = 'block';

        try {
            const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
            const q = query(subcategoriesQuery, orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);

            productSubcategorySelect.innerHTML = '<option value="" >-- هیچ جۆرێکی لاوەکی --</option>'; // Allow no subcategory

            if (querySnapshot.empty) {
                // Keep the "هیچ" option, but maybe add a disabled placeholder?
                // productSubcategorySelect.innerHTML += '<option value="" disabled>هیچ جۆرێکی لاوەکی نییە</option>';
                 document.getElementById('subSubcategorySelectContainer').style.display = 'none'; // Hide sub-sub if no sub
            } else {
                querySnapshot.docs.forEach(doc => {
                    const subcat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    option.textContent = subcat.name_ku_sorani || subcat.id; // Use Sorani name
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
    },

    populateSubSubcategoriesDropdown: async function(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
        const container = document.getElementById('subSubcategorySelectContainer');
        const select = document.getElementById('productSubSubcategoryId');

        if (!mainCategoryId || !subcategoryId) {
            container.style.display = 'none';
            select.innerHTML = ''; // Clear previous options
            return;
        }

        select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        select.disabled = true;
        container.style.display = 'block';

        try {
            const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
            const q = query(ref, orderBy("order", "asc"));
            const snapshot = await getDocs(q);

            select.innerHTML = '<option value="">-- هیچ --</option>'; // Allow selecting no sub-subcategory
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const subSubcat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subSubcat.id;
                    option.textContent = subSubcat.name_ku_sorani; // Use Sorani name
                    if (subSubcat.id === selectedSubSubcategoryId) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            } else {
                 // Keep the "هیچ" option
            }
        } catch (error) {
            console.error("Error fetching sub-subcategories for form:", error);
            select.innerHTML = '<option value="" disabled>هەڵەیەک ڕوویدا</option>';
        } finally {
            select.disabled = false;
        }
    },

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
                // No need to clear product cache for announcements
            } catch (e) {
                showNotification(t('error_generic'), 'error');
                console.error("Error deleting announcement:", e);
            }
        }
    },

    renderAdminAnnouncementsList: function() {
        const container = document.getElementById('announcementsListContainer');
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));

        // Use onSnapshot to listen for real-time updates
        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
                return;
            }
            snapshot.forEach(doc => {
                const announcement = { id: doc.id, ...doc.data() };
                const title = (announcement.title && announcement.title.ku_sorani) || 'بێ ناونیشان';
                const item = document.createElement('div');
                item.className = 'admin-notification-item'; // Reuse style
                item.innerHTML = `
                    <div class="admin-notification-details">
                        <div class="notification-title">${title}</div>
                    </div>
                    <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
                `;
                // Add event listener directly here
                item.querySelector('.delete-btn').addEventListener('click', () => this.deleteAnnouncement(announcement.id));
                container.appendChild(item);
            });
        }, (error) => {
            console.error("Error listening to announcements:", error);
            container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی ئاگەدارییەکان.</p>`;
        });
    },

    deleteSocialMediaLink: async function(linkId) {
        if (confirm('دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟')) {
            try {
                const linkRef = doc(db, 'settings', 'contactInfo', 'socialLinks', linkId);
                await deleteDoc(linkRef);
                showNotification('لینکەکە سڕدرایەوە', 'success');
            } catch (error) {
                console.error("Error deleting social link: ", error);
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    renderSocialMediaLinks: function() {
        const socialLinksListContainer = document.getElementById('socialLinksListContainer');
        const socialLinksCollectionRef = collection(db, 'settings', 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollectionRef, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            socialLinksListContainer.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const link = { id: doc.id, ...doc.data() };
                const name = link['name_' + getCurrentLanguage()] || link.name_ku_sorani;

                const item = document.createElement('div');
                item.className = 'social-link-item'; // Use specific class if needed
                item.innerHTML = `
                    <div class="item-info">
                        <i class="${link.icon}"></i>
                        <div class="item-details">
                            <span class="item-name">${name}</span>
                            <span class="item-value">${link.url}</span>
                        </div>
                    </div>
                    <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
                `;
                // Add event listener directly
                item.querySelector('.delete-btn').onclick = () => this.deleteSocialMediaLink(link.id);
                socialLinksListContainer.appendChild(item);
            });
        }, (error) => {
             console.error("Error listening to social links:", error);
             socialLinksListContainer.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی لینکەکان.</p>`;
        });
    },

    deleteContactMethod: async function(methodId) {
        if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
            try {
                const methodRef = doc(db, 'settings', 'contactInfo', 'contactMethods', methodId);
                await deleteDoc(methodRef);
                showNotification('شێوازەکە سڕدرایەوە', 'success');
            } catch (error) {
                console.error("Error deleting contact method: ", error);
                showNotification('هەڵەیەک لە сڕینەوە ڕوویدا', 'error');
            }
        }
    },

    renderContactMethodsAdmin: function() {
        const container = document.getElementById('contactMethodsListContainer');
        const methodsCollectionRef = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollectionRef, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const method = { id: doc.id, ...doc.data() };
                const name = method['name_' + getCurrentLanguage()] || method.name_ku_sorani;

                const item = document.createElement('div');
                item.className = 'social-link-item'; // Reuse style
                item.innerHTML = `
                    <div class="item-info">
                        <i class="${method.icon}" style="color: ${method.color};"></i>
                        <div class="item-details">
                            <span class="item-name">${name}</span>
                            <span class="item-value">${method.value}</span>
                        </div>
                    </div>
                    <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
                `;
                // Add listener directly
                item.querySelector('.delete-btn').onclick = () => this.deleteContactMethod(method.id);
                container.appendChild(item);
            });
        }, (error) => {
             console.error("Error listening to contact methods:", error);
             container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی شێوازەکان.</p>`;
        });
    },

    renderPromoCardsAdminList: function() {
        const container = document.getElementById('promoCardsListContainer');
        const q = query(promoCardsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ سلایدێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const card = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'admin-notification-item'; // Reuse style
                item.innerHTML = `
                    <div class="admin-notification-details" style="align-items: center; display: flex;">
                        <img src="${card.imageUrls.ku_sorani}" style="width: 40px; height: 40px; object-fit: cover; margin-left: 10px; border-radius: 4px;">
                        <div class="notification-title">سلایدی ڕیزبەندی: ${card.order}</div>
                    </div>
                    <div>
                        <button class="edit-btn small-btn" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                // Add listeners directly
                item.querySelector('.edit-btn').onclick = () => this.editPromoCard(card);
                item.querySelector('.delete-btn').onclick = () => this.deletePromoCard(card.id);
                container.appendChild(item);
            });
        }, (error) => {
             console.error("Error listening to promo cards:", error);
             container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی سلایدەکان.</p>`;
        });
    },

    editPromoCard: function(card) {
        document.getElementById('editingPromoCardId').value = card.id;
        document.getElementById('promoCardImageKuSorani').value = card.imageUrls.ku_sorani || '';
        document.getElementById('promoCardImageKuBadini').value = card.imageUrls.ku_badini || '';
        document.getElementById('promoCardImageAr').value = card.imageUrls.ar || '';
        document.getElementById('promoCardTargetCategory').value = card.categoryId || ''; // Set to empty string if null/undefined
        document.getElementById('promoCardOrder').value = card.order || 1;
        document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth' });
    },

    deletePromoCard: async function(cardId) {
        if (confirm('دڵنیایت دەتەوێت ئەم سلایدە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "promo_cards", cardId));
                showNotification('سلایدەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home layout might change
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting promo card:", error);
            }
        }
    },

    renderBrandsAdminList: function() {
        const container = document.getElementById('brandsListContainer');
        const q = query(brandsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ براندێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const brand = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'admin-notification-item'; // Reuse style
                item.innerHTML = `
                    <div class="admin-notification-details" style="align-items: center; display: flex;">
                        <img src="${brand.imageUrl}" style="width: 40px; height: 40px; object-fit: contain; margin-left: 10px; border-radius: 50%; background: #eee;">
                        <div class="notification-title">${brand.name.ku_sorani} (ڕیز: ${brand.order})</div>
                    </div>
                    <div>
                        <button class="edit-btn small-btn"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                // Add listeners directly
                item.querySelector('.edit-btn').onclick = () => this.editBrand(brand);
                item.querySelector('.delete-btn').onclick = () => this.deleteBrand(brand.id);
                container.appendChild(item);
            });
        }, (error) => {
             console.error("Error listening to brands:", error);
             container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی براندەکان.</p>`;
        });
    },

    editBrand: function(brand) {
        document.getElementById('editingBrandId').value = brand.id;
        document.getElementById('brandNameKuSorani').value = brand.name.ku_sorani || '';
        document.getElementById('brandNameKuBadini').value = brand.name.ku_badini || '';
        document.getElementById('brandNameAr').value = brand.name.ar || '';
        document.getElementById('brandImageUrl').value = brand.imageUrl || '';
        document.getElementById('brandOrder').value = brand.order || 10;

        const mainCatSelect = document.getElementById('brandTargetMainCategory');
        mainCatSelect.value = brand.categoryId || '';

        // Trigger change event to load subcategories
        mainCatSelect.dispatchEvent(new Event('change'));

        // Wait a bit for subcategories to load, then select
        setTimeout(() => {
            document.getElementById('brandTargetSubcategory').value = brand.subcategoryId || '';
        }, 500); // Adjust delay if needed

        document.getElementById('addBrandForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        document.getElementById('addBrandForm').scrollIntoView({ behavior: 'smooth' });
    },

    deleteBrand: async function(brandId) {
        if (confirm('دڵنیایت دەتەوێت ئەم براندە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "brands", brandId));
                showNotification('براندەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home layout might change
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting brand: ", error);
            }
        }
    },

    renderCategoryManagementUI: async function() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

        try {
            let content = '';
            const mainCategoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
            const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);

            if (mainCategoriesSnapshot.empty) {
                container.innerHTML = '<p>هیچ جۆرێکی سەرەکی زیاد نەکراوە.</p>';
                return;
            }

            for (const mainDoc of mainCategoriesSnapshot.docs) {
                const mainCategory = { id: mainDoc.id, ...mainDoc.data() };
                const mainPath = `categories/${mainCategory.id}`;
                content += `
                    <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <strong><i class="${mainCategory.icon || 'fas fa-folder'}"></i> ${mainCategory.name_ku_sorani} (ڕیزبەندی: ${mainCategory.order || 0})</strong>
                            <div>
                                <button class="edit-btn small-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn" data-path="${mainPath}" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;

                const subCategoriesQuery = query(collection(db, mainPath, "subcategories"), orderBy("order", "asc"));
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

                    const subSubCategoriesQuery = query(collection(db, subPath, "subSubcategories"), orderBy("order", "asc"));
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

            container.innerHTML = content;
            // Re-attach listeners after innerHTML is set
            const self = this;
            container.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => self.openEditCategoryModal(btn.dataset.path, btn.dataset.level));
            });
            container.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => self.handleDeleteCategory(btn.dataset.path, btn.dataset.name));
            });
        } catch (error) {
             console.error("Error rendering category management UI:", error);
             container.innerHTML = `<p style="color: var(--danger-color);">هەڵە لە بارکردنی جۆرەکان.</p>`;
        }

    },

    openEditCategoryModal: async function(docPath, level) {
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
    },

    handleDeleteCategory: async function(docPath, categoryName) {
        // Warning about subcategories is good practice but complex to implement recursively here.
        // Simple confirmation for now.
        const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەمە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە (ئەگەر هەبن).`);
        if (confirmation) {
            try {
                // Deleting a document doesn't automatically delete subcollections in Firestore Client SDK.
                // A Cloud Function is the standard way to handle cascading deletes.
                // For now, we only delete the category document itself. Subcategories remain but become orphaned.
                await deleteDoc(doc(db, docPath));
                showNotification('جۆرەکە سڕدرایەوە (بەڵام جۆرە لاوەکییەکانی ماون - پێویستە بە Cloud Function بسڕدرێنەوە)', 'success');
                this.renderCategoryManagementUI(); // Refresh the list
                clearProductCache(); // Clear cache as categories changed
            } catch (error) {
                console.error("Error deleting category: ", error);
                showNotification('هەڵەیەک ڕوویدا لە کاتی sڕینەوە', 'error');
            }
        }
    },

    updateAdminCategoryDropdowns: function() {
        const categories = getCategories(); // Assumes getCategories() returns up-to-date list including 'all'
        if (!categories || categories.length <= 1) { // Check if categories are loaded and not just 'all'
             console.warn("Categories not loaded yet for admin dropdowns.");
             return; // Don't populate if categories aren't ready
        }
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

        const dropdowns = [
            { id: 'parentCategorySelect', defaultText: '-- جۆری سەرەکی هەڵبژێرە --', required: true },
            { id: 'parentMainCategorySelectForSubSub', defaultText: '-- جۆری سەرەکی هەڵبژێرە --', required: true },
            { id: 'promoCardTargetCategory', defaultText: '-- هیچ --', required: false }, // Promo card link is optional
            { id: 'brandTargetMainCategory', defaultText: '-- هەموو جۆرەکان --', required: false } // Brand link is optional
        ];

        dropdowns.forEach(d => {
            const select = document.getElementById(d.id);
            if (select) {
                // Set default option based on whether it's required
                const firstOptionValue = d.required ? "" : ""; // Use empty string for both now
                const firstOptionText = d.defaultText;
                const disabled = d.required ? "disabled" : "";
                select.innerHTML = `<option value="${firstOptionValue}" ${disabled} selected>${firstOptionText}</option>`;

                categoriesWithoutAll.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name_ku_sorani || cat.name_ku_badini || cat.id; // Fallback to id
                    select.appendChild(option);
                });
            } else {
                 console.warn(`Dropdown with ID ${d.id} not found.`);
            }
        });
    },

    renderShortcutRowsAdminList: function() {
        const container = document.getElementById('shortcutRowsListContainer');
        const rowSelect = document.getElementById('selectRowForCard');
        const q = query(shortcutRowsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            // Preserve selected value if possible
            const selectedRow = rowSelect.value;
            rowSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا ڕیزێک هەڵبژێرە --</option>';

            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ ڕیزێک زیاد نەکراوە.</p>';
                return;
            }

            snapshot.forEach(rowDoc => {
                const row = { id: rowDoc.id, ...rowDoc.data() };

                // Populate row select dropdown
                const option = document.createElement('option');
                option.value = row.id;
                option.textContent = row.title.ku_sorani;
                if (row.id === selectedRow) {
                     option.selected = true; // Restore selection
                }
                rowSelect.appendChild(option);

                // Render row admin UI
                const rowElement = document.createElement('div');
                rowElement.style.border = '1px solid #ddd';
                rowElement.style.borderRadius = '6px';
                rowElement.style.marginBottom = '10px';

                rowElement.innerHTML = `
                    <div style="background: #f0f2f5; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <strong>${row.title.ku_sorani} (ڕیز: ${row.order})</strong>
                        <div>
                            <button class="edit-row-btn edit-btn small-btn" data-id="${row.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-row-btn delete-btn small-btn" data-id="${row.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="cards-list-container" style="padding: 10px;">...خەریکی بارکردنی کارتەکانە</div>
                `;
                container.appendChild(rowElement);

                // Render cards within this row
                const cardsContainer = rowElement.querySelector('.cards-list-container');
                const cardsQuery = query(collection(db, "shortcut_rows", row.id, "cards"), orderBy("order", "asc"));
                onSnapshot(cardsQuery, (cardsSnapshot) => {
                    cardsContainer.innerHTML = ''; // Clear previous cards
                    if(cardsSnapshot.empty) {
                        cardsContainer.innerHTML = '<p style="font-size: 12px; color: gray;">هیچ کارتێک بۆ ئەم ڕیزە زیاد نەکراوە.</p>';
                    } else {
                        cardsSnapshot.forEach(cardDoc => {
                            const card = { id: cardDoc.id, ...cardDoc.data() };
                            const cardElement = document.createElement('div');
                            cardElement.style.display = 'flex';
                            cardElement.style.justifyContent = 'space-between';
                            cardElement.style.alignItems = 'center'; // Align items vertically
                            cardElement.style.padding = '5px 0';
                            cardElement.innerHTML = `
                                <span style="display: flex; align-items: center; gap: 8px;">
                                    <img src="${card.imageUrl}" style="width: 25px; height: 25px; object-fit: cover; border-radius: 4px;">
                                    - ${card.name.ku_sorani} (ڕیز: ${card.order})
                                </span>
                                <div>
                                    <button class="edit-card-btn edit-btn small-btn" data-row-id="${row.id}" data-card-id="${card.id}"><i class="fas fa-edit"></i></button>
                                    <button class="delete-card-btn delete-btn small-btn" data-row-id="${row.id}" data-card-id="${card.id}"><i class="fas fa-trash"></i></button>
                                </div>
                            `;
                            // Add listeners directly here for cards
                            cardElement.querySelector('.edit-card-btn').addEventListener('click', (e) => this.editShortcutCard(e.currentTarget.dataset.rowId, e.currentTarget.dataset.cardId));
                            cardElement.querySelector('.delete-card-btn').addEventListener('click', (e) => this.deleteShortcutCard(e.currentTarget.dataset.rowId, e.currentTarget.dataset.cardId));
                            cardsContainer.appendChild(cardElement);
                        });
                    }
                }, (error) => {
                     console.error(`Error listening to cards for row ${row.id}:`, error);
                     cardsContainer.innerHTML = `<p style="color: var(--danger-color);">هەڵە لە بارکردنی کارتەکان.</p>`;
                });
            });

            // Add listeners for row edit/delete buttons (delegation might be better, but direct is fine here)
             container.querySelectorAll('.edit-row-btn').forEach(btn => btn.addEventListener('click', (e) => this.editShortcutRow(e.currentTarget.dataset.id)));
             container.querySelectorAll('.delete-row-btn').forEach(btn => btn.addEventListener('click', (e) => this.deleteShortcutRow(e.currentTarget.dataset.id)));

        }, (error) => {
             console.error("Error listening to shortcut rows:", error);
             container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی ڕیزەکان.</p>`;
        });
    },

    editShortcutRow: async function(rowId) {
        const rowSnap = await getDoc(doc(db, "shortcut_rows", rowId));
        if (rowSnap.exists()) {
            const row = rowSnap.data();
            document.getElementById('editingShortcutRowId').value = rowId;
            document.getElementById('shortcutRowTitleKuSorani').value = row.title.ku_sorani || '';
            document.getElementById('shortcutRowTitleKuBadini').value = row.title.ku_badini || '';
            document.getElementById('shortcutRowTitleAr').value = row.title.ar || '';
            document.getElementById('shortcutRowOrder').value = row.order || 10;
            document.getElementById('cancelRowEditBtn').style.display = 'block';
            document.getElementById('addShortcutRowForm').scrollIntoView({ behavior: 'smooth' });
        } else {
             showNotification("ڕیزەکە نەدۆزرایەوە!", 'error');
        }
    },

    editShortcutCard: async function(rowId, cardId) {
         const cardSnap = await getDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
         if (cardSnap.exists()) {
             const card = cardSnap.data();
             const form = document.getElementById('addCardToRowForm');

             // Set form values
             document.getElementById('selectRowForCard').value = rowId;
             document.getElementById('selectRowForCard').disabled = true; // Disable row selection during edit
             document.getElementById('editingShortcutCardId').value = cardId;
             document.getElementById('shortcutCardNameKuSorani').value = card.name.ku_sorani || '';
             document.getElementById('shortcutCardNameKuBadini').value = card.name.ku_badini || '';
             document.getElementById('shortcutCardNameAr').value = card.name.ar || '';
             document.getElementById('shortcutCardImageUrl').value = card.imageUrl || '';
             document.getElementById('shortcutCardOrder').value = card.order || 10;

             // Handle category dropdowns (main, sub, sub-sub)
             const mainCatSelect = document.getElementById('shortcutCardMainCategory');
             mainCatSelect.value = card.categoryId || '';
             mainCatSelect.dispatchEvent(new Event('change')); // Trigger loading subcategories

             // Use setTimeout to allow subcategories to load before selecting them
             setTimeout(() => {
                 const subCatSelect = document.getElementById('shortcutCardSubcategory');
                 subCatSelect.value = card.subcategoryId || '';
                 subCatSelect.dispatchEvent(new Event('change')); // Trigger loading sub-subcategories

                 // Another setTimeout for sub-subcategories
                 setTimeout(() => {
                     document.getElementById('shortcutCardSubSubcategory').value = card.subSubcategoryId || '';
                 }, 500); // Adjust delay if sub-subcategories load slowly

             }, 500); // Adjust delay if subcategories load slowly


             // Update UI for editing state
             form.querySelector('button[type="submit"]').textContent = 'نوێکردنەوەی کارت';
             document.getElementById('cancelCardEditBtn').style.display = 'block';
             form.scrollIntoView({ behavior: 'smooth' });
         } else {
              showNotification("کارتەکە نەدۆزرایەوە!", 'error');
         }
    },


    deleteShortcutRow: async function(rowId) {
        if (confirm('دڵنیایت دەتەوێت ئەم ڕیزە بسڕیتەوە؟ هەموو کارتەکانی ناویشی دەسڕێنەوە!')) {
            try {
                // Delete subcollection (cards) - Requires recursive deletion, best done via Cloud Function
                // For client-side, we just delete the row doc. Cards become orphaned.
                console.warn(`Deleting row ${rowId}. Subcollection 'cards' needs manual cleanup or a Cloud Function.`);
                await deleteDoc(doc(db, "shortcut_rows", rowId));
                showNotification('ڕیزەکە سڕدرایەوە (بەڵام کارتەکانی ماون - پێویستە بە Cloud Function بسڕدرێنەوە)', 'success');
                clearProductCache(); // Clear cache as home layout might change
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting shortcut row: ", error);
            }
        }
    },

    deleteShortcutCard: async function(rowId, cardId) {
         if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home layout might change
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting shortcut card: ", error);
            }
        }
    },

    updateShortcutCardCategoryDropdowns: function() {
        const categories = getCategories();
        if (!categories || categories.length <= 1) return; // Check if ready
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        const mainSelect = document.getElementById('shortcutCardMainCategory');
        if (!mainSelect) return;

        // Preserve selected value if possible
        const selectedValue = mainSelect.value;
        mainSelect.innerHTML = '<option value="">-- هەموو کاڵاکان --</option>'; // Default option
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name_ku_sorani;
            if (cat.id === selectedValue) {
                option.selected = true; // Restore selection
            }
            mainSelect.appendChild(option);
        });
    },

    // *** نوێکراوە: بۆ بانەرە ناوخۆییەکان ***
    renderInternalAdsAdminList: function() {
        const container = document.getElementById('internalAdsListContainer');
        const q = query(internalAdsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ بانەرێکی ناوخۆیی زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const ad = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'admin-notification-item'; // Reuse style
                item.innerHTML = `
                    <div class="admin-notification-details" style="align-items: center; display: flex;">
                        <img src="${ad.imageUrls.ku_sorani}" style="width: 60px; height: 30px; object-fit: cover; margin-left: 10px; border-radius: 4px; background: #eee;">
                        <div class="notification-title">${ad.name} ${ad.showOnHome ? '(لە سەرەکی پیشان دەدرێت)' : ''}</div>
                    </div>
                    <div>
                        <button class="edit-btn small-btn" data-id="${ad.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn" data-id="${ad.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                // Add listeners directly
                item.querySelector('.edit-btn').onclick = () => this.editInternalAd(ad);
                item.querySelector('.delete-btn').onclick = () => this.deleteInternalAd(ad.id);
                container.appendChild(item);
            });
        }, (error) => {
             console.error("Error listening to internal ads:", error);
             container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی بانەرەکان.</p>`;
        });
    },

    // *** نوێکراوە: بۆ بانەرە ناوخۆییەکان ***
    editInternalAd: async function(ad) {
        document.getElementById('editingInternalAdId').value = ad.id;
        document.getElementById('internalAdName').value = ad.name || '';
        document.getElementById('internalAdImageKuSorani').value = ad.imageUrls.ku_sorani || '';
        document.getElementById('internalAdImageKuBadini').value = ad.imageUrls.ku_badini || '';
        document.getElementById('internalAdImageAr').value = ad.imageUrls.ar || '';
        document.getElementById('internalAdLinkType').value = ad.linkType || 'none';
        document.getElementById('internalAdShowOnHome').checked = ad.showOnHome || false;
        document.getElementById('internalAdOrder').value = ad.order || 10;

        // Trigger change to populate dropdowns correctly
        const linkTypeSelect = document.getElementById('internalAdLinkType');
        linkTypeSelect.dispatchEvent(new Event('change'));

        // Use setTimeout to allow dropdown population before setting value
        setTimeout(() => {
            const targetSelect = document.getElementById('internalAdLinkTargetId');
            const subSubSelect = document.getElementById('internalAdLinkTargetIdSubSub');

            if (ad.linkType === 'mainCategory') {
                targetSelect.value = ad.linkTargetId || '';
                subSubSelect.style.display = 'none'; // Hide sub-sub for main category
            } else if (ad.linkType === 'subSubCategory' && ad.linkTargetId) {
                // linkTargetId should be the full path: "mainCat/subCat/subSubCat"
                const pathParts = ad.linkTargetId.split('/');
                if (pathParts.length === 3) {
                    const mainCatId = pathParts[0];
                    targetSelect.value = mainCatId; // Select the main category first
                    // Trigger change on main category select to load sub-sub options
                    targetSelect.dispatchEvent(new Event('change'));
                    // Need another delay for sub-sub options to load
                    setTimeout(() => {
                        subSubSelect.value = ad.linkTargetId; // Select the correct sub-sub option (which has the full path as value)
                         subSubSelect.style.display = 'block';
                    }, 600); // Increased delay
                } else {
                     console.warn("Invalid subSubCategory path:", ad.linkTargetId);
                     subSubSelect.style.display = 'none';
                }
            } else { // 'none' or invalid type
                targetSelect.value = '';
                subSubSelect.style.display = 'none';
            }
        }, 500); // Initial delay for main/subsub population logic

        document.getElementById('addInternalAdForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوەی بانەر';
        document.getElementById('cancelInternalAdEditBtn').style.display = 'block';
        document.getElementById('addInternalAdForm').scrollIntoView({ behavior: 'smooth' });
    },

    // *** نوێکراوە: بۆ بانەرە ناوخۆییەکان ***
    deleteInternalAd: async function(adId) {
        if (confirm('دڵنیایت دەتەوێت ئەم بانەرە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "internal_ads", adId));
                showNotification('بانەرەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as home layout might change
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting internal ad: ", error);
            }
        }
    },

    // *** نوێکراوە: بۆ بانەرە ناوخۆییەکان ***
    populateInternalAdTargetDropdown: async function(linkType) {
        const targetSelect = document.getElementById('internalAdLinkTargetId');
        const subSubSelect = document.getElementById('internalAdLinkTargetIdSubSub');
        const targetContainer = document.getElementById('internalAdTargetContainer');
        const targetLabel = document.getElementById('internalAdTargetLabel');

        // Reset state
        targetSelect.innerHTML = '<option value="" disabled selected>...بارکردن</option>';
        subSubSelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی لاوەکی هەڵبژێرە --</option>';
        subSubSelect.style.display = 'none';
        targetContainer.style.display = 'block';
        targetSelect.onchange = null; // Remove previous listener

        if (linkType === 'mainCategory') {
            targetLabel.textContent = 'جۆری سەرەکی هەڵبژێرە:';
            const categories = getCategories().filter(cat => cat.id !== 'all');
            targetSelect.innerHTML = '<option value="" disabled selected>-- جۆری سەرەکی هەڵبژێرە --</option>';
            categories.forEach(cat => {
                targetSelect.innerHTML += `<option value="${cat.id}">${cat.name_ku_sorani}</option>`;
            });
        } else if (linkType === 'subSubCategory') {
            targetLabel.textContent = 'جۆری سەرەکی هەڵبژێرە (بۆ دیاریکردنی جۆری وردتر):';
            const categories = getCategories().filter(cat => cat.id !== 'all');
            targetSelect.innerHTML = '<option value="" disabled selected>-- جۆری سەرەکی هەڵبژێرە --</option>';
            categories.forEach(cat => {
                targetSelect.innerHTML += `<option value="${cat.id}">${cat.name_ku_sorani}</option>`;
            });

            // Add listener to load sub-subcategories when main category is selected
            targetSelect.onchange = async (e) => {
                const mainCatId = e.target.value;
                subSubSelect.innerHTML = '<option value="" disabled selected>...بارکردن</option>';
                subSubSelect.style.display = 'block'; // Show sub-sub dropdown
                if (!mainCatId) {
                    subSubSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا جۆری سەرەکی هەڵبژێرە --</option>';
                    return;
                }
                try {
                    let subSubOptions = '<option value="" disabled selected>-- جۆری لاوەکی لاوەکی هەڵبژێرە --</option>';
                    const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                    const subCatSnapshot = await getDocs(subCatQuery);

                    if (!subCatSnapshot.empty) {
                        for (const subDoc of subCatSnapshot.docs) {
                            const subCatId = subDoc.id;
                            const subSubQuery = query(collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"), orderBy("order", "asc"));
                            const subSubSnapshot = await getDocs(subSubQuery);
                            subSubSnapshot.forEach(subSubDoc => {
                                const subSubCat = { id: subSubDoc.id, ...subSubDoc.data() };
                                const fullPath = `${mainCatId}/${subCatId}/${subSubCat.id}`; // Store the full path as the value
                                subSubOptions += `<option value="${fullPath}">${subDoc.data().name_ku_sorani} > ${subSubCat.name_ku_sorani}</option>`;
                            });
                        }
                    }

                    // Check if any sub-subcategories were found
                    if (subSubOptions === '<option value="" disabled selected>-- جۆری لاوەکی لاوەکی هەڵبژێرە --</option>') {
                         subSubSelect.innerHTML = '<option value="" disabled selected>هیچ جۆری وردتر نییە</option>';
                    } else {
                         subSubSelect.innerHTML = subSubOptions;
                    }

                } catch (error) {
                    console.error("Error fetching sub-subcategories for ad target:", error);
                    subSubSelect.innerHTML = '<option value="" disabled>هەڵە ڕوویدا</option>';
                }
            };
        } else { // linkType === 'none'
            targetContainer.style.display = 'none';
            targetSelect.innerHTML = ''; // Clear options
            subSubSelect.innerHTML = '';
        }
    },

    renderHomeLayoutAdmin: function() {
        const container = document.getElementById('homeLayoutListContainer');
        const q = query(homeLayoutCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = ''; // Clear previous items
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ بەشێک بۆ لاپەڕەی سەرەکی زیاد نەکراوە. کلیک لە "زیادکردنی بەش" بکە.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                const itemElement = document.createElement('div');
                itemElement.className = 'layout-item';
                itemElement.dataset.id = item.id;
                itemElement.draggable = true;

                // Safely access multi-language name
                const itemName = (item.name && typeof item.name === 'object')
                                 ? (item.name[getCurrentLanguage()] || item.name.ku_sorani || item.type) // Fallback to type
                                 : (item.name || item.type); // Fallback for old structure or missing name

                 let details = ''; // Add details for specific types
                 if (item.type === 'single_category_row' && item.categoryId) details = ` (جۆر: ${item.categoryId})`;
                 if (item.type === 'single_shortcut_row' && item.rowId) details = ` (ڕیز: ${item.rowId})`;
                 if (item.type === 'internal_ad' && item.adId) details = ` (بانەر: ${item.adId.substring(0,5)}...)`; // Show partial Ad ID

                itemElement.innerHTML = `
                    <div class="layout-item-info">
                        <i class="fas fa-grip-vertical drag-handle"></i>
                        <span>${itemName}${details}</span>
                    </div>
                    <div class="layout-item-actions">
                        <label class="switch">
                            <input type="checkbox" class="enabled-toggle" ${item.enabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <button class="delete-layout-item-btn delete-btn small-btn"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                container.appendChild(itemElement);

                // Add event listeners for this item
                 itemElement.addEventListener('dragstart', () => setTimeout(() => itemElement.classList.add('dragging'), 0));
                 itemElement.addEventListener('dragend', () => itemElement.classList.remove('dragging'));
                 itemElement.querySelector('.delete-layout-item-btn').addEventListener('click', () => this.deleteHomeLayoutItem(item.id));
                 itemElement.querySelector('.enabled-toggle').addEventListener('change', async (e) => {
                    // Update enabled status immediately when toggled
                    try {
                        await updateDoc(doc(db, 'home_layout', item.id), { enabled: e.target.checked });
                        showNotification('دۆخی پیشاندان نوێکرایەوە', 'success');
                        clearProductCache(); // Clear cache as layout changed
                    } catch (error) {
                        console.error("Error updating enabled status:", error);
                        showNotification('هەڵە لە نوێکردنەوەی دۆخ', 'error');
                        e.target.checked = !e.target.checked; // Revert checkbox on error
                    }
                });

            });

             // Add dragover listener to the container once
             if (!container.dataset.dragListenerAdded) {
                 container.addEventListener('dragover', e => {
                     e.preventDefault();
                     const afterElement = this.getDragAfterElement(container, e.clientY);
                     const dragging = document.querySelector('.dragging');
                     if (dragging) { // Ensure dragging element exists
                        if (afterElement == null) {
                            container.appendChild(dragging);
                        } else {
                            container.insertBefore(dragging, afterElement);
                        }
                     }
                 });
                 container.dataset.dragListenerAdded = 'true'; // Mark listener as added
             }

        }, (error) => {
             console.error("Error listening to home layout:", error);
             container.innerHTML = `<p style="text-align:center; color: var(--danger-color);">هەڵە لە وەرگرتنی ڕیزبەندی.</p>`;
        });
    },

    getDragAfterElement: function(container, y) {
        const draggableElements = [...container.querySelectorAll('.layout-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    deleteHomeLayoutItem: async function(itemId) {
        if (confirm('دڵنیایت دەتەوێت ئەم بەشە لە لاپەڕەی سەرەکی بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, 'home_layout', itemId));
                showNotification('بەشەکە سڕدرایەوە', 'success');
                clearProductCache(); // Clear cache as layout changed
            } catch (error) {
                console.error("Error deleting layout item:", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        }
    },

    saveHomeLayout: async function() {
        const container = document.getElementById('homeLayoutListContainer');
        const saveBtn = document.getElementById('saveLayoutBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '...پاشەکەوت دەکرێت';

        const items = container.querySelectorAll('.layout-item');
        const updatePromises = [];

        items.forEach((item, index) => {
            const docId = item.dataset.id;
            const newOrder = index + 1; // Order is based on current position
             // We don't need to read enabled state here, it's updated on toggle
            const docRef = doc(db, 'home_layout', docId);
            updatePromises.push(updateDoc(docRef, { order: newOrder })); // Only update order on save
        });

        try {
            await Promise.all(updatePromises);
            showNotification('ڕیزبەندی پەڕەی سەرەکی پاشەکەوت کرا', 'success');
            clearProductCache(); // Clear cache as layout changed
        } catch (error) {
            console.error("Error saving layout:", error);
            showNotification('هەڵەیەک لە پاشەکەوتکردن ڕوویدا', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    },

    // Main setup function for all admin event listeners
    setupAdminEventListeners: function() {
        // Prevent adding listeners multiple times
        if (this.listenersAttached) {
             console.warn("Admin listeners already attached.");
             return;
        }
        console.log("Attaching admin event listeners...");
        const self = this; // Use 'self' for clarity inside listeners

        // --- Product Form Listeners ---
        const addProductBtnElem = document.getElementById('addProductBtn');
        if (addProductBtnElem) {
            addProductBtnElem.onclick = () => {
                setEditingProductId(null);
                document.getElementById('productForm').reset();
                self.createProductImageInputs();
                document.getElementById('subcategorySelectContainer').style.display = 'none';
                document.getElementById('subSubcategorySelectContainer').style.display = 'none';
                document.getElementById('formTitle').textContent = 'زیادکردنی کاڵای نوێ';
                document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
                openPopup('productFormModal', 'modal');
            };
        }

        const productFormElem = document.getElementById('productForm');
        if (productFormElem) {
            productFormElem.onsubmit = async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...چاوەڕێ بە';
                const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
                if (imageUrls.length === 0) {
                    showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
                    submitButton.disabled = false;
                    submitButton.textContent = getEditingProductId() ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                    return;
                }

                const productNameKuSorani = document.getElementById('productNameKuSorani').value;
                const productData = {
                    name: {
                        ku_sorani: productNameKuSorani,
                        ku_badini: document.getElementById('productNameKuBadini').value,
                        ar: document.getElementById('productNameAr').value
                    },
                    searchableName: productNameKuSorani.toLowerCase(), // Use Sorani for search index
                    price: parseInt(document.getElementById('productPrice').value),
                    originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
                    categoryId: document.getElementById('productCategoryId').value,
                    subcategoryId: document.getElementById('productSubcategoryId').value || null,
                    subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                    description: {
                        ku_sorani: document.getElementById('productDescriptionKuSorani').value,
                        ku_badini: document.getElementById('productDescriptionKuBadini').value,
                        ar: document.getElementById('productDescriptionAr').value
                    },
                    imageUrls: imageUrls,
                    createdAt: Date.now(),
                    externalLink: document.getElementById('productExternalLink').value.trim() || null,
                    shippingInfo: {
                        ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim() || null,
                        ku_badini: document.getElementById('shippingInfoKuBadini').value.trim() || null,
                        ar: document.getElementById('shippingInfoAr').value.trim() || null
                    }
                };
                 // Remove null values from shippingInfo if all are null
                 if (!productData.shippingInfo.ku_sorani && !productData.shippingInfo.ku_badini && !productData.shippingInfo.ar) {
                     productData.shippingInfo = null;
                 }


                const editingId = getEditingProductId();
                try {
                    if (editingId) {
                         const { createdAt, ...updateData } = productData; // Don't update createdAt on edit
                         // Add updatedAt timestamp
                         updateData.updatedAt = Date.now();
                        await updateDoc(doc(db, "products", editingId), updateData);
                        showNotification('کاڵا نوێکرایەوە', 'success');
                    } else {
                        await addDoc(productsCollection, productData);
                        showNotification('کاڵا زیادکرا', 'success');
                    }
                    clearProductCache(); // Clear cache on add/edit
                    closeCurrentPopup();
                    searchProductsInFirestore(document.getElementById('searchInput').value, true); // Refresh list
                } catch (error) {
                    showNotification(t('error_generic'), 'error');
                    console.error("Error saving product:", error);
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = getEditingProductId() ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                    setEditingProductId(null); // Reset editing ID after submit
                }
            };
        }

        const productCatSelect = document.getElementById('productCategoryId');
        if(productCatSelect) {
             productCatSelect.addEventListener('change', (e) => {
                 self.populateSubcategoriesDropdown(e.target.value);
                 // Reset and hide sub-sub when main changes
                 self.populateSubSubcategoriesDropdown(null, null);
             });
        }

        const productSubCatSelect = document.getElementById('productSubcategoryId');
        if(productSubCatSelect) {
             productSubCatSelect.addEventListener('change', (e) => {
                 const mainCatId = document.getElementById('productCategoryId').value;
                 self.populateSubSubcategoriesDropdown(mainCatId, e.target.value);
             });
        }

        const imageInputsCont = document.getElementById('imageInputsContainer');
         if(imageInputsCont) {
             imageInputsCont.addEventListener('input', (e) => {
                 if (e.target.classList.contains('productImageUrl')) {
                     const previewImg = e.target.nextElementSibling;
                     const url = e.target.value.trim();
                     if (url && previewImg) {
                         previewImg.src = url;
                     } else if (previewImg) {
                         // Find index to show number
                         const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                         previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
                     }
                 }
             });
         }


        // --- Logout Listener ---
        const logoutBtn = document.getElementById('settingsLogoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                try {
                    await signOut(auth);
                    showNotification(t('logout_success'), 'success');
                     // Optionally redirect or just let onAuthStateChanged handle UI update
                     window.location.hash = ''; // Go back to main page view
                     showPage('mainPage'); // Switch view immediately
                } catch (error) {
                     console.error("Logout error:", error);
                     showNotification("هەڵە لە چوونەدەرەوە", 'error');
                }

            };
        }

        // --- Category Management Listeners ---
        const addCategoryFormElem = document.getElementById('addCategoryForm');
        if (addCategoryFormElem) {
            addCategoryFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';
                const categoryData = {
                    name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                    name_ar: document.getElementById('mainCategoryNameAr').value,
                    icon: document.getElementById('mainCategoryIcon').value.trim() || 'fas fa-folder', // Default icon
                    order: parseInt(document.getElementById('mainCategoryOrder').value) || 0
                };
                try {
                    await addDoc(categoriesCollection, categoryData);
                    showNotification('جۆری سەرەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addCategoryFormElem.reset();
                    clearProductCache(); // Clear cache as categories changed
                    self.renderCategoryManagementUI(); // Refresh list
                } catch (error) {
                    console.error("Error adding main category: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
                }
            });
        }

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
                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';
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
                    addSubcategoryFormElem.reset();
                    clearProductCache(); // Clear cache as categories changed
                    self.renderCategoryManagementUI(); // Refresh list
                } catch (error) {
                    console.error("Error adding subcategory: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
                }
            });
        }

        const addSubSubcategoryFormElem = document.getElementById('addSubSubcategoryForm');
        if (addSubSubcategoryFormElem) {
             const mainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
             const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');

             // Populate subcategories when main category changes
             mainCatSelect.addEventListener('change', async (e) => {
                const mainCatId = e.target.value;
                subCatSelect.innerHTML = '<option value="" disabled selected>...بارکردن</option>';
                subCatSelect.disabled = true;
                if (!mainCatId) {
                     subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                    return;
                }
                try {
                     const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                     const snapshot = await getDocs(subCatQuery);
                     subCatSelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
                     if (snapshot.empty) {
                         subCatSelect.innerHTML = '<option value="" disabled selected>هیچ جۆری لاوەکی نییە</option>';
                     } else {
                         snapshot.forEach(doc => {
                             const subcat = { id: doc.id, ...doc.data() };
                             subCatSelect.innerHTML += `<option value="${subcat.id}">${subcat.name_ku_sorani}</option>`;
                         });
                         subCatSelect.disabled = false;
                     }
                } catch(error) {
                     console.error("Error populating subcategories for sub-sub form:", error);
                     subCatSelect.innerHTML = '<option value="" disabled>هەڵە ڕوویدا</option>';
                }
             });


            addSubSubcategoryFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mainCatId = mainCatSelect.value;
                const subCatId = subCatSelect.value;
                if (!mainCatId || !subCatId) {
                    showNotification('تکایە هەردوو جۆری سەرەکی و لاوەکی هەڵبژێرە', 'error');
                    return;
                }
                 const submitButton = e.target.querySelector('button[type="submit"]');
                 submitButton.disabled = true;
                 submitButton.textContent = '...پاشەکەوت دەکرێت';

                const subSubcategoryData = {
                    name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subSubcategoryNameAr').value,
                    order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
                    createdAt: Date.now(),
                    imageUrl: document.getElementById('subSubcategoryImageUrl').value.trim() || null
                };
                try {
                    const subSubcategoriesRef = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
                    await addDoc(subSubcategoriesRef, subSubcategoryData);
                    showNotification('جۆری نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addSubSubcategoryFormElem.reset();
                    mainCatSelect.value = ''; // Reset dropdowns
                    subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                    subCatSelect.disabled = true;
                    clearProductCache(); // Clear cache as categories changed
                    self.renderCategoryManagementUI(); // Refresh list
                } catch (error) {
                    console.error("Error adding sub-subcategory: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                } finally {
                     submitButton.disabled = false;
                     submitButton.textContent = 'پاشەکەوتکردنی جۆری نوێ';
                }
            });
        }

        const editCategoryFormElem = document.getElementById('editCategoryForm');
        if (editCategoryFormElem) {
            editCategoryFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';
                const docPath = document.getElementById('editCategoryDocPath').value;
                const level = document.getElementById('editCategoryLevel').value;
                let updateData = {
                    name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('editCategoryNameKuBadini').value,
                    name_ar: document.getElementById('editCategoryNameAr').value,
                    order: parseInt(document.getElementById('editCategoryOrder').value) || 0
                };
                if (level === '1') {
                    updateData.icon = document.getElementById('editCategoryIcon').value.trim() || 'fas fa-folder';
                } else { // Level 2 or 3
                    updateData.imageUrl = document.getElementById('editCategoryImageUrl').value.trim() || null;
                }
                try {
                    await updateDoc(doc(db, docPath), updateData);
                    showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                    closeCurrentPopup();
                    clearProductCache(); // Clear cache as categories changed
                    self.renderCategoryManagementUI(); // Refresh list
                } catch (error) {
                    console.error("Error updating category: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
                }
            });
        }

        // --- Policies Listener ---
        const policiesFormElem = document.getElementById('policiesForm');
        if (policiesFormElem) {
            policiesFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                const policiesData = {
                    content: {
                        ku_sorani: document.getElementById('policiesContentKuSorani').value,
                        ku_badini: document.getElementById('policiesContentKuBadini').value,
                        ar: document.getElementById('policiesContentAr').value,
                    }
                };
                try {
                    const docRef = doc(db, "settings", "policies");
                    await setDoc(docRef, policiesData, { merge: true }); // Use setDoc with merge for single settings doc
                    showNotification(t('policies_saved_success'), 'success');
                } catch (error) {
                    console.error("Error saving policies:", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        // --- Announcement Listener ---
        const announcementFormElem = document.getElementById('announcementForm');
        if (announcementFormElem) {
            announcementFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...ناردن';
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
                    announcementFormElem.reset();
                } catch (error) {
                    console.error("Error sending announcement: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = t('send_announcement_button');
                }
            });
        }

        // --- Social Media Listeners ---
        const socialMediaToggleElem = document.getElementById('socialMediaToggle');
        if (socialMediaToggleElem) {
            socialMediaToggleElem.onclick = () => {
                const container = document.getElementById('adminSocialMediaManagement').querySelector('.contact-links-container');
                const chevron = socialMediaToggleElem.querySelector('.contact-chevron');
                container.classList.toggle('open');
                chevron.classList.toggle('open');
            };
        }
        const addSocialMediaFormElem = document.getElementById('addSocialMediaForm');
        if (addSocialMediaFormElem) {
            addSocialMediaFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                const socialData = {
                    name_ku_sorani: document.getElementById('socialNameKuSorani').value,
                    name_ku_badini: document.getElementById('socialNameKuBadini').value,
                    name_ar: document.getElementById('socialNameAr').value,
                    url: document.getElementById('socialUrl').value,
                    icon: document.getElementById('socialIcon').value.trim() || 'fas fa-link', // Default icon
                    createdAt: Date.now()
                };
                try {
                    const socialLinksRef = collection(db, 'settings', 'contactInfo', 'socialLinks');
                    await addDoc(socialLinksRef, socialData);
                    showNotification('لینک زیادکرا', 'success');
                    addSocialMediaFormElem.reset();
                } catch (error) {
                    showNotification(t('error_generic'), 'error');
                    console.error("Error adding social link:", error);
                } finally {
                     submitButton.disabled = false;
                }
            });
        }

        // --- Contact Methods Listeners ---
         const addContactMethodFormElem = document.getElementById('addContactMethodForm');
         if (addContactMethodFormElem) {
             addContactMethodFormElem.addEventListener('submit', async (e) => {
                 e.preventDefault();
                 const submitButton = e.target.querySelector('button[type="submit"]');
                 submitButton.disabled = true;
                 const methodData = {
                     type: document.getElementById('contactMethodType').value,
                     value: document.getElementById('contactMethodValue').value,
                     name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value,
                     name_ku_badini: document.getElementById('contactMethodNameKuBadini').value,
                     name_ar: document.getElementById('contactMethodNameAr').value,
                     icon: document.getElementById('contactMethodIcon').value.trim() || 'fas fa-phone', // Default
                     color: document.getElementById('contactMethodColor').value,
                     createdAt: Date.now()
                 };
                 try {
                     const methodsCollectionRef = collection(db, 'settings', 'contactInfo', 'contactMethods');
                     await addDoc(methodsCollectionRef, methodData);
                     showNotification('شێوازی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                     addContactMethodFormElem.reset();
                 } catch (error) {
                     console.error("Error adding contact method: ", error);
                     showNotification(t('error_generic'), 'error');
                 } finally {
                     submitButton.disabled = false;
                 }
             });
         }


        // --- Promo Cards (Slider) Listeners ---
        const addPromoCardFormElem = document.getElementById('addPromoCardForm');
        if(addPromoCardFormElem) {
            addPromoCardFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                const editingId = document.getElementById('editingPromoCardId').value;
                const cardData = {
                    imageUrls: {
                        ku_sorani: document.getElementById('promoCardImageKuSorani').value,
                        ku_badini: document.getElementById('promoCardImageKuBadini').value,
                        ar: document.getElementById('promoCardImageAr').value,
                    },
                    categoryId: document.getElementById('promoCardTargetCategory').value || null, // Allow null
                    order: parseInt(document.getElementById('promoCardOrder').value) || 0,
                    createdAt: editingId ? undefined : Date.now() // Don't update createdAt
                };
                 if (editingId) delete cardData.createdAt;

                try {
                    if (editingId) {
                        await setDoc(doc(db, "promo_cards", editingId), cardData, { merge: true }); // Use setDoc with merge
                        showNotification('سلایدەکە نوێکرایەوە', 'success');
                    } else {
                        await addDoc(promoCardsCollection, cardData);
                        showNotification('سلایدی نوێ زیادکرا', 'success');
                    }
                    addPromoCardFormElem.reset();
                    document.getElementById('editingPromoCardId').value = '';
                    submitButton.textContent = 'پاشەکەوتکردن';
                    clearProductCache(); // Clear cache as home layout might change
                } catch (error) {
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                    console.error("Error saving promo card:", error);
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        // --- Brands Listeners ---
        const addBrandFormElem = document.getElementById('addBrandForm');
        if (addBrandFormElem) {
            addBrandFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
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
                    order: parseInt(document.getElementById('brandOrder').value) || 0,
                    createdAt: editingId ? undefined : Date.now() // Don't update createdAt
                };
                 if (editingId) delete brandData.createdAt;

                try {
                    if (editingId) {
                        await setDoc(doc(db, "brands", editingId), brandData, { merge: true }); // Use setDoc with merge
                        showNotification('براند نوێکرایەوە', 'success');
                    } else {
                        await addDoc(brandsCollection, brandData);
                        showNotification('براندی نوێ زیادکرا', 'success');
                    }
                    addBrandFormElem.reset();
                    document.getElementById('editingBrandId').value = '';
                    document.getElementById('brandSubcategoryContainer').style.display = 'none'; // Hide subcat dropdown
                    submitButton.textContent = 'پاشەکەوتکردن';
                    clearProductCache(); // Clear cache as home layout might change
                } catch (error) {
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                    console.error("Error saving brand:", error);
                } finally {
                    submitButton.disabled = false;
                }
            });

            const brandMainCatSelect = document.getElementById('brandTargetMainCategory');
            brandMainCatSelect.addEventListener('change', async (e) => {
                const mainCatId = e.target.value;
                const brandSubCatContainer = document.getElementById('brandSubcategoryContainer');
                const brandSubCatSelect = document.getElementById('brandTargetSubcategory');
                brandSubCatSelect.innerHTML = ''; // Clear previous options
                if (mainCatId) {
                    brandSubCatContainer.style.display = 'block';
                    brandSubCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                    try {
                        const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                        const snapshot = await getDocs(subCatQuery);
                        brandSubCatSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>'; // Default
                        snapshot.forEach(doc => {
                            const subcat = { id: doc.id, ...doc.data() };
                            brandSubCatSelect.innerHTML += `<option value="${subcat.id}">${subcat.name_ku_sorani}</option>`;
                        });
                    } catch (error) {
                        console.error("Error loading subcategories for brand form:", error);
                        brandSubCatSelect.innerHTML = '<option value="">هەڵە!</option>';
                    }
                } else {
                    brandSubCatContainer.style.display = 'none';
                }
            });
        }

        // --- Shortcut Rows & Cards Listeners ---
        const addShortcutRowFormElem = document.getElementById('addShortcutRowForm');
        if(addShortcutRowFormElem) {
            addShortcutRowFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                 const submitButton = e.target.querySelector('button[type="submit"]');
                 submitButton.disabled = true;
                const editingId = document.getElementById('editingShortcutRowId').value;
                const rowData = {
                    title: {
                        ku_sorani: document.getElementById('shortcutRowTitleKuSorani').value,
                        ku_badini: document.getElementById('shortcutRowTitleKuBadini').value,
                        ar: document.getElementById('shortcutRowTitleAr').value,
                    },
                    order: parseInt(document.getElementById('shortcutRowOrder').value) || 0,
                    createdAt: editingId ? undefined : Date.now() // Don't update createdAt
                };
                 if (editingId) delete rowData.createdAt;

                try {
                    if (editingId) {
                        await setDoc(doc(db, "shortcut_rows", editingId), rowData, { merge: true });
                        showNotification('ڕیز نوێکرایەوە', 'success');
                    } else {
                        await addDoc(shortcutRowsCollection, rowData);
                        showNotification('ڕیزی نوێ زیادکرا', 'success');
                    }
                    addShortcutRowFormElem.reset();
                    document.getElementById('editingShortcutRowId').value = '';
                    document.getElementById('cancelRowEditBtn').style.display = 'none';
                    clearProductCache(); // Clear cache as home layout might change
                } catch (error) { console.error("Error saving row:", error); showNotification('هەڵەیەک ڕوویدا', 'error'); }
                finally { submitButton.disabled = false; }
            });
        }

        const cancelRowEditBtn = document.getElementById('cancelRowEditBtn');
         if(cancelRowEditBtn) {
             cancelRowEditBtn.addEventListener('click', () => {
                 document.getElementById('addShortcutRowForm').reset();
                 document.getElementById('editingShortcutRowId').value = '';
                 cancelRowEditBtn.style.display = 'none';
             });
         }


        const addCardToRowFormElem = document.getElementById('addCardToRowForm');
        if (addCardToRowFormElem) {
            addCardToRowFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const rowId = document.getElementById('selectRowForCard').value;
                if (!rowId) {
                    showNotification('تکایە ڕیزێک هەڵبژێرە', 'error');
                    return;
                }
                 const submitButton = e.target.querySelector('button[type="submit"]');
                 submitButton.disabled = true;
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
                    createdAt: editingId ? undefined : Date.now() // Don't update createdAt
                };
                if (editingId) delete cardData.createdAt;

                try {
                    const cardsCollectionRef = collection(db, "shortcut_rows", rowId, "cards");
                    if (editingId) {
                        await setDoc(doc(cardsCollectionRef, editingId), cardData, { merge: true });
                        showNotification('کارت نوێکرایەوە', 'success');
                    } else {
                        await addDoc(cardsCollectionRef, cardData);
                        showNotification('کارتی نوێ زیادکرا بۆ ڕیزەکە', 'success');
                    }
                    addCardToRowFormElem.reset(); // Reset form
                    document.getElementById('editingShortcutCardId').value = ''; // Clear editing ID
                    document.getElementById('selectRowForCard').disabled = false; // Re-enable row selection
                    document.getElementById('cancelCardEditBtn').style.display = 'none'; // Hide cancel button
                    addCardToRowFormElem.querySelector('button[type="submit"]').textContent = 'زیادکردنی کارت'; // Reset button text
                     // Reset category dropdowns
                     document.getElementById('shortcutCardMainCategory').value = '';
                     document.getElementById('shortcutCardSubContainer').style.display = 'none';
                     document.getElementById('shortcutCardSubSubContainer').style.display = 'none';
                    clearProductCache(); // Clear cache as home layout might change
                } catch (error) { console.error("Error saving card:", error); showNotification('هەڵەیەک ڕوویدا', 'error'); }
                finally { submitButton.disabled = false; }
            });
        }

         const cancelCardEditBtn = document.getElementById('cancelCardEditBtn');
         if(cancelCardEditBtn) {
             cancelCardEditBtn.addEventListener('click', () => {
                 document.getElementById('addCardToRowForm').reset();
                 document.getElementById('editingShortcutCardId').value = '';
                 document.getElementById('selectRowForCard').disabled = false;
                 cancelCardEditBtn.style.display = 'none';
                 document.getElementById('addCardToRowForm').querySelector('button[type="submit"]').textContent = 'زیادکردنی کارت';
                 // Reset category dropdowns visually
                 document.getElementById('shortcutCardMainCategory').value = '';
                 document.getElementById('shortcutCardSubContainer').style.display = 'none';
                 document.getElementById('shortcutCardSubSubContainer').style.display = 'none';

             });
         }


         const shortcutMainCatSelect = document.getElementById('shortcutCardMainCategory');
         if(shortcutMainCatSelect) {
             shortcutMainCatSelect.addEventListener('change', async (e) => {
                 const mainCatId = e.target.value;
                 const subContainer = document.getElementById('shortcutCardSubContainer');
                 const subSubContainer = document.getElementById('shortcutCardSubSubContainer');
                 const subSelect = document.getElementById('shortcutCardSubcategory');
                 const subSubSelect = document.getElementById('shortcutCardSubSubcategory');

                 // Reset sub-sub
                 subSubContainer.style.display = 'none';
                 subSubSelect.innerHTML = '';

                 if (mainCatId) {
                     subContainer.style.display = 'block';
                     subSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                     try {
                        const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                        const snapshot = await getDocs(subCatQuery);
                        subSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>';
                        snapshot.forEach(doc => {
                            const subcat = { id: doc.id, ...doc.data() };
                            subSelect.innerHTML += `<option value="${subcat.id}">${subcat.name_ku_sorani}</option>`;
                        });
                     } catch(error){
                         console.error("Error loading subcategories for shortcut card:", error);
                         subSelect.innerHTML = '<option value="">هەڵە!</option>';
                     }
                 } else {
                     subContainer.style.display = 'none';
                     subSelect.innerHTML = '';
                 }
             });
         }


         const shortcutSubCatSelect = document.getElementById('shortcutCardSubcategory');
         if (shortcutSubCatSelect) {
            shortcutSubCatSelect.addEventListener('change', async(e) => {
                const mainCatId = document.getElementById('shortcutCardMainCategory').value;
                const subCatId = e.target.value;
                const subSubContainer = document.getElementById('shortcutCardSubSubContainer');
                const subSubSelect = document.getElementById('shortcutCardSubSubcategory');

                subSubSelect.innerHTML = ''; // Clear previous

                if(mainCatId && subCatId) {
                    subSubContainer.style.display = 'block';
                    subSubSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                    try {
                        const subSubQuery = query(collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"), orderBy("order", "asc"));
                        const snapshot = await getDocs(subSubQuery);
                        subSubSelect.innerHTML = '<option value="">-- هەموو جۆرەکان --</option>';
                        snapshot.forEach(doc => {
                            const subSubCat = { id: doc.id, ...doc.data() };
                            subSubSelect.innerHTML += `<option value="${subSubCat.id}">${subSubCat.name_ku_sorani}</option>`;
                        });
                        if (subSubSelect.innerHTML === '<option value="">-- هەموو جۆرەکان --</option>') {
                            // If no sub-subs found, reflect that
                            subSubSelect.innerHTML = '<option value="" disabled>هیچ جۆری وردتر نییە</option>';
                        }
                    } catch(error){
                        console.error("Error loading sub-subcategories for shortcut card:", error);
                        subSubSelect.innerHTML = '<option value="">هەڵە!</option>';
                    }
                } else {
                    subSubContainer.style.display = 'none';
                }
            });
         }


        // --- Home Layout Listeners ---
        const saveLayoutBtn = document.getElementById('saveLayoutBtn');
        if(saveLayoutBtn) {
             saveLayoutBtn.addEventListener('click', () => self.saveHomeLayout());
        }

        const addHomeSectionBtn = document.getElementById('addHomeSectionBtn');
        if(addHomeSectionBtn) {
            addHomeSectionBtn.addEventListener('click', () => {
                document.getElementById('addHomeSectionForm').reset();
                document.getElementById('specificItemSelectContainer').style.display = 'none';
                openPopup('addHomeSectionModal', 'modal');
            });
        }

        const homeLayoutContainer = document.getElementById('homeLayoutListContainer');
        // Drag listeners are added dynamically in renderHomeLayoutAdmin
        // Add delegated listener for delete buttons within the container
        if(homeLayoutContainer) {
            homeLayoutContainer.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-layout-item-btn');
                if(deleteBtn) {
                    const itemId = deleteBtn.closest('.layout-item').dataset.id;
                    self.deleteHomeLayoutItem(itemId);
                }
                // Note: Toggle is handled directly in renderHomeLayoutAdmin
            });
        }


        const newSectionTypeSelect = document.getElementById('newSectionType');
        if (newSectionTypeSelect) {
            newSectionTypeSelect.addEventListener('change', async (e) => {
                const type = e.target.value;
                const container = document.getElementById('specificItemSelectContainer');
                const label = document.getElementById('specificItemLabel');
                const select = document.getElementById('specificItemId');

                container.style.display = 'none'; // Hide by default
                select.innerHTML = ''; // Clear previous options

                if (type === 'single_shortcut_row' || type === 'single_category_row' || type === 'internal_ad') {
                    container.style.display = 'block';
                    select.innerHTML = '<option value="">...بارکردن</option>';

                    if (type === 'single_shortcut_row') {
                        label.textContent = 'کام ڕیزی کورتکراوە؟';
                        const snapshot = await getDocs(query(shortcutRowsCollection, orderBy('title.ku_sorani')));
                        select.innerHTML = '<option value="" disabled selected>-- ڕیزێک هەڵبژێرە --</option>';
                        snapshot.forEach(doc => {
                            const row = doc.data();
                            select.innerHTML += `<option value="${doc.id}" data-name-ku-sorani="${row.title.ku_sorani}" data-name-ku-badini="${row.title.ku_badini}" data-name-ar="${row.title.ar}">${row.title.ku_sorani}</option>`;
                        });
                    } else if (type === 'single_category_row') {
                        label.textContent = 'کام جۆری کاڵا؟';
                        const categories = getCategories().filter(c => c.id !== 'all');
                        select.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
                        categories.forEach(cat => {
                            select.innerHTML += `<option value="${cat.id}" data-name-ku-sorani="${cat.name_ku_sorani}" data-name-ku-badini="${cat.name_ku_badini}" data-name-ar="${cat.name_ar}">${cat.name_ku_sorani}</option>`;
                        });
                    } else if (type === 'internal_ad') { // *** زیادکرا ***
                        label.textContent = 'کام بانەری ناوخۆیی؟';
                        // Fetch only ads marked for home page display
                        const adQuery = query(internalAdsCollection, where('showOnHome', '==', true), orderBy('name'));
                        const snapshot = await getDocs(adQuery);
                        select.innerHTML = '<option value="" disabled selected>-- بانەرێک هەڵبژێرە --</option>';
                        if (snapshot.empty) {
                             select.innerHTML = '<option value="" disabled selected>هیچ بانەرێک بۆ سەرەکی دیاری نەکراوە</option>';
                        } else {
                            snapshot.forEach(doc => {
                                const ad = doc.data();
                                // Store name attributes for potential use later, though the main name input is separate
                                select.innerHTML += `<option value="${doc.id}" data-name-ku-sorani="${ad.name}" data-name-ku-badini="${ad.name}" data-name-ar="${ad.name}">${ad.name}</option>`;
                            });
                        }
                    }
                }
            });
        }


        const addHomeSectionFormElem = document.getElementById('addHomeSectionForm');
        if (addHomeSectionFormElem) {
            addHomeSectionFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const type = document.getElementById('newSectionType').value;
                const nameInput = document.getElementById('newSectionName').value; // Name entered by admin
                const specificItemIdSelect = document.getElementById('specificItemId');
                const specificItemId = specificItemIdSelect.value;
                const selectedOption = specificItemIdSelect.options[specificItemIdSelect.selectedIndex];

                // Check if required specific item is selected
                if ((type === 'single_shortcut_row' || type === 'single_category_row' || type === 'internal_ad') && !specificItemId) {
                    showNotification('تکایە بەشێکی دیاریکراو هەڵبژێرە', 'error');
                    return;
                }

                 // Generate the name object, prioritizing selected item's name if available, fallback to input
                 const sectionNameObject = {
                     ku_sorani: nameInput,
                     ku_badini: nameInput, // Default to Sorani if specific not available
                     ar: nameInput        // Default to Sorani if specific not available
                 };
                 if (selectedOption && selectedOption.dataset.nameKuSorani) {
                      sectionNameObject.ku_sorani = selectedOption.dataset.nameKuSorani;
                      sectionNameObject.ku_badini = selectedOption.dataset.nameKuBadini || sectionNameObject.ku_sorani; // Fallback
                      sectionNameObject.ar = selectedOption.dataset.nameAr || sectionNameObject.ku_sorani; // Fallback
                 } else if (type !== 'promo_slider' && type !== 'brands' && type !== 'newest_products' && type !== 'all_products'){
                     // If it's a specific type but no option selected/data available, still use input name
                     console.log("Using input name as fallback for section name object.");
                 }


                 const submitButton = e.target.querySelector('button[type="submit"]');
                 submitButton.disabled = true;
                 submitButton.textContent = '...زیاد دەکرێت';

                try {
                    const q = query(homeLayoutCollection, orderBy('order', 'desc'), limit(1));
                    const lastDocSnap = await getDocs(q);
                    const lastOrder = lastDocSnap.empty ? 0 : lastDocSnap.docs[0].data().order;

                    const newSectionData = {
                        name: sectionNameObject, // Use the generated object
                        type,
                        order: lastOrder + 1,
                        enabled: true
                    };

                    // Add specific IDs based on type
                    if (type === 'single_shortcut_row') newSectionData.rowId = specificItemId;
                    if (type === 'single_category_row') newSectionData.categoryId = specificItemId;
                    if (type === 'internal_ad') newSectionData.adId = specificItemId; // *** زیادکرا ***

                    await addDoc(homeLayoutCollection, newSectionData);
                    showNotification('بەشی نوێ زیادکرا', 'success');
                    closeCurrentPopup();
                    clearProductCache(); // Clear cache as home layout changed
                } catch (error) {
                    console.error("Error adding new home section:", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                } finally {
                     submitButton.disabled = false;
                     submitButton.textContent = 'زیادکردن';
                }
            });
        }

        // --- Internal Ads Listeners ---
        const addInternalAdFormElem = document.getElementById('addInternalAdForm');
        if (addInternalAdFormElem) {
            addInternalAdFormElem.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;

                const editingId = document.getElementById('editingInternalAdId').value;
                const linkType = document.getElementById('internalAdLinkType').value;
                let targetId = null;

                const targetSelect = document.getElementById('internalAdLinkTargetId');
                const subSubSelect = document.getElementById('internalAdLinkTargetIdSubSub');

                if (linkType === 'mainCategory') {
                    targetId = targetSelect.value;
                } else if (linkType === 'subSubCategory') {
                    targetId = subSubSelect.value; // This holds the full path "main/sub/subsub" or empty
                }
                 // Validate targetId based on linkType
                if ((linkType === 'mainCategory' || linkType === 'subSubCategory') && !targetId) {
                    showNotification('تکایە جۆری دیاریکراو هەڵبژێرە (یان "هیچ" هەڵبژێرە ئەگەر بەستنەوەت ناوێت)', 'error');
                    submitButton.disabled = false;
                    return;
                }

                const adData = {
                    name: document.getElementById('internalAdName').value,
                    imageUrls: {
                        ku_sorani: document.getElementById('internalAdImageKuSorani').value,
                        ku_badini: document.getElementById('internalAdImageKuBadini').value,
                        ar: document.getElementById('internalAdImageAr').value,
                    },
                    linkType: linkType,
                    linkTargetId: targetId, // This is now correct (mainCatId, full path, or null)
                    showOnHome: document.getElementById('internalAdShowOnHome').checked,
                    order: parseInt(document.getElementById('internalAdOrder').value) || 0,
                    createdAt: editingId ? undefined : Date.now()
                };
                 if (editingId) delete adData.createdAt; // Don't update createdAt

                try {
                    if (editingId) {
                        await setDoc(doc(db, "internal_ads", editingId), adData, { merge: true });
                        showNotification('بانەر نوێکرایەوە', 'success');
                    } else {
                        await addDoc(internalAdsCollection, adData);
                        showNotification('بانەری نوێ زیادکرا', 'success');
                    }
                    addInternalAdFormElem.reset();
                    document.getElementById('editingInternalAdId').value = '';
                    document.getElementById('internalAdTargetContainer').style.display = 'none';
                    document.getElementById('internalAdLinkTargetIdSubSub').style.display = 'none';
                    document.getElementById('cancelInternalAdEditBtn').style.display = 'none';
                    addInternalAdFormElem.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردنی بانەر';
                    clearProductCache(); // Clear cache
                } catch (error) {
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                    console.error("Error saving internal ad:", error);
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        const internalAdLinkTypeSelectElem = document.getElementById('internalAdLinkType');
        if (internalAdLinkTypeSelectElem) {
            internalAdLinkTypeSelectElem.addEventListener('change', (e) => {
                // Use `this` to refer to AdminLogic object
                this.populateInternalAdTargetDropdown(e.target.value);
            });
        }

        const cancelInternalAdEditBtnElem = document.getElementById('cancelInternalAdEditBtn');
         if (cancelInternalAdEditBtnElem) {
             cancelInternalAdEditBtnElem.addEventListener('click', () => {
                 document.getElementById('addInternalAdForm').reset();
                 document.getElementById('editingInternalAdId').value = '';
                 document.getElementById('internalAdTargetContainer').style.display = 'none';
                 document.getElementById('internalAdLinkTargetIdSubSub').style.display = 'none';
                 cancelInternalAdEditBtnElem.style.display = 'none';
                 document.getElementById('addInternalAdForm').querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردنی بانەر';
             });
         }


        // Mark listeners as attached
        this.listenersAttached = true;
        console.log("Admin event listeners attached.");
    }

};

// Initialize admin logic if user is already admin on script load (e.g., page refresh)
if (sessionStorage.getItem('isAdmin') === 'true') {
    // Wait for globalAdminTools to be ready (if using modules, this might not be needed)
     if (window.globalAdminTools && window.globalAdminTools.db) {
         window.AdminLogic.initialize();
     } else {
         console.warn("globalAdminTools not ready immediately, delaying AdminLogic init.");
         // Fallback: Wait a bit. A more robust solution might use custom events.
         setTimeout(() => {
             if (window.globalAdminTools && window.globalAdminTools.db) {
                window.AdminLogic.initialize();
             } else {
                 console.error("Failed to initialize AdminLogic: globalAdminTools not available.");
             }
         }, 500);
     }
}