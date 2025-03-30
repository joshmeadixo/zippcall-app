import React, { useState, useEffect, useCallback } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInputWithCountry, { Country, getCountryCallingCode, formatPhoneNumberIntl } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import { validatePhoneNumber, getValidationErrorMessage } from '@/utils/phoneValidation';

interface PhoneInputWithFlagProps {
  nationalNumber: string;
  onNationalNumberChange: (nationalNumber: string) => void;
  country: Country;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
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

  const countryCallingCode = getCountryCallingCode(country);
  const prefix = `+${countryCallingCode}`;

  useEffect(() => {
    setLocalNationalNumber(nationalNumber);
  }, [nationalNumber]);

  const validateCurrentNumber = useCallback((numberToCheck: string, countryCode: Country) => {
    if (!numberToCheck) {
        setIsValid(true);
        setErrorMessage('');
        if (onValidityChange) onValidityChange(true, undefined);
        return;
    }

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

  const handleChange = (newValue: string | undefined) => {
      const incomingValue = newValue || '';
      
      const nationalDigits = incomingValue.replace(/\D/g, ''); 

      if (nationalDigits !== localNationalNumber) { 
          setLocalNationalNumber(nationalDigits);
          onNationalNumberChange(nationalDigits);

          if (!userHasTyped && nationalDigits.length > 0) {
              setUserHasTyped(true);
          } else if (nationalDigits.length === 0) {
              setUserHasTyped(false);
          }
      }
  };

  const dynamicPlaceholder = formatPhoneNumberIntl(`+${countryCallingCode}##########`)
      ?.replace(prefix, '')
      .trim() || rawPlaceholder;

  return (
    <div className={`phone-input-wrapper ${className}`}>
      <div className={`flex items-center bg-gray-100 rounded-lg p-2 border ${isValid ? 'border-transparent' : 'border-red-500'} ${disabled ? 'opacity-50' : ''}`}>
        <span className="px-2 text-gray-600">{prefix}</span>

        <PhoneInputWithCountry
          country={country}
          value={localNationalNumber}
          onChange={handleChange}
          placeholder={dynamicPlaceholder}
          onFocus={onFocus}
          disabled={disabled}
          international={true}
          displayInitialValueAsLocalNumber={true}
          countryCallingCodeEditable={false}
          addInternationalOption={false}
          limitMaxLength={true}
          flags={flags}
          inputClassName={`flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none p-0 ${disabled ? "cursor-not-allowed text-gray-500" : ""}`}
          countrySelectComponent={() => null}
          className="flex-1"
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