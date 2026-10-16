export interface ParseResult<T = any> {
  data: T[];
  errors: any[];
  meta: {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
    fields?: string[];
  };
}

export interface ParseConfig<T = any> {
  header?: boolean;
  skipEmptyLines?: boolean | 'greedy';
  preview?: number;
  complete?: (results: ParseResult<T>, file?: any) => void;
  error?: (error: any, file?: any) => void;
  [key: string]: any;
}

function parseCsvString(csvText: string, config: ParseConfig = {}): ParseResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => (config.skipEmptyLines ? l.trim().length > 0 : true));

  const splitRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  if (lines.length === 0) {
    return {
      data: [],
      errors: [],
      meta: { delimiter: ',', linebreak: '\n', aborted: false, truncated: false, cursor: 0 },
    };
  }

  let data: any[] = [];
  let fields: string[] | undefined;

  if (config.header) {
    fields = splitRow(lines[0]).map((h) => h.trim());
    const dataLines = config.preview ? lines.slice(1, 1 + config.preview) : lines.slice(1);
    data = dataLines.map((line) => {
      const values = splitRow(line);
      const obj: Record<string, string> = {};
      fields!.forEach((f, idx) => {
        obj[f] = values[idx] ?? '';
      });
      return obj;
    });
  } else {
    const targetLines = config.preview ? lines.slice(0, config.preview) : lines;
    data = targetLines.map(splitRow);
  }

  return {
    data,
    errors: [],
    meta: {
      delimiter: ',',
      linebreak: '\n',
      aborted: false,
      truncated: Boolean(config.preview && lines.length > config.preview),
      cursor: csvText.length,
      fields,
    },
  };
}

export const Papa = {
  parse(input: string | File, config: ParseConfig = {}): ParseResult | void {
    if (typeof input === 'string') {
      const res = parseCsvString(input, config);
      if (config.complete) config.complete(res);
      return res;
    }
    if (typeof File !== 'undefined' && input instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result || '');
        const res = parseCsvString(text, config);
        if (config.complete) config.complete(res, input);
      };
      reader.onerror = (err) => {
        if (config.error) config.error(err, input);
      };
      reader.readAsText(input);
      return;
    }
    const empty: ParseResult = {
      data: [],
      errors: [],
      meta: { delimiter: ',', linebreak: '\n', aborted: false, truncated: false, cursor: 0 },
    };
    if (config.complete) config.complete(empty);
    return empty;
  },
};

export default Papa;
