// scripts/admin.js

import { addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Dependencies passed from script.js
let db, productsCollection, categoriesCollection, announcementsCollection;
let showNotification, t, closeAllPopups, products, categories, currentLanguage;

// =======================================================
// فەنکشنەکانی تایبەت بە بەشی ئەدمین
// =======================================================

function createProductImageInputs(imageUrls = []) {
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
}

async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
    const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
    const productSubcategorySelect = document.getElementById('productSubcategoryId');

    if (!categoryId) {
        subcategorySelectContainer.style.display = 'none';
        return;
    }

    productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    productSubcategorySelect.disabled = true;
    subcategorySelectContainer.style.display = 'block';

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const querySnapshot = await getDocs(subcategoriesQuery);
        
        productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
        
        if (querySnapshot.empty) {
             productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
        } else {
            querySnapshot.docs.forEach(doc => {
                const subcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subcat.id;
                option.textContent = subcat.name_ku_sorani || subcat.id;
                if(subcat.id === selectedSubcategoryId) {
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
}

async function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) { showNotification(t('product_not_found_error'), 'error'); return; }
    
    closeAllPopups();

    const productFormModal = document.getElementById('productFormModal');
    const formTitle = document.getElementById('formTitle');
    const productForm = document.getElementById('productForm');

    window.editingProductId = productId;
    formTitle.textContent = 'دەستکاری کردنی کاڵا';
    productForm.reset();

    if (product.name && typeof product.name === 'object') {
        document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
        document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
        document.getElementById('productNameAr').value = product.name.ar || '';
    } else {
        document.getElementById('productNameKuSorani').value = product.name || '';
    }
    
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.originalPrice || '';
    
    const categoryId = product.categoryId || product.category;
    document.getElementById('productCategoryId').value = categoryId;
    
    await populateSubcategoriesDropdown(categoryId, product.subcategoryId);

    if (product.description) {
        document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
        document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
        document.getElementById('productDescriptionAr').value = product.description.ar || '';
    }

    const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
    createProductImageInputs(imageUrls);
    document.getElementById('productExternalLink').value = product.externalLink || '';
    productForm.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    productFormModal.style.display = 'block';
}

async function deleteProduct(productId) {   
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        showNotification(t('product_deleted'), 'success');
    } catch (error) {
        showNotification(t('product_delete_error'), 'error');
    }
}

async function deleteContactMethod(methodId) {
    if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
        try {
            const methodRef = doc(db, 'settings', 'contactInfo', 'contactMethods', methodId);
            await deleteDoc(methodRef);
            showNotification('شێوازەکە سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting contact method: ", error);
            showNotification('هەڵەیەک لە سڕینەوە ڕوویدا', 'error');
        }
    }
}

function renderContactMethodsAdmin() {
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
            const name = method['name_' + currentLanguage] || method.name_ku_sorani;
            
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
            
            item.querySelector('.delete-btn').onclick = () => deleteContactMethod(method.id);
            container.appendChild(item);
        });
    });
}

function populateParentCategorySelect() {
    const select = document.getElementById('parentCategorySelect');
    select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
    try {
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat['name_' + currentLanguage] || cat.name;   
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating parent category select:", error);
        select.innerHTML = '<option value="">-- هەڵەیەک ڕوویدا --</option>';
    }
}

async function deleteSocialMediaLink(linkId) {
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
}

function renderSocialMediaLinks() {
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
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;
            
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
            
            item.querySelector('.delete-btn').onclick = () => deleteSocialMediaLink(link.id);
            socialLinksListContainer.appendChild(item);
        });
    });
}

async function deleteAnnouncement(id) {
    if (confirm(t('announcement_delete_confirm'))) {
        try {
            await deleteDoc(doc(db, "announcements", id));
            showNotification(t('announcement_deleted_success'), 'success');
        } catch (e) {
            showNotification(t('error_generic'), 'error');
        }
    }
}

function renderAdminAnnouncementsList() {
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
            item.querySelector('.delete-btn').addEventListener('click', () => deleteAnnouncement(announcement.id));
            container.appendChild(item);
        });
    });
}


function setupAdminEventListeners() {
    const addProductBtn = document.getElementById('addProductBtn');
    const productFormModal = document.getElementById('productFormModal');
    const formTitle = document.getElementById('formTitle');
    const productForm = document.getElementById('productForm');
    const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');

    addProductBtn.onclick = () => {
        closeAllPopups();
        window.editingProductId = null;
        productForm.reset();
        createProductImageInputs();
        subcategorySelectContainer.style.display = 'none';
        formTitle.textContent = 'زیادکردنی کاڵای نوێ';
        productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
        productFormModal.style.display = 'block';
    };

    productForm.onsubmit = async (e) => {   
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '...چاوەڕێ بە';
        const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
        if (imageUrls.length === 0) {
            showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
            submitButton.disabled = false;
            submitButton.textContent = window.editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            return;
        }
        
        const productNameObject = {
            ku_sorani: document.getElementById('productNameKuSorani').value,
            ku_badini: document.getElementById('productNameKuBadini').value,
            ar: document.getElementById('productNameAr').value
        };

        const productDescriptionObject = {
            ku_sorani: document.getElementById('productDescriptionKuSorani').value,
            ku_badini: document.getElementById('productDescriptionKuBadini').value,
            ar: document.getElementById('productDescriptionAr').value
        };

        try {
            const productData = {   
                name: productNameObject,   
                price: parseInt(document.getElementById('productPrice').value),   
                originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,   
                categoryId: document.getElementById('productCategoryId').value,
                subcategoryId: document.getElementById('productSubcategoryId').value,
                description: productDescriptionObject,   
                imageUrls: imageUrls,   
                createdAt: Date.now(),   
                externalLink: document.getElementById('productExternalLink').value || null   
            };
            if (window.editingProductId) {
                const { createdAt, ...updateData } = productData;
                await updateDoc(doc(db, "products", window.editingProductId), updateData);
                showNotification('کاڵا نوێکرایەوە', 'success');
            } else {
                await addDoc(productsCollection, productData);
                showNotification('کاڵا زیادکرا', 'success');
            }
            closeAllPopups();
        } catch (error) {
            showNotification(t('error_generic'), 'error');
            console.error("Error saving product:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = window.editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            window.editingProductId = null;
        }
    };

    const imageInputsContainer = document.getElementById('imageInputsContainer');
    imageInputsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('productImageUrl')) {
            const previewImg = e.target.nextElementSibling;
            const url = e.target.value;
            if (url) { previewImg.src = url; }   
            else {
                const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
            }
        }
    });

    const productCategorySelect = document.getElementById('productCategoryId');
    productCategorySelect.addEventListener('change', (e) => {
        populateSubcategoriesDropdown(e.target.value);
    });

    const addCategoryForm = document.getElementById('addCategoryForm');
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const categoryData = {
                name: document.getElementById('mainCategoryNameKuBadini').value,
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
            };

            try {
                const subcategoriesCollectionRef = collection(db, "categories", parentCategoryId, "subcategories");
                await addDoc(subcategoriesCollectionRef, subcategoryData);
                showNotification('جۆری لاوەکی بە سەرکەوتوویی زیادکرا', 'success');
                addSubcategoryForm.reset();
            } catch (error) {
                console.error("Error adding subcategory: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
            }
        });
    }
    
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

    const addSocialMediaForm = document.getElementById('addSocialMediaForm');
    if (addSocialMediaForm) {
        addSocialMediaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const socialData = {
                name_ku_sorani: document.getElementById('socialNameKuSorani').value,
                name_ku_badini: document.getElementById('socialNameKuBadini').value,
                name_ar: document.getElementById('socialNameAr').value,
                url: document.getElementById('socialUrl').value,
                icon: document.getElementById('socialIcon').value,
                createdAt: Date.now()
            };

            try {
                const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
                await addDoc(socialLinksCollection, socialData);
                showNotification('لینک بە سەرکەوتوویی زیادکرا', 'success');
                addSocialMediaForm.reset();
            } catch (error) {
                console.error("Error adding social media link: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    const socialMediaToggle = document.getElementById('socialMediaToggle');
    socialMediaToggle.onclick = () => {
        const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
        const container = adminSocialMediaManagement.querySelector('.contact-links-container');
        const chevron = socialMediaToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    const announcementForm = document.getElementById('announcementForm');
    if (announcementForm) {
        announcementForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...د ناردنێ دایە';

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
                showNotification('ئاگەهداری ب سەرکەفتیانە هاتە ناردن', 'success');
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
    
    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
}


export function initializeAdmin(params) {
    db = params.db;
    productsCollection = params.productsCollection;
    categoriesCollection = params.categoriesCollection;
    announcementsCollection = params.announcementsCollection;
    showNotification = params.showNotification;
    t = params.t;
    closeAllPopups = params.closeAllPopups;
    products = params.products;
    categories = params.categories;
    currentLanguage = params.currentLanguage;

    setupAdminEventListeners();
    renderContactMethodsAdmin();
    renderSocialMediaLinks();
    renderAdminAnnouncementsList();
    populateParentCategorySelect();
}