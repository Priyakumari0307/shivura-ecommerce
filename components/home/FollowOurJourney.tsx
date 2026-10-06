"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";

export interface JourneyStory {
  id: string;
  step: string;
  title: string;
  description: string;
  imageSrc: string;
}

export const JOURNEY_STORIES: JourneyStory[] = [
  {
    id: "tradition",
    step: "01",
    title: "Rooted in Tradition",
    description: "Every piece begins with a deep respect for our heritage and the earth.",
    imageSrc: "/images/Art1.png",
  },
  {
    id: "craft",
    step: "02",
    title: "Skilled Hands, Timeless Craft",
    description: "Generations of artisans, carrying forward a legacy of excellence.",
    imageSrc: "/images/Art2.png",
  },
  {
    id: "stories",
    step: "03",
    title: "Bringing Stories to Your Space",
    description: "Each creation is more than decor — it's a piece of culture, crafted for your home.",
    imageSrc: "/images/Art3.png",
  },
];

export function FollowOurJourney() {
  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-[#FAF8F5] border-b border-stone-200/60 overflow-hidden">
      <Container size="wide">
        {/* Top Eyebrow & Motif */}
        <div className="text-center mb-2">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.26em] text-[#8C7359] font-sans font-medium">
            CRAFTED BY HAND &bull; INSPIRED BY TRADITION
          </p>

          {/* Lotus motif */}
          <div className="flex items-center justify-center space-x-3 mt-2 mb-1.5">
            <div className="h-[1px] bg-[#D4C3B2] w-12 sm:w-16 opacity-70" />
            <div className="text-[#B88746] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 20"
                fill="currentColor"
                className="w-4 h-3.5 text-[#B88746]"
                aria-hidden="true"
              >
                <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" opacity="0.95" />
                <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.9" />
                <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.9" />
                <path d="M13.5 7 C8.5 10, 8 14.5, 14.5 15 C11 13.5, 10.5 10.5, 13.5 7 Z" opacity="0.8" />
                <path d="M18.5 7 C23.5 10, 24 14.5, 17.5 15 C21 13.5, 21.5 10.5, 18.5 7 Z" opacity="0.8" />
                <path d="M11 15.5 C14 17, 18 17, 21 15.5 C19 16.5, 13 16.5, 11 15.5 Z" opacity="0.95" />
              </svg>
            </div>
            <div className="h-[1px] bg-[#D4C3B2] w-12 sm:w-16 opacity-70" />
          </div>

          {/* Heading */}
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-normal leading-[1.15] text-center">
            <span className="text-[#1E3028]">Follow Our </span>
            <span className="italic text-[#B58544] font-serif">Journey</span>
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-[14.5px] text-[#735F4E] font-light text-center max-w-xl mx-auto mt-2 sm:mt-2.5 leading-relaxed">
            From raw earth to exquisite creations, explore the hands, heritage and heart
            <br className="hidden sm:inline" />
            {" "}behind every piece we craft.
          </p>
        </div>

        {/* 3 Story Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mt-9 sm:mt-12">
          {JOURNEY_STORIES.map((story) => (
            <div key={story.id} className="flex flex-col items-center text-center group">
              {/* Framed Image Container */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-[2.5px] border-[#DFC9A8] ring-3 ring-white/90 bg-[#F4EDE2] shadow-sm transition-all duration-300">
                <Image
                  src={story.imageSrc}
                  alt={story.title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 ease-out"
                />
              </div>

              {/* Number Badge Pill */}
              <div className="w-7 h-7 rounded-full bg-[#B88746] text-white text-[11px] font-sans font-medium flex items-center justify-center mx-auto -mt-3.5 relative z-10 shadow-xs ring-2 ring-white">
                {story.step}
              </div>

              {/* Title with Flanking Horizontal Lines */}
              <div className="flex items-center justify-center space-x-2.5 sm:space-x-3 mt-3 w-full">
                <div className="h-[1px] bg-[#D4C3B2] w-6 sm:w-10 opacity-70" />
                <h3 className="font-serif text-base sm:text-[17px] text-[#281E16] font-normal tracking-wide text-center">
                  {story.title}
                </h3>
                <div className="h-[1px] bg-[#D4C3B2] w-6 sm:w-10 opacity-70" />
              </div>

              {/* Description */}
              <p className="italic font-serif text-xs sm:text-[13px] text-[#7A6655] font-light text-center mt-1.5 max-w-xs mx-auto leading-relaxed">
                {story.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA with Lotus & Lines */}
        <div className="flex items-center justify-center space-x-3 sm:space-x-5 mt-10 sm:mt-14">
          <div className="h-[1px] bg-[#D4C3B2] flex-1 max-w-[60px] sm:max-w-[120px] md:max-w-[180px]" />
          
          <div className="text-[#B88746] hidden sm:flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20" fill="currentColor" className="w-3.5 h-3 text-[#B88746]">
              <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" opacity="0.95" />
              <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.9" />
              <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.9" />
            </svg>
          </div>

          <div className="h-[1px] bg-[#D4C3B2] w-6 sm:w-10 opacity-70 hidden sm:block" />

          {/* Follow Us Button */}
          <Link
            href="/our-story"
            className="inline-flex items-center space-x-3 px-7 sm:px-8 py-3 rounded-full border border-[#B88746]/80 bg-[#16271E] hover:bg-[#0F1B14] text-stone-100 text-[11px] sm:text-xs font-sans font-medium uppercase tracking-[0.2em] shadow-sm hover:shadow-md transition-all duration-300 group"
          >
            {/* Small floral icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-3.5 h-3.5 text-[#B88746]"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" opacity="0" />
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
              <circle cx="6" cy="12" r="1.5" />
              <circle cx="18" cy="12" r="1.5" />
            </svg>
            <span>Follow Us</span>
            <span className="transform group-hover:translate-x-1 transition-transform duration-200 text-[#D4A76A]">
              &rarr;
            </span>
          </Link>

          <div className="h-[1px] bg-[#D4C3B2] w-6 sm:w-10 opacity-70 hidden sm:block" />

          <div className="text-[#B88746] hidden sm:flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20" fill="currentColor" className="w-3.5 h-3 text-[#B88746]">
              <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" opacity="0.95" />
              <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.9" />
              <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.9" />
            </svg>
          </div>

          <div className="h-[1px] bg-[#D4C3B2] flex-1 max-w-[60px] sm:max-w-[120px] md:max-w-[180px]" />
        </div>
      </Container>
    </section>
  );
}
