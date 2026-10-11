import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";

function favoriteDocument(userId, item) {
    return doc(db, "users", userId, "favorites", `${item.type}_${item.id}`);
}

export async function getUserFavorites(userId) {
    if (!db || !userId) {
        return [];
    }

    const snapshot = await getDocs(collection(db, "users", userId, "favorites"));
    return snapshot.docs.map((favorite) => favorite.data());
}

export async function isUserFavorite(userId, item) {
    if (!db || !userId) {
        return false;
    }

    const snapshot = await getDoc(favoriteDocument(userId, item));
    return snapshot.exists();
}

export async function saveUserFavorite(userId, item) {
    if (!db || !userId) {
        throw new Error("You must be logged in to save favorites.");
    }

    await setDoc(favoriteDocument(userId, item), {
        ...item,
        createdAt: new Date().toISOString(),
    });
}

export async function removeUserFavorite(userId, item) {
    if (!db || !userId) {
        throw new Error("You must be logged in to remove favorites.");
    }

    await deleteDoc(favoriteDocument(userId, item));
}
