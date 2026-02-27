'use client';

import React from 'react';
import SalaryRow from './SalaryRow';

type SalaryTableProps = {
  reports: any[];
  staffList: any[];
  lockEmployee: (rpt: any) => void;
  unlockEmployee: (historyId: string | number) => void;
  onOpenSettings?: (staffId: string) => void;
  onPrint: (rpt: any) => void;
  setAdjModalStaff: (staff: any) => void;
};

export default function SalaryTable({
  reports,
  staffList,
  lockEmployee,
  unlockEmployee,
  onOpenSettings,
  onPrint,
  setAdjModalStaff,
}: SalaryTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-500 text-sm font-bold uppercase tracking-wider border-b border-slate-200">
          <tr>
            <th className="p-4 pl-6">員工資訊</th>
            <th className="p-4">工時 / 應發項目</th>
            <th className="p-4">扣款項目</th>
            <th className="p-4">變動獎懲 (本月)</th>
            <th className="p-4 text-right">實發金額 (Net)</th>
            <th className="p-4 text-center">功能</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {reports.map((rpt: any, idx: number) => (
            <SalaryRow
              key={rpt.staff_id ?? idx}
              rpt={rpt}
              staffList={staffList}
              lockEmployee={lockEmployee}
              unlockEmployee={unlockEmployee}
              onOpenSettings={onOpenSettings}
              onPrint={onPrint}
              setAdjModalStaff={setAdjModalStaff}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

