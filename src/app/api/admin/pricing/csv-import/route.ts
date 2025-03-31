import { NextRequest, NextResponse } from 'next/server';
import { TwilioPriceData, CountryPricingCache } from '@/types/pricing';
import { saveCountryPricing } from '@/lib/pricing/pricing-db';

/**
 * POST handler for importing pricing data from a Twilio CSV file
 * This is a more accurate method than fetching from the Twilio API directly
 */
export async function POST(request: NextRequest) {
  try {
    // Basic authentication check
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Check against environment variable
    const adminSecret = process.env.ADMIN_API_SECRET;
    
    if (!adminSecret || token !== adminSecret) {
      return NextResponse.json(
        { error: 'Invalid token' }, 
        { status: 401 }
      );
    }
    
    // Get the CSV data from the request
    const formData = await request.formData();
    const csvFile = formData.get('csvFile') as File;
    
    if (!csvFile) {
      return NextResponse.json(
        { error: 'No CSV file provided' },
        { status: 400 }
      );
    }
    
    // Read the CSV file
    const csvText = await csvFile.text();
    const lines = csvText.split('\n');
    
    // Skip header row and parse data
    if (lines.length <= 1) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }
    
    // Expected Twilio Programmable Voice Outbound prices CSV format:
    // Contains columns like: ISO, Country, Description, Price / min, Origination Prefixes, Destination Prefixes
    
    // Parse header to figure out column positions
    const header = parseCSVLine(lines[0]);
    console.log('CSV Headers:', header);
    
    const isoIndex = findColumnIndex(header, ['iso']);
    const countryNameIndex = findColumnIndex(header, ['country']);
    const priceIndex = findColumnIndex(header, ['price / min', 'price/min', 'price per min', 'price']);
    
    if (countryNameIndex === -1 || priceIndex === -1) {
      return NextResponse.json(
        { 
          error: 'CSV file is missing required columns (country name and price per minute)',
          foundColumns: header
        },
        { status: 400 }
      );
    }
    
    // Process CSV data
    const allPricing: Record<string, TwilioPriceData> = {};
    const now = new Date();
    let successCount = 0;
    let errorCount = 0;
    
    // Keep track of countries we've processed
    const processedCountries = new Map<string, number>();
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      try {
        const values = parseCSVLine(lines[i]);
        
        // Skip rows with not enough columns
        if (values.length < Math.max(countryNameIndex, priceIndex) + 1) {
          console.error(`Line ${i + 1}: Not enough columns`);
          errorCount++;
          continue;
        }
        
        const countryName = values[countryNameIndex].replace(/"/g, '').trim();
        
        // Skip if country name is missing or is a header
        if (!countryName || countryName.toLowerCase() === 'country') {
          continue;
        }
        
        // Get the country code either from ISO column or extract from country name
        let countryCode = "";
        if (isoIndex !== -1 && values.length > isoIndex) {
          countryCode = values[isoIndex].replace(/"/g, '').trim();
        }
        
        // If ISO column is empty, try to extract from country name
        if (!countryCode || countryCode.length !== 2) {
          countryCode = extractCountryCode(countryName);
        }
        
        if (!countryCode) {
          console.error(`Line ${i + 1}: Could not determine country code for ${countryName}`);
          errorCount++;
          continue;
        }
        
        const priceStr = values[priceIndex].replace(/"/g, '').trim();
        
        // Skip rows without price
        if (!priceStr) {
          console.error(`Line ${i + 1}: Missing price for ${countryName}`);
          errorCount++;
          continue;
        }
        
        // Parse price - handle different formats (e.g., 0.0112, $0.0112, etc.)
        const basePrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
        
        if (isNaN(basePrice)) {
          console.error(`Line ${i + 1}: Invalid price format "${priceStr}" for ${countryName}`);
          errorCount++;
          continue;
        }
        
        // For each country, we want to use the lowest rate
        // Only add this country if we haven't processed it yet or if this rate is lower
        if (!processedCountries.has(countryCode) || 
            processedCountries.get(countryCode)! > basePrice) {
          
          allPricing[countryCode] = {
            countryCode,
            countryName,
            basePrice,
            currency: 'USD',  // Twilio's international rate sheet is typically in USD
            lastUpdated: now
          };
          
          // Store the price for future comparison
          processedCountries.set(countryCode, basePrice);
          
          if (!allPricing[countryCode]) {
            successCount++;
          }
        }
      } catch (error) {
        console.error(`Error parsing line ${i + 1}:`, error);
        errorCount++;
      }
    }
    
    // Check if we have any valid pricing data
    if (Object.keys(allPricing).length === 0) {
      return NextResponse.json(
        { error: 'No valid pricing data found in the CSV file' },
        { status: 400 }
      );
    }
    
    // Create the pricing cache object
    const pricingCache: CountryPricingCache = {
      version: 1,
      lastUpdated: now,
      data: allPricing
    };
    
    // Save to Firestore
    try {
      console.log('Trying to save pricing data from CSV import...');
      const success = await saveCountryPricing(pricingCache);
      
      if (success) {
        console.log('Successfully saved pricing data from CSV import');
        
        return NextResponse.json({
          success: true,
          message: 'Pricing data imported and saved successfully',
          count: Object.keys(allPricing).length,
          successCount,
          errorCount,
          timestamp: now.toISOString()
        });
      } else {
        throw new Error('Failed to save pricing data');
      }
    } catch (saveError) {
      console.error('Error saving to Firestore:', saveError);
      
      // If saving fails, return the data directly
      return NextResponse.json({
        success: true,
        message: 'Pricing data imported but could not be saved to Firestore',
        count: Object.keys(allPricing).length,
        successCount,
        errorCount,
        timestamp: now.toISOString(),
        data: pricingCache,
        saveError: saveError instanceof Error ? saveError.message : String(saveError)
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error processing CSV import:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `CSV import error: ${errorMessage}`
      }, 
      { status: 500 }
    );
  }
}

/**
 * Helper function to find the index of a column by its name
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => 
      h.toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Parse a CSV line correctly handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let currentValue = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // Don't forget the last value
  result.push(currentValue);
  
  return result;
}

/**
 * Extract country code from country name
 */
function extractCountryCode(countryName: string): string {
  // Common country codes mapping
  const countryMap: Record<string, string> = {
    'united states': 'US',
    'united kingdom': 'GB',
    'canada': 'CA',
    'australia': 'AU',
    'germany': 'DE',
    'france': 'FR',
    'spain': 'ES',
    'italy': 'IT',
    'japan': 'JP',
    'china': 'CN',
    'brazil': 'BR',
    'india': 'IN',
    'mexico': 'MX',
    'russia': 'RU',
    'south korea': 'KR',
    'netherlands': 'NL',
    'switzerland': 'CH',
    'sweden': 'SE',
    'norway': 'NO',
    'denmark': 'DK',
    'finland': 'FI',
    'ireland': 'IE',
    'belgium': 'BE',
    'austria': 'AT',
    'portugal': 'PT',
    'greece': 'GR',
    'new zealand': 'NZ',
    'singapore': 'SG',
    'hong kong': 'HK',
    'south africa': 'ZA',
    'israel': 'IL',
    'poland': 'PL',
    'turkey': 'TR',
    'argentina': 'AR',
    'chile': 'CL',
    'colombia': 'CO',
    'peru': 'PE',
    'venezuela': 'VE',
    'thailand': 'TH',
    'malaysia': 'MY',
    'philippines': 'PH',
    'indonesia': 'ID',
    'vietnam': 'VN',
    'pakistan': 'PK',
    'bangladesh': 'BD',
    'sri lanka': 'LK',
    'nepal': 'NP',
    'egypt': 'EG',
    'nigeria': 'NG',
    'kenya': 'KE',
    'ghana': 'GH',
    'morocco': 'MA',
    'algeria': 'DZ',
    'tunisia': 'TN',
    'saudi arabia': 'SA',
    'united arab emirates': 'AE',
    'jordan': 'JO',
    'lebanon': 'LB',
    'qatar': 'QA',
    'kuwait': 'KW',
    'oman': 'OM',
    'bahrain': 'BH',
    'iran': 'IR',
    'ukraine': 'UA',
    'czech republic': 'CZ',
    'romania': 'RO',
    'hungary': 'HU',
    'bulgaria': 'BG',
    'slovakia': 'SK',
    'croatia': 'HR',
    'slovenia': 'SI',
    'serbia': 'RS',
    'bosnia': 'BA',
    'albania': 'AL',
    'lithuania': 'LT',
    'latvia': 'LV',
    'estonia': 'EE',
    'malta': 'MT',
    'cyprus': 'CY',
    'iceland': 'IS',
    'luxembourg': 'LU',
    'monaco': 'MC',
    'andorra': 'AD',
    'liechtenstein': 'LI',
    'san marino': 'SM',
    'vatican city': 'VA',
    'gibraltar': 'GI',
  };
  
  // Try direct lookup in our mapping
  const normalizedName = countryName.toLowerCase().trim();
  
  // Check for exact match first
  if (countryMap[normalizedName]) {
    return countryMap[normalizedName];
  }
  
  // Check for partial matches
  for (const [key, code] of Object.entries(countryMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return code;
    }
  }
  
  // Look for country code in parentheses - common format in some CSVs
  const codeMatch = countryName.match(/\(([A-Z]{2})\)/);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1];
  }
  
  return '';
} 