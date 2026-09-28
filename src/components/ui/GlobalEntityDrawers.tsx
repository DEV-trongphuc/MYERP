import React, { lazy, Suspense, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/axios';

const CustomerProfileDrawer = lazy(() => import('../../pages/CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
const WorkspaceTaskDrawer = lazy(() => import('../../pages/WorkspaceTaskDrawer').then(module => ({ default: module.WorkspaceTaskDrawer })));
const ExpenseQuickViewDrawer = lazy(() => import('../ExpenseQuickViewDrawer').then(module => ({ default: module.ExpenseQuickViewDrawer })));
const ApprovalDetailDrawer = lazy(() => import('../../pages/Approvals').then(module => ({ default: module.ApprovalDetailDrawer })));
const DepositDetailDrawer = lazy(() => import('../DepositDetailDrawer').then(module => ({ default: module.DepositDetailDrawer })));

export const GlobalEntityDrawers: React.FC = () => {
  const {
    customerDrawer, closeCustomerDrawer, openCustomerDrawer,
    taskDrawer, closeTaskDrawer, openTaskDrawer,
    expenseDrawer, closeExpenseDrawer, openExpenseDrawer,
    approvalDrawer, closeApprovalDrawer, openApprovalDrawer
  } = useUIStore();
  const currentUser = useAuthStore(state => state.user);
  const [fullContact, setFullContact] = useState<any>(null);
  const [fullTask, setFullTask] = useState<any>(null);
  const [depositDrawer, setDepositDrawer] = useState<{ isOpen: boolean; deposit: any | null }>({ isOpen: false, deposit: null });

  // Sync / fetch full contact if only ID is provided
  useEffect(() => {
    if (customerDrawer.isOpen && customerDrawer.contact) {
      const c = customerDrawer.contact;
      if (c.full_name || c.phone || c.email) {
        setFullContact(c);
      } else if (c.id) {
        setFullContact({ ...c, full_name: 'Đang tải thông tin...' });
        api.get(`/contacts/${c.id}`).then(res => {
          const d = res.data?.data || res.data;
          if (d && d.id) {
            setFullContact(d);
          }
        }).catch(() => {
          setFullContact(c);
        });
      }
    } else {
      setFullContact(null);
    }
  }, [customerDrawer.isOpen, customerDrawer.contact]);

  // Sync / fetch full task if only ID is provided
  useEffect(() => {
    if (taskDrawer.isOpen && taskDrawer.task) {
      const t = taskDrawer.task;
      if (t.subject || t.body || t.status) {
        setFullTask(t);
      } else if (t.id) {
        setFullTask({ ...t, subject: 'Đang tải công việc...' });
        api.get(`/activities/${t.id}`).then(res => {
          const d = res.data?.data || res.data;
          if (d && d.id) {
            setFullTask(d);
          }
        }).catch(() => {
          setFullTask(t);
        });
      }
    } else {
      setFullTask(null);
    }
  }, [taskDrawer.isOpen, taskDrawer.task]);

  // Global window CustomEvents listener
  useEffect(() => {
    const handleOpenCustomer = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        const c = custom.detail.contact || custom.detail.contactId || custom.detail.id;
        const tab = custom.detail.initialTab || 'info';
        if (c) openCustomerDrawer(c, tab);
      }
    };

    const handleOpenTask = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        const t = custom.detail.task || custom.detail.taskId || custom.detail.id;
        if (t) openTaskDrawer(t);
      }
    };

    const handleOpenExpense = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        const id = custom.detail.id || custom.detail.expenseId || custom.detail.open_id;
        if (id) openExpenseDrawer(Number(id));
      }
    };

    const handleOpenApproval = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        const id = custom.detail.id || custom.detail.open_id;
        const type = custom.detail.type || custom.detail.open_type || 'leave';
        if (id) {
          openApprovalDrawer({ id: Number(id), type, ...custom.detail });
        }
      }
    };

    const handleOpenDeposit = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        const d = custom.detail.deposit || custom.detail.id || custom.detail.depositId;
        if (d) {
          const depObj = typeof d === 'object' ? d : { id: Number(d) };
          setDepositDrawer({ isOpen: true, deposit: depObj });
        }
      }
    };

    window.addEventListener('open-global-customer', handleOpenCustomer);
    window.addEventListener('open-customer-drawer', handleOpenCustomer);
    window.addEventListener('open-global-task', handleOpenTask);
    window.addEventListener('open-task-drawer', handleOpenTask);
    window.addEventListener('open-expense-drawer', handleOpenExpense);
    window.addEventListener('open-global-expense', handleOpenExpense);
    window.addEventListener('open-approval-drawer', handleOpenApproval);
    window.addEventListener('open-global-approval', handleOpenApproval);
    window.addEventListener('open-deposit-drawer', handleOpenDeposit);

    // Global click listener for .entity-mention and .mention
    const handleGlobalEntityClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('.entity-mention, [data-entity-type]') as HTMLElement | null;
      if (!target) return;
      const type = target.getAttribute('data-entity-type');
      const id = target.getAttribute('data-entity-id');
      if (!type || !id) return;

      e.preventDefault();
      e.stopPropagation();

      if (type === 'contact' || type === 'customer') {
        openCustomerDrawer(Number(id), 'info');
      } else if (type === 'task') {
        openTaskDrawer(Number(id));
      } else if (type === 'approval' || type === 'po' || type === 'purchase_order' || type === 'po_order' || type === 'expense') {
        openExpenseDrawer(Number(id));
      } else if (type === 'leave' || type === 'wfh' || type === 'ot' || type === 'workflow') {
        openApprovalDrawer({ id: Number(id), type: type === 'workflow' ? 'leave' : type });
      } else if (type === 'company') {
        window.dispatchEvent(new CustomEvent('open-company-drawer', { detail: { id: Number(id) } }));
      } else if (type === 'deal' || type === 'so' || type === 'deposit') {
        setDepositDrawer({ isOpen: true, deposit: { id: Number(id) } });
      }
    };

    document.addEventListener('click', handleGlobalEntityClick);

    return () => {
      document.removeEventListener('click', handleGlobalEntityClick);
      window.removeEventListener('open-global-customer', handleOpenCustomer);
      window.removeEventListener('open-customer-drawer', handleOpenCustomer);
      window.removeEventListener('open-global-task', handleOpenTask);
      window.removeEventListener('open-task-drawer', handleOpenTask);
      window.removeEventListener('open-expense-drawer', handleOpenExpense);
      window.removeEventListener('open-global-expense', handleOpenExpense);
      window.removeEventListener('open-approval-drawer', handleOpenApproval);
      window.removeEventListener('open-global-approval', handleOpenApproval);
      window.removeEventListener('open-deposit-drawer', handleOpenDeposit);
    };
  }, [openCustomerDrawer, openTaskDrawer, openExpenseDrawer, openApprovalDrawer]);

  return (
    <>
      {customerDrawer.isOpen && fullContact && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={customerDrawer.isOpen}
            onClose={closeCustomerDrawer}
            contact={fullContact}
            initialTab={customerDrawer.initialTab || 'info'}
            zIndex={2147483645}
          />
        </Suspense>
      )}

      {taskDrawer.isOpen && fullTask && (
        <Suspense fallback={null}>
          <WorkspaceTaskDrawer
            isOpen={taskDrawer.isOpen}
            onClose={closeTaskDrawer}
            task={fullTask}
            zIndex={2147483645}
            onUpdate={() => {
              // Trigger refresh on window event if someone is listening
              window.dispatchEvent(new CustomEvent('task-updated', { detail: fullTask }));
            }}
            onOpenContact={(contactId: number | string) => {
              if (contactId) {
                openCustomerDrawer(Number(contactId), 'info');
              }
            }}
          />
        </Suspense>
      )}

      {expenseDrawer.isOpen && expenseDrawer.expenseId && (
        <Suspense fallback={null}>
          <ExpenseQuickViewDrawer
            expenseId={expenseDrawer.expenseId}
            onClose={closeExpenseDrawer}
            user={currentUser}
            zIndex={2147483645}
          />
        </Suspense>
      )}

      {approvalDrawer.isOpen && approvalDrawer.item && (
        <Suspense fallback={null}>
          <ApprovalDetailDrawer
            item={approvalDrawer.item}
            onClose={closeApprovalDrawer}
            users={[]}
            t={(k: string) => k}
            onApprove={async (it) => {
              try {
                if (it.type === 'leave') {
                  await api.put(`/hrm/leaves/${it.id}/status`, { status: 'approved' });
                } else {
                  await api.post(`/expenses/${it.id}/approve`);
                }
                toast.success('Đã duyệt yêu cầu thành công');
                closeApprovalDrawer();
                window.dispatchEvent(new CustomEvent('refresh-pending-counts'));
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Lỗi khi phê duyệt');
              }
            }}
            onReject={async (it) => {
              const reason = window.prompt('Nhập lý do từ chối:') || '';
              try {
                if (it.type === 'leave') {
                  await api.put(`/hrm/leaves/${it.id}/status`, { status: 'rejected', reject_reason: reason });
                } else {
                  await api.post(`/expenses/${it.id}/reject`, { reason });
                }
                toast.success('Đã từ chối yêu cầu');
                closeApprovalDrawer();
                window.dispatchEvent(new CustomEvent('refresh-pending-counts'));
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Lỗi khi từ chối');
              }
            }}
            isAdmin={Boolean(currentUser?.role === 'admin' || currentUser?.role === 'manager' || (currentUser as any)?.is_admin)}
            zIndex={2147483645}
          />
        </Suspense>
      )}

      {depositDrawer.isOpen && depositDrawer.deposit && (
        <Suspense fallback={null}>
          <DepositDetailDrawer
            isOpen={depositDrawer.isOpen}
            onClose={() => setDepositDrawer({ isOpen: false, deposit: null })}
            deposit={depositDrawer.deposit}
            onSaveSuccess={() => {
              setDepositDrawer({ isOpen: false, deposit: null });
              window.dispatchEvent(new CustomEvent('refresh-deposits'));
            }}
            zIndex={2147483645}
          />
        </Suspense>
      )}
    </>
  );
};
