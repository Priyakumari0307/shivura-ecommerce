import { Container } from "@/components/ui/Container";

export default function BlogPage() {
  return (
    <div className="py-20 bg-[#FAF8F5]">
      <Container size="wide">
        <div className="text-center max-w-xl mx-auto space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-sans">
            Stories & Insights
          </span>
          <h1 className="font-serif text-4xl text-neutral-900">
            Journal & Blog
          </h1>
          <div className="w-12 h-[1px] bg-neutral-400 mx-auto" />
          <p className="text-sm text-neutral-600 font-light leading-relaxed pt-2">
            Explore craft, design philosophy, and stories from our artisans.
          </p>
        </div>
      </Container>
    </div>
  );
}
