export * from "./navigation";
export * from "./auth";

export interface BrandPillar {
  title: string;
  description: string;
}

export interface ProductCategoryInfo {
  id: string;
  name: string;
  slug: string;
}

export interface ProductOccasionInfo {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImageInfo {
  id: string;
  url: string;
  altText?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  href: string;
  imageSrc: string;
  slug?: string;
  description?: string | null;
  shortDescription?: string | null;
  originalPrice?: number | null;
  price: number;
  pricePrefix?: string | null;
  sku?: string | null;
  stock?: number;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
  badge?: string | null;
  category?: string;
  categories?: string[];
  occasions?: ProductOccasionInfo[];
  primaryImage?: ProductImageInfo | null;
  images?: ProductImageInfo[];
}

export interface ShopCategoryItem {
  id: string;
  label: string;
  slug: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  image?: string | null;
  imageSrc?: string | null;
  slug: string;
  href?: string;
}

export interface OccasionItem {
  id: string;
  name: string;
  image?: string | null;
  imageSrc?: string | null;
  slug: string;
  href?: string;
  lineBreakName?: React.ReactNode;
}
