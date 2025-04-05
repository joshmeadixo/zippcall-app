import { FinalPriceData, MarkupConfig, PhoneNumberPriceResponse, TwilioPriceData, UNSUPPORTED_COUNTRIES } from '@/types/pricing';
import { getMarkupConfig, getCountryPricing } from './pricing-db';
import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Apply markup to base price according to rules
 */
export function applyMarkup(
  basePriceData: TwilioPriceData, 
  markupConfig: MarkupConfig
): FinalPriceData {
  // Get country-specific markup or fall back to default
  const countryCode = basePriceData.countryCode;
  const markupPercentage = markupConfig.countrySpecificMarkups[countryCode] || markupConfig.defaultMarkup;
  
  // Apply markup
  const markup = Math.max(markupPercentage, markupConfig.minimumMarkup);
  const markupAmount = basePriceData.basePrice * (markup / 100);
  let finalPrice = basePriceData.basePrice + markupAmount;
  
  // Ensure minimum final price
  finalPrice = Math.max(finalPrice, markupConfig.minimumFinalPrice);
  
  // Round to 4 decimal places for precision
  finalPrice = Math.round(finalPrice * 10000) / 10000;
  
  return {
    ...basePriceData,
    markup,
    markupAmount,
    finalPrice,
    billingIncrement: 60  // Default to per-minute billing (60 seconds)
  };
}

/**
 * Get country pricing data from our Firestore pricing cache
 */
export async function getCountryPriceData(countryCode: string): Promise<TwilioPriceData | null> {
  try {
    // Get all pricing data from Firestore
    const pricingCache = await getCountryPricing();
    
    // If we have pricing data for this country, return it
    if (pricingCache?.data && pricingCache.data[countryCode]) {
      return pricingCache.data[countryCode];
    }
    
    console.log(`No pricing data found for ${countryCode}`);
    return null;
  } catch (error) {
    console.error(`Error getting price data for ${countryCode}:`, error);
    return null;
  }
}

/**
 * Get price for a specific phone number
 */
export async function getPriceForPhoneNumber(
  phoneNumber: string
): Promise<PhoneNumberPriceResponse | null> {
  try {
    // Parse the phone number to get country
    let parsedNumber;
    try {
      parsedNumber = parsePhoneNumber(phoneNumber);
    } catch (error) {
      console.error('Failed to parse phone number:', error);
      return null;
    }
    
    if (!parsedNumber || !parsedNumber.country) {
      console.error('Could not determine country for phone number:', phoneNumber);
      return null;
    }
    
    const countryCode = parsedNumber.country;
    
    // Check if this country is in the unsupported list
    if (UNSUPPORTED_COUNTRIES.includes(countryCode)) {
      return {
        phoneNumber,
        countryCode,
        countryName: parsedNumber.country ? new Intl.DisplayNames(['en'], { type: 'region' }).of(parsedNumber.country) || parsedNumber.country : 'Unknown',
        basePrice: 0,
        markup: 0,
        finalPrice: 0,
        currency: 'USD',
        billingIncrement: 60,
        isEstimate: false,
        isUnsupported: true
      };
    }
    
    // Get base price for this country
    const basePriceData = await getCountryPriceData(countryCode);
    
    if (!basePriceData) {
      console.error(`No price data available for ${countryCode}`);
      return null;
    }
    
    // Get markup configuration
    const markupConfig = await getMarkupConfig();
    
    // Apply markup to get final price
    const finalPriceData = applyMarkup(basePriceData, markupConfig);
    
    // Return formatted response
    return {
      phoneNumber,
      countryCode: finalPriceData.countryCode,
      countryName: finalPriceData.countryName,
      basePrice: finalPriceData.basePrice,
      markup: finalPriceData.markup,
      finalPrice: finalPriceData.finalPrice,
      currency: finalPriceData.currency,
      billingIncrement: finalPriceData.billingIncrement,
      isEstimate: false  // This is accurate for the country
    };
  } catch (error) {
    console.error('Error getting price for phone number:', error);
    return null;
  }
}

/**
 * Calculate price for a call
 */
export function calculateCallCost(
  pricePerMinute: number,
  durationSeconds: number,
  billingIncrement: number = 60
): number {
  // Calculate billable minutes according to the billing increment
  // Most providers round up to the next billing increment
  const billableIncrements = Math.ceil(durationSeconds / billingIncrement);
  const billableMinutes = (billableIncrements * billingIncrement) / 60;
  
  // Calculate cost
  const cost = pricePerMinute * billableMinutes;
  
  // Round to 4 decimal places
  return Math.round(cost * 10000) / 10000;
}

/**
 * Format price for display
 */
export function formatPrice(
  price: number, 
  currency: string = 'USD'
): string {
  // Handle invalid price values
  if (isNaN(price) || price === null || price === undefined) {
    console.warn('Invalid price value for formatting:', price);
    price = 0;
  }
  
  // Get currency symbol
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    // Add more currencies as needed
  };
  
  const symbol = currencySymbols[currency] || currency;
  
  // Format based on price value - telephony prices are often very small
  if (price < 0.01) {
    // For very small prices (less than 1 cent), show more decimal places
    return `${symbol}${price.toFixed(6)}`;
  } else if (price < 1) {
    // For prices less than 1 unit but more than 1 cent
    return `${symbol}${price.toFixed(4)}`;
  } else {
    // For larger prices
    return `${symbol}${price.toFixed(2)}`;
  }
}

/**
 * Get prices for multiple countries
 */
export async function getPricesForCountries(
  countryCodes: string[]
): Promise<Record<string, PhoneNumberPriceResponse>> {
  const markupConfig = await getMarkupConfig();
  const results: Record<string, PhoneNumberPriceResponse> = {};
  
  // Process in batches to avoid overwhelming the system
  const batchSize = 10;
  for (let i = 0; i < countryCodes.length; i += batchSize) {
    const batch = countryCodes.slice(i, i + batchSize);
    
    // Create an array of promises
    const promises = batch.map(async (countryCode) => {
      try {
        // Check if this country is in the unsupported list
        if (UNSUPPORTED_COUNTRIES.includes(countryCode)) {
          return {
            countryCode,
            result: {
              phoneNumber: '',
              countryCode,
              countryName: new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode,
              basePrice: 0,
              markup: 0,
              finalPrice: 0,
              currency: 'USD',
              billingIncrement: 60,
              isEstimate: true,
              isUnsupported: true
            } as PhoneNumberPriceResponse
          };
        }
        
        const basePriceData = await getCountryPriceData(countryCode);
        
        if (!basePriceData) {
          console.log(`No price data for ${countryCode}`);
          return null;
        }
        
        const finalPriceData = applyMarkup(basePriceData, markupConfig);
        
        return {
          countryCode,
          result: {
            phoneNumber: '',  // No specific phone number in this case
            countryCode: finalPriceData.countryCode,
            countryName: finalPriceData.countryName,
            basePrice: finalPriceData.basePrice,
            markup: finalPriceData.markup,
            finalPrice: finalPriceData.finalPrice,
            currency: finalPriceData.currency,
            billingIncrement: finalPriceData.billingIncrement,
            isEstimate: true  // This is a country-level estimate
          } as PhoneNumberPriceResponse
        };
      } catch (error) {
        console.error(`Error getting price for ${countryCode}:`, error);
        return null;
      }
    });
    
    // Wait for all promises in the batch
    const batchResults = await Promise.all(promises);
    
    // Add valid results to the results object
    batchResults.forEach(item => {
      if (item) {
        results[item.countryCode] = item.result;
      }
    });
  }
  
  return results;
}

/**
 * Apply markup to a base price according to markup configuration
 * @param basePrice The base price from Twilio
 * @param countryCode Optional country code for country-specific markups
 * @returns The final price after applying markup
 */
export async function calculateFinalPrice(
  basePrice: number,
  countryCode?: string
): Promise<number> {
  // Get markup configuration
  const markupConfig = await getMarkupConfig();
  
  // Get country-specific markup if available
  let markupPercentage = markupConfig.defaultMarkup;
  if (countryCode && markupConfig.countrySpecificMarkups[countryCode]) {
    markupPercentage = markupConfig.countrySpecificMarkups[countryCode];
  }
  
  // Calculate price with markup
  let finalPrice = basePrice * (1 + markupPercentage / 100);
  
  // Apply minimum markup percentage if needed
  const minMarkupAmount = basePrice * (markupConfig.minimumMarkup / 100);
  if ((finalPrice - basePrice) < minMarkupAmount) {
    finalPrice = basePrice + minMarkupAmount;
  }
  
  // Apply minimum final price if needed
  if (finalPrice < markupConfig.minimumFinalPrice) {
    finalPrice = markupConfig.minimumFinalPrice;
  }
  
  // Round to 6 decimal places (standard for telephony pricing)
  return Number(finalPrice.toFixed(6));
} 