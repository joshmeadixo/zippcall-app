import { CountryPricingCache, MarkupConfig, PriceUpdateRecord, TwilioPriceData } from '@/types/pricing';
import { initializeFirebaseAdmin, getAdminFirestore } from '@/lib/firebase-admin'; // Import Admin SDK helpers
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore'; // Import Admin Timestamp
import { Timestamp as ClientTimestamp } from 'firebase/firestore'; // Need this for type checking in helper

// Initialize Admin SDK (idempotent)
initializeFirebaseAdmin();
const adminDb = getAdminFirestore(); // Get Admin Firestore instance

// Collection paths
const PRICING_COLLECTION = 'pricing';
const COUNTRY_PRICES_DOC = 'country_prices';
const MARKUP_CONFIG_DOC = 'markup_config';
const PRICE_UPDATES_COLLECTION = 'price_updates';

// ---> ADDITION: Define HasToDate interface locally
interface HasToDate {
    toDate(): Date;
}

/**
 * Helper function to safely convert Date or client Timestamp to Admin Timestamp
 */
function ensureAdminTimestamp(dateOrTimestamp: unknown): AdminTimestamp {
  if (dateOrTimestamp instanceof Date) {
    return AdminTimestamp.fromDate(dateOrTimestamp);
  }
  // Use instanceof with the imported ClientTimestamp
  if (dateOrTimestamp instanceof ClientTimestamp) { 
    // Convert client Timestamp to Date, then to Admin Timestamp
    return AdminTimestamp.fromDate(dateOrTimestamp.toDate());
  }
  // Handle potential Admin Timestamps being passed (should be idempotent)
  if (
    dateOrTimestamp !== null && 
    typeof dateOrTimestamp === 'object' && 
    'toDate' in dateOrTimestamp && 
    typeof (dateOrTimestamp as HasToDate).toDate === 'function'
  ) {
    return dateOrTimestamp as AdminTimestamp; 
  }
  console.warn('Unknown date/timestamp type for Admin conversion, defaulting to current time', dateOrTimestamp);
  return AdminTimestamp.fromDate(new Date());
}


/**
 * Save country pricing data to Firestore using Admin SDK
 * (Writes should use Admin SDK to bypass rules)
 */
export async function saveCountryPricing(pricingData: CountryPricingCache): Promise<boolean> {
  try {
    console.log('Attempting to save pricing data to Firestore with', Object.keys(pricingData.data).length, 'countries using Admin SDK');
    
    // Prepare data with Admin SDK Timestamps
    const firestoreData = {
      ...pricingData,
      lastUpdated: ensureAdminTimestamp(pricingData.lastUpdated),
      data: Object.fromEntries(
        Object.entries(pricingData.data).map(([key, value]) => [
          key,
          {
            ...value,
            lastUpdated: ensureAdminTimestamp(value.lastUpdated)
          }
        ])
      )
    };
    
    // Use Admin SDK for the write operation
    const docRef = adminDb.collection(PRICING_COLLECTION).doc(COUNTRY_PRICES_DOC);
    
    // Try set with merge, or update as fallback (common pattern for admin writes)
    try {
      await docRef.set(firestoreData, { merge: true }); 
      console.log('Successfully saved pricing data with Admin SDK set(merge:true)');
      return true;
    } catch (setError) {
        console.warn('Admin SDK set(merge:true) failed, trying update:', setError);
        try {
            await docRef.update(firestoreData);
            console.log('Successfully saved pricing data with Admin SDK update()');
            return true;
        } catch (updateError) {
             console.error('Admin SDK set() and update() both failed:', updateError);
             throw updateError; // Re-throw original error
        }
    }

  } catch (error) {
    console.error('Error saving country pricing using Admin SDK:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return false;
  }
}


/**
 * Save markup configuration using Admin SDK
 */
export async function saveMarkupConfig(config: MarkupConfig): Promise<boolean> {
  try {
    const docRef = adminDb.collection(PRICING_COLLECTION).doc(MARKUP_CONFIG_DOC);
    await docRef.set(config, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving markup config:', error);
    return false;
  }
}

/**
 * Record a price update using Admin SDK
 */
export async function recordPriceUpdate(update: PriceUpdateRecord): Promise<boolean> {
  try {
    const docRef = adminDb.collection(PRICE_UPDATES_COLLECTION).doc(); // Auto-generate ID
    await docRef.set({
      ...update,
      timestamp: ensureAdminTimestamp(update.timestamp),
      id: docRef.id // Store the generated ID
    });
    return true;
  } catch (error) {
    console.error('Error recording price update:', error);
    return false;
  }
}

/**
 * Save a price update record (Alias)
 */
export async function savePriceUpdateRecord(update: PriceUpdateRecord): Promise<boolean> {
  return recordPriceUpdate(update);
}

/**
 * Update a specific country price using Admin SDK
 */
export async function updateCountryPrice(
  countryCode: string, 
  priceData: TwilioPriceData
): Promise<boolean> {
  try {
    const docRef = adminDb.collection(PRICING_COLLECTION).doc(COUNTRY_PRICES_DOC);
    
    // Use Field Path for nested update
    await docRef.update({
      [`data.${countryCode}`]: {
        ...priceData,
        lastUpdated: ensureAdminTimestamp(priceData.lastUpdated)
      },
      lastUpdated: ensureAdminTimestamp(new Date())
    });
    
    return true;
  } catch (error) {
    console.error(`Error updating price for ${countryCode}:`, error);
    return false;
  }
} 