"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useShop } from "@/context/ShopContext";

export default function CartPage() {
  const { cart, updateCartQuantity, removeFromCart, clearCart, cartSubtotal, cartCount } = useShop();
  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  const FREE_SHIPPING_THRESHOLD = 999;
  const shippingFee = cartSubtotal >= FREE_SHIPPING_THRESHOLD || cart.length === 0 ? 0 : 99;
  const discountAmount = (cartSubtotal * appliedDiscount) / 100;
  const finalTotal = Math.max(0, cartSubtotal - discountAmount + shippingFee);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError("");
    setCouponSuccess("");
    const code = couponCode.trim().toUpperCase();
    if (code === "SHIVURA10" || code === "FESTIVE10") {
      setAppliedDiscount(10);
      setCouponSuccess("10% luxury discount applied successfully!");
    } else if (code === "WELCOME15") {
      setAppliedDiscount(15);
      setCouponSuccess("15% welcome discount applied successfully!");
    } else {
      setCouponError("Invalid promo code. Try 'SHIVURA10' or 'FESTIVE10'");
    }
  };

  return (
    <div className="py-12 sm:py-16 bg-[#FAF8F5] min-h-[75vh]">
      <Container size="wide">
        {/* Header */}
        <div className="text-center space-y-2.5 mb-10">
          <div className="inline-flex items-center space-x-2 text-[#B88746] text-xs uppercase tracking-widest font-sans font-medium">
            <span>✦</span>
            <span>Your Selected Treasures</span>
            <span>✦</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2C2117]">
            Shopping Cart
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] font-light">
            {cartCount} {cartCount === 1 ? "item" : "items"} in your cart
          </p>
        </div>

        {cart.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              {/* Free Shipping Progress Indicator */}
              <div className="bg-white/90 border border-[#DFCBB8]/70 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans mb-2">
                  <span className="text-[#3A2A1E]">
                    {cartSubtotal >= FREE_SHIPPING_THRESHOLD ? (
                      <span className="text-emerald-700 font-medium">
                        🎉 Congratulations! You unlocked <strong>FREE Shipping</strong> across India!
                      </span>
                    ) : (
                      <span>
                        Add <strong>₹{(FREE_SHIPPING_THRESHOLD - cartSubtotal).toFixed(2)}</strong> more for <strong>FREE Shipping</strong>
                      </span>
                    )}
                  </span>
                  <span className="text-[#7E6955] font-medium">
                    {Math.min(100, Math.round((cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100))}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#EFE7DC] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1C2820] rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Items Card */}
              <div className="bg-white/90 border border-[#DFCBB8]/70 rounded-2xl overflow-hidden shadow-2xs divide-y divide-[#EFE7DC]">
                {cart.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Image & Title */}
                    <div className="flex items-center space-x-4 min-w-0">
                      <Link
                        href={product.href}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#F2ECE4] shrink-0 border border-stone-200"
                      >
                        <Image
                          src={product.imageSrc}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </Link>

                      <div className="space-y-1 min-w-0">
                        <Link
                          href={product.href}
                          className="block font-serif text-sm sm:text-base text-[#302318] hover:text-[#8E531A] transition-colors line-clamp-2"
                        >
                          {product.name}
                        </Link>
                        <div className="text-xs text-[#7E6955] font-light">
                          Unit Price: ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Stepper & Price & Delete */}
                    <div className="flex items-center justify-between sm:justify-end space-x-4 sm:space-x-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-[#DFCBB8] rounded-full bg-[#FAF7F2] p-0.5">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(product.id, quantity - 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#4A392A] hover:bg-white hover:shadow-2xs transition-all cursor-pointer font-bold text-sm"
                          title="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs font-semibold text-[#1C2820] font-sans">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(product.id, quantity + 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#4A392A] hover:bg-white hover:shadow-2xs transition-all cursor-pointer font-bold text-sm"
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Total Item Price */}
                      <div className="text-right min-w-[75px]">
                        <span className="font-semibold text-sm sm:text-base text-[#281E15]">
                          ₹{(product.price * quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        className="text-stone-400 hover:text-red-600 p-1.5 transition-colors cursor-pointer"
                        title="Remove from Cart"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clear Cart & Continue Shopping Bar */}
              <div className="flex items-center justify-between text-xs pt-2">
                <Link
                  href="/shop"
                  className="text-[#302318] hover:text-[#8E531A] font-medium underline flex items-center space-x-1"
                >
                  <span>← Continue Shopping</span>
                </Link>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-neutral-500 hover:text-red-700 underline cursor-pointer"
                >
                  Clear Shopping Cart
                </button>
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white/95 border border-[#DFCBB8]/80 rounded-2xl p-6 shadow-2xs space-y-5">
                <h2 className="font-serif text-xl text-[#2C2117] border-b border-[#EFE7DC] pb-4">
                  Order Summary
                </h2>

                <div className="space-y-3 text-xs sm:text-sm text-[#4A392A] font-sans">
                  <div className="flex justify-between">
                    <span className="text-[#7E6955]">Items Subtotal</span>
                    <span className="font-medium">
                      ₹{cartSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Promo Discount ({appliedDiscount}%)</span>
                      <span>-₹{discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-[#7E6955]">Estimated Shipping</span>
                    <span>
                      {shippingFee === 0 ? (
                        <span className="text-emerald-700 font-medium uppercase tracking-wider text-xs">
                          Free
                        </span>
                      ) : (
                        `₹${shippingFee.toFixed(2)}`
                      )}
                    </span>
                  </div>

                  <div className="border-t border-[#EFE7DC] pt-3 flex justify-between items-baseline text-base sm:text-lg font-serif text-[#2C2117]">
                    <span className="font-normal">Total</span>
                    <span className="font-semibold text-lg text-[#1C2820]">
                      ₹{finalTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Promo Code Input */}
                <form onSubmit={handleApplyCoupon} className="pt-2 border-t border-[#EFE7DC] space-y-2">
                  <label className="block text-[11px] uppercase tracking-wider text-[#7E6955] font-sans font-medium">
                    Have a Promo Code?
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="e.g. SHIVURA10"
                      className="flex-1 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl px-3 py-2 text-xs text-[#382B1F] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#EFE7DC] text-[#3A2A1E] border border-[#DFCBB8] rounded-xl text-xs font-medium cursor-pointer transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {couponSuccess && (
                    <p className="text-[11px] text-emerald-700 font-medium">{couponSuccess}</p>
                  )}
                  {couponError && (
                    <p className="text-[11px] text-rose-600">{couponError}</p>
                  )}
                </form>

                {/* Checkout CTA */}
                <button
                  type="button"
                  onClick={() => alert("Thank you for shopping with Shivura! Checkout simulation complete.")}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs uppercase tracking-widest font-sans font-medium transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center space-x-2"
                >
                  <span>Proceed to Checkout</span>
                  <span>→</span>
                </button>

                <p className="text-[11px] text-center text-[#7E6955] font-light">
                  🔒 Secure encrypted 256-bit checkout with all Indian payment methods (UPI, Cards, NetBanking).
                </p>
              </div>
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
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-serif text-xl text-[#35271D]">Your shopping cart is empty</h3>
              <p className="text-xs sm:text-sm text-[#7E6955] font-light max-w-xs mx-auto">
                Explore our handcrafted collection to find something special for your home or loved ones.
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
