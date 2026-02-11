// -----------------------------------------------------------
// 1. Import Firebase Libraries
// -----------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// -----------------------------------------------------------
// 2. Firebase Configuration
// (تکایە دڵنیابەرەوە databaseURLـەکەت ڕاستە)
// -----------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBsdBBTuCA0cQL8QtJkSPYy8N_Dmr3K_bI",
  authDomain: "maten-tv.firebaseapp.com",
  databaseURL: "https://maten-tv-default-rtdb.firebaseio.com", // <--- ئەمە زۆر گرنگە
  projectId: "maten-tv",
  storageBucket: "maten-tv.firebasestorage.app",
  messagingSenderId: "196479152493",
  appId: "1:196479152493:web:82860b7f878a47b731ea64",
  measurementId: "G-0BB5EY6TNW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'channels'); 

// -----------------------------------------------------------
// 3. داتای سەرەتایی (بۆ ئەوەی ئۆتۆماتیکی دروست ببن)
// -----------------------------------------------------------
const initialData = [
    { id: "1", name: "BeIN Sport", category: "sport", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BeIN_Sports_Logo_01.svg/1200px-BeIN_Sports_Logo_01.svg.png", isFavorite: false },
    { id: "3", name: "Spacetoon", category: "kids", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", image: "https://upload.wikimedia.org/wikipedia/ar/d/d4/Spacetoon_logo.png", isFavorite: true },
    { id: "5", name: "Kurdistan 24", category: "kurdistan", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", image: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Kurdistan24_Logo.png", isFavorite: false }
];

// -----------------------------------------------------------
// 4. Variables
// -----------------------------------------------------------
const ADMIN = { user: "maten", pass: "maten411" };
const categoryTitles = { favorites: "❤️ دڵخوازەکان", sport: "⚽ وەرزش", news: "📰 هەواڵ", movies: "🎬 فیلم", kids: "🧸 منداڵان", islamic: "🕌 ئاینی", kurdistan: "☀️ کوردستان", general: "📺 هەمەجۆر" };

let channels = []; 
let isAdmin = false;
let editingId = null;
let overlayTimer = null;
let showOnlyFavorites = false; 
let isDataLoaded = false; // بۆ ئەوەی بزانین داتا هات یان نا

// -----------------------------------------------------------
// 5. Realtime Listener & Auto-Fill Logic
// -----------------------------------------------------------
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    
    if (data) {
        // ئەگەر داتا هەبوو، وەریدەگرین
        channels = Object.values(data);
        isDataLoaded = true;
    } else {
        // !!! لێرە ئۆتۆماتیکی دروست دەبێت !!!
        // ئەگەر داتا نەبوو (null)، وە پێشتر بارنەکراوە
        if (!isDataLoaded) {
            console.log("Database is empty. Uploading initial data automatically...");
            uploadInitialData();
        }
        channels = [];
    }
    renderApp(document.getElementById('searchInput')?.value.toLowerCase().trim() || '');
});

// فەنکشنێک بۆ ناردنی داتای سەرەتایی
function uploadInitialData() {
    initialData.forEach(item => {
        set(ref(db, 'channels/' + item.id), item);
    });
}

// -----------------------------------------------------------
// 6. Main Application Logic
// -----------------------------------------------------------

window.toggleFavFilterView = () => {
    showOnlyFavorites = !showOnlyFavorites;
    const btn = document.getElementById('favFilterBtn');
    if(showOnlyFavorites) btn.classList.add('active-filter');
    else btn.classList.remove('active-filter');
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
}

window.handleSearch = () => {
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
}

function renderApp(searchQuery = '') {
    const mainContainer = document.getElementById('mainContainer');
    mainContainer.innerHTML = '';
    
    let displayChannels = channels;
    if(searchQuery) displayChannels = displayChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
    if(showOnlyFavorites) displayChannels = displayChannels.filter(c => c.isFavorite);

    if(displayChannels.length === 0) {
        mainContainer.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#a0aec0;"><i class="fas fa-search" style="font-size:40px; margin-bottom:15px; opacity:0.5;"></i><p>هیچ نەدۆزرایەوە (یان جارێ داتا بار دەبێت)</p></div>`;
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
    const adminControls = isAdmin ? `<div class="admin-controls"><button class="edit-btn" onclick="event.stopPropagation(); editChannel('${ch.id}')"><i class="fas fa-pen"></i></button><button class="delete-btn" onclick="event.stopPropagation(); deleteChannel('${ch.id}')"><i class="fas fa-trash"></i></button></div>` : '';
    const favClass = ch.isFavorite ? 'active' : '';
    return `<div class="product-card" onclick="playChannel('${ch.id}')"><div class="fav-btn ${favClass}" onclick="toggleFavorite('${ch.id}', event)"><i class="fas fa-heart"></i></div><img src="${ch.image}" class="product-image" loading="lazy" onerror="this.src='https://placehold.co/200?text=TV'">${adminControls}</div>`;
}

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

// -----------------------------------------------------------
// 7. Player Logic
// -----------------------------------------------------------
window.playChannel = (id) => {
    const channel = channels.find(c => c.id == id);
    if (!channel) return;
    const playerModal = document.getElementById('playerModal');
    const videoPlayer = document.getElementById('videoPlayer');
    playerModal.style.display = 'block';
    videoPlayer.src = ""; 
    if (Hls.isSupported()) {
        if(window.hls) window.hls.destroy(); 
        const hls = new Hls(); hls.loadSource(channel.url); hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(e=>console.log("Autoplay blocked")));
        window.hls = hls;
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.url; videoPlayer.play();
    }
    renderRelated(channel); triggerOverlay();
};

function renderRelated(current) {
    const relatedBar = document.getElementById('relatedChannels');
    relatedBar.innerHTML = '';
    channels.filter(c => c.category === current.category).forEach(ch => {
        const div = document.createElement('div');
        div.className = `related-card ${ch.id == current.id ? 'active' : ''}`;
        div.onclick = (e) => { e.stopPropagation(); playChannel(ch.id); };
        div.innerHTML = `<img src="${ch.image}">`;
        relatedBar.appendChild(div);
    });
}

window.triggerOverlay = () => {
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.classList.add('ui-visible');
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => { videoContainer.classList.remove('ui-visible'); }, 4000);
};
window.toggleFullScreen = () => { 
    const elem = document.getElementById('videoContainer'); 
    if (!document.fullscreenElement) { (elem.requestFullscreen||elem.webkitRequestFullscreen).call(elem); } else { document.exitFullscreen(); } 
};
window.closePlayer = () => { 
    if (document.fullscreenElement) document.exitFullscreen(); 
    document.getElementById('playerModal').style.display = 'none'; 
    document.getElementById('videoPlayer').pause(); 
    if(window.hls) window.hls.destroy(); 
};

// -----------------------------------------------------------
// 8. Admin Functions & Firebase Writes
// -----------------------------------------------------------

window.saveChannelToFirebase = (item) => {
    if (!item.id) item.id = Date.now().toString();
    set(ref(db, 'channels/' + item.id), item)
        .then(() => {
            alert("✅ پاشەکەوت کرا");
            document.getElementById('channelFormModal').style.display = 'none';
        })
        .catch((error) => alert("❌ هەڵە: " + error.message));
};

window.deleteChannel = (id) => {
    if(confirm("دڵنیای لە سڕینەوە؟")) {
        remove(ref(db, 'channels/' + id));
    }
};

window.toggleFavorite = (id, event) => {
    if(event) event.stopPropagation();
    const ch = channels.find(c => c.id == id);
    if (ch) update(ref(db, 'channels/' + id), { isFavorite: !ch.isFavorite });
};

// Form Handlers
document.getElementById('channelForm').onsubmit = (e) => {
    e.preventDefault();
    const processSave = (img) => {
        const item = { 
            id: editingId ? editingId : Date.now().toString(), 
            name: document.getElementById('channelName').value, 
            url: document.getElementById('channelUrl').value, 
            category: document.getElementById('channelCategory').value, 
            image: img || "https://placehold.co/200?text=TV", 
            isFavorite: false 
        };
        if(editingId) {
             const existing = channels.find(c => c.id == editingId);
             if(existing) item.isFavorite = existing.isFavorite;
        }
        window.saveChannelToFirebase(item);
    };
    const f = document.getElementById('channelImageFile').files[0];
    if(f) { const r = new FileReader(); r.onload=ev=>processSave(ev.target.result); r.readAsDataURL(f); } 
    else processSave(document.getElementById('channelImageLink').value);
};

// Login Logic
document.getElementById('adminLoginBtn').onclick = () => document.getElementById('loginModal').style.display = 'block';
document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    if(document.getElementById('username').value === ADMIN.user && document.getElementById('password').value === ADMIN.pass) {
        isAdmin = true; 
        document.body.classList.add('admin-mode'); 
        toggleAdminUI(true); 
        document.getElementById('loginModal').style.display = 'none'; 
        e.target.reset();
        alert("بەخێربێیت ئەدمین! ئێستا دەتوانیت دەستکاری کەناڵەکان بکەیت لە ناو فایەربەیس.");
    } else { 
        alert("هەڵەیە!"); 
    }
};

document.getElementById('logoutBtn').onclick = () => { isAdmin = false; document.body.classList.remove('admin-mode'); toggleAdminUI(false); };

function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('factoryResetBtn').style.display = show ? 'block' : 'none';
    renderApp(document.getElementById('searchInput').value);
}

document.getElementById('addChannelBtn').onclick = () => { 
    editingId = null; 
    document.getElementById('channelForm').reset(); 
    document.getElementById('formTitle').innerText = "زیادکردنی کەناڵ"; 
    document.getElementById('channelFormModal').style.display = 'block'; 
};

window.editChannel = (id) => { 
    const ch = channels.find(c => c.id == id); 
    if(!ch) return;
    editingId = id; 
    document.getElementById('channelName').value = ch.name; 
    document.getElementById('channelUrl').value = ch.url; 
    document.getElementById('channelCategory').value = ch.category; 
    document.getElementById('channelFormModal').style.display = 'block'; 
};

// Close Modals
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { 
    document.getElementById('loginModal').style.display='none'; 
    document.getElementById('channelFormModal').style.display='none'; 
});
window.onclick = (e) => { 
    if(e.target == document.getElementById('loginModal') || e.target == document.getElementById('channelFormModal')) e.target.style.display="none"; 
};

// Start
renderApp();
