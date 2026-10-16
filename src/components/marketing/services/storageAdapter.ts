import domationApi, {
  type DomationResponse,
  type DomationRequestOptions,
  openCustomerProfileDrawer,
} from '../../../services/domationApi';

export type ApiResponse<T> = DomationResponse<T>;
export const ApiResponse: any = undefined;

export const api = {
  baseUrl: domationApi.getApiUrl(),
  getApiUrl: () => domationApi.getApiUrl(),
  clearCache: (prefix?: string) => domationApi.clearCache(prefix),
  invalidate: (prefix?: string) => domationApi.invalidate(prefix),
  peek: <T = any>(endpoint: string, params: Record<string, any> = {}) =>
    domationApi.peek<T>(endpoint, params),
  get: <T = any>(endpoint: string, params: Record<string, any> = {}, options?: DomationRequestOptions) =>
    domationApi.get<T>(endpoint, params, options),
  post: <T = any>(endpoint: string, body: any = {}, options?: DomationRequestOptions) =>
    domationApi.post<T>(endpoint, body, options),
  put: <T = any>(endpoint: string, body: any = {}, options?: DomationRequestOptions) =>
    domationApi.put<T>(endpoint, body, options),
  delete: <T = any>(endpoint: string, params: Record<string, any> = {}, options?: DomationRequestOptions) =>
    domationApi.delete<T>(endpoint, params, options),
  openCustomerProfileDrawer,
};

export default api;

