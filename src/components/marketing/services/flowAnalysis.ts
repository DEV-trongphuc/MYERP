import { Flow, FlowStep } from '../types';

interface DurationResult {
    minMinutes: number;
    maxMinutes: number;
    pathDescription: string;
    breakdown?: { label: string, min: number, max: number }[];
}

export const calculateFlowDuration = (flow: Flow): DurationResult => {
    if (!flow || !flow.steps) return { minMinutes: 0, maxMinutes: 0, pathDescription: '' };

    const trigger = flow.steps.find(s => s.type === 'trigger');
    if (!trigger) return { minMinutes: 0, maxMinutes: 0, pathDescription: 'No trigger found' };

    // Initial traversal starts with 0 elapsed time
    return traversePath(trigger.nextStepId, flow.steps, new Set(), 0, 0, true);
};

const traversePath = (
    stepId: string | undefined,
    steps: FlowStep[],
    visited: Set<string>,
    elapsedMin: number = 0,
    elapsedMax: number = 0,
    isRoot: boolean = false
): DurationResult => {
    if (!stepId || visited.has(stepId)) {
        return { minMinutes: 0, maxMinutes: 0, pathDescription: '' };
    }

    const step = steps.find(s => s.id === stepId);
    if (!step) return { minMinutes: 0, maxMinutes: 0, pathDescription: '' };

    const newVisited = new Set(visited).add(stepId);

    // Standard recursive logic for non-branching (or non-root branching treated as unified block)
    let stepMin = 0;
    let stepMax = 0;

    if (step.type === 'wait') {
        const mode = step.config?.mode || 'duration';

        if (mode === 'duration') {
            const dur = parseInt(step.config?.duration || '0');
            const unit = step.config?.unit || 'hours';
            let minutes = 0;
            if (unit === 'minutes') minutes = dur;
            if (unit === 'hours') minutes = dur * 60;
            if (unit === 'days') minutes = dur * 1440;
            if (unit === 'weeks') minutes = dur * 10080;
            stepMin = minutes;
            stepMax = minutes;
        } else if (mode === 'until_date') {
            const dateStr = step.config?.specificDate;
            const timeStr = step.config?.untilTime || '00:00';
            if (dateStr) {
                const target = new Date(`${dateStr}T${timeStr}`);
                const now = new Date();

                // For min duration, we assume minimal prior wait
                const minStart = new Date(now.getTime() + elapsedMin * 60000);
                const minDiff = Math.max(0, Math.floor((target.getTime() - minStart.getTime()) / 60000));

                // For max duration, we assume maximal prior wait
                const maxStart = new Date(now.getTime() + elapsedMax * 60000);
                const maxDiff = Math.max(0, Math.floor((target.getTime() - maxStart.getTime()) / 60000));

                stepMin = minDiff;
                stepMax = maxDiff;
            }
        } else if (mode === 'until') {
            // Daily/Weekly until time
            // Min is 0 (if we arrive exactly at the time)
            stepMin = 0;
            // Max is 24h or 7d
            if (step.config?.untilDay !== undefined && step.config?.untilDay !== '') {
                stepMax = 10080; // 1 week
            } else {
                stepMax = 1440; // 1 day
            }
        } else if (mode === 'until_attribute') {
            // Anniversary/Birthday - highly variable
            stepMin = 0;
            stepMax = 525600; // 1 year max
        }
    }

    // Branching steps (Condition, Split Test, Advanced Condition)
    if (step.type === 'condition' || step.type === 'split_test' || step.type === 'advanced_condition') {
        const branchPaths: { label: string, min: number, max: number }[] = [];

        if (step.type === 'condition') {
            const waitDur = parseInt(step.config?.waitDuration || '0');
            const waitUnit = step.config?.waitUnit || 'hours';
            let waitMinutes = 0;
            if (waitUnit === 'minutes') waitMinutes = waitDur;
            if (waitUnit === 'hours') waitMinutes = waitDur * 60;
            if (waitUnit === 'days') waitMinutes = waitDur * 1440;

            const pathYes = traversePath(step.yesStepId, steps, newVisited, elapsedMin + stepMin, elapsedMax + stepMax, false);
            const pathNo = traversePath(step.noStepId, steps, newVisited, elapsedMin + stepMin + waitMinutes, elapsedMax + stepMax + waitMinutes, false);

            branchPaths.push({ label: 'NHÁNH IF (Đúng)', min: pathYes.minMinutes, max: pathYes.maxMinutes });
            branchPaths.push({ label: 'NHÁNH ELSE (Sai)', min: pathNo.minMinutes + waitMinutes, max: pathNo.maxMinutes + waitMinutes });
        } else if (step.type === 'split_test') {
            const pathA = traversePath(step.pathAStepId, steps, newVisited, elapsedMin + stepMin, elapsedMax + stepMax, false);
            const pathB = traversePath(step.pathBStepId, steps, newVisited, elapsedMin + stepMin, elapsedMax + stepMax, false);

            branchPaths.push({ label: `NHÁNH A (${step.config?.ratioA || 50}%)`, min: pathA.minMinutes, max: pathA.maxMinutes });
            branchPaths.push({ label: `NHÁNH B (${100 - (step.config?.ratioA || 50)}%)`, min: pathB.minMinutes, max: pathB.maxMinutes });
        } else if (step.type === 'advanced_condition') {
            const branches = step.config?.branches || [];
            branches.forEach((b: any) => {
                const bPath = traversePath(b.stepId, steps, newVisited, elapsedMin + stepMin, elapsedMax + stepMax, false);
                branchPaths.push({ label: `NHÁNH: ${b.label || 'Không tên'}`, min: bPath.minMinutes, max: bPath.maxMinutes });
            });
            
            const defPath = traversePath(step.config?.defaultStepId, steps, newVisited, elapsedMin + stepMin, elapsedMax + stepMax, false);
            branchPaths.push({ label: 'MẶC ĐỊNH', min: defPath.minMinutes, max: defPath.maxMinutes });
        }

        const nextMin = branchPaths.length > 0 ? Math.min(...branchPaths.map(b => b.min)) : 0;
        const nextMax = branchPaths.length > 0 ? Math.max(...branchPaths.map(b => b.max)) : 0;

        const result: DurationResult = {
            minMinutes: stepMin + nextMin,
            maxMinutes: stepMax + nextMax,
            pathDescription: ''
        };

        if (isRoot) {
            result.breakdown = branchPaths;
        }

        return result;
    }

    const next = traversePath(step.nextStepId, steps, newVisited, elapsedMin + stepMin, elapsedMax + stepMax, false);

    return {
        minMinutes: stepMin + next.minMinutes,
        maxMinutes: stepMax + next.maxMinutes,
        pathDescription: ''
    };
};

export const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return `${days}d ${h > 0 ? h + 'h' : ''}`;
};
