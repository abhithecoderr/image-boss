import React from 'react';
import { UIProvider } from './UIContext';
import { AuthProvider } from './AuthContext';
import { WorkspaceProvider } from './WorkspaceContext';
import { ServiceProvider } from './ServiceContext';
import { SegmentationProvider } from './SegmentationContext';

/**
 * AppProvider
 * Glues all standard React Context Providers together in a strict top-down dependency hierarchy.
 * Nesting structure ensures contexts have access to their parent contexts (e.g. Workspace has access to UI).
 */
export const AppProvider = ({ children }) => {
  return (
    <UIProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <ServiceProvider>
            <SegmentationProvider>
              {children}
            </SegmentationProvider>
          </ServiceProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </UIProvider>
  );
};

// --- Standardized Context Bridge Hook Exports ---
// Direct slice exports prevent components from importing five different files for various states.
export { useUI } from './UIContext';
export { useWorkspace } from './WorkspaceContext';
export { useService } from './ServiceContext';
export { useSegmentation } from './SegmentationContext';
export { useAuth } from './AuthContext';
