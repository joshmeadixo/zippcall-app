import React, { useState } from 'react';
import { 
  MicrophoneIcon, 
  PhoneXMarkIcon
} from '@heroicons/react/24/solid';
import { NoSymbolIcon } from '@heroicons/react/24/outline';

interface CallControlsProps {
  onHangup: () => void;
  onToggleMute: (isMuted: boolean) => void;
  disabled?: boolean;
}

const CallControls: React.FC<CallControlsProps> = ({ 
  onHangup, 
  onToggleMute, 
  disabled = false 
}) => {
  const [isMuted, setIsMuted] = useState(false);
  
  const handleToggleMute = () => {
    if (disabled) return;
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    onToggleMute(newMuteState);
  };

  return (
    <div className="flex justify-center space-x-6 py-4">
      {/* Mute button */}
      <button
        onClick={handleToggleMute}
        disabled={disabled}
        className={`rounded-full p-4 flex items-center justify-center transition-colors
          ${disabled 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : isMuted
              ? 'bg-red-100 text-red-600'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
          }`}
        aria-label={isMuted ? 'Unmute call' : 'Mute call'}
      >
        {isMuted ? (
          <div className="relative">
            <MicrophoneIcon className="h-6 w-6" />
            <NoSymbolIcon className="h-6 w-6 absolute top-0 left-0 text-red-600" />
          </div>
        ) : (
          <MicrophoneIcon className="h-6 w-6" />
        )}
      </button>
      
      {/* Hangup button */}
      <button
        onClick={onHangup}
        disabled={disabled}
        className={`rounded-full p-4 flex items-center justify-center
          ${disabled 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        aria-label="End call"
      >
        <PhoneXMarkIcon className="h-6 w-6" />
      </button>
    </div>
  );
};

export default CallControls; 