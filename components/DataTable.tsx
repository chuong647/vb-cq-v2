
import React from 'react';
import { motion } from 'motion/react';
import { ExtractedDocument, ThemeConfig } from '../types';
import { FileSearch, ClipboardList } from 'lucide-react';

interface DataTableProps {
  data: ExtractedDocument[];
  theme: ThemeConfig;
}

export const DataTable: React.FC<DataTableProps> = ({ data, theme }) => {
  const p = theme.primary;
  const g = theme.gray;

  if (data.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex flex-col items-center justify-center py-20 px-4 text-center bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-${g}-200`}
      >
        <div className={`p-4 bg-${p}-50 text-${p}-400 rounded-full mb-4`}>
          <FileSearch size={48} strokeWidth={1.5} />
        </div>
        <h3 className={`text-xl font-bold text-${g}-800`}>Chưa có dữ liệu trích xuất</h3>
        <p className={`text-${g}-500 mt-2 max-w-xs mx-auto`}>Vui lòng tải lên file PDF để bắt đầu quá trình bóc tách văn bản.</p>
      </motion.div>
    );
  }

  const borderClass = `border border-slate-400`; 
  const cellPadding = "px-4 py-3";

  return (
    <motion.div 
      id="printable-table" 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="overflow-hidden rounded-2xl shadow-xl bg-white border border-slate-200 no-print"
    >
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          #printable-table, #printable-table * { visibility: visible; }
          #printable-table { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
          table { width: 100% !important; border-collapse: collapse !important; }
          td, th { border: 1px solid black !important; color: black !important; }
        }
        .administrative-table th {
          background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
        }
        .empty-field {
          color: #cbd5e1;
          font-style: italic;
        }
        .page-range-cell {
          color: #2563eb;
          font-weight: 700;
          font-family: ui-monospace, monospace;
        }
        @media print {
          .page-range-cell { color: black !important; }
        }
      `}</style>
      
      <div className="overflow-x-auto">
        <table 
          className="min-w-full border-collapse text-black administrative-table"
          style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}
        >
          <thead>
            <tr>
              <th className={`${borderClass} ${cellPadding} w-[15%] text-center font-bold uppercase text-[11px] tracking-wider`}>Số Ký Hiệu</th>
              <th className={`${borderClass} ${cellPadding} w-[12%] text-center font-bold uppercase text-[11px] tracking-wider`}>Ngày Tháng</th>
              <th className={`${borderClass} ${cellPadding} w-[38%] text-center font-bold uppercase text-[11px] tracking-wider`}>Trích Yêu Nội Dung</th>
              <th className={`${borderClass} ${cellPadding} w-[20%] text-center font-bold uppercase text-[11px] tracking-wider`}>Cơ Quan Ban Hành</th>
              <th className={`${borderClass} ${cellPadding} w-[15%] text-center font-bold uppercase text-[11px] tracking-wider`}>Số trang</th>
            </tr>
          </thead>
          <tbody>
            {data.map((doc, index) => (
              <motion.tr 
                key={index} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`group hover:bg-slate-50 transition-colors`}
              >
                <td className={`${borderClass} ${cellPadding} align-top`}>
                  {doc.symbol || <span className="empty-field">—</span>}
                </td>
                <td className={`${borderClass} ${cellPadding} align-top text-center whitespace-nowrap`}>
                  {doc.date ? doc.date.replace(/^'/, '') : <span className="empty-field">—</span>}
                </td>
                <td className={`${borderClass} ${cellPadding} align-top text-justify leading-relaxed`}>
                  <span className="font-bold">{doc.docType}</span>&nbsp;{doc.summary}
                </td>
                <td className={`${borderClass} ${cellPadding} align-top`}>
                  {doc.authority}
                </td>
                <td className={`${borderClass} ${cellPadding} align-top text-center page-range-cell`}>
                  {doc.pageRange || <span className="empty-field">—</span>}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className={`p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest no-print`}>
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className={`text-${p}-500`} />
          Tổng cộng: {data.length} văn bản (đã giữ đúng thứ tự gốc)
        </div>
        <div>DocuExtract AI Pro Engine</div>
      </div>
    </motion.div>
  );
};
