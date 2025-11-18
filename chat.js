// chat.js
import { 
    db, auth, storage, 
    chatsCollection, ordersCollection, usersCollection, 
    serverTimestamp,
    ref, uploadBytes, getDownloadURL 
} from './app-setup.js';

import { 
    state, t, saveCart, authReady
} from './app-core.js';

import { 
    showNotification, openPopup, closeCurrentPopup
} from './app-ui.js';

import { 
    collection, addDoc, query, where, orderBy, onSnapshot, 
    doc, setDoc, updateDoc, getDoc, limit, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let messagesUnsubscribe = null;
let conversationsUnsubscribe = null;
let activeChatUserId = null; 

let mediaRecorder = null;
let audioChunks = [];
let isRecordingCancelled = false; 
let recordingTimerInterval = null; 
let recordingStartTime = null; 

export function initChatSystem() {
    setupChatUI();
    setupChatListeners();
    checkUnreadMessages();
}

function setupChatUI() {
    const cartActions = document.getElementById('cartActions');
    if (cartActions) {
        const existingBtn = cartActions.querySelector('.direct-order-btn');
        if(existingBtn) existingBtn.remove();

        const directOrderBtn = document.createElement('button');
        directOrderBtn.className = 'whatsapp-btn direct-order-btn'; 
        directOrderBtn.style.backgroundColor = 'var(--primary-color)';
        directOrderBtn.style.marginTop = '10px';
        directOrderBtn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${t('submit_order_direct')}</span>`;
        directOrderBtn.onclick = handleDirectOrder;
        
        if (cartActions.firstChild) {
            cartActions.insertBefore(directOrderBtn, cartActions.firstChild);
        } else {
            cartActions.appendChild(directOrderBtn);
        }
    }

    const chatPage = document.getElementById('chatPage');
    
    if (chatPage && !chatPage.querySelector('.chat-container')) {
        chatPage.innerHTML = `
            <div class="chat-container">
                <div class="chat-header" id="chatPageHeader">
                    <div style="display:flex; align-items:center; gap:10px; width: 100%;">
                        <button id="chatBackBtn" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--primary-color); padding: 5px;">
                            <i class="fas fa-arrow-right"></i>
                        </button>

                        <div class="conversation-avatar" id="chatHeaderAvatar"><i class="fas fa-user"></i></div>
                        <div style="flex: 1;">
                            <div class="conversation-name" id="chatHeaderName">User</div>
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
                    
                    <button class="chat-action-btn" id="chatTrashBtn"><i class="fas fa-trash"></i></button>
                    
                    <input type="text" class="chat-input" id="chatTextInput" placeholder="${t('type_message')}">
                    
                    <div id="chatTimer">00:00</div>
                    
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
    }
    
    const adminChatListPage = document.getElementById('adminChatListPage');
    if (adminChatListPage && !adminChatListPage.querySelector('.conversation-list-container')) {
        adminChatListPage.innerHTML = `
            <div class="conversation-list-container" style="padding-top: 80px;">
                <div class="conversation-list" id="adminConversationList">
                    <p style="text-align: center; padding: 20px; color: var(--dark-gray);">...بارکردنی گفتوگۆکان</p>
                </div>
            </div>
        `;
    }
}

function setupChatListeners() {
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) {
        chatBtn.onclick = () => {
            openChatPage();
        };
    }

    const adminChatsBtn = document.getElementById('adminChatsBtn');
    if (adminChatsBtn) {
        adminChatsBtn.onclick = () => {
            openAdminChatList();
        };
    }

    document.addEventListener('click', (e) => {
        const backBtn = e.target.closest('#chatBackBtn');
        if (backBtn) {
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';
            history.back();
        }
    });

    setTimeout(() => {
        const textInput = document.getElementById('chatTextInput');
        const sendBtn = document.getElementById('chatSendBtn');
        const voiceBtn = document.getElementById('chatVoiceBtn');
        const imageBtn = document.getElementById('chatImageBtn');
        const imageInput = document.getElementById('chatImageInput');
        const trashBtn = document.getElementById('chatTrashBtn');

        if (textInput) {
            textInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val.length > 0) {
                    if(sendBtn) sendBtn.style.display = 'flex';
                    if(voiceBtn) voiceBtn.style.display = 'none';
                } else {
                    if(sendBtn) sendBtn.style.display = 'none';
                    if(voiceBtn) voiceBtn.style.display = 'flex';
                }
            });

            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage('text');
            });
        }

        if (sendBtn) sendBtn.onclick = () => sendMessage('text');
        
        if (voiceBtn) {
            voiceBtn.onclick = handleVoiceRecording; 
        }
        
        if (trashBtn) {
            trashBtn.onclick = cancelRecording;
        }

        if (imageBtn && imageInput) {
            imageBtn.onclick = () => imageInput.click();
            imageInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    sendMessage('image', e.target.files[0]);
                }
            };
        }
    }, 1000);
}

export async function openChatPage(targetUserId = null, targetUserName = null) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    // ئەگەر ئەدمین بێت و User دیاری نەکرابێت، لیستی چاتەکان دەکاتەوە
    if (isAdmin && !targetUserId) {
        openAdminChatList();
        return;
    }
    
    // دڵنیابوونەوە لەوەی UIـی چات بوونی هەیە
    setupChatUI();

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';

    if (window.location.hash !== '#chat' && !targetUserId && !isAdmin) { 
        history.pushState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', '#chat');
    }
    
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'chatPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    const msgArea = document.getElementById('chatMessagesArea');
    if (msgArea) {
        msgArea.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%; color:var(--dark-gray);"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        msgArea.style.display = 'flex';
    }

    await authReady; 

    if (!state.currentUser && !isAdmin) {
        const loginReq = document.getElementById('chatLoginRequired');
        const inputArea = document.getElementById('chatInputArea');
        
        if(loginReq) loginReq.style.display = 'flex';
        if(inputArea) inputArea.style.display = 'none';
        if(msgArea) msgArea.style.display = 'none';
        return;
    }

    const loginReq = document.getElementById('chatLoginRequired');
    const inputArea = document.getElementById('chatInputArea');

    if(loginReq) loginReq.style.display = 'none';
    if(inputArea) inputArea.style.display = 'flex';
    
    if(msgArea) {
        msgArea.innerHTML = ''; 
        // لێرەدا hidden لادەبەین بۆ ئەوەی هەر لە سەرەتاوە شوێنەکە ئامادە بێت
        msgArea.classList.remove('hidden'); 
    }

    if (isAdmin) {
        activeChatUserId = targetUserId;
        const headerName = document.getElementById('chatHeaderName');
        
        const backBtn = document.getElementById('chatBackBtn');
        if(backBtn) backBtn.style.display = 'flex'; 

        if(headerName) {
            if (targetUserName) {
                headerName.textContent = targetUserName;
            } else {
                headerName.textContent = "...";
                getDoc(doc(db, "chats", targetUserId)).then(docSnap => {
                    if(docSnap.exists()) {
                        const chatData = docSnap.data();
                        headerName.textContent = chatData.userInfo?.displayName || "بەکارهێنەر";
                    } else {
                        headerName.textContent = "بەکارهێنەر";
                    }
                }).catch(() => {
                    headerName.textContent = "بەکارهێنەر";
                });
            }
        }
    } else {
        activeChatUserId = state.currentUser.uid; 
        const headerName = document.getElementById('chatHeaderName');
        if(headerName) headerName.textContent = t('admin_badge');
        
        const backBtn = document.getElementById('chatBackBtn');
        if(backBtn) backBtn.style.display = 'flex'; 
    }

    // بانگکردنی subscribe دوای ئەوەی هەموو شتێک ئامادەیە
    subscribeToMessages(activeChatUserId);
}

function openAdminChatList() {
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';

    history.pushState({ type: 'page', id: 'adminChatListPage', title: t('conversations_title') }, '', '#admin-chats');
    
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'adminChatListPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });
    
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) headerTitle.textContent = t('conversations_title');

    subscribeToAllConversations();
}

function subscribeToMessages(chatUserId) {
    if (messagesUnsubscribe) messagesUnsubscribe();

    const messagesRef = collection(db, "chats", chatUserId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    // [ 💡 چاککرا ] - ئێستا ڕاستەوخۆ Elementـەکە دەهێنێت، نەک لە دەرەوەی Scope
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        const msgArea = document.getElementById('chatMessagesArea');
        if(!msgArea) return; // ئەگەر Elementـەکە نەبوو، هیچ مەکە

        msgArea.innerHTML = ''; 
        
        if (snapshot.empty) {
            msgArea.innerHTML = `<div class="empty-chat-state"><i class="fas fa-comments"></i><p>${t('no_messages')}</p></div>`;
            return;
        }

        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            renderSingleMessage(msg, msgArea, chatUserId);
        });

        msgArea.scrollTop = msgArea.scrollHeight;
        markMessagesAsRead(snapshot.docs, chatUserId);
    });
}

function renderSingleMessage(msg, container, chatUserId) {
    const isMe = msg.senderId === (sessionStorage.getItem('isAdmin') === 'true' ? 'admin' : (state.currentUser ? state.currentUser.uid : ''));
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
                <button class="audio-control-btn" onclick="playAudio(this, '${msg.fileUrl}')"><i class="fas fa-play"></i></button>
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
                        ${order.items.map(i => {
                            const shipping = i.shippingCost || 0;
                            const singleTotal = (i.price * i.quantity) + shipping;
                            
                            let priceDisplay = '';
                            if (shipping > 0) {
                                priceDisplay = `
                                    <div style="font-size:11px; color:#555;">
                                        (${i.price.toLocaleString()} x ${i.quantity}) + <span style="color:#e53e3e;">${shipping.toLocaleString()} (گەیاندن)</span>
                                    </div>
                                    <div style="font-weight:bold; color:var(--primary-color);">
                                        = ${singleTotal.toLocaleString()} د.ع
                                    </div>
                                `;
                            } else {
                                priceDisplay = `
                                    <div style="font-size:11px; color:#555;">
                                        (${i.price.toLocaleString()} x ${i.quantity}) + <span style="color:#38a169;">(بێ بەرامبەر)</span>
                                    </div>
                                    <div style="font-weight:bold; color:var(--primary-color);">
                                        = ${singleTotal.toLocaleString()} د.ع
                                    </div>
                                `;
                            }

                            return `
                            <div class="order-bubble-item" style="display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <img src="${i.image || 'https://placehold.co/50'}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover; border: 1px solid #eee;">
                                <div style="flex: 1; overflow: hidden;">
                                    <div style="font-weight: bold; font-size: 13px;">
                                        ${i.name && i.name[state.currentLanguage] ? i.name[state.currentLanguage] : (i.name.ku_sorani || i.name)}
                                    </div>
                                    
                                    ${priceDisplay}
                                    
                                    <div style="font-size: 12px; color: #666; margin-top:2px;">
                                        ژمارە: <span style="color:black; font-weight:bold;">${i.quantity}</span>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                        
                        <div class="order-bubble-total" style="margin-top: 10px; font-size: 16px; text-align:center; background:#f1f1f1; padding:5px; border-radius:4px;">
                            کۆی گشتی: ${order.total.toLocaleString()} د.ع
                        </div>

                        <div style="background-color: #fff; border:1px solid #eee; padding: 8px; border-radius: 6px; margin-top: 10px; font-size: 12px; color: #444;">
                            <div style="margin-bottom: 4px;"><i class="fas fa-user" style="width: 15px; text-align: center;"></i> ${order.userName || 'ناو نەنوسراوە'}</div>
                            <div style="margin-bottom: 4px;"><i class="fas fa-phone" style="width: 15px; text-align: center;"></i> <a href="tel:${order.userPhone}" style="color: inherit; text-decoration: none;">${order.userPhone || 'ژمارە نییە'}</a></div>
                            <div><i class="fas fa-map-marker-alt" style="width: 15px; text-align: center;"></i> ${order.userAddress || 'ناونیشان نییە'}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `<p>داواکاری (هەڵە لە داتا)</p>`;
        }
    }

    const date = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
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

async function sendMessage(type, file = null, orderData = null) {
    if (!state.currentUser && sessionStorage.getItem('isAdmin') !== 'true') return;

    const textInput = document.getElementById('chatTextInput');
    let content = '';
    
    if (textInput) {
        content = textInput.value.trim();
    }
    
    if (type === 'text' && !content) return;

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const senderId = isAdmin ? 'admin' : state.currentUser.uid;
    const docId = isAdmin ? activeChatUserId : state.currentUser.uid;

    if (!docId) {
        console.error("No recipient ID found.");
        return;
    }

    const messageData = {
        senderId: senderId,
        receiverId: isAdmin ? activeChatUserId : 'admin',
        type: type,
        content: type === 'text' ? content : '',
        timestamp: serverTimestamp(),
        isRead: false
    };

    try {
        if (type === 'text' && textInput) {
            textInput.value = '';
            const sendBtn = document.getElementById('chatSendBtn');
            const voiceBtn = document.getElementById('chatVoiceBtn');
            if(sendBtn) sendBtn.style.display = 'none';
            if(voiceBtn) voiceBtn.style.display = 'flex';
        }

        if (file) {
            showNotification('...Uploading', 'success');
            const storageRef = ref(storage, `chats/${docId}/${Date.now()}_${file.name || 'audio.webm'}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            messageData.fileUrl = downloadURL;
        }

        if (type === 'order') {
            messageData.orderDetails = orderData;
        }

        const messagesRef = collection(db, "chats", docId, "messages");
        await addDoc(messagesRef, messageData);

        const chatDocRef = doc(db, "chats", docId);
        const chatUpdateData = {
            lastMessage: type === 'text' ? content : (type === 'image' ? '📷 Image' : (type === 'audio' ? '🎤 Audio' : '📦 Order')),
            lastMessageTime: serverTimestamp(),
            isReadByAdmin: isAdmin, 
            isReadByUser: !isAdmin  
        };

        if (!isAdmin && state.currentUser) {
            chatUpdateData.userInfo = {
                displayName: state.currentUser.displayName || 'Unknown',
                email: state.currentUser.email,
                uid: state.currentUser.uid
            };
        }

        await setDoc(chatDocRef, chatUpdateData, { merge: true });

    } catch (error) {
        console.error("Send Message Error:", error);
        showNotification(t('error_generic'), 'error');
    }
}

function startTimer() {
    const timerEl = document.getElementById('chatTimer');
    if (!timerEl) return;
    
    recordingStartTime = Date.now();
    timerEl.textContent = '00:00';
    
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    
    recordingTimerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        timerEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function resetRecordingUI() {
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
    recordingStartTime = null;
    audioChunks = [];
    isRecordingCancelled = false;
    mediaRecorder = null; 

    const inputArea = document.getElementById('chatInputArea');
    if (inputArea) inputArea.classList.remove('is-recording');

    const voiceBtn = document.getElementById('chatVoiceBtn');
    const voiceBtnIcon = voiceBtn ? voiceBtn.querySelector('i') : null;

    if (voiceBtn) {
        voiceBtn.classList.remove('chat-send-btn'); 
    }
    if (voiceBtnIcon) voiceBtnIcon.className = 'fas fa-microphone';
}

function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        isRecordingCancelled = true; 
        mediaRecorder.stop(); 
    }
}

async function handleVoiceRecording() {
    const btn = document.getElementById('chatVoiceBtn');
    if(!btn) return;
    
    const btnIcon = btn.querySelector('i');
    const inputArea = document.getElementById('chatInputArea');
    
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            isRecordingCancelled = false; 

            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            
            mediaRecorder.onstop = async () => {
                if (!isRecordingCancelled) {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (audioBlob.size > 1000) { 
                        await sendMessage('audio', audioBlob);
                    }
                }
                resetRecordingUI();
            };

            mediaRecorder.start();
            
            if (inputArea) inputArea.classList.add('is-recording'); 

            btn.classList.add('chat-send-btn'); 
            if (btnIcon) btnIcon.className = 'fas fa-paper-plane';

            startTimer(); 

        } catch (err) {
            console.error("Mic Error:", err);
            showNotification('دەسەڵاتی مایکڕۆفۆن نەدراوە', 'error');
            resetRecordingUI(); 
        }
    } 
    else if (mediaRecorder.state === 'recording') {
        isRecordingCancelled = false; 
        mediaRecorder.stop(); 
    }
}


async function handleDirectOrder() {
    if (!state.currentUser) {
        showNotification('تکایە سەرەتا بچۆ ژوورەوە', 'error');
        openPopup('profileSheet');
        return;
    }

    if (state.cart.length === 0) {
        showNotification(t('cart_empty'), 'error');
        return;
    }

    if (!state.userProfile.phone || !state.userProfile.address) {
        showNotification('تکایە سەرەتا زانیارییەکانت (ناونیشان و تەلەفۆن) لە پڕۆفایل پڕبکەرەوە', 'error');
        openPopup('profileSheet');
        return;
    }

    window.globalAdminTools.openPopup('orderConfirmationModal', 'modal');

    const confirmBtn = document.getElementById('confirmOrderBtn');
    const cancelBtn = document.getElementById('cancelOrderBtn');

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newCancelBtn.onclick = () => {
        window.globalAdminTools.closeCurrentPopup();
    };

    newConfirmBtn.onclick = async () => {
        history.go(-2); 
        setTimeout(() => {
             processOrderSubmission();
        }, 150);
    };
}

async function processOrderSubmission() {
    const total = state.cart.reduce((sum, item) => {
        return sum + (item.price * item.quantity) + (item.shippingCost || 0);
    }, 0);
    
    const orderData = {
        userId: state.currentUser.uid,
        userName: state.userProfile.name || state.currentUser.displayName, 
        userPhone: state.userProfile.phone || '', 
        userAddress: state.userProfile.address || '', 
        items: state.cart,
        total: total,
        status: 'pending', 
        createdAt: Date.now() 
    };

    try {
        await addDoc(ordersCollection, orderData);
        await sendMessage('order', null, orderData);

        state.cart = [];
        saveCart();
        
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');

        openChatPage();
        showNotification(t('order_submitted'), 'success');

    } catch (error) {
        console.error("Order Error:", error);
        showNotification(t('error_generic'), 'error');
    }
}

function subscribeToAllConversations() {
    if (conversationsUnsubscribe) conversationsUnsubscribe();

    const q = query(chatsCollection, orderBy("lastMessageTime", "desc"));
    const container = document.getElementById('adminConversationList');

    conversationsUnsubscribe = onSnapshot(q, (snapshot) => {
        if(!container) return;
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = `<p class="text-center p-4" style="color:var(--dark-gray);">${t('no_messages')}</p>`;
            return;
        }

        let unreadTotal = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const isUnread = !data.isReadByAdmin;
            if(isUnread) unreadTotal++;

            const date = data.lastMessageTime ? new Date(data.lastMessageTime.toDate()) : new Date();
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const displayName = data.userInfo?.displayName || 'بەکارهێنەر';

            const div = document.createElement('div');
            div.className = `conversation-item ${isUnread ? 'unread' : ''}`;
            div.innerHTML = `
                <div class="conversation-avatar"><i class="fas fa-user"></i></div>
                <div class="conversation-info">
                    <div class="conversation-name">
                        ${displayName}
                        <span class="conversation-time">${timeStr}</span>
                    </div>
                    <div class="conversation-last-msg">
                        ${isUnread ? `<span class="unread-count">نوێ</span>` : ''}
                        ${data.lastMessage}
                    </div>
                </div>
            `;
            div.onclick = () => {
                openChatPage(doc.id, displayName);
            };
            container.appendChild(div);
        });

        const badge = document.getElementById('adminUnreadBadge');
        if(badge) {
            badge.textContent = unreadTotal;
            badge.style.display = unreadTotal > 0 ? 'inline-block' : 'none';
        }
    });
}

async function markMessagesAsRead(msgDocs, chatUserId) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const batch = writeBatch(db);
    let hasUpdates = false;

    msgDocs.forEach(docSnap => {
        const msg = docSnap.data();
        const amIReceiver = (isAdmin && msg.receiverId === 'admin') || (!isAdmin && msg.receiverId === state.currentUser?.uid);
        
        if (amIReceiver && !msg.isRead) {
            batch.update(docSnap.ref, { isRead: true });
            hasUpdates = true;
        }
    });

    if (hasUpdates) {
        const chatDocRef = doc(db, "chats", chatUserId);
        const fieldToUpdate = isAdmin ? { isReadByAdmin: true } : { isReadByUser: true };
        batch.update(chatDocRef, fieldToUpdate);
        
        await batch.commit();
    }
}

function checkUnreadMessages() {
    if (sessionStorage.getItem('isAdmin') === 'true') return; 
    
    auth.onAuthStateChanged(user => {
        if (user) {
            onSnapshot(doc(db, "chats", user.uid), (docSnap) => {
                const badge = document.getElementById('chatBadge');
                if (badge) {
                    if (docSnap.exists() && !docSnap.data().isReadByUser) {
                        badge.classList.add('has-unread');
                    } else {
                        badge.classList.remove('has-unread');
                    }
                }
            });
        }
    });
}

window.playAudio = function(btn, url) {
    const audio = new Audio(url);
    const player = btn.closest('.audio-player');
    const progressBar = player.querySelector('.audio-progress-bar');
    const icon = btn.querySelector('i');

    if (window.currentAudio && window.currentAudio !== audio) {
        window.currentAudio.pause();
    }
    window.currentAudio = audio;

    icon.className = 'fas fa-pause';
    audio.play();

    audio.ontimeupdate = () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${percent}%`;
    };

    audio.onended = () => {
        icon.className = 'fas fa-play';
        progressBar.style.width = '0%';
    };
};
