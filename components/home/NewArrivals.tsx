"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { NEW_ARRIVALS_PRODUCTS } from "@/lib/constants";
import { Product } from "@/types";
import { useShop } from "@/context/ShopContext";

interface NewArrivalsProps {
  products?: Product[];
}

export function NewArrivals({ products = NEW_ARRIVALS_PRODUCTS }: NewArrivalsProps) {
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
    <section className="bg-[#FAF8F5] border-b border-stone-200/60 overflow-hidden">
      {/* Top Header Banner Ribbon */}
      <div className="py-6 sm:py-8 bg-[#EFE5D8]/70 border-b border-[#E5D7C7]/80">
        <Container size="wide">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-[34px] text-[#241A12] font-normal tracking-normal text-center">
            New Arrivals
          </h2>
        </Container>
      </div>

      {/* Main Content Area with Sort and Products Grid */}
      <div className="py-8 sm:py-12">
        <Container size="wide">
          {/* Sort By Dropdown (Right-aligned) */}
          <div className="flex justify-end items-center mb-6 sm:mb-8">
            <label htmlFor="new-arrivals-sort" className="text-xs text-[#7E6955] font-sans mr-2">
              Sort by:
            </label>
            <div className="relative inline-block">
              <select
                id="new-arrivals-sort"
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

          {/* 5-Column / Responsive Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 sm:gap-5 lg:gap-6">
            {sortedProducts.map((product) => {
              const isLiked = isWishlisted(product.id);
              const isAdded = !!addedItems[product.id];
              const badgeLabel = product.badge || (product.isNew ? "New" : null);
              const isDarkBadge = badgeLabel === "Bestseller" || badgeLabel === "Trending";

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

                      {/* Top-Left Badge */}
                      {badgeLabel && (
                        <div
                          className={`absolute top-2.5 left-2.5 text-white text-[10.5px] font-sans font-medium px-2 py-0.5 rounded-full shadow-xs tracking-wide pointer-events-none ${
                            isDarkBadge ? "bg-[#1E2922]" : "bg-[#B58544]"
                          }`}
                        >
                          {badgeLabel}
                        </div>
                      )}

                      {/* Top-Right Wishlist Heart Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleWishlist(product, e)}
                        aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
                        className={`absolute top-2.5 right-2.5 w-6.5 h-6.5 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-[2px] cursor-pointer ${
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
                          className="w-3.5 h-3.5"
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      </button>
                    </Link>

                    {/* Product Information */}
                    <div className="pt-3 pb-1 space-y-1">
                      {/* Title */}
                      <Link
                        href={product.href}
                        className="block font-serif text-[13px] sm:text-[13.5px] text-[#33251A] font-normal leading-[1.35] line-clamp-2 min-h-[36px] group-hover:text-[#8E531A] transition-colors focus:outline-none"
                      >
                        {product.name}
                      </Link>

                      {/* Prices */}
                      <div className="flex items-center space-x-1.5 pt-0.5">
                        {product.originalPrice && (
                          <span className="text-[#8F8175] line-through text-[11.5px] sm:text-xs font-light">
                            ₹{product.originalPrice.toFixed(2)}
                          </span>
                        )}
                        <span className="font-semibold text-[#281E15] text-[13.5px] sm:text-[14px]">
                          {product.pricePrefix || ""}₹{product.price.toFixed(2)}
                        </span>
                      </div>

                      {/* Star Ratings & Reviews Count */}
                      <div className="min-h-[18px] flex items-center">
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
                                  className="w-3 h-3 fill-[#C89438]"
                                >
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              ))}
                            </div>
                            {product.reviewCount && (
                              <span className="text-[11px] text-[#7A6451] font-sans font-light">
                                ({product.reviewCount})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-3.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add to Bag Button */}
                  <button
                    type="button"
                    onClick={(e) => handleAddToCart(product, e)}
                    className={`w-full mt-2.5 py-2.5 px-3 rounded-full font-sans text-xs font-medium flex items-center justify-center space-x-1.5 transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer ${
                      isAdded
                        ? "bg-[#8E531A] text-stone-50"
                        : "bg-[#EFE4D6] hover:bg-[#E5D5C4] text-[#4A392C]"
                    }`}
                  >
                    {isAdded ? (
                      <>
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
                          width="14"
                          height="14"
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
      </div>
    </section>
  );
}
