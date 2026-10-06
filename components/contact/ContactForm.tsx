"use client";

import React, { useState } from "react";

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "General Inquiry",
    message: "",
  });

  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    setErrorMessage("");
    setStatus("submitting");

    // Simulate luxury submission experience
    setTimeout(() => {
      setStatus("success");
    }, 900);
  };

  const handleReset = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      subject: "General Inquiry",
      message: "",
    });
    setStatus("idle");
  };

  return (
    <div className="bg-[#FAF7F2] border border-[#DFCBB8] rounded-3xl p-6 sm:p-8 md:p-10 shadow-sm relative overflow-hidden">
      {/* Subtle Gold Lotus Accent Top Right */}
      <div className="absolute top-4 right-4 text-[#B88746]/20 pointer-events-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 20"
          fill="currentColor"
          className="w-16 h-12"
        >
          <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" />
          <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" />
          <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" />
        </svg>
      </div>

      {status === "success" ? (
        <div className="py-12 px-4 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 bg-[#1C2820] text-[#E6CA65] rounded-full flex items-center justify-center mx-auto border border-[#C8A060]/50 shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal">
              Message Received with Grace
            </h3>
            <p className="text-xs sm:text-sm text-[#6E5A4A] font-light max-w-md mx-auto leading-relaxed">
              Thank you, <span className="font-semibold text-[#2C2117]">{formData.name}</span>. Our concierge team has received your message and will get back to you within 24 business hours.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center px-6 py-2.5 rounded-full bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs font-sans tracking-wide border border-[#C8A060]/50 shadow-xs transition-colors cursor-pointer"
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[#B88746] text-sm">✦</span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal">
                Send Us a Message
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#7E6955] font-light">
              Fill out the details below and an artisanal specialist will be in touch shortly.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="contact-name" className="block text-xs uppercase tracking-wider text-[#4E3D2E] font-medium font-sans">
                Name <span className="text-[#B88746]">*</span>
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Your full name"
                className="w-full bg-[#F4EDE2] hover:bg-[#F2E7D9] focus:bg-white border border-[#DFCBB8] focus:border-[#B88746] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#2E2217] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746] transition-all shadow-2xs"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label htmlFor="contact-phone" className="block text-xs uppercase tracking-wider text-[#4E3D2E] font-medium font-sans">
                Phone Number <span className="text-[#B88746]">*</span>
              </label>
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 96502 18876"
                className="w-full bg-[#F4EDE2] hover:bg-[#F2E7D9] focus:bg-white border border-[#DFCBB8] focus:border-[#B88746] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#2E2217] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746] transition-all shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Email Address */}
            <div className="space-y-1.5">
              <label htmlFor="contact-email" className="block text-xs uppercase tracking-wider text-[#4E3D2E] font-medium font-sans">
                Email Address <span className="text-[#B88746]">*</span>
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                className="w-full bg-[#F4EDE2] hover:bg-[#F2E7D9] focus:bg-white border border-[#DFCBB8] focus:border-[#B88746] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#2E2217] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746] transition-all shadow-2xs"
              />
            </div>

            {/* Subject / Inquiry Type */}
            <div className="space-y-1.5">
              <label htmlFor="contact-subject" className="block text-xs uppercase tracking-wider text-[#4E3D2E] font-medium font-sans">
                Inquiry Type
              </label>
              <div className="relative">
                <select
                  id="contact-subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full appearance-none bg-[#F4EDE2] hover:bg-[#F2E7D9] focus:bg-white border border-[#DFCBB8] focus:border-[#B88746] rounded-xl pl-4 pr-9 py-2.5 text-xs sm:text-sm text-[#2E2217] focus:outline-none focus:ring-1 focus:ring-[#B88746] transition-all shadow-2xs cursor-pointer"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Custom Order / Bulk Craft">Custom Order &amp; Bulk Craft</option>
                  <option value="Wedding & Corporate Gifting">Wedding &amp; Corporate Gifting</option>
                  <option value="Order Tracking & Delivery">Order Tracking &amp; Delivery</option>
                  <option value="Artisan Collaboration">Artisan Collaboration</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#7E6955]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label htmlFor="contact-message" className="block text-xs uppercase tracking-wider text-[#4E3D2E] font-medium font-sans">
              Message <span className="text-[#B88746]">*</span>
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={4}
              required
              value={formData.message}
              onChange={handleChange}
              placeholder="Tell us about your inquiry, bespoke sizing requests, or event details..."
              className="w-full bg-[#F4EDE2] hover:bg-[#F2E7D9] focus:bg-white border border-[#DFCBB8] focus:border-[#B88746] rounded-xl p-4 text-xs sm:text-sm text-[#2E2217] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746] transition-all shadow-2xs resize-y"
            ></textarea>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full sm:w-auto px-8 py-3 rounded-full bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs sm:text-sm font-sans font-medium tracking-wide flex items-center justify-center space-x-2 border border-[#C8A060]/60 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer disabled:opacity-75"
            >
              {status === "submitting" ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#E6CA65]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Sending Message...</span>
                </>
              ) : (
                <>
                  <span>Send Message</span>
                  <span className="text-[#E6CA65]">→</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
