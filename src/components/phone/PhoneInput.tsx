import React, { useState, useEffect, useCallback } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInputWithCountry, { Country } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import { validatePhoneNumber, getValidationErrorMessage } from '@/utils/phoneValidation';

interface PhoneInputWithFlagProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onValidityChange?: (isValid: boolean, formattedNumber?: string) => void;
  onCountrySelect?: () => void;
}

const PhoneInputWithFlag: React.FC<PhoneInputWithFlagProps> = ({
  value,
  onChange,
  placeholder = "+1 (234) 567-8900",
  className = "",
  onFocus,
  onValidityChange,
  onCountrySelect
}) => {
  const [formattedValue, setFormattedValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>('US');

  // Validate the phone number - defined with useCallback before it's used
  const validateCurrentNumber = useCallback((phoneNumber: string, country: string) => {
    // Skip validation if:
    // 1. No phone number
    // 2. User hasn't typed anything yet
    // 3. The number just contains a + or country code (meaning user just selected a country)
    if (!phoneNumber || !userHasTyped || phoneNumber.trim().replace(/\+/g, '').length <= 2) {
      setIsValid(true);
      setErrorMessage('');
      return;
    }

    // Only validate if user has entered something substantial
    if (phoneNumber.trim().length > 2) {
      const validationResult = validatePhoneNumber(phoneNumber, country);
      const valid = validationResult.isValid;
      setIsValid(valid);
      
      // Set appropriate error message
      setErrorMessage(valid ? '' : getValidationErrorMessage(validationResult));
      
      // Notify parent component if needed
      if (onValidityChange) {
        onValidityChange(valid, validationResult.e164Number);
      }
    } else {
      setIsValid(true);
      setErrorMessage('');
    }
  }, [userHasTyped, onValidityChange]);

  // Update formatted value when external value changes
  useEffect(() => {
    setFormattedValue(value);
    validateCurrentNumber(value, selectedCountry as string);
  }, [value, selectedCountry, validateCurrentNumber]);

  // Handle phone input change
  const handleChange = (newValue: string | undefined) => {
    const inputValue = newValue || '';
    setFormattedValue(inputValue);
    
    // Set user has typed flag
    if (inputValue && inputValue.length > 0) {
      setUserHasTyped(true);
    } else {
      setUserHasTyped(false);
    }
    
    // Validate after user has typed
    if (userHasTyped) {
      validateCurrentNumber(inputValue, selectedCountry as string);
    }

    // Always notify parent of changes
    onChange(inputValue);
  };

  // Handle country change from dropdown
  const handleCountryChange = (country: Country | undefined) => {
    if (country) {
      setSelectedCountry(country);
      // Reset validation and user-typed state when country changes
      setIsValid(true);
      setErrorMessage('');
      // Only reset userHasTyped if the phone number is empty or just has the country code
      if (!formattedValue || formattedValue.replace(/\+/g, '').length <= 2) {
        setUserHasTyped(false);
      }
      
      // Notify parent component that a country has been selected
      if (onCountrySelect) {
        onCountrySelect();
      }
    }
  };

  // When component mounts, notify parent if US is pre-selected
  useEffect(() => {
    // Default country is already selected, so notify parent
    if (onCountrySelect) {
      onCountrySelect();
    }
  }, [onCountrySelect]); // Add onCountrySelect as a dependency

  return (
    <div className="phone-input-wrapper">
      <div className="bg-gray-100 rounded-lg p-2">
        <PhoneInputWithCountry
          international
          countryCallingCodeEditable={false}
          defaultCountry="US"
          country={selectedCountry}
          value={formattedValue}
          onChange={handleChange}
          onCountryChange={handleCountryChange}
          placeholder={placeholder}
          onFocus={onFocus}
          addInternationalOption={false}
          limitMaxLength={true}
          flags={flags}
          className={`${isValid || !userHasTyped ? '' : 'border-red-500 border-2'} ${className}`}
          countrySelectProps={{
            arrowComponent: () => <span className="PhoneInputCountrySelectArrow" />
          }}
          inputClassName="pr-8"
          inputProps={{
            id: "phone-input"
          }}
        />
      </div>
      {!isValid && userHasTyped && formattedValue && (
        <p className="text-red-500 text-xs mt-1">
          {errorMessage || 'Please enter a valid phone number'}
        </p>
      )}
    </div>
  );
};

export default PhoneInputWithFlag; 