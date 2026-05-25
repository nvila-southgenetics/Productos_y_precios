"use client"

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

type PlHoverTooltipProps = {
  content?: string
  children: ReactNode
  className?: string
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
            className="pointer-events-none max-w-[min(92vw,440px)] whitespace-pre-line rounded-lg border border-cyan-500/30 bg-slate-950 px-3 py-2.5 text-left text-[11px] leading-relaxed text-white shadow-2xl ring-1 ring-white/10"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  )
}
