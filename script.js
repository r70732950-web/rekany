// --- 1. FIREBASE CONFIGURATION & IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const analytics = getAnalytics(app);
const db = getFirestore(app);
const channelsCollection = collection(db, "channels");

// --- 2. APP VARIABLES ---
const ADMIN = { user: "maten", pass: "maten411" };
const categoryTitles = { 
    favorites: "❤️ دڵخوازەکان", 
    sport: "⚽ وەرزش", 
    news: "📰 هەواڵ", 
    movies: "🎬 فیلم", 
    kids: "🧸 منداڵان", 
    islamic: "🕌 ئاینی", 
    kurdistan: "☀️ کوردستان", 
    general: "📺 هەمەجۆر" 
};

let channels = [];
let isAdmin = false;
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

// --- 3. REAL-TIME DATA LISTENER (ئەم بەشە جێگەی LocalStorage دەگرێتەوە) ---
// This listens to Firebase. Whenever you change DB, this runs automatically.
onSnapshot(channelsCollection, (snapshot) => {
    channels = [];
    snapshot.docs.forEach(doc => {
        channels.push({ ...doc.data(), id: doc.id }); // Use Firebase ID
    });
    console.log("Data Updated from Firebase!", channels);
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 4. APP FUNCTIONS ---

// Toggle Favorites Filter
window.toggleFavFilterView = () => {
    showOnlyFavorites = !showOnlyFavorites;
    favFilterBtn.classList.toggle('active-filter', showOnlyFavorites);
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
};

// Toggle Favorite Status (Updates Firebase)
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

// Render Main App
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
        mainContainer.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#a0aec0;"><i class="fas fa-search" style="font-size:40px; margin-bottom:15px; opacity:0.5;"></i><p>هیچ نەدۆزرایەوە</p></div>`;
        return;
    }

    let activeCategories = [...new Set(displayChannels.map(c => c.category))];
    let categoriesToRender = activeCategories;

    if(!showOnlyFavorites && !searchQuery) {
        const hasFavs = channels.some(c => c.isFavorite);
        if(hasFavs) categoriesToRender = ['favorites', ...activeCategories];
    }

    categoriesToRender.forEach(catKey => {
        let catChannels;
        if (catKey === 'favorites') {
            catChannels = channels.filter(c => c.isFavorite);
            if(searchQuery) catChannels = catChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
        } else {
            catChannels = displayChannels.filter(c => c.category === catKey);
        }

        if (catChannels.length === 0) return;

        const title = categoryTitles[catKey] || catKey.toUpperCase();
        const showAllItems = (searchQuery !== '' || showOnlyFavorites);
        const firstFive = (showAllItems || catKey === 'favorites') ? catChannels : catChannels.slice(0, 5);
        const remaining = (showAllItems || catKey === 'favorites') ? [] : catChannels.slice(5);

        const section = document.createElement('div');
        section.className = 'category-section';
        
        let gridHTML = `<div class="products-container" id="grid-${catKey}">`;
        firstFive.forEach(ch => gridHTML += createCardHTML(ch));
        gridHTML += `</div>`;

        let showMoreBtn = '';
        if (remaining.length > 0) {
            showMoreBtn = `<button class="show-more-btn" onclick="showAll('${catKey}')">پیشاندانی هەموو (${remaining.length}+)</button>`;
        }

        section.innerHTML = `
            <div class="section-header">
                <div class="section-title">${title}</div>
                <div class="count-badge">${catChannels.length}</div>
            </div>
            ${gridHTML} ${showMoreBtn}
        `;
        mainContainer.appendChild(section);
    });
}

function createCardHTML(ch) {
    // Note: We pass ID as string now because Firebase IDs are strings
    const adminControls = isAdmin ? `
        <div class="admin-controls">
            <button class="edit-btn" onclick="editChannel('${ch.id}')"><i class="fas fa-pen"></i></button>
            <button class="delete-btn" onclick="deleteChannel('${ch.id}')"><i class="fas fa-trash"></i></button>
        </div>` : '';
    const favClass = ch.isFavorite ? 'active' : '';
    
    return `
        <div class="product-card" onclick="playChannel('${ch.id}')">
            <div class="fav-btn ${favClass}" onclick="toggleFavorite('${ch.id}', event)"><i class="fas fa-heart"></i></div>
            <img src="${ch.image}" class="product-image" loading="lazy" onerror="this.src='https://placehold.co/200?text=TV'">
            ${adminControls}
        </div>`;
}

// Make functions global for HTML onclick attributes
window.showAll = (catKey) => {
    const grid = document.getElementById(`grid-${catKey}`);
    const catChannels = channels.filter(c => c.category === catKey);
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
        hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(e => console.log("Autoplay blocked")));
        window.hls = hls;
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.url; 
        videoPlayer.play();
    }
    
    renderRelated(channel); 
    triggerOverlay();
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

window.triggerOverlay = () => {
    videoContainer.classList.add('ui-visible');
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => { videoContainer.classList.remove('ui-visible'); }, 4000);
};

window.toggleFullScreen = () => { 
    const elem = videoContainer; 
    if (!document.fullscreenElement) { (elem.requestFullscreen||elem.webkitRequestFullscreen).call(elem); } 
    else { document.exitFullscreen(); } 
};

window.closePlayer = () => { 
    if (document.fullscreenElement) document.exitFullscreen(); 
    playerModal.style.display = 'none'; 
    videoPlayer.pause(); 
    if(window.hls) window.hls.destroy(); 
};

// --- ADMIN & FIREBASE ACTIONS ---

// Login UI Logic
document.getElementById('adminLoginBtn').onclick = () => loginModal.style.display = 'block';

document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    if(user === ADMIN.user && pass === ADMIN.pass) {
        isAdmin = true; 
        document.body.classList.add('admin-mode'); 
        toggleAdminUI(true); 
        loginModal.style.display = 'none'; 
        e.target.reset();
    } else { 
        alert("هەڵەیە!"); 
    }
};

document.getElementById('logoutBtn').onclick = () => { 
    isAdmin = false; 
    document.body.classList.remove('admin-mode'); 
    toggleAdminUI(false); 
};

function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('factoryResetBtn').style.display = 'none'; // Disabled for Firebase safety
    renderApp(document.getElementById('searchInput').value);
}

// Add/Edit Modal
document.getElementById('addChannelBtn').onclick = () => { 
    editingId = null; 
    document.getElementById('channelForm').reset(); 
    document.getElementById('formTitle').innerText = "زیادکردنی کەناڵ"; 
    formModal.style.display = 'block'; 
};

// Submit to Firebase
document.getElementById('channelForm').onsubmit = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('channelName').value;
    const url = document.getElementById('channelUrl').value;
    const category = document.getElementById('channelCategory').value;
    let image = document.getElementById('channelImageLink').value;

    const file = document.getElementById('channelImageFile').files[0];
    
    // Helper to process upload/save
    const processSave = async (finalImage) => {
        const channelData = {
            name: name,
            url: url,
            category: category,
            image: finalImage || "https://placehold.co/200?text=TV",
            isFavorite: false 
        };

        try {
            if (editingId) {
                // UPDATE existing in Firebase
                const docRef = doc(db, "channels", editingId);
                // Keep old favorite status and image if not changed
                const oldData = channels.find(c => c.id === editingId);
                if(!finalImage) channelData.image = oldData.image;
                channelData.isFavorite = oldData.isFavorite;
                
                await updateDoc(docRef, channelData);
            } else {
                // ADD new to Firebase
                await addDoc(channelsCollection, channelData);
            }
            formModal.style.display = 'none';
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("کێشەیەک هەیە لە پەیوەستبوون بە Firebase");
        }
    };

    if(file) {
        const reader = new FileReader();
        reader.onload = (ev) => processSave(ev.target.result); // Base64 (Not recommended for large production but works here)
        reader.readAsDataURL(file);
    } else {
        processSave(image);
    }
};

// Delete from Firebase
window.deleteChannel = async (id) => { 
    // Important: Prevent event bubbling is handled in HTML onclick, but good to be safe
    if(confirm("دڵنیای دەسڕێتەوە؟")) { 
        try {
            await deleteDoc(doc(db, "channels", id));
        } catch (e) {
            console.error(e);
            alert("نەسڕایەوە!");
        }
    } 
};

// Edit Prep
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

// Factory Reset (Optional - Clears Firebase collection)
window.factoryReset = async () => { 
    if(confirm("ئاگاداربە! هەموو کەناڵەکانی ناو داتابەیس دەسڕێنەوە. دڵنیای؟")) { 
        const q = await getDocs(channelsCollection);
        q.forEach(async (d) => {
            await deleteDoc(doc(db, "channels", d.id));
        });
        location.reload(); 
    } 
};

// Close Modals
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { 
    loginModal.style.display='none'; 
    formModal.style.display='none'; 
});

window.onclick = (e) => { 
    if(e.target == loginModal || e.target == formModal) e.target.style.display="none"; 
};

// Initial Render called automatically by onSnapshot
