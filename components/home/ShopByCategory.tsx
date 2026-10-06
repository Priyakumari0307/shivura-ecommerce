"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

export interface CategoryItem {
  id: string;
  name: string;
  image?: string | null;
  imageSrc?: string | null;
  slug: string;
  href?: string;
}

export const CATEGORIES_DATA: CategoryItem[] = [
  {
    id: "festive-living",
    name: "Festive Living",
    image: "/images/festive living.png",
    slug: "festive-living",
  },
  {
    id: "home-decor",
    name: "Home Decor",
    image: "/images/home decor.png",
    slug: "home-decor",
  },
  {
    id: "lighting",
    name: "Lighting",
    image: "/images/lighting.png",
    slug: "lighting",
  },
  {
    id: "gifting",
    name: "Gifting",
    image: "/images/gifting.png",
    slug: "gifting",
  },
];

interface ShopByCategoryProps {
  categories?: CategoryItem[];
}

/**
 * Resolve the navigation route for a category item based on its slug or custom href.
 */
function getCategoryHref(cat: CategoryItem): string {
  if (cat.href) return cat.href;
  if (cat.slug === "festive-living" || cat.slug === "festival-living") {
    return "/shop/festival-living";
  }
  if (["home-decor", "lighting", "gifting"].includes(cat.slug)) {
    return `/shop/${cat.slug}`;
  }
  return `/shop?category=${encodeURIComponent(cat.slug)}`;
}

export function ShopByCategory({ categories = CATEGORIES_DATA }: ShopByCategoryProps) {
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
  }, [checkScroll, categories]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 220);
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-7 sm:py-10 bg-[#FAF8F5] border-b border-stone-200/60">
      <Container size="wide">
        {/* Section Heading */}
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-neutral-900 font-normal tracking-tight">
            Shop by Category
          </h2>
          <div className="w-10 h-[1px] bg-neutral-300 mx-auto mt-2.5 sm:mt-3" />
        </div>

        {/* Carousel Slider with Navigation Arrows */}
        <div className="relative group/carousel max-w-6xl mx-auto px-2 sm:px-6">
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Previous categories"
            className={cn(
              "absolute -left-2 sm:-left-3 lg:-left-5 top-14 sm:top-18 lg:top-20 -translate-y-1/2 z-20",
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 border border-stone-300/80 shadow-md shadow-stone-900/5",
              "flex items-center justify-center text-neutral-700 hover:text-white hover:bg-neutral-900 hover:border-neutral-900 hover:shadow-lg",
              "transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-800",
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
            aria-label="Next categories"
            className={cn(
              "absolute -right-2 sm:-right-3 lg:-right-5 top-14 sm:top-18 lg:top-20 -translate-y-1/2 z-20",
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 border border-stone-300/80 shadow-md shadow-stone-900/5",
              "flex items-center justify-center text-neutral-700 hover:text-white hover:bg-neutral-900 hover:border-neutral-900 hover:shadow-lg",
              "transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-800",
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
            <div className="flex items-start gap-6 sm:gap-8 lg:gap-10 w-fit min-w-full justify-start sm:justify-center mx-auto">
              {categories.map((cat) => {
                const image = cat.image || cat.imageSrc;
                const href = getCategoryHref(cat);

                return (
                  <Link
                    key={cat.id}
                    href={href}
                    className="group flex flex-col items-center text-center space-y-3 shrink-0 focus:outline-none"
                    style={{ scrollSnapAlign: "center" }}
                  >
                    {/* Circular Avatar / Image Container */}
                    <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full border-2 border-stone-200 bg-stone-100 overflow-hidden shadow-2xs group-hover:border-neutral-900 group-hover:shadow-md transition-all duration-300">
                      {image ? (
                        <Image
                          src={image}
                          alt={cat.name}
                          fill
                          sizes="(max-width: 640px) 112px, (max-width: 1024px) 144px, 160px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      ) : (
                        /* Blank Aesthetic Placeholder */
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-stone-200/60 to-stone-100 text-neutral-400 group-hover:text-neutral-700 transition-colors">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-60 group-hover:scale-110 transition-transform"
                          >
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                          </svg>
                          <span className="text-[10px] font-sans uppercase tracking-[0.2em] mt-1 opacity-70">
                            Photo
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Category Name */}
                    <span className="font-serif text-sm sm:text-base text-neutral-800 font-normal tracking-wide group-hover:text-neutral-950 transition-colors">
                      {cat.name}
                    </span>
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
