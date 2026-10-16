
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface NavigationContextType {
    customBackAction: (() => void) | null;
    setCustomBackAction: (action: (() => void) | null) => void;
    handleBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [customBackAction, setCustomBackAction] = useState<(() => void) | null>(null);
    const navigate = useNavigate();

    const handleBack = useCallback(() => {
        if (customBackAction) {
            customBackAction();
        } else {
            window.history.back();
        }
    }, [customBackAction]);

    return (
        <NavigationContext.Provider value={{ customBackAction, setCustomBackAction, handleBack }}>
            {children}
        </NavigationContext.Provider>
    );
};

export const useNavigation = (): NavigationContextType => {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        return {
            customBackAction: null,
            setCustomBackAction: () => {},
            handleBack: () => window.history.back(),
        };
    }
    return context;
};
