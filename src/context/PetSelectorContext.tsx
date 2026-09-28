import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PetSelectorContextType {
  selectedPetId: string | null;
  selectPet: (petId: string) => void;
  clearSelection: () => void;
}

const PetSelectorContext = createContext<PetSelectorContextType | undefined>(undefined);

export function PetSelectorProvider({ children }: { children: ReactNode }) {
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  return (
    <PetSelectorContext.Provider
      value={{
        selectedPetId,
        selectPet: setSelectedPetId,
        clearSelection: () => setSelectedPetId(null),
      }}
    >
      {children}
    </PetSelectorContext.Provider>
  );
}

export function usePetSelector() {
  const context = useContext(PetSelectorContext);
  if (!context) {
    throw new Error('usePetSelector must be used within PetSelectorProvider');
  }
  return context;
}
