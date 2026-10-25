"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Product } from "@/types";
import { useAuth } from "./AuthContext";

interface ServerCartApiItem {
  productId: string;
  name: string;
  slug?: string;
  href?: string;
  imageSrc?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  quantity: number;
}

interface ServerWishlistApiItem {
  product: {
    id: string;
    name: string;
    slug: string;
    images?: Array<{ url: string }>;
    price: number | string;
    originalPrice?: number | string | null;
    stock: number;
  };
}

export interface CartItem {
  product: Product;
  quantity: number;
}

interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "info";
}

interface ShopContextType {
  // Cart
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (product: Product, quantity?: number, bypassAuth?: boolean) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  // Wishlist
  wishlist: Product[];
  wishlistCount: number;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: Product, bypassAuth?: boolean) => void;
  removeFromWishlist: (productId: string) => void;

  // Toast
  toast: ToastMessage | null;
  showToast: (message: string, type?: "success" | "info") => void;
  clearToast: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const CART_STORAGE_KEY = "shivura_cart_v1";
const WISHLIST_STORAGE_KEY = "shivura_wishlist_v1";

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, requireAuth, consumePendingAction } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Show Toast Helper
  const showToast = useCallback((message: string, type: "success" | "info" = "success") => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3500);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  // Cart Actions (Enforcing Authentication for Protected Action)
  const addToCart = useCallback(
    (product: Product, quantity = 1, bypassAuth = false) => {
      if (!isAuthenticated && !bypassAuth) {
        requireAuth({
          type: "ADD_TO_CART",
          payload: { product, quantity },
          reason: "cart",
        });
        return;
      }

      setCart((prev) => {
        const existingIndex = prev.findIndex((item) => item.product.id === product.id);
        if (existingIndex > -1) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
          return updated;
        }
        return [...prev, { product, quantity }];
      });

      // Server-side persistent cart synchronization
      fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity }),
      }).catch(() => {
        // Local state already updated
      });

      showToast(`Added "${product.name.slice(0, 32)}..." to your cart 🛍️`, "success");
    },
    [isAuthenticated, requireAuth, showToast]
  );

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    showToast("Item removed from cart", "info");
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    if (isAuthenticated) {
      fetch("/api/cart", { method: "DELETE" }).catch(() => {});
    }
  };

  // Wishlist Actions (Enforcing Authentication for Protected Action)
  const isWishlisted = useCallback(
    (productId: string) => {
      return wishlist.some((item) => item.id === productId);
    },
    [wishlist]
  );

  const toggleWishlist = useCallback(
    (product: Product, bypassAuth = false) => {
      if (!isAuthenticated && !bypassAuth) {
        requireAuth({
          type: "TOGGLE_WISHLIST",
          payload: { product },
          reason: "wishlist",
        });
        return;
      }

      setWishlist((prev) => {
        const exists = prev.some((item) => item.id === product.id);
        if (exists) {
          showToast(`Removed from wishlist`, "info");
          if (isAuthenticated) {
            fetch("/api/wishlist", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: product.id }),
            }).catch(() => {});
          }
          return prev.filter((item) => item.id !== product.id);
        } else {
          showToast(`Added to your wishlist ❤️`, "success");
          if (isAuthenticated) {
            fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: product.id }),
            }).catch(() => {});
          }
          return [...prev, product];
        }
      });
    },
    [isAuthenticated, requireAuth, showToast]
  );

  const removeFromWishlist = (productId: string) => {
    if (!isAuthenticated) {
      requireAuth({
        type: "TOGGLE_WISHLIST",
        reason: "wishlist",
      });
      return;
    }

    setWishlist((prev) => prev.filter((item) => item.id !== productId));
    showToast("Removed from wishlist", "info");
    fetch("/api/wishlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  };

  // Load from localStorage on mount (for persistent user session)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }
        const savedWishlist = localStorage.getItem(WISHLIST_STORAGE_KEY);
        if (savedWishlist) {
          setWishlist(JSON.parse(savedWishlist));
        }
      } catch (e) {
        console.error("Failed to load cart/wishlist from localStorage", e);
      } finally {
        setIsLoaded(true);
      }
    });
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [cart, isLoaded]);

  // Save wishlist to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch (e) {
      console.error("Failed to save wishlist to localStorage", e);
    }
  }, [wishlist, isLoaded]);

  // Sync with backend when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Sync cart from server
      fetch("/api/cart")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.success && json?.data?.items && Array.isArray(json.data.items)) {
            const serverItems: CartItem[] = json.data.items.map((item: ServerCartApiItem) => ({
              product: {
                id: item.productId,
                name: item.name,
                href: item.href || `/shop/${item.slug}`,
                imageSrc: item.imageSrc || "/images/Product1.png",
                price: item.price,
                originalPrice: item.originalPrice,
                stock: item.stock,
              },
              quantity: item.quantity,
            }));
            if (serverItems.length > 0) {
              setCart(serverItems);
            }
          }
        })
        .catch((err) => console.warn("[Cart server sync error]", err));

      // Sync wishlist from server
      fetch("/api/wishlist")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.success && json?.items && Array.isArray(json.items)) {
            const serverWishlist: Product[] = json.items.map((item: ServerWishlistApiItem) => ({
              id: item.product.id,
              name: item.product.name,
              href: `/shop/${item.product.slug}`,
              imageSrc: item.product.images?.[0]?.url || "/images/Product1.png",
              price: Number(item.product.price),
              originalPrice: item.product.originalPrice ? Number(item.product.originalPrice) : undefined,
              stock: item.product.stock,
            }));
            if (serverWishlist.length > 0) {
              setWishlist(serverWishlist);
            }
          }
        })
        .catch((err) => console.warn("[Wishlist server sync error]", err));

      // Resume pending action if user just authenticated
      const pending = consumePendingAction();
      if (pending) {
        queueMicrotask(() => {
          if (pending.type === "ADD_TO_CART" && pending.payload?.product) {
            addToCart(pending.payload.product, pending.payload.quantity || 1, true);
          } else if (pending.type === "TOGGLE_WISHLIST" && pending.payload?.product) {
            toggleWishlist(pending.payload.product, true);
          }
        });
      }
    } else if (!isAuthLoading && isLoaded) {
      // User explicitly logged out: clean local state for guest session
      queueMicrotask(() => {
        setCart([]);
        setWishlist([]);
      });
      try {
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(WISHLIST_STORAGE_KEY);
      } catch {}
    }
  }, [
    isAuthenticated,
    isAuthLoading,
    isLoaded,
    addToCart,
    toggleWishlist,
    consumePendingAction,
  ]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
  const wishlistCount = wishlist.length;

  return (
    <ShopContext.Provider
      value={{
        cart,
        cartCount,
        cartSubtotal,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        wishlist,
        wishlistCount,
        isWishlisted,
        toggleWishlist,
        removeFromWishlist,
        toast,
        showToast,
        clearToast,
      }}
    >
      {children}

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center space-x-3 bg-[#1C2820] text-[#FAF5EB] px-4 py-3 rounded-xl border border-[#C8A060]/40 shadow-2xl backdrop-blur-md">
            <span className="text-sm font-sans font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={clearToast}
              className="text-stone-400 hover:text-white cursor-pointer ml-2 text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}
