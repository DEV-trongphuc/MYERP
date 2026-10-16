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
                    step.config.branches.forEach((b: any) => { if (b?.stepId) queue.push(b.stepId); });
                }
                if (step.config?.defaultStepId) queue.push(step.config.defaultStepId);
            }
            if (step.type === 'advanced_condition') {
                if (Array.isArray(step.config?.branches)) {
                    step.config.branches.forEach((b: any) => { if (b?.stepId) queue.push(b.stepId); });
                }
                if (step.config?.defaultStepId) queue.push(step.config.defaultStepId);
            }
            if (step.type === 'advanced_condition') {
                if (Array.isArray(step.config?.branches)) {
                    step.config.branches.forEach((b: any) => { if (b?.stepId) queue.push(b.stepId); });
                }
                if (step.config?.defaultStepId) queue.push(step.config.defaultStepId);
            }
            }
        }
    } else {
        // Fallback
        sortedSteps.push(...flow.steps);
    }

    // Filter relevant steps for numbering (Actions)
    const actionSteps = sortedSteps.filter(s => ['action', 'update_tag', 'condition', 'wait', 'list_action', 'remove_action', 'split_test', 'link_flow'].includes(s.type));

    // Map index
    const stepIndexMap: Record<string, number> = {};
    actionSteps.forEach((s, idx) => { stepIndexMap[s.id] = idx; });

    // Build Parent Map
    const parentMap: Record<string, { id: string, branch: string }> = {};
    flow.steps.forEach(s => {
        if (s.nextStepId) parentMap[s.nextStepId] = { id: s.id, branch: 'next' };
        if (s.yesStepId) parentMap[s.yesStepId] = { id: s.id, branch: 'yes' };
        if (s.noStepId) parentMap[s.noStepId] = { id: s.id, branch: 'no' };
        if (s.pathAStepId) parentMap[s.pathAStepId] = { id: s.id, branch: 'A' };
        if (s.pathBStepId) parentMap[s.pathBStepId] = { id: s.id, branch: 'B' };
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
                } else {
                    if (parentLabel.includes('.')) {
                        const parts = parentLabel.split('.');
                        const lastPart = parts.pop(); // Remove last number if exists
                        // Check if last part is a number or a Branch Name (IF/ELSE/A/B)
                        if (lastPart && !isNaN(Number(lastPart))) {
                            // Increment: "Step 2.IF.1" -> "Step 2.IF.2"
                            const num = parseInt(lastPart);
                            stepDisplayLabel = parts.join('.') + '.' + (num + 1);
                        } else {
                            // First number in new branch segment: "Step 2.IF" -> "Step 2.IF.1"
                            // Re-attach the popped part (Branch Name)
                            stepDisplayLabel = parentLabel + '.1';
                        }
                    } else {
                        // Main line: "Step 1" -> "Step 2"
                        // Just rely on loop index? No, index is global topology.
                        // Ideally we follow the thread.
                        // But for main line, simple increment of "Step X" is tricky if we jumped around.
                        // Let's stick to parent-based logic if possible.
                        // If parent is "Step X", and it's a 'next' link, we usually just want "Step X+1".
                        // BUT, if we are in a merged path, it gets complicated.
                        // Simpler: If not in a branch, just use Global Index + 1 ?
                        // The user wants nested numbering primarily.

                        // Let's trust the global topology for the root level integer?
                        // `Step ${idx + 1}` is fine for linear.

                        // Let's refine the "Main Line" continuation inside a branch:
                        const match = parentLabel.match(/Step (\d+)(\..+)?/);
                        if (match) {
                            if (match[2]) {
                                // We are deep.
                                // Handled by the .includes('.') logic above.
                            } else {
                                // Top level. "Step 1" -> "Step 2".
                                // Topological index is safest for top level to ensure uniqueness and order.
                            }
                        }
                    }
                }
            }
        } else {
            if (idx === 0) stepDisplayLabel = "Step 1";
        }

        // CORRECTION: Ensure we don't end up with "Step 2.IF" as the label for a step.
        // If the step itself IS the first step of the branch, it should be "Step 2.IF.1" (or just "Step 2.IF" if that's the style).
        // User liked "Step 2.IF" -> "Step 2.IF.2". So "Step 2.IF" is implied as "Step 2.IF.1".
        // My previous logic: `stepDisplayLabel = ${parentLabel}.${suffix}` -> "Step 2.IF". This is assigned to the first step in the branch.
        // User complaint: "Step 5 update tag... that is step 3 of IF side".
        // So user expects: Step 2 (Condition) -> Step 2.IF.1 (Update Tag) -> Step 2.IF.2 ...
        // My logic above produces "Step 2.IF" for the first one. Let's append '.1'.

        if (stepDisplayLabel.endsWith('.IF') || stepDisplayLabel.endsWith('.ELSE') || stepDisplayLabel.endsWith('.A') || stepDisplayLabel.endsWith('.B')) {
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
