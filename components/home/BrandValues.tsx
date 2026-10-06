import React from "react";
import { Container } from "@/components/ui/Container";
import { BRAND_PILLARS } from "@/lib/constants";

export function BrandValues() {
  return (
    <section className="py-16 sm:py-24 bg-[#FAF8F5]">
      <Container size="wide">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-sans font-medium">
            The Shivura Essence
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-neutral-900 font-normal">
            Rooted in Purpose & Elegance
          </h2>
          <div className="w-10 h-[1px] bg-neutral-400 mx-auto mt-4" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {BRAND_PILLARS.map((pillar, index) => (
            <div
              key={pillar.title}
              className="p-8 bg-white/60 border border-stone-200/80 rounded-xs hover:border-stone-400/80 transition-all duration-300 space-y-4 shadow-2xs"
            >
              <div className="text-xs font-serif italic text-neutral-400">
                0{index + 1}
              </div>
              <h3 className="font-serif text-xl text-neutral-900 font-normal">
                {pillar.title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
