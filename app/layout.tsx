import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "QnA Setup — Chatbot Properti",
  description: "Kelola data Tanya-Jawab chatbot WhatsApp properti",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0F2540",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="min-h-full bg-background font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
