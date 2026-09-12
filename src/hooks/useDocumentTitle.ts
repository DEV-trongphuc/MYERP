import { useEffect } from 'react';
import { getSystemTitle } from '../config/env';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const sysTitle = getSystemTitle();
    document.title = title ? `${title} | ${sysTitle}` : sysTitle;
  }, [title]);
}
