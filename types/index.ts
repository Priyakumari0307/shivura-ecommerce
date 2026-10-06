export * from "./navigation";

export interface BrandPillar {
  title: string;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  href: string;
  imageSrc: string;
  originalPrice?: number;
  price: number;
  pricePrefix?: string;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
  badge?: string;
  category?: string;
  categories?: string[];
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
