// Curated high-aesthetic wallpapers for WorkChat

export interface WallpaperPreset {
  id: string;
  name: string;
  category: 'gradient' | 'pattern' | 'dark' | 'minimal';
  cssBackground: string;
  previewBackground: string;
  defaultOpacity: number;
  textColorTheme: 'dark' | 'light';
}

// Lightweight vector SVG patterns (smooth, crisp on retina, zero network delay)
const DOODLE_SVG = `data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg' opacity='0.07'%3E%3Cpath d='M15 15h20v14H15zm0 18h14v10H15zm45-18h16v16H60zm0 20h22v12H60zM20 70h16v18H20zm40 5h20v14H60zm40-50h14v14h-14zm0 22h16v10h-16zm-5 45h20v16H95z' fill='%230f172a' fill-rule='evenodd'/%3E%3Ccircle cx='45' cy='25' r='6' fill='%230f172a'/%3E%3Ccircle cx='95' cy='20' r='5' fill='%230f172a'/%3E%3Ccircle cx='45' cy='85' r='7' fill='%230f172a'/%3E%3Ccircle cx='105' cy='80' r='4' fill='%230f172a'/%3E%3Cpath d='M8 95q8-10 16 0t16 0' stroke='%230f172a' stroke-width='2' fill='none'/%3E%3Cpath d='M70 45q6-8 12 0t12 0' stroke='%230f172a' stroke-width='2' fill='none'/%3E%3C/svg%3E`;

const GRID_SVG = `data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg' opacity='0.06'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20zm20-20h20v20H20V0z' fill='%232563eb' fill-rule='evenodd'/%3E%3C/svg%3E`;

const SAKURA_SVG = `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg' opacity='0.08'%3E%3Cpath d='M40 25c-4-8-12-8-14-2s4 12 14 18c10-6 16-12 14-18s-10-6-14 2z' fill='%23ec4899'/%3E%3Cpath d='M25 45c-8-4-8-12-2-14s12 4 18 14c-6 10-12 16-18 14s-6-10 2-14z' fill='%23ec4899'/%3E%3Ccircle cx='40' cy='40' r='3' fill='%23db2777'/%3E%3C/svg%3E`;

const DOTS_SVG = `data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' opacity='0.06'%3E%3Ccircle cx='4' cy='4' r='2' fill='%236366f1'/%3E%3Ccircle cx='16' cy='16' r='2' fill='%236366f1'/%3E%3C/svg%3E`;

const WAVES_SVG = `data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg' opacity='0.07'%3E%3Cpath d='M21.184 20c.357-.13.72-.264 1.088-.402l1.768-.661C33.64 15.347 39.647 14 50 14c10.271 0 15.362 1.222 24.629 4.928.955.383 1.869.74 2.75 1.072H100v-2h-20.871c-.964-.35-1.96-.71-2.99-1.08C66.398 12.784 60.77 11.5 50 11.5c-10.847 0-17.382 1.393-27.18 5.176l-1.782.666C19.98 17.747 18.914 18.12 17.818 18.5H0v2h21.184z' fill='%230284c7'/%3E%3C/svg%3E`;

const LEAVES_SVG = `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg' opacity='0.07'%3E%3Cpath d='M30 15c-6 0-12 6-12 12 0 8 12 18 12 18s12-10 12-18c0-6-6-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z' fill='%23059669'/%3E%3C/svg%3E`;

const STARS_SVG = `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg' opacity='0.15'%3E%3Cpolygon points='30,10 32,25 45,30 32,35 30,50 28,35 15,30 28,25' fill='%23e0e7ff'/%3E%3Ccircle cx='10' cy='12' r='1.5' fill='%23ffffff'/%3E%3Ccircle cx='50' cy='48' r='1.5' fill='%23ffffff'/%3E%3Ccircle cx='48' cy='15' r='1' fill='%23ffffff'/%3E%3C/svg%3E`;

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'default',
    name: 'Mặc định (Trắng tinh)',
    category: 'minimal',
    cssBackground: '#ffffff',
    previewBackground: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_aurora',
    name: 'Cực quang Aurora',
    category: 'gradient',
    cssBackground: 'radial-gradient(at 0% 0%, #cffafe 0px, transparent 50%), radial-gradient(at 100% 0%, #fbcfe8 0px, transparent 50%), radial-gradient(at 100% 100%, #fed7aa 0px, transparent 50%), radial-gradient(at 0% 100%, #a7f3d0 0px, transparent 50%), linear-gradient(135deg, #f0fdf4 0%, #fdf4ff 100%)',
    previewBackground: 'linear-gradient(135deg, #cffafe 0%, #fbcfe8 50%, #fed7aa 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_santorini',
    name: 'Biển xanh Santorini',
    category: 'gradient',
    cssBackground: `url("${WAVES_SVG}"), linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 100%)`,
    previewBackground: 'linear-gradient(135deg, #bae6fd 0%, #38bdf8 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_espresso',
    name: 'Cà phê & Gỗ ấm',
    category: 'gradient',
    cssBackground: 'linear-gradient(135deg, #faf5ef 0%, #f5ebe0 40%, #e3d5ca 100%)',
    previewBackground: 'linear-gradient(135deg, #f5ebe0 0%, #d5bdaf 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_sakura',
    name: 'Hoa anh đào Sakura',
    category: 'pattern',
    cssBackground: `url("${SAKURA_SVG}"), linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)`,
    previewBackground: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_emerald',
    name: 'Rừng thông & Ngọc bích',
    category: 'gradient',
    cssBackground: `url("${LEAVES_SVG}"), linear-gradient(135deg, #f0fdf4 0%, #dcfce7 45%, #bbf7d0 100%)`,
    previewBackground: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_sunset',
    name: 'Hoàng hôn San hô',
    category: 'gradient',
    cssBackground: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 45%, #fed7aa 100%)',
    previewBackground: 'linear-gradient(135deg, #ffe4e6 0%, #fda4af 50%, #fed7aa 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_lavender',
    name: 'Mây chiều Lavender',
    category: 'gradient',
    cssBackground: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)',
    previewBackground: 'linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_amber',
    name: 'Hổ phách & Nắng sớm',
    category: 'gradient',
    cssBackground: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 40%, #ffedd5 100%)',
    previewBackground: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'doodle_office',
    name: 'Doodle Công sở',
    category: 'pattern',
    cssBackground: `url("${DOODLE_SVG}"), linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)`,
    previewBackground: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'pattern_dots',
    name: 'Chấm bi Pastel Dots',
    category: 'pattern',
    cssBackground: `url("${DOTS_SVG}"), linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)`,
    previewBackground: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'pattern_grid',
    name: 'Lưới Cyber Grid',
    category: 'pattern',
    cssBackground: `url("${GRID_SVG}"), linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)`,
    previewBackground: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',
    defaultOpacity: 1,
    textColorTheme: 'dark'
  },
  {
    id: 'gradient_midnight',
    name: 'Đêm Indigo Huyền bí',
    category: 'dark',
    cssBackground: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
    previewBackground: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    defaultOpacity: 1,
    textColorTheme: 'light'
  },
  {
    id: 'dark_nebula',
    name: 'Vũ trụ Tinh vân',
    category: 'dark',
    cssBackground: `url("${STARS_SVG}"), linear-gradient(135deg, #090d16 0%, #17112d 50%, #2e1065 100%)`,
    previewBackground: 'linear-gradient(135deg, #090d16 0%, #2e1065 100%)',
    defaultOpacity: 1,
    textColorTheme: 'light'
  },
  {
    id: 'dark_cyber_matrix',
    name: 'Cyber Noir Matrix',
    category: 'dark',
    cssBackground: `url("${GRID_SVG}"), linear-gradient(135deg, #022c22 0%, #064e3b 50%, #042f2e 100%)`,
    previewBackground: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)',
    defaultOpacity: 1,
    textColorTheme: 'light'
  },
  {
    id: 'dark_amethyst',
    name: 'Thạch anh Tím Noir',
    category: 'dark',
    cssBackground: 'linear-gradient(135deg, #180828 0%, #2e1065 50%, #4c1d95 100%)',
    previewBackground: 'linear-gradient(135deg, #180828 0%, #3b0764 100%)',
    defaultOpacity: 1,
    textColorTheme: 'light'
  }
];

export const resolveChatFileUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  let clean = url.replace(/^\/+/, '');
  if (clean.startsWith('backend/')) {
    clean = clean.substring('backend/'.length);
  }
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const baseUrl = isLocal ? '/backend' : (import.meta.env.VITE_API_URL || 'https://myerp.ideas.edu.vn/backend');
  return `${baseUrl}/${clean}`;
};

export const getWallpaperStyle = (wallpaperConfig?: any) => {
  if (!wallpaperConfig) {
    return {
      background: '#ffffff',
      backgroundSize: 'auto',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      overlayOpacity: 1,
      isDark: false
    };
  }

  let config = wallpaperConfig;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }

  // Custom uploaded image
  if (config.custom && config.url) {
    const resolvedUrl = resolveChatFileUrl(config.url);
    return {
      background: `url("${resolvedUrl}") center / cover no-repeat, #ffffff`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      overlayOpacity: typeof config.overlay_opacity === 'number' ? Math.max(0.2, Math.min(1, config.overlay_opacity)) : 1,
      blur: config.blur || 0,
      isDark: false
    };
  }

  // Preset wallpaper
  if (config.preset_id && config.preset_id !== 'default') {
    const preset = WALLPAPER_PRESETS.find(p => p.id === config.preset_id) || WALLPAPER_PRESETS[0];
    const isSvgPattern = preset.cssBackground.includes('data:image/svg');
    return {
      background: preset.cssBackground,
      backgroundSize: isSvgPattern ? 'auto' : 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: isSvgPattern ? 'repeat' : 'no-repeat',
      overlayOpacity: typeof config.overlay_opacity === 'number' ? Math.max(0.2, Math.min(1, config.overlay_opacity)) : (preset.defaultOpacity ?? 1),
      isDark: preset.textColorTheme === 'light'
    };
  }

  return {
    background: '#ffffff',
    backgroundSize: 'auto',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    overlayOpacity: 1,
    isDark: false
  };
};
