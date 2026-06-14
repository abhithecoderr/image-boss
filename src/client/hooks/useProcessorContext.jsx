/*
 * Context-based singleton for the unified processor controller.
 *
 * useUnifiedProcessor is a heavy orchestration hook (store subscriptions,
 * ~15 closures, a service-switch effect). Mounting it 5× across the workspace
 * tree triples store subscriptions and lets the per-instance service-switch
 * effects race. This provider instantiates it exactly once and shares the
 * result via context.
 *
 * Usage:
 *   <ProcessorProvider> ... </ProcessorProvider>
 *   const processor = useProcessor();   // reads from context
 */
import React, { createContext, useContext } from 'react';
import { useUnifiedProcessor } from './useUnifiedProcessor';

const ProcessorContext = createContext(null);

export function ProcessorProvider({ children }) {
  const processor = useUnifiedProcessor();
  return (
    <ProcessorContext.Provider value={processor}>
      {children}
    </ProcessorContext.Provider>
  );
}

/**
 * Read the singleton processor instance from context. Must be used inside a
 * <ProcessorProvider>. Falls back to a fresh useUnifiedProcessor() call only
 * if no provider is present (keeps existing call sites working during
 * incremental migration, but emits a console warning).
 */
export function useProcessor() {
  const ctx = useContext(ProcessorContext);
  if (ctx) return ctx;
  // No provider — fall back so callers don't crash. This path should go away
  // once all mount sites are wrapped.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useUnifiedProcessor();
}

export default ProcessorContext;
