import React, { createContext, useContext, useState } from 'react';

export interface SettingsContextType {
  settings: Record<string, any>;
  senderEmails: string[];
  updateSettings: (newSettings: Record<string, any>) => void;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SettingsContextType = {
  settings: {
    senderName: 'SI GROUP Marketing',
    senderEmail: 'marketing@sigroup.vn',
    replyTo: 'info@sigroup.vn',
  },
  senderEmails: ['marketing@sigroup.vn', 'info@sigroup.vn'],
  updateSettings: () => {},
  refreshSettings: async () => {},
};

const SettingsContext = createContext<SettingsContextType>(defaultSettings);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Record<string, any>>(defaultSettings.settings);
  return (
    <SettingsContext.Provider
      value={{
        settings,
        senderEmails: defaultSettings.senderEmails,
        updateSettings: (next) => setSettings((prev) => ({ ...prev, ...next })),
        refreshSettings: async () => {},
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextType {
  return useContext(SettingsContext) || defaultSettings;
}
