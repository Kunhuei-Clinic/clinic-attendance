export type DayType = 'normal' | 'rest' | 'regular' | 'holiday' | 'shifted';

export type Staff = {
    id: string;
    name: string;
    role: string;
    display_order: number;
    work_rule: 'normal' | '2week' | '4week' | '8week' | 'none';
    entity?: string;
};

export type ShiftConfig = {
    id: string;
    code: string;
    name: string;
    start: string;
    end: string;
};

// 更新 RosterData 定義，將 shifts 改為字串陣列，並保留 shift_details
export type RosterData = {
    shifts: string[];
    day_type: DayType;
    shift_details?: Record<string, { start: string; end: string }>;
};

export type Entity = {
    id: string;
    name: string;
};

export type JobTitleConfig = {
    name: string;
    in_roster: boolean;
};

export type BusinessHours = {
    openDays: number[];
    shifts: ShiftConfig[];
};

