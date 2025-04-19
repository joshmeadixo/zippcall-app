import { Timestamp as ClientTimestamp, doc as clientDoc, getDoc as clientGetDoc } from 'firebase/firestore';
import { db as clientDb } from '@/lib/firebase'; // Client SDK DB instance
import { CountryPricingCache, MarkupConfig } from '@/types/pricing';

// Collection paths
const PRICING_COLLECTION = 'pricing';
const COUNTRY_PRICES_DOC = 'country_prices';
const MARKUP_CONFIG_DOC = 'markup_config';

// Define HasToDate interface locally
interface HasToDate {
  toDate(): Date;
}

/**
 * Get country pricing data from Firestore using Client SDK
 * Converts Timestamps to Dates for use in the application.
 */
export async function getCountryPricing(): Promise<CountryPricingCache | null> {
  try {
    const docRef = clientDoc(clientDb, PRICING_COLLECTION, COUNTRY_PRICES_DOC);
    const docSnap = await clientGetDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data(); 
      
      // Helper to convert various timestamp formats to Date
      const convertToDate = (ts: unknown): Date | null => {
         if (ts instanceof ClientTimestamp) {
             return ts.toDate();
         } else if (ts instanceof Date) {
             return ts;
         } else if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as HasToDate).toDate === 'function') {
             // Handle potential plain objects or Admin Timestamps
             try { return (ts as HasToDate).toDate(); } catch { /* ignore */ }
         } else if (typeof ts === 'string') {
             try { return new Date(ts); } catch { /* ignore */ }
         }
         console.warn('Could not convert timestamp to Date:', ts);
         return null;
      };

      // Convert top-level and nested timestamps
      data.lastUpdated = convertToDate(data.lastUpdated) ?? new Date(); 
      if (data.data) {
          Object.keys(data.data).forEach(key => {
            const countryData = data.data[key];
            if (countryData) {
                countryData.lastUpdated = convertToDate(countryData.lastUpdated) ?? new Date();
            }
          });
      }
      
      // Ensure the final object conforms to the type
      const finalData: CountryPricingCache = {
          version: typeof data.version === 'number' ? data.version : 1,
          lastUpdated: data.lastUpdated, // Already a Date object
          data: data.data || {}
      };

      return finalData;
    } else {
      console.log('No pricing data found in Firestore');
      return null;
    }
  } catch (error) {
    console.error('Error fetching country pricing:', error);
    return null;
  }
}

/**
 * Get markup configuration using Client SDK
 */
export async function getMarkupConfig(): Promise<MarkupConfig> {
  try {
    const docRef = clientDoc(clientDb, PRICING_COLLECTION, MARKUP_CONFIG_DOC);
    const docSnap = await clientGetDoc(docRef);
    
    if (docSnap.exists()) {
      // Ensure it conforms to MarkupConfig, providing defaults if necessary
      const data = docSnap.data();
      return {
        defaultMarkup: typeof data.defaultMarkup === 'number' ? data.defaultMarkup : 100,
        countrySpecificMarkups: data && typeof data.countrySpecificMarkups === 'object' ? data.countrySpecificMarkups : {},
        minimumMarkup: typeof data.minimumMarkup === 'number' ? data.minimumMarkup : 100,
        minimumFinalPrice: typeof data.minimumFinalPrice === 'number' ? data.minimumFinalPrice : 0.15
      } as MarkupConfig;
    } else {
      console.log('No markup config found, returning defaults');
      return {
        defaultMarkup: 100,
        countrySpecificMarkups: {},
        minimumMarkup: 100,
        minimumFinalPrice: 0.15
      };
    }
  } catch (error) {
    console.error('Error fetching markup config:', error);
    return {
      defaultMarkup: 100,
      countrySpecificMarkups: {},
      minimumMarkup: 100,
      minimumFinalPrice: 0.15
    };
  }
} 