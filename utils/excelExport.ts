
import XLSX from 'xlsx-js-style';
import { ExtractedDocument, ExcelExportConfig } from '../types';

export const exportToExcel = (
  data: ExtractedDocument[], 
  fileName: string = 'ket_qua_trich_xuat',
  config: ExcelExportConfig
) => {
  const formattedData = data.map(item => ({
    "Số ký hiệu": item.symbol,
    "Ngày tháng": item.date,
    "Trích yếu nội dung": `${item.docType} ${item.summary}`,
    "Cơ quan ban hành": item.authority,
    "Số trang": item.pageRange, // No longer needs .replace(/'/g, '') here
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:A1");
  
  const borderStyle = config.allBorders ? {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } }
  } : {};

  const fontStyle = {
    name: config.fontName,
    sz: config.fontSize,
  };

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) continue;

      const cell = worksheet[cellAddress];
      if (!cell.s) cell.s = {};

      cell.s.font = { ...fontStyle };
      if (config.allBorders) cell.s.border = borderStyle;

      cell.s.alignment = { 
        vertical: "center",
        wrapText: config.wrapText 
      };

      if (R === 0) {
        cell.s.font = { ...fontStyle, bold: true };
        cell.s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
        cell.s.fill = { fgColor: { rgb: "EFEFEF" } };
      } else {
        if (C === 1 || C === 4) { 
            cell.s.alignment = { horizontal: "center", vertical: "center" };
        }
        if (C === 2) {
            cell.s.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        }
      }
    }
  }

  const wscols = [
    { wch: 20 }, // Symbol
    { wch: 15 }, // Date
    { wch: 65 }, // Summary
    { wch: 35 }, // Authority
    { wch: 15 }, // Page Range
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Mục lục văn bản");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
