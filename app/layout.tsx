import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ShopProvider } from "@/context/ShopContext";

const sansFont = Plus_Jakarta_Sans({
  variable: "--font-sans-serif",
  subsets: ["latin"],
  display: "swap",
});

const serifFont = Playfair_Display({
  variable: "--font-serif-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SHIVURA | Handmade with Purpose",
  description:
    "Elegantly crafted, handmade luxury lifestyle products. Discover Shivura's artisanal collection.",
  keywords: ["Shivura", "Handmade", "Luxury", "E-commerce", "Artisanal", "Sustainable"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sansFont.variable} ${serifFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF8F5] text-neutral-900 selection:bg-stone-300 selection:text-neutral-900">
        <ShopProvider>
          <AnnouncementBar />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ShopProvider>
      </body>
    </html>
  );
}
