import * as React from 'react';
import { useState, useMemo } from 'react';
import { Search, Zap, X, Send, Play } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Badge from '../common/Badge';
import { Flow, Subscriber } from '../../types';
import { api } from '../../services/storageAdapter';

interface ManualTriggerFlowModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscriber: Subscriber;
    flows: Flow[];
    onSuccess: (flowName: string) => void;
    zIndex?: number;
}

const ManualTriggerFlowModal: React.FC<ManualTriggerFlowModalProps> = ({
    isOpen,
    onClose,
    subscriber,
    flows,
    onSuccess,
    zIndex
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState<string | null>(null);

    const filteredFlows = useMemo(() => {
        return flows.filter(f =>
            f.status === 'active' &&
            f.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [flows, searchTerm]);

    const handleTrigger = async (flow: Flow) => {
        setLoading(flow.id);

        // Manual trigger scenario in worker_priority.php
        const query = new URLSearchParams({
            subscriber_id: subscriber.id,
            trigger_type: 'manual',
            target_id: flow.id
        });

        // We use a POST/GET to worker_priority.php
        // Note: The storageAdapter's api.get might wait for completion.
        // worker_priority.php is designed to be fast for the initial chain.
        const res = await api.get<any>(`worker_priority.php?${query.toString()}`);

        setLoading(null);
        if (res.success) {
            onSuccess(flow.name);
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Kích hoạt Automation thủ công"
            size="md"
            zIndex={zIndex ?? 40000}
        >
            <div className="space-y-5">
                {/* Banner Thông Báo */}
                <div className="p-4 bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100/50 dark:border-blue-500/20 rounded-2xl flex items-start gap-3.5 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/10">
                        <Zap className="w-5 h-5 fill-current" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight">
                            Ghi danh <span className="text-blue-600 dark:text-blue-400">"{subscriber.firstName}"</span> vào quy trình tự động.
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                            Hành động này sẽ ghi danh Khách hàng ngay lập tức và bắt đầu thực hiện các bước Instant trong kịch bản.
                        </p>
                    </div>
                </div>

                {/* Ô Tìm Kiếm */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm quy trình..."
                        className="w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl pl-11 pr-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Danh Sách Quy Trình */}
                <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
                    {filteredFlows.length > 0 ? filteredFlows.map(flow => (
                        <div
                            key={flow.id}
                            className="group flex items-center justify-between p-3.5 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl hover:border-blue-200 dark:hover:border-blue-500/30 hover:bg-blue-50/10 dark:hover:bg-blue-950/15 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                        >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white group-hover:border-transparent transition-all shadow-sm">
                                    <Play className="w-4 h-4 fill-current" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors pr-2">{flow.name}</p>
                                    <div className="flex items-center gap-2 mt-1 select-none">
                                        <Badge variant="success" className="text-[8px] px-1.5 py-0.5 uppercase tracking-wide font-black">Active</Badge>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                                            {flow.steps?.length || 0} Steps
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                icon={Send}
                                onClick={() => handleTrigger(flow)}
                                isLoading={loading === flow.id}
                                className="!h-[32px] !rounded-lg text-[10px] uppercase font-black tracking-wider group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-500 group-hover:border-transparent transition-all shrink-0 ml-4 shadow-sm"
                            >
                                Kích hoạt
                            </Button>
                        </div>
                    )) : (
                        <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800/80">
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Không tìm thấy quy trình nào</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ManualTriggerFlowModal;
