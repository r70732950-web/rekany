const ADMIN = { user: "maten", pass: "maten411" };
const DB_KEY = "maten_tv_pro_v2";
const categoryTitles = { favorites: "❤️ دڵخوازەکان", sport: "⚽ وەرزش", news: "📰 هەواڵ", movies: "🎬 فیلم", kids: "🧸 منداڵان", islamic: "🕌 ئاینی", kurdistan: "☀️ کوردستان", general: "📺 هەمەجۆر" };

let channels = [];
try { channels = JSON.parse(localStorage.getItem(DB_KEY)) || []; } catch(e) { channels = []; }

let isAdmin = false;
let editingId = null;
let overlayTimer = null;
let showOnlyFavorites = false; // New state for header button

// Initial Data Seed
if (channels.length === 0) {
    channels = [
        { id: 1, name: "BeIN Sport", category: "sport", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BeIN_Sports_Logo_01.svg/1200px-BeIN_Sports_Logo_01.svg.png", isFavorite: false },
        { id: 3, name: "Spacetoon", category: "kids", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", image: "https://upload.wikimedia.org/wikipedia/ar/d/d4/Spacetoon_logo.png", isFavorite: true },
        { id: 5, name: "Kurdistan 24", category: "kurdistan", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", image: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Kurdistan24_Logo.png", isFavorite: false }
    ];
    saveData();
}

const mainContainer = document.getElementById('mainContainer');
const loginModal = document.getElementById('loginModal');
const formModal = document.getElementById('channelFormModal');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoContainer = document.getElementById('videoContainer');
const relatedBar = document.getElementById('relatedChannels');
const favFilterBtn = document.getElementById('favFilterBtn');

function saveData() { 
    try { localStorage.setItem(DB_KEY, JSON.stringify(channels)); } catch (e) { alert("میمۆری پڕبووە!"); }
}

// Toggle Favorites Mode from Header
function toggleFavFilterView() {
    showOnlyFavorites = !showOnlyFavorites;
    if(showOnlyFavorites) {
        favFilterBtn.classList.add('active-filter');
    } else {
        favFilterBtn.classList.remove('active-filter');
    }
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
}

function toggleFavorite(id, event) {
    if(event) event.stopPropagation();
    const index = channels.findIndex(c => c.id === id);
    if (index !== -1) {
        channels[index].isFavorite = !channels[index].isFavorite;
        saveData();
        renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
    }
}

function handleSearch() {
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
}

function renderApp(searchQuery = '') {
    mainContainer.innerHTML = '';
    
    let displayChannels = channels;

    // Apply Search Filter
    if(searchQuery) {
        displayChannels = displayChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
    }

    // Apply Header Favorite Filter
    if(showOnlyFavorites) {
        displayChannels = displayChannels.filter(c => c.isFavorite);
    }

    if(displayChannels.length === 0) {
        mainContainer.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#a0aec0;"><i class="fas fa-search" style="font-size:40px; margin-bottom:15px; opacity:0.5;"></i><p>هیچ نەدۆزرایەوە</p></div>`;
        return;
    }

    let activeCategories = [...new Set(displayChannels.map(c => c.category))];
    
    // Sort categories (Favorites at top only if NOT in 'only favorites' mode)
    let categoriesToRender = activeCategories;

    // If we are NOT in exclusive favorite mode, we can show a special "Favorites" section at top
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
        
        // Avoid duplicate logic if needed, but 'favorites' key handles it separately.

        const title = categoryTitles[catKey] || catKey.toUpperCase();
        
        // Show all if searching OR if filtering by favorites
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
    const adminControls = isAdmin ? `<div class="admin-controls"><button class="edit-btn" onclick="event.stopPropagation(); editChannel(${ch.id})"><i class="fas fa-pen"></i></button><button class="delete-btn" onclick="event.stopPropagation(); deleteChannel(${ch.id})"><i class="fas fa-trash"></i></button></div>` : '';
    const favClass = ch.isFavorite ? 'active' : '';
    return `<div class="product-card" onclick="playChannel(${ch.id})"><div class="fav-btn ${favClass}" onclick="toggleFavorite(${ch.id}, event)"><i class="fas fa-heart"></i></div><img src="${ch.image}" class="product-image" loading="lazy" onerror="this.src='https://placehold.co/200?text=TV'">${adminControls}</div>`;
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

// Player Functions
window.playChannel = (id) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;
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
window.toggleFullScreen = () => { const elem = videoContainer; if (!document.fullscreenElement) { (elem.requestFullscreen||elem.webkitRequestFullscreen).call(elem); } else { document.exitFullscreen(); } };
window.closePlayer = () => { if (document.fullscreenElement) document.exitFullscreen(); playerModal.style.display = 'none'; videoPlayer.pause(); if(window.hls) window.hls.destroy(); };

// Admin & UI
document.getElementById('adminLoginBtn').onclick = () => loginModal.style.display = 'block';
document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    if(document.getElementById('username').value === ADMIN.user && document.getElementById('password').value === ADMIN.pass) {
        isAdmin = true; document.body.classList.add('admin-mode'); toggleAdminUI(true); loginModal.style.display = 'none'; e.target.reset();
    } else { alert("هەڵەیە!"); }
};
document.getElementById('logoutBtn').onclick = () => { isAdmin = false; document.body.classList.remove('admin-mode'); toggleAdminUI(false); };
function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('factoryResetBtn').style.display = show ? 'block' : 'none';
    renderApp(document.getElementById('searchInput').value);
}
document.getElementById('addChannelBtn').onclick = () => { editingId = null; document.getElementById('channelForm').reset(); document.getElementById('formTitle').innerText = "زیادکردنی کەناڵ"; formModal.style.display = 'block'; };
document.getElementById('channelForm').onsubmit = (e) => {
    e.preventDefault();
    const save = (img) => {
        const item = { id: editingId || Date.now(), name: document.getElementById('channelName').value, url: document.getElementById('channelUrl').value, category: document.getElementById('channelCategory').value, image: img || "https://placehold.co/200?text=TV", isFavorite: false };
        if(editingId) { const idx = channels.findIndex(c=>c.id===editingId); item.image=img||channels[idx].image; item.isFavorite=channels[idx].isFavorite; channels[idx]=item; } else channels.push(item);
        saveData(); renderApp(); formModal.style.display = 'none';
    };
    const f = document.getElementById('channelImageFile').files[0];
    if(f) { const r = new FileReader(); r.onload=ev=>save(ev.target.result); r.readAsDataURL(f); } 
    else save(document.getElementById('channelImageLink').value);
};
window.deleteChannel = (id) => { if(confirm("دڵنیای؟")) { channels = channels.filter(c => c.id !== id); saveData(); renderApp(); } };
window.editChannel = (id) => { const ch = channels.find(c => c.id === id); editingId = id; document.getElementById('channelName').value = ch.name; document.getElementById('channelUrl').value = ch.url; document.getElementById('channelCategory').value = ch.category; formModal.style.display = 'block'; };
window.factoryReset = () => { if(confirm("هەمووی دەسڕیتەوە؟")) { localStorage.removeItem(DB_KEY); location.reload(); } };
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { loginModal.style.display='none'; formModal.style.display='none'; });
window.onclick = (e) => { if(e.target == loginModal || e.target == formModal) e.target.style.display="none"; };

// Initial Render
renderApp();
