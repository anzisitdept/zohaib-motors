
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const image = formData.get("image");

        if (!image) {
            return NextResponse.json(
                { error: "No image provided" },
                { status: 400 }
            );
        }

        const apiKey = process.env.IMGBB_API_KEY;

        if (!apiKey) {
            console.error("IMGBB_API_KEY is not configured");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const imgbbFormData = new FormData();
        imgbbFormData.append("image", image);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: imgbbFormData,
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error?.message || "ImgBB upload failed" },
                { status: response.status }
            );
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error("Upload proxy error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
