import { useState } from "react";

const IMGBB_API_KEY = "a6736e3e38e68147b6f9d7b24d2f8d36"; // Reusing your key

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        return data.data.url;
      }
      throw new Error("Upload failed");
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading };
};