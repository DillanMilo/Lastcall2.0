import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SuppressDevWarnings } from "@/components/SuppressDevWarnings";
import { Providers } from "@/components/Providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "LastCall - AI-Driven Inventory Management",
  description: "Smart inventory management for small businesses. Reduce waste, predict demand, and streamline operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <SuppressDevWarnings />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
