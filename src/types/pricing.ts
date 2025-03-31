/**
 * Types for the pricing system
 */

/**
 * Base price data from Twilio
 */
export interface TwilioPriceData {
  countryCode: string;  // ISO country code (e.g., "US")
  countryName: string;  // Full country name (e.g., "United States")
  basePrice: number;    // Price in USD
  currency: string;     // Currency code (typically "USD")
  lastUpdated: Date;    // When this price was last fetched from Twilio
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
  phoneNumber: string;  // E.164 formatted phone number
  countryCode: string;  // ISO country code
  countryName: string;  // Full country name
  basePrice: number;    // Wholesale price
  markup: number;       // Markup percentage
  finalPrice: number;   // Price to charge the customer
  currency: string;     // Currency code
  billingIncrement: number; // In seconds
  isEstimate: boolean;  // If true, this is a country-level estimate
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
  lastUpdated: Date;
  data: Record<string, TwilioPriceData>;
} 