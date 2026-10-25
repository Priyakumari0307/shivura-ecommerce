import { Suspense } from "react";
import { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import CrmLoginForm from "./CrmLoginForm";

export const metadata: Metadata = {
  title: "CRM Administration Sign In | Shivura Luxury",
  description:
    "Secure administrative sign in for authorized Shivura operational management personnel.",
};

export default function CrmLoginPage() {
  return (
    <div className="py-8 sm:py-12 bg-[#FAF8F5] min-h-screen flex items-center justify-center px-4">
      <Container size="narrow">
        <Suspense
          fallback={
            <div className="bg-white/90 p-8 sm:p-10 rounded-3xl border border-[#DFCBB8]/70 shadow-sm max-w-md mx-auto text-center space-y-4">
              <div className="w-8 h-8 border-2 border-[#1C2820] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs uppercase tracking-widest text-[#7E6955] font-sans">
                Initializing CRM Security Environment...
              </p>
            </div>
          }
        >
          <CrmLoginForm />
        </Suspense>
      </Container>
    </div>
  );
}
