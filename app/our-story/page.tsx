import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Our Story | Preserving India's Living Craft | Shivura",
  description:
    "Discover the story of Shivura. Bringing India's craftsmanship, artisanal stories, and heritage traditions into contemporary homes.",
};

export default function OurStoryPage() {
  return (
    <div className="bg-[#FAF8F5] text-[#2C2117] font-sans antialiased overflow-hidden">
      {/* ============================================================ */}
      {/* 1. HERO BANNER: Preserving India's Living Craft */}
      {/* ============================================================ */}
      <section className="relative w-full overflow-hidden bg-[#160E09] text-stone-100 py-20 sm:py-28 md:py-32 border-b border-[#C8A060]/30">
        {/* Background Hand-Carved Wood Pattern */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/carved-wood-banner.jpg"
            alt="Intricate Indian woodcarving heritage"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-40 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#140E0A]/85 via-[#1A110B]/70 to-[#140E0A]/90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,160,96,0.15)_0%,transparent_75%)]" />
        </div>

        <Container size="wide" className="relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6">
            {/* Category Tag / Sub-header */}
            <span className="font-serif text-xl sm:text-2xl md:text-3xl text-[#E5D2B8] font-light tracking-wide block">
              Shivura&apos;s Story
            </span>

            {/* Main Title */}
            <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl text-[#FAF5ED] font-normal tracking-normal leading-[1.15] drop-shadow-md">
              Preserving India&apos;s Living Craft
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base md:text-lg text-[#DFCEB9] font-light max-w-xl mx-auto leading-relaxed">
              Bringing India&apos;s craftsmanship, stories and traditions closer to modern homes.
            </p>

            {/* CTA Button */}
            <div className="pt-2 sm:pt-4">
              <Link
                href="/shop"
                className="inline-flex items-center space-x-2 px-7 py-3 rounded-full bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs sm:text-sm font-sans font-medium tracking-wide border border-[#C8A060]/60 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <span>Explore Our Collections</span>
                <span className="text-[#E6CA65]">→</span>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 2. WHY WE STARTED */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-[#EADFD2]/70">
        <Container size="wide">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Text */}
            <div className="lg:col-span-6 space-y-6 max-w-xl">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-[42px] text-[#2C2117] font-normal tracking-tight">
                Why We Started
              </h2>

              <div className="space-y-4 text-sm sm:text-base text-[#5A4839] font-light leading-relaxed">
                <p>
                  India is home to generations of artisans whose hands have shaped traditions, celebrations and everyday objects for centuries. Yet many of these crafts remain distant from the modern customer.
                </p>
                <p>
                  SHIVURA was born from a simple thought — what if discovering India&apos;s craftsmanship could become a part of everyday shopping?
                </p>
                <p>
                  We wanted to build a space where beautifully crafted products could be discovered, appreciated and brought into contemporary homes.
                </p>
              </div>
            </div>

            {/* Right Column: Image */}
            <div className="lg:col-span-6">
              <div className="relative w-full aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
                <Image
                  src="/images/artisan-potter-master.jpg"
                  alt="Elder Indian craftsman making clay pots"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 3. MEET THE HANDS BEHIND THE CRAFT */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-[#EADFD2]/70">
        <Container size="wide">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-[42px] text-[#2C2117] font-normal tracking-tight">
              Meet the Hands Behind the Craft
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#6E5A4A] font-light leading-relaxed">
              Behind every diya, pottery piece, decorative object or handcrafted creation is someone who has spent years learning their craft.
            </p>
          </div>

          {/* 3 Artisan Portrait Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Card 1: Diya artisan */}
            <div className="relative aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
              <Image
                src="/images/artisan-diya-woman.jpg"
                alt="Artisan woman crafting handmade diyas"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

            {/* Card 2: Woodcarver artisan */}
            <div className="relative aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
              <Image
                src="/images/artisan-woodcarver.jpg"
                alt="Artisan sculpting intricate woodwork"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

            {/* Card 3: Senior potter artisan */}
            <div className="relative aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
              <Image
                src="/images/artisan-potter-master.jpg"
                alt="Master potter artisan at spinning wheel"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 4. MORE THAN A PURCHASE & NOT EVERYTHING MAKES IT */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-[#EADFD2]/70 space-y-20 sm:space-y-28">
        <Container size="wide">
          {/* Sub-block A: More Than a Purchase (Image Left, Text Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="relative w-full aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
                <Image
                  src="/images/ceramic-vases-shelf.jpg"
                  alt="Minimalist artisanal ceramic pottery on wooden table"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                />
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 space-y-6 max-w-xl">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-[42px] text-[#2C2117] font-normal tracking-tight">
                More Than a Purchase
              </h2>

              <div className="space-y-4 text-sm sm:text-base text-[#5A4839] font-light leading-relaxed">
                <p>
                  When you choose a thoughtfully crafted product, you&apos;re choosing more than an object.
                </p>
                <p>
                  You&apos;re helping create demand for skills passed from one generation to another.
                </p>
                <p>
                  You&apos;re helping traditional craftsmanship remain relevant.
                </p>
                <p>
                  And you&apos;re bringing a piece of India&apos;s living heritage into your own home.
                </p>
              </div>
            </div>
          </div>

          {/* Sub-block B: Not Everything Makes It to SHIVURA (Text Left, Image Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center pt-8">
            <div className="lg:col-span-6 space-y-6 max-w-xl">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-[42px] text-[#2C2117] font-normal tracking-tight">
                Not Everything Makes It to SHIVURA
              </h2>

              <div className="space-y-4 text-sm sm:text-base text-[#5A4839] font-light leading-relaxed">
                <p>
                  We don&apos;t believe in adding products simply to make a larger catalogue. We look for pieces with character, purpose and a story worth sharing.
                </p>
                <p>
                  From festive essentials and handcrafted pottery to lighting and thoughtful gifts, every collection is chosen to balance Indian character with contemporary living.
                </p>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative w-full aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
                <Image
                  src="/images/terracotta-diyas-cloth.jpg"
                  alt="Authentic terracotta earthen diyas with oil and flame"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 5. OUR PRODUCT JOURNEY & WHAT DRIVES US */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-[#EADFD2]/70 space-y-16 sm:space-y-24">
        <Container size="wide">
          {/* Main Section Header */}
          <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-[42px] text-[#2C2117] font-normal tracking-tight">
              Our Product Journey
            </h2>
          </div>

          {/* Sub-block A: Made with Purpose. Chosen with Care. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-6">
              <div className="relative w-full aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
                <Image
                  src="/images/hands-pottery-wheel.jpg"
                  alt="Artisan hands shaping pottery on spinning wheel"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                />
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6 max-w-xl">
              <h3 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal">
                Made with Purpose. Chosen with Care.
              </h3>

              {/* Journey Step Flow */}
              <div className="space-y-2 text-xs sm:text-sm text-[#4E3D30] font-sans font-medium tracking-wide">
                <p>Artisan / Maker</p>
                <p className="text-[#B88746]">↓</p>
                <p>Craft &amp; Creation</p>
                <p className="text-[#B88746]">↓</p>
                <p>SHIVURA Curation</p>
                <p className="text-[#B88746]">↓</p>
                <p>Careful Packaging</p>
                <p className="text-[#B88746]">↓</p>
                <p>Your Home</p>
              </div>
            </div>
          </div>

          {/* Sub-block B: What Drives Us (Text Left, Image Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center pt-8">
            <div className="lg:col-span-6 space-y-6 max-w-xl">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-[42px] text-[#2C2117] font-normal tracking-tight">
                What Drives Us
              </h2>

              <div className="space-y-4 text-sm sm:text-base text-[#5A4839] font-light leading-relaxed">
                <p>
                  We&apos;re building SHIVURA because we believe Indian craftsmanship deserves a place in modern homes - not just during festivals, but throughout everyday life.
                </p>
                <p>
                  We want to make discovering meaningful products easier, help traditional crafts find new audiences, and create a brand where heritage and contemporary living can exist together.
                </p>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative w-full aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#EFE7DC] border border-[#DFCBB8]/70 shadow-sm group">
                <Image
                  src="/images/artisan-potter-master.jpg"
                  alt="Potter artisan working with dedication"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 6. OUR VISION */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-20 bg-[#FAF8F5] text-center">
        <Container size="narrow">
          <div className="max-w-xl mx-auto space-y-4">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-[40px] text-[#2C2117] font-normal tracking-tight">
              Our Vision
            </h2>
            <p className="text-sm sm:text-base text-[#6E5A4A] font-light leading-relaxed">
              To become a modern home and lifestyle brand that helps keep India&apos;s living crafts relevant, discoverable and cherished for generations to come.
            </p>
          </div>
        </Container>
      </section>

      {/* ============================================================ */}
      {/* 7. BOTTOM BANNER: Bring a Story Home. */}
      {/* ============================================================ */}
      <section className="relative w-full overflow-hidden bg-[#160E09] text-stone-100 py-20 sm:py-24 md:py-28 border-t border-[#C8A060]/30">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/carved-wood-banner.jpg"
            alt="Hand-carved woodwork background"
            fill
            sizes="100vw"
            className="object-cover object-center opacity-40 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#140E0A]/85 via-[#1A110B]/70 to-[#140E0A]/90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,160,96,0.15)_0%,transparent_75%)]" />
        </div>

        <Container size="wide" className="relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#FAF5ED] font-normal tracking-normal leading-tight drop-shadow-md">
              Bring a Story Home.
            </h2>

            <p className="text-sm sm:text-base text-[#DFCEB9] font-light max-w-xl mx-auto leading-relaxed">
              Discover pieces made with skill, selected with purpose and inspired by India&apos;s living craft.
            </p>

            <div className="pt-2 sm:pt-4">
              <Link
                href="/shop"
                className="inline-flex items-center space-x-2 px-7 py-3 rounded-full bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs sm:text-sm font-sans font-medium tracking-wide border border-[#C8A060]/60 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <span>Explore Our Collections</span>
                <span className="text-[#E6CA65]">→</span>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
