import { z } from "zod";

/**
 * Validation schema for new user registration (Email + Password signup).
 */
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email is too long")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Validation schema for user login (Email + Password).
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email is too long")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(1, "Password is required")
    .max(100, "Password is too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;
