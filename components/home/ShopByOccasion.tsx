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
    image: "/images/om-rakhi.jpg",
    slug: "rakhi",
  },
  {
    id: "festive-gifting",
    name: "Festive Gifting",
    image: "/images/gifting.png",
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
    image: "/images/home decor.png",
    slug: "everyday-living",
    lineBreakName: (
      <>
        Everyday
        <br />
        Living
      </>
    ),
  },
  {
    id: "griha-pravesh",
    name: "Griha Pravesh",
    image: "/images/explore image.png",
    slug: "griha-pravesh",
    lineBreakName: (
      <>
        Griha
        <br />
        Pravesh
      </>
    ),
  },
  {
    id: "weddings",
    name: "Weddings",
    image: "/images/artisan-diya-woman.jpg",
    slug: "weddings",
  },
  {
    id: "puja-rituals",
    name: "Puja & Rituals",
    image: "/images/terracotta-diyas-cloth.jpg",
    slug: "puja-rituals",
    lineBreakName: (
      <>
        Puja &amp;
        <br />
        Rituals
      </>
    ),
  },
  {
    id: "new-beginnings",
    name: "New Beginnings",
    image: "/images/Product1.png",
    slug: "new-beginnings",
    lineBreakName: (
      <>
        New
        <br />
        Beginnings
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

const OCCASION_LINE_BREAKS: Record<string, React.ReactNode> = {
  "festive-gifting": (
    <>
      Festive
      <br />
      Gifting
    </>
  ),
  "everyday-living": (
    <>
      Everyday
      <br />
      Living
    </>
  ),
  "griha-pravesh": (
    <>
      Griha
      <br />
      Pravesh
    </>
  ),
  "puja-rituals": (
    <>
      Puja &amp;
      <br />
      Rituals
    </>
  ),
  "new-beginnings": (
    <>
      New
      <br />
      Beginnings
    </>
  ),
};

export function ShopByOccasion({ occasions: initialOccasions }: ShopByOccasionProps) {
  const [fetchedOccasions, setFetchedOccasions] = useState<OccasionItem[] | null>(null);
  const occasions =
    initialOccasions && initialOccasions.length > 0
      ? initialOccasions
      : fetchedOccasions && fetchedOccasions.length > 0
      ? fetchedOccasions
      : OCCASIONS_DATA;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Graceful client fallback to public occasions API if no occasions were provided
  useEffect(() => {
    if (!initialOccasions || initialOccasions.length === 0) {
      let isMounted = true;
      fetch("/api/occasions")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (isMounted && json?.data && Array.isArray(json.data) && json.data.length > 0) {
            setFetchedOccasions(json.data);
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [initialOccasions]);

  const checkScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const maxScroll = scrollWidth - clientWidth;
    const scrollable = maxScroll > 4;
    setIsScrollable(scrollable);
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (!container) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        checkScroll();
      });
      resizeObserver.observe(container);
    }

    window.addEventListener("resize", checkScroll);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, occasions]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 220);
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(checkScroll, 350);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !scrollContainerRef.current) return;
    isMouseDownRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current || !scrollContainerRef.current) return;
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const delta = x - startXRef.current;
    if (Math.abs(delta) > 5) {
      if (!isDragging) setIsDragging(true);
      hasDraggedRef.current = true;
    }
    if (hasDraggedRef.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft = scrollLeftRef.current - delta;
    }
  };

  const handleMouseUpOrLeave = () => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    setIsDragging(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
      checkScroll();
    }, 50);
  };

  return (
    <section className="w-full overflow-hidden py-7 sm:py-10 bg-[#FAF8F5] border-b border-stone-200/60">
      <Container size="wide">
        {/* Section Heading & Subtitle */}
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-neutral-900 font-normal tracking-tight">
            Shop by Occasion
          </h2>
          <div className="w-10 h-[1px] bg-neutral-300 mx-auto mt-2.5 sm:mt-3 mb-2" />
          <p className="text-xs sm:text-[13px] text-[#735F4E] font-light">
            Find the perfect gift for every sacred moment &amp; celebration
          </p>
        </div>

        {/* Carousel Slider with Navigation Arrows */}
        <div className="relative group/carousel max-w-6xl mx-auto px-2 sm:px-6">
          {/* Left Arrow Button (Desktop / Tablet) */}
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Previous occasions"
            aria-disabled={!canScrollLeft}
            className={cn(
              "hidden sm:flex absolute -left-2 sm:-left-3 lg:-left-5 top-14 sm:top-18 lg:top-20 -translate-y-1/2 z-20",
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 border border-stone-300/80 shadow-md shadow-stone-900/5",
              "items-center justify-center text-neutral-700",
              "transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-800",
              !canScrollLeft
                ? "opacity-35 cursor-not-allowed border-stone-200 text-stone-300 bg-white/60 shadow-none"
                : "opacity-100 hover:text-white hover:bg-neutral-900 hover:border-neutral-900 hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
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

          {/* Right Arrow Button (Desktop / Tablet) */}
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Next occasions"
            aria-disabled={!canScrollRight}
            className={cn(
              "hidden sm:flex absolute -right-2 sm:-right-3 lg:-right-5 top-14 sm:top-18 lg:top-20 -translate-y-1/2 z-20",
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 border border-stone-300/80 shadow-md shadow-stone-900/5",
              "items-center justify-center text-neutral-700",
              "transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-800",
              !canScrollRight
                ? "opacity-35 cursor-not-allowed border-stone-200 text-stone-300 bg-white/60 shadow-none"
                : "opacity-100 hover:text-white hover:bg-neutral-900 hover:border-neutral-900 hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
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
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={cn(
              "overflow-x-auto py-3 px-2 sm:px-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              isDragging ? "cursor-grabbing select-none" : isScrollable ? "cursor-grab" : ""
            )}
            style={{
              scrollSnapType: isDragging ? "none" : "x proximity",
              scrollBehavior: isDragging ? "auto" : "smooth",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              className={cn(
                "flex items-start gap-6 sm:gap-8 lg:gap-10 w-fit min-w-full",
                isScrollable ? "justify-start" : "justify-start sm:justify-center mx-auto"
              )}
            >
              {occasions.map((occasion) => {
                const image = occasion.image || occasion.imageSrc;
                const href = getOccasionHref(occasion);
                const displayName =
                  occasion.lineBreakName ||
                  OCCASION_LINE_BREAKS[occasion.slug] ||
                  occasion.name;

                return (
                  <Link
                    key={occasion.id}
                    href={href}
                    onClick={(e) => {
                      if (hasDraggedRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                    draggable={false}
                    className={cn(
                      "group flex flex-col items-center text-center space-y-3 shrink-0 focus:outline-none select-none",
                      isDragging ? "cursor-grabbing" : "cursor-pointer"
                    )}
                    style={{ scrollSnapAlign: "center" }}
                  >
                    {/* Circular Avatar / Image Container */}
                    <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-full border-2 border-[#DFC9A8] ring-4 ring-white/90 bg-[#F4EDE2] overflow-hidden shadow-2xs group-hover:border-neutral-900 group-hover:shadow-md group-hover:scale-105 transition-all duration-300">
                      {image ? (
                        <Image
                          src={image}
                          alt={occasion.name}
                          fill
                          sizes="(max-width: 640px) 112px, (max-width: 1024px) 144px, 160px"
                          className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out pointer-events-none select-none"
                          draggable={false}
                        />
                      ) : (
                        /* Blank Aesthetic Placeholder */
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-stone-200/60 to-stone-100 text-neutral-400 group-hover:text-neutral-700 transition-colors pointer-events-none select-none">
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

                    {/* Occasion Label */}
                    <div className="min-h-[40px] flex items-start justify-center">
                      <span className="font-serif text-sm sm:text-base text-neutral-800 font-normal tracking-wide group-hover:text-neutral-950 transition-colors leading-tight">
                        {displayName}
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
