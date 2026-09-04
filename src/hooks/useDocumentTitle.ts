import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | IDEAS ERP` : 'IDEAS ERP';
  }, [title]);
}
