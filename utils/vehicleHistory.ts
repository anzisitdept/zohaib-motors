import { doc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface HistoryEntry {
    action: string;
    details: string;
    timestamp: string;
    performedBy: string;
    [key: string]: any;
}

export const addToHistory = async (
    vehicleId: string,
    action: string,
    details: string,
    userId: string,
    additionalData: any = {}
) => {
    if (!vehicleId || !userId) return;

    const newEntry: HistoryEntry = {
        action,
        details,
        timestamp: new Date().toISOString(),
        performedBy: userId,
        ...additionalData
    };

    try {
        const vehicleRef = doc(db, "cars", vehicleId);
        await updateDoc(vehicleRef, {
            history: arrayUnion(newEntry),
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error adding to history:", error);
        throw error;
    }
};
