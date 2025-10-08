// Import shared functions, variables, and modules from app.js
import { 
    db, auth, productsCollection, categoriesCollection, announcementsCollection,
    showNotification, t, openPopup, closeCurrentPopup, categories,
    formatDescription, searchProductsInFirestore, isAdmin
} from './app.js';

// Import needed Firestore functions for writing data
import { addDoc, doc, updateDoc, deleteDoc, setDoc, getDoc, collection, query, orderBy, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Admin-Only State & DOM Elements ---
let editingProductId = null;

const addProductBtn = document.getElementById('addProductBtn');
const productFormModal = document.getElementById('productFormModal');
const productForm = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const imageInputsContainer = document.getElementById('imageInputsContainer');
const productCategorySelect = document.getElementById('productCategoryId');
const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
const productSubcategorySelect = document.getElementById('productSubcategoryId');
const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer');
const productSubSubcategorySelect = document.getElementById('productSubSubcategoryId');
const addCategoryForm = document.getElementById('addCategoryForm');
const addSubcategoryForm = document.getElementById('addSubcategoryForm');
const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
const editCategoryForm = document.getElementById('editCategoryForm');
const announcementForm = document.getElementById('announcementForm');
const policiesForm = document.getElementById('policiesForm');
const addContactMethodForm = document.getElementById('addContactMethodForm');
const addSocialMediaForm = document.getElementById('addSocialMediaForm');
const socialMediaToggle = document.getElementById('socialMediaToggle');

// --- Admin-Only Functions ---

function createProductImageInputs(imageUrls = []) {
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

async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
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
}

async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
    if (!categoryId) {
        subcategorySelectContainer.style.display = 'none';
        subSubcategorySelectContainer.style.display = 'none';
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
            subSubcategorySelectContainer.style.display = 'none';
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
}

async function editProduct(productId) {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        showNotification(t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };

    editingProductId = productId;
    formTitle.textContent = 'دەستکاری کردنی کاڵا';
    productForm.reset();

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
    createProductImageInputs(imageUrls);
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

    await populateSubcategoriesDropdown(categoryId, product.subcategoryId);
    await populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);

    productForm.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    openPopup('productFormModal', 'modal');
}


async function deleteProduct(productId) {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        showNotification(t('product_deleted'), 'success');
        searchProductsInFirestore(document.getElementById('searchInput').value, true);
    } catch (error) {
        showNotification(t('product_delete_error'), 'error');
        console.error("Error deleting product:", error);
    }
}

function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_ku_sorani'] || cat.name;
        productCategorySelect.appendChild(option);
    });
}

async function renderCategoryManagementUI() {
    const container = document.getElementById('categoryListContainer');
    if (!container) return;
    container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

    onSnapshot(query(categoriesCollection, orderBy("order", "asc")), async () => {
        let content = '';
        const mainCategoriesSnapshot = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));

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

        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.path, btn.dataset.level));
        });
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteCategory(btn.dataset.path, btn.dataset.name));
        });
    });
}

async function openEditCategoryModal(docPath, level) {
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
    if (level === '1') {
        iconField.style.display = 'block';
        document.getElementById('editCategoryIcon').value = category.icon || '';
    } else {
        iconField.style.display = 'none';
    }

    openPopup('editCategoryModal', 'modal');
}

async function handleDeleteCategory(docPath, categoryName) {
    const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.`);
    if (confirmation) {
        try {
            // Firestore does not automatically delete subcollections, this requires more complex logic (e.g., a cloud function)
            // For the client, we just delete the document.
            await deleteDoc(doc(db, docPath));
            showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting category: ", error);
            showNotification('هەڵەیەک ڕوویدا لە کاتی سڕینەوە', 'error');
        }
    }
}

async function loadPoliciesForAdmin() {
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

function renderSocialMediaLinks() {
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        const socialLinksListContainer = document.getElementById('socialLinksListContainer');
        socialLinksListContainer.innerHTML = '';
        if (snapshot.empty) {
            socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const link = { id: doc.id, ...doc.data() };
            const name = link['name_ku_sorani'] || link.name_ku_sorani;

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
            const name = method['name_ku_sorani'] || method.name_ku_sorani;

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

async function deleteContactMethod(methodId) {
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
}

function populateParentCategorySelect() {
    const select = document.getElementById('parentCategorySelect');
    select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
    try {
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat['name_ku_sorani'] || cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating parent category select:", error);
        select.innerHTML = '<option value="">-- هەڵەیەک ڕوویدا --</option>';
    }
}

// --- Main Initialization function for the Admin Panel ---
export function initializeAdminPanel() {
    console.log("Admin Panel Initialized.");

    const adminSections = [
        'adminCategoryManagement', 'adminContactMethodsManagement', 'adminPoliciesManagement',
        'adminSocialMediaManagement', 'adminAnnouncementManagement'
    ];
    adminSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    });

    if (addProductBtn) {
        addProductBtn.onclick = () => {
            editingProductId = null;
            productForm.reset();
            createProductImageInputs();
            subcategorySelectContainer.style.display = 'none';
            subSubcategorySelectContainer.style.display = 'none';
            formTitle.textContent = 'زیادکردنی کاڵای نوێ';
            productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
            openPopup('productFormModal', 'modal');
        };
    }
    
    document.getElementById('productsContainer').addEventListener('click', (event) => {
        if (!isAdmin) return;
        const target = event.target;
        const productCard = target.closest('.product-card');
        if (!productCard) return;
        
        const productId = productCard.dataset.productId;
        if (!productId) return;

        if (target.closest('.edit-btn')) {
            editProduct(productId);
        } else if (target.closest('.delete-btn')) {
            deleteProduct(productId);
        }
    });

    if (productForm) {
        productForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...چاوەڕێ بە';
            const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
            if (imageUrls.length === 0) {
                showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
                submitButton.disabled = false;
                submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                return;
            }
            const productNameKuSorani = document.getElementById('productNameKuSorani').value;
            const productData = {
                name: {
                    ku_sorani: productNameKuSorani,
                    ku_badini: document.getElementById('productNameKuBadini').value,
                    ar: document.getElementById('productNameAr').value
                },
                searchableName: productNameKuSorani.toLowerCase(),
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
                updatedAt: Date.now(),
                externalLink: document.getElementById('productExternalLink').value || null,
                shippingInfo: {
                    ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                    ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                    ar: document.getElementById('shippingInfoAr').value.trim()
                }
            };
            try {
                if (editingProductId) {
                    await updateDoc(doc(db, "products", editingProductId), productData);
                    showNotification('کاڵا نوێکرایەوە', 'success');
                } else {
                    productData.createdAt = Date.now();
                    await addDoc(productsCollection, productData);
                    showNotification('کاڵا زیادکرا', 'success');
                }
                closeCurrentPopup();
                searchProductsInFirestore(document.getElementById('searchInput').value, true);
            } catch (error) {
                showNotification(t('error_generic'), 'error');
                console.error("Error saving product:", error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                editingProductId = null;
            }
        };
    }
    
    if(addCategoryForm) addCategoryForm.onsubmit = async (e) => {
        e.preventDefault();
        const categoryData = {
            name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
            name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
            name_ar: document.getElementById('mainCategoryNameAr').value,
            icon: document.getElementById('mainCategoryIcon').value,
            order: parseInt(document.getElementById('mainCategoryOrder').value)
        };
        try {
            await addDoc(categoriesCollection, categoryData);
            showNotification('جۆری سەرەکی زیادکرا', 'success');
            addCategoryForm.reset();
        } catch (error) { showNotification(t('error_generic'), 'error'); }
    };
    
    if(addSubcategoryForm) addSubcategoryForm.onsubmit = async (e) => {
        e.preventDefault();
        const parentCategoryId = document.getElementById('parentCategorySelect').value;
        if (!parentCategoryId) {
            showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error');
            return;
        }
        const subcategoryData = {
            name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value,
            name_ku_badini: document.getElementById('subcategoryNameKuBadini').value,
            name_ar: document.getElementById('subcategoryNameAr').value,
            order: parseInt(document.getElementById('subcategoryOrder').value) || 0
        };
        try {
            await addDoc(collection(db, "categories", parentCategoryId, "subcategories"), subcategoryData);
            showNotification('جۆری لاوەکی زیادکرا', 'success');
            addSubcategoryForm.reset();
        } catch (error) { showNotification(t('error_generic'), 'error'); }
    };
    
    if(addSubSubcategoryForm) addSubSubcategoryForm.onsubmit = async (e) => {
        e.preventDefault();
        const mainCatId = document.getElementById('parentMainCategorySelectForSubSub').value;
        const subCatId = document.getElementById('parentSubcategorySelectForSubSub').value;
        if (!mainCatId || !subCatId) {
            showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error');
            return;
        }
        const subSubcategoryData = {
            name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
            name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
            name_ar: document.getElementById('subSubcategoryNameAr').value,
            order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
        };
        try {
            await addDoc(collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"), subSubcategoryData);
            showNotification('جۆری نوێ زیادکرا', 'success');
            addSubSubcategoryForm.reset();
        } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
    };

    if(editCategoryForm) editCategoryForm.onsubmit = async (e) => {
        e.preventDefault();
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
        try {
            await updateDoc(doc(db, docPath), updateData);
            showNotification('گۆڕانکاری پاشەکەوت کرا', 'success');
            closeCurrentPopup();
        } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
    };
    
    if(announcementForm) announcementForm.onsubmit = async (e) => {
        e.preventDefault();
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
            showNotification('ئاگەداری نێردرا', 'success');
            announcementForm.reset();
        } catch (error) { showNotification(t('error_generic'), 'error'); }
    };
    
    if(policiesForm) policiesForm.onsubmit = async (e) => {
        e.preventDefault();
        const policiesData = {
            content: {
                ku_sorani: document.getElementById('policiesContentKuSorani').value,
                ku_badini: document.getElementById('policiesContentKuBadini').value,
                ar: document.getElementById('policiesContentAr').value,
            }
        };
        try {
            await setDoc(doc(db, "settings", "policies"), policiesData, { merge: true });
            showNotification(t('policies_saved_success'), 'success');
        } catch (error) { showNotification(t('error_generic'), 'error'); }
    };
    
    if(addContactMethodForm) addContactMethodForm.onsubmit = async (e) => {
        e.preventDefault();
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
            await addDoc(collection(db, 'settings', 'contactInfo', 'contactMethods'), methodData);
            showNotification('شێوازی نوێ زیادکرا', 'success');
            addContactMethodForm.reset();
        } catch (error) { showNotification(t('error_generic'), 'error'); }
    };

    if(addSocialMediaForm) addSocialMediaForm.onsubmit = async (e) => {
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
            await addDoc(collection(db, 'settings', 'contactInfo', 'socialLinks'), socialData);
            showNotification('لینکی سۆشیاڵ میدیا زیادکرا', 'success');
            addSocialMediaForm.reset();
        } catch (error) {
            console.error("Error adding social link:", error);
            showNotification(t('error_generic'), 'error');
        }
    };

    if (socialMediaToggle) {
        socialMediaToggle.onclick = () => {
            const container = document.getElementById('adminSocialMediaManagement').querySelector('.contact-links-container');
            const chevron = socialMediaToggle.querySelector('.contact-chevron');
            container.classList.toggle('open');
            chevron.classList.toggle('open');
        };
    }

    productCategorySelect.addEventListener('change', (e) => {
        populateSubcategoriesDropdown(e.target.value);
        populateSubSubcategoriesDropdown(null, null);
    });

    productSubcategorySelect.addEventListener('change', (e) => {
        const mainCatId = document.getElementById('productCategoryId').value;
        populateSubSubcategoriesDropdown(mainCatId, e.target.value);
    });

    // Run functions to populate admin UI
    renderCategoryManagementUI();
    renderAdminAnnouncementsList();
    loadPoliciesForAdmin();
    renderSocialMediaLinks();
    renderContactMethodsAdmin();
    populateCategoryDropdown();
    populateParentCategorySelect();
    
    const mainCatSelectForSubSub = document.getElementById('parentMainCategorySelectForSubSub');
    if (mainCatSelectForSubSub && !mainCatSelectForSubSub.listenerAttached) {
        mainCatSelectForSubSub.addEventListener('change', async () => {
            const mainCategoryId = mainCatSelectForSubSub.value;
            const subCatSelectForSubSub = document.getElementById('parentSubcategorySelectForSubSub');
            if (!mainCategoryId) {
                subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                return;
            };
            
            subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>...خەریکی بارکردنە</option>';
            subCatSelectForSubSub.disabled = true;

            const subcategoriesQuery = collection(db, "categories", mainCategoryId, "subcategories");
            const q = query(subcategoriesQuery, orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);
            
            subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    const subcat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    option.textContent = subcat.name_ku_sorani || subcat.name_ku_badini || 'بێ ناو';
                    subCatSelectForSubSub.appendChild(option);
                });
            } else {
                subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
            }
            subCatSelectForSubSub.disabled = false;
        });
        mainCatSelectForSubSub.listenerAttached = true;
    }
}