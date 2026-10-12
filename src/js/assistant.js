const STORAGE_KEY = "mstream-assistant-chat";
const assistantHistory = [];

// Remove any previously cached chats so nothing persists
try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
} catch {}

export function clearAssistantChat() {
    assistantHistory.length = 0;
    try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    renderHistory();
}

if (typeof window !== "undefined") {
    window.clearAssistantChat = clearAssistantChat;
    window.addEventListener("mstream:signout", clearAssistantChat);
}

function createAssistant() {
    document.body.insertAdjacentHTML("beforeend", `
        <button id="movieAssistantToggle" class="assistant-head" type="button" aria-controls="movieAssistantWidget" aria-expanded="false" aria-label="Open movie assistant">
            <span class="assistant-head-face" aria-hidden="true">✦</span>
            <span class="assistant-head-dot" aria-hidden="true"></span>
        </button>
        <section id="movieAssistantWidget" class="assistant-widget" aria-labelledby="assistantTitle" hidden>
            <div class="assistant-widget-header">
                <div>
                    <p class="eyebrow section-eyebrow">ASK MSTREAM</p>
                    <h2 id="assistantTitle">Movie guide</h2>
                    <span class="assistant-online"><i></i> Always here to help</span>
                </div>
                <button id="movieAssistantClose" class="assistant-close" type="button" aria-label="Close movie assistant">×</button>
            </div>
            <div id="movieAssistantMessages" class="assistant-messages" aria-live="polite"></div>
            <form id="movieAssistantForm" class="assistant-form">
                <label class="sr-only" for="movieAssistantInput">Ask the movie assistant</label>
                <textarea id="movieAssistantInput" maxlength="500" rows="1" placeholder="Type a message..." required></textarea>
                <button type="submit" aria-label="Send message">➤</button>
            </form>
            <p id="movieAssistantStatus" class="assistant-status" role="status"></p>
        </section>
    `);
    renderHistory();
    bindAssistantEvents();
}

function renderHistory() {
    const messages = document.getElementById("movieAssistantMessages");
    if (!messages) return;
    messages.innerHTML = "";
    if (!assistantHistory.length) {
        appendMessage("Hi! I’m your movie guide. What are you in the mood to watch?", "ai");
    } else {
        assistantHistory.forEach(message => appendMessage(message.text, message.role === "user" ? "user" : "ai"));
    }
}

function appendMessage(text, role) {
    const messages = document.getElementById("movieAssistantMessages");
    if (!messages) return null;
    const message = document.createElement("div");
    message.className = `assistant-message assistant-message-${role}`;
    renderMessageText(message, text);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
}

function renderMessageText(container, text) {
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
        if (index > 0) container.appendChild(document.createElement("br"));
        const content = line.replace(/^\s*\*\s+/, "");
        const isBullet = content !== line;
        if (isBullet) {
            const bullet = document.createElement("span");
            bullet.className = "assistant-bullet";
            bullet.textContent = "• ";
            container.appendChild(bullet);
        }
        const parts = content.split("**");
        parts.forEach((part, partIndex) => {
            const node = partIndex % 2 === 1 ? document.createElement("strong") : document.createTextNode(part);
            if (partIndex % 2 === 1) node.textContent = part;
            container.appendChild(node);
        });
    });
}

function bindAssistantEvents() {
    const toggle = document.getElementById("movieAssistantToggle");
    const widget = document.getElementById("movieAssistantWidget");
    const close = document.getElementById("movieAssistantClose");
    const form = document.getElementById("movieAssistantForm");
    const input = document.getElementById("movieAssistantInput");

    const setOpen = (isOpen) => {
        toggle.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) {
            widget.hidden = false;
            requestAnimationFrame(() => widget.classList.add("assistant-widget-open"));
            input.focus();
        } else {
            widget.classList.remove("assistant-widget-open");
            window.setTimeout(() => {
                if (!widget.classList.contains("assistant-widget-open")) widget.hidden = true;
            }, 180);
        }
    };

    toggle.addEventListener("click", () => setOpen(true));
    close.addEventListener("click", () => setOpen(false));
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    form.addEventListener("submit", askAssistant);
}

async function askAssistant(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector("textarea");
    const status = document.getElementById("movieAssistantStatus");
    const question = input.value.trim();
    if (!question) return;

    appendMessage(question, "user");
    assistantHistory.push({ role: "user", text: question });
    input.value = "";
    input.disabled = true;
    form.querySelector("button").disabled = true;
    status.textContent = "AI is replying...";
    const typing = appendMessage("", "ai");
    typing.classList.add("assistant-typing");
    typing.innerHTML = '<span class="typing-label">AI is replying</span><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>';

    try {
        const response = await fetch("/api/movie-assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, history: assistantHistory.slice(0, -1) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Assistant request failed");
        typing.classList.remove("assistant-typing");
        typing.innerHTML = "";
        renderMessageText(typing, data.answer);
        assistantHistory.push({ role: "assistant", text: data.answer });
        status.textContent = "";
    } catch (error) {
        console.error("Could not ask movie assistant.", error);
        typing.remove();
        appendMessage("I’m having trouble answering right now. Please try again.", "ai");
        status.textContent = "The movie assistant is unavailable right now.";
    } finally {
        input.disabled = false;
        form.querySelector("button").disabled = false;
        input.focus();
    }
}

document.addEventListener("DOMContentLoaded", createAssistant);
