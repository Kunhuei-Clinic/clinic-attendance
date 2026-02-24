import { createWorker } from 'tesseract.js';

export type CardSide = 'front' | 'back'; // 正面 1-15 日 / 背面 16-31 日

export type OcrCellResult = {
  row: number;       // 1-31 天
  col: number;       // 0-5 六格：早上上/下、下午上/下、加班上/下
  rawText: string;
  value: string;     // 僅保留 0-9 和 :
  confidence: number;
};

export type OcrGridResult = {
  cells: OcrCellResult[];
};

// 單例 worker（避免多次載入 Tesseract）
let workerPromise: Promise<ReturnType<typeof createWorker>> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker({
      logger: () => {}, // 如需除錯可印出 progress
    });
    const worker = await workerPromise;
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    // 僅辨識數字與冒號
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789:',
    });
  }
  return workerPromise!;
}

/**
 * 將打卡卡片（已裁切為數字區域）切為 rows x 6 格並進行 OCR。
 * rows 依據卡片正反面而定：正面 15 天、背面 16 天。
 * @param canvas 已經裁切好、僅包含打卡數字格子的 Canvas
 * @param side   'front' | 'back' 用來決定天數與日期位移
 */
export async function recognizeAttendanceCard(
  canvas: HTMLCanvasElement,
  side: CardSide
): Promise<OcrGridResult> {
  const worker = await getWorker();

  const rows = side === 'front' ? 15 : 16;
  const cols = 8; // 日期、早上上/下、下午上/下、加班上/下、小計

  const cellWidth = canvas.width / cols;
  const cellHeight = canvas.height / rows;

  const dayOffset = side === 'front' ? 0 : 15; // 正面 1-15，背面 16-31

  const cells: OcrCellResult[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellWidth;
      const y = r * cellHeight;

      // 從主 canvas 擷取當前 cell 的影像
      // 為了排除左側「橫向小日期」干擾，只取中右側 70% 區域做 OCR
      const srcX = x + cellWidth * 0.3;
      const srcW = cellWidth * 0.7;

      const cellCanvas = document.createElement('canvas');
      cellCanvas.width = srcW;
      cellCanvas.height = cellHeight;
      const ctx = cellCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(
        canvas,
        srcX,
        y,
        srcW,
        cellHeight,
        0,
        0,
        srcW,
        cellHeight
      );

      const { data } = await worker.recognize(cellCanvas);
      const rawText = (data.text || '').trim();

      // 嚴格萃取時間格式 (HH:mm)，避免日期數字與時間黏在一起
      const match = rawText.match(/([012]?\d:[0-5]\d)/);
      const value = match ? match[1] : '';

      if (rawText.length === 0 && value.length === 0) {
        // 空白或未偵測到合法時間的格子略過，減少雜訊與加速處理
        continue;
      }

      cells.push({
        row: dayOffset + r + 1,
        col: c,
        rawText,
        value,
        confidence: data.confidence,
      });
    }
  }

  return { cells };
}

