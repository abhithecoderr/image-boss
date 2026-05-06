**Location:** /src/context/AppContext.jsx

**Purpose:**
Provides global state variables and functions for other components to use.

Utilises useCallback and memoized context for efficiency

---------------------------------------------------------------------

**Code Structure:**

*Imports:*

```js
import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { SERVICES, SERVICE_ORDER, CONTROLS_CONFIG } from '../config';
```
---------------------------------------------------------------------

*App Provider component*

```js
const AppContext = createContext();

export const AppProvider = ({ children }) => {
  ```

---------------------------------------------------------------------


  Various states

---------------------------------------------------------------------


  *selectService function:*

  This function saves the current service stuff in serviceResults state and then switches to the next selected service, displaying its previous results if present.

  ```js
  const selectService = useCallback((serviceId) => {
    // 1. Capture current state for persistence
    setServiceResults(prev => ({
      ...prev,
      [currentService.id]: {
        resultCanvas,
        segmentationResult,
        samPoints
      }
    }));

    // 2. Hydrate next service state
    const nextResults = serviceResults[serviceId] || {};
    setResultCanvas(nextResults.resultCanvas || null);
    setSegmentationResult(nextResults.segmentationResult || null);
    setSamPoints(nextResults.samPoints || []);

    setCurrentService(SERVICES[serviceId]);
  }, [currentService.id, resultCanvas, segmentationResult, samPoints, serviceResults]);
```

---------------------------------------------------------------------


   *Other functions*

   ```js
   const updateProgress = useCallback((percent, message) => {
    setProgress({ percent, message });
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    // Clear existing timeout to prevent premature vanishing
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const resetWorkspace = useCallback(() => {
    setOriginalImage(null);
    setOriginalCanvas(null);
    setResultCanvas(null);
    setIsProcessing(false);
    setProgress({ percent: 0, message: '' });
    setSamPoints([]);
    setServiceResults({});
    setSegmentationResult(null);
  }, []);
  ```

---------------------------------------------------------------------


  *Memoized state and functions*

  ```js
  // --- Memoized Value (CRITICAL FOR PERFORMANCE) ---
  const contextValue = useMemo(() => ({
    currentService,
    setCurrentService,
    selectService,
    originalImage,
    setOriginalImage,
    originalCanvas,
  ```

---------------------------------------------------------------------

   Remaining stuff

    ```js
    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
    };

    export const useApp = () => {
      const context = useContext(AppContext);
      if (!context) {
        throw new Error('useApp must be used within an AppProvider');
      }
      return context;
    };
    ```



