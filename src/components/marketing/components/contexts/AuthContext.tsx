import React from 'react';
import { useAuth as useMyErpAuth } from '../../../../contexts/AuthContext';

export function useAuth() {
  const auth = useMyErpAuth();
  return {
    ...auth,
    can: (_permission?: string) => true,
    dbNeedsMigration: false,
    setDbNeedsMigration: (_val?: boolean) => {},
    user: auth?.user
      ? {
          ...auth.user,
          name: (auth.user as any).full_name || (auth.user as any).name || auth.user.email || 'Admin',
          picture: (auth.user as any).avatar || (auth.user as any).picture || '/imgs/ICON.png',
        }
      : null,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
