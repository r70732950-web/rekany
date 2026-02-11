// --- 1. FIREBASE IMPORTS & CONFIGURATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// زانیارییەکانی فایربەیسەکەت
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
const analytics = getAnalytics(app);
const db = getFirestore(app);
const channelsCollection = collection(db, "channels");

// --- 2. گۆڕاوە سەرەکییەکان ---
const ADMIN = { user: "maten", pass: "maten411" }; // تێبینی: ئەمە بۆ پڕۆژەی بچووک ئاساییە
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

// هێنانی ئیمێنتەکانی HTML
const mainContainer = document.getElementById('mainContainer');
const loginModal = document.getElementById('loginModal');
const formModal = document.getElementById('channelFormModal');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoContainer = document.getElementById('videoContainer');
const relatedBar = document.getElementById('relatedChannels');
const favFilterBtn = document.getElementById('favFilterBtn');

// --- 3. وەرگرتنی داتا (Real-time Listener) ---
// ئەم بەشە ئۆتۆماتیکی کار دەکات هەر کاتێک داتابەیس گۆڕانکاری بەسەردا بێت
onSnapshot(channelsCollection, (snapshot) => {
    channels = [];
    snapshot.docs.forEach(doc => {
        channels.push({ ...doc.data(), id: doc.id });
    });
    // ڕێکخستنی ئەلفوبێیی (سەرەتا تازەترین)
    channels.sort((a, b) => (a.name > b.name) ? 1 : -1);
    
    console.log("Data Updated form Firebase:", channels.length);
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 4. فەنکشنە سەرەکییەکان (UI Logic) ---

// گۆڕینی دۆخی دڵخوازەکان (Filter)
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

// زیادکردن/لابردن لە دڵخوازەکان (نوێکردنەوەی فایربەیس)
window.toggleFavorite = async (id, event) => {
    if(event) event.stopPropagation();
    
    const channelRef = doc(db, "channels", id);
    const channel = channels.find(c => c.id === id);
    
    if(channel) {
        // ناردنی گۆڕانکاری بۆ فایربەیس
        await updateDoc(channelRef, { isFavorite: !channel.isFavorite });
    }
};

window.handleSearch = () => {
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
};

// دروستکردنی ڕووکار (Render)
function renderApp(searchQuery = '') {
    mainContainer.innerHTML = '';
    
    let displayChannels = channels;

    // فلتەری گەڕان
    if(searchQuery) {
        displayChannels = displayChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
    }

    // فلتەری دڵخوازەکان (لە هێدەر)
    if(showOnlyFavorites) {
        displayChannels = displayChannels.filter(c => c.isFavorite);
    }

    // ئەگەر هیچ نەبوو
    if(displayChannels.length === 0) {
        mainContainer.innerHTML = `
            <div style="text-align:center; padding:50px 20px; color:#a0aec0;">
                <i class="fas fa-search" style="font-size:40px; margin-bottom:15px; opacity:0.5;"></i>
                <p>هیچ کەناڵێک نەدۆزرایەوە</p>
            </div>`;
        return;
    }

    // دەرهێنانی جۆرەکان (Categories)
    let activeCategories = [...new Set(displayChannels.map(c => c.category))];
    let categoriesToRender = activeCategories;

    // ئەگەر گەڕان نەبوو، بەشی دڵخوازەکان بخە سەرەتا
    if(!showOnlyFavorites && !searchQuery) {
        const hasFavs = channels.some(c => c.isFavorite);
        if(hasFavs) categoriesToRender = ['favorites', ...activeCategories];
    }

    categoriesToRender.forEach(catKey => {
        let catChannels;
        
        // ئامادەکردنی داتای هەر بەشێک
        if (catKey === 'favorites') {
            catChannels = channels.filter(c => c.isFavorite);
            if(searchQuery) catChannels = catChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
        } else {
            catChannels = displayChannels.filter(c => c.category === catKey);
        }

        if (catChannels.length === 0) return;

        const title = categoryTitles[catKey] || catKey.toUpperCase();
        
        // دیاریکردنی ئەوەی هەمووی پیشان بدات یان تەنها ٥ دانە
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

// دروستکردنی کارتی کەناڵ
function createCardHTML(ch) {
    // دوگمەکانی ئەدمین (دەستکاری/سڕینەوە)
    const adminControls = isAdmin ? `
        <div class="admin-controls">
            <button class="edit-btn" onclick="event.stopPropagation(); editChannel('${ch.id}')"><i class="fas fa-pen"></i></button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteChannel('${ch.id}')"><i class="fas fa-trash"></i></button>
        </div>` : '';
    
    const favClass = ch.isFavorite ? 'active' : '';
    const imageSrc = ch.image || "https://placehold.co/200?text=TV";
    
    return `
        <div class="product-card" onclick="playChannel('${ch.id}')">
            <div class="fav-btn ${favClass}" onclick="toggleFavorite('${ch.id}', event)">
                <i class="fas fa-heart"></i>
            </div>
            <img src="${imageSrc}" class="product-image" loading="lazy" onerror="this.src='https://placehold.co/200?text=Error'">
            ${adminControls}
        </div>`;
}

// فەنکشن بۆ پیشاندانی هەموو کەناڵەکانی بەشێک
window.showAll = (catKey) => {
    const grid = document.getElementById(`grid-${catKey}`);
    const catChannels = channels.filter(c => c.category === catKey);
    const remaining = catChannels.slice(5);
    
    event.target.style.display = 'none'; // شاردنەوەی دوگمەکە
    
    remaining.forEach(ch => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createCardHTML(ch);
        grid.appendChild(tempDiv.firstElementChild);
    });
};

// --- 5. بەشی ڤیدیۆ (Player Logic) ---
window.playChannel = (id) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;
    
    playerModal.style.display = 'block';
    videoPlayer.src = ""; 
    
    // پشکنینی HLS (بۆ زۆربەی وێگەڕەکان)
    if (Hls.isSupported()) {
        if(window.hls) window.hls.destroy(); 
        const hls = new Hls(); 
        hls.loadSource(channel.url); 
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoPlayer.play().catch(e => console.log("Autoplay blocked by browser"));
        });
        window.hls = hls;
    } 
    // پشکنینی Safari و iOS
    else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.url; 
        videoPlayer.play();
    }
    
    renderRelated(channel); 
    triggerOverlay();
};

// کەناڵە پەیوەندیدارەکان (Related Channels)
function renderRelated(current) {
    relatedBar.innerHTML = '';
    // تەنها ئەوانەی هەمان جۆرن (Category)
    channels.filter(c => c.category === current.category).forEach(ch => {
        const div = document.createElement('div');
        div.className = `related-card ${ch.id === current.id ? 'active' : ''}`;
        div.onclick = (e) => { e.stopPropagation(); playChannel(ch.id); };
        div.innerHTML = `<img src="${ch.image}" onerror="this.src='https://placehold.co/100?text=TV'">`;
        relatedBar.appendChild(div);
    });
}

// کۆنتڕۆڵی شاشەی ڤیدیۆ
window.triggerOverlay = () => {
    videoContainer.classList.add('ui-visible');
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => { videoContainer.classList.remove('ui-visible'); }, 4000);
};

window.toggleFullScreen = () => { 
    const elem = videoContainer; 
    if (!document.fullscreenElement) { 
        (elem.requestFullscreen||elem.webkitRequestFullscreen).call(elem); 
    } else { 
        document.exitFullscreen(); 
    } 
};

window.closePlayer = () => { 
    if (document.fullscreenElement) document.exitFullscreen(); 
    playerModal.style.display = 'none'; 
    videoPlayer.pause(); 
    if(window.hls) window.hls.destroy(); 
};

// --- 6. ئەدمین و فۆڕمەکان ---

// کردنەوەی مۆداڵی ئەدمین
document.getElementById('adminLoginBtn').onclick = () => loginModal.style.display = 'block';

// پشکنینی چوونەژوور
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
        alert("هەڵەیە! زانیارییەکان ڕاست نین."); 
    }
};

// دەرچوون (Logout)
document.getElementById('logoutBtn').onclick = () => { 
    isAdmin = false; 
    document.body.classList.remove('admin-mode'); 
    toggleAdminUI(false); 
};

function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    renderApp(document.getElementById('searchInput').value);
}

// کردنەوەی فۆڕمی زیادکردن
document.getElementById('addChannelBtn').onclick = () => { 
    editingId = null; 
    document.getElementById('channelForm').reset(); 
    document.getElementById('formTitle').innerText = "زیادکردنی کەناڵ"; 
    formModal.style.display = 'block'; 
};

// --- ناردنی داتا بۆ Firebase (بە لینک) ---
document.getElementById('channelForm').onsubmit = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('channelName').value;
    const url = document.getElementById('channelUrl').value;
    const category = document.getElementById('channelCategory').value;
    const imageLink = document.getElementById('channelImageLink').value;

    // ئەگەر لینک بەتاڵ بوو، وێنەیەکی بەتاڵ دادەنێت
    const finalImage = imageLink.trim() !== "" ? imageLink : "https://placehold.co/200?text=TV";

    const channelData = {
        name: name,
        url: url,
        category: category,
        image: finalImage,
        isFavorite: false // بە دیفۆڵت دڵخواز نییە
    };

    try {
        if (editingId) {
            // ئەگەر Edit بێت
            const docRef = doc(db, "channels", editingId);
            const oldData = channels.find(c => c.id === editingId);
            channelData.isFavorite = oldData.isFavorite; // پاراستنی دڵخواز
            
            await updateDoc(docRef, channelData);
        } else {
            // ئەگەر Add New بێت
            await addDoc(channelsCollection, channelData);
        }
        formModal.style.display = 'none';
    } catch (error) {
        console.error("Error:", error);
        alert("کێشەیەک هەیە لە پەیوەستبوون بە ئینتەرنێت");
    }
};

// سڕینەوەی کەناڵ (Delete)
window.deleteChannel = async (id) => { 
    if(confirm("ئایا دڵنیای لە سڕینەوەی ئەم کەناڵە؟")) { 
        try {
            await deleteDoc(doc(db, "channels", id));
        } catch (e) {
            console.error(e);
            alert("نەسڕایەوە، ئینتەرنێت بپشکنە.");
        }
    } 
};

// ئامادەکاری بۆ دەستکاری (Edit)
window.editChannel = (id) => { 
    const ch = channels.find(c => c.id === id); 
    if(!ch) return;
    
    editingId = id; 
    document.getElementById('channelName').value = ch.name; 
    document.getElementById('channelUrl').value = ch.url; 
    document.getElementById('channelCategory').value = ch.category; 
    document.getElementById('channelImageLink').value = ch.image;
    
    document.getElementById('formTitle').innerText = "دەستکاری کەناڵ";
    formModal.style.display = 'block'; 
};

// داخستنی مۆداڵەکان
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { 
    loginModal.style.display='none'; 
    formModal.style.display='none'; 
});

window.onclick = (e) => { 
    if(e.target == loginModal || e.target == formModal) e.target.style.display="none"; 
};
