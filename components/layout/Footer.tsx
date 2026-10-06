"use client";

import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";

export function Footer() {
  const footerLinks = [
    { label: "Contact", href: "/contact" },
    { label: "Returns", href: "/returns" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Shipping & Delivery", href: "/shipping" },
    { label: "Privacy & Policy", href: "/privacy" },
    { label: "Cancellation Policy", href: "/cancellation" },
  ];

  return (
    <footer className="bg-[#181412] text-stone-300 font-sans border-t border-stone-800/80">
      <Container size="wide" className="py-12 sm:py-16">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 md:gap-16">
          {/* Left Column: Brand & Contact Info */}
          <div className="space-y-5 max-w-sm">
            {/* Brand Logo / Name */}
            <Link href="/" className="inline-block">
              <span className="font-serif text-2xl sm:text-[26px] tracking-[0.2em] font-normal text-stone-100 block uppercase">
                SHIVURA
              </span>
            </Link>

            {/* Social Icons */}
            <div className="flex items-center space-x-4 text-stone-200">
              {/* Twitter / X */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter / X"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>

            {/* Contact Details */}
            <div className="space-y-1 pt-1 text-xs text-stone-300/90 font-light leading-relaxed">
              <p className="font-normal text-stone-200">Contact Us</p>
              <p>Mail: info@shivura.com</p>
              <p>Phone : +91 9650218876</p>
            </div>
          </div>

          {/* Right Column: Navigation Links with Underlines */}
          <div className="w-full md:w-auto">
            <ul className="space-y-3 md:text-right">
              {footerLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-xs sm:text-[13px] text-stone-200/90 underline underline-offset-4 decoration-stone-500 hover:decoration-stone-200 hover:text-white transition-all font-light inline-block"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-12 pt-6 border-t border-stone-800/60 text-[11px] text-stone-500 font-light text-center">
          <p>© {new Date().getFullYear()} SHIVURA. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
