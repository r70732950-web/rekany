// chat.js
import { 
    db, auth, storage, 
    chatsCollection, ordersCollection, usersCollection, 
    serverTimestamp 
} from './app-setup.js';

import { 
    state, t, saveCart, generateOrderMessageCore 
} from './app-core.js';

import { 
    showNotification, openPopup, closeCurrentPopup, renderSkeletonLoader 
} from './app-ui.js';

import { 
    collection, addDoc, query, where, orderBy, onSnapshot, 
    doc, setDoc, updateDoc, getDoc, limit, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

let chatUnsubscribe = null;
let adminChatsUnsubscribe = null;
let currentChatId = null;

// --- 1. دەستپێکردن و لۆجیکی سەرەکی ---

export function initChatSystem() {
    // گوێگرتن لە دوگمەی کردنەوەی چات لە خوارەوە
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            openUserChat();
        });
    }

    // گوێگرتن لە دوگمەی چاتی ئەدمین لە ڕێکخستنەکان
    const adminChatsBtn = document.getElementById('adminChatsBtn');
    if (adminChatsBtn) {
        adminChatsBtn.addEventListener('click', () => {
            openAdminChatList();
        });
    }

    // پشکنینی نامەی نەخوێندراوە بۆBadge
    checkUnreadMessages();
}

function checkUnreadMessages() {
    auth.onAuthStateChanged(user => {
        if (user) {
            const q = query(
                chatsCollection, 
                where('userId', '==', user.uid)
            );
            onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    const unread = data.unreadCountUser || 0;
                    const badge = document.getElementById('chatBadge');
                    if (badge) {
                        badge.style.display = unread > 0 ? 'flex' : 'none';
                        badge.textContent = unread;
                    }
                }
            });
        }
    });
}

// --- 2. چاتی بەکارهێنەر (User Side) ---

async function openUserChat() {
    if (!auth.currentUser) {
        showNotification("تکایە سەرەتا بچۆ ژوورەوە", "error");
        openPopup('profileSheet'); 
        return;
    }

    const chatPage = document.getElementById('chatPage');
    chatPage.innerHTML = ''; // پاککردنەوە
    renderSkeletonLoader(chatPage);
    
    // گۆڕینی لاپەڕە
    history.pushState({ type: 'page', id: 'chatPage', title: 'نامەکان' }, '', '#chat');
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('page-active');
        p.classList.add('page-hidden');
    });
    chatPage.classList.remove('page-hidden');
    chatPage.classList.add('page-active');

    // دروستکردنی UI
    renderChatUI(chatPage, 'user', auth.currentUser.uid);
    
    // هێنان یان دروستکردنی چات
    await setupChatListener(auth.currentUser.uid, 'user');
}

// --- 3. چاتی ئەدمین (Admin Side) ---

function openAdminChatList() {
    const listPage = document.getElementById('adminChatListPage');
    listPage.innerHTML = '';
    renderSkeletonLoader(listPage);

    history.pushState({ type: 'page', id: 'adminChatListPage', title: 'لیستی نامەکان' }, '', '#admin-chats');
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('page-active');
        p.classList.add('page-hidden');
    });
    listPage.classList.remove('page-hidden');
    listPage.classList.add('page-active');

    renderAdminChatListUI(listPage);
}

function renderAdminChatListUI(container) {
    container.innerHTML = `
        <div class="section" style="min-height: 100vh;">
            <div style="padding: 15px; border-bottom: 1px solid var(--section-border); background: white; position: sticky; top: 0; z-index: 10;">
                <h3 style="margin:0;">نامەکانی بەکارهێنەران</h3>
            </div>
            <div id="adminChatListItems" style="padding: 10px;">
                <p style="text-align:center;">...بارکردن</p>
            </div>
        </div>
    `;

    const listContainer = document.getElementById('adminChatListItems');
    
    // هێنانی هەموو چاتەکان بەپێی کاتی کۆتا نامە
    const q = query(chatsCollection, orderBy('lastMessageTime', 'desc'));
    
    if (adminChatsUnsubscribe) adminChatsUnsubscribe();

    adminChatsUnsubscribe = onSnapshot(q, async (snapshot) => {
        listContainer.innerHTML = '';
        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center;">هیچ نامەیەک نییە</p>';
            return;
        }

        for (const chatDoc of snapshot.docs) {
            const chatData = chatDoc.data();
            const userDocRef = doc(usersCollection, chatData.userId);
            let userName = "بەکارهێنەر";
            
            try {
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    userName = userData.displayName || userData.name || userData.email || "بەکارهێنەر";
                }
            } catch (e) { console.error(e); }

            const unreadClass = chatData.unreadCountAdmin > 0 ? 'background-color: #e6fffa;' : 'background-color: white;';
            const badgeHtml = chatData.unreadCountAdmin > 0 ? `<span class="notification-badge" style="position:static; display:inline-block;">${chatData.unreadCountAdmin}</span>` : '';

            const item = document.createElement('div');
            item.style = `padding: 15px; border-radius: 8px; border: 1px solid var(--section-border); margin-bottom: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; ${unreadClass}`;
            item.innerHTML = `
                <div>
                    <div style="font-weight: bold; font-size: 16px;">${userName}</div>
                    <div style="font-size: 13px; color: var(--text-light); margin-top: 4px;">${chatData.lastMessage || 'وێنە/دەنگ'}</div>
                    <div style="font-size: 11px; color: var(--dark-gray); margin-top: 4px;">${new Date(chatData.lastMessageTime?.toDate()).toLocaleString('ku')}</div>
                </div>
                ${badgeHtml}
            `;
            item.onclick = () => openAdminChatDetails(chatData.userId, userName);
            listContainer.appendChild(item);
        }
    });
}

function openAdminChatDetails(targetUserId, targetUserName) {
    const chatPage = document.getElementById('chatPage');
    chatPage.innerHTML = '';
    
    history.pushState({ type: 'page', id: 'chatPage', title: targetUserName }, '', `#chat-${targetUserId}`);
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('page-active');
        p.classList.add('page-hidden');
    });
    chatPage.classList.remove('page-hidden');
    chatPage.classList.add('page-active');

    renderChatUI(chatPage, 'admin', targetUserId, targetUserName);
    setupChatListener(targetUserId, 'admin');
}


// --- 4. دروستکردنی ڕووکاری چات (UI Rendering) ---

function renderChatUI(container, role, targetUserId, headerTitle = 'پشتیوانی') {
    container.innerHTML = `
        <div class="chat-container" style="display: flex; flex-direction: column; height: 100vh; background-color: #fff;">
            <!-- Header -->
            <div class="chat-header" style="padding: 10px 15px; border-bottom: 1px solid var(--medium-gray); display: flex; align-items: center; gap: 10px; background: white; z-index: 10;">
                <button id="chatBackBtn" style="border:none; background:none; font-size: 20px;"><i class="fas fa-arrow-right"></i></button>
                <div style="font-weight: bold; font-size: 16px;">${headerTitle}</div>
            </div>

            <!-- Messages Area -->
            <div id="messagesArea" style="flex: 1; overflow-y: auto; padding: 15px; background-color: #f0f2f5; display: flex; flex-direction: column; gap: 10px;">
                <div style="text-align:center; color: var(--dark-gray); margin-top: 20px;">
                    <i class="fas fa-lock" style="font-size: 12px;"></i> نامەکان پارێزراون
                </div>
            </div>

            <!-- Typing Indicator -->
            <div id="typingIndicator" style="padding: 5px 15px; font-size: 12px; color: var(--dark-gray); display: none;">
                بەرامبەر دەنووسێت...
            </div>

            <!-- Input Area -->
            <div class="chat-input-area" style="padding: 10px; border-top: 1px solid var(--medium-gray); background: white; display: flex; align-items: center; gap: 10px;">
                <button id="attachBtn" style="color: var(--dark-gray); background: none; border: none; font-size: 20px;"><i class="fas fa-paperclip"></i></button>
                <input type="file" id="fileInput" hidden accept="image/*,audio/*">
                
                <div style="flex: 1; position: relative;">
                    <input type="text" id="chatInput" placeholder="نامەکەت بنووسە..." style="width: 100%; padding: 10px 15px; border-radius: 20px; border: 1px solid var(--medium-gray); background: var(--light-gray);">
                </div>
                
                <button id="sendBtn" style="background-color: var(--primary-color); color: white; width: 40px; height: 40px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;

    document.getElementById('chatBackBtn').onclick = () => history.back();
    
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');

    // ناردن بە Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // ناردن بە دوگمە
    sendBtn.onclick = () => sendMessage();

    // هەڵبژاردنی فایل
    attachBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    };
}

// --- 5. لۆجیکی ناردن و وەرگرتنی نامە ---

async function setupChatListener(targetUserId, role) {
    currentChatId = targetUserId; // چونکە chatId هەمان userIdـیە بۆ سادەیی
    const messagesArea = document.getElementById('messagesArea');
    
    const chatDocRef = doc(chatsCollection, currentChatId);
    
    // دڵنیابوونەوە لە دروستبوونی دۆکیومێنتی چات
    const chatSnap = await getDoc(chatDocRef);
    if (!chatSnap.exists()) {
        if (role === 'user') {
            await setDoc(chatDocRef, {
                userId: targetUserId,
                createdAt: serverTimestamp(),
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                unreadCountUser: 0,
                unreadCountAdmin: 0
            });
        } else {
            messagesArea.innerHTML += `<p style="text-align:center;">ئەم بەکارهێنەرە هێشتا چاتی دەستپێنەکردووە.</p>`;
            return;
        }
    }

    // سفرکردنەوەی نامە نەخوێندراوەکان
    if (role === 'user') {
        await updateDoc(chatDocRef, { unreadCountUser: 0 });
    } else {
        await updateDoc(chatDocRef, { unreadCountAdmin: 0 });
    }

    // گوێگرتن لە نامەکان (Messages)
    const messagesQuery = query(
        collection(db, 'chats', currentChatId, 'messages'),
        orderBy('timestamp', 'asc')
    );

    if (chatUnsubscribe) chatUnsubscribe();

    chatUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        messagesArea.innerHTML = '';
        snapshot.forEach(doc => {
            renderMessage(doc.data(), role);
        });
        messagesArea.scrollTop = messagesArea.scrollHeight; // Scroll to bottom
    });
}

function renderMessage(msg, role) {
    const messagesArea = document.getElementById('messagesArea');
    const isMe = (role === 'user' && msg.senderId === auth.currentUser.uid) || 
                 (role === 'admin' && msg.senderId !== currentChatId); // ئەدمین نامەی خۆی دەناسێتەوە

    const align = isMe ? 'flex-end' : 'flex-start';
    const bg = isMe ? 'var(--primary-color)' : 'white';
    const color = isMe ? 'white' : 'black';
    const radius = isMe ? '18px 18px 0 18px' : '18px 18px 18px 0';

    let contentHtml = '';
    if (msg.type === 'text') {
        contentHtml = `<div style="padding: 8px 12px;">${msg.content}</div>`;
    } else if (msg.type === 'image') {
        contentHtml = `<img src="${msg.content}" style="max-width: 200px; border-radius: 12px; margin: 5px;">`;
    } else if (msg.type === 'audio') {
        contentHtml = `<audio controls src="${msg.content}" style="max-width: 200px; margin: 5px;"></audio>`;
    }

    const msgDiv = document.createElement('div');
    msgDiv.style = `display: flex; justify-content: ${align}; margin-bottom: 8px;`;
    msgDiv.innerHTML = `
        <div style="max-width: 70%; background-color: ${bg}; color: ${color}; border-radius: ${radius}; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            ${contentHtml}
            <div style="font-size: 9px; opacity: 0.7; text-align: right; padding: 0 8px 4px;">
                ${new Date(msg.timestamp?.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        </div>
    `;
    messagesArea.appendChild(msgDiv);
}

// [ 💡 چاککراوە ] فەنکشنەکە ئێستا دەتوانێت دەق ڕاستەوخۆ وەربگرێت بەبێ پشتبەستن بە ئینپوت
async function sendMessage(type = 'text', content = null) {
    if (!currentChatId) return;

    let textToSend = '';
    const input = document.getElementById('chatInput');

    if (type === 'text') {
        if (content) {
            textToSend = content; // ئەگەر دەقەکە ڕاستەوخۆ پێی درابێت (وەک داواکاری)
        } else if (input) {
            textToSend = input.value.trim(); // ئەگەر لە خانەی نووسین وەریبگرێت
        }
        
        if (!textToSend) return; // ئەگەر هیچ نەبێت، هیچ مەکە
    } else {
        textToSend = content; // بۆ وێنە و دەنگ، لینکەکە لێرە دێت
    }

    const msgData = {
        senderId: auth.currentUser.uid,
        type: type,
        content: textToSend,
        timestamp: serverTimestamp(),
        read: false
    };

    try {
        // 1. زیادکردنی نامە
        await addDoc(collection(db, 'chats', currentChatId, 'messages'), msgData);

        // 2. نوێکردنەوەی چاتی سەرەکی
        const updateData = {
            lastMessage: type === 'text' ? textToSend : (type === 'image' ? '📷 وێنە' : '🎤 دەنگ'),
            lastMessageTime: serverTimestamp()
        };

        // زیادکردنی ژمارەی نەخوێندراوە
        // ئەگەر یوزەر بینێرێت، بۆ ئەدمین زیاد دەبێت
        const chatDoc = await getDoc(doc(chatsCollection, currentChatId));
        const currentCount = chatDoc.data() || {};
        
        if (auth.currentUser.uid === currentChatId) {
            // یوزەر دەینێرێت
            updateData.unreadCountAdmin = (currentCount.unreadCountAdmin || 0) + 1;
        } else {
            // ئەدمین دەینێرێت
            updateData.unreadCountUser = (currentCount.unreadCountUser || 0) + 1;
        }

        await updateDoc(doc(chatsCollection, currentChatId), updateData);

        if (input) input.value = ''; // پاککردنەوەی خانەکە ئەگەر هەبوو

    } catch (error) {
        console.error("Error sending message:", error);
        showNotification("نەتوانرا نامە بنێردرێت", "error");
    }
}

async function handleFileUpload(file) {
    if (!file) return;
    
    // پشکنینی قەبارە (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification("قەبارەی فایل زۆر گەورەیە (دەبێت کەمتر بێت لە 5MB)", "error");
        return;
    }

    const type = file.type.startsWith('image/') ? 'image' : 'audio';
    const path = `chats/${currentChatId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);

    try {
        showNotification("خەریکی ناردنە...", "success");
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        await sendMessage(type, url);
    } catch (error) {
        console.error(error);
        showNotification("هەڵە لە ناردنی فایل", "error");
    }
}

// --- 6. داواکاری ڕاستەوخۆ (Direct Order) ---

export async function handleDirectOrder(cartActionsContainer) {
    if (!auth.currentUser) {
        showNotification("تکایە سەرەتا بچۆ ژوورەوە", "error");
        openPopup('profileSheet');
        return;
    }

    if (state.cart.length === 0) {
        showNotification("سەبەتەکەت بەتاڵە", "error");
        return;
    }

    const confirmBtn = cartActionsContainer.querySelector('.direct-order-btn');
    if(confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...ناردن';
    }

    try {
        // 1. دروستکردنی دەقی داواکاری
        const orderMsg = generateOrderMessageCore();

        // 2. تۆمارکردنی لە کۆلێکشن-ی Orders (بۆ ڕێکخستن)
        await addDoc(ordersCollection, {
            userId: auth.currentUser.uid,
            items: state.cart,
            total: document.getElementById('totalAmount')?.textContent || '0',
            status: 'pending', // pending, processing, completed, cancelled
            createdAt: serverTimestamp(),
            userInfo: state.userProfile
        });

        // 3. دڵنیابوونەوە لەوەی چاتەکە بوونی هەیە
        currentChatId = auth.currentUser.uid;
        const chatDocRef = doc(chatsCollection, currentChatId);
        const chatSnap = await getDoc(chatDocRef);
        
        if (!chatSnap.exists()) {
            await setDoc(chatDocRef, {
                userId: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                unreadCountUser: 0,
                unreadCountAdmin: 0
            });
        }

        // 4. ناردنی داواکاری وەک نامە لە چات
        // لێرەدا دەقەکە ڕاستەوخۆ دەدەین بە فەنکشنەکە نەک لە ڕێگەی ئینپوت
        await sendMessage('text', orderMsg);

        // 5. بەتاڵکردنەوەی سەبەتە
        state.cart = [];
        saveCart();
        
        // 6. داخستنی شیتەکان و کردنەوەی چات
        closeCurrentPopup(); // داخستنی سەبەتە
        showNotification("داواکارییەکەت بە سەرکەوتوویی نێردرا", "success");
        setTimeout(() => {
            openUserChat(); // کردنەوەی چات بۆ بینینی داواکارییەکە
        }, 500);

    } catch (error) {
        console.error("Order Error:", error);
        showNotification("هەڵەیەک ڕوویدا لە ناردنی داواکاری", "error");
        if(confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'هەوڵبدەرەوە';
        }
    }
}