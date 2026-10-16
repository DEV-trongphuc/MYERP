import React from 'react';
import { Box, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SavedItemProps {
    item: { id: string; name: string; data: any };
    onDragStart: (e: React.DragEvent, type: string, payload?: string) => void;
    onDelete?: (id: string) => void;
}

const ToolboxSavedItem: React.FC<SavedItemProps> = ({ item, onDragStart, onDelete }) => (
    <div
        draggable
        onDragStart={(e) => onDragStart(e, 'saved', JSON.stringify(item.data))}
        className="bg-white border border-slate-100 rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all group relative overflow-hidden mb-2"
    >
        {/* Delete button */}
        <button
                    onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation();
                const tid = toast(
                    (t) => (
                        React.createElement('div', { className: 'flex flex-col gap-2 min-w-[200px]' },
                            React.createElement('p', { className: 'text-sm font-semibold text-slate-800' }, `Xóa mẫu "${item.name}"?`),
                            React.createElement('p', { className: 'text-xs text-slate-500' }, 'Mẫu sẽ bị xóa khỏi thư viện.'),
                            React.createElement('div', { className: 'flex gap-2 mt-1' },
                                React.createElement('button', {
                                    className: 'flex-1 px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600',
                                    onClick: () => { toast.dismiss(tid); onDelete?.(item.id); }
                                }, 'Xóa'),
                                React.createElement('button', {
                                    className: 'flex-1 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200',
                                    onClick: () => toast.dismiss(tid)
                                }, 'Hủy')
                            )
                        )
                    ),
                    { duration: 8000 }
                );
            }}
            className="absolute top-2 right-2 p-1.5 bg-rose-50 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white shadow-sm z-10"
            title="Xóa mẫu"
        >
            <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="absolute top-0 right-0 p-1 bg-blue-50 rounded-bl-xl text-blue-600 opacity-0 group-hover:opacity-0 transition-opacity">
            <Box className="w-3 h-3" />
        </div>
        <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                <Box className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 truncate">{item.name}</span>
        </div>
    </div>
);

export default ToolboxSavedItem;
