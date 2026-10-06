"use client";

import React, { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "How long does standard delivery take across India?",
    answer:
      "Most orders are processed within 1–2 business days. Delivery across major metro cities takes 3–5 business days, while other pin codes typically receive their handcrafted orders within 5–7 business days.",
  },
  {
    question: "Can I request custom frame sizes or personalized gift notes?",
    answer:
      "Yes, absolutely. We offer bespoke sizing for acrylic photo frames and custom handwritten calligraphy cards for festive and celebratory gifting. Please mention your request in the contact form above or message us on WhatsApp.",
  },
  {
    question: "Do you offer corporate or bulk festival gifting?",
    answer:
      "Yes! We curate exquisite bulk gifting packages with custom brand sleeves, luxury wooden boxes, brass keepsakes, and traditional earthen diyas for corporate events, Diwali celebrations, and weddings.",
  },
  {
    question: "How should I care for terracotta pottery and brass artifacts?",
    answer:
      "For terracotta items, gently wipe with a soft dry cloth. For brass artifacts, polish with a drop of pitambari powder or lemon with salt occasionally to restore their deep golden royal luster.",
  },
];

export function ContactFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;

        return (
          <div
            key={idx}
            className="bg-[#FAF7F2] border border-[#DFCBB8]/80 rounded-2xl overflow-hidden transition-all duration-200 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => toggleFAQ(idx)}
              className="w-full flex items-center justify-between p-5 sm:p-6 text-left cursor-pointer focus:outline-none"
            >
              <span className="font-serif text-base sm:text-lg text-[#2C2117] font-normal pr-4">
                {item.question}
              </span>
              <div
                className={`w-7 h-7 rounded-full bg-[#F2E8DC] text-[#B88746] flex items-center justify-center shrink-0 transition-transform duration-300 ${
                  isOpen ? "rotate-180 bg-[#1E2721] text-[#E6CA65]" : ""
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="px-5 sm:px-6 pb-5 pt-0 text-xs sm:text-sm text-[#5C4A3A] font-light leading-relaxed border-t border-[#E8DCCF]/60">
                <p className="pt-3">{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
