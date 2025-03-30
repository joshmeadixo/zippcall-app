import React, { useState, useEffect, useRef } from 'react';

interface CallTimerProps {
  startTime: number | null;
  isActive: boolean;
}

const CallTimer: React.FC<CallTimerProps> = ({ startTime, isActive }) => {
  const [elapsed, setElapsed] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clean up any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isActive && startTime) {
      // Set initial elapsed time
      const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(initialElapsed);
      
      // Start the timer with a stable interval
      intervalRef.current = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(newElapsed);
      }, 1000);
    } else {
      // Reset when call ends or becomes inactive
      setElapsed(0);
    }
    
    // Clean up interval on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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