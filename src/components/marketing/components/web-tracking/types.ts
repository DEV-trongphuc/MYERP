
export interface WebProperty {
    id: string;
    name: string;
    domain: string;
    created_at?: string;
}

export interface WebStats {
    overview: {
        visitors: number;
        newUsers?: number;
        sessions: number;
        pageViews: number;
        avgDuration: number;
        bounceRate: number;
        bounces: number;
        growth?: number;
    };
    chart: { date: string; sessions: number; pageViews: number }[];
    topPages: { url: string; urlHash?: string; title: string; count: number; avgTime: number; avgScroll: number; bounceRate: number; avgLoadTime?: number }[];
    topEvents: { type: string; target: string; count: number; url?: string }[];
    trafficSources: { source: string; medium: string; campaign: string | null; sessions: number; visitors: number }[];
    userAcquisition?: { source: string; medium: string; newUsers: number }[];
    deviceStats: { name: string; value: number }[];
    osStats: { name: string; value: number }[];
    locationStats: { name: string; value: number }[];
}

export interface Visitor {
    id: string;
    zalo_user_id?: string;
    subscriber_id?: string;
    first_visit_at: string;
    last_visit_at: string;
    visit_count: number;
    sessions: number;
    email?: string;
    first_name?: string;
    phone?: string;
    phone_number?: string;
    avatar_url?: string;
    subscriber?: { email: string; first_name: string; phone_number: string };
    device_type?: string;
    os?: string;
    browser?: string;
    ip_address?: string;
    country?: string;
    city?: string;
}

export interface RetentionData {
    week: string;
    startDate: string;
    total: number;
    data: number[];
}

export interface VisitorStats {
    clicks: number;
    canvas_clicks: number;
    page_views: number;
    total_time: number;
}

// Dual value declarations for verbatimModuleSyntax compatibility
export const WebProperty: any = undefined;
export const WebStats: any = undefined;
export const Visitor: any = undefined;
export const RetentionData: any = undefined;
export const VisitorStats: any = undefined;
