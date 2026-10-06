export interface SubNavItem {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  badge?: string;
  subItems?: SubNavItem[];
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}
