import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shivura CRM | Executive Administration Portal",
  description:
    "Internal executive administration portal for Shivura handcrafted luxury catalog, artisan operations, and concierge logistics.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CrmRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E1D1B] flex flex-col font-sans selection:bg-[#B88746]/20 selection:text-[#2C2117]">
      {children}
    </div>
  );
}
