import React, { useState, useEffect } from 'react';

interface CallTimerProps {
  startTime: number | null;
  isActive: boolean;
}

const CallTimer: React.FC<CallTimerProps> = ({ startTime, isActive }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isActive && startTime) {
      // Reset elapsed time when call starts
      setElapsed(0);
      
      // Start the timer
      intervalId = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(newElapsed);
      }, 1000);
    } else {
      // Reset when call ends
      setElapsed(0);
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [startTime, isActive]);

  // Format seconds into MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="font-mono text-lg">
      {isActive ? formatTime(elapsed) : '00:00'}
    </div>
  );
};

export default CallTimer; 