export const GlobalWorkerOptions: Record<string, any> = { workerSrc: '' };
export function getDocument(_src: any) {
  return {
    promise: Promise.resolve({
      numPages: 0,
      destroy: async () => {},
      getPage: async (_pageNum?: number) => ({
        getTextContent: async () => ({ items: [] as any[] }),
        getViewport: (_opts?: any) => ({ width: 600, height: 800 }),
        render: (_opts?: any) => ({ promise: Promise.resolve() }),
      }),
    }),
  };
}
export function extractRawText(_input: any): Promise<{ value: string; messages: any[] }> {
  return Promise.resolve({ value: '', messages: [] });
}
export function convertToHtml(_input: any): Promise<{ value: string; messages: any[] }> {
  return Promise.resolve({ value: '', messages: [] });
}
export default { GlobalWorkerOptions, getDocument, extractRawText, convertToHtml };
