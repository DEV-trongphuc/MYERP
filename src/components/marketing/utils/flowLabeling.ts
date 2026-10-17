import { Flow } from '../types';

export interface StepLabelInfo {
    id: string;
    stepNumberLabel: string; // e.g. "Step 2.IF.1"
    label: string; // e.g. "Send Email"
    fullLabel: string; // e.g. "Step 2.IF.1: Send Email"
}

export const generateFlowStepLabels = (flow: Flow): Record<string, StepLabelInfo> => {
    // 1. TOPOLOGICAL SORT: Get steps in execution order (Start -> End)
    const sortedSteps: any[] = [];
    const trigger = flow.steps.find(s => s.type === 'trigger');

    if (trigger) {
        const queue = [trigger.id];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const step = flow.steps.find(s => s.id === currentId);
            if (step) {
                sortedSteps.push(step);
                // Add children to queue in specific order for consistent numbering
                if (step.nextStepId) queue.push(step.nextStepId);
                if (step.yesStepId) queue.push(step.yesStepId);
                if (step.noStepId) queue.push(step.noStepId);
                if (step.pathAStepId) queue.push(step.pathAStepId);
                if (step.pathBStepId) queue.push(step.pathBStepId);
                if (step.type === 'advanced_condition') {
                    if (Array.isArray(step.config?.branches)) {
                        step.config.branches.forEach((b: any) => {
                            const targetStepId = b?.nextStepId || b?.stepId;
                            if (targetStepId) queue.push(targetStepId);
                        });
                    }
                    if (step.config?.defaultStepId) queue.push(step.config.defaultStepId);
                }
            }
        }
    } else {
        // Fallback
        sortedSteps.push(...flow.steps);
    }

    // Filter relevant steps for numbering (Actions & Logic Steps)
    const actionSteps = sortedSteps.filter(s =>
        [
            'action',
            'update_tag',
            'condition',
            'advanced_condition',
            'zalo_zns',
            'crm_action',
            'wait',
            'list_action',
            'remove_action',
            'split_test',
            'link_flow'
        ].includes(s.type)
    );

    // Map index
    const stepIndexMap: Record<string, number> = {};
    actionSteps.forEach((s, idx) => {
        stepIndexMap[s.id] = idx;
    });

    // Build Parent Map
    const parentMap: Record<string, { id: string; branch: string }> = {};
    flow.steps.forEach(s => {
        if (s.nextStepId) parentMap[s.nextStepId] = { id: s.id, branch: 'next' };
        if (s.yesStepId) parentMap[s.yesStepId] = { id: s.id, branch: 'yes' };
        if (s.noStepId) parentMap[s.noStepId] = { id: s.id, branch: 'no' };
        if (s.pathAStepId) parentMap[s.pathAStepId] = { id: s.id, branch: 'A' };
        if (s.pathBStepId) parentMap[s.pathBStepId] = { id: s.id, branch: 'B' };
        if (s.type === 'advanced_condition') {
            if (Array.isArray(s.config?.branches)) {
                s.config.branches.forEach((b: any, bIdx: number) => {
                    const targetStepId = b?.nextStepId || b?.stepId;
                    if (targetStepId) {
                        parentMap[targetStepId] = { id: s.id, branch: `B${bIdx + 1}` };
                    }
                });
            }
            if (s.config?.defaultStepId) {
                parentMap[s.config.defaultStepId] = { id: s.id, branch: 'ELSE' };
            }
        }
    });

    const labelMap: Record<string, string> = {};
    const result: Record<string, StepLabelInfo> = {};

    actionSteps.forEach((step, idx) => {
        let stepDisplayLabel = `Step ${idx + 1}`; // Fallback

        const parentInfo = parentMap[step.id];
        if (parentInfo) {
            const parentLabel = labelMap[parentInfo.id];
            const parentType = flow.steps.find(s => s.id === parentInfo.id)?.type;

            if (parentLabel) {
                if (parentType === 'condition') {
                    const suffix = parentInfo.branch === 'yes' ? 'IF' : 'ELSE';
                    stepDisplayLabel = `${parentLabel}.${suffix}`;
                } else if (parentType === 'split_test') {
                    const suffix = parentInfo.branch === 'A' ? 'A' : 'B';
                    stepDisplayLabel = `${parentLabel}.${suffix}`;
                } else if (parentType === 'advanced_condition') {
                    stepDisplayLabel = `${parentLabel}.${parentInfo.branch}.1`;
                } else {
                    if (parentLabel.includes('.')) {
                        const parts = parentLabel.split('.');
                        const lastPart = parts.pop();
                        if (lastPart && !isNaN(Number(lastPart))) {
                            const num = parseInt(lastPart);
                            stepDisplayLabel = parts.join('.') + '.' + (num + 1);
                        } else {
                            stepDisplayLabel = parentLabel + '.1';
                        }
                    }
                }
            }
        } else {
            if (idx === 0) stepDisplayLabel = 'Step 1';
        }

        if (
            stepDisplayLabel.endsWith('.IF') ||
            stepDisplayLabel.endsWith('.ELSE') ||
            stepDisplayLabel.endsWith('.A') ||
            stepDisplayLabel.endsWith('.B')
        ) {
            stepDisplayLabel += '.1';
        }

        labelMap[step.id] = stepDisplayLabel;
        result[step.id] = {
            id: step.id,
            stepNumberLabel: stepDisplayLabel,
            label: step.label,
            fullLabel: `${stepDisplayLabel}: ${step.label}`
        };
    });

    return result;
};

// Dual value declarations for verbatimModuleSyntax compatibility
export const StepLabelInfo: any = undefined;
