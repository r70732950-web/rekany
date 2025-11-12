import { 
    db, auth, storage, 
    chatsCollection, ordersCollection, 
    state, t, showNotification, 
    messagesBtn, chatPage, messagesList, chatInput, chatSendBtn, chatMicBtn, chatAttachBtn, chatFileInput, 
    attachmentPreview, attachmentImg, removeAttachmentBtn, 
    recordingUI, recordTimer, cancelRecordBtn, sendRecordBtn,
    adminChatListPage, adminChatUsersList, openAdminChatsBtn, adminUnreadBadge, totalUnreadBadge,
    loginModal, openPopup, closeCurrentPopup
} from './app-setup.js';

import { 
    doc, addDoc, setDoc, getDoc, updateDoc, onSnapshot, 
    collection, query, orderBy, where, serverTimestamp, limit 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

let unsubscribeMessages = null;
let unsubscribeAdminList = null;
let audioRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let currentChatUserId = null; // For Admin to know which user they are talking to

// =========================================
// 1. Initialization & Event Listeners
// =========================================

export function initChatSystem() {
    console.log("Initializing Chat System...");

    // User: Open Chat Button
    if(messagesBtn) {
        messagesBtn.addEventListener('click', () => {
            if (!state.currentUser) {
                showNotification(t('user_login_error'), 'error');
                openPopup('loginModal', 'modal');
                return;
            }
            openUserChat();
        });
    }

    // Admin: Open Chat List
    if(openAdminChatsBtn) {
        openAdminChatsBtn.addEventListener('click', () => {
            openAdminChatList();
        });
    }

    // Send Text Message
    if(chatSendBtn) {
        chatSendBtn.addEventListener('click', () => handleSendMessage());
    }

    // File Attachment
    if(chatAttachBtn) {
        chatAttachBtn.addEventListener('click', () => chatFileInput.click());
    }
    
    if(chatFileInput) {
        chatFileInput.addEventListener('change', (e) => handleFileSelection(e));
    }

    if(removeAttachmentBtn) {
        removeAttachmentBtn.addEventListener('click', clearAttachment);
    }

    // Voice Recording
    if(chatMicBtn) {
        chatMicBtn.addEventListener('click', startRecording);
    }
    if(cancelRecordBtn) {
        cancelRecordBtn.addEventListener('click', cancelRecording);
    }
    if(sendRecordBtn) {
        sendRecordBtn.addEventListener('click', stopAndSendRecording);
    }

    // Input Typing Handler (Toggle Mic/Send button)
    if(chatInput) {
        chatInput.addEventListener('input', () => {
            const hasText = chatInput.value.trim().length > 0;
            toggleSendMic(hasText);
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    // Global Listener for Unread Badge (User Side)
    listenForTotalUnread();
}

function toggleSendMic(showSend) {
    if (showSend || attachmentPreview.style.display === 'flex') {
        chatSendBtn.style.display = 'flex';
        chatMicBtn.style.display = 'none';
    } else {
        chatSendBtn.style.display = 'none';
        chatMicBtn.style.display = 'flex';
    }
}

// =========================================
// 2. User Chat Logic
// =========================================

function openUserChat() {
    const userId = state.currentUser.uid;
    currentChatUserId = userId; // User chatting with themselves (Admin sees this ID)
    
    // UI Setup
    document.getElementById('mainPage').classList.remove('page-active');
    document.getElementById('mainPage').classList.add('page-hidden');
    
    // Ensure Settings page is hidden if we came from there
    if(document.getElementById('settingsPage')) {
        document.getElementById('settingsPage').classList.remove('page-active');
        document.getElementById('settingsPage').classList.add('page-hidden');
    }

    chatPage.classList.remove('page-hidden');
    chatPage.classList.add('page-active');
    
    // Setup Header
    const chatHeaderName = chatPage.querySelector('.chat-user-name');
    const chatHeaderStatus = chatPage.querySelector('.status-text');
    chatHeaderName.textContent = t('support_name');
    chatHeaderStatus.textContent = t('online_status'); 
    chatHeaderStatus.classList.add('online');

    // Back Button Logic
    const backBtn = document.getElementById('chatBackBtn');
    backBtn.onclick = () => {
        chatPage.classList.remove('page-active');
        chatPage.classList.add('page-hidden');
        document.getElementById('mainPage').classList.add('page-active');
        document.getElementById('mainPage').classList.remove('page-hidden');
        if (unsubscribeMessages) unsubscribeMessages();
    };

    loadMessages(userId);
    markMessagesAsRead(userId, 'admin'); // Mark admin messages as read by user
}

// =========================================
// 3. Admin Chat Logic
// =========================================

function openAdminChatList() {
    adminChatListPage.classList.remove('page-hidden');
    adminChatListPage.classList.add('page-active');
    
    const backBtn = document.getElementById('adminChatListBackBtn');
    backBtn.onclick = () => {
        adminChatListPage.classList.remove('page-active');
        adminChatListPage.classList.add('page-hidden');
        if (unsubscribeAdminList) unsubscribeAdminList();
    };

    loadAdminChatUsers();
}

function loadAdminChatUsers() {
    const q = query(chatsCollection, orderBy('lastMessageTime', 'desc'));
    
    unsubscribeAdminList = onSnapshot(q, (snapshot) => {
        adminChatUsersList.innerHTML = '';
        let totalUnread = 0;

        if (snapshot.empty) {
            adminChatUsersList.innerHTML = '<p style="text-align:center; padding:20px;">هیچ چاتێک نییە.</p>';
            return;
        }

        snapshot.forEach(chatDoc => {
            const chatData = chatDoc.data();
            const userId = chatDoc.id;
            const unreadCount = chatData.adminUnreadCount || 0;
            totalUnread += unreadCount;

            const timeString = chatData.lastMessageTime ? new Date(chatData.lastMessageTime.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

            const div = document.createElement('div');
            div.className = `admin-chat-list-item ${unreadCount > 0 ? 'unread' : ''}`;
            div.innerHTML = `
                <div class="user-avatar-circle">
                    <i class="fas fa-user"></i>
                    ${unreadCount > 0 ? `<span class="unread-count-badge" style="position:absolute; top:0; right:0;">${unreadCount}</span>` : ''}
                </div>
                <div class="chat-preview-info">
                    <div class="chat-preview-top">
                        <span class="chat-preview-name">${chatData.userName || 'بەکارهێنەر'}</span>
                        <span class="chat-preview-time">${timeString}</span>
                    </div>
                    <div class="chat-preview-msg">${chatData.lastMessage || 'وێنە/دەنگ'}</div>
                </div>
            `;
            
            div.addEventListener('click', () => openAdminChatWithUser(userId, chatData.userName));
            adminChatUsersList.appendChild(div);
        });

        if (adminUnreadBadge) adminUnreadBadge.textContent = totalUnread;
    });
}

function openAdminChatWithUser(userId, userName) {
    currentChatUserId = userId; // Admin chatting with this specific user
    
    chatPage.classList.remove('page-hidden');
    chatPage.classList.add('page-active');
    
    // Setup Header for Admin
    const chatHeaderName = chatPage.querySelector('.chat-user-name');
    const chatHeaderStatus = chatPage.querySelector('.status-text');
    chatHeaderName.textContent = userName;
    chatHeaderStatus.textContent = 'User'; // Can be improved with real online status
    
    const backBtn = document.getElementById('chatBackBtn');
    backBtn.onclick = () => {
        chatPage.classList.remove('page-active');
        chatPage.classList.add('page-hidden');
        if (unsubscribeMessages) unsubscribeMessages();
        currentChatUserId = null;
    };

    loadMessages(userId);
    markMessagesAsRead(userId, 'user'); // Mark user messages as read by admin
}

// =========================================
// 4. Core Messaging Logic
// =========================================

function loadMessages(userId) {
    if (unsubscribeMessages) unsubscribeMessages();
    
    const messagesRef = collection(db, `chats/${userId}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesList.innerHTML = '';
        snapshot.forEach(doc => {
            renderMessage(doc.data());
        });
        messagesList.scrollTop = messagesList.scrollHeight;
    });
}

function renderMessage(msg) {
    const isMe = msg.senderId === state.currentUser.uid;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    // If I am admin, and senderId is NOT adminUID -> It's received.
    // If I am user, and senderId is ME -> It's sent.
    
    // Logic correction: 
    // msg.senderId is the actual UID of the sender.
    // state.currentUser.uid is who is viewing the screen.
    
    const isSentByViewer = msg.senderId === state.currentUser.uid;
    
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isSentByViewer ? 'message-sent' : 'message-received'}`;
    
    let contentHtml = '';
    const time = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';

    switch(msg.type) {
        case 'text':
            contentHtml = `<p>${msg.text}</p>`;
            break;
        case 'image':
            contentHtml = `<img src="${msg.fileUrl}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open(this.src)">`;
            break;
        case 'audio':
            contentHtml = `<audio controls src="${msg.fileUrl}" class="audio-message-player"></audio>`;
            break;
        case 'product':
            // Need to parse product data if stored, or just text
            contentHtml = `<p>${msg.text}</p>`; // Fallback
            break;
    }

    bubble.innerHTML = `
        ${contentHtml}
        <div class="message-time">
            ${time}
            ${isSentByViewer ? `<i class="fas fa-check-double message-status-icon ${msg.isRead ? 'read' : ''}"></i>` : ''}
        </div>
    `;
    
    messagesList.appendChild(bubble);
}

async function handleSendMessage() {
    if (!currentChatUserId) return;
    
    const text = chatInput.value.trim();
    const file = chatFileInput.files[0];
    const isAudio = false; // Handled separately

    if (!text && !file) return;

    let messageData = {
        senderId: state.currentUser.uid,
        createdAt: serverTimestamp(),
        isRead: false
    };

    try {
        // 1. Upload File if exists
        if (file) {
            const type = file.type.startsWith('image') ? 'image' : 'file';
            const url = await uploadFile(file, `chat_media/${currentChatUserId}/${Date.now()}_${file.name}`);
            messageData.type = type;
            messageData.fileUrl = url;
            messageData.text = type === 'image' ? '📷 وێنە' : 'فایل';
        } else {
            messageData.type = 'text';
            messageData.text = text;
        }

        // 2. Save to Firestore Subcollection
        const messagesRef = collection(db, `chats/${currentChatUserId}/messages`);
        await addDoc(messagesRef, messageData);

        // 3. Update Chat Metadata (Last Message, Counters)
        const chatDocRef = doc(db, `chats/${currentChatUserId}`);
        const isAdminSender = sessionStorage.getItem('isAdmin') === 'true';
        
        let updateData = {
            lastMessage: messageData.text,
            lastMessageTime: serverTimestamp(),
            userName: isAdminSender ? (await getChatUserName(currentChatUserId)) : (state.currentUser.displayName || 'بەکارهێنەر')
        };

        // Increment unread counters
        const chatDocSnap = await getDoc(chatDocRef);
        if (chatDocSnap.exists()) {
            const currentData = chatDocSnap.data();
            if (isAdminSender) {
                updateData.userUnreadCount = (currentData.userUnreadCount || 0) + 1;
            } else {
                updateData.adminUnreadCount = (currentData.adminUnreadCount || 0) + 1;
            }
        } else {
            // Create new chat doc if not exists
            updateData.adminUnreadCount = 1;
            updateData.createdAt = serverTimestamp();
        }

        await setDoc(chatDocRef, updateData, { merge: true });

        // Cleanup UI
        chatInput.value = '';
        clearAttachment();
        toggleSendMic(false);

    } catch (error) {
        console.error("Error sending message:", error);
        showNotification('هەڵە لە ناردنی نامە', 'error');
    }
}

async function getChatUserName(userId) {
    // Helper to keep the user name consistent
    const docSnap = await getDoc(doc(db, `chats/${userId}`));
    if (docSnap.exists()) return docSnap.data().userName;
    return 'بەکارهێنەر';
}

// =========================================
// 5. Voice Recording Logic
// =========================================

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            audioRecorder = new MediaRecorder(stream);
            audioRecorder.start();
            state.isRecording = true;
            
            // UI Changes
            recordingUI.style.display = 'flex';
            document.querySelector('.chat-input-wrapper').style.visibility = 'hidden';
            chatMicBtn.style.display = 'none';

            let seconds = 0;
            recordTimer.textContent = "00:00";
            recordingInterval = setInterval(() => {
                seconds++;
                const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
                const secs = (seconds % 60).toString().padStart(2, '0');
                recordTimer.textContent = `${mins}:${secs}`;
            }, 1000);

            audioChunks = [];
            audioRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            audioRecorder.addEventListener("stop", async () => {
                clearInterval(recordingInterval);
                if (!state.isRecording) return; // Cancelled

                const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
                await sendAudioMessage(audioBlob);
            });
        })
        .catch(err => {
            console.error("Mic Error:", err);
            showNotification('تکایە ڕێگە بە مایک بدە', 'error');
        });
}

function cancelRecording() {
    state.isRecording = false;
    if (audioRecorder) audioRecorder.stop();
    resetRecordingUI();
}

function stopAndSendRecording() {
    // The 'stop' event listener above handles sending if state.isRecording is true
    if (audioRecorder) audioRecorder.stop();
    resetRecordingUI();
}

function resetRecordingUI() {
    recordingUI.style.display = 'none';
    document.querySelector('.chat-input-wrapper').style.visibility = 'visible';
    chatMicBtn.style.display = 'flex';
    clearInterval(recordingInterval);
    audioChunks = [];
}

async function sendAudioMessage(blob) {
    if (!currentChatUserId) return;
    try {
        const fileName = `chat_media/${currentChatUserId}/voice_${Date.now()}.mp3`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);

        const messageData = {
            senderId: state.currentUser.uid,
            type: 'audio',
            fileUrl: url,
            text: '🎤 دەنگ',
            createdAt: serverTimestamp(),
            isRead: false
        };

        await addDoc(collection(db, `chats/${currentChatUserId}/messages`), messageData);
        
        // Update Chat Metadata
        const chatDocRef = doc(db, `chats/${currentChatUserId}`);
        const isAdminSender = sessionStorage.getItem('isAdmin') === 'true';
        let updateData = {
            lastMessage: '🎤 دەنگ',
            lastMessageTime: serverTimestamp(),
        };
        
        // Increment counter logic (simplified here, ideally fetch first)
        const snap = await getDoc(chatDocRef);
        if (snap.exists()) {
            if (isAdminSender) updateData.userUnreadCount = (snap.data().userUnreadCount || 0) + 1;
            else updateData.adminUnreadCount = (snap.data().adminUnreadCount || 0) + 1;
        }
        await setDoc(chatDocRef, updateData, { merge: true });

    } catch (error) {
        console.error("Audio upload failed", error);
        showNotification('هەڵە لە ناردنی دەنگ', 'error');
    }
}

// =========================================
// 6. Direct Order & Utilities
// =========================================

export async function sendDirectOrder() {
    if (state.cart.length === 0) return;
    if (!state.currentUser) {
        openPopup('loginModal', 'modal');
        return;
    }

    const userId = state.currentUser.uid;
    
    try {
        // 1. Create Order
        const orderData = {
            userId: userId,
            userName: state.userProfile.name || state.currentUser.displayName,
            items: state.cart,
            total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            status: 'pending',
            createdAt: serverTimestamp(),
            address: state.userProfile.address,
            phone: state.userProfile.phone
        };
        await addDoc(ordersCollection, orderData);

        // 2. Send automated message to chat
        const orderSummary = state.cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
        const autoMsg = {
            senderId: userId,
            type: 'text',
            text: `📋 **داواکاری نوێ**\nکاڵاکان: ${orderSummary}\nکۆی گشتی: ${orderData.total.toLocaleString()} د.ع`,
            createdAt: serverTimestamp(),
            isRead: false
        };
        await addDoc(collection(db, `chats/${userId}/messages`), autoMsg);
        
        // Update chat meta for admin
        await setDoc(doc(db, `chats/${userId}`), {
            lastMessage: '📋 داواکاری نوێ',
            lastMessageTime: serverTimestamp(),
            adminUnreadCount: 1 // Reset or increment
        }, { merge: true });

        // 3. Show Success Modal
        openPopup('orderSuccessModal', 'modal');
        
        // Clear Cart
        state.cart = [];
        localStorage.removeItem('maten_store_cart');
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
        if(document.getElementById('cartSheet').classList.contains('show')) {
            closeCurrentPopup();
        }

    } catch (error) {
        console.error("Order error:", error);
        showNotification(t('error_generic'), 'error');
    }
}

// Helper: Upload File
async function uploadFile(file, path) {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

// Helper: Handle File Input Change
function handleFileSelection(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            attachmentImg.src = e.target.result;
            attachmentPreview.style.display = 'flex';
            toggleSendMic(true);
        };
        reader.readAsDataURL(file);
    }
}

function clearAttachment() {
    chatFileInput.value = null;
    attachmentImg.src = '';
    attachmentPreview.style.display = 'none';
    toggleSendMic(false);
}

// Helper: Mark Messages as Read
async function markMessagesAsRead(userId, target) {
    // If I am Admin -> I want to reset 'adminUnreadCount' to 0
    // If I am User -> I want to reset 'userUnreadCount' to 0
    
    const chatRef = doc(db, `chats/${userId}`);
    const updateField = target === 'admin' ? { userUnreadCount: 0 } : { adminUnreadCount: 0 };
    
    // Note: 'target' param here means "who sent the messages I am reading?".
    // If target is 'admin', it means User is reading Admin's messages. So reset userUnreadCount.
    
    await updateDoc(chatRef, updateField).catch(e => console.log("Mark read error (new chat?)", e));
}

// Helper: Listen for Global Unread Count (For User Bottom Nav)
function listenForTotalUnread() {
    if (!state.currentUser || sessionStorage.getItem('isAdmin') === 'true') return;
    
    onSnapshot(doc(db, `chats/${state.currentUser.uid}`), (doc) => {
        if (doc.exists()) {
            const count = doc.data().userUnreadCount || 0;
            if (totalUnreadBadge) {
                totalUnreadBadge.textContent = count;
                totalUnreadBadge.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    });
}