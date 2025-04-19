import { Timestamp } from "firebase/firestore";

/**
 * Types for the pricing system
 */

/**
 * Base price data from Twilio
 */
export interface TwilioPriceData {
  countryCode: string;  // ISO country code (e.g., "US")
  countryName: string;  // Full country name (e.g., "United States")
  finalPrice: number;   // Price in USD
  currency: string;     // Currency code (typically "USD")
  lastUpdated: Date | Timestamp;    // When this price was last fetched from Twilio
}

/**
 * Final price with markup
 */
export interface FinalPriceData extends TwilioPriceData {
  markup: number;       // Markup percentage (e.g., 20 for 20%)
  markupAmount: number; // Actual amount added to the base price
  finalPrice: number;   // Final price with markup applied
  billingIncrement: number; // In seconds, typically 60 for per-minute billing
}

/**
 * Price response for a specific phone number
 */
export interface PhoneNumberPriceResponse {
  phoneNumber: string;       // E.164 number that was looked up
  countryCode: string;       // ISO country code
  countryName: string;       // Full country name
  finalPrice: number;        // Final price per minute
  currency: string;          // Currency (typically USD)
  billingIncrement: number;  // Billing increment in seconds
  calculatedCost?: number;   // Optional precalculated total cost
  duration?: number;         // Optional call duration in seconds
  isEstimate: boolean;       // Whether this is an estimate or exact
  isUnsupported?: boolean;   // Whether this country is unsupported by Twilio
}

/**
 * Configuration for markup rules
 */
export interface MarkupConfig {
  defaultMarkup: number;  // Default markup percentage
  countrySpecificMarkups: Record<string, number>; // Country code -> markup percentage
  minimumMarkup: number;  // Minimum markup percentage
  minimumFinalPrice: number; // Minimum final price regardless of base price
}

/**
 * Price update history
 */
export interface PriceUpdateRecord {
  id: string;
  timestamp: Date;
  countryCode: string;
  previousBasePrice: number;
  newBasePrice: number;
  percentageChange: number;
  isSignificant: boolean; // Flag for significant price changes
}

/**
 * Format for caching country pricing
 */
export interface CountryPricingCache {
  version: number;
  lastUpdated: Date | Timestamp;
  data: Record<string, TwilioPriceData>;
}

/**
 * List of countries that are not supported by Twilio for outgoing calls
 * ISO country codes (e.g., "CN" for China)
 */
export const UNSUPPORTED_COUNTRIES: string[] = [
  "CN", // China
  "IR", // Iran
  "KP", // North Korea
  // Add other unsupported countries as needed
]; 