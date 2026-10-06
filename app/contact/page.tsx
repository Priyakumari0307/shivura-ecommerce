import { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { ContactForm, ContactInfo, ContactFAQ } from "@/components/contact";

export const metadata: Metadata = {
  title: "Contact Us | Shivura Handcrafted Luxury",
  description:
    "Get in touch with Shivura concierge. Inquire about artisanal home decor, custom frame sizes, bespoke bulk festive gifting, or reach our support team.",
};

export default function ContactPage() {
  return (
    <div className="bg-[#FAF8F5] text-[#2C2117] font-sans antialiased overflow-hidden">
      {/* ============================================================ */}
      {/* 1. HERO BANNER: Contact & Concierge */}
      {/* ============================================================ */}
      <section className="relative w-full overflow-hidden bg-[#160E09] text-stone-100 py-16 sm:py-24 md:py-28 border-b border-[#C8A060]/30">
        {/* Background Texture with Ambient Glow */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/carved-wood-banner.jpg"
            alt="Handcrafted Indian luxury background"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-35 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#140E0A]/85 via-[#1A110B]/70 to-[#140E0A]/90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,160,96,0.15)_0%,transparent_75%)]" />
        </div>

        <Container size="wide" className="relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-3 sm:space-y-5">
            {/* Top Lotus Motif */}
            <div className="flex items-center justify-center space-x-3 text-[#E6CA65]">
              <div className="h-[1px] w-8 sm:w-16 bg-gradient-to-r from-transparent to-[#D4AF37]/60" />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 20"
                fill="currentColor"
                className="w-6 h-5 text-[#E6CA65] drop-shadow-[0_2px_8px_rgba(212,175,55,0.4)]"
                aria-hidden="true"
              >
                <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" opacity="0.95" />
                <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.9" />
                <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.9" />
                <path d="M11 15.5 C14 17, 18 17, 21 15.5 C19 16.5, 13 16.5, 11 15.5 Z" opacity="0.95" />
              </svg>
              <div className="h-[1px] w-8 sm:w-16 bg-gradient-to-l from-transparent to-[#D4AF37]/60" />
            </div>

            {/* Main Heading */}
            <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl text-[#FAF5ED] font-normal tracking-tight leading-tight drop-shadow-md">
              Contact Us
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm md:text-base text-[#DFCEB9] font-light max-w-xl mx-auto leading-relaxed">
              Whether you seek assistance with our handcrafted collections, custom requests, or corporate gifting, our concierge is at your service.
            </p>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 2. MAIN CONTACT SECTION (2 Columns: Info & Form) */}
      {/* ============================================================ */}
      <section className="py-14 sm:py-20 md:py-24 bg-[#FAF8F5] relative">
        <Container size="wide">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Contact Info & Studio Details (5 cols) */}
            <div className="lg:col-span-5">
              <ContactInfo />
            </div>

            {/* Right Column: Interactive Luxury Form (7 cols) */}
            <div className="lg:col-span-7">
              <ContactForm />
            </div>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 3. THREE PILLARS OF SERVICE */}
      {/* ============================================================ */}
      <section className="py-12 sm:py-16 bg-[#F5EFE6] border-y border-[#E8DCCF]">
        <Container size="wide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Pillar 1
            <div className="bg-[#FAF7F2] border border-[#DFCBB8]/70 rounded-2xl p-6 sm:p-7 space-y-3 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-[#EDE2D2] text-[#B88746] flex items-center justify-center mx-auto text-xl">

              </div>
              <h3 className="font-serif text-lg text-[#2C2117] font-normal">
                Bespoke &amp; Custom Sizing
              </h3>
              <p className="text-xs sm:text-[13px] text-[#6E5A4A] font-light leading-relaxed">
                Looking for customized dimensions on acrylic wall frames or specific clay glaze finishes? Our artisans craft to your vision.
              </p>
            </div> */}

            {/* Pillar 2 */}
            {/* <div className="bg-[#FAF7F2] border border-[#DFCBB8]/70 rounded-2xl p-6 sm:p-7 space-y-3 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-[#EDE2D2] text-[#B88746] flex items-center justify-center mx-auto text-xl">

              </div>
              <h3 className="font-serif text-lg text-[#2C2117] font-normal">
                Corporate &amp; Festive Gifting
              </h3>
              <p className="text-xs sm:text-[13px] text-[#6E5A4A] font-light leading-relaxed">
                Tailored festive gift hampers, customized wooden keepsake boxes, and traditional diya sets designed for unforgettable impressions.
              </p>
            </div> */}

            {/* Pillar 3 */}
            {/* <div className="bg-[#FAF7F2] border border-[#DFCBB8]/70 rounded-2xl p-6 sm:p-7 space-y-3 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-[#EDE2D2] text-[#B88746] flex items-center justify-center mx-auto text-xl">

              </div>
              <h3 className="font-serif text-lg text-[#2C2117] font-normal">
                Artisan Care &amp; Guidance
              </h3>
              <p className="text-xs sm:text-[13px] text-[#6E5A4A] font-light leading-relaxed">
                Need guidance on maintaining brass pooja artifacts or natural terracotta items? We provide personal care advice anytime.
              </p>
            </div> */}
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 4. FREQUENTLY ASKED QUESTIONS */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-24 bg-[#FAF8F5]">
        <Container size="wide">
          <div className="text-center max-w-xl mx-auto mb-10 sm:mb-12 space-y-2">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#B88746] font-sans font-medium">
              Common Inquiries
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2C2117] font-normal tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-[#7E6955] font-light">
              Quick answers to frequent inquiries about orders, deliveries, and artisan craftsmanship.
            </p>
          </div>

          <ContactFAQ />
        </Container>
      </section>
    </div>
  );
}
