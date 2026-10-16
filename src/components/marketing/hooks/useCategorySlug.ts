import { useState, useEffect } from 'react';
import { api } from '../services/storageAdapter';

export const useCategorySlug = (slugOrId: string | undefined) => {
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slugOrId) {
            setLoading(false);
            return;
        }

        const resolveSlug = async () => {
            setLoading(true);
            try {
                // If it already looks like a category ID, use it but still verify or update state
                if (slugOrId.startsWith('category_')) {
                    setCategoryId(slugOrId);
                    setLoading(false);
                    return;
                }

                const res = await api.get<any>(`ai_chatbot_slug?slug=${slugOrId}`);
                if (res.success && res.data) {
                    setCategoryId(res.data.id);
                } else {
                    setError('Không tìm thấy nhóm này');
                }
            } catch (err) {
                setError('Lỗi kết nối máy chủ');
            } finally {
                setLoading(false);
            }
        };

        resolveSlug();
    }, [slugOrId]);

    return { categoryId, loading, error };
};
