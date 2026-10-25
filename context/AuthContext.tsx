"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AuthUser,
  PendingAction,
  PendingActionType,
  PendingActionPayload,
} from "@/types";
import {
  savePendingAction,
  getPendingAction,
  clearPendingAction,
  sanitizeClientRedirectPath,
} from "@/lib/pendingAction";

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupCredentials {
  name: string;
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  checkAuth: () => Promise<AuthUser | null>;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (credentials: SignupCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  requireAuth: (
    action: {
      type: PendingActionType;
      payload?: PendingActionPayload;
      returnUrl?: string;
      reason?: string;
    }
  ) => boolean;
  consumePendingAction: () => PendingAction | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  /**
   * Checks current authentication state by querying GET /api/auth/me.
   * Leverages the secure, HTTP-only cookie automatically sent by the browser.
   * Does NOT interrupt public browsing if unauthenticated.
   */
  const checkAuth = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          return data.user;
        }
      }
      setUser(null);
      return null;
    } catch (error) {
      console.error("[Auth] Session verification error:", error);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth once on startup
  useEffect(() => {
    let active = true;
    (async () => {
      if (active) {
        await checkAuth();
      }
    })();
    return () => {
      active = false;
    };
  }, [checkAuth]);

  /**
   * Authenticates user with POST /api/auth/login.
   */
  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Invalid email or password";
        return {
          success: false,
          error: errorText,
        };
      }

      setUser(data.user);
      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      console.error("[Auth] Login error:", error);
      return {
        success: false,
        error: "Network error occurred. Please check your connection.",
      };
    }
  };

  /**
   * Registers a new user with POST /api/auth/signup.
   */
  const signup = async (credentials: SignupCredentials): Promise<AuthResponse> => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Failed to create account";
        return {
          success: false,
          error: errorText,
        };
      }

      setUser(data.user);
      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      console.error("[Auth] Signup error:", error);
      return {
        success: false,
        error: "Network error occurred. Please check your connection.",
      };
    }
  };

  /**
   * Invalidate active session with POST /api/auth/logout.
   * Clears state and cookies, allowing user to continue guest browsing.
   */
  const logout = async (): Promise<void> => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("[Auth] Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  /**
   * Enforces authentication before executing a protected action.
   * If user is authenticated, returns true immediately.
   * If user is a guest, persists the intended action to sessionStorage,
   * redirects to /login with safe return URL and reason, and returns false.
   */
  const requireAuth = (action: {
    type: PendingActionType;
    payload?: PendingActionPayload;
    returnUrl?: string;
    reason?: string;
  }): boolean => {
    if (user) {
      return true;
    }

    const currentPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";

    const returnUrl = action.returnUrl || currentPath;
    const safeReturnUrl = sanitizeClientRedirectPath(returnUrl);

    // Save pending action to sessionStorage
    savePendingAction({
      type: action.type,
      payload: action.payload,
      returnUrl: safeReturnUrl,
      reason: action.reason || action.type.toLowerCase(),
      timestamp: Date.now(),
    });

    // Redirect guest to login
    const searchParams = new URLSearchParams();
    searchParams.set("returnUrl", safeReturnUrl);
    if (action.reason) {
      searchParams.set("reason", action.reason);
    }
    router.push(`/login?${searchParams.toString()}`);

    return false;
  };

  /**
   * Retrieves and clears the pending action so the client can resume it
   * safely after login/signup without re-executing it multiple times.
   */
  const consumePendingAction = (): PendingAction | null => {
    const pending = getPendingAction();
    if (pending) {
      clearPendingAction();
    }
    return pending;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        checkAuth,
        login,
        signup,
        logout,
        requireAuth,
        consumePendingAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
