"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { useShop } from "@/context/ShopContext";

interface ShopProductCardProps {
  product: Product;
}

export function ShopProductCard({ product }: ShopProductCardProps) {
  const { isWishlisted, toggleWishlist, addToCart } = useShop();
  const [isAdding, setIsAdding] = useState(false);
  const isLiked = isWishlisted(product.id);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    addToCart(product, 1);
    setTimeout(() => setIsAdding(false), 1200);
  };

  const badgeText = product.badge || (product.isNew ? "New" : null);

  return (
    <div className="group flex flex-col justify-between transition-all duration-300">
      <div>
        {/* Product Image Container */}
        <Link
          href={product.href}
          className="relative block w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#F2ECE4] border border-stone-200/80 shadow-2xs group-hover:shadow-md transition-all duration-300 focus:outline-none"
        >
          <Image
            src={product.imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />

          {/* Top-Left Badge */}
          {badgeText && (
            <div className="absolute top-2.5 left-2.5 bg-[#1C2820]/90 backdrop-blur-xs border border-[#C8A060]/40 text-[#FAF5EB] text-[10.5px] font-sans font-medium px-2.5 py-0.5 rounded-full shadow-xs tracking-wide pointer-events-none">
              {badgeText}
            </div>
          )}

          {/* Top-Right Wishlist Heart Button */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
            title={isLiked ? "Remove from Wishlist" : "Add to Wishlist"}
            className={`absolute top-2.5 right-2.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-xs shadow-xs cursor-pointer ${
              isLiked
                ? "bg-white text-rose-600 shadow-sm"
                : "bg-white/80 hover:bg-white text-stone-700 hover:text-rose-600 hover:scale-110"
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
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </button>

          {/* Quick Add To Cart Floating Button (on Hover) */}
          <div className="absolute inset-x-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:block">
            <button
              type="button"
              onClick={handleAddToCart}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-sans font-medium tracking-wide flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer ${
                isAdding
                  ? "bg-[#2A372E] text-[#E6CA65]"
                  : "bg-[#1C2820]/95 hover:bg-[#1C2820] text-[#FAF5EB]"
              }`}
            >
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
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              <span>{isAdding ? "Added! ✓" : "Quick Add"}</span>
            </button>
          </div>
        </Link>

        {/* Product Details */}
        <div className="pt-3 pb-1 space-y-1">
          {/* Title */}
          <Link
            href={product.href}
            className="block font-serif text-[13.5px] text-[#302318] font-normal leading-[1.38] line-clamp-2 min-h-[38px] group-hover:text-[#8E531A] transition-colors focus:outline-none"
          >
            {product.name}
          </Link>

          {/* Star Rating */}
          <div className="flex items-center space-x-1 min-h-[18px]">
            <div className="flex text-[#C89438] space-x-0.5">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={i < Math.floor(product.rating || 4) ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="w-3 h-3 fill-[#C89438]"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
            <span className="text-[11px] text-[#7A6655] font-sans font-light">
              ({product.reviewCount || product.rating || 4})
            </span>
          </div>

          {/* Price & Mobile Add Button */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-[#281E15] text-[14px]">
                ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {product.originalPrice && (
                <span className="text-[#8F8175] line-through text-xs font-light">
                  ₹{product.originalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Mobile Add to Cart Icon Button */}
            <button
              type="button"
              onClick={handleAddToCart}
              className="sm:hidden p-1.5 rounded-full bg-[#1C2820] text-white hover:bg-[#2B3B30] transition-colors cursor-pointer"
              title="Add to Cart"
              aria-label="Add to cart"
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
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
