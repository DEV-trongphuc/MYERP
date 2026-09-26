import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import api from '../../api/axios';

const CustomerProfileDrawer = lazy(() => import('../../pages/CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
const WorkspaceTaskDrawer = lazy(() => import('../../pages/WorkspaceTaskDrawer').then(module => ({ default: module.WorkspaceTaskDrawer })));

export const GlobalEntityDrawers: React.FC = () => {
  const { customerDrawer, closeCustomerDrawer, openCustomerDrawer, taskDrawer, closeTaskDrawer, openTaskDrawer } = useUIStore();
  const [fullContact, setFullContact] = useState<any>(null);
  const [fullTask, setFullTask] = useState<any>(null);

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

    window.addEventListener('open-global-customer', handleOpenCustomer);
    window.addEventListener('open-customer-drawer', handleOpenCustomer);
    window.addEventListener('open-global-task', handleOpenTask);
    window.addEventListener('open-task-drawer', handleOpenTask);

    // Global click listener for .entity-mention and .mention
    const handleGlobalEntityClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('.entity-mention, [data-entity-type]') as HTMLElement | null;
      if (!target) return;
      const type = target.getAttribute('data-entity-type');
      const id = target.getAttribute('data-entity-id');
      const approvalType = target.getAttribute('data-approval-type') || 'expense';
      if (!type || !id) return;

      e.preventDefault();
      e.stopPropagation();

      if (type === 'contact' || type === 'customer') {
        openCustomerDrawer(Number(id), 'info');
      } else if (type === 'task') {
        openTaskDrawer(Number(id));
      } else if (type === 'approval') {
        window.location.href = `/approvals?open_id=${id}&open_type=${approvalType}`;
      } else if (type === 'company') {
        window.dispatchEvent(new CustomEvent('open-company-drawer', { detail: { id: Number(id) } }));
      } else if (type === 'deal') {
        window.dispatchEvent(new CustomEvent('open-deal-drawer', { detail: { id: Number(id) } }));
      }
    };

    document.addEventListener('click', handleGlobalEntityClick);

    return () => {
      document.removeEventListener('click', handleGlobalEntityClick);
      window.removeEventListener('open-global-customer', handleOpenCustomer);
      window.removeEventListener('open-customer-drawer', handleOpenCustomer);
      window.removeEventListener('open-global-task', handleOpenTask);
      window.removeEventListener('open-task-drawer', handleOpenTask);
    };
  }, [openCustomerDrawer, openTaskDrawer]);

  return (
    <>
      {customerDrawer.isOpen && fullContact && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={customerDrawer.isOpen}
            onClose={closeCustomerDrawer}
            contact={fullContact}
            initialTab={customerDrawer.initialTab || 'info'}
            zIndex={10060}
          />
        </Suspense>
      )}

      {taskDrawer.isOpen && fullTask && (
        <Suspense fallback={null}>
          <WorkspaceTaskDrawer
            isOpen={taskDrawer.isOpen}
            onClose={closeTaskDrawer}
            task={fullTask}
            zIndex={10060}
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
    </>
  );
};
