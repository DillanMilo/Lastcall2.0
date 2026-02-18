import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SuppressDevWarnings } from "@/components/SuppressDevWarnings";
import { Providers } from "@/components/Providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#171412" },
  ],
};

export const metadata: Metadata = {
  title: "LastCallIQ - AI-Driven Inventory Management",
  description: "Smart inventory management for small businesses. Reduce waste, predict demand, and streamline operations.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LastCallIQ",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Prevent iOS from auto-zooming on input focus */}
        <meta name="format-detection" content="telephone=no" />
        {/* Enable smooth scrolling - using global CSS instead of dangerouslySetInnerHTML */}
      </head>
      <body className="antialiased min-h-screen" style={{ minHeight: "100dvh" }}>
        <SuppressDevWarnings />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
