import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SuppressDevWarnings } from "@/components/SuppressDevWarnings";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LastCall 2.0 - AI-Driven Inventory Management",
  description: "Smart inventory management for small businesses",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SuppressDevWarnings />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
