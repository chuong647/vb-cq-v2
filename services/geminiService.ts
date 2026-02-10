
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

const processChunk = async (ai: GoogleGenAI, base64Data: string): Promise<ExtractedDocument[]> => {
  const systemInstruction = `Bạn là chuyên gia văn thư lưu trữ với độ chính xác tuyệt đối. 
Nhiệm vụ: Bóc tách TOÀN BỘ các văn bản hành chính trong tệp PDF.

QUY TẮC NGHIÊM NGẶT (KHÔNG ĐƯỢC VI PHẠM):
1. KHÔNG ĐẢO VĂN BẢN: Phải liệt kê văn bản theo đúng thứ tự xuất hiện trong file PDF từ trang đầu đến trang cuối. Không được xáo trộn vị trí.
2. ĐỘ CHÍNH XÁC SỐ LƯỢNG: TUYỆT ĐỐI đảm bảo số lượng văn bản trích xuất là chính xác. Mỗi văn bản phải được xác định duy nhất bởi trang bắt đầu của nó (startPage) và các thông tin ký hiệu, ngày tháng. Không bỏ sót văn bản, không tạo văn bản trùng lặp không có thật.
3. GIỮ NGUYÊN NỘI DUNG: Trích yếu phải bám sát văn bản gốc. Không tóm tắt làm mất đi các từ ngữ chuyên môn hoặc làm thay đổi ý nghĩa gốc.
4. CƠ QUAN BAN HÀNH (authority): 
   - KHÔNG viết in hoa tất cả các chữ cái.
   - CHỈ viết hoa chữ cái đầu tiên và các từ là tên riêng (Ví dụ: 'Ủy ban nhân dân tỉnh Lâm Đồng').
5. LOẠI VĂN BẢN & TRÍCH YẾU:
   - Tách biệt rõ Loại văn bản (Quyết định, Công văn...) và Trích yếu.
   - Trích yếu bắt đầu bằng chữ thường. Nếu là văn bản nhân sự, bắt buộc có tên đối tượng thụ hưởng.
6. SỐ HIỆU: Ghi đầy đủ (Ví dụ: 123/QĐ-UBND).
7. SỐ TRANG (startPage): Ưu tiên trích xuất số ghi bằng bút chì ở góc trên bên phải trang đầu của văn bản. Đây là yếu tố then chốt để phân biệt các văn bản. Nếu không thấy, hãy ước lượng dựa trên số thứ tự trang PDF thực tế.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64Data } },
            { text: "Hãy trích xuất danh sách văn bản theo đúng thứ tự xuất hiện, tuyệt đối không đảo văn bản và đảm bảo độ chính xác số lượng." }
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
      allResults = await processChunk(ai, base64Data);
    } else {
      for (let i = 0; i < totalPdfPages; i += PAGES_PER_CHUNK) {
        const newDoc = await PDFDocument.create();
        const end = Math.min(i + PAGES_PER_CHUNK, totalPdfPages);
        const pagesToCopy = Array.from({ length: end - i }, (_, k) => i + k);
        const copiedPages = await newDoc.copyPages(pdfDoc, pagesToCopy);
        copiedPages.forEach(page => newDoc.addPage(page));
        const pdfBytes = await newDoc.save();
        const base64Chunk = uint8ArrayToBase64(pdfBytes);
        const chunkResults = await processChunk(ai, base64Chunk);
        allResults = [...allResults, ...chunkResults];
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

      const formattedDate = doc.date ? (doc.date.startsWith("'") ? doc.date : `'${doc.date}`) : "";

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
