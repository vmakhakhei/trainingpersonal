import React, { useEffect, useState } from 'react';
import MuscleGroupButton from './MuscleGroupButton';

const DEFAULT_MUSCLE_COLOR = '#FFFFFF';

const ExercisePicker = () => {
  const [multiPicked, setMultiPicked] = useState([]);
  const [timer, setTimer] = useState(null);

  const reset = () => {
    setMultiPicked([]);  // Fix: reset function to clear multiPicked
  };

  useEffect(() => {
    // Timer logic
    if (timer) {
      const timerId = setTimeout(() => {
        // Timer behavior
        console.log('Timer expired');
      }, 1000);
      return () => clearTimeout(timerId);  // Proper useEffect cleanup for timer
    }
  }, [timer]);

  return (
    <div>
      {multiPicked.map((muscle) => (
        <MuscleGroupButton key={muscle.id} muscle={muscle} color={DEFAULT_MUSCLE_COLOR} />  // Extracted MuscleGroupButton component
      ))}
      <button onClick={reset}>Reset</button>
    </div>
  );
};

export default ExercisePicker;