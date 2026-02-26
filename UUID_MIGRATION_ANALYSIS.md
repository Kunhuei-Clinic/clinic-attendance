# UUID 遷移分析報告

## 📋 任務目標
將系統中員工與醫師的 ID 從 `int8` 全面遷移至 `uuid`，以支援未來多院區架構。

---

## 🔍 一、全域掃描結果

### 1.1 受影響的資料表清單

#### 主表（需要修改主鍵）
- **`staff`** 表
  - 欄位：`id` (目前為 `int8`，需改為 `uuid`)
  - 說明：員工與醫師共用此表，醫師的 `role = '醫師'`

#### 子表（需要修改外鍵）
- **`attendance_logs`** 表
  - 欄位：目前只有 `staff_name`，**需要新增** `staff_id uuid`
  - 外鍵：`staff_id` → `staff(id)`
  
- **`roster`** 表（員工班表）
  - 欄位：`staff_id` (目前為 `int8`，需改為 `uuid`)
  - 外鍵：`staff_id` → `staff(id)`
  
- **`leave_requests`** 表（請假申請）
  - 欄位：`staff_id` (目前為 `int8`，需改為 `uuid`)
  - 外鍵：`staff_id` → `staff(id)`
  
- **`leave_settlements`** 表（特休結算）
  - 欄位：`staff_id` (目前為 `INTEGER`，需改為 `uuid`)
  - 外鍵：`staff_id` → `staff(id)`
  
- **`salary_history`** 表（薪資歷史）
  - 欄位：`staff_id` (目前為 `int8`，需改為 `uuid`)
  - 外鍵：`staff_id` → `staff(id)`
  
- **`salary_adjustments`** 表（薪資調整）
  - 欄位：`staff_id` (目前為 `int8`，需改為 `uuid`)
  - 外鍵：`staff_id` → `staff(id)`
  
- **`doctor_roster`** 表（醫師班表）
  - 欄位：`doctor_id` (目前為 `int8`，需改為 `uuid`)
  - 外鍵：`doctor_id` → `staff(id)` (role = '醫師')
  
- **`doctor_ppf`** 表（醫師 PPF 薪資）
  - 欄位：`doctor_id` (目前為 `int8`，需改為 `uuid`)
  - 外鍵：`doctor_id` → `staff(id)` (role = '醫師')

---

### 1.2 受影響的 SQL Migration 檔案

**位置：** `supabase/migrations/`

- `20250115000000_create_leave_settlements_table.sql` - 定義 `leave_settlements.staff_id INTEGER`
- `20251210090335_create_attendance_logs_table.sql` - 定義 `attendance_logs` 表（目前無 `staff_id`）

**注意：** 其他 migration 檔案主要是新增欄位或設定約束，不直接定義主鍵/外鍵型態。

---

### 1.3 受影響的 API 檔案（app/api/）

#### 使用 `staff_id` 的 API：
1. **`app/api/attendance/route.ts`**
   - `POST`: 使用 `Number(staffId)` 寫入 `staff_id`
   - `GET`: 使用 `selectedStaffId` 過濾

2. **`app/api/attendance/clock/route.ts`**
   - 使用 `Number(staffId)` 查詢與寫入

3. **`app/api/attendance/punch/route.ts`**
   - 使用 `staff.id` 寫入

4. **`app/api/leave/route.ts`**
   - `GET`: `Number(selectedStaffId)` 過濾
   - `POST`: `Number(staff_id)` 寫入

5. **`app/api/leave/settle/route.ts`**
   - `POST`: `Number(staff_id)` 寫入
   - `GET`: `Number(staffId)` 查詢

6. **`app/api/leave/stats/route.ts`**
   - 多處使用 `Number(staffId)` 或 `staff.id`

7. **`app/api/roster/staff/route.ts`**
   - `POST`: `Number(staff_id)` 寫入與查詢

8. **`app/api/salary/history/route.ts`**
   - `GET`: `Number(staffId)` 過濾
   - `POST`: 批次寫入時包含 `staff_id`

9. **`app/api/salary/adjustments/route.ts`**
   - `GET`: `Number(staffId)` 過濾
   - `POST`: `staff_id` 寫入

10. **`app/api/staff/profile/route.ts`**
    - `POST`: `Number(staff_id)` 更新
    - `GET`: `Number(staff_id)` 查詢

11. **`app/api/staff/leave-summary/route.ts`**
    - `Number(staffId)` 查詢

12. **`app/api/portal/data/route.ts`**
    - 多處使用 `staff_id` 查詢

#### 使用 `doctor_id` 的 API：
1. **`app/api/roster/doctor/route.ts`**
   - `GET`: `Number(doctorId)` 過濾
   - `POST`: `Number(doctor_id)` 寫入
   - `PATCH`: 批次複製時使用 `doctor_id`

2. **`app/api/doctor/ppf/route.ts`**
   - `GET`: `Number(doctorId)` 過濾
   - `POST`: `doctor_id` 寫入（upsert）

3. **`app/api/report/salary/route.ts`**
   - `Number(selectedStaffId)` 過濾（用於醫師）

---

### 1.4 受影響的前端檔案（app/ 與 components/）

#### 使用 `staff.id` 或 `staff_id` 的元件：
1. **`app/admin/AttendanceView/AttendanceModal.tsx`**
   - `Staff` 型別：`id: number`
   - 表單使用 `staff.id` 作為選項值

2. **`app/admin/AttendanceView.tsx`**
   - 使用 `log.staff_id` 或 `log.staffId`

3. **`app/admin/salary/page.tsx`**
   - 多處使用 `staff_id` 作為 key 或過濾條件
   - `staff.id` 用於比對

4. **`app/admin/leave/LeaveStatsTable.tsx`**
   - 使用 `stat.staff_id` 作為 key

5. **`app/portal/page.tsx`**
   - 使用 `staffUser.id` 寫入多個 API

6. **`app/portal/views/RosterView.tsx`**
   - 使用 `r.staff_id` 和 `r.doctor_id`

7. **`components/views/SalaryView.tsx`**
   - 多處使用 `staff_id` 和 `staff.id`

8. **`components/views/DoctorSalaryView.tsx`**
   - 使用 `selectedDoctorId` 查詢

9. **`app/admin/DoctorRosterPrint.tsx`**
   - 使用 `w.doctor_id` 比對

#### 使用 Cookie 的檔案（需要更新）：
1. **`app/api/auth/login/route.ts`**
   - Cookie: `staff_id` (String)

2. **`app/api/auth/line-bind/route.ts`**
   - Cookie: `staff_id` (String)

3. **`app/api/auth/line-check/route.ts`**
   - Cookie: `staff_id` (String)

4. **`app/api/auth/line-login/route.ts`**
   - Cookie: `staff_id` (String)

---

## 📊 二、資料遷移策略

### 2.1 遷移順序（重要！）

1. **階段一：準備工作**
   - 為 `attendance_logs` 新增 `staff_id uuid` 欄位（允許 NULL）
   - 建立臨時對照表（staff 舊 id → 新 uuid）

2. **階段二：資料回填**
   - 依據 `staff_name` 比對 `staff` 表，回填 `attendance_logs.staff_id`
   - 驗證資料完整性

3. **階段三：主表遷移**
   - 為 `staff` 表新增 `id_new uuid` 欄位
   - 為現有資料生成 UUID
   - 更新所有子表的外鍵（使用臨時對照表）

4. **階段四：切換主鍵**
   - 刪除舊主鍵約束
   - 將 `id_new` 更名為 `id`
   - 重建主鍵與外鍵約束

5. **階段五：清理**
   - 刪除臨時欄位與對照表
   - 重建索引

---

## ⚠️ 三、風險評估

### 3.1 高風險項目
- **外鍵約束**：需要暫時移除所有外鍵約束
- **資料完整性**：`attendance_logs.staff_name` 可能無法完全比對到 `staff` 表
- **並發寫入**：遷移期間需要停止寫入操作

### 3.2 建議措施
1. **備份資料庫**：遷移前完整備份
2. **維護時間窗口**：選擇低峰時段執行
3. **分批遷移**：可考慮分批處理大量資料
4. **驗證腳本**：遷移後執行資料完整性檢查

---

## 📝 四、前端與 API 修改建議

### 4.1 TypeScript 型別定義

**需要修改的型別：**

```typescript
// 修改前
type Staff = {
  id: number;
  name: string;
  role?: string | null;
};

// 修改後
type Staff = {
  id: string; // 改為 string (UUID)
  name: string;
  role?: string | null;
};
```

### 4.2 API 修改範例

#### 範例 1：移除 `Number()` 轉換

**修改前：**
```typescript
.eq('id', Number(staff_id))
```

**修改後：**
```typescript
.eq('id', staff_id) // staff_id 已經是 string (UUID)
```

#### 範例 2：Cookie 處理

**修改前：**
```typescript
response.cookies.set('staff_id', String(matchedStaff.id), { ... });
```

**修改後：**
```typescript
response.cookies.set('staff_id', matchedStaff.id, { ... }); // id 已經是 string
```

#### 範例 3：前端表單提交

**修改前：**
```typescript
const payload = {
  staff_id: Number(staffId),
  // ...
};
```

**修改後：**
```typescript
const payload = {
  staff_id: staffId, // 直接使用 string
  // ...
};
```

### 4.3 需要修改的檔案清單

#### API 檔案（共 15 個）：
1. `app/api/attendance/route.ts`
2. `app/api/attendance/clock/route.ts`
3. `app/api/attendance/punch/route.ts`
4. `app/api/leave/route.ts`
5. `app/api/leave/settle/route.ts`
6. `app/api/leave/stats/route.ts`
7. `app/api/roster/staff/route.ts`
8. `app/api/roster/doctor/route.ts`
9. `app/api/salary/history/route.ts`
10. `app/api/salary/adjustments/route.ts`
11. `app/api/staff/profile/route.ts`
12. `app/api/staff/leave-summary/route.ts`
13. `app/api/portal/data/route.ts`
14. `app/api/doctor/ppf/route.ts`
15. `app/api/report/salary/route.ts`

#### 認證相關（4 個）：
16. `app/api/auth/login/route.ts`
17. `app/api/auth/line-bind/route.ts`
18. `app/api/auth/line-check/route.ts`
19. `app/api/auth/line-login/route.ts`

#### 前端元件（約 10+ 個）：
- `app/admin/AttendanceView/AttendanceModal.tsx`
- `app/admin/AttendanceView.tsx`
- `app/admin/salary/page.tsx`
- `app/admin/leave/LeaveStatsTable.tsx`
- `app/portal/page.tsx`
- `app/portal/views/RosterView.tsx`
- `components/views/SalaryView.tsx`
- `components/views/DoctorSalaryView.tsx`
- `app/admin/DoctorRosterPrint.tsx`
- 其他使用 `staff.id` 或 `staff_id` 的元件

---

## ✅ 五、檢查清單

### 遷移前檢查
- [ ] 完整備份資料庫
- [ ] 確認所有 migration 檔案已執行
- [ ] 檢查 `attendance_logs.staff_name` 與 `staff.name` 的對應關係
- [ ] 準備維護時間窗口

### 遷移後檢查
- [ ] 驗證所有外鍵約束正常
- [ ] 檢查資料完整性（無孤兒記錄）
- [ ] 測試 API 端點
- [ ] 測試前端功能
- [ ] 檢查 Cookie 與 Session 是否正常

---

## 📌 六、注意事項

1. **醫師表**：系統中醫師與員工共用 `staff` 表，透過 `role = '醫師'` 區分，因此只需遷移 `staff` 表即可。

2. **attendance_logs 回填**：如果 `staff_name` 無法完全比對，需要手動處理或建立對照規則。

3. **向下相容**：遷移期間可能需要同時支援舊的 `int8` 與新的 `uuid`，建議採用「雙寫」策略過渡。

4. **索引重建**：遷移後需要重建所有相關索引以確保效能。

---

**報告生成時間：** 2025-01-XX  
**分析範圍：** 全專案掃描  
**建議執行順序：** 先執行 SQL Migration，再修改 API 與前端
