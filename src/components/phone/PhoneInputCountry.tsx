import React from 'react';
import 'react-phone-number-input/style.css';
import PhoneInput, { Country } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';

interface PhoneInputCountryOnlyProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onCountryChange?: (country: Country | undefined) => void;
  className?: string;
  international?: boolean;
  countryCallingCodeEditable?: boolean;
  defaultCountry?: Country;
  inputClass?: string;
}

const PhoneInputCountry: React.FC<PhoneInputCountryOnlyProps> = ({
  value,
  onChange,
  onCountryChange,
  className = "",
  international = true,
  countryCallingCodeEditable = false,
  defaultCountry = "US",
  inputClass = ""
}) => {
  return (
    <div className={`country-selector-wrapper ${className}`}>
      <PhoneInput
        international={international}
        countryCallingCodeEditable={countryCallingCodeEditable}
        defaultCountry={defaultCountry}
        value={value}
        onChange={onChange}
        onCountryChange={onCountryChange}
        flags={flags}
        inputClass={inputClass}
        countrySelectProps={{
          arrowComponent: () => <span className="PhoneInputCountrySelectArrow" />,
          className: "country-select-dropdown w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        }}
      />
    </div>
  );
};

export default PhoneInputCountry; 