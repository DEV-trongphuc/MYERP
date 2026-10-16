
export interface HistoryLog {
  id: string;
  action: string;
  timestamp: string;
  user: string;
  userPicture?: string;
  details: string;
  flowId?: string;
}

export const logAction = (action: string, details: string, flowId?: string): HistoryLog[] => {
  let userName = 'Admin';
  let userPicture = '';
  try {
    const savedUser = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
    if (savedUser && savedUser.name) {
      userName = savedUser.name;
    }
    if (savedUser && savedUser.picture) {
      userPicture = savedUser.picture;
    }
  } catch {}

  const newLog: HistoryLog = {
    id: crypto.randomUUID(),
    action,
    details,
    timestamp: new Date().toISOString(),
    user: userName,
    userPicture,
    flowId
  };

  try {
    const logs = JSON.parse(localStorage.getItem('mailflow_logs') || '[]');
    // Limit to 50 entries for better history tracking (up from 10)
    const updatedLogs = [newLog, ...logs].slice(0, 50);
    try {
      localStorage.setItem('mailflow_logs', JSON.stringify(updatedLogs));
    } catch (quotaErr) {
      // QuotaExceededError: trim aggressively and retry
      if (quotaErr instanceof DOMException && quotaErr.name === 'QuotaExceededError') {
        const trimmed = updatedLogs.slice(0, 10);
        try {
          localStorage.setItem('mailflow_logs', JSON.stringify(trimmed));
        } catch {
          // Storage completely full — clear only logs key, keep auth tokens
          localStorage.removeItem('mailflow_logs');
        }
      }
    }
    return JSON.parse(localStorage.getItem('mailflow_logs') || '[]');
  } catch {
    return [newLog];
  }
};

export const getLogs = (): HistoryLog[] => {
  try {
    return JSON.parse(localStorage.getItem('mailflow_logs') || '[]');
  } catch {
    return [];
  }
};

// Dual value declarations for verbatimModuleSyntax compatibility
export const HistoryLog: any = undefined;
