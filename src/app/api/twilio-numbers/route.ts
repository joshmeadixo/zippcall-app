import { NextResponse } from 'next/server';
import twilio from 'twilio';

// Initialize Twilio client with credentials from environment variables
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Cache for phone numbers to avoid frequent API calls
let phoneNumbersCache: string[] = [];
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

/**
 * Fetches active Twilio phone numbers and caches them
 */
async function fetchPhoneNumbers(): Promise<string[]> {
  try {
    // If cache is still valid, return cached numbers
    const now = Date.now();
    if (phoneNumbersCache.length > 0 && now - lastCacheTime < CACHE_TTL) {
      console.log('[twilio-numbers] Using cached phone numbers');
      return phoneNumbersCache;
    }

    console.log('[twilio-numbers] Fetching phone numbers from Twilio');
    
    // Fetch incoming phone numbers from Twilio
    const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list({
      limit: 100, // Adjust if you have more numbers
    });

    // Extract phone numbers in E.164 format
    const phoneNumbers = incomingPhoneNumbers.map(number => number.phoneNumber);
    
    // Update cache
    phoneNumbersCache = phoneNumbers;
    lastCacheTime = now;
    
    console.log(`[twilio-numbers] Fetched ${phoneNumbers.length} phone numbers from Twilio`);
    return phoneNumbers;
  } catch (error) {
    console.error('Error fetching Twilio phone numbers:', error);
    
    // If error occurred but we have cached numbers, return those
    if (phoneNumbersCache.length > 0) {
      console.log('[twilio-numbers] Using cached phone numbers due to error');
      return phoneNumbersCache;
    }
    
    // If no cached numbers, return empty array or throw
    throw new Error('Failed to fetch Twilio phone numbers');
  }
}

/**
 * GET handler to return all phone numbers
 */
export async function GET() {
  try {
    const phoneNumbers = await fetchPhoneNumbers();
    
    return NextResponse.json({ 
      phoneNumbers,
      count: phoneNumbers.length
    });
  } catch (error) {
    console.error('Error in GET /api/twilio-numbers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}

/**
 * POST handler to get a random phone number from the pool
 */
export async function POST() {
  try {
    // Get phone numbers
    const phoneNumbers = await fetchPhoneNumbers();
    
    if (phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'No phone numbers available' },
        { status: 404 }
      );
    }
    
    // Select a random phone number from the pool
    const randomIndex = Math.floor(Math.random() * phoneNumbers.length);
    const selectedNumber = phoneNumbers[randomIndex];
    
    return NextResponse.json({ 
      phoneNumber: selectedNumber,
      totalNumbers: phoneNumbers.length
    });
  } catch (error) {
    console.error('Error in POST /api/twilio-numbers:', error);
    
    // Fallback to the default caller ID if available
    const fallbackNumber = process.env.TWILIO_CALLER_ID;
    if (fallbackNumber) {
      console.log('[twilio-numbers] Using fallback caller ID:', fallbackNumber);
      return NextResponse.json({ 
        phoneNumber: fallbackNumber,
        isFallback: true
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to select a phone number' },
      { status: 500 }
    );
  }
} 