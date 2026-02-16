import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  placeholder = "DD/MM/YYYY",
  className,
  disabled = false
}: DateInputProps) {
  const [inputValue, setInputValue] = React.useState(
    value ? format(value, "dd/MM/yyyy") : ""
  );
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  // Sync input value when prop changes
  React.useEffect(() => {
    if (value) {
      setInputValue(format(value, "dd/MM/yyyy"));
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Auto-format: add slashes after day and month
    if (val.length === 2 && inputValue.length === 1) {
      val += "/";
    } else if (val.length === 5 && inputValue.length === 4) {
      val += "/";
    }

    // Limit length
    if (val.length > 10) return;

    setInputValue(val);

    // Try to parse the date
    if (val.length === 10) {
      const parsed = parse(val, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(parsed);
      }
    } else if (val === "") {
      onChange(undefined);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date);
    if (date) {
      setInputValue(format(date, "dd/MM/yyyy"));
    }
    setIsCalendarOpen(false);
  };

  return (
    <div className={cn("flex flex-row-reverse items-center gap-2", className)} dir="rtl">
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="سنة/شهر/يوم"
        className={cn("flex-1 text-right font-mono", className)}
        disabled={disabled}
        dir="rtl"
      />
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-10 h-10 p-0 text-left font-normal",
              !value && "text-muted-foreground"
            )}
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
            locale={ar} // Ensure Arabic locale
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
