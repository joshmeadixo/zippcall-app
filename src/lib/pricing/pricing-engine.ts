import { PhoneNumberPriceResponse, TwilioPriceData, UNSUPPORTED_COUNTRIES } from '@/types/pricing';
import { getCountryPricing } from './pricing-db-client';
import { parsePhoneNumber } from 'libphonenumber-js';

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
        finalPrice: 0,
        currency: 'USD',
        billingIncrement: 60,
        isEstimate: false,
        isUnsupported: true
      };
    }
    
    // Get base price for this country
    const priceData = await getCountryPriceData(countryCode);
    
    if (!priceData) {
      console.error(`No price data available for ${countryCode}`);
      return null;
    }
    
    // Return formatted response
    return {
      phoneNumber,
      countryCode: priceData.countryCode,
      countryName: priceData.countryName,
      finalPrice: priceData.finalPrice,
      currency: priceData.currency,
      billingIncrement: 60,
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
  
  // Always format to 2 decimal places
  return `${symbol}${price.toFixed(2)}`;
}

/**
 * Get prices for multiple countries
 */
export async function getPricesForCountries(
  countryCodes: string[]
): Promise<Record<string, PhoneNumberPriceResponse>> {
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
              finalPrice: 0,
              currency: 'USD',
              billingIncrement: 60,
              isEstimate: true,
              isUnsupported: true
            } as PhoneNumberPriceResponse
          };
        }
        
        const priceData = await getCountryPriceData(countryCode);
        
        if (!priceData) {
          console.log(`No price data for ${countryCode}`);
          return null;
        }
        
        return {
          countryCode,
          result: {
            phoneNumber: '',  // No specific phone number in this case
            countryCode: priceData.countryCode,
            countryName: priceData.countryName,
            finalPrice: priceData.finalPrice,
            currency: priceData.currency,
            billingIncrement: 60,
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