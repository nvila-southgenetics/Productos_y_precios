"use client"

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

type PlHoverTooltipProps = {
  content?: string
  children: ReactNode
  className?: string
}

function TooltipBody({ content }: { content: string }) {
  const lines = content.split("\n")
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trimEnd()
        if (!trimmed) {
          return <div key={i} className="h-1.5 shrink-0" aria-hidden />
        }
        if (i === 0) {
          return (
            <p key={i} className="text-[13px] font-semibold leading-tight text-white">
              {trimmed}
            </p>
          )
        }
        if (i === 1 && !trimmed.includes(":")) {
          return (
            <p key={i} className="mb-0.5 text-[11px] text-white/55">
              {trimmed}
            </p>
          )
        }
        const isSection = trimmed.endsWith(":") && !/\d[\d.,]*\s*$/.test(trimmed)
        if (isSection) {
          return (
            <p
              key={i}
              className="mt-1.5 border-t border-white/10 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-cyan-200/75 first:mt-0 first:border-0 first:pt-0"
            >
              {trimmed}
            </p>
          )
        }
        const isEmphasis =
          /^(Total|Subtotal|PERIODO|=)/i.test(trimmed) ||
          trimmed.startsWith("−") ||
          trimmed.startsWith("=")
        return (
          <p
            key={i}
            className={`font-mono text-[11px] tabular-nums leading-snug ${
              isEmphasis ? "font-medium text-white" : "text-white/85"
            }`}
          >
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

export function PlHoverTooltip({ content, children, className }: PlHoverTooltipProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  const updatePosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: Math.max(8, rect.top - 8),
      left: rect.left + rect.width / 2,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [open, updatePosition])

  if (!content?.trim()) {
    return <span className={className}>{children}</span>
  }

  return (
    <>
      <span
        ref={anchorRef}
        className={`inline-block cursor-help border-b border-dotted border-white/30 ${className || ""}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => {
          updatePosition()
          setOpen(true)
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          updatePosition()
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        tabIndex={0}
      >
        {children}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 9999,
            }}
            className="pointer-events-none max-w-[min(92vw,360px)] rounded-lg border border-cyan-500/25 bg-slate-950/98 px-3.5 py-3 text-left shadow-2xl ring-1 ring-white/10 backdrop-blur-sm"
          >
            <TooltipBody content={content} />
          </div>,
          document.body
        )}
    </>
  )
}
