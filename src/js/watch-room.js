import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    addDoc,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase.js";
import { openPlayer } from "./player.js";

const roomParam = new URLSearchParams(window.location.search).get("room");
let currentRoomId = null;
let currentUser = null;
let chatUnsubscribe = null;
let roomViewKey = null;
let lastPlaybackActionId = null;

function showRoomMessage(message, isError = false) {
    const status = document.getElementById("watchRoomStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function listenToChat(roomId) {
    if (!db) return;
    chatUnsubscribe?.();
    const messagesRef = collection(db, "watchRooms", roomId, "messages");
    chatUnsubscribe = onSnapshot(
        query(messagesRef, orderBy("createdAt", "asc"), limit(100)),
        (snapshot) => {
            const container = document.getElementById("cv-chat-messages");
            if (!container) return;
            container.innerHTML = snapshot.empty
                ? '<p class="cv-chat-empty">No messages yet. Say hello!</p>'
                : snapshot.docs.map((item) => {
                const message = item.data();
                const name = escapeHtml(message.displayName || "Guest");
                return `<div class="cv-chat-message"><strong>${name}</strong><span>${escapeHtml(message.text)}</span></div>`;
            }).join("");
            container.scrollTop = container.scrollHeight;
        },
        (error) => {
            console.error("Could not load room chat.", error);
            const container = document.getElementById("cv-chat-messages");
            if (container) container.innerHTML = '<p class="cv-chat-empty is-error">Chat could not load. Check your Firestore rules.</p>';
        },
    );
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[character]));
}

function showInviteDialog(roomId, movie) {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    const existing = document.getElementById("watchInviteModal");
    existing?.remove();

    const modal = document.createElement("div");
    modal.id = "watchInviteModal";
    modal.className = "watch-invite-modal";
    modal.innerHTML = `
        <div class="watch-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="watchInviteTitle">
            <button class="watch-invite-close" type="button" aria-label="Close">&times;</button>
            <p class="eyebrow">WATCH TOGETHER</p>
            <h2 id="watchInviteTitle">Invite someone to watch</h2>
            <p class="watch-invite-description">Send this link to your friend. The movie will open for them when they join.</p>
            <label class="watch-invite-label" for="watchInviteLink">Invite link</label>
            <input id="watchInviteLink" class="watch-invite-input" type="text" value="${link}" readonly>
            <div class="watch-invite-actions">
                <button class="watch-invite-copy" type="button">Copy link</button>
                <button class="watch-invite-open" type="button">Open movie</button>
            </div>
            <p class="watch-invite-status" role="status"></p>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector(".watch-invite-close").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) close();
    });
    modal.querySelector(".watch-invite-copy").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(link);
            modal.querySelector(".watch-invite-status").textContent = "Link copied. Send it to your friend.";
        } catch {
            const input = modal.querySelector(".watch-invite-input");
            input.focus();
            input.select();
            modal.querySelector(".watch-invite-status").textContent = "Copy the selected link and send it to your friend.";
        }
    });
    modal.querySelector(".watch-invite-open").addEventListener("click", () => {
        close();
        openPlayer(movie.id, "movie", movie.title, [], { roomId, serverKey: "vidsrcme", isHost: true });
    });
}

async function createWatchRoom(event) {
    if (!currentUser || !db) {
        document.getElementById("authUserButton")?.click();
        return;
    }

    const movie = event.detail;
    const roomRef = doc(collection(db, "watchRooms"));
    await setDoc(roomRef, {
        hostId: currentUser.uid,
        movieId: movie.id,
        mediaType: "movie",
        title: movie.title,
        serverKey: "vidsrcme",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    currentRoomId = roomRef.id;
    showInviteDialog(currentRoomId, movie);
}

function listenToRoom(roomId) {
    if (!db) return;
    currentRoomId = roomId;
    roomViewKey = null;
    lastPlaybackActionId = null;
    onSnapshot(doc(db, "watchRooms", roomId), (snapshot) => {
        if (!snapshot.exists()) {
            showRoomMessage("This watch room no longer exists.", true);
            return;
        }

        const room = snapshot.data();
        if (!document.getElementById("movieGrid")) return;
        const nextViewKey = `${room.movieId}:${room.mediaType}:${room.serverKey || "vidsrcme"}`;
        if (roomViewKey !== nextViewKey) {
            roomViewKey = nextViewKey;
            openPlayer(room.movieId, room.mediaType, room.title, [], {
                roomId,
                serverKey: room.serverKey || "vidsrcme",
                isHost: room.hostId === currentUser?.uid,
            });
        }
        listenToChat(roomId);
        if (room.playbackActionId && room.playbackActionId !== lastPlaybackActionId) {
            lastPlaybackActionId = room.playbackActionId;
            window.dispatchEvent(new CustomEvent("watch-room-playback", {
                detail: { roomId, action: room.playbackAction },
            }));
        }
    }, (error) => {
        console.error("Could not load watch room.", error);
        showRoomMessage("Could not join this watch room.", true);
    });
}

window.addEventListener("watch-room-create", (event) => {
    createWatchRoom(event).catch((error) => {
        console.error("Could not create watch room.", error);
        showRoomMessage("Could not create the watch room.", true);
    });

});

window.addEventListener("watch-room-player-open", (event) => {
    if (event.detail?.roomId) listenToChat(event.detail.roomId);
});

window.addEventListener("watch-room-chat-send", async (event) => {
    if (!currentUser || !db || event.detail?.roomId !== currentRoomId) return;
    try {
        await addDoc(collection(db, "watchRooms", currentRoomId, "messages"), {
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "User",
            text: event.detail.text,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Could not send room chat message.", error);
        const container = document.getElementById("cv-chat-messages");
        if (container) {
            const notice = document.createElement("p");
            notice.className = "cv-chat-empty is-error";
            notice.textContent = "Message not sent. Check your Firebase connection and Firestore rules.";
            container.appendChild(notice);
            container.scrollTop = container.scrollHeight;
        }
    }
});

window.addEventListener("watch-room-command", async (event) => {
    if (!currentUser || !db || event.detail?.roomId !== currentRoomId) return;
    try {
        const roomRef = doc(db, "watchRooms", currentRoomId);
        const snapshot = await getDoc(roomRef);
        if (!snapshot.exists() || snapshot.data().hostId !== currentUser.uid) return;
        await updateDoc(roomRef, {
            playbackAction: event.detail.action,
            playbackActionId: Date.now(),
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Could not sync room playback command.", error);
    }
});

window.addEventListener("watch-room-playback", (event) => {
    if (event.detail?.roomId !== currentRoomId) return;
    window.dispatchEvent(new CustomEvent("player-playback-command", {
        detail: { action: event.detail.action },
    }));
});

window.addEventListener("player-server-change", async (event) => {
    if (!currentRoomId || !currentUser || !db || event.detail?.roomId !== currentRoomId) return;
    const roomRef = doc(db, "watchRooms", currentRoomId);
    const snapshot = await getDoc(roomRef);
    if (snapshot.exists() && snapshot.data().hostId === currentUser.uid) {
        await updateDoc(roomRef, {
            serverKey: event.detail.serverKey,
            updatedAt: serverTimestamp(),
        });
    }
});

if (auth) {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user && roomParam) listenToRoom(roomParam);
    });
}
