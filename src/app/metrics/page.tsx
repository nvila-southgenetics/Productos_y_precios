'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CountryCode, OverrideFields } from '@/types'
import { computePricing, formatCurrency, formatPercentage } from '@/lib/compute'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Calculator, Trophy, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Globe, AlertTriangle } from 'lucide-react'

const ALL_COUNTRIES: CountryCode[] = ['UY', 'AR', 'MX', 'CL', 'VE', 'CO']

type ChartType = 'bar' | 'line' | 'area' | 'pie'

interface ProductMetric {
  productName: string
  productId: string
  country: string
  countryCode: CountryCode
  profitPercentage: number
  profitAmount: number
}

export default function MetricsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [overrides, setOverrides] = useState<Record<string, Record<CountryCode, OverrideFields>>>({})
  const [loading, setLoading] = useState(true)
  
  // Chart type states
  const [percentageChartType, setPercentageChartType] = useState<ChartType>('bar')
  const [amountChartType, setAmountChartType] = useState<ChartType>('bar')
  const [leastProfitablePercentageChartType, setLeastProfitablePercentageChartType] = useState<ChartType>('bar')
  const [leastProfitableAmountChartType, setLeastProfitableAmountChartType] = useState<ChartType>('bar')
  const [mostProfitableCountriesChartType, setMostProfitableCountriesChartType] = useState<ChartType>('bar')
  
  // ROI Calculator states
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('UY')
  const [quantity, setQuantity] = useState<string>('1')
  
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (productsError) throw productsError

      // Cargar overrides: para México usar "precio_lista", para Chile "precio_lista", para Colombia "precio_lista", para otros usar "default"
      const { data: overridesData, error: overridesError } = await supabase
        .from('product_country_overrides')
        .select('*')
        .in('mx_config_type', ['precio_lista', 'default'])
        .in('cl_config_type', ['precio_lista', 'default'])
        .in('col_config_type', ['precio_lista', 'default'])

      if (overridesError) throw overridesError

      const overridesMap: Record<string, Record<CountryCode, OverrideFields>> = {}
      overridesData?.forEach(override => {
        if (!overridesMap[override.product_id]) {
          overridesMap[override.product_id] = {} as Record<CountryCode, OverrideFields>
        }
        overridesMap[override.product_id][override.country_code as CountryCode] = (override.overrides as OverrideFields) || {}
      })

      setProducts(productsData || [])
      setOverrides(overridesMap)
      
      // Set default product for ROI calculator
      if (productsData && productsData.length > 0) {
        setSelectedProductId(productsData[0].id)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateMetrics = (): ProductMetric[] => {
    const metrics: ProductMetric[] = []

    products.forEach(product => {
      ALL_COUNTRIES.forEach(country => {
        const productOverrides = overrides[product.id]?.[country] || {}
        const result = computePricing(product, country, productOverrides)

        metrics.push({
          productName: product.name,
          productId: product.id,
          country: COUNTRY_NAMES[country],
          countryCode: country,
          profitPercentage: result.grossProfit.pct || 0,
          profitAmount: result.grossProfit.amount
        })
      })
    })

    return metrics
  }

  const getTopProductByCountry = (byPercentage: boolean) => {
    const metrics = calculateMetrics()
    const topByCountry: Record<CountryCode, ProductMetric> = {} as Record<CountryCode, ProductMetric>

    ALL_COUNTRIES.forEach(country => {
      const countryMetrics = metrics.filter(m => m.countryCode === country)
      if (countryMetrics.length > 0) {
        const sorted = countryMetrics.sort((a, b) => 
          byPercentage ? b.profitPercentage - a.profitPercentage : b.profitAmount - a.profitAmount
        )
        topByCountry[country] = sorted[0]
      }
    })

    return Object.values(topByCountry)
  }

  const getBottomProductByCountry = (byPercentage: boolean) => {
    const metrics = calculateMetrics()
    const bottomByCountry: Record<CountryCode, ProductMetric> = {} as Record<CountryCode, ProductMetric>

    ALL_COUNTRIES.forEach(country => {
      const countryMetrics = metrics.filter(m => m.countryCode === country)
      if (countryMetrics.length > 0) {
        const sorted = countryMetrics.sort((a, b) => 
          byPercentage ? a.profitPercentage - b.profitPercentage : a.profitAmount - b.profitAmount
        )
        bottomByCountry[country] = sorted[0]
      }
    })

    return Object.values(bottomByCountry)
  }

  const getCountriesProfitability = () => {
    const metrics = calculateMetrics()
    const countryTotals: Record<CountryCode, { profitAmount: number; profitPercentage: number; count: number }> = {} as any

    ALL_COUNTRIES.forEach(country => {
      const countryMetrics = metrics.filter(m => m.countryCode === country)
      if (countryMetrics.length > 0) {
        const totalProfit = countryMetrics.reduce((sum, m) => sum + m.profitAmount, 0)
        const avgPercentage = countryMetrics.reduce((sum, m) => sum + m.profitPercentage, 0) / countryMetrics.length
        countryTotals[country] = {
          profitAmount: totalProfit,
          profitPercentage: avgPercentage,
          count: countryMetrics.length
        }
      }
    })

    return countryTotals
  }

  const getProductsByCountry = (countryCode: CountryCode) => {
    const metrics = calculateMetrics()
    return metrics.filter(m => m.countryCode === countryCode)
  }

  const calculateROI = () => {
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return null

    const qty = parseInt(quantity) || 0
    if (qty <= 0) return null

    const productOverrides = overrides[selectedProductId]?.[selectedCountry] || {}
    const result = computePricing(product, selectedCountry, productOverrides)

    return {
      quantity: qty,
      grossSales: result.grossSales.amount * qty,
      salesRevenue: result.salesRevenue.amount * qty,
      totalCosts: result.totalCostOfSales.amount * qty,
      grossProfit: result.grossProfit.amount * qty,
      profitMargin: result.grossProfit.pct || 0,
      productName: product.name,
      country: COUNTRY_NAMES[selectedCountry]
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  const topByPercentage = getTopProductByCountry(true)
  const topByAmount = getTopProductByCountry(false)
  const bottomByPercentage = getBottomProductByCountry(true)
  const bottomByAmount = getBottomProductByCountry(false)
  const countriesProfitability = getCountriesProfitability()
  const roiData = calculateROI()

  const renderPercentageChart = () => {
    const data = topByPercentage.map(m => ({ 
      country: m.countryCode, 
      percentage: Number(m.profitPercentage.toFixed(1)),
      productName: m.productName,
      fill: '#10b981'
    }))

    const tooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
            <p className="font-semibold text-sm">{payload[0].payload.productName}</p>
            <p className="text-xs text-gray-600">{COUNTRY_NAMES[payload[0].payload.country as CountryCode]}</p>
            <p className="text-emerald-600 font-semibold">{payload[0].value}% de rentabilidad</p>
          </div>
        )
      }
      return null
    }

    if (percentageChartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie 
              data={data} 
              dataKey="percentage" 
              nameKey="country" 
              cx="50%" 
              cy="50%" 
              outerRadius={100}
              label={(entry: any) => `${entry.country}: ${entry.percentage}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#10b981" />
              ))}
            </Pie>
            <Tooltip content={tooltip} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (percentageChartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit="%" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="percentage" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (percentageChartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit="%" />
            <Tooltip content={tooltip} />
            <Area type="monotone" dataKey="percentage" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="country" />
          <YAxis unit="%" />
          <Tooltip content={tooltip} />
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#10b981" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const renderAmountChart = () => {
    const data = topByAmount.map(m => ({ 
      country: m.countryCode, 
      amount: Number(m.profitAmount.toFixed(2)),
      productName: m.productName,
      fill: '#2563eb'
    }))

    const tooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
            <p className="font-semibold text-sm">{payload[0].payload.productName}</p>
            <p className="text-xs text-gray-600">{COUNTRY_NAMES[payload[0].payload.country as CountryCode]}</p>
            <p className="text-blue-600 font-semibold">
              ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )
      }
      return null
    }

    if (amountChartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie 
              data={data} 
              dataKey="amount" 
              nameKey="country" 
              cx="50%" 
              cy="50%" 
              outerRadius={100}
              label={(entry: any) => `${entry.country}: $${entry.amount.toFixed(2)}`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#2563eb" />
              ))}
            </Pie>
            <Tooltip content={tooltip} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (amountChartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit=" $" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (amountChartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit=" $" />
            <Tooltip content={tooltip} />
            <Area type="monotone" dataKey="amount" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="country" />
          <YAxis unit=" $" />
          <Tooltip content={tooltip} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#2563eb" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const renderLeastProfitablePercentageChart = () => {
    const data = bottomByPercentage.map(m => ({ 
      country: m.countryCode, 
      percentage: Number(m.profitPercentage.toFixed(1)),
      productName: m.productName,
      fill: '#ef4444'
    }))

    const tooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
            <p className="font-semibold text-sm">{payload[0].payload.productName}</p>
            <p className="text-xs text-gray-600">{COUNTRY_NAMES[payload[0].payload.country as CountryCode]}</p>
            <p className="text-red-600 font-semibold">{payload[0].value}% de rentabilidad</p>
          </div>
        )
      }
      return null
    }

    if (leastProfitablePercentageChartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie 
              data={data} 
              dataKey="percentage" 
              nameKey="country" 
              cx="50%" 
              cy="50%" 
              outerRadius={100}
              label={(entry: any) => `${entry.country}: ${entry.percentage}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#ef4444" />
              ))}
            </Pie>
            <Tooltip content={tooltip} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (leastProfitablePercentageChartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit="%" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="percentage" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (leastProfitablePercentageChartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit="%" />
            <Tooltip content={tooltip} />
            <Area type="monotone" dataKey="percentage" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="country" />
          <YAxis unit="%" />
          <Tooltip content={tooltip} />
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#ef4444" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const renderLeastProfitableAmountChart = () => {
    const data = bottomByAmount.map(m => ({ 
      country: m.countryCode, 
      amount: Number(m.profitAmount.toFixed(2)),
      productName: m.productName,
      fill: '#f97316'
    }))

    const tooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
            <p className="font-semibold text-sm">{payload[0].payload.productName}</p>
            <p className="text-xs text-gray-600">{COUNTRY_NAMES[payload[0].payload.country as CountryCode]}</p>
            <p className="text-orange-600 font-semibold">
              ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )
      }
      return null
    }

    if (leastProfitableAmountChartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie 
              data={data} 
              dataKey="amount" 
              nameKey="country" 
              cx="50%" 
              cy="50%" 
              outerRadius={100}
              label={(entry: any) => `${entry.country}: $${entry.amount.toFixed(2)}`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#f97316" />
              ))}
            </Pie>
            <Tooltip content={tooltip} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (leastProfitableAmountChartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit=" $" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (leastProfitableAmountChartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit=" $" />
            <Tooltip content={tooltip} />
            <Area type="monotone" dataKey="amount" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="country" />
          <YAxis unit=" $" />
          <Tooltip content={tooltip} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#f97316" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const renderMostProfitableCountriesChart = () => {
    const data = Object.entries(countriesProfitability)
      .sort((a, b) => b[1].profitAmount - a[1].profitAmount)
      .map(([country, data]) => ({
        country: country as CountryCode,
        amount: Number(data.profitAmount.toFixed(2)),
        percentage: Number(data.profitPercentage.toFixed(1)),
        products: data.count,
        fill: '#10b981'
      }))

    const tooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
            <p className="font-semibold text-sm">{COUNTRY_NAMES[payload[0].payload.country as CountryCode]}</p>
            <p className="text-emerald-600 font-semibold">
              ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-600">Promedio: {payload[0].payload.percentage}%</p>
            <p className="text-xs text-gray-600">{payload[0].payload.products} productos</p>
          </div>
        )
      }
      return null
    }

    if (mostProfitableCountriesChartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie 
              data={data} 
              dataKey="amount" 
              nameKey="country" 
              cx="50%" 
              cy="50%" 
              outerRadius={100}
              label={(entry: any) => `${entry.country}: $${entry.amount.toFixed(0)}`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#10b981" />
              ))}
            </Pie>
            <Tooltip content={tooltip} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (mostProfitableCountriesChartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit=" $" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (mostProfitableCountriesChartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" />
            <YAxis unit=" $" />
            <Tooltip content={tooltip} />
            <Area type="monotone" dataKey="amount" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="country" />
          <YAxis unit=" $" />
          <Tooltip content={tooltip} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#10b981" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Métricas</h1>
          <p className="text-muted-foreground mt-1">
            Analiza el rendimiento de tus productos por país
          </p>
        </div>

        {/* Sección: Productos más rentables */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Productos Más Rentables</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Trophy className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>Producto Más Rentable por País</CardTitle>
                    <CardDescription>Por porcentaje de ganancia</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPercentageChartType('bar')}
                    className={percentageChartType === 'bar' ? 'bg-white shadow-sm' : ''}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPercentageChartType('line')}
                    className={percentageChartType === 'line' ? 'bg-white shadow-sm' : ''}
                  >
                    <LineChartIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPercentageChartType('area')}
                    className={percentageChartType === 'area' ? 'bg-white shadow-sm' : ''}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPercentageChartType('pie')}
                    className={percentageChartType === 'pie' ? 'bg-white shadow-sm' : ''}
                  >
                    <PieChartIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderPercentageChart()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Producto que Más Dinero Deja por País</CardTitle>
                    <CardDescription>Por ganancia absoluta en USD</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAmountChartType('bar')}
                    className={amountChartType === 'bar' ? 'bg-white shadow-sm' : ''}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAmountChartType('line')}
                    className={amountChartType === 'line' ? 'bg-white shadow-sm' : ''}
                  >
                    <LineChartIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAmountChartType('area')}
                    className={amountChartType === 'area' ? 'bg-white shadow-sm' : ''}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAmountChartType('pie')}
                    className={amountChartType === 'pie' ? 'bg-white shadow-sm' : ''}
                  >
                    <PieChartIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderAmountChart()}
            </CardContent>
          </Card>
        </div>

        {/* Sección: Productos menos rentables */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Productos Menos Rentables</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle>Producto Menos Rentable por País</CardTitle>
                    <CardDescription>Por porcentaje de ganancia</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitablePercentageChartType('bar')}
                    className={leastProfitablePercentageChartType === 'bar' ? 'bg-white shadow-sm' : ''}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitablePercentageChartType('line')}
                    className={leastProfitablePercentageChartType === 'line' ? 'bg-white shadow-sm' : ''}
                  >
                    <LineChartIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitablePercentageChartType('area')}
                    className={leastProfitablePercentageChartType === 'area' ? 'bg-white shadow-sm' : ''}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitablePercentageChartType('pie')}
                    className={leastProfitablePercentageChartType === 'pie' ? 'bg-white shadow-sm' : ''}
                  >
                    <PieChartIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderLeastProfitablePercentageChart()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Producto que Menos Dinero Deja por País</CardTitle>
                    <CardDescription>Por ganancia absoluta en USD</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitableAmountChartType('bar')}
                    className={leastProfitableAmountChartType === 'bar' ? 'bg-white shadow-sm' : ''}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitableAmountChartType('line')}
                    className={leastProfitableAmountChartType === 'line' ? 'bg-white shadow-sm' : ''}
                  >
                    <LineChartIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitableAmountChartType('area')}
                    className={leastProfitableAmountChartType === 'area' ? 'bg-white shadow-sm' : ''}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeastProfitableAmountChartType('pie')}
                    className={leastProfitableAmountChartType === 'pie' ? 'bg-white shadow-sm' : ''}
                  >
                    <PieChartIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderLeastProfitableAmountChart()}
            </CardContent>
          </Card>
        </div>

        {/* Sección: Rentabilidad por País */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Países Más Rentables</h2>
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Globe className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>Países Más Rentables</CardTitle>
                  <CardDescription>Por ganancia total en USD</CardDescription>
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostProfitableCountriesChartType('bar')}
                  className={mostProfitableCountriesChartType === 'bar' ? 'bg-white shadow-sm' : ''}
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostProfitableCountriesChartType('line')}
                  className={mostProfitableCountriesChartType === 'line' ? 'bg-white shadow-sm' : ''}
                >
                  <LineChartIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostProfitableCountriesChartType('area')}
                  className={mostProfitableCountriesChartType === 'area' ? 'bg-white shadow-sm' : ''}
                >
                  <TrendingUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostProfitableCountriesChartType('pie')}
                  className={mostProfitableCountriesChartType === 'pie' ? 'bg-white shadow-sm' : ''}
                >
                  <PieChartIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderMostProfitableCountriesChart()}
          </CardContent>
        </Card>

        {/* Calculadora de ROI */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Calculator className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Calculadora de ROI</CardTitle>
                <CardDescription>Calcula el retorno de inversión para un producto</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="product-select">Producto</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger id="product-select">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country-select">País</Label>
                <Select value={selectedCountry} onValueChange={(value) => setSelectedCountry(value as CountryCode)}>
                  <SelectTrigger id="country-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_COUNTRIES.map(country => (
                      <SelectItem key={country} value={country}>
                        {COUNTRY_FLAGS[country]} {COUNTRY_NAMES[country]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity-input">Cantidad</Label>
                <Input
                  id="quantity-input"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Ingresa la cantidad"
                />
              </div>
            </div>

            {roiData && (
              <div className="bg-gradient-to-br from-orange-50 to-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Resultados para {roiData.quantity} unidad(es) de {roiData.productName} en {roiData.country}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Ventas Brutas</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(roiData.grossSales)}</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Ingresos Netos</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(roiData.salesRevenue)}</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Costos Totales</p>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(roiData.totalCosts)}</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-emerald-200">
                    <p className="text-sm text-gray-600 mb-1">Ganancia Líquida</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(roiData.grossProfit)}</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      Margen: {roiData.profitMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                  <p className="text-sm text-gray-700">
                    💡 <strong>Resumen:</strong> Vendiendo {roiData.quantity} unidad(es), 
                    obtendrás una ganancia líquida de <span className="text-emerald-600 font-semibold">{formatCurrency(roiData.grossProfit)}</span> con 
                    un margen de ganancia del <span className="text-emerald-600 font-semibold">{roiData.profitMargin.toFixed(1)}%</span>.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tablas de rentabilidad y ganancia por país */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {ALL_COUNTRIES.map(country => {
            const countryProducts = getProductsByCountry(country)
            const sortedByPercentage = [...countryProducts].sort((a, b) => b.profitPercentage - a.profitPercentage)
            const sortedByAmount = [...countryProducts].sort((a, b) => b.profitAmount - a.profitAmount)

            return (
              <Card key={country} className="col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{COUNTRY_FLAGS[country]}</span>
                    {COUNTRY_NAMES[country]}
                  </CardTitle>
                  <CardDescription>Rendimiento de productos en este país</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Rentabilidad por porcentaje */}
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-700 mb-2">Rentabilidad (%)</h4>
                      <div className="space-y-1">
                        {sortedByPercentage.slice(0, 5).map((metric, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">{metric.productName}</span>
                            <span className="font-semibold text-emerald-600">
                              {metric.profitPercentage.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ganancia absoluta */}
                    <div>
                      <h4 className="text-sm font-semibold text-blue-700 mb-2">Ganancia (USD)</h4>
                      <div className="space-y-1">
                        {sortedByAmount.slice(0, 5).map((metric, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">{metric.productName}</span>
                            <span className="font-semibold text-blue-600">
                              ${metric.profitAmount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
