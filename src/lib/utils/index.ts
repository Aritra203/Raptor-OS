import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names with Tailwind CSS conflict resolution.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Safely format dates to ISO string or fallback.
 */
export function formatDate(date: Date | string | number): string {
  try {
    return new Date(date).toISOString();
  } catch {
    return "Invalid Date";
  }
}
