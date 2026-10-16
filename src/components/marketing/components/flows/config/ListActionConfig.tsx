
import React, { useEffect, useState } from 'react';
import { List, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import Select from '../../common/Select';
import Radio from '../../common/Radio';

interface ListActionConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>, newLabel?: string) => void;
    disabled?: boolean;
}

const ListActionConfig: React.FC<ListActionConfigProps> = ({ config, onChange, disabled }) => {
    const [lists, setLists] = useState<any[]>([]);
    const action = config.action || 'add';

    useEffect(() => {
        const fetchLists = async () => {
            const res = await api.get<any[]>('lists');
            if (res.success) setLists(res.data.filter(l => l.source !== 'Google Sheets'));
        };
        fetchLists();
    }, []);

    const handleActionChange = (val: string) => {
        if (disabled) return;
        onChange({ ...config, action: val }, val === 'add' ? 'Thêm vào List' : 'Gỡ khỏi List');
    };

    const selectedList = lists.find(l => l.id === config.listId);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <Radio
                label="Hành động:"
                options={[
                    { id: 'add', label: 'Thêm vào danh sách', icon: UserPlus },
                    { id: 'remove', label: 'Gỡ khỏi danh sách', icon: UserMinus },
                ]}
                value={action}
                onChange={handleActionChange}
                disabled={disabled}
                variant="list"
            />

            <div className="space-y-3">
                <Select
                    label="Chọn danh sách mục tiêu"
                    options={lists.map(l => ({ value: l.id, label: l.name }))}
                    value={config.listId || ''}
                    onChange={(val) => onChange({ ...config, listId: val }, action === 'add' ? `Thêm vào: ${lists.find(l => l.id === val)?.name}` : `Gỡ khỏi: ${lists.find(l => l.id === val)?.name}`)}
                    disabled={disabled}
                    icon={List}
                    placeholder="Chọn danh sách..."
                />

                {action === 'add' && selectedList && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-2 text-[10px] text-blue-700 font-medium">
                        <List className="w-4 h-4 shrink-0" />
                        <p>Khách hàng sẽ được thêm vào danh sách <b>"{selectedList.name}"</b>. Nếu có Automation nào kích hoạt bằng việc "Vào danh sách" này, nó sẽ được chạy ngay lập tức.</p>
                    </div>
                )}

                {action === 'remove' && selectedList && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-2 text-[10px] text-amber-700 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p>Khách hàng sẽ bị gỡ khỏi danh sách <b>"{selectedList.name}"</b>.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ListActionConfig;
