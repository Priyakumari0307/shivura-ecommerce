import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_PRODUCTS } from "@/lib/constants";
import { ProductDetailView } from "@/components/product";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ALL_PRODUCTS.map((product) => {
    const slug = product.href.replace("/shop/", "");
    return { slug };
  });
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const product = ALL_PRODUCTS.find(
    (p) => p.href === `/shop/${slug}` || p.id === slug
  ) || ALL_PRODUCTS[0];

  return {
    title: `${product.name} | Shivura Handcrafted Luxury`,
    description: `Discover ${product.name} handcrafted with timeless elegance and authentic artisanal Indian heritage.`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const product = ALL_PRODUCTS.find(
    (p) => p.href === `/shop/${slug}` || p.id === slug
  ) || ALL_PRODUCTS.find((p) => p.href.endsWith(slug));

  if (!product) {
    notFound();
  }

  return <ProductDetailView product={product} />;
}
