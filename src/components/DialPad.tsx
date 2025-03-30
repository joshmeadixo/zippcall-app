import React, { useCallback, useEffect, useRef } from 'react';
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

// Single AudioContext shared across all key presses
let sharedAudioContext: AudioContext | null = null;

const DialPad = ({ onDigitPressed, onBackspace, disabled = false }: DialPadProps) => {
  const dialPadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];
  
  // Store oscillators and gain node refs for cleanup
  const oscillators = useRef<OscillatorNode[]>([]);
  const gainNode = useRef<GainNode | null>(null);
  
  // Ensure AudioContext is created and available
  const ensureAudioContext = useCallback(() => {
    if (!sharedAudioContext) {
      try {
        const windowWithAudioContext = window as unknown as AudioContextWindow;
        const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
        sharedAudioContext = new AudioContextClass();
        
        // Auto-resume context on user interaction if suspended
        document.addEventListener('click', function resumeAudioContext() {
          if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume().catch(console.error);
          }
        }, { once: true });
      } catch (err) {
        console.error('Failed to create AudioContext for DTMF tones:', err);
        return null;
      }
    }
    
    // Try to resume if suspended
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(console.error);
    }
    
    return sharedAudioContext;
  }, []);

  // Play DTMF tone when a key is pressed
  const playTone = useCallback((digit: string) => {
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
      // Get audio context
      const audioCtx = ensureAudioContext();
      if (!audioCtx) return;
      
      // Force resume audio context if suspended
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => {
          console.warn('Failed to resume AudioContext:', err);
        });
      }
      
      // Clean up any previous oscillators
      oscillators.current.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore errors from already stopped oscillators
        }
      });
      oscillators.current = [];
      
      if (gainNode.current) {
        try {
          gainNode.current.disconnect();
        } catch {
          // Ignore errors from already disconnected nodes
        }
      }
      
      // Create a new gain node
      gainNode.current = audioCtx.createGain();
      gainNode.current.gain.value = 0.25; // Slightly louder for better hearing
      
      // Create oscillators
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      
      // Set frequencies
      osc1.frequency.value = freq1;
      osc2.frequency.value = freq2;
      
      // Connect nodes
      osc1.connect(gainNode.current);
      osc2.connect(gainNode.current);
      gainNode.current.connect(audioCtx.destination);
      
      // Store oscillators for cleanup
      oscillators.current.push(osc1, osc2);
      
      // Play tone
      osc1.start();
      osc2.start();

      // Log the tone playback
      console.log(`[DialPad] Playing DTMF tone for digit: ${digit}`);
      
      // Stop after short duration
      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
          osc1.disconnect();
          osc2.disconnect();
          if (gainNode.current) gainNode.current.disconnect();
        } catch {
          console.warn('Error stopping DTMF tone');
        }
      }, 150);
    } catch (err) {
      console.error('Error playing DTMF tone:', err);
    }
  }, [disabled, ensureAudioContext]);

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
      
      // Clean up audio resources
      if (oscillators.current.length > 0) {
        oscillators.current.forEach(osc => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // Ignore errors from already stopped oscillators
          }
        });
        oscillators.current = [];
      }
      
      if (gainNode.current) {
        try {
          gainNode.current.disconnect();
        } catch {
          // Ignore errors from already disconnected nodes
        }
        gainNode.current = null;
      }
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