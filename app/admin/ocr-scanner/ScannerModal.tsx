'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, ZoomIn, Move } from 'lucide-react';
import { recognizeAttendanceCard, OcrGridResult, CardSide } from './RecognitionEngine';
import ResultTable, { OcrAttendanceRecord } from './ResultTable';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const GRID_COLS = 6;

const ScannerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // 影像層
  const overlayRef = useRef<HTMLCanvasElement | null>(null); // 網格層（不跟著縮放/拖曳）
  const containerRef = useRef<HTMLDivElement | null>(null); // 包覆兩個 canvas 的容器
  const gridBoxRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );

  const [cardSide, setCardSide] = useState<CardSide>('front');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });

  const [isRecognizing, setIsRecognizing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OcrGridResult | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<
    OcrAttendanceRecord[]
  >([]);

  useEffect(() => {
    if (!isOpen) {
      setImage(null);
      setScale(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      setOcrResult(null);
      setAttendanceRecords([]);
      setCardSide('front');
    }
  }, [isOpen]);

  const drawOverlayGrid = () => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = cardSide === 'front' ? 15 : 16;
    const w = canvas.width;
    const h = canvas.height;

    // 最大紅框尺寸限制：高度最多佔整體 55%，寬度最多佔整體 80%
    const maxGridH = h * 0.55;
    const maxGridW = w * 0.8;

    if (!maxGridH || !maxGridW) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    // 鎖定紅框實體長寬比：實體卡片 6 欄寬 (每欄 1.2cm) / rows 列高 (每列 0.6cm)
    const targetRatio = 7.2 / (rows * 0.6);

    // 先以高度為主計算，若寬度超過上限再反向以寬度計算
    let boxH: number = maxGridH;
    let boxW: number = boxH * targetRatio;

    if (boxW > maxGridW) {
      boxW = maxGridW;
      boxH = boxW / targetRatio;
    }

    const x0 = (w - boxW) / 2;
    // 網格從視覺上偏中下方開始，預留上方標頭空間，並確保不超出底部
    const y0 = Math.min(h * 0.35, h - boxH - 20);
    const gridW = boxW;
    const gridH = boxH;

    gridBoxRef.current = { x: x0, y: y0, w: gridW, h: gridH };

    ctx.clearRect(0, 0, w, h);

    // 外框
    ctx.strokeStyle = 'rgba(220,38,38,0.85)'; // red-600
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, gridW, gridH);

    // 內部格線
    ctx.strokeStyle = 'rgba(248,113,113,0.6)'; // red-400
    ctx.lineWidth = 1;

    // 垂直線 (依 GRID_COLS 格)
    const colWidth = gridW / GRID_COLS;
    for (let c = 1; c < GRID_COLS; c++) {
      const x = x0 + c * colWidth;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + gridH);
      ctx.stroke();
    }

    // 水平線 (依 rows)
    const rowHeight = gridH / rows;
    for (let r = 1; r < rows; r++) {
      const y = y0 + r * rowHeight;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + gridW, y);
      ctx.stroke();
    }

    // 對齊防呆標籤：欄位名稱與起訖日期
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = 'rgba(220,38,38,0.9)';
    ctx.textBaseline = 'bottom';

    // 欄標題：早上 / 早下 / 午上 / 午下 / 晚上 / 晚下
    const colLabels = ['早上', '早下', '午上', '午下', '晚上', '晚下'];
    ctx.textAlign = 'center';
    for (let c = 0; c < GRID_COLS; c++) {
      const labelX = x0 + (c + 0.5) * colWidth;
      const labelY = y0 - 8;
      ctx.fillText(colLabels[c] ?? '', labelX, labelY);
    }

    // 列標籤：起訖日期
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const startLabel = cardSide === 'front' ? '1日 ->' : '16日 ->';
    const endLabel = cardSide === 'front' ? '15日 ->' : '31日 ->';
    ctx.fillText(startLabel, x0 - 8, y0 + 15);
    ctx.fillText(endLabel, x0 - 8, y0 + gridH - 5);
  };

  useEffect(() => {
    drawOverlayGrid();
  }, [cardSide]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setImage(img);
      drawImage(img);
    };
    img.src = URL.createObjectURL(file);
  };

  const drawImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2 + offset.x, ch / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    const ratio = Math.min(cw / img.width, ch / img.height);
    const drawWidth = img.width * ratio;
    const drawHeight = img.height * ratio;

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  };

  useEffect(() => {
    if (image && canvasRef.current) {
      drawImage(image);
    }
  }, [image, scale, rotation, offset]);

  // 監聽容器尺寸變化，讓 canvas 動態適應大小
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!container || !canvas || !overlay) return;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;

      canvas.width = width;
      canvas.height = height;
      overlay.width = width;
      overlay.height = height;

      if (image) {
        drawImage(image);
      } else {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, width, height);
      }
      drawOverlayGrid();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => {
      observer.disconnect();
    };
  }, [image, cardSide]);

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.3, Math.min(3, prev + delta)));
  };

  const handleMouseDown: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    if (!isDragging || !dragStart) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const resetView = () => {
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handleRecognize = async () => {
    if (!canvasRef.current) return;
    setIsRecognizing(true);
    setProgressMsg('雲端 AI 辨識中，請稍候...');
    try {
      const srcCanvas = canvasRef.current;

      // 只擷取紅色網格區域作為 OCR 來源（使用等比例置中的紅框）
      const { x, y, w, h } = gridBoxRef.current;
      const hasBox = w > 0 && h > 0;
      const gridX = hasBox ? x : 0;
      const gridY = hasBox ? y : 0;
      const gridW = hasBox ? w : srcCanvas.width;
      const gridH = hasBox ? h : srcCanvas.height;

      const cropped = document.createElement('canvas');
      cropped.width = gridW;
      cropped.height = gridH;
      const ctx = cropped.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(
        srcCanvas,
        gridX,
        gridY,
        gridW,
        gridH,
        0,
        0,
        gridW,
        gridH
      );

      const grid = await recognizeAttendanceCard(cropped, cardSide);
      setOcrResult(grid);

      const records: OcrAttendanceRecord[] = [];
      const [yearStr, monthStr] = selectedMonth.split('-');

      const pad = (n: number) => String(n).padStart(2, '0');
      const defaultYear = String(new Date().getFullYear());
      const defaultMonth = pad(new Date().getMonth() + 1);

      grid.cells.forEach((cell) => {
        const year = yearStr || defaultYear;
        const month = monthStr || defaultMonth;
        const dateStr = `${year}-${month}-${pad(cell.row)}`;

        const startTime = cell.startTime;
        let endTime = cell.endTime;
        if (endTime === startTime) {
          endTime = '';
        }

        const workType = cell.shift === 'OT' ? '加班' : '正常班';
        const note =
          cell.shift === 'AM'
            ? '早班'
            : cell.shift === 'PM'
            ? '午班'
            : '晚班/加班';

        records.push({
          id: `${dateStr}-${cell.shift}`,
          date: dateStr,
          startTime,
          endTime,
          workType,
          note,
          errors: [],
        });
      });

      setAttendanceRecords(records);
    } catch (err) {
      console.error(err);
      alert('OCR 辨識失敗，請稍後再試或調整圖片。');
    } finally {
      setIsRecognizing(false);
      setProgressMsg('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              實體打卡卡 OCR 辨識 (預備版)
            </span>
            <span className="text-xs text-orange-500 border border-orange-200 px-2 py-0.5 rounded-full">
              實驗功能・不影響現有考勤
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden min-h-0">
          <div className="border-r flex flex-col min-h-0">
            <div className="p-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm rounded-lg border bg-slate-50 hover:bg-slate-100 font-bold"
                >
                  上傳打卡卡照片
                </button>
                <button
                  onClick={resetView}
                  className="px-2 py-1.5 text-xs rounded-lg border bg-white hover:bg-slate-50 flex items-center gap-1"
                >
                  <RotateCcw size={14} />
                  重置視圖
                </button>
                <select
                  value={cardSide}
                  onChange={(e) => setCardSide(e.target.value as CardSide)}
                  className="px-2 py-1.5 text-xs rounded-lg border bg-white"
                >
                  <option value="front">正面 1 ~ 15 日</option>
                  <option value="back">背面 16 ~ 31 日</option>
                </select>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-500">月份：</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border rounded-lg px-2 py-1 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border bg-slate-50">
                  <ZoomIn size={14} /> 滾輪縮放
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border bg-slate-50">
                  <Move size={14} /> 拖曳移動
                </span>
              </div>
            </div>
            <div
              ref={containerRef}
              className="flex-1 bg-slate-100 flex items-center justify-center relative overflow-hidden min-h-0"
              onWheel={handleWheel}
            >
              <canvas
                ref={canvasRef}
                className="bg-white shadow-lg cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              />
              <canvas
                ref={overlayRef}
                className="pointer-events-none absolute inset-0"
              />
              {!image && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm text-center px-4">
                  請將紅框「精準貼合」打卡數字區！(可利用外圍的「早上/午下」與「1日/15日」等標籤輔助對齊)
                </div>
              )}
            </div>
            <div className="p-3 border-t flex justify-end">
              <button
                disabled={!image || isRecognizing}
                onClick={handleRecognize}
                className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {isRecognizing
                  ? progressMsg || '辨識中...'
                  : '開始 OCR 辨識'}
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <ResultTable
              ocrResult={ocrResult}
              records={attendanceRecords}
              setRecords={setAttendanceRecords}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerModal;

