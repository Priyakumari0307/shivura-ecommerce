import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  href?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  href,
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium uppercase tracking-widest transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  const variants = {
    primary:
      "bg-neutral-900 text-stone-50 hover:bg-neutral-800 border border-neutral-900 shadow-sm",
    secondary:
      "bg-stone-200 text-neutral-900 hover:bg-stone-300 border border-stone-200",
    outline:
      "bg-transparent text-neutral-900 border border-neutral-900 hover:bg-neutral-900 hover:text-stone-50",
    ghost:
      "bg-transparent text-neutral-900 hover:bg-stone-200/50 border border-transparent",
  };

  const sizes = {
    sm: "text-xs px-4 py-2 min-h-[36px]",
    md: "text-xs px-6 py-3 min-h-[44px]",
    lg: "text-xs sm:text-sm px-8 py-4 min-h-[52px]",
  };

  const combinedClasses = cn(baseStyles, variants[variant], sizes[size], className);

  if (href) {
    return (
      <Link href={href} className={combinedClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button className={combinedClasses} {...props}>
      {children}
    </button>
  );
}
