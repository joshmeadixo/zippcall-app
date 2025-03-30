import React, { useState } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInput, { Country, getCountryCallingCode } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';

// A simpler approach for country codes and names for the dropdown
const POPULAR_COUNTRIES: Country[] = ['US', 'GB', 'CA', 'AU', 'FR', 'DE', 'JP', 'IN', 'CN', 'BR', 'RU', 'MX', 'ES', 'IT'];

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
}

interface CustomSelectProps {
  value: Country;
  onChange: (value: Country) => void;
  options: CountryOption[];
}

// Component for custom country selector dropdown
const CustomCountrySelect: React.FC<CustomSelectProps> = ({ value, onChange, options }) => {
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

  // Use this function to get flag emoji
  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <div className="dropdown w-full relative">
      <label 
        tabIndex={0} 
        className="btn btn-ghost w-full justify-between bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          {selectedOption && (
            <>
              {/* Use flag emoji instead of component */}
              <div className="mr-3 text-xl">
                {getFlagEmoji(selectedOption.value)}
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
          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto flex-col absolute z-50"
          style={{ 
            maxWidth: '100%', 
            overflowX: 'hidden',
            width: '100%',
            left: '0',
            right: '0'
          }}
        >
          {/* First show popular countries */}
          {POPULAR_COUNTRIES.map((countryCode) => {
            const option = options.find((o) => o.value === countryCode);
            if (!option) return null;
            
            return (
              <li key={option.value} className="w-full">
                <button
                  type="button"
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {/* Use flag emoji */}
                  <div className="mr-3 text-xl">
                    {getFlagEmoji(option.value)}
                  </div>
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {getCountryName(option.value)}
                  </span>
                  <span className="text-gray-400 ml-2 flex-shrink-0">
                    +{getCountryCallingCode(option.value)}
                  </span>
                </button>
              </li>
            );
          })}
          
          <li className="menu-title">
            <span>All Countries</span>
          </li>
          
          {/* Then show all countries */}
          {options.map((option) => (
            <li key={option.value} className="w-full">
              <button
                type="button"
                className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {/* Use flag emoji */}
                <div className="mr-3 text-xl">
                  {getFlagEmoji(option.value)}
                </div>
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {getCountryName(option.value)}
                </span>
                <span className="text-gray-400 ml-2 flex-shrink-0">
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
      <div className="max-h-8">
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
    </div>
  );
};

export default PhoneInputCountry; 