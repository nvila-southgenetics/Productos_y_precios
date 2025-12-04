import React from 'react'
import { CategoryName, getCategoryFromProductName } from '@/lib/categories'
import { Heart, Stethoscope, Baby, Calendar, FlaskConical, Droplets, Package, Shield, AlertCircle } from 'lucide-react'

interface CategoryBadgeProps {
  category: string | null
  productName?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const categoryConfig = {
  'Todos': {
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: <Package className="w-3 h-3" />
  },
  'Alergia': {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: <AlertCircle className="w-3 h-3" />
  },
  'Carrier': {
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    icon: <Shield className="w-3 h-3" />
  },
  'Ginecología': {
    color: 'text-pink-700',
    bgColor: 'bg-pink-100',
    icon: <Heart className="w-3 h-3" />
  },
  'Oncología': {
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: <Stethoscope className="w-3 h-3" />
  },
  'Endocrinología': {
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: <Droplets className="w-3 h-3" />
  },
  'Urología': {
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: <FlaskConical className="w-3 h-3" />
  },
  'Prenatales': {
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    icon: <Baby className="w-3 h-3" />
  },
  'Anualidades': {
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: <Calendar className="w-3 h-3" />
  },
  'Otros': {
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: <Package className="w-3 h-3" />
  }
} as Record<CategoryName, { color: string; bgColor: string; icon: React.ReactNode }>

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
}

export function CategoryBadge({ category, productName, size = 'sm', className = '' }: CategoryBadgeProps) {
  // Determinar la categoría si no está definida
  const finalCategory = category || (productName ? getCategoryFromProductName(productName) : null)
  
  if (!finalCategory || finalCategory === 'Todos') {
    return null
  }

  const config = categoryConfig[finalCategory as CategoryName] || categoryConfig['Otros']
  const sizeClass = sizeClasses[size]

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.bgColor} ${config.color} ${sizeClass}
        ${className}
      `}
    >
      {config.icon}
      <span>{finalCategory}</span>
    </span>
  )
}

