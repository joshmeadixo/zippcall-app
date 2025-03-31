import { Timestamp, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CountryPricingCache, MarkupConfig, PriceUpdateRecord, TwilioPriceData } from '@/types/pricing';

// Collection paths
const PRICING_COLLECTION = 'pricing';
const COUNTRY_PRICES_DOC = 'country_prices';
const MARKUP_CONFIG_DOC = 'markup_config';
const PRICE_UPDATES_COLLECTION = 'price_updates';

/**
 * Get country pricing data from Firestore
 */
export async function getCountryPricing(): Promise<CountryPricingCache | null> {
  try {
    const docRef = doc(db, PRICING_COLLECTION, COUNTRY_PRICES_DOC);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as CountryPricingCache;
      // Convert Firestore timestamp to Date
      data.lastUpdated = (data.lastUpdated as unknown as Timestamp).toDate();
      
      // Convert all lastUpdated timestamps in the data
      Object.keys(data.data).forEach(key => {
        const countryData = data.data[key];
        countryData.lastUpdated = (countryData.lastUpdated as unknown as Timestamp).toDate();
      });
      
      return data;
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
 * Save country pricing data to Firestore
 */
export async function saveCountryPricing(pricingData: CountryPricingCache): Promise<boolean> {
  try {
    // Add extra logging to debug the issue
    console.log('Attempting to save pricing data to Firestore with', Object.keys(pricingData.data).length, 'countries');
    
    // Convert all Dates to Firestore Timestamps
    const firestoreData = {
      ...pricingData,
      lastUpdated: Timestamp.fromDate(pricingData.lastUpdated),
      data: Object.fromEntries(
        Object.entries(pricingData.data).map(([key, value]) => [
          key,
          {
            ...value,
            lastUpdated: Timestamp.fromDate(value.lastUpdated)
          }
        ])
      )
    };
    
    // Try to set the document with different approaches
    try {
      // First try with setDoc
      await setDoc(doc(db, PRICING_COLLECTION, COUNTRY_PRICES_DOC), firestoreData);
      console.log('Successfully saved pricing data with setDoc');
      return true;
    } catch (setDocError) {
      console.error('Error with setDoc:', setDocError);
      
      // Try with updateDoc as fallback
      try {
        console.log('Trying updateDoc as fallback...');
        await updateDoc(doc(db, PRICING_COLLECTION, COUNTRY_PRICES_DOC), firestoreData);
        console.log('Successfully saved pricing data with updateDoc');
        return true;
      } catch (updateDocError) {
        console.error('Error with updateDoc:', updateDocError);
        throw updateDocError; // Re-throw to be caught by outer catch
      }
    }
  } catch (error) {
    console.error('Error saving country pricing:', error);
    // Include more diagnostic info
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if ('code' in error) {
        console.error('Error code:', (error as { code: string }).code);
      }
    }
    return false;
  }
}

/**
 * Get markup configuration
 */
export async function getMarkupConfig(): Promise<MarkupConfig> {
  try {
    const docRef = doc(db, PRICING_COLLECTION, MARKUP_CONFIG_DOC);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as MarkupConfig;
    } else {
      console.log('No markup config found, returning defaults');
      // Return default markup config
      return {
        defaultMarkup: 100, // 100% markup by default
        countrySpecificMarkups: {}, // No country-specific markups
        minimumMarkup: 100, // Never go below 100%
        minimumFinalPrice: 0.15 // Minimum price of $0.15 per minute
      };
    }
  } catch (error) {
    console.error('Error fetching markup config:', error);
    // Return default in case of error
    return {
      defaultMarkup: 100,
      countrySpecificMarkups: {},
      minimumMarkup: 100,
      minimumFinalPrice: 0.15
    };
  }
}

/**
 * Save markup configuration
 */
export async function saveMarkupConfig(config: MarkupConfig): Promise<boolean> {
  try {
    await setDoc(doc(db, PRICING_COLLECTION, MARKUP_CONFIG_DOC), config);
    return true;
  } catch (error) {
    console.error('Error saving markup config:', error);
    return false;
  }
}

/**
 * Record a price update
 */
export async function recordPriceUpdate(update: PriceUpdateRecord): Promise<boolean> {
  try {
    const updateRef = doc(collection(db, PRICE_UPDATES_COLLECTION));
    await setDoc(updateRef, {
      ...update,
      timestamp: Timestamp.fromDate(update.timestamp),
      id: updateRef.id
    });
    return true;
  } catch (error) {
    console.error('Error recording price update:', error);
    return false;
  }
}

/**
 * Save a price update record
 * Alias for recordPriceUpdate to match the import in the webhook route
 */
export async function savePriceUpdateRecord(update: PriceUpdateRecord): Promise<boolean> {
  return recordPriceUpdate(update);
}

/**
 * Update a specific country price
 */
export async function updateCountryPrice(
  countryCode: string, 
  priceData: TwilioPriceData
): Promise<boolean> {
  try {
    const docRef = doc(db, PRICING_COLLECTION, COUNTRY_PRICES_DOC);
    
    await updateDoc(docRef, {
      [`data.${countryCode}`]: {
        ...priceData,
        lastUpdated: Timestamp.fromDate(priceData.lastUpdated)
      },
      lastUpdated: Timestamp.fromDate(new Date())
    });
    
    return true;
  } catch (error) {
    console.error(`Error updating price for ${countryCode}:`, error);
    return false;
  }
} 