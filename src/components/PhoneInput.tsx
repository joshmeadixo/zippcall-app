import React, { useState, useEffect, useRef } from 'react';

// Define common country codes that should be prioritized
const PRIORITY_COUNTRIES = {
  '+1': 'US',  // Prefer US over Canada for +1
  '+44': 'GB', // Prefer UK over other +44 territories
  '+61': 'AU', // Prefer Australia over other territories
  '+7': 'RU',  // Prefer Russia over Kazakhstan
  '+86': 'CN', // China
  '+91': 'IN', // India
  '+49': 'DE', // Germany
  '+33': 'FR', // France
  '+39': 'IT', // Italy
  '+34': 'ES', // Spain
  '+81': 'JP', // Japan
  '+52': 'MX', // Mexico
  '+55': 'BR', // Brazil
};

// Define the Country type
export type Country = {
  code: string;
  name: string;
  dial_code: string;
  flag: string;
};

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  onCountryChange?: (country: Country) => void;
  selectedCountry: Country;
  className?: string;
};

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  onCountryChange,
  selectedCountry,
  className = '',
}) => {
  const [countries, setCountries] = useState<Country[]>([selectedCountry]);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowCountrySelector(false);
      }
    };

    if (showCountrySelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCountrySelector]);

  // Fetch countries from our API
  const fetchCountries = async (forceRefresh = false) => {
    try {
      setIsLoadingCountries(true);
      setFetchError(false);
      const url = forceRefresh 
        ? '/api/countries?refresh=true' 
        : '/api/countries';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setCountries(data);
          
          // If the current selected country is not in the list, update to the first one
          if (!data.some(c => c.code === selectedCountry.code)) {
            if (onCountryChange) {
              onCountryChange(data[0]);
            }
          }
        } else {
          setFetchError(true);
        }
      } else {
        setFetchError(true);
      }
    } catch (error) {
      console.error('Error fetching countries:', error);
      setFetchError(true);
    } finally {
      setIsLoadingCountries(false);
    }
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  // Format phone number based on country
  const formatPhoneNumber = (number: string, country: Country): string => {
    // If the number is empty, return it
    if (!number) return '';
    
    // Check if number already has a + prefix
    if (number.startsWith('+')) {
      // For numbers with country code, just group digits
      const cleaned = number.replace(/[^\d+]/g, '');
      if (cleaned.length > 6) {
        const groups = [];
        // Skip the + for grouping
        for (let i = 1; i < cleaned.length; i += 3) {
          groups.push(cleaned.substring(i, Math.min(i + 3, cleaned.length)));
        }
        return '+' + groups.join(' ');
      }
      return cleaned;
    }
    
    // Remove any non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, '');
    
    // Country-specific formatting based on E.164 standards
    switch(country.code) {
      case 'US':
      case 'CA':
        // Format for US/Canada: (XXX) XXX-XXXX
        if (cleaned.length > 10) {
          cleaned = cleaned.slice(cleaned.length - 10);
        }
        if (cleaned.length === 10) {
          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length > 6) {
          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length > 3) {
          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
        }
        break;
      
      case 'GB':
        // Format for UK numbers
        if (cleaned.length === 11 && cleaned.startsWith('0')) {
          return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
        }
        break;
      
      case 'AU':
        // Format for Australian numbers
        if (cleaned.length === 10 && cleaned.startsWith('0')) {
          return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
        }
        break;
      
      case 'DE':
        // Format for German numbers
        if (cleaned.length > 10) {
          return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
        }
        break;
      
      case 'FR':
      case 'IT':
      case 'ES':
        // Format for European numbers (groups of 2)
        if (cleaned.length >= 10) {
          return cleaned.match(/.{1,2}/g)?.join(' ') || cleaned;
        }
        break;
      
      case 'JP':
      case 'CN':
        // Format for Asian countries
        if (cleaned.length >= 10) {
          return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        break;
      
      case 'IN':
        // Format for India
        if (cleaned.length === 10) {
          return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
        }
        break;
      
      // Add more country-specific formatting as needed
    }
    
    // Default formatting for other countries: groups of 3
    if (cleaned.length > 6) {
      const groups = [];
      for (let i = 0; i < cleaned.length; i += 3) {
        groups.push(cleaned.substring(i, Math.min(i + 3, cleaned.length)));
      }
      return groups.join(' ');
    }
    
    // Return as is for short numbers
    return cleaned;
  };

  // Detect country code from pasted number
  const detectCountryFromNumber = (number: string) => {
    // Remove spaces, dashes, parentheses
    const cleaned = number.replace(/[\s\-\(\)]/g, '');
    
    // Check if the number starts with a +
    if (cleaned.startsWith('+')) {
      // First try to find a priority country match
      for (const [dialCode, countryCode] of Object.entries(PRIORITY_COUNTRIES)) {
        if (cleaned.startsWith(dialCode)) {
          const priorityCountry = countries.find(c => c.code === countryCode);
          if (priorityCountry) {
            return {
              country: priorityCountry,
              number: cleaned.substring(dialCode.length)
            };
          }
        }
      }
      
      // If no priority match, try to find the country by dial code, checking from longest to shortest
      for (let i = 5; i >= 1; i--) {
        // Skip if the number is shorter than the current length + 1
        if (cleaned.length < i + 1) continue;
        
        // Check dial codes from longest to shortest
        const dialCode = cleaned.substring(0, i + 1); // +1 to include the +
        const country = countries.find(c => c.dial_code === dialCode);
        if (country) {
          // Found a matching country
          return {
            country,
            number: cleaned.substring(dialCode.length)
          };
        }
      }
    }
    
    // If no country code detected, return the current country and the full number
    return {
      country: selectedCountry,
      number: cleaned
    };
  };

  // Handle pasting of phone number
  const handlePhonePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    if (pastedText) {
      const { country, number } = detectCountryFromNumber(pastedText);
      if (onCountryChange) {
        onCountryChange(country);
      }
      // Use the extracted local number (without the country code prefix)
      onChange(number);
    }
  };

  // Handle manual input
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits and + symbol at the beginning
    const value = e.target.value;
    let inputValue = '';
    
    if (value.startsWith('+')) {
      // Keep the + and remove non-digits from the rest
      inputValue = '+' + value.substring(1).replace(/[^\d]/g, '');
      
      // Try to detect country from the entered number
      if (inputValue.length > 1) {
        const { country, number } = detectCountryFromNumber(inputValue);
        if (country && country.code !== selectedCountry.code && onCountryChange) {
          onCountryChange(country);
          // Replace the input with just the local number part
          onChange(number);
          return; // Exit early since we've handled the input
        } else if (country.code === selectedCountry.code) {
          // Do nothing, we already have the right country
        } else if (onCountryChange && selectedCountry.code !== 'NONE') {
          // If we can't determine the country yet but have +, show "No Region"
          onCountryChange({
            code: 'NONE',
            name: 'No Region',
            dial_code: '+',
            flag: '🌍'
          });
        }
      } else if (inputValue === '+' && onCountryChange && selectedCountry.code !== 'NONE') {
        // If only + is entered, show "No Region"
        onCountryChange({
          code: 'NONE',
          name: 'No Region',
          dial_code: '+',
          flag: '🌍'
        });
      }
    } else {
      // Remove any non-digit characters
      inputValue = value.replace(/[^\d]/g, '');
    }
    
    onChange(inputValue);
  };

  // Filter countries based on search term
  const getFilteredCountries = () => {
    if (!searchTerm) return countries;
    
    const searchTermLower = searchTerm.toLowerCase();
    
    // Simple filter for matching countries
    return countries.filter(country => 
      country.name.toLowerCase().includes(searchTermLower) ||
      country.dial_code.includes(searchTerm) ||
      country.code.toLowerCase() === searchTermLower
    );
  };

  const filteredCountries = getFilteredCountries();

  // Format the displayed phone number
  const displayedPhoneNumber = formatPhoneNumber(value, selectedCountry);

  return (
    <div className={`flex ${className}`}>
      <div className="relative">
        <button
          type="button"
          ref={buttonRef}
          onClick={() => setShowCountrySelector(!showCountrySelector)}
          className="bg-white h-14 rounded-l-lg border border-gray-200 px-3 flex items-center gap-1 shadow-sm"
        >
          <span className="text-lg">{selectedCountry.flag}</span>
          <span className="text-zippcall-blue font-medium">{selectedCountry.dial_code}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        
        {showCountrySelector && (
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg z-10"
          >
            <div className="p-2">
              <input
                type="text"
                placeholder="Search countries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-sm input-bordered w-full mb-2"
              />
            </div>
            {isLoadingCountries ? (
              <div className="p-4 text-center">
                <span className="loading loading-spinner loading-sm"></span>
                <span className="ml-2">Loading countries...</span>
              </div>
            ) : fetchError ? (
              <div className="p-4 text-center">
                <p className="text-red-500 mb-2">Failed to load countries</p>
                <button 
                  onClick={() => fetchCountries(true)}
                  className="btn btn-sm btn-outline btn-error"
                >
                  Retry
                </button>
              </div>
            ) : (
              <ul className="py-1">
                {filteredCountries.map((country, index) => {
                  return (
                    <li 
                      className={`px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center`}
                      key={country.code}
                      onClick={() => {
                        if (onCountryChange) {
                          onCountryChange(country);
                        }
                        setShowCountrySelector(false);
                        setSearchTerm('');
                      }}
                    >
                      <span className="text-lg mr-2">{country.flag}</span>
                      <span>{country.name}</span>
                      <span className="ml-auto text-gray-500">{country.dial_code}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-r-lg p-3 border border-gray-200 border-l-0 flex-1 shadow-inner relative">
        <input
          type="text"
          value={displayedPhoneNumber}
          onChange={handlePhoneInput}
          onPaste={handlePhonePaste}
          placeholder="Phone number"
          className="w-full text-2xl text-center font-mono h-8 focus:outline-none bg-transparent"
        />
      </div>
    </div>
  );
};

export default PhoneInput; 