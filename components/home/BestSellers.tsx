"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BEST_SELLERS_PRODUCTS } from "@/lib/constants";
import { Product } from "@/types";
import { useShop } from "@/context/ShopContext";

interface BestSellersProps {
  products?: Product[];
}

export function BestSellers({ products = BEST_SELLERS_PRODUCTS }: BestSellersProps) {
  const { isWishlisted, toggleWishlist, addToCart } = useShop();
  const [sortBy, setSortBy] = useState<string>("default");
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});

  const handleToggleWishlist = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    setAddedItems((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [product.id]: false }));
    }, 1800);
  };

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === "price-low") {
      return list.sort((a, b) => a.price - b.price);
    }
    if (sortBy === "price-high") {
      return list.sort((a, b) => b.price - a.price);
    }
    if (sortBy === "rating") {
      return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return list;
  }, [products, sortBy]);

  return (
    <section className="py-10 sm:py-14 lg:py-16 bg-[#FAF8F5] border-b border-stone-200/60">
      <Container size="wide">
        {/* Section Header with Decorative Lines and Lotus Motif */}
        <div className="relative mb-8 sm:mb-10">
          {/* Top Row: Decorative Line + Best Sellers Title + Decorative Line */}
          <div className="flex items-center justify-center space-x-4 sm:space-x-8">
            <div className="h-[1px] bg-[#D4C3B2] flex-1 max-w-[120px] sm:max-w-[200px] md:max-w-[260px]" />
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#3A2A1E] font-normal tracking-normal text-center">
              Best Sellers
            </h2>
            <div className="h-[1px] bg-[#D4C3B2] flex-1 max-w-[120px] sm:max-w-[200px] md:max-w-[260px]" />
          </div>

          {/* Center Decorative Lotus Motif */}
          <div className="flex items-center justify-center space-x-3 mt-1.5">
            <div className="h-[1px] bg-[#D4C3B2] w-12 sm:w-16 opacity-70" />
            <div className="text-[#B88746] flex items-center justify-center">
              {/* Symmetrical Lotus Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 20"
                fill="currentColor"
                className="w-5 h-4 text-[#B88746]"
                aria-hidden="true"
              >
                {/* Center petal */}
                <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" opacity="0.95" />
                {/* Left inner petal */}
                <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.9" />
                {/* Right inner petal */}
                <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.9" />
                {/* Left outer petal */}
                <path d="M13.5 7 C8.5 10, 8 14.5, 14.5 15 C11 13.5, 10.5 10.5, 13.5 7 Z" opacity="0.8" />
                {/* Right outer petal */}
                <path d="M18.5 7 C23.5 10, 24 14.5, 17.5 15 C21 13.5, 21.5 10.5, 18.5 7 Z" opacity="0.8" />
                {/* Base curve */}
                <path d="M11 15.5 C14 17, 18 17, 21 15.5 C19 16.5, 13 16.5, 11 15.5 Z" opacity="0.95" />
              </svg>
            </div>
            <div className="h-[1px] bg-[#D4C3B2] w-12 sm:w-16 opacity-70" />
          </div>

          {/* Sort By Dropdown (Right-aligned) */}
          <div className="flex justify-end items-center mt-3 sm:mt-0 sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
            <label htmlFor="best-seller-sort" className="text-xs text-[#7E6955] font-sans mr-2">
              Sort by:
            </label>
            <div className="relative inline-block">
              <select
                id="best-seller-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-white/70 hover:bg-white border border-[#D5C4B4] rounded-full px-3.5 py-1.5 pr-7 text-xs font-sans text-[#4A392A] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746] shadow-2xs cursor-pointer transition-colors"
              >
                <option value="default">Default</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#7E6955]">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-6 lg:gap-7">
          {sortedProducts.map((product) => {
            const isLiked = isWishlisted(product.id);
            const isAdded = !!addedItems[product.id];

            return (
              <div
                key={product.id}
                className="group relative flex flex-col justify-between"
              >
                <div>
                  {/* Image Container with Badge & Wishlist Heart */}
                  <Link
                    href={product.href}
                    className="relative block aspect-[4/3] rounded-2xl overflow-hidden bg-[#F2ECE4] border border-stone-200/80 shadow-2xs group-hover:shadow-md transition-all duration-300 focus:outline-none"
                  >
                    <Image
                      src={product.imageSrc}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />

                    {/* Top-Left 'New' Badge */}
                    {product.isNew && (
                      <div className="absolute top-3 left-3 bg-[#B58544] text-white text-[11px] font-sans font-medium px-2.5 py-0.5 rounded-full shadow-xs tracking-wide pointer-events-none">
                        New
                      </div>
                    )}

                    {/* Top-Right Wishlist Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleWishlist(product, e)}
                      aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
                      className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-[2px] cursor-pointer ${
                        isLiked
                          ? "bg-white text-rose-600 shadow-sm"
                          : "bg-black/15 text-white hover:bg-black/35 hover:scale-110"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={isLiked ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </svg>
                    </button>
                  </Link>

                  {/* Product Information */}
                  <div className="pt-3.5 pb-1 space-y-1.5">
                    {/* Title */}
                    <Link
                      href={product.href}
                      className="block font-serif text-[13.5px] sm:text-[14px] text-[#33251A] font-normal leading-[1.38] line-clamp-2 min-h-[38px] group-hover:text-[#8E531A] transition-colors focus:outline-none"
                    >
                      {product.name}
                    </Link>

                    {/* Prices */}
                    <div className="flex items-center space-x-2 pt-0.5">
                      {product.originalPrice && (
                        <span className="text-[#8F8175] line-through text-xs font-light">
                          ₹{product.originalPrice.toFixed(2)}
                        </span>
                      )}
                      <span className="font-semibold text-[#281E15] text-sm sm:text-[14.5px]">
                        ₹{product.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Star Ratings & Reviews Count */}
                    <div className="min-h-[20px] flex items-center">
                      {product.rating ? (
                        <div className="flex items-center space-x-1">
                          <div className="flex text-[#C89438] space-x-0.5">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill={i < Math.floor(product.rating || 0) ? "currentColor" : "none"}
                                stroke="currentColor"
                                strokeWidth="1"
                                className="w-3.5 h-3.5 fill-[#C89438]"
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            ))}
                          </div>
                          {product.reviewCount && (
                            <span className="text-xs text-[#7A6451] font-sans font-light">
                              ({product.reviewCount})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Add to Bag Button */}
                <button
                  type="button"
                  onClick={(e) => handleAddToCart(product, e)}
                  className={`w-full mt-3 py-2.5 px-4 rounded-full font-sans text-xs sm:text-[13px] font-medium flex items-center justify-center space-x-2 transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer ${
                    isAdded
                      ? "bg-[#8E531A] text-stone-50"
                      : "bg-[#EFE4D6] hover:bg-[#E5D5C4] text-[#4A392C]"
                  }`}
                >
                  {isAdded ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-stone-50"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>Added to Bag</span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#4A392C]"
                      >
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        <path d="M3 6h18" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                      <span>Add to bag</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
