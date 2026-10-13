// src/components/chat/chatTagParsers.ts
// Unified parser for AI Copilot Smart Tags: Action Proposal, Dynamic Chart (Micro-BI), Next Best Actions, Proactive Insights

import type { ActionProposal } from './ActionProposalCard';

export interface DynamicChartSeries {
  dataKey: string;
  name: string;
  color?: string;
}

export interface DynamicChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  description?: string;
  xAxisKey?: string;
  data: Array<Record<string, any>>;
  series?: DynamicChartSeries[];
}

export interface ProactiveInsightData {
  type?: 'warning' | 'opportunity' | 'info' | 'urgent';
  title: string;
  description: string;
  actionPrompt?: string;
  actionLabel?: string;
}

function safeParseJson<T = any>(str: string): T | null {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    try {
      const sanitized = str
        .replace(/\\u1ecp/gi, 'ỉ')
        .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
      return JSON.parse(sanitized);
    } catch {
      try {
        const relaxed = str
          .replace(/\\u1ecp/gi, 'ỉ')
          .replace(/\\u(?![0-9a-fA-F]{4})/g, '');
        return JSON.parse(relaxed);
      } catch {
        return null;
      }
    }
  }
}

export interface ParsedChatTags {
  cleanContent: string;
  proposal: ActionProposal | null;
  chart: DynamicChartData | null;
  nextBestActions: string[] | null;
  proactiveInsight: ProactiveInsightData | null;
}

export function parseAllChatTags(rawContent: string): ParsedChatTags {
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      cleanContent: '',
      proposal: null,
      chart: null,
      nextBestActions: null,
      proactiveInsight: null,
    };
  }

  let text = rawContent;
  let proposal: ActionProposal | null = null;
  let chart: DynamicChartData | null = null;
  let nextBestActions: string[] | null = null;
  let proactiveInsight: ProactiveInsightData | null = null;

  // 1. Parse & Strip ACTION_PROPOSAL
  const proposalMatch = text.match(/<<<ACTION_PROPOSAL:\s*({[\s\S]*?})\s*>>>/);
  if (proposalMatch) {
    text = text.replace(proposalMatch[0], '').trim();
    const raw = safeParseJson<any>(proposalMatch[1]);
    if (raw) {
      let params: Record<string, any> = raw.params || {};
      if (raw.params_json) {
        if (typeof raw.params_json === 'string') {
          const parsedParams = safeParseJson<Record<string, any>>(raw.params_json);
          if (parsedParams && typeof parsedParams === 'object') {
            params = { ...params, ...parsedParams };
          }
        } else if (typeof raw.params_json === 'object') {
          params = { ...params, ...raw.params_json };
        }
      }
      proposal = {
        action_type: (raw.action_type || params.action_type || 'leave') as ActionProposal['action_type'],
        title: raw.title || params.title || 'Đề xuất hành động ERP',
        summary: raw.summary || params.summary || 'Đề xuất từ AI IDEAS',
        params,
      };
    }
  }

  // 2. Parse & Strip DYNAMIC_CHART
  const chartMatch = text.match(/<<<DYNAMIC_CHART:\s*({[\s\S]*?})\s*>>>/);
  if (chartMatch) {
    text = text.replace(chartMatch[0], '').trim();
    const rawChart = safeParseJson<any>(chartMatch[1]);
    if (rawChart && Array.isArray(rawChart.data) && rawChart.data.length > 0) {
      chart = {
        type: ['bar', 'line', 'pie', 'area'].includes(rawChart.type) ? rawChart.type : 'bar',
        title: rawChart.title || 'Biểu đồ phân tích số liệu',
        description: rawChart.description || '',
        xAxisKey: rawChart.xAxisKey || 'name',
        data: rawChart.data,
        series: Array.isArray(rawChart.series) && rawChart.series.length > 0
          ? rawChart.series
          : [{ dataKey: 'value', name: 'Số lượng' }],
      };
    }
  }

  // 3. Parse & Strip PROACTIVE_INSIGHT
  const insightMatch = text.match(/<<<PROACTIVE_INSIGHT:\s*({[\s\S]*?})\s*>>>/);
  if (insightMatch) {
    text = text.replace(insightMatch[0], '').trim();
    const rawInsight = safeParseJson<any>(insightMatch[1]);
    if (rawInsight && (rawInsight.title || rawInsight.description)) {
      proactiveInsight = {
        type: rawInsight.type || 'warning',
        title: rawInsight.title || 'Cảnh báo vận hành',
        description: rawInsight.description || '',
        actionPrompt: rawInsight.actionPrompt || rawInsight.action_prompt || '',
        actionLabel: rawInsight.actionLabel || rawInsight.action_label || 'Xử lý ngay',
      };
    }
  }

  // 4. Parse & Strip NEXT_BEST_ACTIONS
  const actionsMatch = text.match(/<<<NEXT_BEST_ACTIONS:\s*(\[[\s\S]*?\])\s*>>>/);
  if (actionsMatch) {
    text = text.replace(actionsMatch[0], '').trim();
    const rawActions = safeParseJson<any[]>(actionsMatch[1]);
    if (Array.isArray(rawActions) && rawActions.length > 0) {
      const cleanList = rawActions
        .map((item) => (typeof item === 'string' ? item.trim() : typeof item?.text === 'string' ? item.text.trim() : ''))
        .filter((t) => t.length > 0);
      if (cleanList.length > 0) {
        nextBestActions = cleanList;
      }
    }
  }

  // 5. Clean any residual <<<SAVE_MEMORY:...>>> tags if present
  text = text.replace(/<<<SAVE_MEMORY:\s*({[\s\S]*?})\s*>>>/g, '').trim();

  return {
    cleanContent: text,
    proposal,
    chart,
    nextBestActions,
    proactiveInsight,
  };
}
