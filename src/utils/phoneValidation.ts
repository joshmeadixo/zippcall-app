import * as googleLibphonenumber from 'google-libphonenumber';

// Create an instance of the PhoneNumberUtil
const phoneUtil = googleLibphonenumber.PhoneNumberUtil.getInstance();
const PNF = googleLibphonenumber.PhoneNumberFormat;

export enum PhoneNumberType {
  FIXED_LINE = 0,
  MOBILE = 1,
  FIXED_LINE_OR_MOBILE = 2,
  TOLL_FREE = 3,
  PREMIUM_RATE = 4,
  SHARED_COST = 5,
  VOIP = 6,
  PERSONAL_NUMBER = 7,
  PAGER = 8,
  UAN = 9,
  VOICEMAIL = 10,
  UNKNOWN = -1
}

export interface ValidationResult {
  isValid: boolean;
  e164Number?: string;
  nationalNumber?: string;
  numberType?: PhoneNumberType;
  formattedNumber?: string;
  reason?: string;
  error?: string;
}

/**
 * Validates a phone number using Google's libphonenumber library
 * @param input The phone number input (can be in any format)
 * @param countryCode The ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB')
 * @returns ValidationResult object with validation details
 */
export function validatePhoneNumber(input: string, countryCode: string): ValidationResult {
  // If input is completely empty, return immediately without error message
  if (!input || input.trim() === '') {
    return { isValid: false, reason: 'EMPTY_INPUT' };
  }

  // If input is just a + sign (country code prefix), don't validate yet
  if (input.trim() === '+' || input.trim().match(/^\+\d{0,2}$/)) {
    return { isValid: false, reason: 'INCOMPLETE_INPUT' };
  }

  try {
    // Ensure the input has a proper format with + for E.164
    let formattedInput = input;
    if (!formattedInput.startsWith('+')) {
      formattedInput = '+' + formattedInput;
    }

    // Parse the number with context of the user's selected country
    const parsedNumber = phoneUtil.parse(formattedInput, countryCode);
    
    // Check if the number is valid
    if (!phoneUtil.isValidNumber(parsedNumber)) {
      return { isValid: false, reason: 'INVALID_NUMBER' };
    }
    
    // Get the region code for the number
    const regionCode = phoneUtil.getRegionCodeForNumber(parsedNumber);
    
    // Check if the number matches the pattern for its claimed region
    // This helps catch cases like UK numbers with incorrect leading zeros
    if (regionCode && !phoneUtil.isValidNumberForRegion(parsedNumber, regionCode)) {
      return { isValid: false, reason: 'WRONG_REGION' };
    }
    
    // Get the properly formatted E.164 version
    const e164Number = phoneUtil.format(parsedNumber, PNF.E164);
    const formattedNumber = phoneUtil.format(parsedNumber, PNF.INTERNATIONAL);
    const nationalNumber = parsedNumber.getNationalNumber()?.toString() || '';
    const numberType = phoneUtil.getNumberType(parsedNumber);
    
    // Additional validation for minimal length (country specific)
    if (nationalNumber.length < 5) {
      return { isValid: false, reason: 'TOO_SHORT' };
    }
    
    return { 
      isValid: true, 
      e164Number,
      nationalNumber,
      formattedNumber,
      numberType
    };
  } catch (error) {
    console.error('Phone validation error:', error);
    return { 
      isValid: false, 
      reason: 'PARSE_ERROR', 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Gets the error message for a specific validation error
 * @param result The validation result
 * @returns A user-friendly error message
 */
export function getValidationErrorMessage(result: ValidationResult): string {
  if (result.isValid) return '';
  
  switch (result.reason) {
    case 'EMPTY_INPUT':
      return 'Please enter a phone number';
    case 'INCOMPLETE_INPUT':
      return 'Please enter a complete phone number';
    case 'TOO_SHORT':
      return 'This phone number is too short';
    case 'INVALID_NUMBER':
      return 'This phone number appears to be invalid';
    case 'WRONG_REGION':
      return 'This phone number format is incorrect for its region';
    case 'PARSE_ERROR':
      return 'Could not parse this phone number';
    default:
      return 'Invalid phone number';
  }
}

/**
 * Detects the country from an E.164 formatted phone number
 * @param e164Number The phone number in E.164 format (must start with +)
 * @returns The two-letter country code, or undefined if detection failed
 */
export function detectCountryFromE164(e164Number: string): string | undefined {
  if (!e164Number || !e164Number.startsWith('+')) {
    console.error('[detectCountryFromE164] Input must be in E.164 format starting with +');
    return undefined;
  }

  try {
    const parsedNumber = phoneUtil.parse(e164Number);
    const regionCode = phoneUtil.getRegionCodeForNumber(parsedNumber);
    
    if (!regionCode) {
      console.error('[detectCountryFromE164] Could not detect region for number:', e164Number);
      return undefined;
    }
    
    // Validate that the number is valid for the detected region
    if (!phoneUtil.isValidNumberForRegion(parsedNumber, regionCode)) {
      console.warn('[detectCountryFromE164] Number is not valid for the detected region:', regionCode);
    }
    
    console.log(`[detectCountryFromE164] Detected country ${regionCode} for number ${e164Number}`);
    return regionCode;
  } catch (error) {
    console.error('[detectCountryFromE164] Error parsing phone number:', error);
    return undefined;
  }
}

/**
 * Extracts the national number portion from an E.164 formatted phone number
 * @param e164Number The phone number in E.164 format (must start with +)
 * @returns The national number without country code, or undefined if extraction failed
 */
export function extractNationalNumber(e164Number: string): string | undefined {
  if (!e164Number || !e164Number.startsWith('+')) {
    console.error('[extractNationalNumber] Input must be in E.164 format starting with +');
    return undefined;
  }

  try {
    const parsedNumber = phoneUtil.parse(e164Number);
    const nationalNumber = parsedNumber.getNationalNumber()?.toString();
    
    if (!nationalNumber) {
      console.error('[extractNationalNumber] Could not extract national number from:', e164Number);
      return undefined;
    }
    
    console.log(`[extractNationalNumber] Extracted national number ${nationalNumber} from ${e164Number}`);
    return nationalNumber;
  } catch (error) {
    console.error('[extractNationalNumber] Error parsing phone number:', error);
    return undefined;
  }
} 