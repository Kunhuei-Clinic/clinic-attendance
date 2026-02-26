# UUID 遷移：前端與 API 修改範例

## 📝 修改範例指南

本文檔提供具體的程式碼修改範例，協助您完成 UUID 遷移。

---

## 一、TypeScript 型別定義修改

### 1.1 Staff 型別定義

**修改前：**
```typescript
type Staff = {
  id: number;
  name: string;
  role?: string | null;
};
```

**修改後：**
```typescript
type Staff = {
  id: string; // 改為 string (UUID)
  name: string;
  role?: string | null;
};
```

**適用檔案：**
- `app/admin/AttendanceView/AttendanceModal.tsx`
- 所有使用 `Staff` 型別的元件

---

## 二、API 路由修改範例

### 2.1 移除 `Number()` 轉換

#### 範例 1：查詢過濾

**修改前：**
```typescript
// app/api/leave/route.ts
if (selectedStaffId !== 'all') {
  query = query.eq('staff_id', Number(selectedStaffId));
}
```

**修改後：**
```typescript
if (selectedStaffId !== 'all') {
  query = query.eq('staff_id', selectedStaffId); // 直接使用 string
}
```

#### 範例 2：驗證員工存在

**修改前：**
```typescript
// app/api/roster/staff/route.ts
const { data: staff } = await supabaseAdmin
  .from('staff')
  .select('id, clinic_id')
  .eq('id', Number(staff_id))
  .eq('clinic_id', clinicId)
  .single();
```

**修改後：**
```typescript
const { data: staff } = await supabaseAdmin
  .from('staff')
  .select('id, clinic_id')
  .eq('id', staff_id) // 直接使用 string (UUID)
  .eq('clinic_id', clinicId)
  .single();
```

#### 範例 3：寫入資料

**修改前：**
```typescript
// app/api/attendance/route.ts
const payload = {
  staff_id: Number(staffId),
  staff_name: staffName,
  // ...
};
```

**修改後：**
```typescript
const payload = {
  staff_id: staffId, // 直接使用 string (UUID)
  staff_name: staffName,
  // ...
};
```

---

### 2.2 Cookie 處理修改

#### 範例：設定 Cookie

**修改前：**
```typescript
// app/api/auth/login/route.ts
response.cookies.set('staff_id', String(matchedStaff.id), {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 天
});
```

**修改後：**
```typescript
response.cookies.set('staff_id', matchedStaff.id, { // id 已經是 string
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 天
});
```

#### 範例：讀取 Cookie

**修改前：**
```typescript
// app/api/portal/data/route.ts
const staffIdCookie = request.cookies.get('staff_id');
const staffId = staffIdCookie ? Number(staffIdCookie.value) : null;
```

**修改後：**
```typescript
const staffIdCookie = request.cookies.get('staff_id');
const staffId = staffIdCookie?.value || null; // 直接使用 string
```

---

### 2.3 查詢參數處理

#### 範例：從 URL 參數取得 ID

**修改前：**
```typescript
// app/api/salary/history/route.ts
const staffId = searchParams.get('staff_id');
if (staffId) {
  query = query.eq('staff_id', Number(staffId));
}
```

**修改後：**
```typescript
const staffId = searchParams.get('staff_id');
if (staffId) {
  query = query.eq('staff_id', staffId); // 直接使用 string
}
```

---

## 三、前端元件修改範例

### 3.1 表單選項值

#### 範例：員工選擇下拉選單

**修改前：**
```typescript
// app/admin/AttendanceView/AttendanceModal.tsx
<select
  value={formData.staffId}
  onChange={(e) =>
    setFormData({ ...formData, staffId: e.target.value })
  }
>
  {staffList.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name} ({s.role || '無'})
    </option>
  ))}
</select>
```

**修改後：**
```typescript
// 型別已經是 string，不需要修改
// 但確保 formData.staffId 的型別是 string
<select
  value={formData.staffId}
  onChange={(e) =>
    setFormData({ ...formData, staffId: e.target.value })
  }
>
  {staffList.map((s) => (
    <option key={s.id} value={s.id}> {/* s.id 現在是 string */}
      {s.name} ({s.role || '無'})
    </option>
  ))}
</select>
```

---

### 3.2 資料比對與過濾

#### 範例：使用 ID 作為 Map Key

**修改前：**
```typescript
// app/admin/salary/page.tsx
const map: Record<number, any[]> = {};
json.data?.forEach((item: any) => {
  if (!map[item.staff_id]) map[item.staff_id] = [];
  map[item.staff_id].push(item);
});
```

**修改後：**
```typescript
const map: Record<string, any[]> = {}; // 改為 string
json.data?.forEach((item: any) => {
  if (!map[item.staff_id]) map[item.staff_id] = [];
  map[item.staff_id].push(item);
});
```

#### 範例：過濾資料

**修改前：**
```typescript
// components/views/SalaryView.tsx
const myLeaves = leaves?.filter((l: any) => l.staff_id === staff.id) || [];
```

**修改後：**
```typescript
// 不需要修改，因為 === 比較對 string 和 number 都有效
// 但建議確保型別一致
const myLeaves = leaves?.filter((l: any) => String(l.staff_id) === String(staff.id)) || [];
```

---

### 3.3 API 呼叫

#### 範例：發送 POST 請求

**修改前：**
```typescript
// app/portal/page.tsx
const response = await fetch('/api/leave', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    staff_id: staffUser.id, // number
    staff_name: staffUser.name,
    // ...
  }),
});
```

**修改後：**
```typescript
const response = await fetch('/api/leave', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    staff_id: staffUser.id, // string (UUID)
    staff_name: staffUser.name,
    // ...
  }),
});
```

---

## 四、完整檔案修改清單

### 4.1 需要修改的 API 檔案（共 19 個）

1. `app/api/attendance/route.ts`
   - 移除 `Number(staffId)` 轉換
   - 更新 payload 中的 `staff_id`

2. `app/api/attendance/clock/route.ts`
   - 移除 `Number(staffId)` 轉換

3. `app/api/attendance/punch/route.ts`
   - 使用 `staff.id`（已經是 string）

4. `app/api/leave/route.ts`
   - 移除 `Number(selectedStaffId)` 和 `Number(staff_id)`

5. `app/api/leave/settle/route.ts`
   - 移除 `Number(staff_id)` 和 `Number(staffId)`

6. `app/api/leave/stats/route.ts`
   - 移除所有 `Number()` 轉換

7. `app/api/roster/staff/route.ts`
   - 移除 `Number(staff_id)`

8. `app/api/roster/doctor/route.ts`
   - 移除 `Number(doctor_id)` 和 `Number(doctorId)`

9. `app/api/salary/history/route.ts`
   - 移除 `Number(staffId)`

10. `app/api/salary/adjustments/route.ts`
    - 移除 `Number(staffId)`

11. `app/api/staff/profile/route.ts`
    - 移除 `Number(staff_id)`

12. `app/api/staff/leave-summary/route.ts`
    - 移除 `Number(staffId)`

13. `app/api/portal/data/route.ts`
    - 移除所有 `Number()` 轉換

14. `app/api/doctor/ppf/route.ts`
    - 移除 `Number(doctorId)` 和 `Number(doctor_id)`

15. `app/api/report/salary/route.ts`
    - 移除 `Number(selectedStaffId)`

16. `app/api/auth/login/route.ts`
    - 更新 Cookie 設定（移除 `String()`）

17. `app/api/auth/line-bind/route.ts`
    - 更新 Cookie 設定

18. `app/api/auth/line-check/route.ts`
    - 更新 Cookie 設定

19. `app/api/auth/line-login/route.ts`
    - 更新 Cookie 設定

---

### 4.2 需要修改的前端元件（約 10+ 個）

1. `app/admin/AttendanceView/AttendanceModal.tsx`
   - 更新 `Staff` 型別定義

2. `app/admin/AttendanceView.tsx`
   - 檢查 `log.staff_id` 的使用

3. `app/admin/salary/page.tsx`
   - 更新 `Record<number, any[]>` 為 `Record<string, any[]>`

4. `app/admin/leave/LeaveStatsTable.tsx`
   - 檢查 `stat.staff_id` 的使用

5. `app/portal/page.tsx`
   - 檢查所有 API 呼叫

6. `app/portal/views/RosterView.tsx`
   - 檢查 `r.staff_id` 和 `r.doctor_id` 的使用

7. `components/views/SalaryView.tsx`
   - 更新型別定義和比對邏輯

8. `components/views/DoctorSalaryView.tsx`
   - 檢查 `selectedDoctorId` 的使用

9. `app/admin/DoctorRosterPrint.tsx`
   - 檢查 `w.doctor_id` 的使用

10. 其他使用 `staff.id` 或 `staff_id` 的元件

---

## 五、測試檢查清單

### 5.1 功能測試

- [ ] 員工登入/登出功能
- [ ] 打卡功能（上班/下班）
- [ ] 補打卡功能
- [ ] 請假申請與審核
- [ ] 班表查詢與編輯
- [ ] 薪資計算與查詢
- [ ] 醫師 PPF 查詢與編輯
- [ ] 員工資料查詢與更新

### 5.2 資料完整性測試

- [ ] 驗證所有外鍵關聯正常
- [ ] 檢查是否有孤兒記錄
- [ ] 驗證 Cookie 與 Session 是否正常
- [ ] 檢查多租戶隔離是否正常

### 5.3 效能測試

- [ ] 查詢效能是否正常
- [ ] 索引是否正確建立
- [ ] 大量資料查詢是否正常

---

## 六、常見問題與解決方案

### Q1: 遷移後出現「無法找到員工」錯誤

**原因：** Cookie 中仍存有舊的 `int8` ID，但資料庫已改為 UUID。

**解決方案：** 清除瀏覽器 Cookie 或重新登入。

### Q2: 前端顯示錯誤的員工資料

**原因：** 型別轉換問題，可能仍在使用 `Number()` 轉換。

**解決方案：** 檢查所有 API 呼叫，移除 `Number()` 轉換。

### Q3: 無法比對 attendance_logs 的記錄

**原因：** `staff_name` 與 `staff.name` 不完全一致。

**解決方案：** 執行以下 SQL 檢查並手動處理：

```sql
SELECT al.staff_name, COUNT(*) 
FROM attendance_logs al
LEFT JOIN staff s ON al.staff_name = s.name AND al.clinic_id = s.clinic_id
WHERE s.id IS NULL
GROUP BY al.staff_name;
```

---

## 七、回滾方案（緊急情況）

如果遷移出現嚴重問題，需要回滾：

1. **恢復資料庫備份**
2. **檢查應用程式版本**（確保使用支援 `int8` 的版本）
3. **清除所有 Cookie**（強制使用者重新登入）

**注意：** 回滾會導致遷移期間的資料遺失，請謹慎使用。

---

**最後更新：** 2025-01-XX  
**適用版本：** UUID 遷移後
