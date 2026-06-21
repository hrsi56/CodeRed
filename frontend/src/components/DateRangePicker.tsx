import { DayPicker, type DateRange } from 'react-day-picker';
import { he } from 'react-day-picker/locale';
import 'react-day-picker/style.css';

interface DateRangePickerProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  minDate: Date;
  maxDate: Date;
}

// Capped at yesterday (SPEC.md §5/§1.4) — today and the future are always disabled,
// and nothing before the timeline's start is selectable either.
export function DateRangePicker({ range, onRangeChange, minDate, maxDate }: DateRangePickerProps) {
  return (
    <DayPicker
      mode="range"
      locale={he}
      dir="rtl"
      selected={range}
      onSelect={(next) => {
        if (next) onRangeChange(next);
      }}
      startMonth={minDate}
      endMonth={maxDate}
      defaultMonth={maxDate}
      disabled={[{ before: minDate }, { after: maxDate }]}
    />
  );
}
