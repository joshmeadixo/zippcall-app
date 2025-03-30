import React, { useCallback, useEffect } from 'react';
import { BackspaceIcon } from '@heroicons/react/24/solid';

interface DialPadProps {
  onDigitPressed: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

// Define window with AudioContext
interface AudioContextWindow extends Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
}

const DialPad = ({ onDigitPressed, onBackspace, disabled = false }: DialPadProps) => {
  const dialPadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  // Play DTMF tone when a key is pressed
  const playTone = useCallback(async (digit: string) => {
    if (disabled) return;
    
    let freq1 = 0;
    let freq2 = 0;
    
    // DTMF frequency pairs
    switch (digit) {
      case '1': freq1 = 697; freq2 = 1209; break;
      case '2': freq1 = 697; freq2 = 1336; break;
      case '3': freq1 = 697; freq2 = 1477; break;
      case '4': freq1 = 770; freq2 = 1209; break;
      case '5': freq1 = 770; freq2 = 1336; break;
      case '6': freq1 = 770; freq2 = 1477; break;
      case '7': freq1 = 852; freq2 = 1209; break;
      case '8': freq1 = 852; freq2 = 1336; break;
      case '9': freq1 = 852; freq2 = 1477; break;
      case '0': freq1 = 941; freq2 = 1336; break;
      case '*': freq1 = 941; freq2 = 1209; break;
      case '#': freq1 = 941; freq2 = 1477; break;
      default: return;
    }
    
    try {
      // Create audio context with a basic approach
      const windowWithAudioContext = window as unknown as AudioContextWindow;
      const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      
      // Make sure it's running
      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch {
          console.warn('Failed to resume AudioContext');
        }
      }
      
      // Create oscillators
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      // Set frequencies
      osc1.frequency.value = freq1;
      osc2.frequency.value = freq2;
      
      // Set volume
      gainNode.gain.value = 0.1;
      
      // Connect nodes
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Play tone
      osc1.start();
      osc2.start();
      
      // Stop after short duration and clean up
      setTimeout(() => {
        osc1.stop();
        osc2.stop();
        gainNode.disconnect();
        audioCtx.close().catch(() => {});
      }, 150);
    } catch (err) {
      console.error('Error playing DTMF tone:', err);
    }
  }, [disabled]);

  // Handle key presses for digits
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return;
    
    const key = e.key;
    if (/^[0-9*#]$/.test(key)) { // Removed + from the regex
      onDigitPressed(key);
      playTone(key);
    } else if (key === 'Backspace') {
      onBackspace();
    }
  }, [onDigitPressed, onBackspace, playTone, disabled]);

  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleDigitClick = (digit: string) => {
    if (disabled) return;
    onDigitPressed(digit);
    playTone(digit);
  };

  return (
    <div className="select-none mx-auto max-w-xs"> {/* Added mx-auto and max-w-xs to center the dialpad */}
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