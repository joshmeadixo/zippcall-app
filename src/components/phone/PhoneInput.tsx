import React, { useState, useEffect } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInputWithCountry, { Country } from 'react-phone-number-input';
import { isPossiblePhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import flags from 'react-phone-number-input/flags';

interface PhoneInputWithFlagProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

const PhoneInputWithFlag: React.FC<PhoneInputWithFlagProps> = ({
  value,
  onChange,
  placeholder = "+1 (234) 567-8900",
  className = "",
  onFocus
}) => {
  const [formattedValue, setFormattedValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>('US');

  // Update formatted value when external value changes
  useEffect(() => {
    setFormattedValue(value);
    
    if (value) {
      try {
        const parsedNumber = parsePhoneNumber(value);
        if (parsedNumber?.country) {
          setSelectedCountry(parsedNumber.country);
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }, [value]);

  // Handle phone input change
  const handleChange = (newValue: string | undefined) => {
    const e164Value = newValue || '';
    setFormattedValue(e164Value);
    
    // Check if user has entered digits beyond country code
    if (e164Value) {
      try {
        const parsedNumber = parsePhoneNumber(e164Value);
        
        if (parsedNumber?.nationalNumber) {
          const nationalLength = parsedNumber.nationalNumber.toString().length;
          
          // Only consider as typed if they've entered some digits
          if (nationalLength > 0) {
            setUserHasTyped(true);
          }
          
          // Only validate if they've entered enough digits
          if (userHasTyped && nationalLength >= 3) {
            const isValid = isPossiblePhoneNumber(e164Value);
            setIsValid(isValid);
          } else {
            setIsValid(true);
          }
        }
      } catch {
        // Do not show validation errors while typing
        setIsValid(true);
      }
    } else {
      // Empty input is valid
      setIsValid(true);
      setUserHasTyped(false);
    }

    // Always notify parent of changes
    onChange(e164Value);
  };

  // Handle country change from dropdown
  const handleCountryChange = (country: Country | undefined) => {
    if (country) {
      setSelectedCountry(country);
      // Reset validation when country changes
      setIsValid(true);
      setUserHasTyped(false);
    }
  };

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
        />
      </div>
      {!isValid && userHasTyped && formattedValue && (
        <p className="text-red-500 text-xs mt-1">
          Please enter a valid phone number
        </p>
      )}
    </div>
  );
};

export default PhoneInputWithFlag; 