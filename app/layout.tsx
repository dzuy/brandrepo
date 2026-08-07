import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrandHub Prototype",
  description: "A functional Marketing Repo prototype for company context, repo-grounded chat, and campaign content generation.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "BrandHub Prototype",
    description: "Create a Marketing Repo, ask grounded questions, generate content, and save the work back.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "BrandHub Marketing Repo prototype",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BrandHub Prototype",
    description: "A functional Marketing Repo prototype with repo-grounded AI chat and save-back content generation.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
