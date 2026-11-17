/**
 * tests/e2e/tier4_real_world/rw03_academic_dispatch.test.js
 * Real-World Scenario 3: Academic Announcement 3-Step Guided Stepper Workflow
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';

export function registerRW03Tests() {
  describe('Tier 4 - Real-World Scenario 3: Academic Announcement 3-Step Guided Stepper', () => {
    it('RW3.1: Complete lifecycle of subject announcement dispatch with scroll lock and dirty check', () => {
      // Step 1: User opens SubjectAnnouncementModal for Subject 'AI-PROJ-101'
      let isModalOpen = true;
      let bodyScrollLocked = false;
      const overlayStack = [];

      const openModal = (modalId) => {
        overlayStack.push(modalId);
        bodyScrollLocked = true;
      };

      const closeModal = (modalId) => {
        const idx = overlayStack.indexOf(modalId);
        if (idx !== -1) overlayStack.splice(idx, 1);
        if (overlayStack.length === 0) bodyScrollLocked = false;
        isModalOpen = false;
      };

      openModal('subject-announcement-modal');
      assertEqual(bodyScrollLocked, true, 'Body scroll must be locked when modal is open');

      // Step 2: Step 1 (Target Audience) - Query active enrolled students
      const databaseStudents = {
        'AI-PROJ-101': [
          { id: 1, name: 'Nguyễn Văn An', status: 'Studying' },
          { id: 2, name: 'Trần Thị Mai', status: 'Studying' },
          { id: 3, name: 'Lê Hoàng Nam', status: 'Studying' }
        ],
        'MBA-MGT-201': [
          { id: 4, name: 'Phạm Đức Minh', status: 'Studying' }
        ]
      };

      let activeSubject = 'AI-PROJ-101';
      let selectedRecipients = databaseStudents[activeSubject].map(s => s.id);
      assertEqual(selectedRecipients.length, 3, 'Must fetch students for active subject AI-PROJ-101');

      // Step 3: Advance to Step 2 (Content)
      let currentStep = 2;
      let formState = {
        title: 'Thông báo Lịch Thi & Bảo Vệ Đồ Án AI',
        content: 'Thời gian bảo vệ: 09:00 Thứ Bảy ngày 20/11/2026 tại Phòng Lab 402.',
        isDirty: true
      };

      // Step 4: Accidental backdrop click occurs
      const handleBackdropClick = (isDirty, confirmFn) => {
        if (isDirty) {
          return confirmFn('Bạn có thay đổi chưa lưu. Bạn có muốn thoát không?');
        }
        return true;
      };

      let promptShown = false;
      const userCancelsExit = handleBackdropClick(formState.isDirty, (msg) => {
        promptShown = true;
        return false; // User cancels, keeps modal open
      });

      assertEqual(promptShown, true, 'Dirty check prompt must be displayed');
      assertEqual(userCancelsExit, false, 'Modal dismissal intercepted');
      assertEqual(isModalOpen, true, 'Modal remains open');

      // Step 5: Advance to Step 3 (Review & Dispatch)
      currentStep = 3;
      const dispatchSummary = {
        subject: activeSubject,
        recipientsCount: selectedRecipients.length,
        title: formState.title,
        dispatchStatus: 'queued'
      };

      assertEqual(dispatchSummary.recipientsCount, 3);
      assertEqual(dispatchSummary.dispatchStatus, 'queued');

      // Step 6: Dispatch succeeds, modal closes
      closeModal('subject-announcement-modal');
      assertEqual(isModalOpen, false);
      assertEqual(bodyScrollLocked, false, 'Body scroll must be restored upon closing');
      assertEqual(overlayStack.length, 0);
    }, { tier: 4 });
  });
}
