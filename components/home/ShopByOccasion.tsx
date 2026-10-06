"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

export interface OccasionItem {
  id: string;
  name: string;
  image?: string | null;
  imageSrc?: string | null;
  slug: string;
  href?: string;
  lineBreakName?: React.ReactNode;
}

export const OCCASIONS_DATA: OccasionItem[] = [
  {
    id: "diwali",
    name: "Diwali",
    image: "/images/festive living.png",
    slug: "diwali",
  },
  {
    id: "rakhi",
    name: "Rakhi",
    image: null,
    slug: "rakhi",
  },
  {
    id: "festive-gifting",
    name: "Festive Gifting",
    image: "/images/lighting.png",
    slug: "festive-gifting",
    lineBreakName: (
      <>
        Festive
        <br />
        Gifting
      </>
    ),
  },
  {
    id: "everyday-living",
    name: "Everyday Living",
    image: "/images/gifting.png",
    slug: "everyday-living",
    lineBreakName: (
      <>
        Everyday
        <br />
        Living
      </>
    ),
  },
];

interface ShopByOccasionProps {
  occasions?: OccasionItem[];
}

/**
 * Resolve the navigation route for an occasion item based on its slug or custom href.
 */
function getOccasionHref(occasion: OccasionItem): string {
  if (occasion.href) return occasion.href;
  if (occasion.slug === "festive-living" || occasion.slug === "festival-living") {
    return "/shop/festival-living";
  }
  return `/shop?category=${encodeURIComponent(occasion.slug)}`;
}

export function ShopByOccasion({ occasions = OCCASIONS_DATA }: ShopByOccasionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => {
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, occasions]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 200);
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-7 sm:py-9 lg:py-11 bg-[#FAF8F5] border-b border-stone-200/60">
      <Container size="wide">
        {/* Section Heading & Subtitle */}
        <div className="text-center mb-5 sm:mb-7">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-[34px] text-[#1E2922] font-normal tracking-tight">
            Shop by Occasion
          </h2>
          <p className="text-xs sm:text-[13px] text-[#735F4E] font-light mt-1 sm:mt-1.5">
            Find the perfect for every moment
          </p>
        </div>

        {/* Carousel Slider with Navigation Arrows */}
        <div className="relative group/carousel max-w-5xl mx-auto px-2 sm:px-6">
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Previous occasions"
            className={cn(
              "absolute -left-2 sm:-left-3 lg:-left-5 top-12 sm:top-16 lg:top-18 -translate-y-1/2 z-20",
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FAF7F2]/95 border border-[#DFC9A8] shadow-md shadow-[#DFC9A8]/30",
              "flex items-center justify-center text-[#735F4E] hover:text-stone-100 hover:bg-[#1E3028] hover:border-[#1E3028] hover:shadow-lg",
              "transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E531A]",
              !canScrollLeft
                ? "opacity-0 pointer-events-none cursor-not-allowed scale-90"
                : "opacity-100 hover:scale-105 active:scale-95 cursor-pointer"
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Next occasions"
            className={cn(
              "absolute -right-2 sm:-right-3 lg:-right-5 top-12 sm:top-16 lg:top-18 -translate-y-1/2 z-20",
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FAF7F2]/95 border border-[#DFC9A8] shadow-md shadow-[#DFC9A8]/30",
              "flex items-center justify-center text-[#735F4E] hover:text-stone-100 hover:bg-[#1E3028] hover:border-[#1E3028] hover:shadow-lg",
              "transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E531A]",
              !canScrollRight
                ? "opacity-0 pointer-events-none cursor-not-allowed scale-90"
                : "opacity-100 hover:scale-105 active:scale-95 cursor-pointer"
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Horizontal Scroll Track */}
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="overflow-x-auto scroll-smooth py-3 px-2 sm:px-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{
              scrollSnapType: "x proximity",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div className="flex items-start gap-5 sm:gap-7 lg:gap-8 xl:gap-10 w-fit min-w-full justify-start sm:justify-center mx-auto">
              {occasions.map((occasion) => {
                const image = occasion.image || occasion.imageSrc;
                const href = getOccasionHref(occasion);

                return (
                  <Link
                    key={occasion.id}
                    href={href}
                    className="group flex flex-col items-center text-center shrink-0 focus:outline-none"
                    style={{ scrollSnapAlign: "center" }}
                  >
                    {/* Circular Container with Gold Border */}
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full overflow-hidden border-[2.5px] border-[#DFC9A8] ring-3 ring-white/90 bg-[#F4EDE2] shadow-sm group-hover:border-[#B5874B] group-hover:shadow-md group-hover:scale-105 transition-all duration-500">
                      {image ? (
                        <Image
                          src={image}
                          alt={occasion.name}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 96px, (max-width: 1024px) 128px, 144px"
                          className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                      ) : (
                        /* Blank Aesthetic Placeholder for Rakhi / null images */
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F5EFE6] via-[#EFE6D8] to-[#E9DCB] text-[#9E866D] group-hover:text-[#7A6451] transition-colors p-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-6 h-6 opacity-75 group-hover:scale-110 transition-transform"
                          >
                            <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                          </svg>
                          <span className="text-[9px] font-sans uppercase tracking-[0.2em] mt-1 opacity-80">
                            Coming Soon
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Occasion Label */}
                    <div className="mt-2.5 sm:mt-3 min-h-[36px] flex items-start justify-center">
                      <span className="font-serif text-sm sm:text-[15px] lg:text-base text-[#2A2017] font-normal leading-[1.25] tracking-wide group-hover:text-[#8E531A] transition-colors">
                        {occasion.lineBreakName || occasion.name}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
