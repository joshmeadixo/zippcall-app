import { NextRequest, NextResponse } from 'next/server';
import { getCountryPricing } from '@/lib/pricing/pricing-db';
import { CountryPricingCache } from '@/types/pricing';

/**
 * GET handler for retrieving all country pricing data
 */
export async function GET(request: NextRequest) {
  // Define CORS headers - REPLACE '*' with your specific marketing domain
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://www.zappcall.com', // e.g., 'https://yourmarketing.site'
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS preflight request for CORS
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Fetch all pricing data from the cache/database
    const pricingCache: CountryPricingCache | null = await getCountryPricing();

    // Check if data was successfully fetched
    if (!pricingCache || !pricingCache.data || Object.keys(pricingCache.data).length === 0) {
      console.warn('No pricing data found in the cache/database.');
      return NextResponse.json(
        { error: 'No pricing data available.' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Return the dictionary of country prices
    // The structure will be { "US": { countryCode: "US", ... }, "GB": { ... } }
    return NextResponse.json(pricingCache.data, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching all pricing data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve pricing data.' },
      { status: 500, headers: corsHeaders }
    );
  }
} 