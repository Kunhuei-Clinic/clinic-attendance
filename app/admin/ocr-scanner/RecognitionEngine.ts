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

  // 左右裁切：移除日期與小計欄位，只保留中間時間格
  const leftCut = totalWidth * 0.12;
  const rightCut = totalWidth * 0.1;
  const croppedWidth = Math.max(
    1,
    Math.floor(totalWidth - leftCut - rightCut)
  );

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

    const am: VisionWord[] = [];
    const pm: VisionWord[] = [];
    const ot: VisionWord[] = [];

    timeWords.forEach((w) => {
      if (w.x < cropW * 0.34) {
        am.push(w);
      } else if (w.x < cropW * 0.67) {
        pm.push(w);
      } else {
        ot.push(w);
      }
    });

    const row = dayOffset + r + 1;

    const pushShift = (shift: ShiftCode, bucket: VisionWord[]) => {
      if (!bucket.length) return;
      const startTime = bucket[0].text;
      const endTime = bucket[bucket.length - 1].text;
      cells.push({
        row,
        shift,
        startTime,
        endTime,
      });
    };

    pushShift('AM', am);
    pushShift('PM', pm);
    pushShift('OT', ot);
  }

  return { cells };
}

