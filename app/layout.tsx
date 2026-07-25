import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import { ReactNode } from "react";
import type { Metadata } from 'next';
import { TENANT_CONFIG } from "@/config/tenant";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: TENANT_CONFIG.trackingTitle,
  description: "Internal File Tracking System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
