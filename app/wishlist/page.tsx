"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useShop } from "@/context/ShopContext";

export default function WishlistPage() {
  const { wishlist, removeFromWishlist, addToCart } = useShop();

  return (
    <div className="py-12 sm:py-16 bg-[#FAF8F5] min-h-[75vh]">
      <Container size="wide">
        {/* Header */}
        <div className="text-center space-y-2.5 mb-10">
          <div className="inline-flex items-center space-x-2 text-[#B88746] text-xs uppercase tracking-widest font-sans font-medium">
            <span>✦</span>
            <span>Your Curated Favorites</span>
            <span>✦</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2C2117]">
            My Wishlist
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] font-light">
            {wishlist.length} {wishlist.length === 1 ? "handcrafted piece saved" : "handcrafted pieces saved"}
          </p>
        </div>

        {wishlist.length > 0 ? (
          <div>
            {/* Wishlist Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {wishlist.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-[#DFCBB8]/70 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Image Area */}
                    <div className="relative aspect-[4/3] bg-[#F2ECE4] overflow-hidden">
                      <Image
                        src={product.imageSrc}
                        alt={product.name}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-500"
                      />
                      {product.badge && (
                        <div className="absolute top-3 left-3 bg-[#1C2820]/90 text-[#FAF5EB] text-[10.5px] font-sans font-medium px-2.5 py-0.5 rounded-full">
                          {product.badge}
                        </div>
                      )}
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFromWishlist(product.id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-stone-500 hover:text-red-600 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                        title="Remove from Wishlist"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>

                    {/* Content Details */}
                    <div className="p-4 space-y-2">
                      <Link
                        href={product.href}
                        className="block font-serif text-[14.5px] text-[#302318] hover:text-[#8E531A] line-clamp-2 min-h-[40px] leading-snug"
                      >
                        {product.name}
                      </Link>

                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-[#281E15] text-[15px]">
                          ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {product.originalPrice && (
                          <span className="text-[#8F8175] line-through text-xs font-light">
                            ₹{product.originalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(product, 1);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs font-sans font-medium tracking-wide flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-2xs"
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
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                      </svg>
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-12 text-center">
              <Button href="/shop" variant="secondary">
                Continue Exploring Collection
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 p-10 sm:p-14 rounded-2xl border border-[#DFCBB8]/70 text-center space-y-6 shadow-2xs max-w-lg mx-auto">
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
            <div className="pt-2">
              <Button href="/shop" variant="primary">
                Explore Handcrafted Shop
              </Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
