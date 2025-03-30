import React, { useCallback, useEffect } from 'react';
import { BackspaceIcon } from '@heroicons/react/24/solid';

interface DialPadProps {
  onDigitPressed: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const DialPad = ({ onDigitPressed, onBackspace, disabled = false }: DialPadProps) => {
  const dialPadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];
  
  // Handle key presses for digits
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return;
    
    const key = e.key;
    if (/^[0-9*#]$/.test(key)) {
      onDigitPressed(key);
    } else if (key === 'Backspace') {
      onBackspace();
    }
  }, [onDigitPressed, onBackspace, disabled]);

  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleDigitClick = (digit: string) => {
    if (disabled) return;
    console.log(`[DialPad] Button pressed: ${digit}`);
    onDigitPressed(digit);
  };

  return (
    <div className="select-none mx-auto max-w-xs">
      <div className="grid grid-cols-3 gap-3">
        {dialPadKeys.map((row, rowIndex) => (
          <React.Fragment key={`row-${rowIndex}`}>
            {row.map((digit) => (
              <button
                key={digit}
                className={`rounded-full h-16 w-16 flex items-center justify-center text-xl font-medium 
                  ${disabled 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300'
                  } transition-colors`}
                onClick={() => handleDigitClick(digit)}
                disabled={disabled}
                aria-label={`Dial ${digit}`}
              >
                <span>{digit}</span>
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
      
      <div className="mt-4 flex justify-center">
        <button
          className={`rounded-full h-16 w-16 flex items-center justify-center
            ${disabled 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : 'bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300'
            } transition-colors`}
          onClick={onBackspace}
          disabled={disabled}
          aria-label="Backspace"
        >
          <BackspaceIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default DialPad; 