import React from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export interface HeroProps {
  heroImage?: {
    imageUrl?: string | null;
    altText?: string | null;
    badgeText?: string | null;
  } | null;
}

export function HeroPlaceholder({ heroImage }: HeroProps = {}) {
  const imageUrl = heroImage?.imageUrl || "/images/background.png";
  const altText = heroImage?.altText || "Shivura Home Decoration";
  const badgeText = heroImage?.badgeText || "New Collection 2026";

  // Check if default background image is in use to provide optimal mobile focal cropping
  const isDefaultImage =
    !heroImage?.imageUrl ||
    heroImage.imageUrl === "/images/background.png" ||
    heroImage.imageUrl.endsWith("background.png");

  return (
    <section className="relative min-h-[460px] sm:min-h-[560px] lg:min-h-[640px] flex items-end sm:items-center overflow-hidden border-b border-stone-200/70">
      {/* Background Photography */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={imageUrl}
          alt={altText}
          fill
          priority
          sizes="100vw"
          className={`object-cover ${
            isDefaultImage ? "object-[28%_center] sm:object-center" : "object-center"
          }`}
          unoptimized={
            imageUrl.startsWith("http://") ||
            (imageUrl.startsWith("https://") && !imageUrl.includes("res.cloudinary.com"))
          }
        />
        {/* Soft subtle tint for contrast */}
        <div className="absolute inset-0 bg-stone-900/[0.04]" />
        {/* Luxury subtle gradient on mobile so background image remains bright & visible while badge & buttons pop crisply */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-stone-950/40 via-stone-900/10 to-transparent sm:hidden pointer-events-none" />
      </div>

      <Container size="wide" className="relative z-10 w-full pt-16 pb-8 sm:py-24">
        <div className="max-w-xl text-left">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 sm:px-4 sm:py-1.5 bg-white/95 backdrop-blur-md rounded-full text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-neutral-800 font-sans font-medium border border-stone-300/80 shadow-xs mb-3.5 sm:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
            <span>{badgeText}</span>
          </div>

          <h1 className="sr-only">Shivura — Handcrafted Luxury Lifestyle</h1>

          {/* Action Buttons: side-by-side & compact on mobile, expansive on desktop */}
          <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
            <Button
              href="/shop"
              variant="primary"
              size="md"
              className="rounded-full px-5 py-2.5 sm:px-8 sm:py-3.5 text-xs sm:text-sm font-medium shadow-md hover:shadow-lg transition-all flex-1 sm:flex-initial text-center justify-center cursor-pointer"
            >
              Explore Collection
            </Button>
            <Button
              href="/our-story"
              variant="outline"
              size="md"
              className="rounded-full bg-white/90 backdrop-blur-md hover:bg-neutral-900 hover:text-white transition-all px-5 py-2.5 sm:px-8 sm:py-3.5 text-xs sm:text-sm font-medium border-neutral-900 text-neutral-900 shadow-sm flex-1 sm:flex-initial text-center justify-center cursor-pointer"
            >
              Our Story
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

