import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from './Avatar';
import { toast } from 'react-hot-toast';
import { Bold, Italic, Underline as UnderlineIcon, Link2, ImageIcon, List, ListOrdered, Trash2 } from 'lucide-react';

interface User {
  id: number;
  full_name: string;
  role: string;
  avatar_url?: string;
  avatar?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (e: any) => void;
  users?: User[];
  onImagePaste?: (file: File) => void;
  onFilePaste?: (file: File) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  rows?: number;
}

export const MentionInput: React.FC<MentionInputProps> = ({ 
  value, 
  onChange, 
  users: propUsers, 
  onImagePaste, 
  onFilePaste, 
  placeholder, 
  disabled, 
  className,
  rows,
  ...props 
}) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; bottom?: number; upwards?: boolean } | null>(null);
  const [isEmpty, setIsEmpty] = useState(!value);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const mentionRangeRef = useRef<{ node: Node; startOffset: number; endOffset: number } | null>(null);

  const isTeamMember = (u: User) => {
    if (!u) return false;
    if ((u as any).status && (u as any).status !== 'active') return false;
    if ((u as any).email === 'turniodev@gmail.com') return false;
    return true;
  };

  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      setUsers(propUsers.filter(isTeamMember));
      return;
    }
    const usersEndpoint = '/users?all=1';
    api.get(usersEndpoint).then(res => {
      const d = res.data.data;
      const list = Array.isArray(d) ? d : (d?.items || []);
      const mapped = list.map((u: any) => ({
        ...u,
        id: u.id,
        full_name: u.full_name || u.name || u.username || '',
        avatar_url: u.avatar_url || u.avatar || '',
        role: u.role || 'sale'
      }));
      const filtered = mapped.filter(isTeamMember);
      setUsers(filtered);
    }).catch(err => {
      console.error("MentionInput failed to load users:", err);
      setUsers([]);
    });
  }, [propUsers, currentUser?.role]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDropdown && editorRef.current) {
        const wrapper = editorRef.current.parentElement;
        if (wrapper && !wrapper.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, showDropdown]);

  const checkEmpty = () => {
    if (editorRef.current) {
      const text = editorRef.current.textContent || '';
      const hasImage = editorRef.current.querySelector('img') !== null;
      setIsEmpty(text.trim() === '' && !hasImage);
    } else {
      setIsEmpty(true);
    }
  };

  // Sync editor contents with parent state (e.g. when cleared)
  useEffect(() => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      if (value !== currentHtml) {
        if (!isFocusedRef.current || !value) {
          editorRef.current.innerHTML = value || '';
          checkEmpty();
        }
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange({ target: { value: html } } as any);
      checkEmpty();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const node = range.startContainer;
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const offset = range.startOffset;
        const textBeforeCursor = text.slice(0, offset);
        
        const match = textBeforeCursor.match(/@([^\s]*)$/);
        if (match) {
          setSearchQuery(match[1].toLowerCase());
          setShowDropdown(true);
          mentionRangeRef.current = {
            node,
            startOffset: offset - match[0].length,
            endOffset: offset
          };
          
          try {
            const rect = range.getBoundingClientRect();
            const wrapper = editorRef.current?.closest('.rich-text-editor-wrapper');
            if (rect && wrapper) {
              const wrapperRect = wrapper.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const shouldOpenUpwards = spaceBelow < 220;
              
              setDropdownPos({
                top: rect.bottom - wrapperRect.top,
                bottom: wrapperRect.bottom - rect.top + 4,
                left: rect.left - wrapperRect.left,
                upwards: shouldOpenUpwards
              });
            }
          } catch (err) {
            setDropdownPos(null);
          }
        } else {
          setShowDropdown(false);
        }
      } else {
        setShowDropdown(false);
      }
    }
  };

  const handleSelectUser = (user: User) => {
    if (!mentionRangeRef.current || !editorRef.current) return;
    const { node, startOffset, endOffset } = mentionRangeRef.current;
    const fullName = user.full_name || 'user';
    
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention';
    mentionSpan.setAttribute('data-user-id', String(user.id));
    mentionSpan.contentEditable = 'false';
    mentionSpan.style.color = '#dc2626';
    mentionSpan.style.background = 'rgba(239, 68, 68, 0.08)';
    mentionSpan.style.border = '1px solid rgba(239, 68, 68, 0.2)';
    mentionSpan.style.padding = '2px 8px';
    mentionSpan.style.borderRadius = '9999px';
    mentionSpan.style.fontWeight = '600';
    mentionSpan.style.fontSize = '0.85em';
    mentionSpan.style.margin = '0 2px';
    mentionSpan.style.display = 'inline-flex';
    mentionSpan.style.alignItems = 'center';
    mentionSpan.style.gap = '4px';
    mentionSpan.style.verticalAlign = 'middle';
    mentionSpan.style.userSelect = 'none';

    let resolvedAvatarUrl = user.avatar_url || user.avatar || '';
    if (resolvedAvatarUrl && resolvedAvatarUrl.startsWith('uploads/')) {
      const apiBase = import.meta.env.VITE_API_URL || '/backend';
      resolvedAvatarUrl = `${apiBase}/${resolvedAvatarUrl}`;
    } else if (resolvedAvatarUrl && resolvedAvatarUrl.startsWith('storage/uploads/')) {
      const apiBase = import.meta.env.VITE_API_URL || '/backend';
      resolvedAvatarUrl = `${apiBase}/${resolvedAvatarUrl.replace('storage/uploads/', 'uploads/')}`;
    } else if (!resolvedAvatarUrl) {
      resolvedAvatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`;
    }

    const avatar = document.createElement('img');
    avatar.src = resolvedAvatarUrl;
    avatar.setAttribute('data-mention-avatar', 'true');
    avatar.className = 'mention-avatar';
    avatar.style.width = '14px';
    avatar.style.height = '14px';
    avatar.style.borderRadius = '50%';
    avatar.style.objectFit = 'cover';
    mentionSpan.appendChild(avatar);

    const textNode = document.createElement('span');
    textNode.textContent = `@${fullName}`;
    mentionSpan.appendChild(textNode);

    const spaceNode = document.createTextNode('\u00A0');

    const range = document.createRange();
    try {
      range.setStart(node, startOffset);
      range.setEnd(node, endOffset);
      range.deleteContents();
      
      range.insertNode(spaceNode);
      range.insertNode(mentionSpan);
      
      range.setStartAfter(spaceNode);
      range.collapse(true);
      
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (err) {
      console.error(err);
      editorRef.current.appendChild(mentionSpan);
      editorRef.current.appendChild(spaceNode);
    }

    const html = editorRef.current.innerHTML;
    onChange({ target: { value: html } } as any);
    checkEmpty();

    setShowDropdown(false);
    mentionRangeRef.current = null;
    editorRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectUser(filteredUsers[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
      }
    }
  };

  const removeAccents = (str: string) => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'accountant': return 'Kế toán';
      case 'admin':
      case 'superadmin':
      case 'super_admin': return 'Quản trị viên';
      case 'director': return 'Giám đốc';
      case 'manager': return 'Trưởng phòng';
      case 'sales':
      case 'sale': return 'Kinh doanh';
      case 'hr': return 'Nhân sự';
      case 'developer': return 'Kỹ thuật';
      default: return role || 'Thành viên';
    }
  };

  const filteredUsers = users.filter(u => {
    const name = u.full_name ? String(u.full_name).toLowerCase() : '';
    const role = u.role ? String(u.role).toLowerCase() : '';
    const username = (u as any).username ? String((u as any).username).toLowerCase() : '';
    const email = (u as any).email ? String((u as any).email).toLowerCase() : '';
    const cleanSearch = searchQuery.trim().toLowerCase();
    const noAccentSearch = removeAccents(cleanSearch);
    const noAccentName = removeAccents(name);
    const noAccentRole = removeAccents(role);
    const noAccentUsername = removeAccents(username);

    // Map common role names in Vietnamese
    let viRole = role;
    if (role === 'accountant') viRole = 'kế toán ke toan ke toan vien';
    else if (role === 'admin' || role === 'superadmin' || role === 'super_admin') viRole = 'quản trị viên quan tri vien admin';
    else if (role === 'director') viRole = 'giám đốc giam doc';
    else if (role === 'manager') viRole = 'trưởng phòng truong phong quan ly';
    else if (role === 'sale' || role === 'sales') viRole = 'kinh doanh tư vấn viên sale';
    else if (role === 'hr') viRole = 'nhân sự nhan su hr';

    return (
      name.includes(cleanSearch) ||
      noAccentName.includes(noAccentSearch) ||
      role.includes(cleanSearch) ||
      noAccentRole.includes(noAccentSearch) ||
      viRole.includes(cleanSearch) ||
      viRole.includes(noAccentSearch) ||
      username.includes(cleanSearch) ||
      noAccentUsername.includes(noAccentSearch) ||
      email.includes(cleanSearch)
    );
  });

  const handleUploadImage = async (file: File, range: Range | null) => {
    const toastId = toast.loading('Đang tải ảnh lên...');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data?.data?.url || res.data?.url;
      if (res.data && res.data.success && fileUrl) {
        toast.success('Tải ảnh lên thành công!', { id: toastId });
        
        const apiBase = import.meta.env.VITE_API_URL || '/backend';
        let resolvedUrl = fileUrl;
        if (fileUrl && fileUrl.startsWith('uploads/')) {
          resolvedUrl = `${apiBase}/${fileUrl}`;
        } else if (fileUrl && fileUrl.startsWith('storage/uploads/')) {
          resolvedUrl = `${apiBase}/${fileUrl.replace('storage/uploads/', 'uploads/')}`;
        }

        // Create image node directly
        const img = document.createElement('img');
        img.src = resolvedUrl;
        img.alt = 'Uploaded Image';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        img.style.display = 'block';

        if (editorRef.current) {
          editorRef.current.focus();
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            if (range) {
              selection.addRange(range);
            }
          }

          if (selection && selection.rangeCount > 0) {
            const r = selection.getRangeAt(0);
            r.deleteContents();
            r.insertNode(img);
            r.setStartAfter(img);
            r.setEndAfter(img);
            selection.removeAllRanges();
            selection.addRange(r);
          } else {
            editorRef.current.appendChild(img);
          }

          const html = editorRef.current.innerHTML;
          onChange({ target: { value: html } } as any);
          checkEmpty();
        }
      } else {
        toast.error(res.data?.message || 'Lỗi tải ảnh lên', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối tải ảnh: ' + err.message, { id: toastId });
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageFile: File | null = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (imageFile) {
      e.preventDefault();
      let savedRange: Range | null = null;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
      await handleUploadImage(imageFile, savedRange);
    } else {
      // Allow parent onFilePaste or onImagePaste handlers if needed
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            if (onFilePaste) {
              e.preventDefault();
              onFilePaste(file);
              return;
            }
          }
        }
      }
    }
  };

  const handleEditorCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange({ target: { value: html } } as any);
      checkEmpty();
    }
  };

  const handleEditorAddLink = () => {
    let range: Range | null = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      range = sel.getRangeAt(0).cloneRange();
    }
    setSavedRange(range);
    setLinkUrl('');
    setShowLinkModal(true);
  };

  const handleConfirmLink = () => {
    if (linkUrl.trim()) {
      const absoluteUrl = linkUrl.match(/^https?:\/\//) ? linkUrl : 'https://' + linkUrl;
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        if (savedRange) {
          selection.addRange(savedRange);
        }
      }
      
      handleEditorCommand('createLink', absoluteUrl);
    }
    setShowLinkModal(false);
  };

  const triggerImageUpload = () => {
    let savedRange: Range | null = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        await handleUploadImage(file, savedRange);
      }
    };
    input.click();
  };

  // Split style prop between editor and wrapper container
  const editorStyleProps: React.CSSProperties = {};
  const wrapperStyleProps: React.CSSProperties = {};

  if (props.style) {
    Object.entries(props.style).forEach(([key, val]) => {
      if (
        [
          'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
          'fontSize', 'lineHeight', 'fontFamily', 'color',
          'minHeight', 'height', 'maxHeight'
        ].includes(key)
      ) {
        editorStyleProps[key] = val;
      } else {
        wrapperStyleProps[key] = val;
      }
    });
  }

  // Force a healthy minHeight for the rich text editor content (e.g. 100px)
  const defaultEditorMinHeight = rows ? rows * 24 : 100;
  let finalEditorMinHeight = `${defaultEditorMinHeight}px`;
  
  if (editorStyleProps.minHeight) {
    const parsed = parseInt(String(editorStyleProps.minHeight));
    if (!isNaN(parsed) && parsed > defaultEditorMinHeight) {
      finalEditorMinHeight = `${parsed}px`;
    }
  }

  // Set the wrapper's minHeight to be the editor's minHeight + toolbar height (~35px)
  const finalWrapperMinHeight = `${parseInt(finalEditorMinHeight) + 35}px`;

  const editorStyle: React.CSSProperties = {
    padding: '10px 12px',
    outline: 'none',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    overflowY: 'auto',
    color: 'var(--color-text)',
    background: 'transparent',
    flex: 1,
    wordBreak: 'break-word',
    textAlign: 'left',
    ...editorStyleProps,
    minHeight: finalEditorMinHeight // Must be after ...editorStyleProps to override!
  };

  const cleanClassName = className
    ? className
        .split(' ')
        .filter(c => c !== 'form-input' && c !== 'form-control' && c !== 'form-textarea')
        .join(' ')
    : '';

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    background: 'var(--color-surface)',
    overflow: 'visible',
    position: 'relative',
    width: '100%',
    padding: '0px', // Force override any padding from className
    ...wrapperStyleProps,
    minHeight: finalWrapperMinHeight // Must be after ...wrapperStyleProps to override!
  };

  return (
    <div style={wrapperStyle} className={`rich-text-editor-wrapper ${cleanClassName}`}>
      {/* Editor Toolbar */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '2px', 
          padding: '4px 6px', 
          background: 'var(--color-bg, #f9fafb)', 
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
          userSelect: 'none',
          borderTopLeftRadius: '9px',
          borderTopRightRadius: '9px'
        }}
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleEditorCommand('bold')}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
          title="In đậm"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleEditorCommand('italic')}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
          title="In nghiêng"
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleEditorCommand('underline')}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
          title="Gạch chân"
        >
          <UnderlineIcon size={13} />
        </button>
        <div style={{ width: '1px', height: '14px', background: 'var(--color-border)', margin: '0 4px' }} />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleEditorAddLink}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
          title="Chèn liên kết"
        >
          <Link2 size={13} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={triggerImageUpload}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
          title="Tải ảnh lên"
        >
          <ImageIcon size={13} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleEditorCommand('insertUnorderedList')}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
          title="Danh sách dấu chấm"
        >
          <List size={13} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleEditorCommand('insertOrderedList')}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
          title="Danh sách số"
        >
          <ListOrdered size={13} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleEditorCommand('removeFormat')}
          style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}
          title="Xóa định dạng"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Editor Body */}
      <div style={{ position: 'relative', display: 'flex', flex: 1, minWidth: 0 }}>
        {isEmpty && placeholder && (
          <div style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--color-text-muted)', pointerEvents: 'none', fontSize: '0.85rem' }}>
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyUp={handleKeyUp}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            handleInput();
          }}
          style={editorStyle}
          className="rich-text-editor-content"
        />
      </div>

      {/* Mention Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: dropdownPos?.upwards ? 5 : -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dropdownPos?.upwards ? 5 : -5 }}
            style={{
              position: 'absolute',
              top: dropdownPos 
                ? (dropdownPos.upwards ? undefined : dropdownPos.top + 16) 
                : '100%',
              bottom: dropdownPos && dropdownPos.upwards ? dropdownPos.bottom : undefined,
              left: dropdownPos ? Math.max(0, Math.min(dropdownPos.left, (editorRef.current?.clientWidth || 300) - 260)) : 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '180px',
              overflowY: 'auto',
              zIndex: 100,
              width: '260px',
              marginBottom: '4px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Search input header */}
            <div 
              style={{ 
                padding: '6px 8px', 
                borderBottom: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-light)',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}
              onClick={e => e.stopPropagation()}
            >
              <input
                type="text"
                placeholder="Gõ để tìm tên hoặc vai trò..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value.toLowerCase())}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Không tìm thấy kết quả
                </div>
              ) : (
                filteredUsers.map((u, idx) => {
                  const fullName = u.full_name || 'Không tên';
                  const roleName = u.role || 'user';
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--color-border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--color-text)',
                        background: idx === selectedIndex ? 'var(--color-bg)' : 'transparent'
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Avatar name={fullName} src={u.avatar_url || u.avatar} size={20} />
                      <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{fullName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-light)', padding: '2px 6px', borderRadius: '4px' }}>{getRoleLabel(roleName)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLinkModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowLinkModal(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '20px',
                width: '360px',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Chèn liên kết
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Nhập đường dẫn URL (ví dụ: https://example.com):
              </div>
              <input
                type="text"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="form-input"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  outline: 'none'
                }}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmLink();
                  if (e.key === 'Escape') setShowLinkModal(false);
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="btn text"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLink}
                  className="btn primary"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Đồng ý
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
