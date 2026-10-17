import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../services/storageAdapter';

export interface SettingsContextType {
  settings: Record<string, any>;
  senderEmails: string[];
  senderName: string;
  updateSettings: (newSettings: Record<string, any>) => void;
  refreshSettings: () => Promise<void>;
}

const DEFAULT_VERIFIED_SENDERS = [
  'tuyensinh@ideas.edu.vn',
  'cskh@ideas.edu.vn',
  'marketing@ideas.edu.vn',
  'systemnoti@ideas.edu.vn',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseVerifiedSenderEmails(rawSettings?: Record<string, any> | null): string[] {
  const set = new Set<string>();
  if (rawSettings && typeof rawSettings === 'object') {
    const listCandidates = [
      rawSettings.verified_senders,
      rawSettings.sender_emails,
    ];
    listCandidates.forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((item) => {
          const em = String(typeof item === 'object' ? item?.email || '' : item || '').trim().toLowerCase();
          if (em && EMAIL_RE.test(em) && em !== 'marketing@ka-en.com.vn' && em !== 'marketing@sigroup.vn' && em !== 'info@sigroup.vn') {
            set.add(em);
          }
        });
      }
    });

    const strCandidates = [
      rawSettings.verified_from_senders,
      rawSettings.smtp_from_email,
      rawSettings.ses_sender_email,
      rawSettings.default_sender_email,
    ];
    strCandidates.forEach((str) => {
      if (typeof str === 'string' && str.trim()) {
        str.split(/[,;\n\r]+/).forEach((part) => {
          const em = part.trim().toLowerCase();
          if (em && EMAIL_RE.test(em) && em !== 'marketing@ka-en.com.vn' && em !== 'marketing@sigroup.vn' && em !== 'info@sigroup.vn') {
            set.add(em);
          }
        });
      }
    });
  }

  if (set.size === 0) {
    DEFAULT_VERIFIED_SENDERS.forEach((em) => set.add(em));
  }
  return Array.from(set);
}

let cachedSettingsData: Record<string, any> = {
  senderName: 'Viện Quốc Tế IDEAS',
  senderEmail: DEFAULT_VERIFIED_SENDERS[0],
  replyTo: DEFAULT_VERIFIED_SENDERS[1],
};
let cachedSenderEmails: string[] = [...DEFAULT_VERIFIED_SENDERS];
let inflightSettingsPromise: Promise<void> | null = null;
let hasFetchedSettingsOnce = false;
const listeners = new Set<() => void>();

async function fetchGlobalMktSettings(force = false): Promise<void> {
  if (hasFetchedSettingsOnce && !force) return;
  if (inflightSettingsPromise && !force) return inflightSettingsPromise;

  inflightSettingsPromise = api
    .get<any>('settings')
    .then((res) => {
      const payload = res?.data && typeof res.data === 'object' ? res.data : (res && typeof res === 'object' ? res : null);
      if (payload) {
        const parsedEmails = parseVerifiedSenderEmails(payload);
        const senderName =
          payload.default_sender_name ||
          payload.smtp_from_name ||
          payload.ses_sender_name ||
          payload.company_name ||
          'Viện Quốc Tế IDEAS';
        cachedSenderEmails = parsedEmails;
        cachedSettingsData = {
          ...cachedSettingsData,
          ...payload,
          senderName,
          senderEmail: parsedEmails[0] || DEFAULT_VERIFIED_SENDERS[0],
        };
        hasFetchedSettingsOnce = true;
        listeners.forEach((fn) => fn());
      }
    })
    .catch(() => {
      // Keep fallback verified senders
    })
    .finally(() => {
      inflightSettingsPromise = null;
    });

  return inflightSettingsPromise;
}

const defaultSettings: SettingsContextType = {
  settings: cachedSettingsData,
  senderEmails: cachedSenderEmails,
  senderName: cachedSettingsData.senderName || 'Viện Quốc Tế IDEAS',
  updateSettings: () => {},
  refreshSettings: () => fetchGlobalMktSettings(true),
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Record<string, any>>(cachedSettingsData);
  const [senderEmails, setSenderEmails] = useState<string[]>(cachedSenderEmails);

  useEffect(() => {
    const sync = () => {
      setSettings({ ...cachedSettingsData });
      setSenderEmails([...cachedSenderEmails]);
    };
    listeners.add(sync);
    fetchGlobalMktSettings(false);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const refreshSettings = useCallback(async () => {
    await fetchGlobalMktSettings(true);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        senderEmails,
        senderName: String(settings.senderName || cachedSettingsData.senderName || 'Viện Quốc Tế IDEAS'),
        updateSettings: (next) => {
          cachedSettingsData = { ...cachedSettingsData, ...next };
          const nextEmails = parseVerifiedSenderEmails(cachedSettingsData);
          cachedSenderEmails = nextEmails;
          listeners.forEach((fn) => fn());
        },
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextType {
  const ctx = useContext(SettingsContext);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (ctx) return;
    const onUpdate = () => setTick((t) => t + 1);
    listeners.add(onUpdate);
    fetchGlobalMktSettings(false);
    return () => {
      listeners.delete(onUpdate);
    };
  }, [ctx]);

  if (ctx) return ctx;

  return {
    settings: cachedSettingsData,
    senderEmails: cachedSenderEmails,
    senderName: String(cachedSettingsData.senderName || 'Viện Quốc Tế IDEAS'),
    updateSettings: (next) => {
      cachedSettingsData = { ...cachedSettingsData, ...next };
      cachedSenderEmails = parseVerifiedSenderEmails(cachedSettingsData);
      listeners.forEach((fn) => fn());
    },
    refreshSettings: () => fetchGlobalMktSettings(true),
  };
}
