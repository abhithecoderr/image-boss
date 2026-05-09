import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

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
