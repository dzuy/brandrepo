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
  metadataBase: new URL("https://brandrepo.dev"),
  title: "BrandRepo",
  description: "A functional Marketing Repo prototype for company context, repo-grounded chat, and campaign content generation.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  openGraph: {
    title: "BrandRepo",
    url: "https://brandrepo.dev",
    siteName: "BrandRepo",
    description: "Create a Marketing Repo, ask grounded questions, generate content, and save the work back.",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "BrandRepo Marketing Repo prototype",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BrandRepo",
    description: "A functional Marketing Repo prototype with repo-grounded AI chat and save-back content generation.",
    images: ["/og.svg"],
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
