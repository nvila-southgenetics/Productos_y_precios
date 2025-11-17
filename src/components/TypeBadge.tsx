import React from 'react'

interface TypeBadgeProps {
  type: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const typeConfig: Record<string, { color: string; bgColor: string }> = {
  'Sangre': {
    color: 'text-red-700',
    bgColor: 'bg-red-50'
  },
  'Corte de Tejido': {
    color: 'text-purple-700',
    bgColor: 'bg-purple-50'
  },
  'Punción': {
    color: 'text-blue-700',
    bgColor: 'bg-blue-50'
  },
  'Biopsia endometrial': {
    color: 'text-pink-700',
    bgColor: 'bg-pink-50'
  },
  'Hisopado bucal': {
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50'
  },
  'Orina': {
    color: 'text-green-700',
    bgColor: 'bg-green-50'
  }
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
}

export function TypeBadge({ type, size = 'sm', className = '' }: TypeBadgeProps) {
  if (!type) {
    return null
  }

  // Si el tipo contiene comas, dividirlo en múltiples tipos
  const types = type.split(',').map(t => t.trim()).filter(t => t.length > 0)

  if (types.length === 0) {
    return null
  }

  const sizeClass = sizeClasses[size]

  return (
    <div className={`inline-flex flex-wrap gap-1 ${className}`}>
      {types.map((singleType, index) => {
        const config = typeConfig[singleType] || { color: 'text-gray-700', bgColor: 'bg-gray-50' }
        return (
          <span
            key={index}
            className={`
              inline-flex items-center rounded-full font-medium
              ${config.bgColor} ${config.color} ${sizeClass}
            `}
          >
            {singleType}
          </span>
        )
      })}
    </div>
  )
}

