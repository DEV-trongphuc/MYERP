import api from '../api/axios';

export interface ExportOptions {
  endpoint?: string;
  params?: Record<string, any>;
  defaultFilename?: string;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

/**
 * Downloads a file from the backend API using Axios.
 * Automatically handles:
 * - Proper API URL rewriting (e.g. api.php?action=export)
 * - Bearer authorization headers
 * - Token fallback
 * - Blob handling and clean filename parsing
 * - Parsing and throwing readable JSON errors if backend returns failure
 */
export async function downloadExportFile({
  endpoint = '/export',
  params = {},
  defaultFilename = 'export_data.csv',
  onSuccess,
  onError,
}: ExportOptions): Promise<void> {
  const token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token') || '';

  // Clean params: remove empty strings/undefined/null
  const cleanParams: Record<string, any> = {};
  Object.keys(params).forEach((key) => {
    const val = params[key];
    if (val !== undefined && val !== null && val !== '') {
      cleanParams[key] = val;
    }
  });
  if (token && !cleanParams.token) {
    cleanParams.token = token;
  }

  try {
    const response = await api.get(endpoint, {
      params: cleanParams,
      responseType: 'blob',
      timeout: 120000, // 2 minutes timeout for large exports
    });

    // Check if the returned blob is actually a JSON error (e.g. 403 or 500 error returned as JSON)
    const rawContentType = response.headers['content-type'];
    const contentType = typeof rawContentType === 'string' ? rawContentType : (rawContentType ? String(rawContentType) : '');
    if (contentType.includes('application/json') || (response.data && (response.data as any).type === 'application/json')) {
      const text = await (response.data as Blob).text();
      try {
        const json = JSON.parse(text);
        const errMsg = json.message || 'Lỗi từ máy chủ khi xuất dữ liệu';
        throw new Error(errMsg);
      } catch (parseErr: any) {
        throw new Error(parseErr.message || text);
      }
    }

    // Determine filename
    let filename = defaultFilename;
    const rawDisposition = response.headers['content-disposition'];
    const disposition = typeof rawDisposition === 'string' ? rawDisposition : (rawDisposition ? String(rawDisposition) : '');
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '').trim();
      }
    }

    // Create a temporary link and trigger direct browser download
    const blob = new Blob([response.data], {
      type: contentType || 'text/csv;charset=utf-8;',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    if (onSuccess) {
      onSuccess();
    }
  } catch (err: any) {
    if (onError) {
      onError(err);
    }
    throw err;
  }
}
