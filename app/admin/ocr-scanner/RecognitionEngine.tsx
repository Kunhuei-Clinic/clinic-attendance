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

        // 僅辨識時間相關字元，並鎖定 PSM 模式為單行文字（7），提高時間字串辨識率
        await worker.setParameters({
          // 放寬白名單，讓點矩陣字體把冒號看成 . 或 ; 或空白時也能被容忍
          tessedit_char_whitelist: '0123456789:.; ',
          // 7 = Treat the image as a single text line
          tessedit_pageseg_mode: 7 as any,
        } as any);

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
 * 對單一 cell 影像做放大與二值化，只保留深色墨水，去除淺色格線與背景。
 * 回傳增強後的 Canvas，以及是否為「幾乎空白」的判斷結果。
 */
function enhanceCellForOCR(srcCanvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; isBlank: boolean } {
  const scale = 3; // 放大 3 倍增加細節
  const width = Math.max(1, Math.floor(srcCanvas.width * scale));
  const height = Math.max(1, Math.floor(srcCanvas.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { canvas, isBlank: true };
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const totalPixels = width * height;
  let darkPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 使用標準亮度公式，動態判斷「比淺灰還暗」的像素當作墨水
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    const isDark = luma < 160;
    if (isDark) {
      // 深色墨水：強制轉為純黑
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      darkPixels++;
    } else {
      // 其他全部漂白
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // 深色像素比例低於 0.5% 視為空白格（再放寬一點，避免墨水被漂白後全部判空）
  const isBlank = darkPixels / totalPixels < 0.005;
  return { canvas, isBlank };
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
      // 為了增加手動對齊的容錯率：左右僅略過 15% / 上下略過 5%，保留 80% 寬與 90% 高
      const cropX = x + cellWidth * 0.15;
      const cropW = cellWidth * 0.8;
      const cropY = y + cellHeight * 0.05;
      const cropH = cellHeight * 0.9;

      const cellCanvas = document.createElement('canvas');
      const safeW = Math.max(1, Math.floor(cropW));
      const safeH = Math.max(1, Math.floor(cropH));
      cellCanvas.width = safeW;
      cellCanvas.height = safeH;
      const ctx = cellCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(
        canvas,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        safeW,
        safeH
      );

      // 濾除格線與背景，只保留深色墨水，並判斷是否為空白格
      const { canvas: enhancedCanvas, isBlank } = enhanceCellForOCR(cellCanvas);
      if (isBlank) {
        continue;
      }

      const { data } = await worker.recognize(enhancedCanvas);
      const rawText = (data.text || '').trim();

      let value = '';

      // 第 1 階段：優先處理含有 : . ; 等分隔符的情況
      if (rawText) {
        let txt = rawText.toUpperCase().replace(/O/g, '0');
        const colonLikeMatches = txt.match(/\d{1,2}[:.;]\d{2}/g);
        if (colonLikeMatches && colonLikeMatches.length > 0) {
          const last = colonLikeMatches[colonLikeMatches.length - 1];
          const digits = last.replace(/[^0-9]/g, '');
          if (digits.length >= 3) {
            const last4 = digits.slice(-4).padStart(4, '0');
            const hh = parseInt(last4.slice(0, 2), 10);
            const mm = parseInt(last4.slice(2, 4), 10);
            if (hh < 24 && mm < 60) {
              value = `${last4.slice(0, 2)}:${last4.slice(2, 4)}`;
            }
          }
        }

        // 第 2 階段：沒有可靠分隔符時，使用純數字暴力切時間（處理 0750 / 0 7 5 0 / O75O 等）
        if (!value) {
          let clean = txt.replace(/[^0-9]/g, '');
          if (clean.length >= 3) {
            const last4 = clean.slice(-4).padStart(4, '0');
            const hh = parseInt(last4.slice(0, 2), 10);
            const mm = parseInt(last4.slice(2, 4), 10);
            if (hh < 24 && mm < 60) {
              value = `${last4.slice(0, 2)}:${last4.slice(2, 4)}`;
            }
          }
        }
      }

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

