"use client"

import { useState } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

interface SalesCalendarProps {
  selectedDate: string | null
  onSelectDate: (dateStr: string) => void
}

export function SalesCalendar({ selectedDate, onSelectDate }: SalesCalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split("-").map(Number)
      return new Date(y, m - 1, 1)
    }
    return new Date()
  })

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const selectedDateObj = selectedDate
    ? (() => {
        const [y, m, d] = selectedDate.split("-").map(Number)
        return new Date(y, m - 1, d)
      })()
    : null

  return (
    <div className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          onClick={() => setViewDate((d) => subMonths(d, 1))}
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </Button>
        <span className="text-sm font-semibold text-white">
          {format(viewDate, "MMMM yyyy", { locale: es })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          onClick={() => setViewDate((d) => addMonths(d, 1))}
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-xs font-medium uppercase text-white/60"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewDate)
          const isSelected =
            selectedDateObj !== null && isSameDay(day, selectedDateObj)
          const dateStr = format(day, "yyyy-MM-dd")
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                "h-9 w-9 rounded-md text-sm transition-colors",
                !inMonth && "text-white/30",
                inMonth && "text-white/80 hover:bg-white/10",
                isSelected &&
                  "bg-white/20 text-white hover:bg-white/30 border border-white/30"
              )}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}
