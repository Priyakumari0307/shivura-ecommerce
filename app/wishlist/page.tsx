"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";

export default function WishlistPage() {
  const { wishlist, removeFromWishlist, addToCart } = useShop();
  const { isAuthenticated } = useAuth();
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAddToCart = (product: any) => {
    setAddingId(product.id);
    addToCart(product, 1);
    setTimeout(() => {
      setAddingId(null);
    }, 1200);
  };

  return (
    <div className="py-8 sm:py-16 bg-[#FAF8F5] min-h-[75vh]">
      <Container size="wide">
        {/* Header */}
        <div className="text-center space-y-2 mb-6 sm:mb-10">
          <div className="inline-flex items-center space-x-2 text-[#B88746] text-[11px] sm:text-xs uppercase tracking-widest font-sans font-medium">
            <span>✧</span>
            <span>Your Curated Favorites</span>
            <span>✧</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl text-[#2C2117]">
            My Wishlist
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] font-light">
            {wishlist.length} {wishlist.length === 1 ? "handcrafted piece saved" : "handcrafted pieces saved"}
          </p>
        </div>

        {wishlist.length > 0 ? (
          <div>
            {/* Wishlist Items Grid: 2 columns on mobile, 2 sm, 3 md, 4 lg */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
              {wishlist.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl sm:rounded-2xl border border-[#DFCBB8]/70 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Image Area */}
                    <div className="relative aspect-[4/3] bg-[#F2ECE4] overflow-hidden">
                      <Image
                        src={product.imageSrc}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover hover:scale-105 transition-transform duration-500"
                      />
                      {product.badge && (
                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-[#1C2820]/90 text-[#FAF5EB] text-[9.5px] sm:text-[10.5px] font-sans font-medium px-2 sm:px-2.5 py-0.5 rounded-full pointer-events-none">
                          {product.badge}
                        </div>
                      )}
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFromWishlist(product.id)}
                        className="absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 hover:bg-white text-stone-500 hover:text-red-600 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                        title="Remove from Wishlist"
                        aria-label="Remove from Wishlist"
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
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>

                    {/* Content Details */}
                    <div className="p-2.5 sm:p-4 space-y-1 sm:space-y-2">
                      <Link
                        href={product.href}
                        className="block font-serif text-xs sm:text-[14.5px] text-[#302318] hover:text-[#8E531A] line-clamp-2 min-h-[34px] sm:min-h-[40px] leading-snug"
                      >
                        {product.name}
                      </Link>

                      <div className="flex flex-wrap items-baseline gap-1 sm:gap-2 pt-0.5">
                        <span className="font-semibold text-[#281E15] text-xs sm:text-[15px]">
                          ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {product.originalPrice && (
                          <span className="text-[#8F8175] line-through text-[10px] sm:text-xs font-light">
                            ₹{product.originalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-2.5 sm:p-4 pt-0 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className="w-full py-2 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-[11px] sm:text-xs font-sans font-medium tracking-wide flex items-center justify-center space-x-1 sm:space-x-2 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                    >
                      {addingId === product.id ? (
                        <span>Added! ✓</span>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="shrink-0"
                          >
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <path d="M16 10a4 4 0 0 1-8 0"></path>
                          </svg>
                          <span className="truncate">Add to Cart</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-10 sm:mt-12 text-center">
              <Button href="/shop" variant="secondary">
                Continue Exploring Collection
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 p-8 sm:p-14 rounded-2xl border border-[#DFCBB8]/70 text-center space-y-6 shadow-2xs max-w-lg mx-auto">
            <div className="w-16 h-16 bg-[#FAF7F2] rounded-full flex items-center justify-center mx-auto text-[#B88746]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
              </svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-serif text-xl text-[#35271D]">Your wishlist is empty</h3>
              <p className="text-xs sm:text-sm text-[#7E6955] font-light max-w-xs mx-auto">
                Tap the heart icon on any handcrafted piece in our shop to curate your favorite treasures.
              </p>
            </div>
            <div className="pt-2 space-y-2">
              <Button href="/shop" variant="primary">
                Explore Handcrafted Shop
              </Button>
              {!isAuthenticated && (
                <div className="pt-1">
                  <Link
                    href="/login?returnUrl=%2Fwishlist&reason=wishlist"
                    className="text-xs text-[#B88746] hover:underline font-medium block"
                  >
                    Already have an account? Sign in to view saved items →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
