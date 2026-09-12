import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Wallet,
  Upload,
  Loader2,
  Truck,
  Coffee,
  Home,
  Briefcase,
  CreditCard,
  Tag,
  CheckCircle2,
  Building2,
  ChevronDown,
  ChevronLeft,
  FileText,
  Plus,
  Search,
  Check,
  Users,
  User,
  Landmark,
  Zap,
  Bookmark,
  Receipt,
  Trash2,
  Copy,
  FileSignature
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { CustomSelect } from './ui/CustomSelect';
import { Avatar } from './ui/Avatar';
import { compressToWebP } from '../utils/imageCompress';
import { PasteDropzoneArea } from './ui/PasteDropzoneArea';
import { resolveTeamLeaderId } from '../utils/teamLeader';
import { DraftExitConfirmModal } from './ui/DraftExitConfirmModal';
import { BankSelect } from './ui/BankSelect';
import { getVietQrUrl, findBank } from '../utils/vietnamBanks';
import { getSystemTitle } from '../config/env';
import { VietnameseDateInput } from './ui/VietnameseDateInput';

const CATEGORIES = [
  { value: 'travel', label: 'Vận Chuyển', icon: Truck, color: '#3b82f6' },
  { value: 'client_meeting', label: 'Ăn uống', icon: Coffee, color: '#f59e0b' },
  { value: 'general', label: 'Vận hành', icon: Home, color: '#10b981' },
  { value: 'marketing', label: 'Marketing', icon: Briefcase, color: '#ef4444' },
  { value: 'stationery', label: 'Văn phòng phẩm', icon: CreditCard, color: '#BD1D2D' },
  { value: 'hr', label: 'Nhân sự', icon: Tag, color: '#06b6d4' },
];

const EMPTY_FORM = {
  title: '',
  category: 'Vận hành',
  amount: '',
  currency: 'VND',
  vat_amount: '',
  date: '',
  notes: '',
  approver_id: null as number | null,
  approver_id_2: null as number | null,
  approver_id_3: null as number | null,
  related_user_ids: [] as number[],
  vendor_name: '',
  has_vat_invoice: true,
  is_vat_inclusive: true,
  entities: [] as any[],
  image_url: '',
  request_bank_transfer: true,
  bank_name: '',
  bank_account_number: '',
  bank_account_name: '',
  bank_branch: ''
};

const extractExpenseTitleSuffix = (rawTitle: string) => {
  if (!rawTitle) return '';
  const trimmed = rawTitle.trim();
  const prefixes = [
    'Đề nghị thanh toán',
    'Đề xuất thanh toán',
    'Thanh toán',
    'Đề nghị tạm ứng',
    'Tạm ứng'
  ];
  for (const p of prefixes) {
    const regex = new RegExp(`^${p}\\s*([—\\-–:]\\s*)?`, 'i');
    if (regex.test(trimmed)) {
      return trimmed.replace(regex, '').trim();
    }
  }
  return trimmed;
};

export interface ExpenseItemRow {
  id: number | string;
  content: string;
  quantity: number | string;
  price: number;
  vat: number;
}

const formatNumberWithDots = (val: string | number) => {
  if (val === undefined || val === null || val === '') return '';
  const numStr = String(val).replace(/\D/g, '');
  if (!numStr) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(numStr));
};

const formatApprovalCurrency = (amount: number | string, currency: string = 'VND') => {
  const num = Number(amount) || 0;
  if (currency === 'USD') return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (currency === 'EURO' || currency === 'EUR') return `€${num.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return `${num.toLocaleString('vi-VN')} ₫`;
};

function docSoTiengViet(num: number): string {
  if (num === 0) return 'Không đồng';
  if (num < 0) return 'Âm ' + docSoTiengViet(Math.abs(num)).toLowerCase();

  const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  const readThreeDigits = (n: number, isFirst: boolean): string => {
    let hundred = Math.floor(n / 100);
    let ten = Math.floor((n % 100) / 10);
    let single = n % 10;
    let res = '';

    if (hundred > 0 || !isFirst) {
      res += digits[hundred] + ' trăm ';
    }

    if (ten > 0) {
      if (ten === 1) {
        res += 'mười ';
      } else {
        res += digits[ten] + ' mươi ';
      }
    } else if (hundred > 0 && single > 0) {
      res += 'lẻ ';
    }

    if (single > 0) {
      if (single === 1 && ten > 1) {
        res += 'mốt';
      } else if (single === 5 && ten > 0) {
        res += 'lăm';
      } else if (single === 4 && ten > 1) {
        res += 'tư';
      } else {
        res += digits[single];
      }
    }

    return res.trim();
  };

  let cleanNum = Math.floor(num);
  let groups = [];
  while (cleanNum > 0) {
    groups.push(cleanNum % 1000);
    cleanNum = Math.floor(cleanNum / 1000);
  }

  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    let groupVal = groups[i];
    if (groupVal === 0) {
      continue;
    }
    
    let isFirst = (i === groups.length - 1);
    let groupStr = readThreeDigits(groupVal, isFirst);
    result += groupStr + units[i] + ' ';
  }

  result = result.trim();
  if (!result) return 'Không đồng';
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

interface ExpenseCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: any;
  initialDate?: string; // YYYY-MM-DD
  onSaveSuccess: () => void;
  user: any;
  users?: any[];
  zIndex?: number;
}

export const ExpenseCreateDrawer: React.FC<ExpenseCreateDrawerProps> = ({
  isOpen,
  onClose,
  editItem,
  initialDate,
  onSaveSuccess,
  user,
  users: propUsers,
  zIndex
}) => {
  const baseZIndex = zIndex || 2000000000;
  const { addToast } = useUIStore();
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const [titleSuffix, setTitleSuffix] = useState<string>('');

  // Multi-line payment breakdown table
  const [expenseItems, setExpenseItems] = useState<ExpenseItemRow[]>([
    { id: Date.now(), content: '', quantity: 1, price: 0, vat: 10 }
  ]);

  // Classification & Payment Targets
  const [expenseCategory, setExpenseCategory] = useState<string>('general');
  const [invoiceType, setInvoiceType] = useState<string>('vat_10');
  const [paymentTarget, setPaymentTarget] = useState<string>('Nội bộ');
  const [paymentMethod, setPaymentMethod] = useState<string>('Chuyển khoản');
  const [currencyType, setCurrencyType] = useState<string>('VND');

  // Dynamic Beneficiary States
  const [paymentEmployeeId, setPaymentEmployeeId] = useState<string>('');
  const [paymentSupplierId, setPaymentSupplierId] = useState<string>('');
  const [paymentLecturerId, setPaymentLecturerId] = useState<string>('');
  const [paymentContactId, setPaymentContactId] = useState<string>('');
  const [paymentBeneficiaryName, setPaymentBeneficiaryName] = useState<string>('');
  const [paymentBankName, setPaymentBankName] = useState<string>('');
  const [paymentBankAccount, setPaymentBankAccount] = useState<string>('');
  const [paymentAccountName, setPaymentAccountName] = useState<string>('');
  const [paymentBankBranch, setPaymentBankBranch] = useState<string>('');
  const [paymentPhone, setPaymentPhone] = useState<string>('');
  const [paymentTaxCode, setPaymentTaxCode] = useState<string>('');

  // Cash / Wallet / Credit card / Gov Agency states
  const [paymentDestination, setPaymentDestination] = useState<string>('');
  const [paymentWalletType, setPaymentWalletType] = useState<'momo' | 'zalopay' | 'viettel_money'>('momo');
  const [paymentWalletPhone, setPaymentWalletPhone] = useState<string>('');
  const [paymentCorporateCard, setPaymentCorporateCard] = useState<string>('');
  const [paymentGovAgencyType, setPaymentGovAgencyType] = useState<'tax' | 'social_insurance' | 'treasury' | 'other'>('tax');
  const [paymentGovDecisionNumber, setPaymentGovDecisionNumber] = useState<string>('');

  // QR Modal preview
  const [previewQrModalUrl, setPreviewQrModalUrl] = useState<string | null>(null);

  // Totals calculations
  const itemsTotalBeforeTax = useMemo(() => {
    return expenseItems.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);
  }, [expenseItems]);

  const itemsTotalVat = useMemo(() => {
    return expenseItems.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0) * (Number(it.vat) || 0) / 100, 0);
  }, [expenseItems]);

  const itemsGrandTotal = useMemo(() => {
    return itemsTotalBeforeTax + itemsTotalVat;
  }, [itemsTotalBeforeTax, itemsTotalVat]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    setForm((prev: any) => ({
      ...prev,
      amount: String(itemsGrandTotal),
      vat_amount: itemsTotalVat > 0 ? String(itemsTotalVat) : '0',
      has_vat_invoice: itemsTotalVat > 0
    }));
  }, [itemsGrandTotal, itemsTotalVat]);

  const handleSuffixChange = (val: string) => {
    setTitleSuffix(val);
    const trimmed = val.trim();
    const combined = trimmed ? `Đề nghị thanh toán — ${trimmed}` : 'Đề nghị thanh toán';
    setForm((prev: any) => ({ ...prev, title: combined }));
  };

  const [threshold, setThreshold] = useState<number>(5000000);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const fileInputMultiRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<any[]>(propUsers && propUsers.length > 0 ? propUsers : []);
  const [contacts, setContacts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Security guard: Only creator can edit
  useEffect(() => {
    if (isOpen && editItem && editItem.id && !editItem.isClone) {
      const creatorId = Number(editItem.created_by || editItem.user_id);
      const currentUserId = Number(user?.id);
      if (creatorId && currentUserId && creatorId !== currentUserId) {
        addToast('Chỉ người tạo phiếu mới có quyền chỉnh sửa', 'error');
        onClose();
      }
    }
  }, [isOpen, editItem, user?.id]);

  const isInitializedRef = useRef(false);
  const prevOpenRef = useRef(false);
  const prevEditItemRef = useRef<any>(null);
  const [allocationType, setAllocationType] = useState<'contact' | 'company'>('contact');
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  const EXPENSE_DRAFT_KEY = 'myerp_expense_create_draft';
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [existingDraft, setExistingDraft] = useState<any>(null);

  // Check for saved draft
  useEffect(() => {
    if (isOpen && !editItem) {
      try {
        const saved = localStorage.getItem(EXPENSE_DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.form?.title || parsed.form?.amount || parsed.form?.notes || (parsed.images && parsed.images.length > 0))) {
            setExistingDraft(parsed);
          } else {
            setExistingDraft(null);
          }
        } else {
          setExistingDraft(null);
        }
      } catch {
        setExistingDraft(null);
      }
    } else if (!isOpen) {
      setShowExitConfirm(false);
    }
  }, [isOpen, editItem]);

  const isFormDirty = () => {
    if (editItem) return false;
    return Boolean(
      titleSuffix?.trim() ||
      form.title?.trim() ||
      (Number(form.amount) || 0) > 0 ||
      form.notes?.trim() ||
      images.length > 0 ||
      paymentBeneficiaryName?.trim() ||
      paymentBankAccount?.trim() ||
      (expenseItems && expenseItems.some(i => i.content?.trim() || (Number(i.price) || 0) > 0))
    );
  };

  const saveDraftToStorage = () => {
    const payload = {
      form,
      titleSuffix,
      expenseItems,
      images,
      expenseCategory,
      invoiceType,
      paymentTarget,
      paymentMethod,
      currencyType,
      paymentEmployeeId,
      paymentSupplierId,
      paymentLecturerId,
      paymentContactId,
      paymentBeneficiaryName,
      paymentBankName,
      paymentBankAccount,
      paymentAccountName,
      paymentBankBranch,
      paymentPhone,
      paymentTaxCode,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(EXPENSE_DRAFT_KEY, JSON.stringify(payload));
      setExistingDraft(payload);
    } catch (e) {
      console.error('Failed to save expense draft', e);
    }
  };

  const handleSaveDraftAndExit = () => {
    saveDraftToStorage();
    addToast('Đã lưu bản nháp chi phí thành công!', 'success');
    setShowExitConfirm(false);
    onClose();
  };

  const handleExplicitSaveDraft = () => {
    saveDraftToStorage();
    addToast('Đã lưu bản nháp chi phí thành công!', 'success');
  };

  const handleDiscardAndExit = () => {
    try {
      localStorage.removeItem(EXPENSE_DRAFT_KEY);
    } catch {}
    setExistingDraft(null);
    setShowExitConfirm(false);
    onClose();
  };

  const handleRequestClose = () => {
    if (isFormDirty()) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleRestoreDraft = () => {
    if (!existingDraft) return;
    if (existingDraft.form) setForm({ ...EMPTY_FORM, ...existingDraft.form });
    if (existingDraft.titleSuffix !== undefined) {
      setTitleSuffix(existingDraft.titleSuffix);
    } else if (existingDraft.form?.title) {
      setTitleSuffix(extractExpenseTitleSuffix(existingDraft.form.title));
    }
    if (Array.isArray(existingDraft.expenseItems) && existingDraft.expenseItems.length > 0) {
      setExpenseItems(existingDraft.expenseItems);
    }
    if (Array.isArray(existingDraft.images)) setImages(existingDraft.images);
    if (existingDraft.expenseCategory) setExpenseCategory(existingDraft.expenseCategory);
    if (existingDraft.invoiceType) setInvoiceType(existingDraft.invoiceType);
    if (existingDraft.paymentTarget) setPaymentTarget(existingDraft.paymentTarget);
    if (existingDraft.paymentMethod) setPaymentMethod(existingDraft.paymentMethod);
    if (existingDraft.currencyType) setCurrencyType(existingDraft.currencyType);
    if (existingDraft.paymentEmployeeId) setPaymentEmployeeId(existingDraft.paymentEmployeeId);
    if (existingDraft.paymentSupplierId) setPaymentSupplierId(existingDraft.paymentSupplierId);
    if (existingDraft.paymentLecturerId) setPaymentLecturerId(existingDraft.paymentLecturerId);
    if (existingDraft.paymentContactId) setPaymentContactId(existingDraft.paymentContactId);
    if (existingDraft.paymentBeneficiaryName) setPaymentBeneficiaryName(existingDraft.paymentBeneficiaryName);
    if (existingDraft.paymentBankName) setPaymentBankName(existingDraft.paymentBankName);
    if (existingDraft.paymentBankAccount) setPaymentBankAccount(existingDraft.paymentBankAccount);
    if (existingDraft.paymentAccountName) setPaymentAccountName(existingDraft.paymentAccountName);
    if (existingDraft.paymentBankBranch) setPaymentBankBranch(existingDraft.paymentBankBranch);
    if (existingDraft.paymentPhone) setPaymentPhone(existingDraft.paymentPhone);
    if (existingDraft.paymentTaxCode) setPaymentTaxCode(existingDraft.paymentTaxCode);
    addToast('Đã khôi phục dữ liệu bản nháp chi phí', 'info');
    setExistingDraft(null);
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(EXPENSE_DRAFT_KEY);
    } catch {}
    setExistingDraft(null);
    addToast('Đã xóa bản nháp', 'info');
  };

  // Lecturer options from companies + users
  const lecturerOptions = useMemo(() => {
    const list: any[] = [];
    const seenNames = new Set<string>();
    const safeCompanies = Array.isArray(companies) ? companies : ((companies as any)?.items || []);
    const safeUsers = Array.isArray(users) ? users : ((users as any)?.items || []);

    safeCompanies.forEach((co: any) => {
      const coType = String(co.type || co.category || '').toLowerCase();
      const name = co.name || '';
      if (coType.includes('lecturer') || coType.includes('giảng viên') || coType.includes('chuyên gia') || name.toLowerCase().includes('giảng viên')) {
        seenNames.add(name.toLowerCase());
        list.push({
          value: `company_${co.id}`,
          label: name,
          source: 'company',
          raw: co,
          bank_name: co.bank_name || '',
          bank_account: co.bank_account_number || co.bank_account || '',
          bank_account_name: co.bank_account_name || name,
          phone: co.phone || '',
          sublabel: `Giảng viên B2B • ${co.bank_name ? `${co.bank_name}: ${co.bank_account_number || co.bank_account}` : 'Chưa có STK'}`
        });
      }
    });

    safeUsers.forEach((u: any) => {
      const role = String(u.role || '').toLowerCase();
      const job = String(u.job_title || '').toLowerCase();
      const isLec = role.includes('teacher') || role.includes('giang_vien') || role.includes('tro_giang') || job.includes('giảng viên') || job.includes('học thuật');
      const uName = u.full_name || u.name || '';
      if (isLec && uName && !seenNames.has(uName.toLowerCase())) {
        list.push({
          value: `user_${u.id}`,
          label: uName,
          source: 'user',
          raw: u,
          avatar: u.avatar_url || u.avatar,
          bank_name: u.bank_name || '',
          bank_account: u.bank_account || '',
          bank_account_name: uName,
          phone: u.phone || '',
          sublabel: `Giảng viên nội bộ • ${u.bank_name ? `${u.bank_name}: ${u.bank_account}` : 'Chưa có STK'}`
        });
      }
    });

    return list;
  }, [companies, users]);

  // Partners: unified suppliers + companies
  const partnerOptions = useMemo(() => {
    const list: any[] = [];
    const seenNames = new Set<string>();
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : ((suppliers as any)?.items || (suppliers as any)?.suppliers || []);
    const safeCompanies = Array.isArray(companies) ? companies : ((companies as any)?.items || []);

    safeSuppliers.forEach((s: any) => {
      if (s.name) {
        seenNames.add(s.name.toLowerCase());
        list.push({
          value: `sup_${s.id}`,
          label: s.name,
          source: 'supplier',
          raw: s,
          bank_name: s.bank_name || '',
          bank_account: s.bank_account || '',
          bank_account_name: s.bank_account_name || s.name || '',
          tax_code: s.tax_code || '',
          phone: s.phone || '',
          sublabel: `Nhà cung cấp • MST: ${s.tax_code || 'N/A'}${s.bank_name ? ` • ${s.bank_name}` : ''}`
        });
      }
    });

    safeCompanies.forEach((co: any) => {
      const name = co.name || '';
      if (name && !seenNames.has(name.toLowerCase())) {
        const tier = String(co.tier || '').toUpperCase();
        list.push({
          value: `company_${co.id}`,
          label: name,
          source: 'company',
          raw: co,
          bank_name: co.bank_name || '',
          bank_account: co.bank_account_number || co.bank_account || '',
          bank_account_name: co.bank_account_name || name,
          tax_code: co.tax_id || '',
          phone: co.phone || '',
          sublabel: `Đối tác ${tier || 'B2B'}${co.tax_id ? ` • MST: ${co.tax_id}` : ''}${co.bank_name ? ` • ${co.bank_name}` : ''}`
        });
      }
    });

    return list;
  }, [suppliers, companies]);

  // Contacts (Clients / Students)
  const contactOptions = useMemo(() => {
    const safeContacts = Array.isArray(contacts) ? contacts : ((contacts as any)?.items || []);
    return safeContacts.map((c: any) => {
      const name = c.full_name || c.name || `Khách hàng #${c.id}`;
      return {
        value: String(c.id),
        label: name,
        raw: c,
        avatar: c.avatar_url || c.avatar,
        phone: c.phone || '',
        email: c.email || '',
        bank_name: c.bank_name || '',
        bank_account: c.bank_account || '',
        bank_account_name: c.bank_account_name || name,
        sublabel: [c.phone, c.email].filter(Boolean).join(' • ')
      };
    });
  }, [contacts]);

  // Fetch initial system settings & dependencies
  useEffect(() => {
    if (isOpen) {
      if (propUsers && propUsers.length > 0) {
        setUsers(propUsers);
      }

      api.get('/api.php?action=get_settings').then(r => {
        if (r.data?.data) {
          const matching = r.data.data.find((s: any) => s.setting_key === 'po_three_level_threshold');
          if (matching && !isNaN(Number(matching.setting_value))) {
            setThreshold(Number(matching.setting_value));
          }
        }
      }).catch(() => {});

      api.get('/users').then(r => {
        const d = r.data?.data || r.data;
        const list = Array.isArray(d) ? d : (d?.items || []);
        if (list.length > 0) {
          setUsers(list);
        }
      }).catch(() => {});

      api.get('/teams').then(r => {
        const d = r.data?.data;
        setTeams(Array.isArray(d) ? d : (r.data || []));
      }).catch(() => {});

      api.get('/suppliers').then(r => {
        const d = r.data.data;
        setSuppliers(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});

      api.get('/contacts?limit=1000').then(r => {
        const d = r.data.data;
        setContacts(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});

      api.get('/companies?limit=1000').then(r => {
        const d = r.data.data;
        setCompanies(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});
    }
  }, [isOpen, propUsers]);

  // Auto-fill logged in user's bank details if target is 'Nội bộ'
  useEffect(() => {
    if (isOpen && !editItem && user && paymentTarget === 'Nội bộ' && !paymentEmployeeId) {
      const currentEmp = users.find(u => Number(u.id) === Number(user.id)) || user;
      if (currentEmp) {
        setPaymentEmployeeId(String(currentEmp.id));
        setPaymentBeneficiaryName(currentEmp.full_name || currentEmp.name || '');
        if (currentEmp.bank_name) setPaymentBankName(currentEmp.bank_name);
        if (currentEmp.bank_account) setPaymentBankAccount(currentEmp.bank_account);
        const accName = currentEmp.full_name || currentEmp.name || '';
        if (accName) setPaymentAccountName(accName.toUpperCase());
        if (currentEmp.phone) setPaymentPhone(currentEmp.phone);
      }
    }
  }, [isOpen, editItem, user, paymentTarget, paymentEmployeeId, users]);

  // Initialize form state when opening or when editItem changes
  useEffect(() => {
    if (isOpen) {
      const isNewlyOpened = !prevOpenRef.current;
      const isItemChanged = editItem !== prevEditItemRef.current;

      if (isNewlyOpened || isItemChanged) {
        prevOpenRef.current = true;
        prevEditItemRef.current = editItem;

        if (editItem) {
          // Extract existing images
          const existingImages: string[] = [];
          if (editItem.image_url) {
            existingImages.push(editItem.image_url);
          }
          if (editItem.notes) {
            const matches = editItem.notes.matchAll(/([^\n\r(•]+)\s*\((https?:\/\/[^\s)]+|\/backend\/[^\s)]+|uploads\/[^\s)]+)\)/gi);
            for (const m of matches) {
              const url = m[2].trim();
              if (url && !existingImages.includes(url)) {
                existingImages.push(url);
              }
            }
          }
          setImages(existingImages);

          // Bank details parsing
          const bankRegex = /\[Thông tin chuyển khoản\]:\s*([^\-]+)\s*-\s*STK:\s*([^\-]+)\s*-\s*Chủ TK:\s*([^\n-]+)(?:\s*-\s*Chi nhánh:\s*([^\n]+))?/;
          const match = editItem.notes?.match(bankRegex);
          let parsedBankName = editItem.bank_name || '';
          let parsedBankAccount = editItem.bank_account_number || editItem.bank_account || '';
          let parsedAccountName = editItem.bank_account_name || '';
          let parsedBranch = '';

          if (match) {
            parsedBankName = match[1].trim();
            parsedBankAccount = match[2].trim();
            parsedAccountName = match[3].trim();
            if (match[4]) parsedBranch = match[4].trim();
          }

          setPaymentBankName(parsedBankName);
          setPaymentBankAccount(parsedBankAccount);
          setPaymentAccountName(parsedAccountName);
          setPaymentBankBranch(parsedBranch);

          const initialSuffix = extractExpenseTitleSuffix(editItem.title || '');
          setTitleSuffix(initialSuffix);
          const fullTitle = initialSuffix ? `Đề nghị thanh toán — ${initialSuffix}` : (editItem.title || '');

          let initialCategory = editItem.category || 'Vận hành';
          if (initialCategory === 'Di chuyển' || initialCategory === 'Vận chuyển') initialCategory = 'travel';
          else if (initialCategory === 'Ăn uống') initialCategory = 'client_meeting';
          else if (initialCategory === 'Vận hành') initialCategory = 'general';
          else if (initialCategory === 'Marketing') initialCategory = 'marketing';
          else if (initialCategory === 'Văn phòng phẩm' || initialCategory === 'Công cụ') initialCategory = 'stationery';
          else if (initialCategory === 'Nhân sự') initialCategory = 'hr';
          setExpenseCategory(initialCategory);

          setPaymentBeneficiaryName(editItem.vendor_name || '');
          setCurrencyType(editItem.currency || 'VND');

          let cleanNotes = editItem.notes ? editItem.notes
            .replace(/\[Chi tiết các khoản chi\]:[^\n]*(\n[•\-*][^\n]*)*\s*/gi, '')
            .replace(/\[Hồ sơ chi phí[^\]]*\]:[^\n]*/gi, '')
            .replace(/\[Thông tin chuyển khoản[^\]]*\]:[^\n]*/gi, '')
            .replace(/\[Tài liệu đính kèm[^\]]*\]:[^\n]*(\n•[^\n]*)*\s*/gi, '')
            .trim() : '';

          setForm({
            title: fullTitle,
            category: initialCategory,
            amount: String(editItem.amount || 0),
            currency: editItem.currency || 'VND',
            vat_amount: editItem.vat_amount ? String(editItem.vat_amount) : '',
            date: editItem.date || new Date().toISOString().split('T')[0],
            notes: cleanNotes,
            approver_id: editItem.approver_id ? Number(editItem.approver_id) : null,
            approver_id_2: editItem.approver_id_2 ? Number(editItem.approver_id_2) : null,
            approver_id_3: editItem.approver_id_3 ? Number(editItem.approver_id_3) : null,
            related_user_ids: Array.isArray(editItem.related_user_ids) ? editItem.related_user_ids.map(Number) : [],
            vendor_name: editItem.vendor_name || '',
            has_vat_invoice: !!editItem.has_vat_invoice,
            is_vat_inclusive: !!editItem.is_vat_inclusive,
            entities: Array.isArray(editItem.entities) ? editItem.entities : [],
            image_url: editItem.image_url || '',
            request_bank_transfer: true,
            bank_name: parsedBankName,
            bank_account_number: parsedBankAccount,
            bank_account_name: parsedAccountName
          });

          // Expense items breakdown parsing
          if (Array.isArray(editItem.items) && editItem.items.length > 0) {
            setExpenseItems(editItem.items.map((it: any, idx: number) => ({
              id: it.id || Date.now() + idx,
              content: it.content || it.name || '',
              quantity: Number(it.quantity) || 1,
              price: Number(it.price) || 0,
              vat: Number(it.vat !== undefined ? it.vat : 10)
            })));
          } else {
            const rawNotes = editItem.notes || editItem.description || '';
            const itemMatches = Array.from(rawNotes.matchAll(/[•\-*]?\s*\[?(\d+)\]?\s*([^\-\n]+?)\s*-\s*SL:\s*(\d+(?:\.\d+)?)\s*-\s*Đơn giá:\s*([0-9.,]+)[^\-]*-\s*VAT:\s*(\d+)%/gi));
            if (itemMatches.length > 0) {
              const parsed = itemMatches.map((m: any, idx: number) => ({
                id: Date.now() + idx,
                content: m[2].trim(),
                quantity: Number(m[3]) || 1,
                price: Number(m[4].replace(/\D/g, '')) || 0,
                vat: Number(m[5]) || 0
              }));
              setExpenseItems(parsed);
            } else {
              setExpenseItems([
                {
                  id: Date.now(),
                  content: initialSuffix || editItem.title || '',
                  quantity: 1,
                  price: Number(editItem.amount) || 0,
                  vat: editItem.vat_amount ? 10 : 0
                }
              ]);
            }
          }
        } else {
          // Fresh create mode
          const defaultApproverId = resolveTeamLeaderId(user, users, teams) || (users[0]?.id || null);

          setImages([]);
          setTitleSuffix('');
          setExpenseCategory('general');
          setInvoiceType('vat_10');
          setPaymentTarget('Nội bộ');
          setPaymentMethod('Chuyển khoản');
          setCurrencyType('VND');
          setExpenseItems([{ id: Date.now(), content: '', quantity: 1, price: 0, vat: 10 }]);

          setForm({
            ...EMPTY_FORM,
            title: '',
            date: initialDate || new Date().toISOString().split('T')[0],
            approver_id: defaultApproverId
          });
        }

        setTimeout(() => {
          isInitializedRef.current = true;
        }, 50);
      }
    } else {
      prevOpenRef.current = false;
      prevEditItemRef.current = null;
      isInitializedRef.current = false;
    }
  }, [isOpen, editItem, initialDate]);

  // Default Director & Accountant for 3-step routing
  const defaultDirector = useMemo(() => {
    const businessUsers = users.filter((u: any) => 
      !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) && 
      u.email !== 'turniodev@gmail.com'
    );
    return businessUsers.find((u: any) => {
      const fn = String(u.full_name || u.name || '').toLowerCase();
      const un = String(u.username || '').toLowerCase();
      const em = String(u.email || '').toLowerCase();
      return fn.includes('quang vinh') || un === 'vinhpq' || em.includes('vinhpq') || fn.includes('phạm quang vinh') || fn.includes('phan quang vinh');
    })
    || businessUsers.find((u: any) => String(u.role).toLowerCase() === 'director')
    || businessUsers.find((u: any) => String(u.role).toLowerCase() === 'admin')
    || null;
  }, [users]);

  const defaultAccountant = useMemo(() => {
    const businessUsers = users.filter((u: any) => 
      !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) && 
      u.email !== 'turniodev@gmail.com'
    );
    return businessUsers.find((u: any) => String(u.role).toLowerCase() === 'accountant')
      || businessUsers.find((u: any) => {
        const fn = String(u.full_name || u.name || '').toLowerCase();
        return fn.includes('thu thảo') || u.username === 'thaont';
      })
      || null;
  }, [users]);

  // Dynamic threshold routing effect
  useEffect(() => {
    if (isOpen && !editItem && users.length > 0) {
      const amt = Number(itemsGrandTotal || 0);
      if (amt >= threshold) {
        setForm((prev: any) => ({
          ...prev,
          approver_id_2: defaultDirector?.id ? Number(defaultDirector.id) : prev.approver_id_2,
          approver_id_3: defaultAccountant?.id ? Number(defaultAccountant.id) : prev.approver_id_3
        }));
      } else {
        setForm((prev: any) => ({
          ...prev,
          approver_id_2: defaultAccountant?.id ? Number(defaultAccountant.id) : prev.approver_id_2,
          approver_id_3: null
        }));
      }
    }
  }, [itemsGrandTotal, threshold, isOpen, editItem, defaultDirector, defaultAccountant, users]);

  // Keep approver_id updated with team leader
  useEffect(() => {
    if (isOpen && !editItem && !form.approver_id && (users.length > 0 || teams.length > 0)) {
      const leaderId = resolveTeamLeaderId(user, users, teams) || users[0]?.id || null;
      if (leaderId) {
        setForm((prev: any) => ({ ...prev, approver_id: leaderId }));
      }
    }
  }, [isOpen, editItem, users, teams, user, form.approver_id]);

  const isAutoApprove = form.approver_id !== null && user?.id !== undefined && Number(form.approver_id) === Number(user.id);

  // Handle Save
  const handleSave = async () => {
    if (editItem && editItem.id && !editItem.isClone) {
      const creatorId = Number(editItem.created_by || editItem.user_id);
      const currentUserId = Number(user?.id);
      if (creatorId && currentUserId && creatorId !== currentUserId) {
        addToast('Chỉ người tạo phiếu mới có quyền chỉnh sửa', 'error');
        return;
      }
    }

    let finalTitle = titleSuffix.trim() ? `Đề nghị thanh toán — ${titleSuffix.trim()}` : (form.title?.trim() || '');
    const validItems = expenseItems.filter(it => it.content?.trim());
    if (!titleSuffix.trim() && (!finalTitle || finalTitle === 'Đề nghị thanh toán')) {
      if (validItems.length > 0) {
        const autoSuffix = validItems.map(it => it.content.trim()).join(', ');
        finalTitle = `Đề nghị thanh toán — ${autoSuffix}`;
      } else {
        addToast('Vui lòng nhập chi tiết nội dung chi trong bảng kê hoặc tiêu đề', 'error');
        return;
      }
    }
    if (itemsGrandTotal <= 0) {
      addToast('Vui lòng nhập đầy đủ số tiền chi trong bảng chi tiết', 'error');
      return;
    }
    if (form.approver_id === null) {
      addToast('Vui lòng chọn người duyệt Cấp 1 (Trưởng nhóm / Quản lý)', 'error');
      return;
    }
    if (form.approver_id_2 === null) {
      addToast(itemsGrandTotal >= threshold ? 'Vui lòng chọn người duyệt Cấp 2 (Ban Giám đốc)' : 'Vui lòng chọn người duyệt Cấp 2 (Kế toán)', 'error');
      return;
    }
    if (itemsGrandTotal >= threshold && form.approver_id_3 === null) {
      addToast(`Khoản chi từ ${threshold.toLocaleString('vi-VN')}đ trở lên bắt buộc phê duyệt 3 cấp: Leader -> Ban Giám đốc -> Kế toán!`, 'error');
      return;
    }

    setSaving(true);
    try {
      let payloadEntities = form.entities;
      if (form.entities.length > 0) {
        const splitAmt = itemsGrandTotal / form.entities.length;
        payloadEntities = form.entities.map((e: any) => ({ ...e, amount: splitAmt }));
      }

      let finalNotes = form.notes || '';
      finalNotes = finalNotes.replace(/\[Chi tiết các khoản chi\]:[^\n]*(\n[•\-*][^\n]*)*\s*/gi, '').trim();
      finalNotes = finalNotes.replace(/\[Hồ sơ chi phí[^\]]*\]:[^\n]*/gi, '').trim();
      finalNotes = finalNotes.replace(/\[Thông tin chuyển khoản[^\]]*\]:[^\n]*/gi, '').trim();
      finalNotes = finalNotes.replace(/\[Thông tin nhận tiền[^\]]*\]:[^\n]*/gi, '').trim();
      finalNotes = finalNotes.replace(/\[Tài liệu đính kèm[^\]]*\]:[^\n]*(\n•[^\n]*)*\s*/gi, '').trim();

      const matchedCat = CATEGORIES.find(c => c.value === expenseCategory);
      finalNotes = `[Hồ sơ chi phí]: ${matchedCat?.label || expenseCategory}\n${finalNotes}`.trim();

      if (paymentMethod === 'Chuyển khoản' && paymentBankAccount) {
        finalNotes = `${finalNotes}\n[Thông tin chuyển khoản]: ${paymentBankName || 'Ngân hàng'} - STK: ${paymentBankAccount} - Chủ TK: ${paymentAccountName || paymentBeneficiaryName}${paymentBankBranch ? ` - Chi nhánh: ${paymentBankBranch}` : ''}`.trim();
      } else if (paymentMethod === 'Tiền mặt') {
        finalNotes = `${finalNotes}\n[Thông tin nhận tiền]: Tiền mặt - Người nhận: ${paymentBeneficiaryName || 'Người nhận'} - Quầy bàn giao: ${paymentDestination || 'Thủ quỹ'}`.trim();
      } else if (paymentMethod === 'Ví điện tử') {
        finalNotes = `${finalNotes}\n[Thông tin nhận tiền]: Ví điện tử (${paymentWalletType}) - SĐT: ${paymentWalletPhone || paymentPhone} - Chủ ví: ${paymentBeneficiaryName}`.trim();
      } else if (paymentMethod === 'Thẻ tín dụng') {
        finalNotes = `${finalNotes}\n[Thông tin nhận tiền]: Thẻ tín dụng - 4 số cuối: ${paymentCorporateCard || 'N/A'} - Người quẹt: ${paymentBeneficiaryName}`.trim();
      }

      if (expenseItems && expenseItems.length > 0) {
        const itemRowsStr = expenseItems.map((it, idx) => {
          const sub = (Number(it.quantity) || 1) * (Number(it.price) || 0);
          return `• [${idx + 1}] ${it.content || 'Hạng mục chi'} - SL: ${it.quantity} - Đơn giá: ${Number(it.price || 0).toLocaleString('vi-VN')} đ - VAT: ${it.vat || 0}% - Thành tiền: ${Number(sub).toLocaleString('vi-VN')} đ`;
        }).join('\n');
        finalNotes = `${finalNotes}\n\n[Chi tiết các khoản chi]:\n${itemRowsStr}`.trim();
      }

      // Deduplicate images
      const uniqueImages: string[] = [];
      for (const img of images) {
        if (img && !uniqueImages.includes(img)) {
          uniqueImages.push(img);
        }
      }

      if (uniqueImages.length > 0) {
        const baseUrl = import.meta.env.VITE_API_URL || '/backend';
        const attsStr = uniqueImages.map(url => `• ${url.split('/').pop()} (${baseUrl}/${url.replace(/^\/?(backend\/)?/, '')})`).join('\n');
        finalNotes = `${finalNotes}\n\n[Tài liệu đính kèm (${uniqueImages.length} tệp)]:\n${attsStr}`.trim();
      }

      const statusVal = isAutoApprove ? 'approved' : 'pending';

      const payload = {
        ...form,
        title: finalTitle,
        vendor_name: paymentBeneficiaryName || form.vendor_name || '',
        bank_name: paymentBankName,
        bank_account_number: paymentBankAccount,
        bank_account_name: paymentAccountName,
        request_bank_transfer: paymentMethod === 'Chuyển khoản',
        category: matchedCat?.label || 'Vận hành',
        currency: currencyType,
        amount: Number(itemsGrandTotal),
        vat_amount: Number(itemsTotalVat),
        has_vat_invoice: invoiceType.startsWith('vat_'),
        is_vat_inclusive: true,
        image_url: uniqueImages[0] || null,
        notes: finalNotes,
        items: expenseItems,
        entities: payloadEntities
      };

      if (editItem && editItem.id && !editItem.isClone) {
        const { created_by, ...updatePayload } = payload;
        await api.put(`/expenses/${editItem.id}`, updatePayload);
        addToast('Đã cập nhật chi phí thành công!', 'success');
      } else {
        await api.post('/expenses', {
          ...payload,
          status: statusVal
        });
        addToast('Đã tạo đề xuất thanh toán thành công!', 'success');
        try {
          localStorage.removeItem(EXPENSE_DRAFT_KEY);
        } catch {}
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      addToast(err.response?.data?.message || err.message || 'Lỗi khi lưu đề xuất', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: baseZIndex }}>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleRequestClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: baseZIndex,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              left: isMobile ? 0 : 'var(--sidebar-width, 220px)',
              right: 0,
              top: 0,
              bottom: 0,
              width: isMobile ? '100vw' : 'auto',
              maxWidth: 'none',
              height: isMobile ? '100dvh' : '100vh',
              background: 'var(--color-surface)',
              boxShadow: isMobile ? 'none' : '-10px 0 30px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: baseZIndex + 1,
              overflow: 'hidden'
            }}
          >
            {/* Drawer Header */}
            <div style={{
              padding: isMobile ? '0.75rem 1rem' : '1rem 1.75rem',
              borderBottom: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-surface)',
              flexShrink: 0,
              gap: '1rem',
              flexWrap: isMobile ? 'wrap' : 'nowrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                <button
                  type="button"
                  onClick={handleRequestClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border-light)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                  title="Quay lại"
                >
                  <ChevronLeft size={22} />
                </button>

                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
                    {editItem ? 'Cập nhật đề xuất thanh toán (PO)' : 'Lập đề nghị thanh toán mới (PO)'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 2, marginBottom: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '560px' }} title={form.title || editItem?.title || undefined}>
                    {form.title || editItem?.title || 'Biểu mẫu quy trình đề xuất thanh toán & giải ngân Purchase Order chuẩn hóa.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons in top right corner */}
              <div style={{
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'center',
                justifyContent: isMobile ? 'space-between' : 'flex-end',
                width: isMobile ? '100%' : 'auto',
                flexWrap: isMobile ? 'wrap' : 'nowrap'
              }}>
                {!editItem && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleExplicitSaveDraft}
                    disabled={saving}
                    style={{
                      height: '34px',
                      flex: isMobile ? 1 : 'none',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      borderRadius: '10px'
                    }}
                    title="Lưu bản nháp để tiếp tục hoàn thiện sau"
                  >
                    <FileText size={14} style={{ flexShrink: 0 }} />
                    <span>Lưu nháp</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    height: '34px',
                    flex: isMobile ? 2 : 'none',
                    minWidth: isMobile ? 'none' : '150px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  {saving ? 'Đang lưu...' : (isAutoApprove ? 'Tạo & Duyệt' : 'Gửi phê duyệt')}
                </button>
              </div>
            </div>

            {/* Drawer Body: 2 Columns Matching Approvals.tsx */}
            <div className="modal-body custom-scrollbar" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', padding: '1.5rem', flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 65px)', WebkitOverflowScrolling: 'touch' }}>
              
              {/* Left Column (Main Form - 7/10) */}
              <div style={{ flex: isMobile ? 'none' : 7, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, width: '100%', paddingBottom: '140px' }}>
                
                {/* Draft Notification Banner */}
                {existingDraft && !editItem && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.28)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', color: 'var(--color-text)' }}>
                      <Bookmark size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                      <span>
                        Có 1 bản nháp đã lưu lúc <strong>{existingDraft.savedAt ? new Date(existingDraft.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}</strong>
                        {existingDraft.form?.title ? ` - "${existingDraft.form.title}"` : ''}.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleRestoreDraft}
                        style={{
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: 'var(--color-primary)',
                          color: '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(163, 20, 34, 0.2)'
                        }}
                      >
                        Khôi phục bản nháp
                      </button>
                      <button
                        type="button"
                        onClick={handleClearDraft}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: 'transparent',
                          color: 'var(--color-text-muted)',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer'
                        }}
                      >
                        Xóa nháp
                      </button>
                    </div>
                  </div>
                )}

                {/* CARD 1: THÔNG TIN CHI TIẾT ĐỀ XUẤT & TIÊU ĐỀ */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                  
                  {/* Workflow Banner Highlight */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileSignature size={18} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.875rem' }}>Đề nghị thanh toán (PO)</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Đề xuất thanh toán nhà cung cấp, chi phí vận hành, đối tác & cán bộ nhân viên.</span>
                    </div>
                  </div>

                  {/* Tiêu đề quy trình / Nội dung chi (Fix prefix + editable suffix) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Tiêu đề đề xuất / Nội dung chi</span>
                        <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      borderRadius: '10px',
                      border: '1.5px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      overflow: 'hidden',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}>
                      {/* Fixed Prefix Box */}
                      <div style={{
                        padding: '0 14px',
                        background: 'var(--color-bg-secondary, #f1f5f9)',
                        borderRight: '1.5px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        flexShrink: 0
                      }}>
                        <span style={{ color: '#10b981', fontSize: '0.9rem' }}>●</span>
                        <span>Đề nghị thanh toán</span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>—</span>
                      </div>

                      {/* Suffix Input */}
                      <input
                        type="text"
                        className="form-input"
                        value={titleSuffix}
                        onChange={e => handleSuffixChange(e.target.value)}
                        placeholder="Nhập nội dung chi cụ thể (VD: In ấn, thi công Lễ tốt nghiệp, Tiền điện nước tháng 9...) *"
                        style={{
                          flex: 1,
                          border: 'none',
                          borderRadius: 0,
                          height: '42px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          background: 'transparent',
                          padding: '0 14px'
                        }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 2: THÔNG TIN CHI TIẾT ĐỀ XUẤT & ĐỐI TƯỢNG THỤ HƯỞNG */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                    <Receipt size={18} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Thông tin chi tiết đề xuất (Hồ sơ chi phí & Đối tượng thụ hưởng)
                    </span>
                  </div>

                  {/* Phân loại chi phí */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Phân loại chi phí
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {CATEGORIES.map(c => {
                        const Icon = c.icon;
                        const isSelected = expenseCategory === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => {
                              setExpenseCategory(c.value);
                              setForm((prev: any) => ({ ...prev, category: c.label }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: 'var(--radius-full)',
                              border: `1.5px solid ${isSelected ? c.color : 'var(--color-border)'}`,
                              background: isSelected ? `${c.color}18` : 'transparent',
                              color: isSelected ? c.color : 'var(--color-text-light)',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 750 : 600,
                              cursor: 'pointer',
                              transition: 'all 0.18s ease'
                            }}
                          >
                            <Icon size={13} />
                            <span>{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Loại chứng từ hóa đơn */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Loại chứng từ hóa đơn
                    </label>
                    <CustomSelect
                      value={invoiceType}
                      onChange={val => {
                        setInvoiceType(val as any);
                        const vatNum = val === 'vat_10' ? 10 : val === 'vat_8' ? 8 : val === 'vat_5' ? 5 : val === 'vat_0' ? 0 : null;
                        if (vatNum !== null) {
                          setExpenseItems(prev => prev.map(it => ({ ...it, vat: vatNum })));
                        }
                      }}
                      options={[
                        { value: 'vat_10', label: 'Hóa đơn điện tử VAT 10%' },
                        { value: 'vat_8', label: 'Hóa đơn điện tử VAT 8%' },
                        { value: 'vat_5', label: 'Hóa đơn điện tử VAT 5%' },
                        { value: 'vat_0', label: 'Hóa đơn điện tử VAT 0% / Không chịu thuế' },
                        { value: 'retail', label: 'Hóa đơn bán lẻ / Biên lai thu tiền' },
                        { value: 'none', label: 'Không có hóa đơn (Giải trình nội bộ)' }
                      ]}
                      width="100%"
                    />
                  </div>

                  {/* PAYMENT TARGET, METHOD & CURRENCY ROW */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1.2fr 0.8fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Đối tượng thụ hưởng <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <CustomSelect
                        value={paymentTarget}
                        onChange={val => {
                          setPaymentTarget(val);
                          if (val === 'Nội bộ') {
                            const currentEmp = users.find(u => Number(u.id) === Number(user?.id)) || user;
                            if (currentEmp) {
                              setPaymentEmployeeId(String(currentEmp.id));
                              setPaymentBeneficiaryName(currentEmp.full_name || currentEmp.name || '');
                              if (currentEmp.bank_name) setPaymentBankName(currentEmp.bank_name);
                              if (currentEmp.bank_account) setPaymentBankAccount(currentEmp.bank_account);
                              const accName = currentEmp.full_name || currentEmp.name || '';
                              if (accName) setPaymentAccountName(accName.toUpperCase());
                              if (currentEmp.phone) setPaymentPhone(currentEmp.phone);
                            }
                          } else {
                            setPaymentEmployeeId('');
                            setPaymentSupplierId('');
                            setPaymentLecturerId('');
                            setPaymentContactId('');
                            setPaymentBeneficiaryName('');
                            setPaymentBankName('');
                            setPaymentBankAccount('');
                            setPaymentAccountName('');
                            setPaymentPhone('');
                            setPaymentTaxCode('');
                          }
                        }}
                        options={[
                          { value: 'Nội bộ', label: 'Nội bộ (Cán bộ nhân viên)' },
                          { value: 'Giảng viên', label: 'Giảng viên / Chuyên gia' },
                          { value: 'Đối tác', label: 'Đối tác / Vendor / Nhà cung cấp' },
                          { value: 'Khách hàng', label: 'Khách hàng / Học viên CRM' },
                          { value: 'Cộng tác viên', label: 'Cộng tác viên (CTV Tuyển sinh / Marketing)' },
                          { value: 'Cơ quan Nhà nước', label: 'Cơ quan Nhà nước / Thuế / BHXH / Kho bạc' },
                          { value: 'Cá nhân khác', label: 'Cá nhân khác / Khách vãng lai' }
                        ]}
                        width="100%"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Hình thức nhận tiền
                      </label>
                      <CustomSelect
                        value={paymentMethod}
                        onChange={val => setPaymentMethod(val)}
                        options={[
                          { value: 'Chuyển khoản', label: 'Chuyển khoản (Ngân hàng)' },
                          { value: 'Tiền mặt', label: 'Tiền mặt (Thủ quỹ bàn giao)' },
                          { value: 'Ví điện tử', label: 'Ví điện tử (MoMo / ZaloPay / Viettel Money)' },
                          { value: 'Thẻ tín dụng', label: 'Thẻ tín dụng doanh nghiệp (Corporate Card)' }
                        ]}
                        width="100%"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Loại tiền tệ
                      </label>
                      <CustomSelect
                        value={currencyType}
                        onChange={val => {
                          setCurrencyType(val);
                          setForm((prev: any) => ({ ...prev, currency: val }));
                        }}
                        options={[
                          { value: 'VND', label: 'VND (₫)' },
                          { value: 'USD', label: 'USD ($)' },
                          { value: 'EURO', label: 'EUR (€)' },
                          { value: 'GBP', label: 'GBP (£)' },
                          { value: 'JPY', label: 'JPY (¥)' },
                          { value: 'SGD', label: 'SGD (S$)' },
                          { value: 'AUD', label: 'AUD (A$)' },
                          { value: 'CAD', label: 'CAD (C$)' },
                          { value: 'CHF', label: 'CHF (Fr)' }
                        ]}
                        width="100%"
                      />
                    </div>
                  </div>

                  {/* BENEFICIARY DYNAMIC SELECTORS */}
                  {paymentTarget === 'Nội bộ' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Nhân viên thụ hưởng <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          (Tự động trích xuất STK ngân hàng từ hồ sơ nhân sự)
                        </span>
                      </div>
                      <CustomSelect
                        options={users.map((u: any) => ({
                          value: String(u.id),
                          label: u.full_name || u.name || u.username || `Nhân viên #${u.id}`,
                          avatar: u.avatar_url || u.avatar,
                          sublabel: [
                            u.role || '',
                            u.bank_name ? `${u.bank_name}: ${u.bank_account}` : 'Chưa có STK'
                          ].filter(Boolean).join(' • ')
                        }))}
                        value={paymentEmployeeId}
                        onChange={val => {
                          const empId = String(val);
                          setPaymentEmployeeId(empId);
                          const emp = users.find((u: any) => String(u.id) === empId);
                          if (emp) {
                            const empName = emp.full_name || emp.name || emp.username || '';
                            setPaymentBeneficiaryName(empName);
                            if (emp.bank_name) setPaymentBankName(emp.bank_name);
                            if (emp.bank_account) setPaymentBankAccount(emp.bank_account);
                            if (empName) setPaymentAccountName(empName.toUpperCase());
                            if (emp.phone) setPaymentPhone(emp.phone);
                            if (emp.bank_account) {
                              addToast(`Đã trích xuất STK ngân hàng của ${empName}`, 'success');
                            } else {
                              addToast(`Nhân viên ${empName} chưa lưu STK trong hồ sơ. Vui lòng nhập STK bên dưới.`, 'info');
                            }
                          }
                        }}
                        placeholder="-- Chọn nhân viên nhận thanh toán --"
                        searchable
                        showAvatars
                        width="100%"
                      />
                      {paymentEmployeeId && (() => {
                        const emp = users.find((u: any) => String(u.id) === paymentEmployeeId);
                        if (!emp) return null;
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: emp.bank_account ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                            border: `1px solid ${emp.bank_account ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                            fontSize: '0.78rem'
                          }}>
                            <span style={{ color: emp.bank_account ? '#059669' : '#d97706', fontWeight: 650 }}>
                              {emp.bank_account 
                                ? `✓ Số tài khoản đồng bộ ${getSystemTitle()}: ${emp.bank_name || 'Ngân hàng'} - ${emp.bank_account} (Chủ TK: ${(emp.full_name || emp.name || '').toUpperCase()})` 
                                : '⚠️ Nhân viên chưa cập nhật STK trong hồ sơ cá nhân. Vui lòng nhập STK bên dưới.'}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
                              {emp.role || 'Nhân viên'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {paymentTarget === 'Giảng viên' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Chọn giảng viên / chuyên gia trong hệ thống
                          </label>
                          <CustomSelect
                            options={[
                              { value: '', label: '-- Chọn giảng viên đã có (hoặc nhập mới bên cạnh) --' },
                              ...lecturerOptions
                            ]}
                            value={paymentLecturerId}
                            onChange={val => {
                              const lecId = String(val);
                              setPaymentLecturerId(lecId);
                              const lec = lecturerOptions.find(l => l.value === lecId);
                              if (lec) {
                                setPaymentBeneficiaryName(lec.label);
                                if (lec.bank_name) setPaymentBankName(lec.bank_name);
                                if (lec.bank_account) setPaymentBankAccount(lec.bank_account);
                                if (lec.bank_account_name || lec.label) setPaymentAccountName((lec.bank_account_name || lec.label).toUpperCase());
                                if (lec.phone) setPaymentPhone(lec.phone);
                                if (lec.bank_account) {
                                  addToast(`Đã trích xuất STK của giảng viên: ${lec.label}`, 'success');
                                } else {
                                  addToast(`Giảng viên ${lec.label} chưa lưu STK. Vui lòng nhập thông tin bên dưới.`, 'info');
                                }
                              }
                            }}
                            placeholder="-- Tìm kiếm giảng viên / chuyên gia --"
                            searchable
                            width="100%"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Họ và tên giảng viên <span style={{ color: 'var(--color-danger)' }}>*</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBeneficiaryName}
                            onChange={e => {
                              setPaymentBeneficiaryName(e.target.value);
                              if (!paymentAccountName) setPaymentAccountName(e.target.value.toUpperCase());
                            }}
                            placeholder="Họ và tên giảng viên nhận thù lao..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                      {paymentBeneficiaryName && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: paymentBankAccount ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          border: `1px solid ${paymentBankAccount ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                          fontSize: '0.78rem'
                        }}>
                          <span style={{ color: paymentBankAccount ? '#059669' : '#d97706', fontWeight: 650 }}>
                            {paymentBankAccount 
                              ? `✓ STK Giảng viên: ${paymentBankName || 'Ngân hàng'} - ${paymentBankAccount} (Chủ TK: ${paymentAccountName})` 
                              : 'ℹ️ Giảng viên chưa có STK trong hệ thống. Vui lòng nhập số tài khoản ở bên dưới.'}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
                            Giảng viên / Chuyên gia
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentTarget === 'Đối tác' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1.2fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Chọn đối tác / nhà cung cấp đã lưu
                          </label>
                          <CustomSelect
                            options={[
                              { value: '', label: '-- Chọn đối tác trong danh bạ (hoặc nhập tay) --' },
                              ...partnerOptions
                            ]}
                            value={paymentSupplierId}
                            onChange={val => {
                              const sId = String(val);
                              setPaymentSupplierId(sId);
                              const sup = partnerOptions.find(s => s.value === sId);
                              if (sup) {
                                setPaymentBeneficiaryName(sup.label);
                                if (sup.bank_name) setPaymentBankName(sup.bank_name);
                                if (sup.bank_account) setPaymentBankAccount(sup.bank_account);
                                if (sup.bank_account_name || sup.label) setPaymentAccountName((sup.bank_account_name || sup.label).toUpperCase());
                                if (sup.tax_code) setPaymentTaxCode(sup.tax_code);
                                if (sup.phone) setPaymentPhone(sup.phone);
                                if (sup.bank_account) {
                                  addToast(`Đã trích xuất STK của đối tác: ${sup.label}`, 'success');
                                } else {
                                  addToast(`Đối tác ${sup.label} chưa lưu STK. Vui lòng điền thông tin bên dưới.`, 'info');
                                }
                              }
                            }}
                            placeholder="-- Tìm đối tác / nhà cung cấp --"
                            searchable
                            width="100%"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Tên đơn vị thụ hưởng <span style={{ color: 'var(--color-danger)' }}>*</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBeneficiaryName}
                            onChange={e => {
                              setPaymentBeneficiaryName(e.target.value);
                              if (!paymentAccountName) setPaymentAccountName(e.target.value.toUpperCase());
                            }}
                            placeholder="Tên công ty / nhà cung cấp nhận tiền..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Mã số thuế (MST)
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentTaxCode}
                            onChange={e => setPaymentTaxCode(e.target.value)}
                            placeholder="Mã số thuế doanh nghiệp..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                      {paymentBeneficiaryName && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: paymentBankAccount ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          border: `1px solid ${paymentBankAccount ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                          fontSize: '0.78rem'
                        }}>
                          <span style={{ color: paymentBankAccount ? '#059669' : '#d97706', fontWeight: 650 }}>
                            {paymentBankAccount 
                              ? `✓ STK Đối tác: ${paymentBankName || 'Ngân hàng'} - ${paymentBankAccount} (Chủ TK: ${paymentAccountName})` 
                              : 'ℹ️ Đối tác chưa lưu STK trong danh bạ. Vui lòng nhập số tài khoản ở ô bên dưới.'}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
                            {paymentTaxCode ? `MST: ${paymentTaxCode}` : 'Đối tác / Vendor'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentTarget === 'Khách hàng' && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1.2fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Chọn khách hàng / học viên (CRM)
                        </label>
                        <CustomSelect
                          options={[
                            { value: '', label: '-- Chọn khách hàng trong CRM (hoặc nhập bên cạnh) --' },
                            ...contactOptions
                          ]}
                          value={paymentContactId}
                          onChange={val => {
                            const cId = String(val);
                            setPaymentContactId(cId);
                            const con = contactOptions.find(c => c.value === cId);
                            if (con) {
                              setPaymentBeneficiaryName(con.label);
                              if (con.bank_name) setPaymentBankName(con.bank_name);
                              if (con.bank_account) setPaymentBankAccount(con.bank_account);
                              if (con.bank_account_name || con.label) setPaymentAccountName((con.bank_account_name || con.label).toUpperCase());
                              if (con.phone) setPaymentPhone(con.phone);
                              if (con.bank_account) {
                                addToast(`Đã trích xuất STK khách hàng: ${con.label}`, 'success');
                              }
                            }
                          }}
                          placeholder="-- Tìm khách hàng / học viên --"
                          searchable
                          width="100%"
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Tên khách hàng thụ hưởng <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={paymentBeneficiaryName}
                          onChange={e => {
                            setPaymentBeneficiaryName(e.target.value);
                            if (!paymentAccountName) setPaymentAccountName(e.target.value.toUpperCase());
                          }}
                          placeholder="Họ và tên khách hàng hoặc mã hồ sơ..."
                          style={{ height: '36px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Số điện thoại liên hệ
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={paymentPhone}
                          onChange={e => setPaymentPhone(e.target.value)}
                          placeholder="Ví dụ: 0912345678..."
                          style={{ height: '36px', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {paymentTarget === 'Cộng tác viên' && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Họ và tên Cộng tác viên <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={paymentBeneficiaryName}
                          onChange={e => {
                            setPaymentBeneficiaryName(e.target.value);
                            if (!paymentAccountName) setPaymentAccountName(e.target.value.toUpperCase());
                          }}
                          placeholder="Họ và tên CTV tuyển sinh / Marketing..."
                          style={{ height: '36px', fontSize: '0.8rem' }}
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Số điện thoại / CCCD của CTV
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={paymentPhone}
                          onChange={e => setPaymentPhone(e.target.value)}
                          placeholder="Số điện thoại hoặc số CCCD..."
                          style={{ height: '36px', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {paymentTarget === 'Cơ quan Nhà nước' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Loại cơ quan / Ngân sách
                          </label>
                          <CustomSelect
                            value={paymentGovAgencyType}
                            onChange={val => setPaymentGovAgencyType(val as any)}
                            options={[
                              { value: 'tax', label: 'Cơ quan Thuế (GTGT, TNDN, Môn bài)' },
                              { value: 'social_insurance', label: 'Cơ quan Bảo hiểm Xã hội (BHXH)' },
                              { value: 'treasury', label: 'Kho bạc Nhà nước (Ngân sách / Lệ phí)' },
                              { value: 'other', label: 'Sở Ban ngành / Cơ quan hành chính' }
                            ]}
                            width="100%"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Tên cơ quan thụ hưởng <span style={{ color: 'var(--color-danger)' }}>*</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBeneficiaryName}
                            onChange={e => {
                              setPaymentBeneficiaryName(e.target.value);
                              if (!paymentAccountName) setPaymentAccountName(e.target.value.toUpperCase());
                            }}
                            placeholder="VD: Chi cục Thuế Quận 1, Kho bạc Nhà nước..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Số QĐ / Mã chương tiểu mục
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentGovDecisionNumber}
                            onChange={e => setPaymentGovDecisionNumber(e.target.value)}
                            placeholder="Số thông báo nộp thuế..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentTarget === 'Cá nhân khác' && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Họ và tên người nhận <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={paymentBeneficiaryName}
                          onChange={e => {
                            setPaymentBeneficiaryName(e.target.value);
                            if (!paymentAccountName) setPaymentAccountName(e.target.value.toUpperCase());
                          }}
                          placeholder="Họ và tên người nhận thanh toán vãng lai..."
                          style={{ height: '36px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                          Số điện thoại / CCCD
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={paymentPhone}
                          onChange={e => setPaymentPhone(e.target.value)}
                          placeholder="Số điện thoại hoặc CCCD/CMND..."
                          style={{ height: '36px', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* BANK TRANSFER DETAILS (When paymentMethod === 'Chuyển khoản') */}
                  {paymentMethod === 'Chuyển khoản' && (
                    <div style={{
                      background: 'var(--color-bg-secondary, #f8fafc)',
                      padding: '1.25rem',
                      borderRadius: '14px',
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CreditCard size={17} style={{ color: 'var(--color-primary)' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)', letterSpacing: '0.03em' }}>
                            Thông tin tài khoản ngân hàng nhận chuyển khoản
                          </span>
                        </div>

                        {user && (user.bank_name || user.bank_account) && (
                          <button
                            type="button"
                            onClick={() => {
                              const myName = (user.full_name || user.name || '').toUpperCase();
                              if (user.bank_name) setPaymentBankName(user.bank_name);
                              if (user.bank_account) setPaymentBankAccount(user.bank_account);
                              if (myName) setPaymentAccountName(myName);
                              addToast(`Đã điền thông tin tài khoản của ${user.full_name || user.name}`, 'success');
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              color: '#2563eb',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <Zap size={13} />
                            <span>⚡ Dùng STK của tôi</span>
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1.2fr 1.4fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Tên ngân hàng <span style={{ color: 'var(--color-danger)' }}>*</span>
                          </label>
                          <BankSelect
                            value={paymentBankName}
                            onChange={val => setPaymentBankName(val)}
                            placeholder="Chọn ngân hàng..."
                            size="sm"
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Số tài khoản (STK) <span style={{ color: 'var(--color-danger)' }}>*</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBankAccount}
                            onChange={e => setPaymentBankAccount(e.target.value.replace(/\s+/g, ''))}
                            placeholder="Số tài khoản"
                            style={{ height: '36px', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px' }}
                            required
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Tên chủ tài khoản <span style={{ color: 'var(--color-danger)' }}>*</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentAccountName}
                            onChange={e => setPaymentAccountName(e.target.value.toUpperCase())}
                            placeholder="TÊN CHỦ TÀI KHOẢN (IN HOA)..."
                            style={{ height: '36px', fontSize: '0.8rem', fontWeight: 700 }}
                            required
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Chi nhánh
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBankBranch}
                            onChange={e => setPaymentBankBranch(e.target.value)}
                            placeholder="VD: CN Hội sở, Ba Đình..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>

                      {/* Bank Card Preview & VietQR Card */}
                      {paymentBankAccount && paymentBankName && (() => {
                        const vietQrUrl = getVietQrUrl({
                          bankBinOrCode: paymentBankName,
                          accountNumber: paymentBankAccount,
                          accountName: paymentAccountName,
                          amount: itemsGrandTotal > 0 ? itemsGrandTotal : undefined,
                          memo: form.title || 'Thanh toan PO'
                        });

                        return (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 155px',
                            gap: '12px',
                            marginTop: '6px',
                            alignItems: 'stretch'
                          }}>
                            {/* Executive Brand Light Bank Card */}
                            <div style={{
                              background: '#ffffff',
                              border: '1px solid var(--color-border-light, rgba(0, 0, 0, 0.08))',
                              borderRadius: '14px',
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '10px',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: 'var(--color-bg-subtle, #f8fafc)',
                                    border: '1px solid var(--color-border-light, rgba(0, 0, 0, 0.08))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    {findBank(paymentBankName)?.logo ? (
                                      <img
                                        src={findBank(paymentBankName)!.logo}
                                        alt=""
                                        style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                                      />
                                    ) : (
                                      <Landmark size={14} style={{ color: 'var(--color-primary, #dc2626)' }} />
                                    )}
                                  </div>
                                  <span style={{ fontWeight: 750, fontSize: '0.8rem', letterSpacing: '0.01em', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={paymentBankName}>
                                    {paymentBankName}
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  background: 'rgba(220, 38, 38, 0.06)',
                                  color: '#dc2626',
                                  border: '1px solid rgba(220, 38, 38, 0.15)',
                                  flexShrink: 0
                                }}>
                                  Napas 247
                                </span>
                              </div>

                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#f8fafc',
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: '1px solid var(--color-border-light, rgba(0, 0, 0, 0.08))',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  <span style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                                    Số tài khoản (STK)
                                  </span>
                                  <span style={{
                                    fontSize: '1.05rem',
                                    fontWeight: 800,
                                    fontFamily: 'monospace',
                                    letterSpacing: '0.06em',
                                    color: '#dc2626'
                                  }}>
                                    {paymentBankAccount}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(paymentBankAccount);
                                    addToast('Đã sao chép số tài khoản!', 'success');
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '5px 9px',
                                    borderRadius: '6px',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                                    flexShrink: 0
                                  }}
                                >
                                  <Copy size={12} />
                                  <span>Sao chép</span>
                                </button>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '4px' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                                    Chủ tài khoản
                                  </span>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 750, letterSpacing: '0.01em', color: '#0f172a', marginTop: '1px', textTransform: 'uppercase', lineHeight: 1.25 }}>
                                    {paymentAccountName || paymentBeneficiaryName || 'CHƯA ĐIỀN'}
                                  </div>
                                </div>
                                {paymentBankBranch && (
                                  <div style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'right', flexShrink: 0 }}>
                                    CN: <span style={{ color: '#1e293b', fontWeight: 600 }}>{paymentBankBranch}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* VietQR Card: Click to zoom in */}
                            <div
                              onClick={() => vietQrUrl && setPreviewQrModalUrl(vietQrUrl)}
                              title={vietQrUrl ? 'Bấm để phóng to mã QR' : undefined}
                              style={{
                                background: '#ffffff',
                                border: '1px solid var(--color-border-light, rgba(0, 0, 0, 0.08))',
                                borderRadius: '14px',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                                cursor: vietQrUrl ? 'pointer' : 'default',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {vietQrUrl ? (
                                <img
                                  src={vietQrUrl}
                                  alt="Mã VietQR"
                                  style={{
                                    width: '100%',
                                    maxWidth: '140px',
                                    maxHeight: '140px',
                                    objectFit: 'contain'
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Chưa có mã QR</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* CASH DETAILS */}
                  {paymentMethod === 'Tiền mặt' && (
                    <div style={{
                      background: 'var(--color-bg-secondary, #f8fafc)',
                      padding: '1rem 1.25rem',
                      borderRadius: '14px',
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 750, fontSize: '0.8rem' }}>
                        <Receipt size={16} />
                        <span>Hình thức nhận: Tiền mặt (Bàn giao trực tiếp tại quầy / thủ quỹ)</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Người nhận tiền mặt
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBeneficiaryName}
                            onChange={e => setPaymentBeneficiaryName(e.target.value)}
                            placeholder="Họ và tên người nhận tiền..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Địa điểm / Quầy bàn giao tiền
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentDestination}
                            onChange={e => setPaymentDestination(e.target.value)}
                            placeholder="Ví dụ: Quầy Thủ quỹ Hội sở / Phòng Kế toán..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* WALLET DETAILS */}
                  {paymentMethod === 'Ví điện tử' && (
                    <div style={{
                      background: 'var(--color-bg-secondary, #f8fafc)',
                      padding: '1rem 1.25rem',
                      borderRadius: '14px',
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a21caf', fontWeight: 750, fontSize: '0.8rem' }}>
                        <Wallet size={16} />
                        <span>Hình thức nhận: Ví điện tử di động</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Loại ví điện tử
                          </label>
                          <CustomSelect
                            value={paymentWalletType}
                            onChange={val => setPaymentWalletType(val as any)}
                            options={[
                              { value: 'momo', label: 'MoMo' },
                              { value: 'zalopay', label: 'ZaloPay' },
                              { value: 'viettel_money', label: 'Viettel Money' }
                            ]}
                            width="100%"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Số điện thoại liên kết ví
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentWalletPhone || paymentPhone}
                            onChange={e => setPaymentWalletPhone(e.target.value)}
                            placeholder="Nhập SĐT đăng ký ví..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Tên chủ ví
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBeneficiaryName}
                            onChange={e => setPaymentBeneficiaryName(e.target.value)}
                            placeholder="Họ và tên chủ ví..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CORPORATE CARD DETAILS */}
                  {paymentMethod === 'Thẻ tín dụng' && (
                    <div style={{
                      background: 'var(--color-bg-secondary, #f8fafc)',
                      padding: '1rem 1.25rem',
                      borderRadius: '14px',
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8', fontWeight: 750, fontSize: '0.8rem' }}>
                        <CreditCard size={16} />
                        <span>Hình thức nhận: Thẻ tín dụng doanh nghiệp (Corporate Card)</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            4 số cuối thẻ tín dụng
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentCorporateCard}
                            onChange={e => setPaymentCorporateCard(e.target.value)}
                            placeholder="Ví dụ: 8899"
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Cán bộ phụ trách giữ thẻ / Quẹt thẻ
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={paymentBeneficiaryName}
                            onChange={e => setPaymentBeneficiaryName(e.target.value)}
                            placeholder="Họ và tên người quẹt thẻ..."
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ngày chi */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Ngày đề xuất chi *
                    </label>
                    <VietnameseDateInput
                      value={form.date}
                      onChange={val => setForm({ ...form, date: val })}
                      inputStyle={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                      required
                    />
                  </div>
                </div>

                {/* CARD 3: BẢNG CHI TIẾT THANH TOÁN & MỤC ĐÍCH */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Bảng chi tiết thanh toán
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExpenseItems([
                          ...expenseItems,
                          { id: Date.now(), content: '', quantity: 1, price: 0, vat: 10 }
                        ]);
                      }}
                      className="btn secondary"
                      style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', color: 'var(--color-primary)' }}
                    >
                      + Thêm dòng
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '8px', width: '45px', minWidth: '45px', textAlign: 'center', fontWeight: 700 }}>STT</th>
                          <th style={{ padding: '8px', minWidth: '200px', fontWeight: 700 }}>Nội dung chi</th>
                          <th style={{ padding: '8px', width: '95px', minWidth: '95px', textAlign: 'center', fontWeight: 700 }}>SL</th>
                          <th style={{ padding: '8px', width: '160px', minWidth: '160px', fontWeight: 700 }}>Đơn giá ({currencyType})</th>
                          <th style={{ padding: '8px', width: '120px', minWidth: '120px', fontWeight: 700 }}>Thành tiền</th>
                          <th style={{ padding: '8px', width: '95px', minWidth: '95px', fontWeight: 700 }}>VAT (%)</th>
                          <th style={{ padding: '8px', width: '36px', minWidth: '36px' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {expenseItems.map((item, idx) => {
                          const lineTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '8px', textAlign: 'center', width: '45px', minWidth: '45px', verticalAlign: 'top', lineHeight: '28px' }}>{idx + 1}</td>
                              <td style={{ padding: '8px', minWidth: '200px', verticalAlign: 'top' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={item.content}
                                  onChange={e => {
                                    const updated = [...expenseItems];
                                    updated[idx].content = e.target.value;
                                    setExpenseItems(updated);
                                  }}
                                  placeholder="Nội dung chi tiêu"
                                  style={{ padding: '4px 8px', height: '28px', fontSize: '0.8rem', width: '100%' }}
                                  required
                                />
                              </td>
                              <td style={{ padding: '8px', width: '95px', minWidth: '95px', verticalAlign: 'top' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  value={item.quantity}
                                  onChange={e => {
                                    const updated = [...expenseItems];
                                    updated[idx].quantity = e.target.value === '' ? '' : Number(e.target.value);
                                    setExpenseItems(updated);
                                  }}
                                  style={{ padding: '4px 6px', height: '28px', fontSize: '0.825rem', width: '100%', minWidth: '70px', textAlign: 'center', fontWeight: 600 }}
                                  min="1"
                                  required
                                />
                              </td>
                              <td style={{ padding: '8px', width: '160px', minWidth: '160px', verticalAlign: 'top' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={formatNumberWithDots(item.price)}
                                  onChange={e => {
                                    const rawVal = e.target.value.replace(/\D/g, '');
                                    const updated = [...expenseItems];
                                    updated[idx].price = Number(rawVal);
                                    setExpenseItems(updated);
                                  }}
                                  style={{ padding: '4px 8px', height: '28px', fontSize: '0.8rem', width: '100%' }}
                                  placeholder="0"
                                  required
                                />
                                {item.price > 0 && (
                                  <div 
                                    style={{ 
                                      fontSize: '0.68rem', 
                                      color: 'var(--color-primary)', 
                                      fontWeight: 600, 
                                      marginTop: '4px', 
                                      fontStyle: 'italic', 
                                      whiteSpace: 'normal', 
                                      wordBreak: 'break-word', 
                                      lineHeight: 1.25 
                                    }} 
                                    title={docSoTiengViet(item.price)}
                                  >
                                    {docSoTiengViet(item.price)}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '8px', fontWeight: 600, width: '120px', minWidth: '120px', verticalAlign: 'top', lineHeight: '28px' }}>
                                {formatApprovalCurrency(lineTotal, currencyType)}
                              </td>
                              <td style={{ padding: '8px', width: '95px', minWidth: '95px', verticalAlign: 'top' }}>
                                <select
                                  className="form-input"
                                  value={item.vat}
                                  onChange={e => {
                                    const updated = [...expenseItems];
                                    updated[idx].vat = Number(e.target.value);
                                    setExpenseItems(updated);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    height: '28px',
                                    fontSize: '0.8rem',
                                    width: '85px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: 'var(--color-bg-primary, #ffffff)',
                                    color: 'var(--color-text-primary, #1e293b)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={8}>8%</option>
                                  <option value={10}>10%</option>
                                </select>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center', width: '36px', minWidth: '36px', verticalAlign: 'top', lineHeight: '28px' }}>
                                {expenseItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpenseItems(expenseItems.filter(x => x.id !== item.id));
                                    }}
                                    style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1.1rem', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    &times;
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'flex-end', width: isMobile ? '100%' : '280px', marginTop: '4px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Tổng tiền chưa thuế:</span>
                      <strong style={{ color: 'var(--color-text)' }}>{formatApprovalCurrency(itemsTotalBeforeTax, currencyType)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Tiền thuế VAT:</span>
                      <strong style={{ color: 'var(--color-text)' }}>{formatApprovalCurrency(itemsTotalVat, currencyType)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '6px', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>Tổng thanh toán:</span>
                      <strong style={{ color: 'var(--color-primary)' }}>{formatApprovalCurrency(itemsGrandTotal, currencyType)}</strong>
                    </div>
                    {itemsGrandTotal > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic', textAlign: 'right', marginTop: '2px', lineHeight: 1.35 }}>
                        ({docSoTiengViet(itemsGrandTotal)})
                      </div>
                    )}
                  </div>

                  {/* PURPOSE & DETAILS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Mục đích & Nội dung thanh toán
                    </label>
                    <textarea
                      className="form-input"
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Giải trình chi tiết mục đích chi tiêu và căn cứ đề xuất (nếu có)..."
                      style={{ height: '76px', resize: 'vertical', fontSize: '0.8rem', padding: '8px' }}
                    />
                  </div>
                </div>

                {/* CARD 4: TÀI LIỆU CHỨNG TỪ ĐÍNH KÈM */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Tài liệu chứng từ đính kèm {images.length > 0 && `(${images.length} tệp)`}</span>
                    <button
                      type="button"
                      onClick={() => fileInputMultiRef.current?.click()}
                      style={{
                        background: 'rgba(189, 29, 45, 0.08)',
                        color: 'var(--color-primary)',
                        border: '1px solid rgba(189, 29, 45, 0.2)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Upload size={13} />
                      <span>Tải nhiều file / ảnh</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputMultiRef}
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        setUploadingImg(true);
                        let successCount = 0;
                        try {
                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            try {
                              let fileToUpload: File = file;
                              if (file.type.startsWith('image/')) {
                                try {
                                  const webpBlob = await compressToWebP(file);
                                  fileToUpload = new File([webpBlob], `expense_proof_${Date.now()}_${i}.webp`, { type: 'image/webp' });
                                } catch (cErr) {
                                  fileToUpload = file;
                                }
                              }
                              const fd = new FormData();
                              fd.append('file', fileToUpload);
                              const res = await api.post('/upload', fd, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                              });
                              if (res.data && res.data.success && res.data.data?.url) {
                                const newUrl = res.data.data.url;
                                setImages(prev => [...prev, newUrl]);
                                setForm((prev: any) => ({ ...prev, image_url: prev.image_url || newUrl }));
                                successCount++;
                              }
                            } catch (err) {
                              console.error('Error uploading file', file.name, err);
                            }
                          }
                          if (successCount > 0) {
                            addToast(`Đã tải lên thành công ${successCount} tệp đính kèm!`, 'success');
                          }
                        } catch (err: any) {
                          addToast('Lỗi khi tải tệp: ' + (err.message || err), 'error');
                        } finally {
                          setUploadingImg(false);
                          if (fileInputMultiRef.current) fileInputMultiRef.current.value = '';
                        }
                      }}
                    />
                  </div>

                  <PasteDropzoneArea
                    compact={true}
                    placeholder="Chọn/kéo thả hoặc Ctrl+V để dán nhiều ảnh, file PDF, hóa đơn"
                    subtext="Hỗ trợ tải lên tất cả các loại tệp (PDF, Word, Excel, Ảnh...) hoặc dán ảnh từ Clipboard"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,image/*"
                    onConfirmUpload={async (item) => {
                      if (item.file) {
                        setUploadingImg(true);
                        try {
                          let fileToUpload: File = item.file;
                          if (item.file.type.startsWith('image/')) {
                            try {
                              const webpBlob = await compressToWebP(item.file);
                              fileToUpload = new File([webpBlob], `expense_proof_${Date.now()}.webp`, { type: 'image/webp' });
                            } catch (cErr) {
                              fileToUpload = item.file;
                            }
                          }
                          const fd = new FormData();
                          fd.append('file', fileToUpload);
                          const res = await api.post('/upload', fd, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          if (res.data && res.data.success && res.data.data?.url) {
                            const newUrl = res.data.data.url;
                            setImages(prev => {
                              const isAlreadyIn = prev.some(existing => existing === newUrl);
                              return isAlreadyIn ? prev : [...prev, newUrl];
                            });
                            setForm((prev: any) => ({ ...prev, image_url: prev.image_url || newUrl }));
                            addToast('Tải lên tệp đính kèm thành công!', 'success');
                          } else {
                            addToast('Tải tệp thất bại', 'error');
                          }
                        } catch (err: any) {
                          addToast('Lỗi khi tải tệp: ' + (err.message || err), 'error');
                        } finally {
                          setUploadingImg(false);
                        }
                      }
                    }}
                  />

                  {uploadingImg && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="spinner sm"></div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Đang xử lý & tải lên tệp...</span>
                    </div>
                  )}

                  {/* Attachment gallery */}
                  {images.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                        {images.map((imgUrl, idx) => {
                          const isImg = /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(imgUrl);
                          const fileUrl = imgUrl.startsWith('http') ? imgUrl : `${import.meta.env.VITE_API_URL || '/backend'}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
                          const fileName = imgUrl.split('/').pop() || `Tệp ${idx + 1}`;
                          return (
                            <div
                              key={idx}
                              style={{
                                position: 'relative',
                                height: '80px',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                border: '1.5px solid var(--color-border)',
                                background: isImg ? '#0a0e17' : 'var(--color-bg-secondary)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: isImg ? 0 : '8px'
                              }}
                            >
                              {isImg ? (
                                <img
                                  src={fileUrl}
                                  alt={`Hóa đơn ${idx + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'var(--color-text)', width: '100%', height: '100%', justifyContent: 'center' }}
                                  title={fileName}
                                >
                                  <FileText size={24} style={{ color: 'var(--color-primary)' }} />
                                  <span style={{ fontSize: '0.65rem', fontWeight: 600, maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                    {fileName}
                                  </span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = images.filter((_, i) => i !== idx);
                                  setImages(next);
                                  setForm((prev: any) => ({ ...prev, image_url: next[0] || '' }));
                                }}
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  background: 'rgba(0,0,0,0.7)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: 20,
                                  height: 20,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  zIndex: 2
                                }}
                                title="Xóa tệp này"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column (Sidebar - 3/10) */}
              <div 
                className="custom-scrollbar"
                style={{ 
                  flex: isMobile ? 'none' : 3, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem', 
                  paddingBottom: isMobile ? '80px' : '20px',
                  position: isMobile ? 'static' : 'sticky',
                  top: 0,
                  alignSelf: 'flex-start',
                  maxHeight: isMobile ? 'none' : 'calc(100vh - 95px)',
                  overflowY: isMobile ? 'visible' : 'auto'
                }}
              >
                
                {/* Áp dụng cho (Khách / Đối tác) */}
                <div style={{ 
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                    <label className="form-label" style={{ fontWeight: 800, margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>Áp dụng cho</label>
                    
                    <div style={{
                      display: 'inline-flex',
                      background: 'var(--color-surface)',
                      padding: '3px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-light)'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (allocationType !== 'contact') {
                            setAllocationType('contact');
                            setForm((prev: any) => ({ ...prev, entities: [] }));
                          }
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          background: allocationType === 'contact' ? 'var(--color-primary-light)' : 'transparent',
                          color: allocationType === 'contact' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Khách
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (allocationType !== 'company') {
                            setAllocationType('company');
                            setForm((prev: any) => ({ ...prev, entities: [] }));
                          }
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          background: allocationType === 'company' ? 'var(--color-primary-light)' : 'transparent',
                          color: allocationType === 'company' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Đối tác
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {form.entities.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Chưa áp dụng cho ai
                      </span>
                    ) : (
                      form.entities.map((e: any) => (
                        <span key={e.entity_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid rgba(163, 20, 34, 0.2)' }}>
                          <Avatar name={e.name} src={e.avatar_url} size={20} />
                          {e.name || `${allocationType === 'contact' ? 'Khách hàng' : 'Đối tác'} #${e.entity_id}`}
                          <X size={14} style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setForm({ ...form, entities: form.entities.filter((x: any) => x.entity_id !== e.entity_id) })} />
                        </span>
                      ))
                    )}
                  </div>

                  {allocationType === 'contact' ? (
                    <CustomSelect
                      options={contacts.filter(c => !form.entities.find((e: any) => e.entity_id === c.id)).map(c => ({
                        value: String(c.id),
                        label: (c.full_name || '').trim(),
                        avatar: c.avatar_url,
                        sublabel: c.company_name
                      }))}
                      value=""
                      onChange={(val) => {
                        const found = contacts.find(c => String(c.id) === val);
                        if (found) {
                          setForm({ ...form, entities: [...form.entities, { entity_type: 'contact', entity_id: found.id, name: (found.full_name || '').trim(), avatar_url: found.avatar_url }] });
                        }
                      }}
                      placeholder="+ Thêm khách hàng..."
                      searchable
                      showAvatars
                    />
                  ) : (
                    <CustomSelect
                      options={companies.filter(c => !form.entities.find((e: any) => e.entity_id === c.id)).map(c => ({
                        value: String(c.id),
                        label: c.name || c.company_name || 'Không tên',
                        avatar: c.logo_url || c.logo,
                        sublabel: c.code || c.phone
                      }))}
                      value=""
                      onChange={(val) => {
                        const found = companies.find(c => String(c.id) === val);
                        if (found) {
                          setForm((prev: any) => ({ 
                            ...prev, 
                            entities: [...prev.entities, { entity_type: 'company', entity_id: found.id, name: found.name || found.company_name || 'Không tên', avatar_url: found.logo_url || found.logo }]
                          }));
                        }
                      }}
                      placeholder="+ Thêm đối tác..."
                      searchable
                      showAvatars
                    />
                  )}
                </div>

                {/* Phê duyệt & Vận hành */}
                <div style={{ 
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      Các bước duyệt áp dụng
                    </h4>
                    {Number(itemsGrandTotal || 0) >= threshold ? (
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>
                        Khoản chi từ {threshold.toLocaleString('vi-VN')}đ duyệt 3 cấp (Leader → Giám đốc → Kế toán)
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', fontWeight: 650, color: '#10b981', marginTop: '4px' }}>
                        Khoản chi dưới {threshold.toLocaleString('vi-VN')}đ duyệt 2 cấp (Leader → Kế toán)
                      </div>
                    )}
                  </div>

                  {/* Vertical Timeline Stepper */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '12px', position: 'relative', paddingLeft: '30px' }}>
                    <div style={{ position: 'absolute', left: '10px', top: '10px', bottom: '10px', width: '2px', background: 'var(--color-border-light)' }} />

                    {/* Step 1: Creator */}
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-30px',
                        top: '0px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        zIndex: 2
                      }}>
                        1
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Người tạo</strong>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          padding: '6px 12px', 
                          background: 'var(--color-bg)', 
                          border: '1px solid var(--color-border-light)', 
                          borderRadius: '8px',
                          height: '38px'
                        }}>
                          <Avatar src={user?.avatar_url || user?.avatar} name={user?.full_name || user?.name || user?.username} size="sm" />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user?.full_name || user?.name || user?.username}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Level 1 Approver */}
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-30px',
                        top: '0px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: form.approver_id ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: `2px solid ${form.approver_id ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                        color: form.approver_id ? '#ffffff' : 'var(--color-text-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        zIndex: 2
                      }}>
                        2
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.8rem', color: form.approver_id ? 'var(--color-text)' : 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>
                          Người duyệt Cấp 1 *
                        </strong>
                        <CustomSelect
                          options={users.map((u: any) => ({
                            value: u.id,
                            label: u.full_name,
                            avatar: u.avatar_url,
                            sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                          }))}
                          value={form.approver_id}
                          onChange={val => {
                            const numVal = Number(val);
                            setForm({
                              ...form,
                              approver_id: numVal,
                              related_user_ids: form.related_user_ids.filter((x: number) => x !== numVal)
                            });
                          }}
                          placeholder="Chọn người duyệt Cấp 1..."
                          searchable
                          showAvatars
                        />
                      </div>
                    </div>

                    {/* Step 3: Level 2 Approver */}
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-30px',
                        top: '0px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: form.approver_id_2 ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: `2px solid ${form.approver_id_2 ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                        color: form.approver_id_2 ? '#ffffff' : 'var(--color-text-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        zIndex: 2
                      }}>
                        3
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>
                          {Number(itemsGrandTotal || 0) >= threshold ? (
                            <>Người duyệt Cấp 2: Ban Giám đốc <span style={{ color: 'var(--color-danger)' }}>*</span></>
                          ) : (
                            <>Người duyệt Cấp 2: Kế toán <span style={{ color: 'var(--color-danger)' }}>*</span></>
                          )}
                        </strong>
                        <CustomSelect
                          options={users.map((u: any) => ({
                            value: u.id,
                            label: u.full_name,
                            avatar: u.avatar_url,
                            sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                          }))}
                          value={form.approver_id_2}
                          onChange={val => {
                            const numVal = Number(val);
                            setForm({
                              ...form,
                              approver_id_2: numVal,
                              related_user_ids: form.related_user_ids.filter((x: number) => x !== numVal)
                            });
                          }}
                          placeholder="Chọn người duyệt Cấp 2..."
                          searchable
                          showAvatars
                        />
                      </div>
                    </div>

                    {/* Step 4: Level 3 Approver (Only if >= 5M) */}
                    {Number(itemsGrandTotal || 0) >= threshold && (
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                          position: 'absolute',
                          left: '-30px',
                          top: '0px',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: form.approver_id_3 ? 'var(--color-primary)' : 'var(--color-surface)',
                          border: `2px solid ${form.approver_id_3 ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          color: form.approver_id_3 ? '#ffffff' : 'var(--color-text-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          zIndex: 2
                        }}>
                          4
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>
                            Người duyệt Cấp 3: Kế toán <span style={{ color: 'var(--color-danger)' }}>*</span>
                          </strong>
                          <CustomSelect
                            options={users.map((u: any) => ({
                              value: u.id,
                              label: u.full_name,
                              avatar: u.avatar_url,
                              sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                            }))}
                            value={form.approver_id_3}
                            onChange={val => {
                              const numVal = Number(val);
                              setForm({
                                ...form,
                                approver_id_3: numVal,
                                related_user_ids: form.related_user_ids.filter((x: number) => x !== numVal)
                              });
                            }}
                            placeholder="Chọn người duyệt Cấp 3..."
                            searchable
                            showAvatars
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Related Users */}
                <div style={{ 
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                    Người liên quan (Theo dõi)
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {/* Selected participant avatars */}
                      {form.related_user_ids.length > 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {form.related_user_ids.map((uid: number, idx: number) => {
                            const u = users.find((x: any) => x.id === uid);
                            if (!u) return null;
                            return (
                              <div
                                key={uid}
                                style={{
                                  marginLeft: idx === 0 ? 0 : -8,
                                  border: '1.5px solid var(--color-surface)',
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  zIndex: 10 - idx,
                                  boxShadow: 'var(--shadow-sm)',
                                  display: 'flex'
                                }}
                                title={u.full_name || u.name}
                              >
                                <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.name} size="sm" />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Chưa chọn ai</span>
                      )}

                      {/* Dash add button */}
                      <button
                        type="button"
                        onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                        style={{
                          border: '1px dashed var(--color-primary)',
                          background: 'rgba(163, 20, 34, 0.04)',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'all 0.15s ease'
                        }}
                        className="hover-scale"
                        title="Thêm người liên quan"
                      >
                        <Plus size={14} color="var(--color-primary)" />
                      </button>

                      {/* Dropdown list of users */}
                      {showParticipantDropdown && (
                        <div style={{
                          position: 'absolute',
                          top: (typeof window !== 'undefined' && window.innerWidth <= 768) ? 'auto' : '100%',
                          bottom: (typeof window !== 'undefined' && window.innerWidth <= 768) ? 'calc(100% + 6px)' : 'auto',
                          left: 0,
                          marginTop: (typeof window !== 'undefined' && window.innerWidth <= 768) ? 0 : '6px',
                          marginBottom: (typeof window !== 'undefined' && window.innerWidth <= 768) ? '6px' : 0,
                          zIndex: 9999,
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '12px',
                          boxShadow: (typeof window !== 'undefined' && window.innerWidth <= 768) ? '0 -10px 25px rgba(0, 0, 0, 0.18)' : '0 10px 25px rgba(0, 0, 0, 0.18)',
                          minWidth: '240px',
                          maxWidth: (typeof window !== 'undefined' && window.innerWidth <= 768) ? 'calc(100vw - 32px)' : '320px',
                          maxHeight: (typeof window !== 'undefined' && window.innerWidth <= 768) ? '250px' : '260px',
                          overflowY: 'auto',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 10, paddingBottom: '4px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <Search size={13} style={{ position: 'absolute', left: '8px', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                              <input
                                type="text"
                                placeholder="Tìm người liên quan..."
                                value={participantSearch}
                                onChange={(e) => setParticipantSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px 6px 26px',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-bg)',
                                  color: 'var(--color-text)',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                                autoFocus
                              />
                            </div>
                          </div>
                          {users
                            .filter((u: any) => u.id !== form.approver_id)
                            .filter((u: any) => {
                              if (!participantSearch.trim()) return true;
                              const q = participantSearch.toLowerCase();
                              return (
                                (u.full_name || u.name || '').toLowerCase().includes(q) ||
                                (u.email || '').toLowerCase().includes(q) ||
                                (u.role || '').toLowerCase().includes(q)
                              );
                            })
                            .map((u: any) => {
                              const isSelected = form.related_user_ids.includes(u.id);
                              return (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setForm({ ...form, related_user_ids: form.related_user_ids.filter((x: number) => x !== u.id) });
                                    } else {
                                      setForm({ ...form, related_user_ids: [...form.related_user_ids, u.id] });
                                    }
                                  }}
                                  style={{
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: isSelected ? 'rgba(163, 20, 34, 0.06)' : 'transparent',
                                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text)'
                                  }}
                                  className="hover-bg-alt"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                    <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.name} size="sm" />
                                    <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {u.full_name || u.name}
                                    </span>
                                  </div>
                                  {isSelected && <Check size={12} color="var(--color-primary)" strokeWidth={3} style={{ flexShrink: 0 }} />}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* QR Code Zoom Preview Modal */}
            {previewQrModalUrl && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: baseZIndex + 100,
                  padding: '20px'
                }}
                onClick={() => setPreviewQrModalUrl(null)}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '20px',
                    maxWidth: '380px',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    position: 'relative'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewQrModalUrl(null)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >
                    <X size={20} />
                  </button>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Mã VietQR Thanh Toán</h4>
                  <img src={previewQrModalUrl} alt="VietQR" style={{ width: '100%', borderRadius: '12px' }} />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Quét mã bằng app ngân hàng để chuyển khoản nhanh 24/7</span>
                </div>
              </div>
            )}

            {/* Draft Exit Confirmation Modal */}
            <DraftExitConfirmModal
              isOpen={showExitConfirm}
              onSaveDraft={handleSaveDraftAndExit}
              onDiscard={handleDiscardAndExit}
              onContinue={() => setShowExitConfirm(false)}
              title="Lưu bản nháp đề xuất thanh toán?"
              message="Bạn có thông tin đề xuất đang nhập dở dang. Bạn có muốn lưu bản nháp để tiếp tục hoàn thiện sau không?"
              zIndex={baseZIndex + 50}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
