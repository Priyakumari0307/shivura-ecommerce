import React from "react";
import Image from "next/image";

export function ShopBanner() {
  return (
    <div className="relative w-full overflow-hidden bg-[#160F0A] text-stone-100 border-b border-[#D4AF37]/30">
      {/* Background Image with Ambient Glow */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/shop-banner.jpg"
          alt="Shivura Festive & Home Decor"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-45 scale-105 transform duration-1000 ease-out"
        />
        {/* Multi-layered luxury gradients for deep warm atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#140E0A]/85 via-[#1A110B]/70 to-[#140E0A]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12)_0%,transparent_70%)]" />
      </div>

      {/* Decorative Ornate Frame Elements */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4 max-w-4xl mx-auto">
          {/* Top Golden Lotus Motif */}
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
              <path d="M13.5 7 C8.5 10, 8 14.5, 14.5 15 C11 13.5, 10.5 10.5, 13.5 7 Z" opacity="0.8" />
              <path d="M18.5 7 C23.5 10, 24 14.5, 17.5 15 C21 13.5, 21.5 10.5, 18.5 7 Z" opacity="0.8" />
              <path d="M11 15.5 C14 17, 18 17, 21 15.5 C19 16.5, 13 16.5, 11 15.5 Z" opacity="0.95" />
            </svg>
            <div className="h-[1px] w-8 sm:w-16 bg-gradient-to-l from-transparent to-[#D4AF37]/60" />
          </div>

          {/* Main Title with Elegant Serif Typography */}
          <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl lg:text-[46px] text-[#FAF5ED] font-normal tracking-wide leading-tight drop-shadow-md">
            Indian Home Decor, Crafts &amp; Festive Essentials
          </h1>

          {/* Subtitle with Decorative Gold Flourishes */}
          <div className="flex items-center justify-center space-x-2 sm:space-x-4 pt-1 sm:pt-2">
            <div className="hidden sm:block h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-[#D4AF37]/70" />
            <span className="text-[10px] sm:text-xs md:text-[13px] uppercase tracking-[0.25em] text-[#E5D2B8] font-light">
              Traditional Crafts <span className="text-[#D4AF37] px-1">•</span> Timeless Beauty <span className="text-[#D4AF37] px-1">•</span> For Every Home
            </span>
            <div className="hidden sm:block h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-[#D4AF37]/70" />
          </div>
        </div>
      </div>

      {/* Subtle Bottom Gold Border Accent */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
    </div>
  );
}
