export type CardSide = 'front' | 'back'; // 正面 1-15 日 / 背面 16-31 日

export type ShiftCode = 'AM' | 'PM' | 'OT';

export type OcrCellResult = {
  row: number; // 1-31 天
  shift: ShiftCode;
  startTime: string;
  endTime: string;
};

export type OcrGridResult = {
  cells: OcrCellResult[];
};

type VisionWord = {
  text: string;
  x: number;
};

type VisionResult = {
  words: VisionWord[];
};

/**
 * 使用 Google Vision API 進行 OCR：
 * - 紅框內的 Canvas 傳入此函式
 * - 先裁掉左 12%（日期）與右 10%（小計），保留中間時間區塊
 * - 垂直切為 rows(15/16) 條，每條代表一天
 * - 每條一次送到 /api/vision，取得每個時間文字的 X 座標
 * - 依 X 座標將時間分成 AM / PM / OT 三個時段
 */
export async function recognizeAttendanceCard(
  canvas: HTMLCanvasElement,
  side: CardSide
): Promise<OcrGridResult> {
  const rows = side === 'front' ? 15 : 16;

  if (!canvas.width || !canvas.height) {
    return { cells: [] };
  }

  const totalWidth = canvas.width;
  const totalHeight = canvas.height;

  // 由紅框已經精準裁切數字區，再額外裁切會造成欄位遺失，這裡不再做左右裁切
  const leftCut = 0;
  const rightCut = 0;
  const croppedWidth = totalWidth;

  const rowHeight = totalHeight / rows;

  const rowCanvases: HTMLCanvasElement[] = [];

  for (let r = 0; r < rows; r++) {
    const y0 = rowHeight * r;

    const rowCanvas = document.createElement('canvas');
    rowCanvas.width = croppedWidth;
    rowCanvas.height = Math.max(1, Math.floor(rowHeight));
    const ctx = rowCanvas.getContext('2d');
    if (!ctx) continue;

    ctx.drawImage(
      canvas,
      leftCut,
      y0,
      croppedWidth,
      rowHeight,
      0,
      0,
      rowCanvas.width,
      rowCanvas.height
    );

    rowCanvases.push(rowCanvas);
  }

  if (!rowCanvases.length) {
    return { cells: [] };
  }

  // 轉成 base64（去掉 dataURL 頭）
  const images: string[] = rowCanvases.map((rc) => {
    const dataUrl = rc.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
  });

  // 呼叫後端 Vision API
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ images }),
  });

  if (!res.ok) {
    console.error('Vision API error:', res.status, await res.text());
    throw new Error('雲端 OCR 呼叫失敗，請稍後再試');
  }

  const json = await res.json();
  const results: VisionResult[] = Array.isArray(json.results)
    ? json.results
    : [];

  const cells: OcrCellResult[] = [];
  const dayOffset = side === 'front' ? 0 : 15; // 正面 1-15，背面 16-31

  for (let r = 0; r < rows; r++) {
    const result = results[r];
    const words: VisionWord[] = result?.words ?? [];
    if (!words.length) continue;

    const cropW = rowCanvases[r]?.width || croppedWidth;

    // 過濾出符合時間格式的字詞
    const timeWords = words.filter((w) =>
      /([012]?\d:[0-5]\d)/.test(w.text)
    );
    if (!timeWords.length) continue;

    const row = dayOffset + r + 1;
    const colW = cropW / 6;

    let amStart = '';
    let amEnd = '';
    let pmStart = '';
    let pmEnd = '';
    let otStart = '';
    let otEnd = '';

    timeWords.forEach((w) => {
      // 將 X 座標映射到 0~5 的欄位索引，稍微右偏一點以增加容錯
      const colIndex = Math.floor((w.x + colW * 0.2) / colW);
      switch (colIndex) {
        case 0: // 早上上
          if (!amStart) amStart = w.text;
          amEnd = w.text;
          break;
        case 1: // 早上下
          if (!amEnd) amEnd = w.text;
          else amEnd = w.text;
          break;
        case 2: // 午上
          if (!pmStart) pmStart = w.text;
          pmEnd = w.text;
          break;
        case 3: // 午下
          if (!pmEnd) pmEnd = w.text;
          else pmEnd = w.text;
          break;
        case 4: // 晚上/加班上
          if (!otStart) otStart = w.text;
          otEnd = w.text;
          break;
        case 5: // 晚下/加班下
        default:
          if (!otEnd) otEnd = w.text;
          else otEnd = w.text;
          break;
      }
    });

    const pushShift = (shift: ShiftCode, st: string, et: string) => {
      if (!st && !et) return;
      cells.push({
        row,
        shift,
        startTime: st || '',
        endTime: et || '',
      });
    };

    pushShift('AM', amStart, amEnd);
    pushShift('PM', pmStart, pmEnd);
    pushShift('OT', otStart, otEnd);
  }

  return { cells };
}

