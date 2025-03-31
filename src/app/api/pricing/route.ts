import { NextRequest, NextResponse } from 'next/server';
import { getPriceForPhoneNumber, calculateCallCost, getPricesForCountries } from '@/lib/pricing/pricing-engine';
import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * GET handler for retrieving price for a specific phone number
 * Query params:
 * - phoneNumber: E.164 formatted phone number to get pricing for
 * - duration: (optional) Call duration in seconds to calculate cost
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get('phoneNumber');
    const durationStr = searchParams.get('duration');
    
    // Validate phone number
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }
    
    // Parse the duration if provided
    let duration: number | undefined;
    if (durationStr) {
      duration = parseInt(durationStr, 10);
      if (isNaN(duration) || duration < 0) {
        return NextResponse.json(
          { error: 'Duration must be a non-negative number' },
          { status: 400 }
        );
      }
    }
    
    // Get pricing for the phone number
    const pricing = await getPriceForPhoneNumber(phoneNumber);
    
    if (!pricing) {
      return NextResponse.json(
        { error: 'Could not determine pricing for the given phone number' },
        { status: 404 }
      );
    }
    
    // If duration was provided, calculate cost
    if (duration !== undefined) {
      const cost = calculateCallCost(
        pricing.finalPrice, 
        duration, 
        pricing.billingIncrement
      );
      
      return NextResponse.json({
        ...pricing,
        calculatedCost: cost,
        duration
      });
    }
    
    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Error in pricing lookup:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve pricing' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for retrieving prices for multiple countries
 * Request body:
 * - countryCodes: Array of ISO country codes to get pricing for
 */
export async function POST(request: NextRequest) {
  try {
    const { countryCodes } = await request.json();
    
    if (!Array.isArray(countryCodes) || countryCodes.length === 0) {
      return NextResponse.json(
        { error: 'countryCodes must be a non-empty array' },
        { status: 400 }
      );
    }
    
    // Validate each country code is a string
    for (const code of countryCodes) {
      if (typeof code !== 'string' || code.length !== 2) {
        return NextResponse.json(
          { error: 'Each country code must be a 2-letter ISO code' },
          { status: 400 }
        );
      }
    }
    
    // Get pricing for all requested countries
    const pricing = await getPricesForCountries(countryCodes);
    
    return NextResponse.json({
      pricing,
      count: Object.keys(pricing).length
    });
  } catch (error) {
    console.error('Error in bulk pricing lookup:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve pricing' },
      { status: 500 }
    );
  }
} 