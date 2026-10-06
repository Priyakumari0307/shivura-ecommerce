"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";

export function MeetOurArtisans() {
  return (
    <section className="relative w-full bg-[#FAF8F5] overflow-hidden">
      {/* Top Header with Flanking Decorative Lines */}
      <div className="py-6 sm:py-7 bg-[#FAF8F5]">
        <Container size="wide">
          <div className="flex items-center justify-center space-x-4 sm:space-x-8">
            <div className="h-[1px] bg-[#D4C3B2] flex-1 max-w-[120px] sm:max-w-[200px] md:max-w-[260px]" />
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#1E3028] font-normal tracking-normal text-center">
              Meet Our Artisans
            </h2>
            <div className="h-[1px] bg-[#D4C3B2] flex-1 max-w-[120px] sm:max-w-[200px] md:max-w-[260px]" />
          </div>
        </Container>
      </div>

      {/* Main Banner with Hand.png Background */}
      <div className="relative w-full min-h-[340px] sm:min-h-[380px] md:min-h-[420px] lg:min-h-[460px] flex items-center border-y border-stone-200/60 overflow-hidden bg-stone-900">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/Hand.png"
            alt="Artisan Craftsmanship at Shivura"
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover object-center lg:object-[center_40%]"
          />
          {/* Left-edge vignette/gradient overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent sm:from-black/75 sm:via-black/40 sm:to-transparent lg:from-black/70 lg:via-black/25 lg:to-transparent" />
        </div>

        {/* Content Overlay */}
        <Container size="wide" className="relative z-10 py-7 sm:py-9 lg:py-10">
          <div className="max-w-md sm:max-w-lg text-left pl-1 sm:pl-4 flex flex-col justify-between min-h-[260px] sm:min-h-[300px]">
            {/* Top / Main Body */}
            <div>
              {/* Heading */}
              <h3 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-normal leading-[1.12] tracking-tight mb-2.5 sm:mb-3">
                <span className="text-white">Every Piece </span>
                <span className="text-[#D5A866]">Has a Story.</span>
              </h3>

              {/* Decorative Accent Line */}
              <div className="w-10 h-[2px] bg-[#C89B59] mb-3 sm:mb-4" />

              {/* Subtitle / Paragraph */}
              <p className="text-xs sm:text-sm md:text-[14.5px] text-stone-200/90 font-light leading-relaxed max-w-sm sm:max-w-md mb-4 sm:mb-5">
                Behind every handcrafted creation is a pair of hands,
                <br className="hidden sm:inline" />
                {" "}a tradition and a story worth preserving.
              </p>

              {/* CTA Button */}
              <div>
                <Link
                  href="/our-story"
                  className="inline-flex items-center space-x-3 px-6 sm:px-7 py-2.5 sm:py-3 rounded-full border border-[#D4A76A]/80 bg-[#14231C]/90 hover:bg-[#1E352B] text-stone-100 text-[11px] sm:text-xs font-sans font-medium uppercase tracking-[0.2em] shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <span>Meet Our Artisans</span>
                  <span className="transform group-hover:translate-x-1.5 transition-transform duration-200 text-[#D4A76A]">
                    &rarr;
                  </span>
                </Link>
              </div>
            </div>

            {/* Bottom-Left Micro Element: Scroll to Explore */}
            <div className="flex items-center space-x-3 pt-4 sm:pt-6">
              <div className="w-[1px] h-6 bg-[#C89B59]" />
              <div className="text-[9px] uppercase tracking-[0.22em] text-[#C89B59] font-sans font-medium leading-tight">
                <span>SCROLL</span>
                <br />
                <span>TO EXPLORE</span>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
