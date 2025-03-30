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
  if (!input || input.trim() === '') {
    return { isValid: false, reason: 'EMPTY_INPUT' };
  }

  try {
    // Parse the number with context of the user's selected country
    const parsedNumber = phoneUtil.parse(input, countryCode);
    
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
    
    return { 
      isValid: true, 
      e164Number,
      nationalNumber,
      formattedNumber,
      numberType
    };
  } catch (error) {
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