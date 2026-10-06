"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";

export function NewsletterStory() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <section className="relative w-full py-16 sm:py-20 lg:py-24 overflow-hidden border-b border-stone-800/40 bg-[#2A201A]">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/Hand.png"
          alt="Artisan Background"
          fill
          unoptimized
          sizes="100vw"
          className="object-cover object-center brightness-[0.72] contrast-[1.05] scale-105"
        />
        {/* Soft, warm atmospheric tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/45" />
      </div>

      <Container size="default" className="relative z-10 text-center">
        {/* Heading */}
        <h2 className="font-serif text-3xl sm:text-4xl md:text-[44px] text-white font-normal tracking-normal drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
          Be Part of the Story
        </h2>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm md:text-base text-stone-100 font-light max-w-xl mx-auto mt-2 sm:mt-3 leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
          Discover new collections, artisan stories and festive edits before everyone else.
        </p>

        {/* Newsletter Form */}
        <div className="max-w-md mx-auto mt-8 sm:mt-10">
          {subscribed ? (
            <div className="p-4 rounded-full bg-black/40 border border-[#CD7455]/60 text-stone-100 text-xs sm:text-sm backdrop-blur-sm shadow-md animate-fade-in">
              Thank you for being part of our story. Welcome to Shivura!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col items-center">
              <div className="w-full text-left">
                <label
                  htmlFor="newsletter-email"
                  className="block text-xs text-[#F2C97E] font-sans font-medium mb-1.5 pl-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                >
                  Your email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full bg-[#EDE7E0] hover:bg-white focus:bg-white text-stone-900 text-xs sm:text-sm px-4 py-3 outline-none transition-colors placeholder:text-stone-500 shadow-sm border border-stone-300/60"
                />
              </div>

              {/* Terracotta / Rust Subscribe Button */}
              <button
                type="submit"
                className="mt-4 px-9 py-2.5 rounded-full bg-[#CD7455] hover:bg-[#BA6345] active:scale-[0.98] text-white font-sans text-xs sm:text-[13px] font-medium tracking-wide transition-all shadow-md cursor-pointer"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
