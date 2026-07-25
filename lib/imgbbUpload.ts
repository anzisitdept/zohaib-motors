/**
 * Upload a base64 image to ImgBB
 * @param base64Image - Base64 encoded image string (with or without data:image prefix)
 * @returns Promise with the uploaded image URL
 */
export async function uploadToImgBB(base64Image: string): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;

    if (!apiKey) {
        throw new Error("ImgBB API key is not configured. Please add NEXT_PUBLIC_IMGBB_API_KEY to your .env.local file");
    }

    // Remove data:image/png;base64, prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const formData = new FormData();
    formData.append('image', base64Data);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`ImgBB upload failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error('ImgBB upload was not successful');
        }

        return data.data.url;
    } catch (error) {
        console.error('Error uploading to ImgBB:', error);
        throw error;
    }
}
