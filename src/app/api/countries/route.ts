import { NextResponse } from 'next/server';

// Twilio API credentials - in production, use environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

// Define the Country type
type Country = {
  code: string;
  name: string;
  dial_code: string;
  flag: string;
};

// This will be our cache of countries to avoid hitting Twilio API on every request
let countriesCache: Country[] | null = null;

// Function to get flag emoji from country code
const getFlagEmoji = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Function to fetch countries from Twilio API
async function fetchTwilioCountries(): Promise<Country[]> {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not set. Cannot fetch countries.');
      return [];
    }

    // Create basic auth credentials
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    // Results array to store all countries
    let allCountries: any[] = [];
    let nextPageUrl: string | null = 'https://pricing.twilio.com/v2/Voice/Countries';
    
    // Fetch all pages
    while (nextPageUrl) {
      console.log(`Fetching countries from: ${nextPageUrl}`);
      
      // Fetch the current page
      const response: Response = await fetch(
        nextPageUrl,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch from Twilio:', await response.text());
        break;
      }

      const data: any = await response.json();
      
      // Log only the first page's first item for debugging
      if (nextPageUrl === 'https://pricing.twilio.com/v2/Voice/Countries') {
        console.log('Twilio API response first item:', data.countries?.[0]);
      }
      
      if (!data.countries || !Array.isArray(data.countries)) {
        console.error('Unexpected response format from Twilio API');
        break;
      }
      
      // Add countries from this page to our results
      allCountries = [...allCountries, ...data.countries];
      
      // Check if there's a next page
      nextPageUrl = data.meta?.next_page_url || null;
      
      // Log pagination progress
      console.log(`Retrieved ${data.countries.length} countries, total so far: ${allCountries.length}`);
    }
    
    if (allCountries.length === 0) {
      console.warn('No countries returned from Twilio API');
      return [];
    }
    
    // Map of country codes to dial codes for all countries
    const countryDialCodes: Record<string, string> = {
      'AD': '376', 'AE': '971', 'AF': '93', 'AG': '1268', 'AI': '1264', 'AL': '355', 'AM': '374',
      'AO': '244', 'AR': '54', 'AS': '1684', 'AT': '43', 'AU': '61', 'AW': '297', 'AX': '358',
      'AZ': '994', 'BA': '387', 'BB': '1246', 'BD': '880', 'BE': '32', 'BF': '226', 'BG': '359',
      'BH': '973', 'BI': '257', 'BJ': '229', 'BL': '590', 'BM': '1441', 'BN': '673', 'BO': '591',
      'BQ': '599', 'BR': '55', 'BS': '1242', 'BT': '975', 'BW': '267', 'BY': '375', 'BZ': '501',
      'CA': '1', 'CC': '61', 'CD': '243', 'CF': '236', 'CG': '242', 'CH': '41', 'CI': '225',
      'CK': '682', 'CL': '56', 'CM': '237', 'CN': '86', 'CO': '57', 'CR': '506', 'CU': '53',
      'CV': '238', 'CW': '599', 'CX': '61', 'CY': '357', 'CZ': '420', 'DE': '49', 'DJ': '253',
      'DK': '45', 'DM': '1767', 'DO': '1809', 'DZ': '213', 'EC': '593', 'EE': '372', 'EG': '20',
      'EH': '212', 'ER': '291', 'ES': '34', 'ET': '251', 'FI': '358', 'FJ': '679', 'FK': '500',
      'FM': '691', 'FO': '298', 'FR': '33', 'GA': '241', 'GB': '44', 'GD': '1473', 'GE': '995',
      'GF': '594', 'GG': '44', 'GH': '233', 'GI': '350', 'GL': '299', 'GM': '220', 'GN': '224',
      'GP': '590', 'GQ': '240', 'GR': '30', 'GT': '502', 'GU': '1671', 'GW': '245', 'GY': '592',
      'HK': '852', 'HN': '504', 'HR': '385', 'HT': '509', 'HU': '36', 'ID': '62', 'IE': '353',
      'IL': '972', 'IM': '44', 'IN': '91', 'IO': '246', 'IQ': '964', 'IR': '98', 'IS': '354',
      'IT': '39', 'JE': '44', 'JM': '1876', 'JO': '962', 'JP': '81', 'KE': '254', 'KG': '996',
      'KH': '855', 'KI': '686', 'KM': '269', 'KN': '1869', 'KP': '850', 'KR': '82', 'KW': '965',
      'KY': '1345', 'KZ': '7', 'LA': '856', 'LB': '961', 'LC': '1758', 'LI': '423', 'LK': '94',
      'LR': '231', 'LS': '266', 'LT': '370', 'LU': '352', 'LV': '371', 'LY': '218', 'MA': '212',
      'MC': '377', 'MD': '373', 'ME': '382', 'MF': '590', 'MG': '261', 'MH': '692', 'MK': '389',
      'ML': '223', 'MM': '95', 'MN': '976', 'MO': '853', 'MP': '1670', 'MQ': '596', 'MR': '222',
      'MS': '1664', 'MT': '356', 'MU': '230', 'MV': '960', 'MW': '265', 'MX': '52', 'MY': '60',
      'MZ': '258', 'NA': '264', 'NC': '687', 'NE': '227', 'NF': '672', 'NG': '234', 'NI': '505',
      'NL': '31', 'NO': '47', 'NP': '977', 'NR': '674', 'NU': '683', 'NZ': '64', 'OM': '968',
      'PA': '507', 'PE': '51', 'PF': '689', 'PG': '675', 'PH': '63', 'PK': '92', 'PL': '48',
      'PM': '508', 'PN': '64', 'PR': '1787', 'PS': '970', 'PT': '351', 'PW': '680', 'PY': '595',
      'QA': '974', 'RE': '262', 'RO': '40', 'RS': '381', 'RU': '7', 'RW': '250', 'SA': '966',
      'SB': '677', 'SC': '248', 'SD': '249', 'SE': '46', 'SG': '65', 'SH': '290', 'SI': '386',
      'SJ': '47', 'SK': '421', 'SL': '232', 'SM': '378', 'SN': '221', 'SO': '252', 'SR': '597',
      'SS': '211', 'ST': '239', 'SV': '503', 'SX': '1721', 'SY': '963', 'SZ': '268', 'TC': '1649',
      'TD': '235', 'TG': '228', 'TH': '66', 'TJ': '992', 'TK': '690', 'TL': '670', 'TM': '993',
      'TN': '216', 'TO': '676', 'TR': '90', 'TT': '1868', 'TV': '688', 'TW': '886', 'TZ': '255',
      'UA': '380', 'UG': '256', 'US': '1', 'UY': '598', 'UZ': '998', 'VA': '379', 'VC': '1784',
      'VE': '58', 'VG': '1284', 'VI': '1340', 'VN': '84', 'VU': '678', 'WF': '681', 'WS': '685',
      'XK': '383', 'YE': '967', 'YT': '262', 'ZA': '27', 'ZM': '260', 'ZW': '263'
    };
    
    // Process and sort the countries
    const countries = allCountries.map((country: any) => {
      // Use the iso_country directly from the Twilio API
      const code = country.iso_country || '';
      
      // Get the dial code from our mapping
      const dialCode = countryDialCodes[code] || '';
      
      return {
        code,
        name: country.country || '',
        dial_code: dialCode ? `+${dialCode}` : '',
        flag: code ? getFlagEmoji(code) : '🌍',
      };
    })
    .filter((country: Country) => country.code && country.dial_code) // Only include countries with code and dial code
    .sort((a: Country, b: Country) => a.name.localeCompare(b.name)); // Simple alphabetical sort
    
    console.log(`Processed ${countries.length} countries from Twilio API`);
    
    return countries;
  } catch (error) {
    console.error('Error fetching countries from Twilio:', error);
    return [];
  }
}

// The API route handler
export async function GET(request: Request) {
  try {
    // Check for refresh parameter
    const url = new URL(request.url);
    const shouldRefresh = url.searchParams.get('refresh') === 'true';
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    
    // Reset cache if refresh is requested
    if (shouldRefresh) {
      countriesCache = null;
      console.log('Refreshing countries cache');
    }
    
    // Use cache if available
    if (!countriesCache) {
      countriesCache = await fetchTwilioCountries();
      
      // Log the number of countries fetched
      console.log(`Returning ${countriesCache.length} countries`);
      
      // Ensure we have at least US in the list if it's empty
      if (countriesCache.length === 0) {
        console.warn('No countries returned from Twilio API, adding US as fallback');
        countriesCache = [
          { code: 'US', name: 'United States', dial_code: '+1', flag: '🇺🇸' }
        ];
      }
    }
    
    // Apply limit if specified
    const resultCountries = limit && limit > 0 ? countriesCache.slice(0, limit) : countriesCache;
    
    // Create response with a long cache time (24 hours)
    return NextResponse.json(
      resultCountries,
      {
        headers: {
          'Cache-Control': shouldRefresh ? 'no-cache' : 'max-age=86400',
        }
      }
    );
  } catch (error) {
    console.error('Error in countries API route:', error);
    // Reset cache to null so it will try again on next request
    countriesCache = null;
    return NextResponse.json(
      { error: 'Failed to fetch countries' },
      { status: 500 }
    );
  }
} 