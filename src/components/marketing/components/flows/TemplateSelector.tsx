
import React, { useState } from 'react';
import { Check, Search, Layout, Filter } from 'lucide-react';
import { Template } from '../../types';
import Input from '../common/Input';
// @ts-ignore
import { compileHTML } from '../templates/EmailEditor/utils/htmlCompiler';

const VisualTemplate: React.FC<{ template: Template }> = ({ template }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const html = template.htmlContent || (template.blocks ? compileHTML(template.blocks, template.bodyStyle, template.name) : '');

  React.useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        setScale(containerRef.current.offsetWidth / 800);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative overflow-hidden flex items-start justify-center">
      <div className="absolute top-0 origin-top" style={{
        width: '800px',
        height: '1000px',
        transform: `scale(${scale})`,
        pointerEvents: 'none'
      }}>
        <iframe
          srcDoc={html}
          className="w-full h-full border-none"
          title="preview"
          scrolling="no"
        />
      </div>
    </div>
  );
};

interface TemplateSelectorProps {
  templates: Template[];
  selectedId?: string;
  onSelect: (template: Template) => void;
  gridClassName?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ templates, selectedId, onSelect, gridClassName }) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const defaultGridClass = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-6 p-1 pb-8";

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="relative">
        <Input
          placeholder="Tìm mẫu email theo tên hoặc loại..."
          icon={Search}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="shadow-none border-slate-200"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={gridClassName || defaultGridClass}>
          {paginated.length > 0 ? (
            paginated.map((template) => {
            const isSelected = template.id === selectedId;
            return (
              <div
                key={template.id}
                onClick={() => onSelect(template)}
                className={`
                  relative group cursor-pointer rounded-[24px] border-2 transition-all overflow-hidden
                  ${isSelected ? 'border-orange-500 ring-4 ring-orange-50 shadow-lg' : 'border-slate-100 hover:border-slate-300 hover:shadow-md bg-white'}
                `}
              >
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  {template.thumbnail && !template.thumbnail.includes('placehold.co') ? (
                    <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" />
                  ) : (
                    <VisualTemplate template={template} />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-orange-500/20 backdrop-blur-[1px] flex items-center justify-center">
                      <div className="bg-white p-2.5 rounded-full shadow-xl text-orange-600 animate-in zoom-in duration-300">
                        <Check className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg text-[8px] font-black uppercase text-slate-500 border border-slate-100 shadow-sm flex items-center gap-1">
                    <span className="text-orange-500">Update:</span> {template.lastModified ? new Date(template.lastModified).toLocaleDateString('vi-VN') : 'Unknown'}
                  </div>
                </div>
                <div className="p-3 bg-white border-t border-slate-50">
                  <p className="text-xs font-black text-slate-800 truncate">{template.name}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Layout className="w-8 h-8 text-slate-200" /></div>
            <p className="text-slate-400 font-bold text-sm">Không tìm thấy mẫu phù hợp</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
          <p className="text-xs font-bold text-slate-400">
            Trang <span className="text-slate-700">{currentPage}</span> / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Trước
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
