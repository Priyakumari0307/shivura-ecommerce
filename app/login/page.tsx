import { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Account Login | Shivura Handcrafted Luxury",
  description: "Sign in to your Shivura luxury account or create a new profile to track orders and save favorites.",
};

export default function LoginPage() {
  return (
    <div className="py-16 sm:py-20 bg-[#FAF8F5] min-h-[70vh]">
      <Container size="narrow">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center space-x-2 text-[#B88746] text-xs uppercase tracking-widest font-sans font-medium">
            <span>✦</span>
            <span>Welcome to Shivura</span>
            <span>✦</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2C2117]">
            Sign In / Register
          </h1>
          <div className="w-12 h-[1px] bg-[#DFCBB8] mx-auto" />
        </div>

        <div className="bg-white/90 p-8 sm:p-10 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs max-w-md mx-auto space-y-6">
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4A392A] uppercase tracking-wider mb-1.5 font-sans">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full bg-[#FAF7F2] border border-[#DFCBB8] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-[#382B1F] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#4A392A] uppercase tracking-wider font-sans">
                  Password
                </label>
                <a href="#" className="text-[11px] text-[#B88746] hover:underline">
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-[#FAF7F2] border border-[#DFCBB8] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-[#382B1F] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#1E2721] text-[#FAF6F0] rounded-lg text-xs uppercase tracking-widest font-medium hover:bg-[#2F3E34] transition-colors cursor-pointer shadow-xs"
            >
              Sign In
            </button>
          </form>

          <div className="text-center pt-2 border-t border-stone-200">
            <p className="text-xs text-[#7E6955]">
              Don&apos;t have an account?{" "}
              <a href="#" className="text-[#B88746] font-medium hover:underline">
                Create an account
              </a>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
