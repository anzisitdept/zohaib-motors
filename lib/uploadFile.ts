import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Upload a file (image/pdf/etc.) to Firebase Storage and return its download URL.
 * @param file - File to upload
 * @param folder - Storage folder name (e.g. "clients")
 */
export async function uploadFileToStorage(file: File, folder: string): Promise<string> {
  const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}