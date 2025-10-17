// فایلی admin.js (نوێکراوە)

// Access the shared tools from app.js
const { 
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache 
} = window.globalAdminTools;

const shortcutRowsCollection = collection(db, "shortcut_rows");

window.AdminLogic = {
    // This object will hold all admin-related functions and logic.

    initialize: function() {
        console.log("Admin logic initialized.");
        this.updateAdminUI(true);
        this.setupAdminEventListeners();
        this.loadPoliciesForAdmin();
        this.renderCategoryManagementUI();
        this.renderAdminAnnouncementsList();
        this.renderSocialMediaLinks();
        this.renderContactMethodsAdmin();
        this.updateAdminCategoryDropdowns();
        this.initializeHomepageManager(); // <-- This now controls the homepage sections
    },

    deinitialize: function() {
        console.log("Admin logic de-initialized.");
        this.updateAdminUI(false);
    },

    updateAdminUI: function(isAdmin) {
        document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

        const adminSections = [
            'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
            'adminCategoryManagement', 'adminContactMethodsManagement', 'adminHomepageManager' // <-- Updated this list
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
        this.createProductImageInputs(imageUrls);
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
            clearProductCache();
            searchProductsInFirestore(document.getElementById('searchInput').value, true);
        } catch (error) {
            showNotification(t('product_delete_error'), 'error');
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
            return;
        }

        productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        productSubcategorySelect.disabled = true;
        subcategorySelectContainer.style.display = 'block';

        try {
            const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
            const q = query(subcategoriesQuery, orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);

            productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';

            if (querySnapshot.empty) {
                productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
                document.getElementById('subSubcategorySelectContainer').style.display = 'none';
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
        container.style.display = 'block';

        try {
            const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
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
            } catch (e) {
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    renderAdminAnnouncementsList: function() {
        const container = document.getElementById('announcementsListContainer');
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
                return;
            }
            snapshot.forEach(doc => {
                const announcement = { id: doc.id, ...doc.data() };
                const title = (announcement.title && announcement.title.ku_sorani) || 'بێ ناونیشان';
                const item = document.createElement('div');
                item.className = 'admin-notification-item';
                item.innerHTML = `
                    <div class="admin-notification-details">
                        <div class="notification-title">${title}</div>
                    </div>
                    <button class="delete-btn"><i class="fas fa-trash"></i></button>
                `;
                item.querySelector('.delete-btn').addEventListener('click', () => this.deleteAnnouncement(announcement.id));
                container.appendChild(item);
            });
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
        const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            socialLinksListContainer.innerHTML = '';
            if (snapshot.empty) {
                socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const link = { id: doc.id, ...doc.data() };
                const name = link['name_' + getCurrentLanguage()] || link.name_ku_sorani;

                const item = document.createElement('div');
                item.className = 'social-link-item';
                item.innerHTML = `
                    <div class="item-info">
                        <i class="${link.icon}"></i>
                        <div class="item-details">
                            <span class="item-name">${name}</span>
                            <span class="item-value">${link.url}</span>
                        </div>
                    </div>
                    <button class="delete-btn"><i class="fas fa-trash"></i></button>
                `;

                item.querySelector('.delete-btn').onclick = () => this.deleteSocialMediaLink(link.id);
                socialLinksListContainer.appendChild(item);
            });
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
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const method = { id: doc.id, ...doc.data() };
                const name = method['name_' + getCurrentLanguage()] || method.name_ku_sorani;

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

                item.querySelector('.delete-btn').onclick = () => this.deleteContactMethod(method.id);
                container.appendChild(item);
            });
        });
    },
    
    renderCategoryManagementUI: async function() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

        let content = '';
        const mainCategoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
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

        container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';
        const self = this;
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => self.openEditCategoryModal(btn.dataset.path, btn.dataset.level));
        });
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => self.handleDeleteCategory(btn.dataset.path, btn.dataset.name));
        });
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
        } else {
            iconField.style.display = 'none';
            imageUrlField.style.display = 'block';
            document.getElementById('editCategoryImageUrl').value = category.imageUrl || '';
        }

        openPopup('editCategoryModal', 'modal');
    },

    handleDeleteCategory: async function(docPath, categoryName) {
        const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.`);
        if (confirmation) {
            try {
                // In a real app, you'd recursively delete subcollections. 
                await deleteDoc(doc(db, docPath));
                showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                console.error("Error deleting category: ", error);
                showNotification('هەڵەیەک ڕوویدا لە کاتی sڕینەوە', 'error');
            }
        }
    },

    updateAdminCategoryDropdowns: function() {
        const categories = getCategories();
        if (categories.length <= 1) return;
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

        const dropdowns = [
            { id: 'parentCategorySelect', defaultText: '-- جۆرێک هەڵبژێرە --' },
            { id: 'parentMainCategorySelectForSubSub', defaultText: '-- جۆرێک هەڵبژێرە --' },
        ];

        dropdowns.forEach(d => {
            const select = document.getElementById(d.id);
            if (select) {
                const firstOptionHTML = `<option value="">${d.defaultText}</option>`;
                select.innerHTML = firstOptionHTML;
                categoriesWithoutAll.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name_ku_sorani || cat.name_ku_badini;
                    select.appendChild(option);
                });
            }
        });
    },

    setupAdminEventListeners: function() {
        if (this.listenersAttached) return;

        const self = this;

        document.getElementById('addProductBtn').onclick = () => {
            setEditingProductId(null);
            document.getElementById('productForm').reset();
            self.createProductImageInputs();
            document.getElementById('subcategorySelectContainer').style.display = 'none';
            document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            document.getElementById('formTitle').textContent = 'زیادکردنی کاڵای نوێ';
            document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
            openPopup('productFormModal', 'modal');
        };

        document.getElementById('settingsLogoutBtn').onclick = async () => {
            await signOut(auth);
            showNotification(t('logout_success'), 'success');
        };

        document.getElementById('productCategoryId').addEventListener('change', (e) => {
            self.populateSubcategoriesDropdown(e.target.value);
            self.populateSubSubcategoriesDropdown(null, null);
        });

        document.getElementById('productSubcategoryId').addEventListener('change', (e) => {
            const mainCatId = document.getElementById('productCategoryId').value;
            self.populateSubSubcategoriesDropdown(mainCatId, e.target.value);
        });

        document.getElementById('productForm').onsubmit = async (e) => {
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

            const productDescriptionObject = {
                ku_sorani: document.getElementById('productDescriptionKuSorani').value,
                ku_badini: document.getElementById('productDescriptionKuBadini').value,
                ar: document.getElementById('productDescriptionAr').value
            };

            const productNameKuSorani = document.getElementById('productNameKuSorani').value;
            const productNameObject = {
                ku_sorani: productNameKuSorani,
                ku_badini: document.getElementById('productNameKuBadini').value,
                ar: document.getElementById('productNameAr').value
            };

            try {
                const productData = {
                    name: productNameObject,
                    searchableName: productNameKuSorani.toLowerCase(),
                    price: parseInt(document.getElementById('productPrice').value),
                    originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
                    categoryId: document.getElementById('productCategoryId').value,
                    subcategoryId: document.getElementById('productSubcategoryId').value || null,
                    subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                    description: productDescriptionObject,
                    imageUrls: imageUrls,
                    createdAt: Date.now(),
                    externalLink: document.getElementById('productExternalLink').value || null,
                    shippingInfo: {
                        ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                        ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                        ar: document.getElementById('shippingInfoAr').value.trim()
                    }
                };
                const editingId = getEditingProductId();
                if (editingId) {
                    const { createdAt, ...updateData } = productData;
                    await updateDoc(doc(db, "products", editingId), updateData);
                    showNotification('کاڵا نوێکرایەوە', 'success');
                } else {
                    await addDoc(productsCollection, productData);
                    showNotification('کاڵا زیادکرا', 'success');
                }
                clearProductCache();
                closeCurrentPopup();
                searchProductsInFirestore(document.getElementById('searchInput').value, true);
            } catch (error) {
                showNotification(t('error_generic'), 'error');
                console.error("Error saving product:", error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = getEditingProductId() ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                setEditingProductId(null);
            }
        };

        document.getElementById('imageInputsContainer').addEventListener('input', (e) => {
            if (e.target.classList.contains('productImageUrl')) {
                const previewImg = e.target.nextElementSibling;
                const url = e.target.value;
                if (url) { previewImg.src = url; } else {
                    const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                    previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
                }
            }
        });

        const addCategoryForm = document.getElementById('addCategoryForm');
        if (addCategoryForm) {
            addCategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';

                const categoryData = {
                    name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                    name_ar: document.getElementById('mainCategoryNameAr').value,
                    icon: document.getElementById('mainCategoryIcon').value,
                    order: parseInt(document.getElementById('mainCategoryOrder').value)
                };

                try {
                    await addDoc(categoriesCollection, categoryData);
                    showNotification('جۆری سەرەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addCategoryForm.reset();
                    clearProductCache();
                } catch (error) {
                    console.error("Error adding main category: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
                }
            });
        }

        const addSubcategoryForm = document.getElementById('addSubcategoryForm');
        if (addSubcategoryForm) {
            addSubcategoryForm.addEventListener('submit', async (e) => {
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
                    addSubcategoryForm.reset();
                    clearProductCache();
                } catch (error) {
                    console.error("Error adding subcategory: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
                }
            });
        }

        const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
        if (addSubSubcategoryForm) {
            addSubSubcategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
                const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
                const mainCatId = mainCatSelect.value;
                const subCatId = subCatSelect.value;

                if (!mainCatId || !subCatId) {
                    showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error');
                    return;
                }

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
                    addSubSubcategoryForm.reset();
                    mainCatSelect.value = '';
                    subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                    clearProductCache();
                } catch (error) {
                    console.error("Error adding sub-subcategory: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                }
            });
        }

        const editCategoryForm = document.getElementById('editCategoryForm');
        if (editCategoryForm) {
            editCategoryForm.addEventListener('submit', async (e) => {
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
                    updateData.icon = document.getElementById('editCategoryIcon').value;
                }

                if (level === '2' || level === '3') {
                    updateData.imageUrl = document.getElementById('editCategoryImageUrl').value.trim() || null;
                }

                try {
                    await updateDoc(doc(db, docPath), updateData);
                    showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                    closeCurrentPopup();
                    clearProductCache();
                } catch (error) {
                    console.error("Error updating category: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
                }
            });
        }

        const announcementForm = document.getElementById('announcementForm');
        if (announcementForm) {
            announcementForm.addEventListener('submit', async (e) => {
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
                    announcementForm.reset();
                } catch (error) {
                    console.error("Error sending announcement: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = t('send_announcement_button');
                }
            });
        }
        
        const policiesForm = document.getElementById('policiesForm');
        if (policiesForm) {
            policiesForm.addEventListener('submit', async (e) => {
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
                    await setDoc(docRef, policiesData, { merge: true });
                    showNotification(t('policies_saved_success'), 'success');
                } catch (error) {
                    console.error("Error saving policies:", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                }
            });
        }
        
        const socialMediaToggle = document.getElementById('socialMediaToggle');
        socialMediaToggle.onclick = () => {
            const container = document.getElementById('adminSocialMediaManagement').querySelector('.contact-links-container');
            const chevron = socialMediaToggle.querySelector('.contact-chevron');
            container.classList.toggle('open');
            chevron.classList.toggle('open');
        };
        
        const addSocialMediaForm = document.getElementById('addSocialMediaForm');
        addSocialMediaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const socialData = {
                name_ku_sorani: document.getElementById('socialNameKuSorani').value,
                name_ku_badini: document.getElementById('socialNameKuBadini').value,
                name_ar: document.getElementById('socialNameAr').value,
                url: document.getElementById('socialUrl').value,
                icon: document.getElementById('socialIcon').value,
                createdAt: Date.now()
            };
            try {
                const socialLinksRef = collection(db, 'settings', 'contactInfo', 'socialLinks');
                await addDoc(socialLinksRef, socialData);
                showNotification('لینک زیادکرا', 'success');
                addSocialMediaForm.reset();
            } catch (error) {
                showNotification(t('error_generic'), 'error');
            }
        });
        
        const addContactMethodForm = document.getElementById('addContactMethodForm');
        if (addContactMethodForm) {
            addContactMethodForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;

                const methodData = {
                    type: document.getElementById('contactMethodType').value,
                    value: document.getElementById('contactMethodValue').value,
                    name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value,
                    name_ku_badini: document.getElementById('contactMethodNameKuBadini').value,
                    name_ar: document.getElementById('contactMethodNameAr').value,
                    icon: document.getElementById('contactMethodIcon').value,
                    color: document.getElementById('contactMethodColor').value,
                    createdAt: Date.now()
                };

                try {
                    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
                    await addDoc(methodsCollection, methodData);
                    showNotification('شێوازی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addContactMethodForm.reset();
                } catch (error) {
                    console.error("Error adding contact method: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        this.listenersAttached = true;
    },

    initializeHomepageManager: function() {
        this.renderHomepageManagerUI();
        this.setupHomepageManagerEventListeners();
        document.getElementById('adminHomepageManager').style.display = 'block';
    },
    
    renderHomepageManagerUI: function() {
        const container = document.getElementById('homepageSectionsContainerAdmin');
        const q = query(collection(db, "homepage_sections"), orderBy("order", "asc"));
    
        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ بەشێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const section = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'admin-notification-item';
                item.dataset.id = section.id;
                item.innerHTML = `
                    <div class="admin-notification-details" style="display:flex; align-items:center; gap:10px;">
                        <i class="fas fa-grip-vertical" style="cursor: grab;"></i>
                        <span>
                            <strong>${section.title.ku_sorani || section.type}</strong> (ڕیز: <input type="number" class="section-order-input" value="${section.order}" style="width: 50px;">)
                        </span>
                    </div>
                    <div>
                        <button class="delete-section-btn delete-btn small-btn" data-id="${section.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                container.appendChild(item);
            });
        });
    },
    
    setupHomepageManagerEventListeners: function() {
        const self = this;
        const typeSelect = document.getElementById('newSectionType');
        const optionsContainer = document.getElementById('newSectionOptions');
    
        typeSelect.addEventListener('change', () => {
            const type = typeSelect.value;
            optionsContainer.innerHTML = ''; // Clear previous options
            let html = `
                <div class="form-group">
                    <label>ناونیشانی بەش (سۆرانی):</label>
                    <input type="text" name="title_ku_sorani" required>
                </div>
                <div class="form-group">
                    <label>ناونیشانی بەش (بادینی):</label>
                    <input type="text" name="title_ku_badini" required>
                </div>
                 <div class="form-group">
                    <label>ناونیشانی بەش (عربی):</label>
                    <input type="text" name="title_ar" required>
                </div>
                <div class="form-group">
                    <label>ژمارەی ڕیزبەندی:</label>
                    <input type="number" name="order" value="10" required>
                </div>
            `;
    
            if (type === 'category_row') {
                html += `
                    <div class="form-group">
                        <label>کام جۆری سەرەکی پیشان بدرێت؟</label>
                        <select name="categoryId" required>${getCategories().filter(c=>c.id !== 'all').map(c=>`<option value="${c.id}">${c.name_ku_sorani}</option>`).join('')}</select>
                    </div>
                `;
            } else if (type === 'shortcut_row') {
                 html += `
                    <div class="form-group">
                        <label>کام ڕیزی کارت پیشان بدرێت؟</label>
                        <select name="shortcutRowId" required id="shortcutRowSelectAdmin"></select>
                    </div>
                `;
                 // Populate this select dynamically
                setTimeout(() => {
                    const rowSelect = document.getElementById('shortcutRowSelectAdmin');
                    if (rowSelect) {
                        const q = query(collection(db, "shortcut_rows"), orderBy("order", "asc"));
                        getDocs(q).then(snapshot => {
                            snapshot.forEach(doc => {
                                const row = {id: doc.id, ...doc.data()};
                                rowSelect.innerHTML += `<option value="${row.id}">${row.title.ku_sorani}</option>`;
                            });
                        });
                    }
                }, 0);
            }
            
            optionsContainer.innerHTML = html;
        });
    
        // Save new section
        document.getElementById('addHomepageSectionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const data = {
                type: form.newSectionType.value,
                title: {
                    ku_sorani: form.title_ku_sorani.value,
                    ku_badini: form.title_ku_badini.value,
                    ar: form.title_ar.value,
                },
                order: parseInt(form.order.value),
                createdAt: Date.now()
            };
    
            if (data.type === 'category_row') data.categoryId = form.categoryId.value;
            if (data.type === 'shortcut_row') data.shortcutRowId = form.shortcutRowId.value;
    
            try {
                await addDoc(collection(db, "homepage_sections"), data);
                showNotification('بەشی نوێ زیادکرا', 'success');
                form.reset();
                optionsContainer.innerHTML = '';
                clearProductCache();
            } catch (error) {
                console.error(error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        });
    
        // Handle delete and order change
        document.getElementById('homepageSectionsContainerAdmin').addEventListener('change', async (e) => {
            if (e.target.classList.contains('section-order-input')) {
                const sectionId = e.target.closest('.admin-notification-item').dataset.id;
                const newOrder = parseInt(e.target.value);
                try {
                    await updateDoc(doc(db, "homepage_sections", sectionId), { order: newOrder });
                    showNotification('ڕیزبەندی نوێکرایەوە', 'success');
                    clearProductCache();
                } catch (error) {
                    showNotification('هەڵە لە نوێکردنەوەی ڕیزبەندی', 'error');
                }
            }
        });
    
         document.getElementById('homepageSectionsContainerAdmin').addEventListener('click', async (e) => {
            if (e.target.closest('.delete-section-btn')) {
                const sectionId = e.target.closest('.delete-section-btn').dataset.id;
                if(confirm('دڵنیایت دەتەوێت ئەم بەشە بسڕیتەوە؟')){
                    try {
                        await deleteDoc(doc(db, "homepage_sections", sectionId));
                        showNotification('بەشەکە سڕدرایەوە', 'success');
                        clearProductCache();
                    } catch(error) {
                        showNotification('هەڵە لە سڕینەوە', 'error');
                    }
                }
            }
        });
    }

};