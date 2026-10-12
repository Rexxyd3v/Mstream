import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";

// profileMenu is rendered as a separate root element (appended to body)
// so it is NOT clipped by the sticky nav's backdrop-filter stacking context.
const authMarkup = `
    <div class="auth-controls">
        <button class="auth-user-button" id="authUserButton" type="button">Log in</button>
    </div>
    <div class="profile-menu" id="profileMenu" hidden>
        <p class="profile-menu-label" id="profileMenuLabel">Signed in</p>
        <button class="profile-signout" id="profileSignout" type="button">Sign out</button>
        <div class="profile-signout-confirm" id="profileSignoutConfirm" hidden>
            <p>Are you sure you want to sign out?</p>
            <p class="signout-error" id="signoutError" role="alert" hidden></p>
            <div class="profile-signout-actions">
                <button type="button" id="cancelSignout">Cancel</button>
                <button type="button" id="confirmSignout">Confirm sign out</button>
            </div>
        </div>
    </div>
    <div class="auth-modal" id="authModal" hidden>
        <div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="authTitle">
            <button class="auth-close" id="authClose" type="button" aria-label="Close">&times;</button>
            <p class="eyebrow">MEMBERS AREA</p>
            <h2 id="authTitle">Welcome back</h2>
            <p class="auth-description" id="authDescription">Log in to save your favorites across devices.</p>
            <form id="authForm">
                <label for="authEmail">Email</label>
                <input id="authEmail" type="email" autocomplete="email" required>
                <label for="authPassword">Password</label>
                <input id="authPassword" type="password" autocomplete="current-password" minlength="6" required>
                <button class="auth-submit" id="authSubmit" type="submit">Log in</button>
            </form>
            <button class="auth-google" id="authGoogle" type="button">
                <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M21.35 12.23c0-.78-.07-1.53-.22-2.25H12v4.26h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.15c1.85-1.7 2.9-4.2 2.9-7.4Z"/>
                    <path fill="#34A853" d="M12 21.75c2.64 0 4.86-.87 6.48-2.36l-3.15-2.45c-.87.58-1.98.92-3.33.92-2.56 0-4.73-1.73-5.51-4.06H3.23v2.53A9.78 9.78 0 0 0 12 21.75Z"/>
                    <path fill="#FBBC05" d="M6.49 13.8A5.88 5.88 0 0 1 6.18 12c0-.62.11-1.23.31-1.8V7.67H3.23A9.76 9.76 0 0 0 2.25 12c0 1.57.38 3.06.98 4.33l3.26-2.53Z"/>
                    <path fill="#EA4335" d="M12 6.14c1.44 0 2.73.5 3.75 1.48l2.81-2.81C16.86 3.24 14.64 2.25 12 2.25a9.78 9.78 0 0 0-8.77 5.42l3.26 2.53C7.27 7.87 9.44 6.14 12 6.14Z"/>
                </svg>
                <span>Continue with Google</span>
            </button>
            <p class="auth-status" id="authStatus" role="status"></p>
            <button class="auth-toggle" id="authToggle" type="button">Create an account</button>
            <button class="auth-guest" id="authGuest" type="button">Continue as guest</button>
        </div>
    </div>
`;

let isSignUpMode = false;
const GUEST_MODE_KEY = "mstreamGuestMode:v2";
let isAuthGate = true;
let isSigningOut = false;

function setStatus(message, isError = false) {
    const status = document.getElementById("authStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function setAuthMode(signUp) {
    isSignUpMode = signUp;
    document.getElementById("authTitle").textContent = signUp ? "Create your account" : "Welcome back";
    document.getElementById("authDescription").textContent = signUp
        ? "Create an account to save favorites across devices."
        : "Log in to save your favorites across devices.";
    document.getElementById("authSubmit").textContent = signUp ? "Create account" : "Log in";
    document.getElementById("authToggle").textContent = signUp ? "I already have an account" : "Create an account";
    setStatus("");
}

function openModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.hidden = false;
}

function closeModal() {
    if (isAuthGate) return;
    const modal = document.getElementById("authModal");
    if (modal) modal.hidden = true;
    setStatus("");
}

function continueAsGuest() {
    sessionStorage.setItem(GUEST_MODE_KEY, "true");
    leaveAuthGate();
}

function leaveAuthGate() {
    isAuthGate = false;
    document.body.classList.remove("auth-gated");
    const modal = document.getElementById("authModal");
    if (modal) modal.hidden = true;
    setStatus("");
}

function enterAuthGate() {
    isAuthGate = true;
    document.body.classList.add("auth-gated");
    const modal = document.getElementById("authModal");
    if (modal) modal.hidden = false;
}

function errorMessage(error) {
    const messages = {
        "auth/email-already-in-use": "That email is already registered.",
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/weak-password": "Use a password with at least 6 characters.",
        "auth/popup-closed-by-user": "The Google sign-in window was closed.",
        "auth/popup-blocked": "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.",
        "auth/unauthorized-domain": "This Vercel domain is not authorized in Firebase. Add it under Authentication > Settings > Authorized domains.",
        "auth/operation-not-allowed": "Google sign-in is not enabled. Enable Google under Firebase Authentication > Sign-in method.",
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "The Firebase API key in Vercel is invalid or restricted for this domain.",
        "auth/network-request-failed": "Network request failed. Check the deployed site's connection and try again.",
    };
    return messages[error.code] || "Authentication failed. Please try again.";
}

/** Position the profile menu below the trigger button using fixed coords. */
function positionMenu(button, menu) {
    const rect = button.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = (rect.bottom + 8) + "px";
    menu.style.right = (window.innerWidth - rect.right) + "px";
    menu.style.left = "auto";
}

function openMenu(button, menu) {
    // Reset to initial signout state every time menu opens
    const psEl = document.getElementById("profileSignout");
    const pcEl = document.getElementById("profileSignoutConfirm");
    const errEl = document.getElementById("signoutError");
    if (psEl) psEl.hidden = false;
    if (pcEl) pcEl.hidden = true;
    if (errEl) errEl.hidden = true;

    positionMenu(button, menu);
    menu.hidden = false;
}

function closeMenu(menu) {
    menu.hidden = true;
}

function renderSignedIn(user) {
    leaveAuthGate();
    const button = document.getElementById("authUserButton");
    if (!button) return;

    const displayName = user.displayName || user.email?.split("@")[0] || "Account";
    const initials = displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase() || "A";
    const avatar = document.createElement(user.photoURL ? "img" : "span");
    avatar.className = user.photoURL ? "auth-avatar" : "auth-avatar auth-avatar-fallback";
    avatar.setAttribute("aria-hidden", "true");

    if (user.photoURL) {
        avatar.src = user.photoURL;
        avatar.alt = "";
        avatar.addEventListener("error", () => {
            const fallback = document.createElement("span");
            fallback.className = "auth-avatar auth-avatar-fallback";
            fallback.setAttribute("aria-hidden", "true");
            fallback.textContent = initials;
            avatar.replaceWith(fallback);
        }, { once: true });
    } else {
        avatar.textContent = initials;
    }

    const name = document.createElement("span");
    name.className = "auth-user-name";
    name.textContent = displayName;
    button.replaceChildren(avatar, name);
    button.setAttribute("aria-label", `Open profile menu for ${displayName}`);
    button.title = `Open profile menu for ${displayName}`;
    button.classList.add("is-signed-in");
    document.getElementById("profileMenuLabel").textContent = displayName;

    const menu = document.getElementById("profileMenu");
    button.onclick = (e) => {
        e.stopPropagation();
        if (menu.hidden) {
            openMenu(button, menu);
        } else {
            closeMenu(menu);
        }
    };
}

function renderSignedOut() {
    const button = document.getElementById("authUserButton");
    if (!button) return;
    button.textContent = "Log in";
    button.setAttribute("aria-label", "Log in");
    button.removeAttribute("title");
    button.classList.remove("is-signed-in");
    button.onclick = openModal;
    const menu = document.getElementById("profileMenu");
    if (menu) closeMenu(menu);
}

function initializeAuth() {
    const nav = document.querySelector(".site-nav") || document.querySelector("header > div");
    if (!nav) return;

    nav.insertAdjacentHTML("beforeend", authMarkup);

    // Move authModal AND profileMenu to document.body so they are NOT clipped
    // by the sticky nav's backdrop-filter stacking context.
    const menuEl = document.getElementById("profileMenu");
    const modalEl = document.getElementById("authModal");
    document.body.append(menuEl);
    document.body.append(modalEl);
    document.body.classList.add("auth-gated");

    // Close menu when clicking anywhere outside it or the auth button
    document.addEventListener("click", (event) => {
        const menu = document.getElementById("profileMenu");
        const button = document.getElementById("authUserButton");
        if (!menu || menu.hidden) return;
        if (!menu.contains(event.target) && !button.contains(event.target)) {
            closeMenu(menu);
        }
    });

    document.getElementById("authClose").addEventListener("click", closeModal);
    document.getElementById("authGuest").addEventListener("click", continueAsGuest);

    document.getElementById("profileSignout").addEventListener("click", () => {
        document.getElementById("profileSignout").hidden = true;
        document.getElementById("profileSignoutConfirm").hidden = false;
    });

    document.getElementById("cancelSignout").addEventListener("click", () => {
        document.getElementById("profileSignoutConfirm").hidden = true;
        document.getElementById("profileSignout").hidden = false;
        document.getElementById("signoutError").hidden = true;
    });

    document.getElementById("confirmSignout").addEventListener("click", async (event) => {
        const confirmButton = event.currentTarget;
        confirmButton.disabled = true;
        confirmButton.textContent = "Signing out...";
        try {
            isSigningOut = true;
            sessionStorage.removeItem(GUEST_MODE_KEY);
            await signOut(auth);
            window.location.href = window.location.origin + "/pages/home.html";
        } catch (error) {
            isSigningOut = false;
            console.error("[MStream Auth] Sign-out failed:", error);
            const signoutError = document.getElementById("signoutError");
            if (signoutError) {
                signoutError.textContent = errorMessage(error);
                signoutError.hidden = false;
            }
            confirmButton.disabled = false;
            confirmButton.textContent = "Try again";
        }
    });

    document.getElementById("authModal").addEventListener("click", (event) => {
        if (event.target.id === "authModal") closeModal();
    });
    document.getElementById("authToggle").addEventListener("click", () => setAuthMode(!isSignUpMode));

    if (!auth || !googleProvider) {
        document.getElementById("authUserButton").onclick = openModal;
        document.getElementById("authGoogle").disabled = true;
        setStatus("Firebase is not configured. You can continue as a guest.", true);
        enterAuthGate();
        return;
    }

    document.getElementById("authForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("authEmail").value.trim();
        const password = document.getElementById("authPassword").value;
        const submit = document.getElementById("authSubmit");
        submit.disabled = true;
        setStatus("Please wait...");

        try {
            if (isSignUpMode) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            sessionStorage.removeItem(GUEST_MODE_KEY);
            leaveAuthGate();
        } catch (error) {
            console.error("[MStream Auth] Email sign-in failed:", error);
            setStatus(errorMessage(error), true);
        } finally {
            submit.disabled = false;
        }
    });

    document.getElementById("authGoogle").addEventListener("click", async () => {
        const googleButton = document.getElementById("authGoogle");
        googleButton.disabled = true;
        setStatus("Opening Google sign-in...");
        try {
            await signInWithPopup(auth, googleProvider);
            sessionStorage.removeItem(GUEST_MODE_KEY);
            leaveAuthGate();
        } catch (error) {
            console.error("[MStream Auth] Google sign-in failed:", error);
            setStatus(errorMessage(error), true);
        } finally {
            googleButton.disabled = false;
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (isSigningOut) return;
        if (user) {
            renderSignedIn(user);
        } else {
            renderSignedOut();
            if (sessionStorage.getItem(GUEST_MODE_KEY) !== "true") {
                enterAuthGate();
            } else {
                leaveAuthGate();
            }
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAuth);
} else {
    initializeAuth();
}
