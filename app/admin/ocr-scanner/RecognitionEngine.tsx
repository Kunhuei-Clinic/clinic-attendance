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
let workerPromise: any | null = null;

async function getWorker(onLog?: (m: any) => void) {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const worker = await createWorker('eng', 1, {
          // 型別定義較舊，這裡直接使用 any 以避免 logger 型別錯誤
          logger: (m: any) => {
            console.log(m);
            onLog?.(m);
          },
        } as any);

        // 僅辨識數字與冒號
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789:',
        });

        return worker;
      } catch (err) {
        // 初始化失敗時重置，避免之後永遠卡在壞掉的 Promise
        workerPromise = null;
        throw err;
      }
    })();
  }
  return workerPromise;
}

/**
 * 將打卡卡片（已裁切為數字區域）切為 rows x 6 格並進行 OCR。
 * rows 依據卡片正反面而定：正面 15 天、背面 16 天。
 * @param canvas 已經裁切好、僅包含打卡數字格子的 Canvas
 * @param side   'front' | 'back' 用來決定天數與日期位移
 */

function isBlankCell(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const totalPixels = width * height;
  let darkCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness < 150) {
      darkCount++;
    }
  }

  // 若深色像素比例小於 1.5%，視為空白格
  return darkCount / totalPixels < 0.015;
}

export async function recognizeAttendanceCard(
  canvas: HTMLCanvasElement,
  side: CardSide,
  onProgress?: (message: string) => void
): Promise<OcrGridResult> {
  const worker = await getWorker((m) => {
    if (!onProgress || !m) return;
    if (m.status === 'downloading language traineddata') {
      const percent = m.progress ? Math.round(m.progress * 100) : 0;
      onProgress(`下載 AI 模型 (${percent}%)...`);
    } else if (m.status === 'initializing api') {
      onProgress('初始化引擎...');
    }
  });

  const rows = side === 'front' ? 15 : 16;
  const cols = 6; // 6 欄時間欄位（早上上/下、下午上/下、加班上/下）

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
      const cropX = x + cellWidth * 0.3;
      const cropW = cellWidth * 0.7;

      const cellCanvas = document.createElement('canvas');
      const safeW = Math.max(1, Math.floor(cropW));
      const safeH = Math.max(1, Math.floor(cellHeight));
      cellCanvas.width = safeW;
      cellCanvas.height = safeH;
      const ctx = cellCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(
        canvas,
        cropX,
        y,
        cropW,
        cellHeight,
        0,
        0,
        safeW,
        safeH
      );

      // 預先檢查是否為空白格，若幾乎沒有墨水，直接略過，不送給 Tesseract
      if (isBlankCell(ctx, cropW, cellHeight)) {
        continue;
      }

      const { data } = await worker.recognize(cellCanvas);
      const rawText = (data.text || '').trim();

      // 嚴格萃取時間格式 (HH:mm)，避免日期數字與時間黏在一起
      const value = rawText.match(/([012]?\d:[0-5]\d)/)?.[0] || '';

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

    // 每處理完一整天（1 列），回報一次進度
    if (onProgress) {
      onProgress(`正在掃描... 第 ${r + 1} / ${rows} 天`);
    }
  }

  return { cells };
}

