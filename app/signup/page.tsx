import { Suspense } from "react";
import { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account | Shivura Handcrafted Luxury",
  description:
    "Join the Shivura circle to curate wishlists, experience expedited bespoke checkout, and receive access to exclusive handcrafted artisanal releases.",
};

export default function SignupPage() {
  return (
    <div className="py-4 sm:py-6 lg:py-8 bg-[#FAF8F5] min-h-[calc(100vh-140px)] flex items-center justify-center">
      <Container size="narrow">
        <Suspense
          fallback={
            <div className="bg-white/90 p-8 sm:p-10 rounded-3xl border border-[#DFCBB8]/70 shadow-sm max-w-md mx-auto text-center space-y-4">
              <div className="w-8 h-8 border-2 border-[#1C2820] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs uppercase tracking-widest text-[#7E6955] font-sans">
                Loading Shivura Concierge...
              </p>
            </div>
          }
        >
          <SignupForm />
        </Suspense>
      </Container>
    </div>
  );
}
