import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A utility function that combines clsx and tailwind-merge to merge class names
 * This is commonly used in UI components to handle complex class conditions
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 