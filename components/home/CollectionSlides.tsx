"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";

export function CollectionSlides() {
  return (
    <section className="relative w-full overflow-hidden border-y border-stone-200/60 flex items-center min-h-[300px] sm:min-h-[340px] lg:min-h-[380px]">
      {/* Background Image: explore image.png covering full width end-to-end */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/explore image.png"
          alt="Explore Festive Collection"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center lg:object-[center_35%]"
        />
        {/* Soft subtle gradient for flawless readability on smaller screens */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FAF8F5]/80 via-[#FAF8F5]/30 to-transparent sm:from-[#FAF8F5]/20 sm:via-transparent" />
      </div>

      {/* Content Overlay - Left-aligned matching the reference image */}
      <Container size="wide" className="relative z-10 py-8 sm:py-10 lg:py-12">
        <div className="max-w-md sm:max-w-lg text-left pl-1 sm:pl-4">
          {/* Eyebrow / Kicker */}
          <p className="text-[10px] sm:text-[11px] md:text-xs uppercase tracking-[0.24em] text-[#8C6D4F] font-sans font-semibold mb-2 sm:mb-2.5">
            TRADITIONAL &bull; HANDCRAFTED &bull; TIMELESS
          </p>

          {/* Heading */}
          <h2 className="font-serif text-3xl sm:text-4xl md:text-[44px] lg:text-[48px] font-normal text-[#3E2719] leading-[1.1] tracking-tight mb-3 sm:mb-3.5">
            Explore
            <br />
            Festive Collection
          </h2>

          {/* Subtitle / Description */}
          <p className="text-xs sm:text-sm md:text-[15px] text-[#6E5540] font-light leading-relaxed max-w-sm mb-4 sm:mb-5">
            Bring home the warmth, culture and beauty of tradition.
          </p>

          {/* Action Button */}
          <div>
            <Link
              href="/shop/festival-living"
              className="inline-flex items-center space-x-2 px-6 sm:px-7 py-2.5 sm:py-3 rounded-full bg-[#8E531A] hover:bg-[#784311] text-stone-50 text-xs sm:text-sm font-sans font-medium tracking-wide shadow-xs hover:shadow-md transition-all duration-200 group"
            >
              <span>Shop Now</span>
              <span className="transform group-hover:translate-x-1 transition-transform duration-200">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
