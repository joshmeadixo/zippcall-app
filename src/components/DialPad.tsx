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

// Add DTMF tone frequencies
const DTMF_TONES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '0': [941, 1336],
  '*': [941, 1209],
  '#': [941, 1477]
};

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
  
  // Initialize audio on mount
  useEffect(() => {
    const initAudio = () => {
      // Try to initialize audio context
      if (!sharedAudioContext) {
        try {
          const windowWithAudioContext = window as unknown as AudioContextWindow;
          const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
          sharedAudioContext = new AudioContextClass();
          console.log('AudioContext initialized on page load');
        } catch (err) {
          console.error('Failed to create AudioContext on page load:', err);
        }
      }
  
      // Try to resume if suspended
      if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume().then(() => {
          console.log('AudioContext resumed on page load');
        }).catch(err => {
          console.error('Failed to resume AudioContext:', err);
        });
      }
    };
  
    // Add interaction listeners to unlock audio
    const unlockAudio = () => {
      console.log('User interaction detected, unlocking audio...');
      initAudio();
    };
  
    // Try initial setup
    initAudio();
  
    // Add user interaction listeners
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
  
    return () => {
      // Clean up the listeners
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, []);
  
  // Play DTMF tone when a key is pressed
  const playTone = useCallback((digit: string) => {
    if (disabled) return;
    console.log(`Attempting to play tone for digit: ${digit}`);
    
    // Simple and direct approach
    try {
      // Initialize audio context on first use
      if (!sharedAudioContext) {
        try {
          const windowWithAudioContext = window as unknown as AudioContextWindow;
          const AudioContextClass = windowWithAudioContext.AudioContext || windowWithAudioContext.webkitAudioContext;
          sharedAudioContext = new AudioContextClass();
          console.log('Created new AudioContext');
        } catch (err) {
          console.error('Failed to create AudioContext:', err);
          return;
        }
      }
      
      // Ensure audio context is resumed
      if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume().then(() => {
          console.log('AudioContext resumed successfully');
          // Try playing the tone again after resume
          setTimeout(() => playTone(digit), 100);
        }).catch(err => {
          console.error('Failed to resume AudioContext:', err);
        });
        return;
      }
      
      // Get the DTMF frequencies for this digit
      const [freq1, freq2] = DTMF_TONES[digit] || [0, 0];
      if (freq1 === 0 || freq2 === 0) return;
      
      // Create a new audio context time reference
      const startTime = sharedAudioContext.currentTime;
      const stopTime = startTime + 0.3; // 300ms tone (increased from 200ms)
      
      // Create the oscillators
      const osc1 = sharedAudioContext.createOscillator();
      const osc2 = sharedAudioContext.createOscillator();
      
      // Create and configure gain node
      const gainNode = sharedAudioContext.createGain();
      gainNode.gain.value = 0.5; // Increased from 0.2 for more volume
      
      // Configure oscillators
      osc1.type = 'sine';
      osc1.frequency.value = freq1;
      
      osc2.type = 'sine';
      osc2.frequency.value = freq2;
      
      // Connect graph
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(sharedAudioContext.destination);
      
      // Schedule exact start/stop times
      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(stopTime);
      osc2.stop(stopTime);
      
      // Log success
      console.log(`Playing DTMF tone for digit ${digit}: ${freq1}Hz + ${freq2}Hz`);
      
      // Cleanup after tone completes
      setTimeout(() => {
        try {
          gainNode.disconnect();
        } catch (err) {
          console.warn('Error during cleanup:', err);
        }
      }, 250);
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