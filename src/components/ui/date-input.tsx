import * as React from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatYYYYMMDDInput, parseYYYYMMDD, YYYYMMDD_PATTERN } from "@/lib/date";

interface DateInputProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateInput({
  value,
  onChange,
  placeholder = "YYYY/MM/DD",
  className,
  disabled = false
}: DateInputProps) {
  const [inputValue, setInputValue] = React.useState(value ? format(value, YYYYMMDD_PATTERN) : "");
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    setInputValue(value ? format(value, YYYYMMDD_PATTERN) : "");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatYYYYMMDDInput(e.target.value);
    setInputValue(formatted);

    if (formatted === "") {
      onChange(undefined);
      return;
    }

    const parsed = parseYYYYMMDD(formatted);
    if (parsed) onChange(parsed);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date);
    if (date) setInputValue(format(date, YYYYMMDD_PATTERN));
    setIsCalendarOpen(false);
  };

  return (
    <div className={cn("flex flex-row-reverse items-center gap-2", className)} dir="rtl">
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={cn("flex-1 text-right font-mono", className)}
        disabled={disabled}
        dir="rtl"
      />
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn("w-10 h-10 p-0 text-left font-normal", !value && "text-muted-foreground")}
            onClick={() => setIsCalendarOpen(true)}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 text-right" align="start" dir="rtl">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleCalendarSelect}
            initialFocus
            locale={ar}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
