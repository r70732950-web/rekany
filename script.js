// --- 1. FIREBASE SETUP ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsdBBTuCA0cQL8QtJkSPYy8N_Dmr3K_bI",
  authDomain: "maten-tv.firebaseapp.com",
  projectId: "maten-tv",
  storageBucket: "maten-tv.firebasestorage.app",
  messagingSenderId: "196479152493",
  appId: "1:196479152493:web:82860b7f878a47b731ea64",
  measurementId: "G-0BB5EY6TNW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // دەستپێکردنی سیستەمی چوونەژوور

// Collections
const channelsCollection = collection(db, "channels");
const categoriesCollection = collection(db, "categories");

// --- 2. GLOBAL VARIABLES ---
let channels = [];
let categories = [];
let isAdmin = false; // ئەمە لەڕێگەی Auth دەگۆڕدرێت
let editingId = null;
let overlayTimer = null;
let showOnlyFavorites = false;

// DOM Elements
const mainContainer = document.getElementById('mainContainer');
const loginModal = document.getElementById('loginModal');
const formModal = document.getElementById('channelFormModal');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoContainer = document.getElementById('videoContainer');
const relatedBar = document.getElementById('relatedChannels');
const favFilterBtn = document.getElementById('favFilterBtn');
const categorySelect = document.getElementById('channelCategory');

// --- 3. AUTH LISTENER (چاودێری چوونەژوور) ---
// ئەم بەشە زۆر گرنگە: هەر کاتێک ئەدمین بچێتە ژوورەوە یان بێتە دەرەوە، ئەمە ئیش دەکات
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ئەدمین لەژوورەوەیە
        console.log("Admin is logged in:", user.email);
        isAdmin = true;
        document.body.classList.add('admin-mode');
        toggleAdminUI(true);
    } else {
        // کەس لەژوورەوە نییە
        console.log("No user logged in");
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        toggleAdminUI(false);
    }
    // دووبارە ڕیفرێشی شاشەکە دەکەینەوە بۆ ئەوەی دوگمەکانی سڕینەوە دەربکەون/وڵبن
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 4. DATA LISTENERS ---

// A. Categories Listener
onSnapshot(categoriesCollection, (snapshot) => {
    categories = [];
    snapshot.docs.forEach(doc => {
        categories.push({ id: doc.id, ...doc.data() });
    });
    categories.sort((a, b) => a.order - b.order);
    updateCategoryDropdown();
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// B. Channels Listener
onSnapshot(channelsCollection, (snapshot) => {
    channels = [];
    snapshot.docs.forEach(doc => {
        channels.push({ ...doc.data(), id: doc.id });
    });
    channels.sort((a, b) => (a.name > b.name) ? 1 : -1);
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 5. UI FUNCTIONS ---

function updateCategoryDropdown() {
    categorySelect.innerHTML = "";
    categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.text = cat.title;
        categorySelect.appendChild(option);
    });
}

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

    let sectionsToRender = [];
    const hasFavs = channels.some(c => c.isFavorite);
    if (!showOnlyFavorites && !searchQuery && hasFavs) {
        sectionsToRender.push({ id: 'favorites', title: '❤️ دڵخوازەکان' });
    }

    categories.forEach(cat => {
        const hasChannel = displayChannels.some(ch => ch.category === cat.id);
        if(hasChannel || isAdmin) { 
            sectionsToRender.push(cat);
        }
    });

    if (showOnlyFavorites) {
         const section = createSectionHTML('favorites', '❤️ هەموو دڵخوازەکان', displayChannels);
         mainContainer.appendChild(section);
         return;
    }

    sectionsToRender.forEach(cat => {
        let catChannels;
        if(cat.id === 'favorites') {
            catChannels = channels.filter(c => c.isFavorite);
        } else {
            catChannels = displayChannels.filter(c => c.category === cat.id);
        }

        if(catChannels.length === 0) return;

        const section = createSectionHTML(cat.id, cat.title, catChannels);
        mainContainer.appendChild(section);
    });
}

function createSectionHTML(catId, catTitle, catChannels) {
    const section = document.createElement('div');
    section.className = 'category-section';

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
    // تێبینی: دوگمەکانی ئەدمین تەنها کاتێک دەردەکەون کە isAdmin ڕاست بێت
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

// --- PLAYER LOGIC ---
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

// --- 6. ADMIN AUTHENTICATION (New Way) ---

// کردنەوەی مۆداڵی چوونەژوور
document.getElementById('adminLoginBtn').onclick = () => loginModal.style.display = 'block';

// جێبەجێکردنی چوونەژوور بە Firebase Auth
document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value; // لێرە ئیمەیڵ دەنووسرێت
    const pass = document.getElementById('password').value;
    
    signInWithEmailAndPassword(auth, email, pass)
        .then((userCredential) => {
            // سەرکەوتوو بوو
            console.log("Logged in!");
            loginModal.style.display = 'none';
            e.target.reset();
        })
        .catch((error) => {
            console.error(error);
            alert("هەڵە هەیە! دڵنیابەرەوە لە ئیمەیڵ و پاسۆرد.");
        });
};

// جێبەجێکردنی دەرچوون (Logout)
document.getElementById('logoutBtn').onclick = () => { 
    signOut(auth).then(() => {
        console.log("Logged out");
        alert("دەرچوویت.");
    }).catch((error) => {
        console.error(error);
    });
};

function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    renderApp(document.getElementById('searchInput').value);
}

// --- FORM & SAVING ---

document.getElementById('addChannelBtn').onclick = () => { 
    editingId = null; 
    document.getElementById('channelForm').reset(); 
    document.getElementById('formTitle').innerText = "زیادکردنی کەناڵ"; 
    formModal.style.display = 'block'; 
};

document.getElementById('channelForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('channelName').value;
    const url = document.getElementById('channelUrl').value;
    const category = document.getElementById('channelCategory').value;
    const imgLink = document.getElementById('channelImageLink').value;
    const finalImage = imgLink.trim() !== "" ? imgLink : "https://placehold.co/200?text=TV";

    const data = { name, url, category, image: finalImage, isFavorite: false };

    try {
        if(editingId) {
            const old = channels.find(c=>c.id===editingId);
            data.isFavorite = old.isFavorite;
            await updateDoc(doc(db, "channels", editingId), data);
        } else {
            await addDoc(channelsCollection, data);
        }
        formModal.style.display = 'none';
    } catch(err) { console.error(err); alert("Error"); }
};

window.deleteChannel = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db, "channels", id)); };
window.editChannel = (id) => { 
    const ch = channels.find(c => c.id === id); 
    if(!ch) return;
    editingId = id; 
    document.getElementById('channelName').value = ch.name; 
    document.getElementById('channelUrl').value = ch.url; 
    document.getElementById('channelCategory').value = ch.category; 
    document.getElementById('channelImageLink').value = ch.image;
    formModal.style.display = 'block'; 
};

document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { loginModal.style.display='none'; formModal.style.display='none'; });
window.onclick = (e) => { if(e.target == loginModal || e.target == formModal) e.target.style.display="none"; };
