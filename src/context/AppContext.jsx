import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { UIProvider, useUI } from './UIContext';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';
import { ServiceProvider, useService } from './ServiceContext';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  return (
    <UIProvider>
      <WorkspaceProvider>
        <ServiceProvider>
          <AppContextBridge>{children}</AppContextBridge>
        </ServiceProvider>
      </WorkspaceProvider>
    </UIProvider>
  );
};

// Bridge component to provide the combined useApp value
const AppContextBridge = ({ children }) => {
  const ui = useUI();
  const workspace = useWorkspace();
  const service = useService();

  const resetWorkspace = useCallback(() => {
    workspace.resetImages();
    ui.updateProgress(0, '');
    service.resetServiceState();
  }, [workspace, ui, service]);

  const value = useMemo(() => ({
    ...ui,
    ...workspace,
    ...service,
    resetWorkspace
  }), [ui, workspace, service, resetWorkspace]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

// Compatibility exports
export { useUI } from './UIContext';
export { useWorkspace } from './WorkspaceContext';
export { useService } from './ServiceContext';

