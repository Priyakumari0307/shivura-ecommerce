import React from "react";

export function ContactInfo() {
  return (
    <div className="space-y-6">
      {/* Studio & Concierge Card */}
      <div className="bg-[#FAF7F2] border border-[#DFCBB8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
        {/* Card Header */}
        <div className="space-y-1 pb-4 border-b border-[#E8DCCF]">
          <div className="flex items-center space-x-2">
            <span className="text-[#B88746] text-sm">✦</span>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal">
              Our Studio &amp; Concierge
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#7E6955] font-light">
            Visit our design space or reach our personal shopping specialists.
          </p>
        </div>

        {/* Address Item */}
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 rounded-full bg-[#F2E8DC] border border-[#DFCBB8] text-[#B88746] flex items-center justify-center shrink-0 shadow-2xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <h4 className="font-serif text-base text-[#2C2117] font-normal">
              Address
            </h4>
            <p className="text-xs sm:text-sm text-[#5C4A3A] font-light leading-relaxed">
              Alpha-2, Greater Noida<br />
              Uttar Pradesh, 201310, India
            </p>
          </div>
        </div>

        {/* Contact Info (Email & Phone) */}
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 rounded-full bg-[#F2E8DC] border border-[#DFCBB8] text-[#B88746] flex items-center justify-center shrink-0 shadow-2xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <div className="space-y-1">
            <h4 className="font-serif text-base text-[#2C2117] font-normal">
              Contact Info
            </h4>
            <div className="space-y-1 text-xs sm:text-sm">
              <p>
                <a
                  href="mailto:info@shivura.com"
                  className="text-[#5C4A3A] hover:text-[#B88746] transition-colors"
                >
                  info@shivura.com
                </a>
              </p>
              <p>
                <a
                  href="tel:+919650218876"
                  className="text-[#5C4A3A] hover:text-[#B88746] font-medium transition-colors"
                >
                  +91 9650218876
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 rounded-full bg-[#F2E8DC] border border-[#DFCBB8] text-[#B88746] flex items-center justify-center shrink-0 shadow-2xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <h4 className="font-serif text-base text-[#2C2117] font-normal">
              Concierge Hours
            </h4>
            <p className="text-xs sm:text-sm text-[#5C4A3A] font-light leading-relaxed">
              Monday – Saturday: 10:00 AM – 7:00 PM IST<br />
              <span className="text-[#8E7967] text-[11px]">Sunday: Closed for artisanal workshop rest</span>
            </p>
          </div>
        </div>

        {/* WhatsApp Direct Action Button */}
        <div className="pt-2">
          <a
            href="https://wa.me/919650218876"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-5 rounded-2xl bg-[#1E2721] hover:bg-[#2A372E] text-[#FAF6F0] text-xs sm:text-sm font-sans font-medium flex items-center justify-center space-x-3 border border-[#C8A060]/50 shadow-xs hover:shadow-md transition-all duration-300"
          >
            {/* WhatsApp SVG Icon */}
            <svg
              className="w-5 h-5 text-[#25D366]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            <span>Chat on WhatsApp</span>
            <span className="text-[#E6CA65]">→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
