"use client";

import { createContext, useContext, type ReactNode } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';

interface DimensionIconsContextValue {
  dimensionIcons: Record<string, string>;
  setDimensionIcons: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const DimensionIconsContext = createContext<DimensionIconsContextValue>({
  dimensionIcons: {},
  setDimensionIcons: () => {},
});

export function DimensionIconsProvider({ children }: { children: ReactNode }) {
  const [dimensionIcons, setDimensionIcons] = usePersistentState<Record<string, string>>('ui.dimensionIcons', {});

  return (
    <DimensionIconsContext.Provider value={{ dimensionIcons, setDimensionIcons }}>
      {children}
    </DimensionIconsContext.Provider>
  );
}

export function useDimensionIcons() {
  return useContext(DimensionIconsContext);
}
