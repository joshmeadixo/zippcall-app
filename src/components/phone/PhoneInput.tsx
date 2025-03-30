import React, { useState, useEffect } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInputWithCountry from 'react-phone-number-input';
import { isPossiblePhoneNumber, parsePhoneNumber, CountryCode } from 'libphonenumber-js';
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

  // Update formatted value when external value changes
  useEffect(() => {
    setFormattedValue(value);
  }, [value]);

  // Handle phone input change
  const handleChange = (newValue: string | undefined) => {
    const e164Value = newValue || '';
    setFormattedValue(e164Value);

    // Check if the phone number is valid
    if (e164Value) {
      try {
        const isValid = isPossiblePhoneNumber(e164Value);
        setIsValid(isValid);
      } catch {
        setIsValid(false);
      }
    } else {
      // Empty is considered valid
      setIsValid(true);
    }

    // Always notify the parent component of changes
    onChange(e164Value);
  };

  // Get country code from phone number (for initial value)
  const getDefaultCountry = (): CountryCode | undefined => {
    if (!value) return undefined;
    try {
      const phoneNumber = parsePhoneNumber(value);
      return phoneNumber?.country as CountryCode || undefined;
    } catch {
      return undefined;
    }
  };

  return (
    <div className="phone-input-wrapper">
      <div className="bg-gray-100 rounded-lg p-2">
        <PhoneInputWithCountry
          international
          countryCallingCodeEditable={false}
          defaultCountry={getDefaultCountry() || 'US' as CountryCode}
          value={formattedValue}
          onChange={handleChange}
          placeholder={placeholder}
          onFocus={onFocus}
          addInternationalOption={false}
          limitMaxLength={true}
          flags={flags}
          className={`${isValid ? '' : 'border-red-500 border-2'} ${className}`}
          countrySelectProps={{
            arrowComponent: () => <span className="PhoneInputCountrySelectArrow" />
          }}
        />
      </div>
      {!isValid && formattedValue && (
        <p className="text-red-500 text-xs mt-1">
          Please enter a valid phone number
        </p>
      )}
    </div>
  );
};

export default PhoneInputWithFlag; 