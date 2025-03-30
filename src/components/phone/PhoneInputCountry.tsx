import React, { useState } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInput, { Country, getCountryCallingCode } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import Image from 'next/image';

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

interface CountryOption {
  value: Country;
  label: string;
  icon: string;
}

interface CustomCountrySelectProps {
  value: Country;
  onChange: (value: Country) => void;
  options: CountryOption[];
}

// Component for custom country selector dropdown
const CustomCountrySelect: React.FC<CustomCountrySelectProps> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  const getCountryName = (countryCode: string): string => {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    try {
      return regionNames.of(countryCode) || countryCode;
    } catch {
      return countryCode;
    }
  };

  return (
    <div className="dropdown w-full">
      <label 
        tabIndex={0} 
        className="btn btn-ghost w-full justify-between bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          {selectedOption && (
            <>
              <div className="relative w-6 h-4 mr-3 overflow-hidden rounded-sm">
                <Image 
                  src={selectedOption.icon} 
                  alt={`${selectedOption.value} flag`}
                  width={24}
                  height={16}
                  className="object-cover"
                />
              </div>
              <span>{getCountryName(selectedOption.value)}</span>
              <span className="text-gray-400 ml-2">
                +{getCountryCallingCode(selectedOption.value)}
              </span>
            </>
          )}
        </div>
        <svg 
          className="h-5 w-5 text-gray-400" 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" 
            clipRule="evenodd" 
          />
        </svg>
      </label>
      
      {isOpen && (
        <ul 
          tabIndex={0} 
          className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto"
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <div className="relative w-6 h-4 mr-3 overflow-hidden rounded-sm">
                  <Image 
                    src={option.icon} 
                    alt={`${option.value} flag`}
                    width={24}
                    height={16}
                    className="object-cover"
                  />
                </div>
                <span>{getCountryName(option.value)}</span>
                <span className="text-gray-400 ml-2">
                  +{getCountryCallingCode(option.value)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

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
        countrySelectComponent={CustomCountrySelect}
      />
    </div>
  );
};

export default PhoneInputCountry; 