import React, { useState, useEffect, useCallback } from 'react';
import 'react-phone-number-input/style.css';
import { Country, getCountryCallingCode, formatPhoneNumberIntl } from 'react-phone-number-input';
import { validatePhoneNumber, getValidationErrorMessage } from '@/utils/phoneValidation';

interface PhoneInputWithFlagProps {
  nationalNumber: string;
  onNationalNumberChange: (nationalNumber: string) => void;
  country?: Country;
  placeholder?: string;
  className?: string;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onValidityChange?: (isValid: boolean, e164Number?: string) => void;
  disabled?: boolean;
}

const PhoneInputWithFlag: React.FC<PhoneInputWithFlagProps> = ({
  nationalNumber,
  onNationalNumberChange,
  country,
  placeholder: rawPlaceholder = "Enter phone number",
  className = "",
  onFocus,
  onValidityChange,
  disabled = false
}) => {
  const [localNationalNumber, setLocalNationalNumber] = useState(nationalNumber);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userHasTyped, setUserHasTyped] = useState(!!nationalNumber);

  const countryCallingCode = country ? getCountryCallingCode(country) : '';
  const prefix = countryCallingCode ? `+${countryCallingCode}` : '';

  useEffect(() => {
    setLocalNationalNumber(nationalNumber);
  }, [nationalNumber]);

  const validateCurrentNumber = useCallback((numberToCheck: string, countryCode?: Country) => {
    if (!countryCode) {
      setIsValid(false);
      setErrorMessage('Please select a country');
      if (onValidityChange) onValidityChange(false, undefined);
      return;
    }

    const MIN_NATIONAL_DIGITS_FOR_VALIDATION = 3; // Minimum digits before showing errors

    // If national number is empty or too short, consider valid for now (no error shown)
    if (!numberToCheck || numberToCheck.length < MIN_NATIONAL_DIGITS_FOR_VALIDATION) { 
        setIsValid(true);
        setErrorMessage('');
        if (onValidityChange) onValidityChange(true, undefined); // Report as potentially valid (incomplete)
        return;
    }

    // Construct full number and perform validation (only if enough digits)
    const fullNumber = `+${getCountryCallingCode(countryCode)}${numberToCheck}`;
    const validationResult = validatePhoneNumber(fullNumber, countryCode);
    const valid = validationResult.isValid;

    setIsValid(valid);
    setErrorMessage(valid ? '' : getValidationErrorMessage(validationResult));
    if (onValidityChange) {
      onValidityChange(valid, validationResult.e164Number);
    }
  }, [onValidityChange]);

  useEffect(() => {
     if (userHasTyped || nationalNumber) {
        validateCurrentNumber(localNationalNumber, country);
     } else {
        setIsValid(true);
        setErrorMessage('');
        if (onValidityChange) onValidityChange(true, undefined);
     }
  }, [localNationalNumber, country, validateCurrentNumber, userHasTyped, nationalNumber, onValidityChange]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      console.log('[PhoneInputWithFlag] Standard input onChange event value:', event.target.value);
      const incomingValue = event.target.value || '';
      
      const nationalDigits = incomingValue.replace(/\D/g, ''); 
      console.log('[PhoneInputWithFlag] Extracted nationalDigits:', nationalDigits);

      if (nationalDigits !== localNationalNumber) { 
          console.log('[PhoneInputWithFlag] Updating state with:', nationalDigits);
          setLocalNationalNumber(nationalDigits);
          onNationalNumberChange(nationalDigits);

          if (!userHasTyped && nationalDigits.length > 0) {
              setUserHasTyped(true);
          } else if (nationalDigits.length === 0) {
              setUserHasTyped(false);
          }
      } else {
          console.log('[PhoneInputWithFlag] Not updating state, digits same:', nationalDigits);
      }
  };

  const dynamicPlaceholder = prefix ? (
    formatPhoneNumberIntl(`+${countryCallingCode}##########`)
      ?.replace(prefix, '')
      .trim() || rawPlaceholder
  ) : rawPlaceholder;

  return (
    <div className={`phone-input-wrapper ${className}`}>
      <div className={`flex items-center bg-gray-100 rounded-lg p-2 border ${isValid ? 'border-transparent' : 'border-red-500'} ${disabled ? 'opacity-50' : ''}`}>
        <span className="px-2 text-gray-600 flex-shrink-0">{prefix || 'Select country →'}</span>

        <input
          type="tel"
          id="phone-input"
          value={localNationalNumber}
          onChange={handleChange}
          onFocus={onFocus}
          placeholder={dynamicPlaceholder}
          disabled={disabled}
          className={`flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none py-1 ${disabled ? "cursor-not-allowed text-gray-500" : ""}`}
          autoComplete="tel-national"
        />
      </div>
      {!isValid && (localNationalNumber || userHasTyped) && (
        <p className="text-red-500 text-xs mt-1">
          {errorMessage || 'Invalid phone number'}
        </p>
      )}
    </div>
  );
};

export default PhoneInputWithFlag; 