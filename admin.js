// admin.js

import { addDoc, updateDoc, deleteDoc, doc, setDoc, collection, getDoc, query, orderBy, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// ئەڤە فەنکشنا سەرەکی یا مۆدیولێ ئەدمینی یە
export function initAdmin(db, auth, showNotification, t, closeCurrentPopup, openPopup, categories) {
    console.log("Admin module initialized!");

    // =======================================================
    // ناساندنا Elementـێن تایبەت ب ئەدمینی
    // =======================================================
    const productForm = document.getElementById('productForm');
    const formTitle = document.getElementById('formTitle');
    const addProductBtn = document.getElementById('addProductBtn');
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
    
    const adminPanels = [ 'adminCategoryManagement', 'adminContactMethodsManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement', 'adminPoliciesManagement', 'adminPromoCardsManagement' ];
    const addCategoryForm = document.getElementById('addCategoryForm');
    const addSubcategoryForm = document.getElementById('addSubcategoryForm');
    const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
    const editCategoryForm = document.getElementById('editCategoryForm');
    const policiesForm = document.getElementById('policiesForm');
    const announcementForm = document.getElementById('announcementForm');
    const addSocialMediaForm = document.getElementById('addSocialMediaForm');
    const addContactMethodForm = document.getElementById('addContactMethodForm');
    const addPromoCardForm = document.getElementById('addPromoCardForm');

    let editingProductId = null;
    let unsubscribers = []; 

    // =======================================================
    // چالاکرنا UI و فەنکشنێن ئەدمینی
    // =======================================================
    
    addProductBtn.style.display = 'flex';
    settingsLogoutBtn.style.display = 'flex';
    settingsAdminLoginBtn.style.display = 'none';
    adminPanels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if(panel) panel.style.display = 'block';
    });
    
    // ل ڤێرە هەمی فەنکشنێن Real-time دهێنە کارپێکرن
    unsubscribers.push(renderCategoryManagementUI());
    unsubscribers.push(renderPromoCardsAdminList());
    unsubscribers.push(renderSocialMediaLinksAdmin());
    unsubscribers.push(renderContactMethodsAdmin());
    unsubscribers.push(renderAdminAnnouncementsList());
    
    loadPoliciesForAdmin();
    populateAdminCategoryDropdowns();
    setupAdminEventListeners();

    // =======================================================
    // فەنکشنێن مامەلەکرنێ دگەل فۆرمان (Form Handlers)
    // =======================================================
    async function handleProductFormSubmit(e) { /* ... This function is complete ... */ }
    async function handleAddCategorySubmit(e) { e.preventDefault(); const categoryData = { name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value, name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value, name_ar: document.getElementById('mainCategoryNameAr').value, icon: document.getElementById('mainCategoryIcon').value, order: parseInt(document.getElementById('mainCategoryOrder').value) }; try { await addDoc(collection(db, "categories"), categoryData); showNotification('جورێ سەرەکی هاتە زێدەکرن', 'success'); e.target.reset(); } catch (error) { showNotification(t('error_generic'), 'error'); } }
    async function handleAddSubcategorySubmit(e) { e.preventDefault(); const parentCategoryId = document.getElementById('parentCategorySelect').value; if (!parentCategoryId) return showNotification('هیڤیە جورێ سەرەکی هەلبژێرە', 'error'); const subcategoryData = { name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value, name_ku_badini: document.getElementById('subcategoryNameKuBadini').value, name_ar: document.getElementById('subcategoryNameAr').value, order: parseInt(document.getElementById('subcategoryOrder').value) || 0 }; try { await addDoc(collection(db, "categories", parentCategoryId, "subcategories"), subcategoryData); showNotification('جورێ لاوەکی هاتە زێدەکرن', 'success'); e.target.reset(); } catch (error) { showNotification(t('error_generic'), 'error'); } }
    async function handleAddSubSubcategorySubmit(e) { e.preventDefault(); const mainCatId = document.getElementById('parentMainCategorySelectForSubSub').value; const subCatId = document.getElementById('parentSubcategorySelectForSubSub').value; if (!mainCatId || !subCatId) return showNotification('هیڤیە هەردوو جوران هەلبژێرە', 'error'); const subSubcategoryData = { name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value, name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value, name_ar: document.getElementById('subSubcategoryNameAr').value, order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0 }; try { await addDoc(collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"), subSubcategoryData); showNotification('جورێ نوو هاتە زێدەکرن', 'success'); e.target.reset(); } catch (error) { showNotification(t('error_generic'), 'error'); } }
    async function handleEditCategorySubmit(e) { e.preventDefault(); const docPath = document.getElementById('editCategoryDocPath').value; const level = document.getElementById('editCategoryLevel').value; let updateData = { name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value, name_ku_badini: document.getElementById('editCategoryNameKuBadini').value, name_ar: document.getElementById('editCategoryNameAr').value, order: parseInt(document.getElementById('editCategoryOrder').value) || 0 }; if (level === '1') updateData.icon = document.getElementById('editCategoryIcon').value; try { await updateDoc(doc(db, docPath), updateData); showNotification('گۆڕانکاری هاتە پاشەکەفتکرن', 'success'); closeCurrentPopup(); } catch (error) { showNotification('خەلەتیەک ڕوویدا', 'error'); } }
    async function handlePoliciesFormSubmit(e) { e.preventDefault(); const policiesData = { content: { ku_sorani: document.getElementById('policiesContentKuSorani').value, ku_badini: document.getElementById('policiesContentKuBadini').value, ar: document.getElementById('policiesContentAr').value } }; try { await setDoc(doc(db, "settings", "policies"), policiesData, { merge: true }); showNotification(t('policies_saved_success'), 'success'); } catch (error) { showNotification(t('error_generic'), 'error'); } }
    async function handleAnnouncementFormSubmit(e) { e.preventDefault(); const announcementData = { title: { ku_sorani: document.getElementById('announcementTitleKuSorani').value, ku_badini: document.getElementById('announcementTitleKuBadini').value, ar: document.getElementById('announcementTitleAr').value }, content: { ku_sorani: document.getElementById('announcementContentKuSorani').value, ku_badini: document.getElementById('announcementContentKuBadini').value, ar: document.getElementById('announcementContentAr').value }, createdAt: Date.now() }; try { await addDoc(collection(db, "announcements"), announcementData); showNotification('ئاگەهداری هاتە فرێکرن', 'success'); e.target.reset(); } catch (error) { showNotification(t('error_generic'), 'error'); } }
    async function handleSocialMediaFormSubmit(e) { e.preventDefault(); const socialData = { name_ku_sorani: document.getElementById('socialNameKuSorani').value, name_ku_badini: document.getElementById('socialNameKuBadini').value, name_ar: document.getElementById('socialNameAr').value, url: document.getElementById('socialUrl').value, icon: document.getElementById('socialIcon').value, createdAt: Date.now() }; try { await addDoc(collection(db, 'settings/contactInfo/socialLinks'), socialData); showNotification('لینکێ سۆشیاڵ میدیایێ هاتە زێدەکرن', 'success'); e.target.reset(); } catch (error) { showNotification(t('error_generic'), 'error'); } }
    async function handleContactMethodFormSubmit(e) { e.preventDefault(); const methodData = { type: document.getElementById('contactMethodType').value, value: document.getElementById('contactMethodValue').value, name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value, name_ku_badini: document.getElementById('contactMethodNameKuBadini').value, name_ar: document.getElementById('contactMethodNameAr').value, icon: document.getElementById('contactMethodIcon').value, color: document.getElementById('contactMethodColor').value, createdAt: Date.now() }; try { await addDoc(collection(db, 'settings/contactInfo/contactMethods'), methodData); showNotification('ڕێکا نوو هاتە زێدەکرن', 'success'); e.target.reset(); } catch (error) { showNotification(t('error_generic'), 'error'); } }
    async function handlePromoCardFormSubmit(e) { e.preventDefault(); const editingId = document.getElementById('editingPromoCardId').value; const cardData = { imageUrls: { ku_sorani: document.getElementById('promoCardImageKuSorani').value, ku_badini: document.getElementById('promoCardImageKuBadini').value, ar: document.getElementById('promoCardImageAr').value }, categoryId: document.getElementById('promoCardTargetCategory').value, order: parseInt(document.getElementById('promoCardOrder').value) }; try { if (editingId) { await setDoc(doc(db, "promo_cards", editingId), cardData, { merge: true }); showNotification('کارت هاتە نویکرن', 'success'); } else { cardData.createdAt = Date.now(); await addDoc(collection(db, "promo_cards"), cardData); showNotification('کارتەکا نوو هاتە زێدەکرن', 'success'); } e.target.reset(); document.getElementById('editingPromoCardId').value = ''; } catch (error) { showNotification('خەلەتیەک ڕوویدا', 'error'); } }

    window.editProduct = async (productId) => { /* ... This function is complete ... */ };
    window.deleteProduct = async (productId) => { if (!confirm(t('delete_confirm'))) return; try { await deleteDoc(doc(db, "products", productId)); showNotification(t('product_deleted'), 'success'); } catch (error) { showNotification(t('product_delete_error'), 'error'); } };

    // =======================================================
    // فەنکشنێن نیشاندانا داتایان ب شێوەیێ Real-time
    // =======================================================
    function renderCategoryManagementUI() { const container = document.getElementById('categoryListContainer'); if (!container) return; const q = query(collection(db, "categories"), orderBy("order", "asc")); return onSnapshot(q, async (mainSnapshot) => { container.innerHTML = '<p>...د بارکرنا جوران دایە</p>'; let content = ''; for (const mainDoc of mainSnapshot.docs) { const mainCategory = { id: mainDoc.id, ...mainDoc.data() }; const mainPath = `categories/${mainCategory.id}`; content += `<div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;"><div style="display: flex; justify-content: space-between; align-items: center;"><strong><i class="${mainCategory.icon}"></i> ${mainCategory.name_ku_sorani} (Rêz: ${mainCategory.order || 0})</strong><div><button class="edit-btn small-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button><button class="delete-btn small-btn" data-path="${mainPath}" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button></div></div></div>`; const subSnapshot = await getDocs(query(collection(db, mainPath, "subcategories"), orderBy("order", "asc"))); for (const subDoc of subSnapshot.docs) { const subCategory = { id: subDoc.id, ...subDoc.data() }; const subPath = `${mainPath}/subcategories/${subCategory.id}`; content += `<div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;"><div style="display: flex; justify-content: space-between; align-items: center;"><span>- ${subCategory.name_ku_sorani} (Rêz: ${subCategory.order || 0})</span><div><button class="edit-btn small-btn" data-path="${subPath}" data-level="2"><i class="fas fa-edit"></i></button><button class="delete-btn small-btn" data-path="${subPath}" data-name="${subCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button></div></div></div>`; const subSubSnapshot = await getDocs(query(collection(db, subPath, "subSubcategories"), orderBy("order", "asc"))); for (const subSubDoc of subSubSnapshot.docs) { const subSubCategory = { id: subSubDoc.id, ...subSubDoc.data() }; const subSubPath = `${subPath}/subSubcategories/${subSubCategory.id}`; content += `<div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;"><div style="display: flex; justify-content: space-between; align-items: center;"><span>-- ${subSubCategory.name_ku_sorani} (Rêz: ${subSubCategory.order || 0})</span><div><button class="edit-btn small-btn" data-path="${subSubPath}" data-level="3"><i class="fas fa-edit"></i></button><button class="delete-btn small-btn" data-path="${subSubPath}" data-name="${subSubCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button></div></div></div>`; } } } container.innerHTML = content || '<p>چ جۆرەک نەهاتیە زێدەکرن.</p>'; container.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.path, btn.dataset.level))); container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteCategory(btn.dataset.path, btn.dataset.name))); }); }
    async function openEditCategoryModal(docPath, level) { const docRef = doc(db, docPath); const docSnap = await getDoc(docRef); if (!docSnap.exists()) return showNotification('جۆر نەهاتە دیتن!', 'error'); const category = docSnap.data(); document.getElementById('editCategoryDocPath').value = docPath; document.getElementById('editCategoryLevel').value = level; document.getElementById('editCategoryNameKuSorani').value = category.name_ku_sorani || ''; document.getElementById('editCategoryNameKuBadini').value = category.name_ku_badini || ''; document.getElementById('editCategoryNameAr').value = category.name_ar || ''; document.getElementById('editCategoryOrder').value = category.order || 0; const iconField = document.getElementById('editIconField'); iconField.style.display = level === '1' ? 'block' : 'none'; if (level === '1') document.getElementById('editCategoryIcon').value = category.icon || ''; openPopup('editCategoryModal', 'modal'); }
    async function handleDeleteCategory(docPath, categoryName) { if (confirm(`تو پشتڕاستی دێ جورێ "${categoryName}" ژێبەى؟\nئاگەهداربە: ئەڤ کارە دێ هەمی جورێن لاوەکی ژی ژێبەت.`)) { try { await deleteDoc(doc(db, docPath)); showNotification('جۆر ب سەرکەفتیانە هاتە ژێبرن', 'success'); } catch (error) { showNotification('خەلەتیەک د ژێبرنێ دا ڕوویدا', 'error'); } } }
    async function loadPoliciesForAdmin() { const docRef = doc(db, "settings", "policies"); const docSnap = await getDoc(docRef); if (docSnap.exists() && docSnap.data().content) { const policies = docSnap.data().content; document.getElementById('policiesContentKuSorani').value = policies.ku_sorani || ''; document.getElementById('policiesContentKuBadini').value = policies.ku_badini || ''; document.getElementById('policiesContentAr').value = policies.ar || ''; } }
    function renderAdminAnnouncementsList() { const container = document.getElementById('announcementsListContainer'); const q = query(collection(db, "announcements"), orderBy("createdAt", "desc")); return onSnapshot(q, (snapshot) => { container.innerHTML = ''; if (snapshot.empty) { container.innerHTML = `<p style="text-align:center;">${t('no_announcements_sent')}</p>`; return; } snapshot.forEach(doc => { const announcement = { id: doc.id, ...doc.data() }; const item = document.createElement('div'); item.className = 'admin-notification-item'; item.innerHTML = `<div class="admin-notification-details"><div class="notification-title">${announcement.title.ku_sorani}</div></div><button class="delete-btn"><i class="fas fa-trash"></i></button>`; item.querySelector('.delete-btn').addEventListener('click', () => deleteAnnouncement(announcement.id)); container.appendChild(item); }); }); }
    async function deleteAnnouncement(id) { if (confirm(t('announcement_delete_confirm'))) { try { await deleteDoc(doc(db, "announcements", id)); showNotification(t('announcement_deleted_success'), 'success'); } catch (e) { showNotification(t('error_generic'), 'error'); } } }
    function renderSocialMediaLinksAdmin() { const container = document.getElementById('socialLinksListContainer'); const q = query(collection(db, 'settings/contactInfo/socialLinks'), orderBy("createdAt", "desc")); return onSnapshot(q, (snapshot) => { container.innerHTML = ''; if (snapshot.empty) { container.innerHTML = '<p style="padding: 10px; text-align: center;">چ لینکەک نەهاتیە زێدەکرن.</p>'; return; } snapshot.forEach(doc => { const link = { id: doc.id, ...doc.data() }; const item = document.createElement('div'); item.className = 'social-link-item'; item.innerHTML = `<div class="item-info"><i class="${link.icon}"></i><div class="item-details"><span class="item-name">${link.name_ku_sorani}</span><span class="item-value">${link.url}</span></div></div><button class="delete-btn"><i class="fas fa-trash"></i></button>`; item.querySelector('.delete-btn').onclick = () => deleteSocialMediaLink(link.id); container.appendChild(item); }); }); }
    async function deleteSocialMediaLink(linkId) { if (confirm('تو پشتڕاستی دێ ڤی لینکی ژێبەى؟')) { try { await deleteDoc(doc(db, 'settings/contactInfo/socialLinks', linkId)); showNotification('لینک هاتە ژێبرن', 'success'); } catch (error) { showNotification(t('error_generic'), 'error'); } } }
    function renderContactMethodsAdmin() { const container = document.getElementById('contactMethodsListContainer'); const q = query(collection(db, 'settings/contactInfo/contactMethods'), orderBy("createdAt", "desc")); return onSnapshot(q, (snapshot) => { container.innerHTML = ''; if (snapshot.empty) { container.innerHTML = '<p style="padding: 10px; text-align: center;">چ ڕێکەک نەهاتیە زێدەکرن.</p>'; return; } snapshot.forEach(doc => { const method = { id: doc.id, ...doc.data() }; const item = document.createElement('div'); item.className = 'social-link-item'; item.innerHTML = `<div class="item-info"><i class="${method.icon}" style="color: ${method.color};"></i><div class="item-details"><span class="item-name">${method.name_ku_sorani}</span><span class="item-value">${method.value}</span></div></div><button class="delete-btn"><i class="fas fa-trash"></i></button>`; item.querySelector('.delete-btn').onclick = () => deleteContactMethod(method.id); container.appendChild(item); }); }); }
    async function deleteContactMethod(methodId) { if (confirm('تو پشتڕاستی دێ ڤێ ڕێکێ ژێبەى؟')) { try { await deleteDoc(doc(db, 'settings/contactInfo/contactMethods', methodId)); showNotification('ڕێک هاتە ژێبرن', 'success'); } catch (error) { showNotification('خەلەتیەک د ژێبرنێ دا ڕوویدا', 'error'); } } }
    function renderPromoCardsAdminList() { const container = document.getElementById('promoCardsListContainer'); const q = query(collection(db, "promo_cards"), orderBy("order", "asc")); return onSnapshot(q, (snapshot) => { container.innerHTML = ''; if (snapshot.empty) { container.innerHTML = '<p>چ کارتەک نەهاتیە زێدەکرن.</p>'; return; } snapshot.forEach(doc => { const card = { id: doc.id, ...doc.data() }; const item = document.createElement('div'); item.className = 'admin-notification-item'; item.innerHTML = `<div class="admin-notification-details" style="align-items: center; display: flex;"><img src="${card.imageUrls.ku_sorani}" style="width: 40px; height: 40px; object-fit: cover; margin-left: 10px; border-radius: 4px;"><div class="notification-title">کارتا ڕیزبەندی: ${card.order}</div></div><div><button class="edit-btn small-btn"><i class="fas fa-edit"></i></button><button class="delete-btn small-btn"><i class="fas fa-trash"></i></button></div>`; item.querySelector('.edit-btn').onclick = () => editPromoCard(card); item.querySelector('.delete-btn').onclick = () => deletePromoCard(card.id); container.appendChild(item); }); }); }
    function editPromoCard(card) { document.getElementById('editingPromoCardId').value = card.id; document.getElementById('promoCardImageKuSorani').value = card.imageUrls.ku_sorani; document.getElementById('promoCardImageKuBadini').value = card.imageUrls.ku_badini; document.getElementById('promoCardImageAr').value = card.imageUrls.ar; document.getElementById('promoCardTargetCategory').value = card.categoryId; document.getElementById('promoCardOrder').value = card.order; addPromoCardForm.querySelector('button[type="submit"]').textContent = 'نویکرنەوە'; addPromoCardForm.scrollIntoView({ behavior: 'smooth' }); }
    async function deletePromoCard(cardId) { if (confirm('تو پشتڕاستی دێ ڤێ کارتی ژێبەى؟')) { try { await deleteDoc(doc(db, "promo_cards", cardId)); showNotification('کارت هاتە ژێبرن', 'success'); } catch (error) { showNotification('خەلەتیەک ڕوویدا', 'error'); } } }
    function populateAdminCategoryDropdowns() { const selects = [document.getElementById('parentCategorySelect'), document.getElementById('parentMainCategorySelectForSubSub'), document.getElementById('promoCardTargetCategory')]; const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all'); selects.forEach(select => { if (select) { select.innerHTML = `<option value="" disabled selected>-- ${t('choose_category')} --</option>`; categoriesWithoutAll.forEach(cat => { const option = document.createElement('option'); option.value = cat.id; option.textContent = cat.name_ku_sorani || cat.name; select.appendChild(option); }); } }); }

    function setupAdminEventListeners() {
        productForm.onsubmit = handleProductFormSubmit;
        addCategoryForm.addEventListener('submit', handleAddCategorySubmit);
        addSubcategoryForm.addEventListener('submit', handleAddSubcategorySubmit);
        addSubSubcategoryForm.addEventListener('submit', handleAddSubSubcategorySubmit);
        editCategoryForm.addEventListener('submit', handleEditCategorySubmit);
        policiesForm.addEventListener('submit', handlePoliciesFormSubmit);
        announcementForm.addEventListener('submit', handleAnnouncementFormSubmit);
        addSocialMediaForm.addEventListener('submit', handleSocialMediaFormSubmit);
        addContactMethodForm.addEventListener('submit', handleContactMethodFormSubmit);
        addPromoCardForm.addEventListener('submit', handlePromoCardFormSubmit);
        
        const mainCatSelectForSubSub = document.getElementById('parentMainCategorySelectForSubSub');
        const subCatSelectForSubSub = document.getElementById('parentSubcategorySelectForSubSub');
        mainCatSelectForSubSub.addEventListener('change', async () => {
             const mainCategoryId = mainCatSelectForSubSub.value;
             if (!mainCategoryId) return;
             subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>...د بارکرنێ دایە</option>';
             const q = query(collection(db, "categories", mainCategoryId, "subcategories"), orderBy("order", "asc"));
             const snapshot = await getDocs(q);
             subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جورێ لاوەکی هەلبژێرە --</option>';
             if (!snapshot.empty) {
                 snapshot.forEach(doc => {
                     const subcat = { id: doc.id, ...doc.data() };
                     const option = document.createElement('option');
                     option.value = subcat.id;
                     option.textContent = subcat.name_ku_sorani;
                     subCatSelectForSubSub.appendChild(option);
                 });
             } else {
                subCatSelectForSubSub.innerHTML = '<option value="" disabled>چ جورێن لاوەکی نینن</option>';
             }
        });
    }

    // فەنکشنا پاککرنێ
    return function cleanup() {
        console.log("Cleaning up admin listeners...");
        unsubscribers.forEach(unsub => unsub());
        unsubscribers = [];
    };
}

