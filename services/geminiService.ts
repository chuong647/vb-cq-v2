
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedDocument } from "../types";
import { PDFDocument } from "pdf-lib";

const API_LIMIT_BYTES = 30 * 1024 * 1024; 
const PAGES_PER_CHUNK = 15; 

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Lỗi khi đọc file."));
  });
};

const documentSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      docType: {
        type: Type.STRING,
        description: "Loại văn bản (Quyết định, Thông báo, Công văn, Kế hoạch...)",
      },
      symbol: {
        type: Type.STRING,
        description: "Số ký hiệu văn bản. Nếu không có để trống.",
      },
      date: {
        type: Type.STRING,
        description: "Ngày tháng văn bản (định dạng dd/mm/yyyy).",
      },
      summary: {
        type: Type.STRING,
        description: "Trích yếu nội dung tiếp nối sau tên loại văn bản. Giữ nguyên văn phong gốc, không đảo từ ngữ.",
      },
      authority: {
        type: Type.STRING,
        description: "Cơ quan ban hành văn bản trực tiếp.",
      },
      startPage: {
        type: Type.INTEGER,
        description: "Số trang bắt đầu (số bút chì ghi ở góc trên bên phải trang đầu của văn bản).",
      }
    },
    required: ["docType", "symbol", "date", "summary", "authority", "startPage"],
  },
};

const processChunk = async (ai: GoogleGenAI, base64Data: string, pageOffset: number): Promise<ExtractedDocument[]> => {
  const systemInstruction = `Bạn là chuyên gia văn thư lưu trữ cấp cao với khả năng bóc tách dữ liệu cực kỳ chính xác. 
Nhiệm vụ: Duyệt qua TỪNG TRANG của tệp PDF để bóc tách TOÀN BỘ các văn bản hành chính.

QUY TẮC TỐI THƯỢNG (KHÔNG ĐƯỢC SAI SÓT):
1. ĐẢM BẢO SỐ LƯỢNG: Phải bóc tách ĐÚNG và ĐỦ số lượng văn bản có trong tệp. Không được bỏ sót bất kỳ văn bản nào, dù là văn bản ngắn hay nằm ở cuối trang.
2. DẤU HIỆU NHẬN BIẾT: Mỗi khi thấy tiêu ngữ "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" hoặc tên cơ quan ban hành đi kèm với Số/Ký hiệu, đó là dấu hiệu bắt đầu một văn bản mới.
3. THỨ TỰ VẬT LÝ: Liệt kê văn bản theo đúng trình tự xuất hiện từ trang đầu đến trang cuối. Tuyệt đối không được đảo lộn thứ tự.
4. GIỮ NGUYÊN TRÍCH YẾU: Nội dung trích yếu phải đầy đủ, giữ nguyên văn phong hành chính, không tóm tắt làm mất thông tin quan trọng (đặc biệt là tên người, số tiền, địa danh).
5. ĐỊNH DẠNG CƠ QUAN (authority): Viết hoa chữ cái đầu và tên riêng (Ví dụ: 'Sở Nội vụ tỉnh Lâm Đồng'). Không viết in hoa toàn bộ.
6. SỐ TRANG (startPage): Ghi lại số trang bắt đầu của văn bản đó. Lưu ý: Trang đầu tiên của tệp này tương ứng với trang thứ ${pageOffset + 1} của toàn bộ hồ sơ.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64Data } },
            { text: `Hãy kiểm tra kỹ từng trang và trích xuất TOÀN BỘ danh sách văn bản. Trang đầu tiên bạn đang thấy là trang số ${pageOffset + 1} của file gốc. Đảm bảo số lượng văn bản trích xuất khớp hoàn toàn với thực tế, không bỏ sót bất kỳ mục nào.` }
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: documentSchema,
      },
    });

    const result = response.text;
    if (!result) return [];
    
    const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawData: ExtractedDocument[] = JSON.parse(cleanJson);

    return rawData;
  } catch (e: any) {
    console.error("Gemini processing error:", e);
    throw e;
  }
};

export const extractDataFromPdf = async (file: File): Promise<ExtractedDocument[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPdfPages = pdfDoc.getPageCount();

  let allResults: ExtractedDocument[] = [];

  try {
    if (file.size <= API_LIMIT_BYTES) {
      const base64Data = await fileToBase64(file);
      allResults = await processChunk(ai, base64Data, 0);
    } else {
      const OVERLAP = 1;
      for (let i = 0; i < totalPdfPages; i += (PAGES_PER_CHUNK - OVERLAP)) {
        const newDoc = await PDFDocument.create();
        const end = Math.min(i + PAGES_PER_CHUNK, totalPdfPages);
        
        // If we've already processed the last chunk, break
        if (i >= totalPdfPages) break;

        const pagesToCopy = Array.from({ length: end - i }, (_, k) => i + k);
        const copiedPages = await newDoc.copyPages(pdfDoc, pagesToCopy);
        copiedPages.forEach(page => newDoc.addPage(page));
        const pdfBytes = await newDoc.save();
        const base64Chunk = uint8ArrayToBase64(pdfBytes);
        const chunkResults = await processChunk(ai, base64Chunk, i);
        allResults = [...allResults, ...chunkResults];

        // If we reached the end of the PDF, break the loop
        if (end === totalPdfPages) break;
      }
    }

    // Sort all results by startPage first to maintain physical order
    allResults.sort((a, b) => a.startPage - b.startPage);

    // Filter for truly unique documents using a comprehensive key including startPage
    const seenKeys = new Set<string>();
    const uniqueResults: ExtractedDocument[] = [];

    for (const doc of allResults) {
      // Create a unique key for each document based on its identifying properties
      const key = `${doc.startPage}-${doc.symbol || ''}-${doc.date || ''}-${doc.summary || ''}`.toLowerCase();
      
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueResults.push(doc);
      }
    }

    return uniqueResults.map((doc, index, array) => {
      const nextDoc = array[index + 1];
      const startPage = doc.startPage;
      let endPage: number | null = null;
      
      if (nextDoc) {
        endPage = nextDoc.startPage - 1;
      }

      // Format pageRange without the leading apostrophe
      let displayRange = `${startPage}`;
      if (endPage !== null && endPage > startPage) {
        displayRange = `${startPage} - ${endPage}`;
      }

      const rawDate = doc.date || "";
      const formattedDate = rawDate.startsWith("'") ? rawDate : `'${rawDate}`;

      return {
        ...doc,
        date: formattedDate,
        pageRange: displayRange
      };
    });
  } catch (error: any) {
    throw new Error(error.message || "Lỗi xử lý PDF.");
  }
};
