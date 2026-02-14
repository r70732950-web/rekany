// --- 1. FIREBASE SETUP & IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, setDoc,
    query, where, getDocs, writeBatch, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsdBBTuCA0cQL8QtJkSPYy8N_Dmr3K_bI",
  authDomain: "maten-tv.firebaseapp.com",
  projectId: "maten-tv",
  storageBucket: "maten-tv.firebasestorage.app",
  messagingSenderId: "196479152493",
  appId: "1:196479152493:web:82860b7f878a47b731ea64",
  measurementId: "G-0BB5EY6TNW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const channelsCollection = collection(db, "channels");
const categoriesCollection = collection(db, "categories");
const reportsCollection = collection(db, "reports"); 
const codesCollection = collection(db, "codes");

// --- 2. GLOBAL VARIABLES ---
let channels = [];
let categories = [];
let isAdmin = false;
let userSubscription = null;
let editingId = null;
let overlayTimer = null;
let showOnlyFavorites = false;
let isPipMode = false;
let currentPlayingId = null; 

// --- DEVICE ID SETUP ---
let deviceId = localStorage.getItem('maten_device_id');
if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem('maten_device_id', deviceId);
}

// Variables for PiP Dragging
let isDragging = false;
let currentX; let currentY; let initialX; let initialY; let xOffset = 0; let yOffset = 0;

// DOM Elements
const mainContainer = document.getElementById('mainContainer');
const loginModal = document.getElementById('loginModal');
const channelModal = document.getElementById('channelFormModal');
const categoryModal = document.getElementById('categoryModal');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoContainer = document.getElementById('videoContainer'); 
const relatedBar = document.getElementById('relatedChannels');
const favFilterBtn = document.getElementById('favFilterBtn');
const homeBtn = document.getElementById('homeBtn');
const categorySelect = document.getElementById('channelCategory');
const scoreModal = document.getElementById('scoreModal'); 
const scoreFrame = document.getElementById('scoreFrame'); 
const errorScreen = document.getElementById('errorScreen'); 
const loaderScreen = document.getElementById('videoLoader');
const reportsModal = document.getElementById('reportsModal'); 
const reportsList = document.getElementById('reportsList'); 

// --- 3. TOAST NOTIFICATION SYSTEM ---
window.showToast = (msg, type = 'success') => {
    const box = document.getElementById('toast-box');
    const toast = document.createElement('div');
    
    let iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-times-circle';
    if (type === 'info') iconClass = 'fa-info-circle';
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${msg}</span>`;
    
    box.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
};

// --- 4. FAVORITES SYSTEM ---
function getLocalFavorites() {
    const stored = localStorage.getItem('maten_tv_favs');
    return stored ? JSON.parse(stored) : [];
}
function setLocalFavorites(favArray) {
    localStorage.setItem('maten_tv_favs', JSON.stringify(favArray));
}

// --- 5. AUTHENTICATION & SUBSCRIPTION LOGIC ---
async function checkLocalSubscription() {
    const savedCode = localStorage.getItem('maten_pro_code');
    if (savedCode) {
        const q = query(codesCollection, where("code", "==", savedCode));
        try {
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                const now = new Date();
                
                if (data.usedBy === deviceId && new Date(data.expiryDate) > now) {
                    userSubscription = data;
                    console.log("Pro Active");
                } else {
                    localStorage.removeItem('maten_pro_code');
                    userSubscription = null;
                }
            }
        } catch (e) { console.error("Error checking sub", e); }
    }
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
}
checkLocalSubscription();

onAuthStateChanged(auth, (user) => {
    if (user) {
        isAdmin = true;
        document.body.classList.add('admin-mode');
        toggleAdminUI(true);
        showToast("بەخێربێیت ئەدمین", "success");
    } else {
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        toggleAdminUI(false);
    }
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 6. DATA LISTENERS ---
onSnapshot(categoriesCollection, (snapshot) => {
    categories = [];
    snapshot.docs.forEach(doc => { categories.push({ id: doc.id, ...doc.data() }); });
    categories.sort((a, b) => a.order - b.order);
    updateCategoryDropdown();
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

onSnapshot(channelsCollection, (snapshot) => {
    channels = [];
    snapshot.docs.forEach(doc => { channels.push({ ...doc.data(), id: doc.id }); });
    
    // Sort Logic
    channels.sort((a, b) => {
        let orderA = (a.order !== undefined && a.order !== null && a.order !== "") ? parseInt(a.order) : 9999;
        let orderB = (b.order !== undefined && b.order !== null && b.order !== "") ? parseInt(b.order) : 9999;
        
        if (orderA === orderB) {
            return (a.name > b.name) ? 1 : -1;
        }
        return orderA - orderB;
    });

    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 7. RENDER LOGIC ---
window.renderApp = (searchQuery = '') => {
    if (channels.length === 0 && categories.length === 0 && !isAdmin) return;
    
    mainContainer.innerHTML = ''; 
    const localFavs = getLocalFavorites();

    let displayChannels = channels.map(channel => {
        return {
            ...channel,
            isFavorite: localFavs.includes(channel.id)
        };
    });

    if(searchQuery) {
        displayChannels = displayChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
    }

    if(showOnlyFavorites) {
        displayChannels = displayChannels.filter(c => c.isFavorite);
        if(displayChannels.length === 0) {
             mainContainer.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#a0aec0;"><p>هیچ کەناڵێکی دڵخواز نییە</p></div>`;
             return;
        }
        const section = createSectionHTML('favorites', '❤️ دڵخوازەکان', displayChannels);
        mainContainer.appendChild(section);
        return; 
    }

    if(displayChannels.length === 0) {
        mainContainer.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#a0aec0;"><p>هیچ کەناڵێک نەدۆزرایەوە</p></div>`;
        return;
    }

    categories.forEach(cat => {
        let catChannels = displayChannels.filter(c => c.category === cat.id);
        if(catChannels.length === 0 && !isAdmin) return;
        mainContainer.appendChild(createSectionHTML(cat.id, cat.title, catChannels));
    });
};

function createSectionHTML(catId, catTitle, catChannels) {
    const section = document.createElement('div');
    section.className = 'category-section';
    section.id = `section-container-${catId}`;
    
    if (catChannels.length === 0) {
        section.innerHTML = `<div class="section-header" style="border-bottom:none;"><div class="section-title" style="opacity:0.6;">${catTitle} (بەتاڵ)</div></div>`;
        return section;
    }
    
    const limit = 9; 
    const hasMore = catChannels.length > limit;
    
    let headerBtn = '';
    if (hasMore) {
        headerBtn = `
            <button class="header-more-btn" onclick="toggleCategoryFocus('${catId}', this)" data-state="collapsed">
                زیاتر ببینە <i class="fas fa-angle-left"></i>
            </button>
        `;
    }

    let gridHTML = `<div class="products-container" id="grid-${catId}">`;
    
    catChannels.forEach((ch, index) => {
        const isExtra = index >= limit;
        const extraClass = isExtra ? 'extra-channel' : '';
        const extraStyle = isExtra ? 'style="display:none;"' : '';
        gridHTML += createCardHTML(ch, extraClass, extraStyle);
    });
    
    gridHTML += `</div>`;
    
    section.innerHTML = `
        <div class="section-header">
            <div class="section-title">${catTitle}</div>
            ${headerBtn}
        </div>
        ${gridHTML}
    `;
    
    return section;
}

window.toggleCategoryFocus = (catId, btn) => {
    const currentSection = document.getElementById(`section-container-${catId}`);
    const currentGrid = document.getElementById(`grid-${catId}`);
    const extraItems = currentGrid.querySelectorAll('.extra-channel');
    const allSections = document.querySelectorAll('.category-section');
    const currentState = btn.getAttribute('data-state');

    if (currentState === 'collapsed') {
        allSections.forEach(sec => {
            if (sec.id !== `section-container-${catId}`) {
                sec.style.display = 'none';
            }
        });

        extraItems.forEach(item => {
            item.style.display = 'block';
            item.style.animation = "fadeIn 0.5s";
        });

        btn.innerHTML = `گەڕانەوە <i class="fas fa-times"></i>`;
        btn.classList.add('active-focus-btn');
        btn.setAttribute('data-state', 'expanded');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } else {
        allSections.forEach(sec => {
            sec.style.display = 'block';
        });

        extraItems.forEach(item => {
            item.style.display = 'none';
        });

        btn.innerHTML = `زیاتر ببینە <i class="fas fa-angle-left"></i>`;
        btn.classList.remove('active-focus-btn');
        btn.setAttribute('data-state', 'collapsed');
    }
};

function createCardHTML(ch, extraClass = '', extraStyle = '') {
    const isLocked = (ch.isPro === true && !isAdmin && !userSubscription);

    const adminControls = isAdmin ? `
        <div class="admin-controls">
            <button class="edit-btn" onclick="event.stopPropagation(); editChannel('${ch.id}')"><i class="fas fa-pen"></i></button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteChannel('${ch.id}')"><i class="fas fa-trash"></i></button>
        </div>` : '';
    
    const favClass = ch.isFavorite ? 'active' : '';
    const img = ch.image || "https://placehold.co/200?text=TV";
    const clickAction = isLocked ? "showToast('ئەم کەناڵە بۆ بەشداربووانە', 'error'); openLoginModal();" : `playChannel('${ch.id}')`;

    const lockOverlay = isLocked ? `
        <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; z-index:20; backdrop-filter:blur(2px);">
            <i class="fas fa-lock" style="font-size:28px; margin-bottom:8px; color:#f6ad55;"></i>
            <span style="font-size:12px; font-weight:bold;">VIP</span>
        </div>
    ` : '';

    const proBadge = ch.isPro ? `<span style="position:absolute; top:8px; right:8px; background:linear-gradient(45deg, #f6ad55, #ed8936); color:white; font-size:10px; padding:3px 8px; border-radius:6px; font-weight:bold; z-index:15; box-shadow:0 2px 4px rgba(0,0,0,0.2);">PRO</span>` : '';

    return `<div class="product-card ${extraClass}" ${extraStyle} onclick="${clickAction}">
            ${lockOverlay}
            ${proBadge}
            <div class="fav-btn ${favClass}" onclick="toggleFavorite('${ch.id}', event)"><i class="fas fa-heart"></i></div>
            <img src="${img}" class="product-image" loading="lazy" onerror="this.src='https://placehold.co/200?text=Error'">
            ${adminControls}</div>`;
}

// --- 8. PLAYER LOGIC ---
window.playChannel = (id) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;
    
    if (channel.isPro && !isAdmin && !userSubscription) {
        showToast("تکایە کۆد داخڵ بکە", "error");
        openLoginModal();
        return;
    }

    currentPlayingId = id;
    errorScreen.style.display = 'none';
    loaderScreen.style.display = 'flex';
    playerModal.style.display = 'block';
    if(isPipMode) togglePipMode(); 

    videoPlayer.src = ""; 

    if (Hls.isSupported()) {
        if(window.hls) window.hls.destroy(); 
        
        const hlsConfig = {
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            startFragPrefetch: true, 
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            maxBufferLength: 30, 
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 2,
        };

        const hls = new Hls(hlsConfig);
        hls.loadSource(channel.url); 
        hls.attachMedia(videoPlayer);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => { 
            var playPromise = videoPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.log("Autoplay blocked/waiting"));
            }
        });
        
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR: handleStreamError(channel); break;
                    case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); handleStreamError(channel); break;
                    default: hls.destroy(); handleStreamError(channel); break;
                }
            }
        });
        window.hls = hls;
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.url; 
        videoPlayer.play();
        videoPlayer.onerror = () => { handleStreamError(channel); };
    }
    
    renderRelated(channel); 
    triggerOverlay();
};

videoPlayer.onplaying = () => { loaderScreen.style.display = 'none'; };
videoPlayer.onwaiting = () => { loaderScreen.style.display = 'flex'; };

function handleStreamError(channel) {
    if (currentPlayingId !== channel.id) return;
    videoPlayer.pause();
    loaderScreen.style.display = 'none';
    errorScreen.style.display = 'flex';
    reportBrokenChannel(channel);
}

// --- 9. STEALTH LOGIN & USER STATUS & LOGOUT ---
window.openLoginModal = () => {
    if (userSubscription && !isAdmin) {
        document.getElementById('loginFormSection').style.display = 'none';
        document.getElementById('userStatusSection').style.display = 'block';
        
        const expDate = new Date(userSubscription.expiryDate);
        document.getElementById('expiryDateDisplay').innerText = expDate.toLocaleDateString('en-GB'); 
        
        const today = new Date();
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays > 0) {
            document.getElementById('daysLeftDisplay').innerText = `( ${diffDays} ڕۆژی ماوە )`;
        } else {
            document.getElementById('daysLeftDisplay').innerText = "( ماوەکەی بەسەرچووە )";
        }

    } else {
        document.getElementById('userStatusSection').style.display = 'none';
        document.getElementById('loginFormSection').style.display = 'block';
        
        document.getElementById('passwordGroup').style.display = 'none';
        document.getElementById('loginInput').value = '';
        document.getElementById('password').value = '';
        document.getElementById('submitLoginBtn').innerText = "ناردن";
        document.getElementById('inputLabel').innerText = "کۆدی کاراکردن";
    }
    
    loginModal.style.display = 'block'; 
};

window.logoutUser = async () => {
    if(!confirm("دڵنیای دەتەوێت کۆدەکە لاببەیت؟ دەتوانیت لە مۆبایلێکی تر بەکاری بهێنیتەوە.")) return;

    const savedCode = localStorage.getItem('maten_pro_code');

    if (savedCode) {
        showToast("تکایە چاوەڕێبە...", "info");
        try {
            const q = query(codesCollection, where("code", "==", savedCode));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const docRef = snapshot.docs[0].ref;
                await updateDoc(docRef, { usedBy: null });
                console.log("Device unlocked from server");
            }
        } catch (error) {
            console.error("Error logging out from server", error);
            showToast("کێشەی ئینتەرنێت هەیە، بەڵام دەرچوویت", "error");
        }
    }

    localStorage.removeItem('maten_pro_code');
    userSubscription = null;
    showToast("بە سەرکەوتوویی دەرچوویت", "success");
    loginModal.style.display = 'none';
    renderApp();
};

document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const inputField = document.getElementById('loginInput');
    const passGroup = document.getElementById('passwordGroup');
    const passwordField = document.getElementById('password');
    const submitBtn = document.getElementById('submitLoginBtn');
    const inputVal = inputField.value.trim();
    const passVal = passwordField.value;

    if (inputVal.includes('@') && passGroup.style.display === 'none') {
        passGroup.style.display = 'block'; 
        passwordField.focus(); 
        submitBtn.innerText = "چوونەژوورەوە"; 
        document.getElementById('inputLabel').innerText = "ئیمەیڵی ئەدمین";
        return; 
    }

    if (passGroup.style.display === 'block') {
        signInWithEmailAndPassword(auth, inputVal, passVal)
            .then(() => {
                loginModal.style.display = 'none';
                e.target.reset();
                showToast("بەخێربێیت ئەدمین", "success");
            })
            .catch(() => { showToast("هەڵە: زانیارییەکان هەڵەن", "error"); });
    } else {
        await activateProCode(inputVal);
    }
};

async function activateProCode(code) {
    if (code.length < 5) { showToast("کۆدەکە زۆر کورتە", "error"); return; }
    showToast("تکایە چاوەڕێبە...", "info");

    const q = query(codesCollection, where("code", "==", code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        showToast("ئەم کۆدە هەڵەیە!", "error");
        return;
    }

    const codeDoc = snapshot.docs[0];
    const data = codeDoc.data();
    const now = new Date();

    if (data.usedBy && data.usedBy !== deviceId) {
        showToast("ئەم کۆدە لەسەر مۆبایلێکی تر ئیش دەکات! دەبێت سەرەتا لەوێ دەربچیت.", "error");
        return;
    }

    if (data.expiryDate && new Date(data.expiryDate) < now) {
        showToast("وادەی ئەم کۆدە بەسەرچووە!", "error");
        return;
    }

    if (!data.usedBy) {
        let newExpiry = data.expiryDate ? new Date(data.expiryDate) : new Date(); 
        if (!data.expiryDate) {
            if (data.duration === '1month') {
                newExpiry.setMonth(newExpiry.getMonth() + 1);
            } else if (data.duration === '1year') {
                newExpiry.setFullYear(newExpiry.getFullYear() + 1);
            } else {
                newExpiry.setMonth(newExpiry.getMonth() + 1);
            }
        }
        try {
            await updateDoc(doc(db, "codes", codeDoc.id), {
                usedBy: deviceId, 
                activatedAt: data.activatedAt || now.toISOString(),
                expiryDate: newExpiry.toISOString()
            });
            data.expiryDate = newExpiry.toISOString();
        } catch(err) {
            console.error(err);
            showToast("کێشە لە پەیوەستبوون", "error");
            return;
        }
    }
    localStorage.setItem('maten_pro_code', code);
    userSubscription = data;
    showToast(`پیرۆزە! بەشداریت کرد`, "success");
    loginModal.style.display = 'none';
    document.getElementById('loginForm').reset();
    renderApp(); 
}

document.getElementById('adminLoginBtn').onclick = () => openLoginModal();
document.getElementById('logoutBtn').onclick = () => { signOut(auth).then(() => { showToast("دەرچوویت", "info"); }); };

function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addCategoryBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('reportsBtn').style.display = show ? 'flex' : 'none'; 
    document.getElementById('generateCodeBtn').style.display = show ? 'flex' : 'none';
}

// --- 10. GENERATE CODE ---
document.getElementById('generateCodeBtn').onclick = () => {
    const type = prompt("جۆری کۆدەکە چی بێت؟\n1 - بۆ یەک مانگ\n2 - بۆ یەک ساڵ");
    if (type === '1') createCode('1month');
    else if (type === '2') createCode('1year');
};

async function createCode(duration) {
    const randomCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    try {
        await addDoc(codesCollection, {
            code: randomCode,
            duration: duration,
            createdAt: new Date().toISOString(),
            usedBy: null, 
            expiryDate: null 
        });
        navigator.clipboard.writeText(randomCode);
        alert(`کۆد دروستکرا و کۆپی کرا:\nCode: ${randomCode}\nDuration: ${duration}`);
    } catch (e) {
        console.error(e);
        showToast("کێشە هەیە", "error");
    }
}

// --- 11. FORM HANDLING (UPDATED FOR AUTO INCREMENT) ---
document.getElementById('addChannelBtn').onclick = () => { 
    if(categories.length === 0) { showToast("سەرەتا دەبێت بەش زیاد بکەیت!", "error"); return; }
    editingId = null; 
    document.getElementById('channelForm').reset(); 
    document.getElementById('formTitle').innerText = "زیادکردنی کەناڵ"; 
    channelModal.style.display = 'block'; 
};

document.getElementById('channelForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('channelName').value;
    const url = document.getElementById('channelUrl').value;
    const category = document.getElementById('channelCategory').value;
    const imgLink = document.getElementById('channelImageLink').value;
    const finalImage = imgLink.trim() !== "" ? imgLink : "https://placehold.co/200?text=TV";
    const isPro = document.getElementById('isProChannel').checked; 
    const orderInput = document.getElementById('channelOrder').value;
    let order = orderInput ? parseInt(orderInput) : 9999;
    
    if(!category) { showToast("تکایە بەشێک هەڵبژێرە", "error"); return; }
    
    showToast("تکایە چاوەڕێبە...", "info");

    try {
        // --- Auto Increment Logic ---
        if (orderInput && order !== 9999) {
            const q = query(
                channelsCollection, 
                where("category", "==", category),
                where("order", ">=", order)
            );
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => {
                    if (editingId && doc.id === editingId) return;
                    const currentData = doc.data();
                    const newOrderVal = (currentData.order || 0) + 1;
                    batch.update(doc.ref, { order: newOrderVal });
                });
                await batch.commit();
                console.log("ڕیزبەندی نوێکرایەوە");
            }
        }

        const data = { name, url, category, image: finalImage, isPro: isPro, order: order };

        if(editingId) {
            await updateDoc(doc(db, "channels", editingId), data); 
            showToast("کەناڵەکە نوێکرایەوە", "success");
        } else { 
            await addDoc(channelsCollection, data); 
            showToast("کەناڵی نوێ زیادکرا", "success"); 
        }
        channelModal.style.display = 'none';
        
    } catch(err) { 
        console.error(err); 
        showToast("کێشەیەک ڕوویدا", "error"); 
    }
};

window.editChannel = (id) => { 
    const ch = channels.find(c => c.id === id); if(!ch) return;
    editingId = id; 
    document.getElementById('channelName').value = ch.name; 
    document.getElementById('channelUrl').value = ch.url; 
    document.getElementById('channelCategory').value = ch.category; 
    document.getElementById('channelImageLink').value = ch.image;
    document.getElementById('isProChannel').checked = ch.isPro || false; 
    document.getElementById('channelOrder').value = ch.order !== undefined && ch.order !== 9999 ? ch.order : '';
    channelModal.style.display = 'block'; 
};

window.deleteChannel = async (id) => { if(confirm("دڵنیای دەسڕێتەوە؟")) { await deleteDoc(doc(db, "channels", id)); showToast("کەناڵەکە سڕایەوە", "info"); } };

// --- 12. UTILS & UI ---
window.toggleFavorite = (id, event) => { 
    if(event) event.stopPropagation(); 
    let favs = getLocalFavorites();
    const index = favs.indexOf(id);
    if (index === -1) { favs.push(id); showToast("زیادکرا بۆ دڵخوازەکان", "success"); } 
    else { favs.splice(index, 1); showToast("لابرا لە دڵخوازەکان", "info"); }
    setLocalFavorites(favs);
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
};

window.handleSearch = () => { renderApp(document.getElementById('searchInput').value.toLowerCase().trim()); };

window.goToHome = () => {
    showOnlyFavorites = false;
    favFilterBtn.classList.remove('active-filter');
    homeBtn.classList.add('active-nav');
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
};

window.toggleFavFilterView = () => { 
    showOnlyFavorites = !showOnlyFavorites; 
    if(showOnlyFavorites) { 
        favFilterBtn.classList.add('active-filter'); homeBtn.classList.remove('active-nav'); showToast("تەنها دڵخوازەکان", "info"); 
    } else { 
        favFilterBtn.classList.remove('active-filter'); homeBtn.classList.add('active-nav'); showToast("هەموو کەناڵەکان", "info"); 
    } 
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim()); 
};

async function reportBrokenChannel(channel) {
    try { await addDoc(reportsCollection, { channelId: channel.id, channelName: channel.name, channelUrl: channel.url, reportedAt: new Date().toISOString(), status: 'pending' }); } catch (e) {}
}
window.openReports = async () => { 
    reportsModal.style.display = 'block';
    reportsList.innerHTML = '<p style="text-align:center;">جارێ... </p>';
    const q = query(reportsCollection, where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    reportsList.innerHTML = '';
    if (snapshot.empty) { reportsList.innerHTML = '<p style="text-align:center; color:green;">پاکە!</p>'; return; }
    snapshot.docs.forEach(doc => {
        const d = doc.data();
        reportsList.innerHTML += `<div class="report-item"><div class="report-info"><h4>${d.channelName}</h4><span>${new Date(d.reportedAt).toLocaleTimeString()}</span></div><div class="report-actions"><button class="fix-btn" onclick="fixReport('${d.channelId}', '${doc.id}')">چاککردن</button></div></div>`;
    });
};
window.fixReport = async (cId, rId) => { editChannel(cId); reportsModal.style.display='none'; await deleteDoc(doc(db,"reports",rId)); };

document.getElementById('addCategoryBtn').onclick = () => { document.getElementById('categoryForm').reset(); categoryModal.style.display = 'block'; };
document.getElementById('categoryForm').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('catTitle').value; const id = document.getElementById('catId').value.toLowerCase().trim(); const order = parseInt(document.getElementById('catOrder').value);
    if(!id.match(/^[a-z0-9]+$/)) { showToast("کۆدی بەش تەنها ئینگلیزی بێت", "error"); return; }
    try { await setDoc(doc(db, "categories", id), { title, order }); showToast("بەشەکە زیادکرا", "success"); categoryModal.style.display = 'none'; } catch (error) { showToast("کێشە هەیە", "error"); }
};

window.openScoreModal = () => { scoreFrame.src = "https://www.fotmob.com"; scoreModal.style.display = 'block'; };
window.closeScoreModal = () => { scoreModal.style.display = 'none'; scoreFrame.src = ""; };
window.onclick = (e) => { if(e.target == loginModal) loginModal.style.display="none"; if(e.target == channelModal) channelModal.style.display="none"; if(e.target == categoryModal) categoryModal.style.display="none"; if(e.target == scoreModal) window.closeScoreModal(); if(e.target == reportsModal) reportsModal.style.display="none"; };
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { loginModal.style.display='none'; channelModal.style.display='none'; categoryModal.style.display='none'; reportsModal.style.display='none'; });

function updateCategoryDropdown() {
    categorySelect.innerHTML = `<option value="" disabled selected>...هەڵبژێرە</option>`;
    categories.forEach(cat => {
        const option = document.createElement("option"); option.value = cat.id; option.text = cat.title; categorySelect.appendChild(option);
    });
}

window.togglePipMode = () => { isPipMode = !isPipMode; if(isPipMode){ playerModal.classList.add('pip-active'); videoContainer.classList.add('pip-mode'); addDragListeners(); } else { playerModal.classList.remove('pip-active'); videoContainer.classList.remove('pip-mode'); resetDragPosition(); removeDragListeners(); } };
window.triggerOverlay = () => { videoContainer.classList.add('ui-visible'); clearTimeout(overlayTimer); overlayTimer = setTimeout(() => { videoContainer.classList.remove('ui-visible'); }, 4000); };

// --- FULLSCREEN & ORIENTATION FIX ---
window.toggleFullScreen = async () => {
    if (isPipMode) { togglePipMode(); return; }
    
    const elem = videoContainer;

    if (!document.fullscreenElement) {
        // کردنەوەی فول سکرین
        try {
            if (elem.requestFullscreen) await elem.requestFullscreen();
            else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
            
            // هەوڵدان بۆ قفڵکردنی شاشە لەسەر لای پەنا (Landscape)
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape').catch(e => console.log(e));
            }
        } catch (err) { console.log(err); }
    } else {
        // داخستنی فول سکرین
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();

        // گەڕانەوە بۆ شێوەی ئاسایی (Portrait)
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    }
};

window.closePlayer = () => { if(document.fullscreenElement) document.exitFullscreen(); if(isPipMode){ isPipMode=false; videoContainer.classList.remove('pip-mode'); playerModal.classList.remove('pip-active'); resetDragPosition(); } playerModal.style.display = 'none'; videoPlayer.pause(); if(window.hls) window.hls.destroy(); };

function addDragListeners() { videoContainer.addEventListener("touchstart", dragStart, {passive:false}); videoContainer.addEventListener("touchend", dragEnd, {passive:false}); videoContainer.addEventListener("touchmove", drag, {passive:false}); videoContainer.addEventListener("mousedown", dragStart); videoContainer.addEventListener("mouseup", dragEnd); videoContainer.addEventListener("mousemove", drag); }
function removeDragListeners() { videoContainer.removeEventListener("touchstart", dragStart); videoContainer.removeEventListener("touchend", dragEnd); videoContainer.removeEventListener("touchmove", drag); videoContainer.removeEventListener("mousedown", dragStart); videoContainer.removeEventListener("mouseup", dragEnd); videoContainer.removeEventListener("mousemove", drag); }
function dragStart(e) { if (!isPipMode) return; if (e.type === "touchstart") { initialX = e.touches[0].clientX - xOffset; initialY = e.touches[0].clientY - yOffset; } else { initialX = e.clientX - xOffset; initialY = e.clientY - yOffset; } if (e.target.closest('.player-btn') || e.target.closest('.related-channels-bar')) { isDragging = false; return; } isDragging = true; }
function dragEnd(e) { initialX = currentX; initialY = currentY; isDragging = false; }
function drag(e) { if (isDragging) { e.preventDefault(); if (e.type === "touchmove") { currentX = e.touches[0].clientX - initialX; currentY = e.touches[0].clientY - initialY; } else { currentX = e.clientX - initialX; currentY = e.clientY - initialY; } xOffset = currentX; yOffset = currentY; setTranslate(currentX, currentY, videoContainer); } }
function setTranslate(xPos, yPos, el) { el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`; }
function resetDragPosition() { xOffset = 0; yOffset = 0; videoContainer.style.transform = "none"; }

// --- RENDER RELATED (AUTO SCROLL FIX) ---
function renderRelated(current) {
    relatedBar.innerHTML = '';
    const relatedChannels = channels.filter(c => c.category === current.category);

    relatedChannels.forEach(ch => {
        const div = document.createElement('div');
        div.id = `rel-${ch.id}`;
        div.className = `related-card ${ch.id === current.id ? 'active' : ''}`;
        
        div.onclick = (e) => {
            e.stopPropagation();
            playChannel(ch.id);
        };
        
        const imgUrl = ch.image && ch.image.trim() !== "" ? ch.image : "https://placehold.co/200?text=TV";
        div.innerHTML = `<img src="${imgUrl}" loading="lazy" onerror="this.src='https://placehold.co/200?text=Error'">`;
        
        relatedBar.appendChild(div);
    });

    // Auto Scroll Logic
    setTimeout(() => {
        const activeCard = document.getElementById(`rel-${current.id}`);
        if (activeCard) {
            activeCard.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, 100);
}