import { createContext, useContext, useState, useCallback, useRef } from 'react';

// Context storing globally accessible notification overlays and loading progress states
const UIContext = createContext();

/* 
 UIProvider:
 Manages toast notifications and real-time processing progress bars.
*/
export const UIProvider = ({ children }) => {
  const [toast, setToast] = useState(null);                            // Message and notification type state
  const [progress, setProgress] = useState({ percent: 0, message: '' });// Percentage and active task description
  const toastTimeoutRef = useRef(null);                                 // Ref ensuring proper timeout evictions

  // Renders a fleeting overlay banner showing successful completions or warning messages
  const showToast = useCallback((message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    // Dismiss toast automatically after 3 seconds
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Updates the live processing bar with numeric ratio and status messages
  const updateProgress = useCallback((percent, message) => {
    setProgress({ percent, message });
  }, []);

  return (
    <UIContext.Provider value={{ toast, progress, showToast, updateProgress }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
