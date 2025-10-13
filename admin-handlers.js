import { t, showNotification } from './utils.js';
import { db, productsCollection, announcementsCollection, currentLanguage, categories, promoCardsCollection, searchProductsInFirestore, renderMainCategories, renderSubcategories, renderSubSubcategories, setGlobalState } from './app.js';
import { openPopup, closeAllPopupsUI } from './ui-handlers.js';
import {
    doc, deleteDoc, updateDoc, getDoc, collection, query, orderBy, getDocs, addDoc, setDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// DOM Elements
const addProductBtn = document.getElementById('addProductBtn');
const productFormModal = document.getElementById('productFormModal');
const productForm = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const imageInputsContainer = document.getElementById('imageInputsContainer');
const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer');
const productCategorySelect = document.getElementById('productCategoryId');
const productSubcategorySelect = document.getElementById('productSubcategoryId');
const productSubSubcategorySelect = document.getElementById('productSubSubcategoryId');
const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
const adminCategoryManagement = document.getElementById('adminCategoryManagement');
const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
const announcementsListContainer = document.getElementById('announcementsListContainer');
const socialLinksListContainer = document.getElementById('socialLinksListContainer');
const contactMethodsListContainer = document.getElementById('contactMethodsListContainer');
const adminPromoCardsManagement = document.getElementById('adminPromoCardsManagement');


// =======================================================
// Product Management
// =======================================================

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
    const container = subSubcategorySelectContainer;
    const select = productSubSubcategorySelect;

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

export async function editProduct(productId) {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        showNotification(t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };

    setGlobalState('editingProductId', productId);
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


export async function deleteProduct(productId) {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        showNotification(t('product_deleted'), 'success');
        searchProductsInFirestore(window.currentSearch, true); // Use global state
    } catch (error) {
        showNotification(t('product_delete_error'), 'error');
    }
}

// =======================================================
// Admin UI and Management
// =======================================================

export function updateAdminUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

    if (adminPoliciesManagement) {
        adminPoliciesManagement.style.display = isAdmin ? 'block' : 'none';
    }
    if (adminSocialMediaManagement) adminSocialMediaManagement.style.display = isAdmin ? 'block' : 'none';
    if (adminAnnouncementManagement) {
        adminAnnouncementManagement.style.display = isAdmin ? 'block' : 'none';
        if (isAdmin) renderAdminAnnouncementsList();
    }
    if (adminPromoCardsManagement) {
        adminPromoCardsManagement.style.display = isAdmin ? 'block' : 'none';
        if (isAdmin) {
            renderPromoCardsAdminList();
            const select = document.getElementById('promoCardTargetCategory');
            select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
            const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
            categoriesWithoutAll.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name_ku_sorani || cat.name_ku_badini;
                select.appendChild(option);
            });
        }
    }

    if (isAdmin) {
        settingsLogoutBtn.style.display = 'flex';
        settingsAdminLoginBtn.style.display = 'none';
        addProductBtn.style.display = 'flex';
        if (adminCategoryManagement) {
            adminCategoryManagement.style.display = 'block';
            renderCategoryManagementUI();
        }
        if (document.getElementById('adminContactMethodsManagement')) {
            document.getElementById('adminContactMethodsManagement').style.display = 'block';
            renderContactMethodsAdmin();
        }
    } else {
        settingsLogoutBtn.style.display = 'none';
        settingsAdminLoginBtn.style.display = 'flex';
        addProductBtn.style.display = 'none';
        if (adminCategoryManagement) {
            adminCategoryManagement.style.display = 'none';
        }
        if (document.getElementById('adminContactMethodsManagement')) {
            document.getElementById('adminContactMethodsManagement').style.display = 'none';
        }
    }
}

export async function loadPoliciesForAdmin() {
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

export async function deleteAnnouncement(id) {
    if (confirm(t('announcement_delete_confirm'))) {
        try {
            await deleteDoc(doc(db, "announcements", id));
            showNotification(t('announcement_deleted_success'), 'success');
        } catch (e) {
            showNotification(t('error_generic'), 'error');
        }
    }
}

export function renderAdminAnnouncementsList() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        announcementsListContainer.innerHTML = '';
        if (snapshot.empty) {
            announcementsListContainer.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
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
            announcementsListContainer.appendChild(item);
        });
    });
}

export async function deleteContactMethod(methodId) {
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

export function renderContactMethodsAdmin() {
    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        contactMethodsListContainer.innerHTML = '';
        if (snapshot.empty) {
            contactMethodsListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
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
                <button class="delete-btn" data-id="${method.id}"><i class="fas fa-trash"></i></button>
            `;

            item.querySelector('.delete-btn').onclick = () => deleteContactMethod(method.id);
            contactMethodsListContainer.appendChild(item);
        });
    });
}

export async function deleteSocialMediaLink(linkId) {
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

export function renderSocialMediaLinksAdmin() {
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
                <button class="delete-btn" data-id="${link.id}"><i class="fas fa-trash"></i></button>
            `;

            item.querySelector('.delete-btn').onclick = () => deleteSocialMediaLink(link.id);
            socialLinksListContainer.appendChild(item);
        });
    });
}

export function renderPromoCardsAdminList() {
    const container = document.getElementById('promoCardsListContainer');
    const q = query(promoCardsCollection, orderBy("order", "asc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ کاردێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const card = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'admin-notification-item';
            item.innerHTML = `
                <div class="admin-notification-details" style="align-items: center; display: flex;">
                    <img src="${card.imageUrls.ku_sorani}" style="width: 40px; height: 40px; object-fit: cover; margin-left: 10px; border-radius: 4px;">
                    <div class="notification-title">کارتی ڕیزبەندی: ${card.order}</div>
                </div>
                <div>
                    <button class="edit-btn small-btn" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn small-btn" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            item.querySelector('.edit-btn').onclick = () => editPromoCard(card);
            item.querySelector('.delete-btn').onclick = () => deletePromoCard(card.id);
            container.appendChild(item);
        });
    });
}

function editPromoCard(card) {
    document.getElementById('editingPromoCardId').value = card.id;
    document.getElementById('promoCardImageKuSorani').value = card.imageUrls.ku_sorani;
    document.getElementById('promoCardImageKuBadini').value = card.imageUrls.ku_badini;
    document.getElementById('promoCardImageAr').value = card.imageUrls.ar;
    document.getElementById('promoCardTargetCategory').value = card.categoryId;
    document.getElementById('promoCardOrder').value = card.order;
    document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';

    document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth' });
}

async function deletePromoCard(cardId) {
    if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
        try {
            await deleteDoc(doc(db, "promo_cards", cardId));
            showNotification('کارتەکە سڕدرایەوە', 'success');
        } catch (error) {
            showNotification('هەڵەیەک ڕوویدا', 'error');
        }
    }
}

export async function renderCategoryManagementUI() {
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

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.path, btn.dataset.level));
    });
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteCategory(btn.dataset.path, btn.dataset.name));
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
            await deleteDoc(doc(db, docPath));
            showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting category: ", error);
            showNotification('هەڵەیەک ڕوویدا لە کاتی سڕینەوە', 'error');
        }
    }
}