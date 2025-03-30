import React, { useState, useRef, useEffect } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInput, { Country, getCountryCallingCode } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import allCountries from 'react-phone-number-input/locale/en.json';

interface PhoneInputCountryOnlyProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onCountryChange?: (country: Country | undefined) => void;
  className?: string;
  international?: boolean;
  countryCallingCodeEditable?: boolean;
  defaultCountry?: Country;
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
  const [searchTerm, setSearchTerm] = useState(''); // State for search input
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the dropdown container

  const getCountryName = (countryCode: string): string => {
    const countryName = allCountries[countryCode as keyof typeof allCountries];
    if (countryName) return countryName;
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    try { return regionNames.of(countryCode) || countryCode; } catch { return countryCode; }
  };

  const getFlagEmoji = (countryCode: string): string => {
    try {
        if (!countryCode || countryCode.length !== 2) return '❓'; 
        const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    } catch { return '❓'; }
  };

  // --- Use options prop directly and sort alphabetically --- 
  const sortedOptions = [...options] 
    .filter(option => option.value) 
    .sort((a, b) => {
      const nameA = getCountryName(a.value);
      const nameB = getCountryName(b.value);
      return nameA.localeCompare(nameB);
    });
  // --- End of sorting logic ---

  // --- Filter options based on search term --- 
  const filteredOptions = sortedOptions.filter(option => {
    const countryName = getCountryName(option.value).toLowerCase();
    return countryName.includes(searchTerm.toLowerCase());
  });
  // --- End of filtering logic ---

  // Find selected option
  const selectedOption = value && options.find((option) => option.value === value);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // --- Add useEffect for outside click detection --- 
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(''); // Also clear search term on outside click
      }
    };

    // Add listener if dropdown is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      // Remove listener if dropdown is closed
      document.removeEventListener('mousedown', handleClickOutside);
    }

    // Cleanup listener on component unmount or when isOpen changes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]); // Dependency array includes isOpen
  // --- End of useEffect --- 

  return (
    <div className="dropdown w-full relative" ref={dropdownRef}>
      <label 
        tabIndex={0} 
        className="btn btn-ghost w-full justify-between bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Ensure selectedOption and its value are valid */}
        {selectedOption && selectedOption.value ? (
          <div className="flex items-center">
            <div className="mr-3 text-xl">
              {getFlagEmoji(selectedOption.value)}
            </div>
            <span>{selectedOption.label}</span>
            <span className="text-gray-400 ml-2">
              +{getCountryCallingCode(selectedOption.value)}
            </span>
          </div>
        ) : (
          <div className="flex items-center text-gray-500">
            <span>Select Country</span>
          </div>
        )}
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
        <div 
          className="dropdown-content-container absolute left-0 right-0 z-50"
          style={{ maxWidth: '100%', width: '100%' }}
        >
          {/* Search Input */} 
          <div className="p-2 sticky top-0 bg-white z-10">
            <input
              type="text"
              placeholder="Search country..."
              className="input input-bordered input-sm w-full"
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()} // Prevent closing dropdown when clicking input
              autoFocus
            />
          </div>
          
          <ul 
            tabIndex={0} 
            className="menu p-2 pt-0 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto flex-col"
            style={{ maxWidth: '100%', overflowX: 'hidden', width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderTop: 'none' }}
          >
            {/* Show filtered countries */} 
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                // --- Add check for valid option --- 
                if (!option || !option.value) return null;
                let callingCode;
                try { callingCode = getCountryCallingCode(option.value); } catch { return null; } 
                if (typeof callingCode === 'undefined') return null;
                // --- End check ---
                return (
                  <li key={option.value} className="w-full">
                    <button
                      type="button"
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                      onClick={() => { 
                          onChange(option.value); 
                          setIsOpen(false); 
                          setSearchTerm(''); // Clear search on selection
                      }}
                    >
                      <div className="mr-3 text-xl">{getFlagEmoji(option.value)}</div>
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{option.label}</span>
                      <span className="text-gray-400 ml-2 flex-shrink-0">+{callingCode}</span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="p-4 text-center text-sm text-gray-500">No countries found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// --- Update PhoneInputCountry ---
const PhoneInputCountry: React.FC<PhoneInputCountryOnlyProps> = ({
  value,
  onChange,
  onCountryChange,
  className = "", // This applies to the country-selector-wrapper
  international = true,
  countryCallingCodeEditable = false,
  defaultCountry = "US",
}) => {
  return (
    <div 
      className={`country-selector-wrapper ${className}`} 
    >
      <div> {/* Removed inline styles */} 
        <PhoneInput
          international={international}
          countryCallingCodeEditable={countryCallingCodeEditable}
          defaultCountry={defaultCountry}
          value={value}
          onChange={onChange}
          onCountryChange={onCountryChange}
          flags={flags}
          countrySelectComponent={CustomCountrySelect}
        />
      </div>
    </div>
  );
};

export default PhoneInputCountry; 