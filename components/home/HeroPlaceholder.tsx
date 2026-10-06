import React from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export function HeroPlaceholder() {
  return (
    <section className="relative min-h-[500px] sm:min-h-[580px] lg:min-h-[640px] flex items-center overflow-hidden border-b border-stone-200/70">
      {/* Background Image */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/background.png"
          alt="Shivura Home Decoration"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Soft subtle tint for button contrast */}
        <div className="absolute inset-0 bg-stone-900/[0.04]" />
      </div>

      <Container size="wide" className="relative z-10 py-16 sm:py-24">
        <div className="max-w-xl text-left">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[11px] uppercase tracking-[0.2em] text-neutral-800 font-sans font-medium border border-stone-300/70 shadow-xs mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
            <span>New Collection 2026</span>
          </div>

          <h1 className="sr-only">Shivura — Handcrafted Luxury Lifestyle</h1>

          {/* Circular / Pill-Shaped Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Button
              href="/shop"
              variant="primary"
              size="lg"
              className="rounded-full px-8 py-3.5 shadow-sm hover:shadow-md transition-all"
            >
              Explore Collection
            </Button>
            <Button
              href="/our-story"
              variant="outline"
              size="lg"
              className="rounded-full bg-white/85 backdrop-blur-md hover:bg-neutral-900 hover:text-white transition-all px-8 py-3.5 border-neutral-900 shadow-2xs"
            >
              Our Story
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

