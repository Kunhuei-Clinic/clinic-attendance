import React from 'react';

interface PortalTopHeaderProps {
  name?: string | null;
  role?: string | null;
  isVip?: boolean;
  children?: React.ReactNode;
}

const getTodayStr = () => new Date().toLocaleDateString('zh-TW');

/**
 * 員工入口共用頂部個人資訊區塊
 * - 顯示：日期、姓名、職稱
 * - 可在下方透過 children 擴充各頁專屬資訊（例如打卡 GPS 狀態）
 */
export default function PortalTopHeader({
  name,
  role,
  isVip,
  children,
}: PortalTopHeaderProps) {
  return (
    <div className="bg-teal-600 p-6 pt-12 text-white rounded-b-[2rem] shadow-lg relative">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-teal-200 text-sm font-bold mb-1">{getTodayStr()}</p>
          <h2 className="text-3xl font-black">
            {name || '—'}{' '}
            <span className="text-base font-normal opacity-80">
              {role || '職稱未設定'}
            </span>
          </h2>
        </div>
        {isVip && (
          <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-1 rounded-full shadow">
            VIP
          </span>
        )}
      </div>

      {children && (
        <div className="mt-6">{children}</div>
      )}
    </div>
  );
}

