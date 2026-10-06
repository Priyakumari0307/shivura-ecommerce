"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { ALL_PRODUCTS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { useShop } from "@/context/ShopContext";

interface ProductDetailViewProps {
  product: Product;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

interface ProductSpecificationData {
  careInstructions: string;
  keyFeatures: string;
  space: string;
  finishType: string;
  material: string;
  color: string;
  filterShape: string;
  designStyle: string;
  setsPieces: string;
  aboutBullets: string[];
  sizeChart: {
    size: string;
    includes: string;
    measurement: string;
  }[];
}

function getProductSpecifications(product: Product): ProductSpecificationData {
  const cat = (product.category || "").toLowerCase();
  const name = product.name.toLowerCase();

  // 1. Lighting & Fairy lights
  if (cat.includes("lighting") || name.includes("light") || name.includes("lantern") || name.includes("led")) {
    return {
      careInstructions: "Keep away from water; wipe clean with dry cloth",
      keyFeatures: "Energy Efficient & Ambient Warm Radiance",
      space: "Living Room, Bedroom, Balcony & Mandir",
      finishType: "Hand Crafted Filament",
      material: "Insulated Copper Wire & Micro LED",
      color: "Warm Golden Yellow",
      filterShape: name.includes("star") ? "Star Cluster" : name.includes("leaf") ? "Botanical Foliage" : "Fairy Filament",
      designStyle: "Minimalist Festive Luxury",
      setsPieces: "1 Piece String Set with Power Connector",
      aboutBullets: [
        "Made from premium insulated copper wire with a radiant warm golden finish",
        "Includes 1 high-density micro LED string with plug-and-play adapter",
        "Generates gentle, flicker-free ambient warmth suitable for festive and daily home decor",
        "Low power consumption and cool-to-touch operation for safe indoor and outdoor use",
        "Flexible wiring allows effortless wrapping around curtain rods, mirrors, banisters & vases",
        "A coordinated piece crafted to elevate Diwali, housewarmings, dinner parties & quiet evenings",
        "Subtle metallic wiring blends seamlessly into walls and furniture when unlit",
        "Delivered in a signature protective Shivura luxury keepsake box",
        "Easy maintenance: gently wipe with a dry microfiber cloth when disconnected",
      ],
      sizeChart: [
        {
          size: "Standard (10m)",
          includes: "1 LED String Light",
          measurement: "Length: 1000 cm (32.8 ft) || 100 Micro LEDs || Weight: 140g",
        },
        {
          size: "Deluxe (20m)",
          includes: "1 Long String Light",
          measurement: "Length: 2000 cm (65.6 ft) || 200 Micro LEDs || Weight: 260g",
        },
      ],
    };
  }

  // 2. Frames & Wall Art
  if (cat.includes("decor") && (name.includes("frame") || name.includes("wall") || name.includes("plate") || name.includes("macrame"))) {
    return {
      careInstructions: "Wipe clean with a soft dry microfiber cloth",
      keyFeatures: "High Clarity Acrylic & Dustproof Frame",
      space: "Living Room, Study, Hallway & Gallery Wall",
      finishType: "Hand Crafted & Matte Finish",
      material: "Engineered Wood & Shatterproof Cast Acrylic",
      color: name.includes("plate") ? "Multicolor Ceramic" : "Gallery Matte Black",
      filterShape: name.includes("plate") ? "Circular Plate" : "Rectangular Wall Frame",
      designStyle: "Contemporary Minimalist",
      setsPieces: "1 Wall Display Frame with Mounting Brackets",
      aboutBullets: [
        "Crafted from premium engineered timber and high-transparency shatterproof acrylic",
        "Includes 1 pre-assembled display frame with dual-direction wall hanging brackets",
        "Ultra-clear 2mm protective front shields photographs and diecast models from dust and UV rays",
        "Pre-installed metal sawtooth hangers allow quick and stable portrait or landscape orientation",
        "Deep-set shadowbox design creates rich depth and museum-grade visual presence",
        "Reinforced mitered corners guarantee long-lasting durability and pristine aesthetics",
        "Ideal luxury statement piece for living rooms, home offices and bedroom gallery walls",
        "Packaged in shockproof edge-protected luxury gift boxing",
      ],
      sizeChart: [
        {
          size: name.includes("6r") ? "6x8 Inch (6R)" : "8x12 Inch (A4)",
          includes: "1 Display Frame",
          measurement: name.includes("6r")
            ? "Length: 20.3 cm, Breadth: 15.2 cm, Depth: 2.0 cm || Weight: 340g"
            : "Length: 30.5 cm, Breadth: 20.3 cm, Depth: 2.5 cm || Weight: 490g",
        },
        {
          size: "A3 Large",
          includes: "1 Master Frame",
          measurement: "Length: 42.0 cm, Breadth: 29.7 cm, Depth: 3.0 cm || Weight: 820g",
        },
      ],
    };
  }

  // 3. Clay, Pottery & Ceramic
  if (cat.includes("pottery") || name.includes("clay") || name.includes("kulhad") || name.includes("ceramic") || name.includes("diya")) {
    return {
      careInstructions: "Hand wash with mild organic soap; air dry naturally",
      keyFeatures: "100% Eco-Friendly & Food Grade Safe",
      space: "Dining, Kitchen, Balcony & Mandir",
      finishType: "Hand Crafted & Natural Terracotta",
      material: "Organic Clay & Fine Ceramic",
      color: "Earthy Terracotta & Warm Ivory",
      filterShape: name.includes("kulhad") ? "Tapered Cylindrical" : "Traditional Diya",
      designStyle: "Artisanal Heritage Minimalist",
      setsPieces: name.includes("kulhad") ? "Set of 6 Kulhads" : "Set of 4 Diyas",
      aboutBullets: [
        "Hand-thrown on traditional potter's wheels using pure, naturally harvested clay",
        "Includes artisanally molded pieces crafted with smooth ergonomic contours",
        "100% lead-free, non-toxic and free from chemical pigments or artificial glazes",
        "Imparts an authentic earthy aroma and retains natural beverage warmth for longer",
        "Ideal for morning tea rituals, festive Diwali celebrations and traditional hospitality",
        "Comfortable ergonomic grip tailored for daily enjoyment and elevated gifting",
        "Sustainably made in collaboration with generational rural artisan families",
        "Safely packaged in eco-friendly cushioned protective cartons",
      ],
      sizeChart: [
        {
          size: name.includes("kulhad") ? "180 ML" : "Standard Diya",
          includes: name.includes("kulhad") ? "Set of 6 Kulhads" : "Set of 4 Diyas",
          measurement: name.includes("kulhad")
            ? "Height: 8.5 cm, Diameter: 7.2 cm, Volume: 180 ml each"
            : "Length: 7.5 cm, Breadth: 6.5 cm, Height: 3.5 cm || Weight: 95g each",
        },
        {
          size: "Family Set",
          includes: name.includes("kulhad") ? "Set of 12 Kulhads" : "Set of 8 Diyas",
          measurement: "Coordinated gift packaging || Total Set Weight: 1.4 kg",
        },
      ],
    };
  }

  // 4. Festive Living, Brass & Puja
  if (cat.includes("festive") || name.includes("brass") || name.includes("thali") || name.includes("pooja")) {
    return {
      careInstructions: "Wipe with dry cloth or polish gently with brass cleaner",
      keyFeatures: "Solid Brass & Ornate Hand Engravings",
      space: "Mandir, Living Room & Dining Decor",
      finishType: "Hand Crafted & Royal Antique Polish",
      material: "Pure Heavy-Gauge Virgin Brass",
      color: "Lustrous Golden Brass",
      filterShape: "Circular Traditional Silhouette",
      designStyle: "Royal Heritage Luxury",
      setsPieces: "Complete Puja Ensemble",
      aboutBullets: [
        "Forged from pure, heavy-gauge virgin brass with intricate floral engravings",
        "Includes 1 master thali, 1 diya holder, 1 incense stand and 1 sacred bell",
        "Substantial artisanal weight crafted to last across generations as a family heirloom",
        "High-shine golden finish creates a divine, serene ambience for sacred ceremonies",
        "Smooth rounded edges ensure safe and comfortable handling during daily rituals",
        "Thoughtful auspicious gift for Diwali, weddings, griha pravesh & celebrations",
        "Treated with a specialized anti-tarnish protective coating for enduring radiance",
        "Handcrafted with devotion by heritage brass artisans of Moradabad",
      ],
      sizeChart: [
        {
          size: "10 Inch",
          includes: "1 Thali + 4 Accessories",
          measurement: "Diameter: 25.4 cm, Height: 3.2 cm || Total Weight: 680g",
        },
        {
          size: "12 Inch",
          includes: "1 Master Thali + 6 Accessories",
          measurement: "Diameter: 30.5 cm, Height: 3.8 cm || Total Weight: 940g",
        },
      ],
    };
  }

  // 5. Rakhi & Gifting
  if (cat.includes("rakhi") || cat.includes("gifting") || name.includes("rakhi") || name.includes("hamper")) {
    return {
      careInstructions: "Store in moisture-free pouch; keep away from direct water",
      keyFeatures: "Skin-Friendly Organic Silk & Semi-Precious Accents",
      space: "Festive Rituals & Sacred Gifting",
      finishType: "Hand Crafted & Embroidered Zari",
      material: "Pure Resham Silk Thread & Brass Motifs",
      color: "Sacred Crimson, Royal Blue & Gold",
      filterShape: "Sacred Emblem / Wrist Band",
      designStyle: "Festive Heritage Elegance",
      setsPieces: "1 Rakhi + Roli Chawal Kit + Gift Card",
      aboutBullets: [
        "Hand-braided using soft, skin-friendly organic resham silk threads",
        "Includes 1 handcrafted Rakhi, sacred Roli-Chawal glass vials and a handwritten greeting card",
        "Centered with an intricately detailed metallic motif embellished with stones and beads",
        "Durable, comfortable braided tie cords designed for a snug wrist fit all day",
        "Crafted following timeless Vedic aesthetics to celebrate auspicious sibling bonds",
        "Presented in an elegant gold-foiled Shivura signature gifting sleeve",
        "Handcrafted by skilled women artisan self-help collectives in India",
        "Environmentally responsible and biodegradable packaging components",
      ],
      sizeChart: [
        {
          size: "Standard",
          includes: "1 Rakhi + Roli Chawal Set",
          measurement: "Thread Length: 32 cm || Center Motif: 2.2 x 2.2 cm || Weight: 25g",
        },
        {
          size: "Trio Pack",
          includes: "3 Coordinated Rakhis + Roli Kit",
          measurement: "Thread Length: 32 cm each || Gift Box: 18 x 12 cm || Weight: 75g",
        },
      ],
    };
  }

  // Default Fallback
  return {
    careInstructions: "Gently wipe clean with a soft dry microfiber cloth",
    keyFeatures: "Artisanal Craftsmanship & Premium Quality",
    space: "Living Room, Dining, Bedroom & Festive Decor",
    finishType: "Hand Crafted",
    material: "Handcrafted Mixed Artisanal Materials",
    color: "Warm Natural Earth Tone",
    filterShape: "Minimalist Silhouette",
    designStyle: "Modern Heritage",
    setsPieces: "1 Piece Set with Gift Packaging",
    aboutBullets: [
      "Authentically handcrafted by master Indian artisans with meticulous attention to detail",
      "Features premium, sustainably sourced materials designed for enduring beauty",
      "Seamlessly blends timeless Indian heritage with modern, elegant living spaces",
      "Versatile aesthetic suitable for daily ambiance, housewarmings and festive decor",
      "Thoughtful gifting piece delivered in Shivura's signature gift-ready luxury packaging",
      "Lightweight, durable and effortless to display in any room",
      "Easy maintenance: clean gently with a dry microfiber cloth",
    ],
    sizeChart: [
      {
        size: "Standard",
        includes: "1 Handcrafted Unit",
        measurement: "Dimensions: 22 x 15 x 8 cm || Weight: 350g",
      },
    ],
  };
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const { isWishlisted, toggleWishlist, addToCart } = useShop();
  const isLiked = isWishlisted(product.id);

  // Specifications
  const specs = getProductSpecifications(product);

  // Gallery state
  const galleryImages = [
    product.imageSrc,
    product.imageSrc,
    product.imageSrc,
    product.imageSrc,
  ];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Variant & Quantity state
  const [selectedPack, setSelectedPack] = useState("1");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Accordion state
  const [openAccordion, setOpenAccordion] = useState<string | null>("shipping");

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([
    {
      id: "1",
      author: "Tanya Sharma",
      rating: 5,
      date: "2026-08-17",
      comment:
        "Quality is truly exceptional. Looks way more premium in person than pictures! Delivered safely in beautiful packaging.",
      verified: true,
    },
    {
      id: "2",
      author: "Rohan Mukherjee",
      rating: 5,
      date: "2026-09-02",
      comment:
        "Exquisite craftsmanship and refined aesthetics. Adds an instant warm luxury feel to our living room.",
      verified: true,
    },
  ]);

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newReviewAuthor, setNewReviewAuthor] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState("");

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleAddToCart = () => {
    setIsAdding(true);
    addToCart(product, quantity);
    setTimeout(() => setIsAdding(false), 1200);
  };

  const toggleAccordion = (section: string) => {
    setOpenAccordion((prev) => (prev === section ? null : section));
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewAuthor.trim() || !newReviewComment.trim()) return;

    const newRev: Review = {
      id: Date.now().toString(),
      author: newReviewAuthor.trim(),
      rating: newReviewRating,
      date: new Date().toISOString().split("T")[0],
      comment: newReviewComment.trim(),
      verified: true,
    };
    setReviews([newRev, ...reviews]);
    setNewReviewAuthor("");
    setNewReviewComment("");
    setShowReviewModal(false);
  };

  // Related products
  const relatedProducts = ALL_PRODUCTS.filter(
    (p) => p.id !== product.id && (p.category === product.category || p.badge === "Bestseller")
  ).slice(0, 4);

  const originalPrice = product.originalPrice || Math.round(product.price * 1.35);

  return (
    <div className="bg-[#FAF8F5] py-5 sm:py-8 font-sans antialiased text-[#2C2117]">
      <Container size="wide">
        {/* Refined Minimalist Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-5 text-[11.5px] text-[#8C7A6B] font-light">
          <ol className="flex items-center space-x-2">
            <li>
              <Link href="/" className="hover:text-[#2C2117] transition-colors">
                Home
              </Link>
            </li>
            <li className="text-[#C5B5A5]">/</li>
            <li>
              <Link href="/shop" className="hover:text-[#2C2117] transition-colors">
                Shop
              </Link>
            </li>
            <li className="text-[#C5B5A5]">/</li>
            {product.category && (
              <>
                <li>
                  <Link
                    href={`/shop/${product.category}`}
                    className="hover:text-[#2C2117] capitalize transition-colors"
                  >
                    {product.category.replace("-", " ")}
                  </Link>
                </li>
                <li className="text-[#C5B5A5]">/</li>
              </>
            )}
            <li className="text-[#2C2117] font-medium truncate max-w-[200px] sm:max-w-md">
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Main Product Hero Layout (2 Columns: Left Gallery / Right Details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Image Gallery View */}
          <div className="lg:col-span-6 space-y-4">
            {/* Main Image Viewport */}
            <div className="relative aspect-square sm:aspect-[4/3] lg:aspect-square w-full rounded-2xl overflow-hidden bg-[#F2ECE4] border border-[#DFCBB8]/70 shadow-2xs group">
              <Image
                src={galleryImages[selectedImageIndex]}
                alt={product.name}
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Prev Button */}
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-stone-800 flex items-center justify-center backdrop-blur-xs shadow-xs transition-transform hover:scale-105 cursor-pointer opacity-90 hover:opacity-100"
                aria-label="Previous image"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-stone-800 flex items-center justify-center backdrop-blur-xs shadow-xs transition-transform hover:scale-105 cursor-pointer opacity-90 hover:opacity-100"
                aria-label="Next image"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Product Badge */}
              {product.badge && (
                <div className="absolute top-3.5 left-3.5 bg-[#1C2820]/90 backdrop-blur-xs border border-[#C8A060]/30 text-[#FAF5EB] text-[10.5px] font-medium tracking-wide px-2.5 py-0.5 rounded-full shadow-xs">
                  {product.badge}
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            <div className="flex items-center space-x-2.5">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-[#F2ECE4] border transition-all cursor-pointer ${
                    selectedImageIndex === idx
                      ? "border-[#B88746] ring-1 ring-[#B88746] shadow-xs"
                      : "border-[#DFCBB8]/60 hover:border-[#B88746]/50 opacity-75 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Refined Luxury Title, Pricing, Actions, Product Specifications & Accordions */}
          <div className="lg:col-span-6 space-y-4 sm:space-y-4.5">
            
            {/* Collection Kicker + Title & Rating */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#916223] font-semibold">
                Shivura Heritage • Handcrafted Collection
              </div>

              {/* Refined Title: Proportioned & Luxury Scaled */}
              <h1 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal leading-snug tracking-tight">
                {product.name}
              </h1>

              {/* Star Rating & Reviews Count */}
              <div className="flex items-center space-x-2 pt-0.5">
                <div className="flex text-[#C89438] space-x-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill={i < Math.floor(product.rating || 5) ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="w-3.5 h-3.5 fill-[#C89438]"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <span className="text-[11.5px] text-[#7A6655] font-light">
                  {product.rating || 5}.0 ({reviews.length} reviews)
                </span>
                <span className="text-[#C5B5A5]">•</span>
                <span className="text-[11.5px] text-emerald-700 font-medium">In Stock</span>
              </div>

              {/* Elegant Subtitle / Micro Tagline */}
              <p className="text-xs sm:text-[13px] text-[#7A6655] font-light leading-relaxed pt-0.5">
                Thoughtfully shaped by master Indian artisans to bring enduring warmth, soul and sophistication to modern homes.
              </p>
            </div>

            {/* Price Row: Refined and Luxury Styled */}
            <div className="flex items-baseline space-x-3 border-y border-[#DFCBB8]/60 py-3">
              <span className="text-[#8F8175] line-through text-xs sm:text-sm font-light">
                ₹{originalPrice.toFixed(2)}
              </span>
              <span className="font-medium text-lg sm:text-xl text-[#241A12] tracking-tight">
                ₹{product.price.toFixed(2)}
              </span>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-full border border-emerald-200">
                Save ₹{(originalPrice - product.price).toFixed(0)} ({Math.round(((originalPrice - product.price) / originalPrice) * 100)}% OFF)
              </span>
            </div>

            {/* Pack / Variant Selector */}
            <div className="space-y-1">
              <label htmlFor="pack-select" className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider">
                Select Option / Pack:
              </label>
              <div className="relative">
                <select
                  id="pack-select"
                  value={selectedPack}
                  onChange={(e) => setSelectedPack(e.target.value)}
                  className="w-full appearance-none bg-white hover:bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl px-3.5 py-2 text-xs text-[#382B1F] focus:outline-none focus:ring-1 focus:ring-[#B88746] shadow-2xs cursor-pointer transition-colors"
                >
                  <option value="1">1 Unit (Standard Artisanal Pack)</option>
                  <option value="2">Pack of 2 (Festive Value Set — Extra 10% Off)</option>
                  <option value="4">Pack of 4 (Luxury Gifting Hamper Box — Extra 20% Off)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#7E6955]">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Quantity Stepper & Dispatch Info */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center border border-[#DFCBB8] rounded-full bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#4A392A] hover:bg-[#FAF7F2] transition-colors cursor-pointer font-medium text-xs"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-7 text-center text-xs font-medium text-[#1C2820]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#4A392A] hover:bg-[#FAF7F2] transition-colors cursor-pointer font-medium text-xs"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <div className="text-[11.5px] text-[#7A6655] font-light flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>Dispatches within 24 hours</span>
              </div>
            </div>

            {/* Action Buttons: Add to Bag & Wishlist */}
            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={handleAddToCart}
                className={`flex-1 py-3 px-5 rounded-full text-xs uppercase tracking-widest font-medium transition-all duration-200 shadow-xs hover:shadow-md flex items-center justify-center space-x-2 cursor-pointer ${
                  isAdding
                    ? "bg-[#2F3E34] text-[#E6CA65]"
                    : "bg-[#1E2721] hover:bg-[#2F3E34] text-[#FAF6F0]"
                }`}
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
                <span>{isAdding ? "Added to Bag! ✓" : "Add to bag"}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
                title={isLiked ? "Remove from wishlist" : "Add to wishlist"}
                className={`p-2.5 rounded-full border transition-all cursor-pointer shadow-2xs ${
                  isLiked
                    ? "bg-rose-50 border-rose-200 text-rose-600"
                    : "bg-white border-[#DFCBB8] text-stone-700 hover:text-rose-600 hover:border-rose-200"
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
            </div>

            {/* ========================================================================= */}
            {/* COMPACT PRODUCT SPECIFICATIONS CARD (Shifted to Right Column, Non-Bulky) */}
            {/* ========================================================================= */}
            <div className="pt-2">
              <div className="bg-white rounded-xl border border-[#DFCBB8]/70 p-4 sm:p-5 shadow-2xs space-y-4">
                
                {/* Header Title */}
                <h3 className="font-serif text-sm sm:text-base font-medium text-[#2C2117]">
                  Product Specifications
                </h3>

                {/* Trust Badge Banner */}
                <div className="flex items-center space-x-2.5 pb-2.5 border-b border-[#F0EAE1]">
                  <div className="inline-flex items-center gap-1 bg-[#FAF0DC] text-[#8E531A] px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-[#EEDBBA]">
                    <span className="font-serif italic font-bold">shivura</span>
                    <span className="bg-[#8E531A] text-white text-[9px] px-1 py-0.1 rounded font-sans uppercase tracking-wider font-semibold">
                      Trust
                    </span>
                  </div>
                  <span className="text-[11.5px] text-[#5C4B3C] font-light">
                    Best quality from verified master artisans
                  </span>
                </div>

                {/* 2-Column Key Specifications Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  {/* Row 1 */}
                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Care Instructions
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.careInstructions}
                    </div>
                  </div>

                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Key Features
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.keyFeatures}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Space
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.space}
                    </div>
                  </div>

                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Finish Type
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.finishType}
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Material
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.material}
                    </div>
                  </div>

                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Color
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.color}
                    </div>
                  </div>

                  {/* Row 4 */}
                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Filter Shape
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.filterShape}
                    </div>
                  </div>

                  <div className="border-b border-[#F0EAE1] pb-2">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Design Style
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.designStyle}
                    </div>
                  </div>

                  {/* Row 5 */}
                  <div className="col-span-2 pb-0.5">
                    <div className="text-[10px] text-[#8A7969] font-normal uppercase tracking-wider">
                      Sets & Pieces
                    </div>
                    <div className="text-[11.5px] font-medium text-[#2C2117] mt-0.5">
                      {specs.setsPieces}
                    </div>
                  </div>
                </div>

                {/* About the product Subsection */}
                <div className="pt-3 border-t border-[#F0EAE1] space-y-2">
                  <h4 className="text-xs font-medium text-[#7E6955] tracking-wide">
                    About the product
                  </h4>
                  <ul className="space-y-1.5 text-[11.5px] text-[#4A392C] font-light leading-relaxed">
                    {specs.aboutBullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-[#B88746] text-xs leading-none mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Includes / Size chart Subsection */}
                <div className="pt-3 border-t border-[#F0EAE1] space-y-2">
                  <h4 className="text-xs font-medium text-[#7E6955] tracking-wide">
                    Includes / Size chart
                  </h4>

                  <div className="overflow-x-auto rounded-lg border border-[#DFCBB8]/70">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#F6EFE6] text-[#3D2E20] font-semibold border-b border-[#DFCBB8]/70">
                        <tr>
                          <th className="py-2 px-3 border-r border-[#DFCBB8]/50">Size</th>
                          <th className="py-2 px-3 border-r border-[#DFCBB8]/50">Includes</th>
                          <th className="py-2 px-3">Measurement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE7DC] text-[#4A392C] font-light">
                        {specs.sizeChart.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#FAF8F5]/80 transition-colors">
                            <td className="py-2 px-3 font-medium text-[#2C2117] border-r border-[#DFCBB8]/40 align-top">
                              {row.size}
                            </td>
                            <td className="py-2 px-3 border-r border-[#DFCBB8]/40 align-top">
                              {row.includes}
                            </td>
                            <td className="py-2 px-3 text-[#5C4B3C] align-top leading-relaxed">
                              {row.measurement}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>

            {/* Clean Collapsible Accordion Info */}
            <div className="border-t border-[#DFCBB8]/70 divide-y divide-[#DFCBB8]/50 text-xs font-sans pt-1">
              {/* Authenticity & Materials */}
              <div className="py-2.5">
                <button
                  type="button"
                  onClick={() => toggleAccordion("material")}
                  className="w-full flex items-center justify-between font-serif text-xs sm:text-[13px] text-[#2C2117] font-medium text-left cursor-pointer"
                >
                  <span>Authenticity & Materials</span>
                  <span className="text-[#8C7A6B] font-medium text-sm">{openAccordion === "material" ? "−" : "+"}</span>
                </button>
                {openAccordion === "material" && (
                  <div className="mt-1.5 text-[11.5px] text-[#5C4B3C] font-light leading-relaxed animate-in fade-in duration-150">
                    {specs.material}. Each piece is individually handcrafted and reflects authentic artisan character.
                  </div>
                )}
              </div>

              {/* Shipping & Returns */}
              <div className="py-2.5">
                <button
                  type="button"
                  onClick={() => toggleAccordion("shipping")}
                  className="w-full flex items-center justify-between font-serif text-xs sm:text-[13px] text-[#2C2117] font-medium text-left cursor-pointer"
                >
                  <span>Shipping & Returns</span>
                  <span className="text-[#8C7A6B] font-medium text-sm">{openAccordion === "shipping" ? "−" : "+"}</span>
                </button>
                {openAccordion === "shipping" && (
                  <div className="mt-1.5 text-[11.5px] text-[#5C4B3C] font-light leading-relaxed animate-in fade-in duration-150 space-y-1">
                    <p>• Free standard delivery across India on orders above ₹499.</p>
                    <p>• Carefully packaged in multi-layer shockproof box.</p>
                    <p>• Hassle-free 7-day replacement guarantee in case of any transit damage.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 'You May Also Like' Section */}
        {/* ========================================================================= */}
        {relatedProducts.length > 0 && (
          <div className="mt-14 sm:mt-18 pt-10 border-t border-[#DFCBB8]/60">
            <h2 className="font-serif text-lg sm:text-xl text-[#2C2117] font-normal mb-6">
              You may also like
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {relatedProducts.map((relProduct) => (
                <div
                  key={relProduct.id}
                  className="bg-white rounded-2xl border border-[#DFCBB8]/70 overflow-hidden shadow-2xs flex flex-col justify-between group hover:shadow-md transition-all duration-300"
                >
                  <div>
                    <Link
                      href={relProduct.href}
                      className="relative block aspect-[4/3] bg-[#F2ECE4] overflow-hidden"
                    >
                      <Image
                        src={relProduct.imageSrc}
                        alt={relProduct.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {relProduct.badge && (
                        <div className="absolute top-2.5 left-2.5 bg-[#1C2820]/90 text-[#FAF5EB] text-[10px] font-medium px-2 py-0.5 rounded-full">
                          {relProduct.badge}
                        </div>
                      )}
                    </Link>

                    <div className="p-4 space-y-1.5">
                      <Link
                        href={relProduct.href}
                        className="block font-serif text-xs sm:text-[13px] text-[#302318] hover:text-[#8E531A] line-clamp-2 min-h-[34px] leading-snug"
                      >
                        {relProduct.name}
                      </Link>
                      <div className="flex items-center space-x-2">
                        {relProduct.originalPrice && (
                          <span className="text-[#8F8175] line-through text-[11px] font-light">
                            ₹{relProduct.originalPrice.toFixed(2)}
                          </span>
                        )}
                        <span className="font-medium text-xs sm:text-sm text-[#281E15]">
                          ₹{relProduct.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      onClick={() => addToCart(relProduct, 1)}
                      className="w-full py-2 px-3 rounded-xl bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs font-medium tracking-wide flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                      </svg>
                      <span>Add to bag</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Customer Reviews Section */}
        {/* ========================================================================= */}
        <div className="mt-14 sm:mt-18 pt-10 border-t border-[#DFCBB8]/60">
          <h2 className="font-serif text-lg sm:text-xl text-[#2C2117] font-normal mb-6">
            Customer Reviews
          </h2>

          {/* Rating Breakdown Strip */}
          <div className="bg-white border border-[#DFCBB8]/70 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center space-x-6">
              <div>
                <div className="font-serif text-3xl sm:text-4xl text-[#2C2117] font-normal">5.0</div>
                <div className="flex text-[#C89438] space-x-0.5 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 fill-[#C89438]" viewBox="0 0 24 24">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <div className="text-[11.5px] text-[#7E6955] mt-1 font-light">
                  Based on {reviews.length} reviews
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-1.5 text-xs text-[#7E6955] font-sans">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center space-x-2">
                    <span className="w-3 text-right text-[11px]">★</span>
                    <span className="w-2 text-[11px]">{star}</span>
                    <div className="w-28 sm:w-44 h-1.5 bg-[#EFE7DC] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1C2820] rounded-full"
                        style={{ width: star === 5 ? "100%" : "0%" }}
                      />
                    </div>
                    <span className="w-3 text-right text-[11px]">{star === 5 ? reviews.length : 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="px-5 py-2.5 rounded-full bg-[#1E2721] hover:bg-[#2F3E34] text-[#FAF6F0] text-xs uppercase tracking-widest font-medium transition-colors cursor-pointer shadow-2xs"
            >
              Write a Review
            </button>
          </div>

          {/* Customer Reviews List */}
          <div className="space-y-3.5">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white border border-[#DFCBB8]/70 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-[#7E6955]">
                  <div className="flex items-center space-x-2">
                    <div className="flex text-[#C89438] space-x-0.5">
                      {[...Array(rev.rating)].map((_, i) => (
                        <svg key={i} className="w-3.5 h-3.5 fill-[#C89438]" viewBox="0 0 24 24">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                    <span className="font-semibold text-[#2C2117] text-xs">{rev.author}</span>
                    {rev.verified && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-sm border border-emerald-200">
                        Verified Buyer
                      </span>
                    )}
                  </div>
                  <span className="font-light text-[11px]">{rev.date}</span>
                </div>

                <p className="text-xs sm:text-[12.5px] text-[#4A392C] font-light leading-relaxed">
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Review Submission Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#FAF8F5] border border-[#DFCBB8] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-[#DFCBB8] pb-3">
                <h3 className="font-serif text-lg text-[#2C2117]">Write a Review</h3>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="text-stone-400 hover:text-stone-700 font-bold text-lg cursor-pointer"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddReview} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={newReviewAuthor}
                    onChange={(e) => setNewReviewAuthor(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full bg-white border border-[#DFCBB8] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans">
                    Rating
                  </label>
                  <select
                    value={newReviewRating}
                    onChange={(e) => setNewReviewRating(Number(e.target.value))}
                    className="w-full bg-white border border-[#DFCBB8] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                  >
                    <option value={5}>★★★★★ (5 - Excellent)</option>
                    <option value={4}>★★★★☆ (4 - Very Good)</option>
                    <option value={3}>★★★☆☆ (3 - Good)</option>
                    <option value={2}>★★☆☆☆ (2 - Fair)</option>
                    <option value={1}>★☆☆☆☆ (1 - Poor)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans">
                    Your Feedback
                  </label>
                  <textarea
                    rows={4}
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="Share your experience with this handcrafted piece..."
                    className="w-full bg-white border border-[#DFCBB8] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="flex-1 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs uppercase tracking-wider font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E2721] hover:bg-[#2F3E34] text-[#FAF6F0] rounded-xl text-xs uppercase tracking-wider font-medium cursor-pointer"
                  >
                    Submit Review
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

