import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, Plus, Search, Filter, Calendar, 
  ChevronRight, ArrowUpRight, CheckCircle2, Clock, XCircle, Loader2,
  Truck, Package, Trash2, PlusCircle, MinusCircle, AlertCircle,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { EmptyCard } from '../components/ui/EmptyCard';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from './ui/Avatar';

interface Props {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  defaultSupplierId?: string;
}

export const PurchaseOrdersTab: React.FC<Props> = ({ showModal, setShowModal, defaultSupplierId }) => {
  const { user } = useAuth();
  const isSale = user?.role === 'sale' || user?.role === 'viewer';
  console.log('PurchaseOrdersTab RENDERED. showModal =', showModal);
  
  const { addToast, showConfirm } = useUIStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [threshold, setThreshold] = useState<number>(5000000);
  
  const [formData, setFormData] = useState({
    supplier_id: '', 
    order_date: new Date().toISOString().split('T')[0], 
    notes: '', 
    items: [] as any[],
    tax_rate: 0,
    approver_id: '',
    approver_id_2: '',
    approver_id_3: ''
  });

  useEffect(() => {
    if (showModal && defaultSupplierId) {
      setFormData(prev => ({ ...prev, supplier_id: String(defaultSupplierId) }));
    }
  }, [showModal, defaultSupplierId]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/purchase-orders');
      setOrders(res.data.data || []);
    } catch (err) {
      addToast('Lỗi khi tải danh sách đơn nhập hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliersAndProducts = async () => {
    try {
      const [sRes, pRes, uRes, setRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products'),
        api.get('/users?all=1'),
        api.get('/api.php?action=get_settings')
      ]);
      const sData = sRes.data.data;
      const pData = pRes.data.data;
      const uData = uRes.data.data || uRes.data;
      setSuppliers(Array.isArray(sData) ? sData : (sData?.items || []));
      setProducts(Array.isArray(pData) ? pData : (pData?.items || []));
      setUsers(Array.isArray(uData) ? uData : (uData?.items || []));
      
      if (setRes.data?.success && setRes.data?.data?.po_three_level_threshold !== undefined) {
        setThreshold(Number(setRes.data.data.po_three_level_threshold));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { 
    fetchOrders(); 
    fetchSuppliersAndProducts();
  }, []);

  const handleAddItem = (p: any) => {
    const cost = Number(p.cost || 0);
    const exists = formData.items.find(i => i.product_id === p.id);
    if (exists) {
      setFormData({
        ...formData,
        items: formData.items.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * Number(i.unit_cost) } : i)
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, { 
          product_id: p.id, 
          name: p.name, 
          quantity: 1, 
          unit_cost: cost, 
          subtotal: cost 
        }]
      });
    }
  };

  const handleRemoveItem = (id: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, idx) => idx !== id) });
  };

  const handleQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    setFormData({
      ...formData,
      items: formData.items.map((item, i) => i === idx ? { ...item, quantity: qty, subtotal: qty * Number(item.unit_cost) } : item)
    });
  };

  const calculateTotal = () => formData.items.reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);

  const handleApprove = async (id: number, status: 'approved' | 'rejected') => {
    setIsSubmitting(true);
    try {
      await api.post(`/purchase-orders/${id}/approve`, { status });
      addToast(status === 'approved' ? 'Đã duyệt đơn hàng thành công' : 'Đã từ chối đơn hàng', 'success');
      fetchOrders();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi phê duyệt', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) return addToast('Vui lòng chọn nhà cung cấp', 'error');
    if (formData.items.length === 0) return addToast('Vui lòng thêm ít nhất một sản phẩm', 'error');
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const subtotal = calculateTotal();
      const taxRate = Number(formData.tax_rate || 0);
      const tax = Math.round(subtotal * taxRate / 100);
      const total = subtotal + tax;

      // Enforce approval constraint: default 1 level, 2 levels if total >= threshold
      if (!formData.approver_id) {
        addToast('Vui lòng chọn người duyệt Cấp 1', 'error');
        setIsSubmitting(false);
        return;
      }
      if (total >= threshold) {
        if (!formData.approver_id_2) {
          addToast(`Đơn hàng từ ${new Intl.NumberFormat('vi-VN').format(threshold)} đ trở lên bắt buộc phải phê duyệt 2 cấp, vui lòng chọn người duyệt Cấp 2`, 'error');
          setIsSubmitting(false);
          return;
        }
      }

      await api.post('/purchase-orders', {
        supplier_id: formData.supplier_id,
        order_date: formData.order_date,
        notes: formData.notes,
        items: formData.items.map(i => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, unit_cost: i.unit_cost, subtotal: i.subtotal })),
        subtotal,
        tax,
        total,
        approver_id: formData.approver_id ? Number(formData.approver_id) : null,
        approver_id_2: formData.approver_id_2 ? Number(formData.approver_id_2) : null,
        approver_id_3: formData.approver_id_3 ? Number(formData.approver_id_3) : null
      });
      addToast('Đã tạo đơn nhập hàng mới', 'success');
      setShowModal(false);
      setFormData({ supplier_id: '', order_date: new Date().toISOString().split('T')[0], notes: '', items: [], tax_rate: 0, approver_id: '', approver_id_2: '', approver_id_3: '' });
      fetchOrders();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu đơn hàng', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = (id: number) => {
    if (isSubmitting) return;
    showConfirm({
      title: 'Nhập kho hàng hóa',
      message: 'Hệ thống sẽ cộng số lượng sản phẩm vào kho và ghi nhận công nợ. Bạn xác nhận đã nhận đủ hàng?',
      confirmText: 'Xác nhận nhập kho',
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          await api.post(`/purchase-orders/${id}/receive`);
          addToast('Đã nhập kho thành công', 'success');
          fetchOrders();
        } catch (err: any) {
          addToast(err.response?.data?.message || 'Lỗi khi nhập kho', 'error');
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="animate-fade">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner sm"></div>
          </div>
        ) : orders.length === 0 ? (
          <EmptyCard 
            icon={<ShoppingCart size={48} />}
            title="Chưa có đơn nhập hàng nào"
            description="Bắt đầu tạo đơn nhập hàng để quản lý kho và công nợ nhà cung cấp."
            actionText={isSale ? undefined : "Tạo đơn đầu tiên"}
            onAction={isSale ? undefined : () => setShowModal(true)}
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>MÃ ĐƠN</th>
                    <th>NHÀ CUNG CẤP</th>
                    <th>NGÀY ĐẶT</th>
                    <th style={{ textAlign: 'right' }}>TỔNG TIỀN</th>
                    <th>TRẠNG THÁI</th>
                    <th style={{ textAlign: 'right' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    let statusClass = o.status === 'received' ? 'success' : o.status === 'ordered' ? 'warning' : 'info';
                    let statusLabel = o.status === 'received' ? 'Đã nhập kho' : o.status === 'ordered' ? 'Đã đặt hàng' : 'Nháp';
                    if (o.status === 'pending_approval') {
                      statusClass = 'warning';
                      statusLabel = 'Chờ duyệt';
                    } else if (o.status === 'cancelled') {
                      statusClass = 'danger';
                      statusLabel = 'Từ chối';
                    }

                    // Check if current user is the expected active approver
                    let isActiveApprover = false;
                    const curUserId = Number(user?.id);
                    const isAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(String(user?.role).toLowerCase());
                    
                    if (o.status === 'pending_approval') {
                      if (o.status_level_1 === 'pending') {
                        if (Number(o.approver_id) === curUserId || isAdmin) isActiveApprover = true;
                      } else if (o.status_level_1 === 'approved' && o.status_level_2 === 'pending') {
                        if (Number(o.approver_id_2) === curUserId || isAdmin) isActiveApprover = true;
                      } else if (o.status_level_1 === 'approved' && o.status_level_2 === 'approved' && o.status_level_3 === 'pending') {
                        if (Number(o.approver_id_3) === curUserId || isAdmin) isActiveApprover = true;
                      }
                    }

                    return (
                      <tr key={o.id} className="table-row-hover group">
                        <td>
                          <span className="font-black text-primary text-xs font-mono bg-primary/5 px-2 py-1 rounded">{o.po_number}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Truck size={16} />
                            </div>
                            <div>
                              <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{o.supplier_name}</span>
                              <div className="text-[10px] text-muted-light mt-0.5">Tạo bởi: {o.creator_name || '...'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            <Calendar size={14} style={{ color: 'var(--color-text-light)' }} /> {new Date(o.order_date).toLocaleDateString('vi-VN')}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="font-black text-sm text-primary">
                            {new Intl.NumberFormat('vi-VN').format(o.total)} đ
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className={`badge ${statusClass}`} style={{ alignSelf: 'flex-start' }}>{statusLabel}</span>
                            
                            {/* Render levels info */}
                            {o.approver_id && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {o.status_level_1 === 'approved' ? (
                                    <CheckCircle2 size={11} color="var(--color-success)" />
                                  ) : o.status_level_1 === 'rejected' ? (
                                    <XCircle size={11} color="var(--color-danger)" />
                                  ) : (
                                    <Clock size={11} color="var(--color-warning)" />
                                  )}
                                  <span style={{ 
                                    fontWeight: 650,
                                    color: o.status_level_1 === 'approved' ? 'var(--color-success)' : o.status_level_1 === 'rejected' ? 'var(--color-danger)' : 'var(--color-text)'
                                  }}>
                                    Cấp 1: {o.approver_name_1 || '...'}
                                  </span>
                                </div>
                                {o.approver_id_2 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {o.status_level_2 === 'approved' ? (
                                      <CheckCircle2 size={11} color="var(--color-success)" />
                                    ) : o.status_level_2 === 'rejected' ? (
                                      <XCircle size={11} color="var(--color-danger)" />
                                    ) : (
                                      <Clock size={11} color="var(--color-warning)" />
                                    )}
                                    <span style={{ 
                                      fontWeight: 650,
                                      color: o.status_level_2 === 'approved' ? 'var(--color-success)' : o.status_level_2 === 'rejected' ? 'var(--color-danger)' : 'var(--color-text)'
                                    }}>
                                      Cấp 2: {o.approver_name_2 || '...'}
                                    </span>
                                  </div>
                                )}
                                {o.approver_id_3 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {o.status_level_3 === 'approved' ? (
                                      <CheckCircle2 size={11} color="var(--color-success)" />
                                    ) : o.status_level_3 === 'rejected' ? (
                                      <XCircle size={11} color="var(--color-danger)" />
                                    ) : (
                                      <Clock size={11} color="var(--color-warning)" />
                                    )}
                                    <span style={{ 
                                      fontWeight: 650,
                                      color: o.status_level_3 === 'approved' ? 'var(--color-success)' : o.status_level_3 === 'rejected' ? 'var(--color-danger)' : 'var(--color-text)'
                                    }}>
                                      Cấp 3: {o.approver_name_3 || '...'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex flex-col gap-1.5 items-end">
                            {o.status === 'ordered' && (
                              <button className="btn primary sm inline-flex items-center justify-center gap-2" onClick={() => handleReceive(o.id)}>
                                <Package size={14} /> Nhập kho
                              </button>
                            )}
                            {o.status === 'received' && (
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
                                <CheckCircle2 size={14} /> Hoàn tất
                              </div>
                            )}
                            {o.status === 'cancelled' && (
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-danger">
                                <XCircle size={14} /> Bị từ chối
                              </div>
                            )}
                            
                            {isActiveApprover && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <button 
                                  className="btn success sm" 
                                  onClick={() => handleApprove(o.id, 'approved')}
                                  disabled={isSubmitting}
                                  style={{ padding: '2px 8px', fontSize: '11px', height: '24px', minHeight: 'unset' }}
                                >
                                  Duyệt
                                </button>
                                <button 
                                  className="btn danger sm" 
                                  onClick={() => handleApprove(o.id, 'rejected')}
                                  disabled={isSubmitting}
                                  style={{ padding: '2px 8px', fontSize: '11px', height: '24px', minHeight: 'unset' }}
                                >
                                  Từ chối
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && ReactDOM.createPortal(
        <div className="overlay-backdrop" onClick={() => setShowModal(false)} style={{ zIndex: 9999 }}>
            <motion.div 
              className="modal-sheet modal-xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2 }}
              style={{ height: '90vh', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="modal-header" style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-border-light)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShoppingCart size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Tạo đơn nhập hàng mới</h3>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                      Bước 1: Thiết lập & Chọn sản phẩm
                    </p>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setShowModal(false)} style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
                  <XCircle size={22} />
                </button>
              </div>

              {/* Body: 2 Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', flex: 1, minHeight: 0, backgroundColor: 'var(--color-bg)' }}>
                
                {/* Left Column: Form & Selected Items */}
                <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <div style={{ padding: '1.25rem 1.5rem 80px 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Settings Form */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <Truck size={13} /> Nhà cung cấp <span className="text-danger">*</span>
                        </label>
                        <CustomSelect 
                          options={suppliers.map(s => ({ value: String(s.id), label: s.name }))}
                          value={formData.supplier_id} 
                          onChange={val => setFormData({...formData, supplier_id: String(val)})}
                          placeholder="-- Chọn nhà cung cấp --"
                          searchable
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <Calendar size={13} /> Ngày dự kiến
                        </label>
                        <input 
                          type="date" 
                          className="form-input"
                          style={{ height: '2.5rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '10px' }}
                          value={formData.order_date} 
                          onChange={e => setFormData({...formData, order_date: e.target.value})} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          Thuế suất VAT (%)
                        </label>
                        <CustomSelect 
                          options={[
                            { value: '0', label: '0% (Không thuế)' },
                            { value: '5', label: '5%' },
                            { value: '8', label: '8%' },
                            { value: '10', label: '10%' }
                          ]}
                          value={String(formData.tax_rate || 0)} 
                          onChange={val => setFormData({...formData, tax_rate: Number(val)})}
                          placeholder="Chọn thuế suất"
                        />
                      </div>
                    </div>

                    {/* Phê duyệt & Vận hành Card */}
                    <div style={{
                      padding: '1.25rem',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      boxShadow: 'var(--shadow-xs)',
                      marginTop: '0.25rem'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} color="var(--color-primary)" /> Phê duyệt & Vận hành
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        {/* Creator Block */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Người tạo</label>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '8px',
                            height: '38px'
                          }}>
                            <Avatar src={user?.avatar_url || user?.avatar} name={user?.name || user?.username} size="sm" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user?.name || user?.username}</span>
                          </div>
                        </div>

                        {/* Summary / Warning info */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '12px', padding: '8px 12px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--color-text-muted)' }}>
                            Hạn mức 2 cấp duyệt:
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>
                            {new Intl.NumberFormat('vi-VN').format(threshold)} đ
                          </span>
                          {(() => {
                            const subtotal = calculateTotal();
                            const taxRate = Number(formData.tax_rate || 0);
                            const tax = Math.round(subtotal * taxRate / 100);
                            const total = subtotal + tax;
                            if (total >= threshold) {
                              return (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-danger)', marginTop: '2px' }}>
                                  Tiền trên {new Intl.NumberFormat('vi-VN').format(threshold)}đ phê duyệt 2 cấp
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      {/* Stacked Approvers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                            Người duyệt Cấp 1 <span className="text-danger">*</span>
                          </label>
                          <CustomSelect 
                            options={users.map((u: any) => ({
                              value: String(u.id),
                              label: u.full_name,
                              avatar: u.avatar_url || u.avatar,
                              sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                            }))}
                            value={formData.approver_id} 
                            onChange={val => setFormData({...formData, approver_id: String(val)})}
                            placeholder="Chọn người duyệt..."
                            searchable
                            showAvatars
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                            Người duyệt Cấp 2 {(() => {
                              const subtotal = calculateTotal();
                              const taxRate = Number(formData.tax_rate || 0);
                              const tax = Math.round(subtotal * taxRate / 100);
                              const total = subtotal + tax;
                              return total >= threshold ? <span className="text-danger">*</span> : <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>(Tùy chọn)</span>;
                            })()}
                          </label>
                          <CustomSelect 
                            options={users.map((u: any) => ({
                              value: String(u.id),
                              label: u.full_name,
                              avatar: u.avatar_url || u.avatar,
                              sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                            }))}
                            value={formData.approver_id_2} 
                            onChange={val => setFormData({...formData, approver_id_2: String(val)})}
                            placeholder="Chọn người duyệt..."
                            searchable
                            showAvatars
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                            Người duyệt Cấp 3 <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>(Tùy chọn)</span>
                          </label>
                          <CustomSelect 
                            options={users.map((u: any) => ({
                              value: String(u.id),
                              label: u.full_name,
                              avatar: u.avatar_url || u.avatar,
                              sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                            }))}
                            value={formData.approver_id_3} 
                            onChange={val => setFormData({...formData, approver_id_3: String(val)})}
                            placeholder="-- Không có --"
                            searchable
                            showAvatars
                          />
                        </div>
                      </div>
                    </div>

                    {/* Order Notes */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Ghi chú đơn hàng (Notes)
                      </label>
                      <textarea
                        className="form-input"
                        placeholder="Nhập ghi chú chi tiết cho đơn nhập hàng này..."
                        style={{ height: '3.5rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '10px', resize: 'vertical' }}
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                      />
                    </div>

                    {/* Selected Products */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="flex items-center justify-between">
                        <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', margin: 0 }}>
                          Danh sách sản phẩm ({formData.items.length})
                        </label>
                      </div>
                      
                      {formData.items.length === 0 ? (
                        <div style={{ padding: '2rem', border: '2px dashed var(--color-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)' }}>
                          <Package size={36} style={{ color: 'var(--color-text-muted)', opacity: 0.3, marginBottom: '0.75rem' }} />
                          <p style={{ fontWeight: 700, color: 'var(--color-text-light)', fontSize: '0.85rem', margin: 0 }}>Chưa có sản phẩm nào</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0', textAlign: 'center' }}>Chọn sản phẩm từ danh mục bên phải để thêm vào đơn hàng</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {formData.items.map((item, idx) => (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              key={idx} 
                              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border)' }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 650, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', margin: '2px 0 0' }}>{new Intl.NumberFormat('vi-VN').format(item.unit_cost)} đ</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--color-surface)', padding: '0.125rem 0.25rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                <button type="button" className="btn-icon sm" style={{ border: 'none', background: 'transparent', width: '20px', height: '20px' }} onClick={() => handleQtyChange(idx, item.quantity - 1)}>
                                  <MinusCircle size={14} />
                                </button>
                                <span style={{ width: '20px', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{item.quantity}</span>
                                <button type="button" className="btn-icon sm" style={{ border: 'none', background: 'transparent', width: '20px', height: '20px' }} onClick={() => handleQtyChange(idx, item.quantity + 1)}>
                                  <PlusCircle size={14} />
                                </button>
                              </div>
                              <div style={{ width: '100px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)' }}>
                                {new Intl.NumberFormat('vi-VN').format(item.subtotal)} đ
                              </div>
                              <button type="button" className="btn-icon" style={{ color: 'var(--color-danger)', border: 'none', background: 'transparent', width: '28px', height: '28px' }} onClick={() => handleRemoveItem(idx)}>
                                <Trash2 size={16} />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Summary Box */}
                  <div style={{ marginTop: 'auto', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--color-border)' }}>
                    {(() => {
                      const subtotal = calculateTotal();
                      const taxRate = Number(formData.tax_rate || 0);
                      const tax = Math.round(subtotal * taxRate / 100);
                      const total = subtotal + tax;
                      return (
                        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#0f172a', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#fff', boxShadow: '0 8px 20px -5px rgba(15, 23, 42, 0.25)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                            <span>Tạm tính (Subtotal):</span>
                            <span>{new Intl.NumberFormat('vi-VN').format(subtotal)} đ</span>
                          </div>
                          {tax > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                              <span>Thuế VAT ({taxRate}%):</span>
                              <span>{new Intl.NumberFormat('vi-VN').format(tax)} đ</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                            <div>
                              <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Tổng thanh toán (Total)</p>
                              <p style={{ fontSize: '1.25rem', fontWeight: 900, margin: '2px 0 0', color: '#38bdf8' }}>{new Intl.NumberFormat('vi-VN').format(total)} đ</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Hình thức</p>
                              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', margin: '2px 0 0' }}>Công nợ / Tiền mặt</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right Column: Search & Add Products */}
                <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
                  <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <div className="filter-search w-full" style={{ background: 'var(--color-bg)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
                      <Search size={16} className="text-muted" />
                      <input 
                        placeholder="Tìm theo tên hoặc SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ fontSize: '0.8rem', fontWeight: 600 }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', marginBottom: '0.75rem', paddingLeft: '0.25rem', margin: 0 }}>
                      Danh mục ({filteredProducts.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {filteredProducts.map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => handleAddItem(p)} 
                          style={{ 
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '0.625rem 0.75rem', borderRadius: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.04)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '3px' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 4px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-light)', borderRadius: '3px' }}>{p.sku || 'N/A'}</span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tồn: {p.stock_quantity}</span>
                            </div>
                          </div>
                          <div style={{ width: '26px', height: '26px', borderRadius: '8px', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', flexShrink: 0 }}>
                            <Plus size={14} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ padding: '1.25rem 2rem', backgroundColor: 'var(--color-surface)', zIndex: 10 }}>
                {suppliers.length === 0 || products.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-warning-light)', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px solid var(--color-warning)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <AlertCircle style={{ color: 'var(--color-warning)' }} size={24} />
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-warning)' }}>Dữ liệu chưa sẵn sàng</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Bạn cần khởi tạo {suppliers.length === 0 ? 'nhà cung cấp' : 'sản phẩm'} trước.</p>
                      </div>
                    </div>
                    <button className="btn primary" onClick={() => navigate(suppliers.length === 0 ? '/suppliers' : '/products')}>Khởi tạo ngay</button>
                  </div>
                ) : (
                  <>
                    <button className="btn secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>Hủy bỏ</button>
                    <button className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 2rem' }} onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 size={18} className="spin" /> : 'Xác nhận nhập hàng'}
                      {!isSubmitting && <ArrowUpRight size={18} />}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  );
};
