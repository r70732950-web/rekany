// --- 1. FIREBASE SETUP & IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// زانیارییەکانی فایربەیس
const firebaseConfig = {
  apiKey: "AIzaSyBsdBBTuCA0cQL8QtJkSPYy8N_Dmr3K_bI",
  authDomain: "maten-tv.firebaseapp.com",
  projectId: "maten-tv",
  storageBucket: "maten-tv.firebasestorage.app",
  messagingSenderId: "196479152493",
  appId: "1:196479152493:web:82860b7f878a47b731ea64",
  measurementId: "G-0BB5EY6TNW"
};

// دەستپێکردنی فایربەیس
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// کۆلێکشنەکان
const channelsCollection = collection(db, "channels");
const categoriesCollection = collection(db, "categories");

// --- 2. GLOBAL VARIABLES ---
let channels = [];
let categories = [];
let isAdmin = false;
let editingId = null;
let overlayTimer = null;
let showOnlyFavorites = false;

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
const categorySelect = document.getElementById('channelCategory'); // Dropdown

// --- 3. AUTHENTICATION LISTENER (چاودێری ئەدمین) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin Logged In:", user.email);
        isAdmin = true;
        document.body.classList.add('admin-mode');
        toggleAdminUI(true);
    } else {
        console.log("User Logged Out");
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        toggleAdminUI(false);
    }
    // ڕیفرێشکردنی شاشەکە بۆ ئەوەی دوگمەکانی سڕینەوە دەربکەون
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 4. DATA LISTENERS (Real-time) ---

// A. هێنانی بەشەکان (Categories)
onSnapshot(categoriesCollection, (snapshot) => {
    categories = [];
    snapshot.docs.forEach(doc => {
        categories.push({ id: doc.id, ...doc.data() });
    });
    // ڕیزکردن بەپێی ژمارە (Order)
    categories.sort((a, b) => a.order - b.order);
    
    // نوێکردنەوەی لیستەی ناو فۆڕمی زیادکردن
    updateCategoryDropdown();
    
    // نوێکردنەوەی شاشە
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// B. هێنانی کەناڵەکان (Channels)
onSnapshot(channelsCollection, (snapshot) => {
    channels = [];
    snapshot.docs.forEach(doc => {
        channels.push({ ...doc.data(), id: doc.id });
    });
    // ڕیزکردن بەپێی ئەلفوبێ
    channels.sort((a, b) => (a.name > b.name) ? 1 : -1);
    
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 5. UI FUNCTIONS ---

// نوێکردنەوەی لیستی بەشەکان لە فۆڕمی زیادکردن
function updateCategoryDropdown() {
    categorySelect.innerHTML = `<option value="" disabled selected>...هەڵبژێرە</option>`;
    categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.text = cat.title;
        categorySelect.appendChild(option);
    });
}

// فلتەری دڵخوازەکان
window.toggleFavFilterView = () => {
    showOnlyFavorites = !showOnlyFavorites;
    if(showOnlyFavorites) {
        favFilterBtn.classList.add('active-filter');
        favFilterBtn.style.color = "#e53e3e";
    } else {
        favFilterBtn.classList.remove('active-filter');
        favFilterBtn.style.color = "white";
    }
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
};

// گۆڕینی دڵخواز (Firebase Update)
window.toggleFavorite = async (id, event) => {
    if(event) event.stopPropagation();
    const channelRef = doc(db, "channels", id);
    const channel = channels.find(c => c.id === id);
    if(channel) {
        await updateDoc(channelRef, { isFavorite: !channel.isFavorite });
    }
};

window.handleSearch = () => {
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
};

// --- MAIN RENDER FUNCTION ---
function renderApp(searchQuery = '') {
    mainContainer.innerHTML = '';
    
    let displayChannels = channels;

    if(searchQuery) {
        displayChannels = displayChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
    }

    if(showOnlyFavorites) {
        displayChannels = displayChannels.filter(c => c.isFavorite);
    }

    if(displayChannels.length === 0) {
        mainContainer.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#a0aec0;"><p>هیچ نەدۆزرایەوە</p></div>`;
        return;
    }

    // دیاریکردنی ئەو بەشانەی کە دەبێت نیشان بدرێن
    let sectionsToRender = [];
    
    // ١. بەشی دڵخوازەکان (ئەگەر هەبوو)
    const hasFavs = channels.some(c => c.isFavorite);
    if (!showOnlyFavorites && !searchQuery && hasFavs) {
        sectionsToRender.push({ id: 'favorites', title: '❤️ دڵخوازەکان' });
    }

    // ٢. بەشەکانی فایربەیس
    categories.forEach(cat => {
        const hasChannel = displayChannels.some(ch => ch.category === cat.id);
        // ئەگەر کەناڵی تێدابوو یان بەکارهێنەر ئەدمین بوو (بۆ ئەوەی بەشە بەتاڵەکان ببینێت)
        if(hasChannel || isAdmin) { 
            sectionsToRender.push(cat);
        }
    });

    // ئەگەر تەنها فلتەری دڵخواز بوو، بەش دروست ناکەین، تەنها یەک پارچە
    if (showOnlyFavorites) {
         const section = createSectionHTML('favorites', '❤️ هەموو دڵخوازەکان', displayChannels);
         mainContainer.appendChild(section);
         return;
    }

    // دروستکردنی بەشەکان
    sectionsToRender.forEach(cat => {
        let catChannels;
        if(cat.id === 'favorites') {
            catChannels = channels.filter(c => c.isFavorite);
        } else {
            catChannels = displayChannels.filter(c => c.category === cat.id);
        }

        // ئەگەر بەتاڵ بوو و ئەدمین نەبوو، دەریان مەخە
        if(catChannels.length === 0 && !isAdmin) return;

        const section = createSectionHTML(cat.id, cat.title, catChannels);
        mainContainer.appendChild(section);
    });
}

function createSectionHTML(catId, catTitle, catChannels) {
    const section = document.createElement('div');
    section.className = 'category-section';

    // ئەگەر بەشەکە بەتاڵ بوو (تەنها بۆ ئەدمین دەردەکەوێت)
    if (catChannels.length === 0) {
        section.innerHTML = `
            <div class="section-header" style="border-bottom:none;">
                <div class="section-title" style="opacity:0.6;">${catTitle} (بەتاڵ)</div>
            </div>`;
        return section;
    }

    const firstFive = catChannels.slice(0, 5);
    const remaining = catChannels.slice(5);

    let gridHTML = `<div class="products-container" id="grid-${catId}">`;
    firstFive.forEach(ch => gridHTML += createCardHTML(ch));
    gridHTML += `</div>`;

    let showMoreBtn = '';
    if (remaining.length > 0) {
        showMoreBtn = `<button class="show-more-btn" onclick="showAll('${catId}')">پیشاندانی هەموو (${remaining.length}+)</button>`;
    }

    section.innerHTML = `
        <div class="section-header">
            <div class="section-title">${catTitle}</div>
            <div class="count-badge">${catChannels.length}</div>
        </div>
        ${gridHTML} ${showMoreBtn}
    `;
    return section;
}

function createCardHTML(ch) {
    const adminControls = isAdmin ? `
        <div class="admin-controls">
            <button class="edit-btn" onclick="event.stopPropagation(); editChannel('${ch.id}')"><i class="fas fa-pen"></i></button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteChannel('${ch.id}')"><i class="fas fa-trash"></i></button>
        </div>` : '';
    const favClass = ch.isFavorite ? 'active' : '';
    const img = ch.image || "https://placehold.co/200?text=TV";
    
    return `<div class="product-card" onclick="playChannel('${ch.id}')">
            <div class="fav-btn ${favClass}" onclick="toggleFavorite('${ch.id}', event)"><i class="fas fa-heart"></i></div>
            <img src="${img}" class="product-image" loading="lazy" onerror="this.src='https://placehold.co/200?text=Error'">
            ${adminControls}</div>`;
}

// پیشاندانی هەموو کەناڵەکانی بەشێک
window.showAll = (catId) => {
    const grid = document.getElementById(`grid-${catId}`);
    let catChannels = [];
    if(catId === 'favorites') {
        catChannels = channels.filter(c => c.isFavorite);
    } else {
        catChannels = channels.filter(c => c.category === catId);
    }
    const remaining = catChannels.slice(5);
    event.target.style.display = 'none';
    remaining.forEach(ch => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createCardHTML(ch);
        grid.appendChild(tempDiv.firstElementChild);
    });
};

// --- 6. VIDEO PLAYER ---
window.playChannel = (id) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;
    
    playerModal.style.display = 'block';
    videoPlayer.src = ""; 
    
    if (Hls.isSupported()) {
        if(window.hls) window.hls.destroy(); 
        const hls = new Hls(); 
        hls.loadSource(channel.url); 
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(e=>console.log("Autoblocked")));
        window.hls = hls;
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.url; videoPlayer.play();
    }
    renderRelated(channel); triggerOverlay();
};

function renderRelated(current) {
    relatedBar.innerHTML = '';
    channels.filter(c => c.category === current.category).forEach(ch => {
        const div = document.createElement('div');
        div.className = `related-card ${ch.id === current.id ? 'active' : ''}`;
        div.onclick = (e) => { e.stopPropagation(); playChannel(ch.id); };
        div.innerHTML = `<img src="${ch.image}">`;
        relatedBar.appendChild(div);
    });
}
window.triggerOverlay = () => { videoContainer.classList.add('ui-visible'); clearTimeout(overlayTimer); overlayTimer = setTimeout(() => { videoContainer.classList.remove('ui-visible'); }, 4000); };
window.toggleFullScreen = () => { const elem = videoContainer; (!document.fullscreenElement) ? (elem.requestFullscreen||elem.webkitRequestFullscreen).call(elem) : document.exitFullscreen(); };
window.closePlayer = () => { if (document.fullscreenElement) document.exitFullscreen(); playerModal.style.display = 'none'; videoPlayer.pause(); if(window.hls) window.hls.destroy(); };

// --- 7. ADMIN FUNCTIONS ---

// Login UI
document.getElementById('adminLoginBtn').onclick = () => loginModal.style.display = 'block';

// Login Submit (Firebase Auth)
document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
            loginModal.style.display = 'none';
            e.target.reset();
        })
        .catch((error) => {
            console.error(error);
            alert("هەڵە هەیە! ئیمەیڵ یان پاسۆرد هەڵەیە.");
        });
};

// Logout
document.getElementById('logoutBtn').onclick = () => { 
    signOut(auth).then(() => {
        alert("دەرچوویت.");
    });
};

function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addCategoryBtn').style.display = show ? 'flex' : 'none';
    renderApp(document.getElementById('searchInput').value);
}

// --- 8. CHANNEL & CATEGORY MANAGEMENT ---

// A. Channels
document.getElementById('addChannelBtn').onclick = () => { 
    if(categories.length === 0) {
        alert("سەرەتا دەبێت بەش (Category) زیاد بکەیت!");
        return;
    }
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

    if(!category) {
        alert("تکایە بەشێک (Category) هەڵبژێرە");
        return;
    }

    const data = { name, url, category, image: finalImage, isFavorite: false };

    try {
        if(editingId) {
            const old = channels.find(c=>c.id===editingId);
            data.isFavorite = old.isFavorite;
            await updateDoc(doc(db, "channels", editingId), data);
        } else {
            await addDoc(channelsCollection, data);
        }
        channelModal.style.display = 'none';
    } catch(err) { console.error(err); alert("Error"); }
};

window.deleteChannel = async (id) => { if(confirm("دڵنیای دەسڕێتەوە؟")) await deleteDoc(doc(db, "channels", id)); };
window.editChannel = (id) => { 
    const ch = channels.find(c => c.id === id); 
    if(!ch) return;
    editingId = id; 
    document.getElementById('channelName').value = ch.name; 
    document.getElementById('channelUrl').value = ch.url; 
    document.getElementById('channelCategory').value = ch.category; 
    document.getElementById('channelImageLink').value = ch.image;
    channelModal.style.display = 'block'; 
};

// B. Categories (NEW)
document.getElementById('addCategoryBtn').onclick = () => {
    document.getElementById('categoryForm').reset();
    categoryModal.style.display = 'block';
};

document.getElementById('categoryForm').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('catTitle').value;
    // ID دەبێت ئینگلیزی بێت و بچووک بێت
    const id = document.getElementById('catId').value.toLowerCase().trim(); 
    const order = parseInt(document.getElementById('catOrder').value);

    if(!id.match(/^[a-z0-9]+$/)) {
        alert("کۆدی بەش تەنها دەبێت پیت و ژمارەی ئینگلیزی بێت.");
        return;
    }

    try {
        await setDoc(doc(db, "categories", id), {
            title: title,
            order: order
        });
        alert("بەشەکە زیادکرا!");
        categoryModal.style.display = 'none';
    } catch (error) {
        console.error("Error:", error);
        alert("کێشەیەک هەیە لە زیادکردنی بەش.");
    }
};

// Close Modals
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { 
    loginModal.style.display='none'; 
    channelModal.style.display='none'; 
    categoryModal.style.display='none';
});

window.onclick = (e) => { 
    if(e.target == loginModal || e.target == channelModal || e.target == categoryModal) {
        e.target.style.display="none"; 
    }
};
