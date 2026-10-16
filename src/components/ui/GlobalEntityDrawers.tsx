import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/axios';

const CustomerProfileDrawer = lazy(() => import('../../pages/CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
const WorkspaceTaskDrawer = lazy(() => import('../../pages/WorkspaceTaskDrawer').then(module => ({ default: module.WorkspaceTaskDrawer })));
const ExpenseQuickViewDrawer = lazy(() => import('../ExpenseQuickViewDrawer').then(module => ({ default: module.ExpenseQuickViewDrawer })));
const ExpenseCreateDrawer = lazy(() => import('../ExpenseCreateDrawer').then(module => ({ default: module.ExpenseCreateDrawer })));
const ApprovalDetailDrawer = lazy(() => import('../../pages/Approvals').then(module => ({ default: module.ApprovalDetailDrawer })));
const DepositDetailDrawer = lazy(() => import('../DepositDetailDrawer').then(module => ({ default: module.DepositDetailDrawer })));

export const GlobalEntityDrawers: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    customerDrawer, closeCustomerDrawer, openCustomerDrawer,
    taskDrawer, closeTaskDrawer, openTaskDrawer,
    expenseDrawer, closeExpenseDrawer, openExpenseDrawer,
    approvalDrawer, closeApprovalDrawer, openApprovalDrawer,
    depositDrawer, closeDepositDrawer, openDepositDrawer
  } = useUIStore();
  const currentUser = useAuthStore(state => state.user);
  const [fullContact, setFullContact] = useState<any>(null);
  const [fullTask, setFullTask] = useState<any>(null);
  const [expenseCreateOpen, setExpenseCreateOpen] = useState(false);
  const [expenseCreateEditItem, setExpenseCreateEditItem] = useState<any>(null);
  const approvalActionInFlightRef = useRef(false);

  // Deep link URL listener: Auto-open drawer when navigating with query parameters or direct entity path (e.g. /contact/123)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const path = location.pathname;

    // 1. Contacts: ContactsPage (/contacts, /students) handles its own local drawer
    const isContactsPage = path === '/contacts' || path === '/students' || path.startsWith('/contacts?') || path.startsWith('/students?');
    if (isContactsPage) {
      if (customerDrawer.isOpen && (params.get('open_contact_id') || params.get('id') || params.get('contact_id'))) {
        closeCustomerDrawer();
      }
    } else {
      const contactPathMatch = path.match(/^\/(?:contacts?|students?|leads?|crm)\/([0-9]+)/i);
      const contactId = params.get('contact_id') || (contactPathMatch ? contactPathMatch[1] : null);
      if (contactId && !isNaN(Number(contactId))) {
        openCustomerDrawer(Number(contactId), params.get('tab') || 'info');
        return;
      }
    }

    // 2. Expenses: ExpensesPage does not have a URL param listener for ?open_id= / ?id=, so GlobalEntityDrawers handles it
    const expensePathMatch = path.match(/^\/(?:expenses?|workflow\/expense)\/([0-9]+)/i);
    const expenseId = params.get('expense_id') || (expensePathMatch ? expensePathMatch[1] : null) || (path.startsWith('/expenses') ? (params.get('open_id') || params.get('id')) : null);
    if (expenseId && !isNaN(Number(expenseId))) {
      openExpenseDrawer(Number(expenseId));
      return;
    }

    // 3. Tasks: SalePortal (/workspace, /sale-portal, /) and ProjectsPage (/projects) handle their own local WorkspaceTaskDrawer
    const isLocalTaskPage = path === '/' || path.startsWith('/workspace') || path.startsWith('/sale-portal') || path.startsWith('/projects');
    if (isLocalTaskPage) {
      const localUrlTaskId = params.get('task_id') || params.get('open_task_id');
      if (taskDrawer.isOpen && localUrlTaskId && String(taskDrawer.task?.id) === String(localUrlTaskId)) {
        closeTaskDrawer();
      }
    } else {
      const taskPathMatch = path.match(/^\/tasks?\/([0-9]+)/i);
      const taskId = params.get('task_id') || params.get('open_task_id') || (taskPathMatch ? taskPathMatch[1] : null) || (path.startsWith('/tasks') ? params.get('id') : null);
      if (taskId && !isNaN(Number(taskId))) {
        openTaskDrawer(Number(taskId));
        return;
      }
    }

    // 4. Approvals: Approvals.tsx (/approvals) handles its own local drawer
    if (path.startsWith('/approvals')) {
      if (approvalDrawer.isOpen && (params.get('open_id') || params.get('id') || params.get('approval_id'))) {
        closeApprovalDrawer();
      }
    } else {
      const approvalId = params.get('approval_id');
      if (approvalId && !isNaN(Number(approvalId))) {
        openApprovalDrawer({ id: Number(approvalId), type: params.get('type') || params.get('open_type') || 'leave' });
        return;
      }
    }

    // 5. Deposits: DepositsPage.tsx (/deposits) handles its own local drawer
    if (path.startsWith('/deposits')) {
      if (depositDrawer.isOpen && (params.get('open_id') || params.get('id') || params.get('deposit_id'))) {
        closeDepositDrawer();
      }
    } else {
      const depositId = params.get('deposit_id');
      if (depositId && !isNaN(Number(depositId))) {
        openDepositDrawer(Number(depositId));
        return;
      }
    }
  }, [
    location.pathname,
    location.search,
    openCustomerDrawer,
    closeCustomerDrawer,
    openExpenseDrawer,
    openTaskDrawer,
    closeTaskDrawer,
    openApprovalDrawer,
    closeApprovalDrawer,
    openDepositDrawer,
    closeDepositDrawer
  ]);

  // Sync / fetch full contact if only ID is provided
  useEffect(() => {
    const controller = new AbortController();
    if (customerDrawer.isOpen && customerDrawer.contact) {
      const c = customerDrawer.contact;
      if (c.full_name || c.phone || c.email) {
        setFullContact(c);
      } else if (c.id) {
        setFullContact({ ...c, full_name: 'Đang tải thông tin...' });
        api.get(`/contacts/${c.id}`, { signal: controller.signal }).then(res => {
          if (controller.signal.aborted) return;
          const d = res.data?.data || res.data;
          if (d && d.id) {
            setFullContact(d);
          }
        }).catch((err: any) => {
          if (controller.signal.aborted || err?.name === 'AbortError' || err?.name === 'CanceledError') return;
          setFullContact(c);
        });
      }
    } else {
      setFullContact(null);
    }
    return () => controller.abort();
  }, [customerDrawer.isOpen, customerDrawer.contact]);

  // Sync / fetch full task if only ID is provided
  useEffect(() => {
    const controller = new AbortController();
    if (taskDrawer.isOpen && taskDrawer.task) {
      const t = taskDrawer.task;
      if (t.subject || t.body || t.status || t.id === 'new') {
        setFullTask(t);
      } else if (t.id && t.id !== 'new') {
        setFullTask({ ...t, subject: 'Đang tải công việc...' });
        api.get(`/activities/${t.id}`, { signal: controller.signal }).then(res => {
          if (controller.signal.aborted) return;
          const d = res.data?.data || res.data;
          if (d && d.id) {
            setFullTask(d);
          }
        }).catch((err: any) => {
          if (controller.signal.aborted || err?.name === 'AbortError' || err?.name === 'CanceledError') return;
          setFullTask(t);
        });
      }
    } else {
      setFullTask(null);
    }
    return () => controller.abort();
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
          openDepositDrawer(d);
        }
      }
    };

    const handleOpenExpenseCreate = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        setExpenseCreateEditItem(custom.detail);
        setExpenseCreateOpen(true);
      }
    };

    window.addEventListener('open-global-customer', handleOpenCustomer);
    window.addEventListener('open-global-task', handleOpenTask);
    window.addEventListener('open-expense-drawer', handleOpenExpense);
    window.addEventListener('open-global-expense', handleOpenExpense);
    window.addEventListener('open-expense-create-drawer', handleOpenExpenseCreate);
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
      } else if (type === 'deal') {
        if (window.location.pathname.startsWith('/deals')) {
          window.dispatchEvent(new CustomEvent('open-deal-drawer', { detail: { id: Number(id), dealId: Number(id) } }));
        } else {
          navigate(`/deals?open_deal_id=${id}`);
        }
      } else if (type === 'so' || type === 'deposit') {
        if (window.location.pathname.startsWith('/deposits')) {
          window.dispatchEvent(new CustomEvent('open-deposit-drawer', { detail: { id: Number(id), depositId: Number(id) } }));
        } else {
          openDepositDrawer(Number(id));
        }
      }
    };

    document.addEventListener('click', handleGlobalEntityClick);

    return () => {
      document.removeEventListener('click', handleGlobalEntityClick);
      window.removeEventListener('open-global-customer', handleOpenCustomer);
      window.removeEventListener('open-global-task', handleOpenTask);
      window.removeEventListener('open-expense-drawer', handleOpenExpense);
      window.removeEventListener('open-global-expense', handleOpenExpense);
      window.removeEventListener('open-expense-create-drawer', handleOpenExpenseCreate);
      window.removeEventListener('open-global-approval', handleOpenApproval);
      window.removeEventListener('open-deposit-drawer', handleOpenDeposit);
    };
  }, [openCustomerDrawer, openTaskDrawer, openExpenseDrawer, openApprovalDrawer, openDepositDrawer, navigate]);

  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    if (approvalDrawer.isOpen) {
      api.get('/users').then(res => {
        const u = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        if (u.length > 0) setUsersList(u);
      }).catch(() => {});
    }
  }, [approvalDrawer.isOpen]);

  const clearUrlEntityParams = (paramKeys: string[]) => {
    const params = new URLSearchParams(location.search || window.location.search);
    let changed = false;
    const allKeys = [
      ...paramKeys,
      'open_contact_id',
      'open_id',
      'open_type',
      'open_status',
      'open_deposit_id',
      'task_id',
      'open_task_id',
      'highlight_activity_id',
      'highlight_comment_id',
      'highlight_note_id',
      'subtask_id',
      'comment_id'
    ];
    allKeys.forEach((k) => {
      if (params.has(k)) {
        params.delete(k);
        changed = true;
      }
    });
    if (changed) {
      const nextSearch = params.toString();
      navigate({ pathname: location.pathname, search: nextSearch ? '?' + nextSearch : '' }, { replace: true });
    }
  };

  const handleCloseCustomerDrawer = () => {
    (window as any).__activeErpProposalId = null;
    clearUrlEntityParams(['contact_id', 'open_contact_id', 'id', 'tab']);
    closeCustomerDrawer();
  };

  const handleCloseTaskDrawer = () => {
    (window as any).__activeErpProposalId = null;
    clearUrlEntityParams(['task_id', 'open_id', 'id']);
    closeTaskDrawer();
  };

  const handleCloseExpenseDrawer = () => {
    (window as any).__activeErpProposalId = null;
    clearUrlEntityParams(['expense_id', 'open_id', 'id']);
    closeExpenseDrawer();
  };

  const handleCloseApprovalDrawer = () => {
    (window as any).__activeErpProposalId = null;
    clearUrlEntityParams(['approval_id', 'open_id', 'open_type', 'open_status', 'id', 'type']);
    closeApprovalDrawer();
  };

  const handleCloseDepositDrawer = () => {
    (window as any).__activeErpProposalId = null;
    clearUrlEntityParams(['deposit_id', 'open_deposit_id', 'open_id', 'id']);
    closeDepositDrawer();
  };

  return (
    <>
      {customerDrawer.isOpen && fullContact && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={customerDrawer.isOpen}
            onClose={handleCloseCustomerDrawer}
            contact={fullContact}
            initialTab={customerDrawer.initialTab || 'info'}
            zIndex={2147483620}
          />
        </Suspense>
      )}

      {taskDrawer.isOpen && fullTask && (
        <Suspense fallback={null}>
          <WorkspaceTaskDrawer
            isOpen={taskDrawer.isOpen}
            onClose={handleCloseTaskDrawer}
            task={fullTask}
            zIndex={2147483640}
            onUpdate={(updatedTask?: any) => {
              if (updatedTask) {
                setFullTask((prev: any) => prev ? { ...prev, ...updatedTask } : updatedTask);
              }
              const detail = updatedTask || fullTask;
              window.dispatchEvent(new CustomEvent('task-updated', { detail }));
              window.dispatchEvent(new CustomEvent('task-local-updated', { detail }));
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
            onClose={handleCloseExpenseDrawer}
            user={currentUser}
            zIndex={2147483620}
          />
        </Suspense>
      )}

      {expenseCreateOpen && (
        <Suspense fallback={null}>
          <ExpenseCreateDrawer
            isOpen={expenseCreateOpen}
            onClose={() => {
              (window as any).__activeErpProposalId = null;
              setExpenseCreateOpen(false);
              setExpenseCreateEditItem(null);
            }}
            editItem={expenseCreateEditItem}
            user={currentUser}
            onSaveSuccess={() => {
              setExpenseCreateOpen(false);
              setExpenseCreateEditItem(null);
              window.dispatchEvent(new CustomEvent('refresh-pending-counts'));
              window.dispatchEvent(new CustomEvent('erp-action-completed', { detail: { actionType: 'expense' } }));
            }}
            zIndex={2147483620}
          />
        </Suspense>
      )}

      {approvalDrawer.isOpen && approvalDrawer.item && (
        <Suspense fallback={null}>
          <ApprovalDetailDrawer
            item={approvalDrawer.item}
            onClose={handleCloseApprovalDrawer}
            users={usersList}
            t={(k: string) => k}
            onApprove={async (it) => {
              if (approvalActionInFlightRef.current) return;
              approvalActionInFlightRef.current = true;
              const itemType = String(it.type || '').toLowerCase();
              try {
                if (itemType === 'leave' || itemType === 'wfh' || itemType === 'ot' || itemType === 'late_early') {
                  await api.put('/hrm/leaves/' + it.id + '/status', { status: 'approved' });
                } else if (itemType === 'advance') {
                  await api.put('/hrm/advances/' + it.id + '/status', { status: 'approved' });
                } else if (itemType === 'checkin') {
                  await api.post('/attendance/check-ins/' + it.id + '/approve');
                } else if (itemType === 'attendance_bulk') {
                  await api.post('/attendance/bulk-requests/' + it.id + '/approve');
                } else {
                  await api.post('/expenses/' + it.id + '/approve');
                }
                toast.success('Đã duyệt yêu cầu thành công');
                handleCloseApprovalDrawer();
                window.dispatchEvent(new CustomEvent('refresh-pending-counts'));
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Lỗi khi phê duyệt');
              } finally {
                approvalActionInFlightRef.current = false;
              }
            }}
            onReject={async (it) => {
              if (approvalActionInFlightRef.current) return;
              const reason = window.prompt('Nhập lý do từ chối:') || '';
              approvalActionInFlightRef.current = true;
              const itemType = String(it.type || '').toLowerCase();
              try {
                if (itemType === 'leave' || itemType === 'wfh' || itemType === 'ot' || itemType === 'late_early') {
                  await api.put('/hrm/leaves/' + it.id + '/status', { status: 'rejected', reject_reason: reason });
                } else if (itemType === 'advance') {
                  await api.put('/hrm/advances/' + it.id + '/status', { status: 'rejected', reject_reason: reason });
                } else if (itemType === 'checkin') {
                  await api.post('/attendance/check-ins/' + it.id + '/reject', { reason });
                } else if (itemType === 'attendance_bulk') {
                  await api.post('/attendance/bulk-requests/' + it.id + '/reject', { reason });
                } else {
                  await api.post('/expenses/' + it.id + '/reject', { reason });
                }
                toast.success('Đã từ chối yêu cầu');
                handleCloseApprovalDrawer();
                window.dispatchEvent(new CustomEvent('refresh-pending-counts'));
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Lỗi khi từ chối');
              } finally {
                approvalActionInFlightRef.current = false;
              }
            }}
            isAdmin={Boolean(currentUser?.role === 'admin' || currentUser?.role === 'manager' || (currentUser as any)?.is_admin)}
            onEdit={(it) => {
              handleCloseApprovalDrawer();
              if (window.location.pathname.startsWith('/approvals')) {
                window.dispatchEvent(new CustomEvent('open-approval-item', { detail: { id: it.id, type: it.type, raw: it, mode: 'edit' } }));
              } else {
                navigate(`/approvals?open_id=${it.id}&open_type=${it.type}&action=edit`);
              }
            }}
            onDuplicate={(it) => {
              handleCloseApprovalDrawer();
              if (window.location.pathname.startsWith('/approvals')) {
                window.dispatchEvent(new CustomEvent('open-approval-item', { detail: { id: it.id, type: it.type, raw: it, mode: 'duplicate' } }));
              } else {
                navigate(`/approvals?open_id=${it.id}&open_type=${it.type}&action=duplicate`);
              }
            }}
            zIndex={2147483620}
          />
        </Suspense>
      )}

      {depositDrawer.isOpen && depositDrawer.deposit && (
        <Suspense fallback={null}>
          <DepositDetailDrawer
            isOpen={depositDrawer.isOpen}
            onClose={handleCloseDepositDrawer}
            deposit={depositDrawer.deposit}
            onSaveSuccess={() => {
              handleCloseDepositDrawer();
              window.dispatchEvent(new CustomEvent('refresh-deposits'));
              window.dispatchEvent(new CustomEvent('erp-action-completed', { detail: { actionType: 'deposit' } }));
            }}
            zIndex={2147483620}
          />
        </Suspense>
      )}
    </>
  );
};
