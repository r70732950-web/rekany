// chat.js - چاککراو
import { 
    db, auth, storage, 
    chatsCollection, ordersCollection, usersCollection, 
    serverTimestamp 
} from './app-setup.js';

import { 
    state, t, saveCart
} from './app-core.js';

import { 
    showNotification, openPopup, closeCurrentPopup
} from './app-ui.js';

import { 
    collection, addDoc, query, where, orderBy, onSnapshot, 
    doc, setDoc, updateDoc, getDoc, limit, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// گۆڕاوەکان بۆ کۆنتڕۆڵکردنی گوێگرەکان
let messagesUnsubscribe = null;
let conversationsUnsubscribe = null;
let activeChatUserId = null; // بۆ ئەدمین: چاودێریکردنی ئەوەی کە لەگەڵ کام بەکارهێنەر چاتدەکەین
let mediaRecorder = null;
let audioChunks = [];
let chatPageInitialized = false;

// گۆڕاوی تازە - چاودێریکردنی دۆخی ئامادەکردنی پەڕەی چات
let chatPageReadyObserver = null;

// دەستپێکردنی سیستەمی چات
export function initChatSystem() {
    console.log("دەستپێکردنی سیستەمی چات");
    setupChatUI();
    setupChatListeners();
    checkUnreadMessages();
    
    // گوێگرتن لە گۆڕانکارییەکانی پەڕە
    document.addEventListener('pageChanged', handlePageChanged);
}

// ئامادەکردنی ڕووکاری چات
function setupChatUI() {
    console.log("ئامادەکردنی ڕووکاری چات");
    
    // 1. زیادکردنی دوگمەی "داواکاری ڕاستەوخۆ" بۆ پەڕەی سەبەتە
    const cartActions = document.getElementById('cartActions');
    if (cartActions) {
        console.log("کۆنتێنەری کردارەکانی سەبەتە دۆزرایەوە");
        
        // سڕینەوەی دوگمەی کۆن ئەگەر هەبێت بۆ دوورکەوتنەوە لە دووبارەبوونەوە
        const existingBtn = cartActions.querySelector('.direct-order-btn');
        if(existingBtn) {
            existingBtn.remove();
            console.log("دوگمەی کۆنی داواکاری سڕایەوە");
        }

        const directOrderBtn = document.createElement('button');
        directOrderBtn.className = 'whatsapp-btn direct-order-btn'; 
        directOrderBtn.style.backgroundColor = 'var(--primary-color)';
        directOrderBtn.style.marginTop = '10px';
        directOrderBtn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${t('submit_order_direct')}</span>`;
        directOrderBtn.onclick = handleDirectOrder;
        
        // دانانی لە سەرەتای لیستی دوگمەکان
        if (cartActions.firstChild) {
            cartActions.insertBefore(directOrderBtn, cartActions.firstChild);
        } else {
            cartActions.appendChild(directOrderBtn);
        }
        
        console.log("دوگمەی داواکاری ڕاستەوخۆ زیادکرا بۆ سەبەتە");
    } else {
        console.warn("کۆنتێنەری کردارەکانی سەبەتە نەدۆزرایەوە");
    }

    // 2. ئامادەکردنی پێکهاتەی HTML-ی پەڕەی چات (دروستکردن بەشێوەی داینامیک ئەگەر نەبوو)
    createChatPageStructure();
}

// دروستکردنی پێکهاتەی پەڕەی چات ئەگەر نەبوو
function createChatPageStructure() {
    const chatPage = document.getElementById('chatPage');
    
    if (!chatPage) {
        console.error("پەڕەی چات نەدۆزرایەوە، ناتوانرێت پێکهاتە دروست بکرێت");
        return;
    }
    
    // [ چاککراوە ] : پشکنین دەکات ئەگەر کۆنتەینەری چات نەبوو، دروستی دەکاتەوە
    if (!chatPage.querySelector('.chat-container')) {
        console.log("دروستکردنی پێکهاتەی چات");
        
        chatPage.innerHTML = `
            <div class="chat-container">
                <div class="chat-header" id="chatPageHeader">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="conversation-avatar" id="chatHeaderAvatar"><i class="fas fa-user"></i></div>
                        <div>
                            <div class="conversation-name" id="chatHeaderName">Admin</div>
                            <div class="conversation-time" id="chatHeaderStatus"><span class="chat-status-dot online"></span> ${t('online')}</div>
                        </div>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessagesArea">
                    </div>
                <div class="typing-indicator" id="typingIndicator">${t('typing')}</div>
                
                <div class="chat-input-area" id="chatInputArea">
                    <button class="chat-action-btn" id="chatImageBtn"><i class="fas fa-image"></i></button>
                    <input type="file" id="chatImageInput" accept="image/*" style="display:none;">
                    
                    <input type="text" class="chat-input" id="chatTextInput" placeholder="${t('type_message')}">
                    
                    <button class="chat-action-btn chat-record-btn" id="chatVoiceBtn"><i class="fas fa-microphone"></i></button>
                    <button class="chat-action-btn chat-send-btn" id="chatSendBtn" style="display:none;"><i class="fas fa-paper-plane"></i></button>
                </div>

                <div id="chatLoginRequired" class="chat-login-required" style="display:none;">
                    <i class="fas fa-lock"></i>
                    <h3>پێویستە بچیتە ژوورەوە</h3>
                    <p>بۆ بەکارهێنانی چات و ناردنی داواکاری، تکایە سەرەتا بچۆ ژوورەوە.</p>
                    <button class="chat-login-btn" onclick="window.globalAdminTools.openPopup('profileSheet')">چوونەژوورەوە / خۆتۆمارکردن</button>
                </div>
            </div>
        `;
        
        console.log("پێکهاتەی چات دروستکرا");
    } else {
        console.log("پێکهاتەی چات پێشتر دروستکراوە");
    }

    // 3. ئامادەکردنی پەڕەی لیستی چاتەکان بۆ ئەدمین
    const adminChatListPage = document.getElementById('adminChatListPage');
    
    // [ چاککراوە ] : پشکنین دەکات ئەگەر لیستەکە نەبوو
    if (adminChatListPage && !adminChatListPage.querySelector('.conversation-list')) {
        console.log("دروستکردنی پێکهاتەی لیستی چاتەکان بۆ ئەدمین");
        
        adminChatListPage.innerHTML = `
            <div class="settings-page" style="padding-top: 60px;">
                <h3 class="section-title"><i class="fas fa-inbox"></i> ${t('conversations_title')}</h3>
                <div class="conversation-list" id="adminConversationList">
                    <div class="text-center p-4">...Loading</div>
                </div>
            </div>
        `;
        
        console.log("پێکهاتەی لیستی چاتەکانی ئەدمین دروستکرا");
    }
}

// ئامادەکردنی گوێگرەکانی چات
function setupChatListeners() {
    console.log("ئامادەکردنی گوێگرەکانی چات");
    
    // گوێگر بۆ دوگمەی چات لە بن-ناڤ
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) {
        chatBtn.onclick = () => {
            console.log("کلیک لەسەر دوگمەی چات کرا");
            openChatPage();
        };
    } else {
        console.warn("دوگمەی چات لە ناف-بار نەدۆزرایەوە");
    }

    // گوێگر بۆ دوگمەی لیستی چاتەکانی ئەدمین (لە ڕێکخستنەکان)
    const adminChatsBtn = document.getElementById('adminChatsBtn');
    if (adminChatsBtn) {
        adminChatsBtn.onclick = () => {
            console.log("کلیک لەسەر دوگمەی لیستی چاتەکانی ئەدمین کرا");
            openAdminChatList();
        };
    }
}

// چارەسەرکردنی گۆڕانکاری پەڕە بۆ ئامادەکردنی پەڕەی چات کاتێک پێویستە
function handlePageChanged(event) {
    if (event.detail && event.detail.newPage === 'chatPage') {
        console.log("گۆڕانکاری پەڕە بۆ پەڕەی چات");
        if (!chatPageInitialized) {
            setupChatInputHandlers();
            chatPageInitialized = true;
        }
    }
}

// ئامادەکردنی هەندلەرەکانی فۆرمی چات
function setupChatInputHandlers() {
    console.log("ئامادەکردنی هەندلەرەکانی فۆرمی چات");

    // دۆزینەوە و ئامادەکردنی توخمەکان
    const textInput = document.getElementById('chatTextInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const voiceBtn = document.getElementById('chatVoiceBtn');
    const imageBtn = document.getElementById('chatImageBtn');
    const imageInput = document.getElementById('chatImageInput');

    // پشکنین بۆ بوونی توخمەکان
    if (!textInput || !sendBtn || !voiceBtn || !imageBtn || !imageInput) {
        console.error("توخمەکانی فۆرمی چات نەدۆزرانەوە:", {
            textInput: !!textInput,
            sendBtn: !!sendBtn, 
            voiceBtn: !!voiceBtn,
            imageBtn: !!imageBtn,
            imageInput: !!imageInput
        });
        
        // دووبارە هەوڵدانەوە دوای ٥٠٠ میلی چرکە
        setTimeout(setupChatInputHandlers, 500);
        return;
    }

    console.log("هەموو توخمەکانی فۆرمی چات دۆزرانەوە، گوێگرەکان ئامادە دەکرێن");

    // گوێگر بۆ گۆڕانکاری نووسین - پیشاندان یان شاردنەوەی دوگمەی ناردن
    textInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val.length > 0) {
            sendBtn.style.display = 'flex';
            voiceBtn.style.display = 'none';
        } else {
            sendBtn.style.display = 'none';
            voiceBtn.style.display = 'flex';
        }
    });

    // گوێگر بۆ کلیلی Enter
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage('text');
        }
    });

    // گوێگرەکان بۆ دوگمەکان
    sendBtn.onclick = () => sendMessage('text');
    voiceBtn.onclick = handleVoiceRecording;
    imageBtn.onclick = () => {
        console.log("کلیک لەسەر دوگمەی وێنە");
        if (imageInput) {
            imageInput.click();
        }
    };

    // گوێگر بۆ هەڵبژاردنی فایل
    imageInput.onchange = (e) => {
        console.log("وێنەیەک هەڵبژێردرا:", e.target.files);
        if (e.target.files.length > 0) {
            sendMessage('image', e.target.files[0]);
        }
    };
    
    console.log("گوێگرەکانی فۆرمی چات بەسەرکەوتوویی ئامادەکران");
}

// --- NAVIGATION Logic ---

// کردنەوەی پەڕەی چات
function openChatPage(targetUserId = null) {
    console.log("کردنەوەی پەڕەی چات", { targetUserId });
    
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    if (isAdmin && !targetUserId) {
        // Admin clicked "Messages" on nav -> Go to conversation list
        console.log("ئەدمین کلیکی کرد بەبێ هەڵبژاردنی بەکارهێنەرێک -> ڕۆیشتن بۆ لیست");
        openAdminChatList();
        return;
    }

    // پشکنینی بارودۆخی چوونەژوورەوە
    // If User is not logged in
    if (!state.currentUser && !isAdmin) {
        console.log("بەکارهێنەر لە ژوورەوە نییە -> پیشاندانی فۆرمی چوونەژوورەوە");
        
        history.pushState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', '#chat');
        
        // Manually show page logic (duplicated from app-ui logic to avoid circular deps issues)
        document.querySelectorAll('.page').forEach(page => {
            const isActive = page.id === 'chatPage';
            page.classList.toggle('page-active', isActive);
            page.classList.toggle('page-hidden', !isActive);
        });

        const loginReq = document.getElementById('chatLoginRequired');
        const inputArea = document.getElementById('chatInputArea');
        const msgArea = document.getElementById('chatMessagesArea');
        
        if(loginReq) loginReq.style.display = 'flex';
        if(inputArea) inputArea.style.display = 'none';
        if(msgArea) msgArea.style.display = 'none';
        
        // تریگەرکردنی ڕووداو بۆ ئەوەی ئاگادار بین کە پەڕە گۆڕاوە
        document.dispatchEvent(new CustomEvent('pageChanged', { 
            detail: { newPage: 'chatPage', needsLogin: true }
        }));
        
        return;
    }

    // Show Chat UI
    history.pushState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', '#chat');
    
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'chatPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });
    
    const loginReq = document.getElementById('chatLoginRequired');
    const inputArea = document.getElementById('chatInputArea');
    const msgArea = document.getElementById('chatMessagesArea');

    if(loginReq) loginReq.style.display = 'none';
    if(inputArea) inputArea.style.display = 'flex';
    if(msgArea) {
        msgArea.style.display = 'flex';
        msgArea.innerHTML = '<div style="text-align:center; padding:20px; color:var(--dark-gray);">...چاوەڕێی بارکردنی چاتەکە</div>'; // Clear previous
    }

    // Setup context
    if (isAdmin) {
        activeChatUserId = targetUserId;
        const headerName = document.getElementById('chatHeaderName');
        if(headerName) headerName.textContent = "User"; 
        updateActiveNav('chatBtn'); 
    } else {
        activeChatUserId = state.currentUser.uid;
        const headerName = document.getElementById('chatHeaderName');
        if(headerName) headerName.textContent = t('admin_badge');
    }

    // ئامادەکردنی هەندلەرەکانی فۆرم ئەگەر پێویست بوو
    if (!chatPageInitialized) {
        setupChatInputHandlers();
        chatPageInitialized = true;
    }
    
    // تریگەرکردنی ڕووداو بۆ ئەوەی ئاگادار بین کە پەڕە گۆڕاوە
    document.dispatchEvent(new CustomEvent('pageChanged', { 
        detail: { newPage: 'chatPage', needsLogin: false }
    }));
    
    // بارکردنی نامەکان
    subscribeToMessages(activeChatUserId);
}

// کردنەوەی لیستی چاتەکان بۆ ئەدمین
function openAdminChatList() {
    console.log("کردنەوەی لیستی چاتەکانی ئەدمین");
    
    history.pushState({ type: 'page', id: 'adminChatListPage', title: t('conversations_title') }, '', '#admin-chats');
    
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'adminChatListPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    subscribeToAllConversations();
    
    // تریگەرکردنی ڕووداو بۆ ئەوەی ئاگادار بین کە پەڕە گۆڕاوە
    document.dispatchEvent(new CustomEvent('pageChanged', { 
        detail: { newPage: 'adminChatListPage' }
    }));
}

// --- MESSAGING LOGIC ---

// گوێگرتن بۆ نامەکان
function subscribeToMessages(chatUserId) {
    console.log("گوێگرتن بۆ نامەکانی بەکارهێنەر", chatUserId);
    
    if (!chatUserId) {
        console.error("ناسنامەی بەکارهێنەری چات نەدراوە");
        return;
    }
    
    // پاککردنەوەی گوێگری کۆن ئەگەر هەبێت
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }

    const messagesRef = collection(db, "chats", chatUserId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const msgArea = document.getElementById('chatMessagesArea');
    if (!msgArea) {
        console.error("ناوچەی نامەکان نەدۆزرایەوە");
        return;
    }
    
    // گوێگرتن بۆ گۆڕانکاری لە نامەکان
    try {
        messagesUnsubscribe = onSnapshot(q, (snapshot) => {
            msgArea.innerHTML = ''; 
            
            if (snapshot.empty) {
                msgArea.innerHTML = `<div class="empty-chat-state"><i class="fas fa-comments"></i><p>${t('no_messages')}</p></div>`;
                return;
            }

            snapshot.docs.forEach(doc => {
                const msg = doc.data();
                renderSingleMessage(msg, msgArea, chatUserId);
            });

            // Scroll to bottom
            msgArea.scrollTop = msgArea.scrollHeight;

            // Mark as read if I am the receiver
            markMessagesAsRead(snapshot.docs, chatUserId);
        }, error => {
            console.error("هەڵە لە گوێگرتن بۆ نامەکان:", error);
            msgArea.innerHTML = '<div style="color:red; padding: 20px; text-align:center;">هەڵە لە بارکردنی نامەکان</div>';
        });
        
        console.log("گوێگر بۆ نامەکان ئامادە کرا");
    } catch (error) {
        console.error("هەڵە لە ئامادەکردنی گوێگری نامەکان:", error);
    }
}

// دروستکردنی یەک نامەی تاک لە ڕووکار
function renderSingleMessage(msg, container, chatUserId) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const myId = isAdmin ? 'admin' : (state.currentUser ? state.currentUser.uid : null);
    
    const isMe = msg.senderId === myId;
    const alignClass = isMe ? 'message-sent' : 'message-received';
    
    const div = document.createElement('div');
    div.className = `message-bubble ${alignClass}`;

    let contentHtml = '';
    
    if (msg.type === 'text') {
        contentHtml = `<p>${msg.content}</p>`;
    } else if (msg.type === 'image') {
        contentHtml = `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open('${msg.fileUrl}', '_blank')">`;
    } else if (msg.type === 'audio') {
        contentHtml = `
            <div class="audio-player">
                <button class="audio-control-btn" onclick="window.playAudio(this, '${msg.fileUrl}')"><i class="fas fa-play"></i></button>
                <div class="audio-progress"><div class="audio-progress-bar"></div></div>
            </div>
        `;
    } else if (msg.type === 'order') {
        const order = msg.orderDetails;
        if(order && order.items) {
            contentHtml = `
                <div class="order-bubble">
                    <div class="order-bubble-header"><i class="fas fa-receipt"></i> ${t('order_notification_title')}</div>
                    <div class="order-bubble-content">
                        ${order.items.map(i => `
                            <div class="order-bubble-item">
                                <span>${i.name && i.name[state.currentLanguage] ? i.name[state.currentLanguage] : (i.name.ku_sorani || i.name)} (x${i.quantity})</span>
                                <span>${(i.price * i.quantity).toLocaleString()}</span>
                            </div>
                        `).join('')}
                        <div class="order-bubble-total">${t('total_price')} ${order.total.toLocaleString()} د.ع</div>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `<p>داواکاری (هەڵە لە داتا)</p>`;
        }
    }

    // Time Formatting
    const date = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Status Icon
    let statusIcon = '';
    if (isMe) {
        const statusClass = msg.isRead ? 'seen' : '';
        const iconClass = msg.isRead ? 'fa-check-double' : 'fa-check';
        statusIcon = `<i class="fas ${iconClass} message-status-icon ${statusClass}"></i>`;
    }

    div.innerHTML = `
        ${contentHtml}
        <div class="message-time">
            ${timeStr} ${statusIcon}
        </div>
    `;

    container.appendChild(div);
}

// [ 💡 بەشی چاککراو: sendMessage 💡 ]
async function sendMessage(type, file = null, orderData = null) {
    console.log("هەوڵی ناردنی نامە:", type, file ? "بە فایل" : "", orderData ? "بە داواکاری" : "");
    
    if (!state.currentUser && sessionStorage.getItem('isAdmin') !== 'true') {
        console.error("هەڵە: بەکارهێنەر لە ژوورەوە نییە");
        showNotification('تکایە سەرەتا بچۆ ژوورەوە', 'error');
        openPopup('profileSheet');
        return;
    }

    // [ چاککراوە ] : دڵنیابوونەوە لەوەی ئینپوتەکە هەیە یان نا پێش ئەوەی .value لێ وەربگرین
    const textInput = document.getElementById('chatTextInput');
    let content = '';
    
    if (textInput) {
        content = textInput.value.trim();
    } else if (type === 'text') {
        console.error("توخمی نووسین نەدۆزرایەوە");
        showNotification('هەڵە: توخمی نووسین نەدۆزرایەوە', 'error');
        return;
    }
    
    // ئەگەر نامەکە دەق بێت و بەتاڵ بێت، نایەوێت بینێرێت
    if (type === 'text' && !content) {
        console.log("نامەی بەتاڵ، ناردن ڕاگیرا");
        return;
    }

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const senderId = isAdmin ? 'admin' : state.currentUser.uid;
    // If admin, sending TO activeChatUserId. If user, sending TO 'admin' (but doc is their own ID)
    const docId = isAdmin ? activeChatUserId : state.currentUser.uid;

    if (!docId) {
        console.error("ناسنامەی وەرگر نەدۆزرایەوە");
        showNotification("هەڵە: ناسنامەی وەرگر نەدۆزرایەوە", 'error');
        return;
    }

    // Prepare Message Data
    const messageData = {
        senderId: senderId,
        receiverId: isAdmin ? activeChatUserId : 'admin',
        type: type,
        content: type === 'text' ? content : '',
        timestamp: serverTimestamp(),
        isRead: false
    };

    try {
        // Clear Input immediately for UX (only if text input exists)
        if (type === 'text' && textInput) {
            textInput.value = '';
            const sendBtn = document.getElementById('chatSendBtn');
            const voiceBtn = document.getElementById('chatVoiceBtn');
            if(sendBtn) sendBtn.style.display = 'none';
            if(voiceBtn) voiceBtn.style.display = 'flex';
        }

        // Handle File Uploads
        if (file) {
            console.log("بارکردنی فایل:", file.type);
            showNotification('...Uploading', 'success');
            const storageRef = ref(storage, `chats/${docId}/${Date.now()}_${file.name || 'audio.webm'}`);
            
            try {
                const snapshot = await uploadBytes(storageRef, file);
                console.log("فایل بارکرا:", snapshot.ref.fullPath);
                
                const downloadURL = await getDownloadURL(snapshot.ref);
                console.log("لینکی بارکراو:", downloadURL);
                
                messageData.fileUrl = downloadURL;
            } catch (uploadError) {
                console.error("هەڵە لە بارکردنی فایل:", uploadError);
                showNotification('هەڵە لە بارکردنی فایل', 'error');
                return; // وەستاندنی کردار
            }
        }

        // Handle Orders
        if (type === 'order') {
            console.log("ناردنی داواکاری");
            messageData.orderDetails = orderData;
        }

        // 1. Add Message to Subcollection
        const messagesRef = collection(db, "chats", docId, "messages");
        await addDoc(messagesRef, messageData);
        console.log("نامە زیادکرا بۆ ساب-کۆڵێکشنی نامەکان");

        // 2. Update Main Chat Document (For Conversation List)
        const chatDocRef = doc(db, "chats", docId);
        const chatUpdateData = {
            lastMessage: type === 'text' ? content : (type === 'image' ? '📷 Image' : (type === 'audio' ? '🎤 Audio' : '📦 Order')),
            lastMessageTime: serverTimestamp(),
            isReadByAdmin: isAdmin, // If admin sent it, it's read by admin
            isReadByUser: !isAdmin  // If user sent it, it's read by user
        };

        // If user sending, make sure we have their profile info in the chat doc
        if (!isAdmin) {
            chatUpdateData.userInfo = {
                displayName: state.currentUser.displayName || 'Unknown',
                email: state.currentUser.email,
                uid: state.currentUser.uid
            };
        }

        await setDoc(chatDocRef, chatUpdateData, { merge: true });
        console.log("دۆکیومێنتی سەرەکی چات نوێکرایەوە");

        // ئەگەر سەرکەوتوو بوو، ڕاگەیاندن بۆ بەکارهێنەر
        showNotification('نامە نێردرا', 'success');
        
    } catch (error) {
        console.error("Send Message Error:", error);
        // پیشاندانی هەڵەی دیاریکراوتر
        if (error.code === 'permission-denied') {
            showNotification('ڕێگەپێدان نەدرا. تکایە دووبارە هەوڵبدەوە', 'error');
        } else if (error.code === 'unavailable') {
            showNotification('پەیوەندی لەگەڵ سێرڤەر نییە', 'error');
        } else {
            showNotification('هەڵەیەک ڕوویدا لە ناردنی نامە: ' + (error.message || ''), 'error');
        }
    }
}

// --- VOICE RECORDING ---

// مامەڵەکردن لەگەڵ تۆمارکردنی دەنگ
async function handleVoiceRecording() {
    console.log("مامەڵەکردن لەگەڵ تۆمارکردنی دەنگ");
    
    const btn = document.getElementById('chatVoiceBtn');
    if(!btn) {
        console.error("دوگمەی دەنگ نەدۆزرایەوە");
        return;
    }
    
    // ئەگەر تۆمارکەرمان نییە یان لە دۆخی ناچالاکیدایە، دەستپێبکە
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        // Start Recording
        try {
            console.log("داوای مۆڵەتی مایکرۆفۆن");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("مۆڵەتی مایکرۆفۆن وەرگیرا");
            
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                console.log("پارچەی دەنگی نوێ وەرگیرا:", e.data.size);
                audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                console.log("تۆمارکردنی دەنگ کۆتایی هات");
                if (audioChunks.length === 0 || audioChunks[0].size === 0) {
                    console.warn("هیچ داتای دەنگ تۆمار نەکرا");
                    showNotification('هیچ دەنگێک تۆمار نەکرا', 'error');
                    btn.classList.remove('recording');
                    return;
                }
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                console.log("قەبارەی Blob-ی دەنگ:", audioBlob.size);
                
                await sendMessage('audio', audioBlob);
                btn.classList.remove('recording');
            };

            mediaRecorder.start();
            console.log("تۆمارکردنی دەنگ دەستیپێکرد");
            
            btn.classList.add('recording');
            showNotification(t('recording'), 'success');

        } catch (err) {
            console.error("هەڵەی مایکرۆفۆن:", err);
            
            // پیشاندانی هەڵەی دیاریکراوتر
            if (err.name === 'NotAllowedError') {
                showNotification('دەسەڵاتی مایکڕۆفۆن نەدراوە. تکایە ڕێگە بدە بە بەکارهێنانی مایکرۆفۆن', 'error');
            } else if (err.name === 'NotFoundError') {
                showNotification('هیچ مایکرۆفۆنێک نەدۆزرایەوە', 'error');
            } else {
                showNotification('هەڵە لە مایکرۆفۆن: ' + err.message, 'error');
            }
        }
    } else {
        // Stop Recording
        console.log("ڕاگرتنی تۆمارکردنی دەنگ");
        mediaRecorder.stop();
        
        // ڕاگرتنی سترێمی مایکرۆفۆن
        try {
            const tracks = mediaRecorder.stream.getTracks();
            tracks.forEach(track => track.stop());
            console.log("سترێمی مایکرۆفۆن ڕاگیرا");
        } catch (error) {
            console.warn("هەڵە لە ڕاگرتنی سترێمی مایکرۆفۆن:", error);
        }
    }
}

// --- DIRECT ORDERS ---

// مامەڵەکردن لەگەڵ داواکاری ڕاستەوخۆ
async function handleDirectOrder() {
    console.log("مامەڵەکردن لەگەڵ داواکاری ڕاستەوخۆ");
    
    if (!state.currentUser) {
        console.log("بەکارهێنەر لەژوورەوە نییە، داواکاری ڕەتکرایەوە");
        showNotification('تکایە سەرەتا بچۆ ژوورەوە', 'error');
        openPopup('profileSheet');
        return;
    }

    if (state.cart.length === 0) {
        console.log("سەبەتە بەتاڵە، ناتوانرێت داواکاری بنێردرێت");
        showNotification(t('cart_empty'), 'error');
        return;
    }

    const confirmOrder = confirm("دڵنیایت دەتەوێت داواکارییەکەت بنێریت؟");
    if (!confirmOrder) {
        console.log("بەکارهێنەر پەشیمان بۆوە لە ناردنی داواکاری");
        return;
    }

    closeCurrentPopup(); // Close Cart Sheet

    // Prepare Order Data
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderData = {
        userId: state.currentUser.uid,
        userName: state.userProfile.name || state.currentUser.displayName,
        userPhone: state.userProfile.phone || '',
        userAddress: state.userProfile.address || '',
        items: state.cart,
        total: total,
        status: 'pending', // pending, accepted, rejected, delivered
        createdAt: serverTimestamp()
    };

    console.log("ئامادەکردنی داواکاری:", orderData);

    try {
        // 1. Save to 'orders' collection
        const orderRef = await addDoc(ordersCollection, orderData);
        console.log("داواکاری بە سەرکەوتوویی پاشەکەوتکرا:", orderRef.id);

        // 2. Send 'order' message to chat
        console.log("ناردنی داواکاری بە چات");
        // [ چاککراوە ] ئێستا ئەمە بێ کێشەیە چونکە sendMessage پشکنین دەکات
        await sendMessage('order', null, orderData);

        // 3. Clear Cart
        state.cart = [];
        saveCart();
        
        // Update UI
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
        console.log("سەبەتە پاککرایەوە");

        // 4. Navigate to Chat
        openChatPage();
        showNotification(t('order_submitted'), 'success');

    } catch (error) {
        console.error("هەڵەی داواکاری:", error);
        showNotification("هەڵە لە ناردنی داواکاری: " + (error.message || ''), 'error');
    }
}

// --- ADMIN CONVERSATION LIST ---

// گوێگرتن بۆ هەموو گفتوگۆکان (بۆ ئەدمین)
function subscribeToAllConversations() {
    console.log("گوێگرتن بۆ هەموو گفتوگۆکان (بۆ ئەدمین)");
    
    if (conversationsUnsubscribe) {
        conversationsUnsubscribe();
        conversationsUnsubscribe = null;
    }

    const q = query(chatsCollection, orderBy("lastMessageTime", "desc"));
    const container = document.getElementById('adminConversationList');
    
    if (!container) {
        console.error("لیستی گفتوگۆکان نەدۆزرایەوە");
        return;
    }

    try {
        conversationsUnsubscribe = onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center p-4">هیچ گفتوگۆیەک نییە.</p>`;
                return;
            }

            let unreadTotal = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const isUnread = !data.isReadByAdmin;
                if(isUnread) unreadTotal++;

                const date = data.lastMessageTime ? new Date(data.lastMessageTime.toDate()) : new Date();
                const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const div = document.createElement('div');
                div.className = `conversation-item ${isUnread ? 'unread' : ''}`;
                div.innerHTML = `
                    <div class="conversation-avatar"><i class="fas fa-user"></i></div>
                    <div class="conversation-info">
                        <div class="conversation-name">
                            ${data.userInfo?.displayName || 'User'}
                            <span class="conversation-time">${timeStr}</span>
                        </div>
                        <div class="conversation-last-msg">
                            ${isUnread ? `<span class="unread-count">New</span>` : ''}
                            ${data.lastMessage}
                        </div>
                    </div>
                `;
                div.onclick = () => {
                    console.log("کلیک لەسەر گفتوگۆ:", doc.id);
                    openChatPage(doc.id);
                };
                container.appendChild(div);
            });

            // Update Admin Badge in Settings
            const badge = document.getElementById('adminUnreadBadge');
            if(badge) {
                badge.textContent = unreadTotal;
                badge.style.display = unreadTotal > 0 ? 'inline-block' : 'none';
            }
            
            console.log("لیستی گفتوگۆکان نوێکرایەوە، " + unreadTotal + " نامەی نەخوێندراوە");
        }, error => {
            console.error("هەڵە لە گوێگرتن بۆ گفتوگۆکان:", error);
            container.innerHTML = '<p class="text-center p-4 text-danger">هەڵە لە گرتنی گفتوگۆکان</p>';
        });
        
        console.log("گوێگر بۆ لیستی گفتوگۆکان ئامادەکرا");
    } catch (error) {
        console.error("هەڵە لە ئامادەکردنی گوێگری گفتوگۆکان:", error);
    }
}

// --- HELPER: Read Receipts ---

// نیشانکردنی نامەکان وەک خوێندراو
async function markMessagesAsRead(msgDocs, chatUserId) {
    console.log("نیشانکردنی نامەکان وەک خوێندراو");
    
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const batch = writeBatch(db);
    let hasUpdates = false;

    msgDocs.forEach(docSnap => {
        const msg = docSnap.data();
        // If I am the receiver AND it is not read yet
        const amIReceiver = (isAdmin && msg.receiverId === 'admin') || (!isAdmin && msg.receiverId === state.currentUser?.uid);
        
        if (amIReceiver && !msg.isRead) {
            batch.update(docSnap.ref, { isRead: true });
            hasUpdates = true;
        }
    });

    // Also update main chat doc read status
    if (hasUpdates) {
        const chatDocRef = doc(db, "chats", chatUserId);
        const fieldToUpdate = isAdmin ? { isReadByAdmin: true } : { isReadByUser: true };
        batch.update(chatDocRef, fieldToUpdate);
        
        try {
            await batch.commit();
            console.log("نامەکان وەک خوێندراو نیشانکران");
        } catch (error) {
            console.error("هەڵە لە نیشانکردنی نامەکان وەک خوێندراو:", error);
        }
    }
}

// --- HELPER: Check Unread for Main Nav Badge ---
// پشکنینی نامە نەخوێندراوەکان بۆ نیشانی بن-ناف
function checkUnreadMessages() {
    console.log("پشکنینی نامە نەخوێندراوەکان");
    
    if (sessionStorage.getItem('isAdmin') === 'true') return; // Admin handled in list
    
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("پشکنینی نامە نەخوێندراوەکان بۆ بەکارهێنەر:", user.uid);
            
            // Listen to my chat doc
            onSnapshot(doc(db, "chats", user.uid), (docSnap) => {
                const badge = document.getElementById('chatBadge');
                if (badge) {
                    if (docSnap.exists() && !docSnap.data().isReadByUser) {
                        badge.classList.add('has-unread');
                        console.log("نامەی نەخوێندراوە هەیە");
                    } else {
                        badge.classList.remove('has-unread');
                        console.log("هیچ نامەیەکی نەخوێندراوە نییە");
                    }
                }
            }, error => {
                console.error("هەڵە لە گوێگرتن بۆ دۆخی نامە:", error);
            });
        }
    });
}

// Global Audio Player helper
window.playAudio = function(btn, url) {
    console.log("لێدانی دەنگ:", url);
    
    const audio = new Audio(url);
    const player = btn.closest('.audio-player');
    const progressBar = player.querySelector('.audio-progress-bar');
    const icon = btn.querySelector('i');

    if (window.currentAudio && window.currentAudio !== audio) {
        window.currentAudio.pause();
        // Reset icons would be complex without ID, simplified for now
    }
    window.currentAudio = audio;

    icon.className = 'fas fa-pause';
    
    audio.play().catch(error => {
        console.error("هەڵە لە لێدانی دەنگ:", error);
        showNotification("هەڵە لە لێدانی دەنگ", 'error');
        icon.className = 'fas fa-play';
    });

    audio.ontimeupdate = () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${percent}%`;
    };

    audio.onended = () => {
        icon.className = 'fas fa-play';
        progressBar.style.width = '0%';
    };
};

// Navigation helper for app-ui.js to use
function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// زیادکردنی گوێگر بۆ کاتێک DOM ئامادەیە بۆ دڵنیابوونەوە لەوەی هەموو فانکشنەکانمان کاردەکەن
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM ئامادەیە، چاککردنی سیستەمی چات");
    
    if (!chatPageInitialized && document.getElementById('chatPage')) {
        setupChatInputHandlers();
        chatPageInitialized = true;
    }
});