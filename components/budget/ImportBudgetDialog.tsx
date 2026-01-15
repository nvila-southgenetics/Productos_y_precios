"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import { parseExcelToBudget } from "@/lib/budgetParser"
import { supabase } from "@/lib/supabase"

interface ImportBudgetDialogProps {
  open: boolean
  onClose: () => void
}

export function ImportBudgetDialog({ open, onClose }: ImportBudgetDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError("Por favor selecciona un archivo")
      return
    }

    setImporting(true)
    setError(null)
    try {
      // Parsear Excel
      const budgetEntries = await parseExcelToBudget(file)
      
      if (budgetEntries.length === 0) {
        setError("No se encontraron datos válidos en el archivo")
        setImporting(false)
        return
      }

      setProgress({ current: 0, total: budgetEntries.length })

      // Intentar encontrar productos para hacer match
      const productNames = [...new Set(budgetEntries.map((e) => e.product_name))]
      const { data: products } = await supabase
        .from("products")
        .select("id, name")

      const productMap = new Map<string, string>()
      products?.forEach((p) => {
        // Intentar match por nombre exacto o parcial
        productNames.forEach((name) => {
          if (p.name.toUpperCase().includes(name.toUpperCase()) || 
              name.toUpperCase().includes(p.name.toUpperCase())) {
            productMap.set(name, p.id)
          }
        })
      })

      // Insertar en Supabase
      const entriesToInsert = budgetEntries.map((entry) => {
        const productId = productMap.get(entry.product_name) || null

        return {
          country: entry.country,
          country_code: entry.country_code,
          product_id: productId,
          product_name: entry.product_name,
          year: entry.year,
          jan: entry.jan,
          feb: entry.feb,
          mar: entry.mar,
          apr: entry.apr,
          may: entry.may,
          jun: entry.jun,
          jul: entry.jul,
          aug: entry.aug,
          sep: entry.sep,
          oct: entry.oct,
          nov: entry.nov,
          dec: entry.dec,
          updated_at: new Date().toISOString(),
        }
      })

      // Upsert en lotes para mejor performance
      const batchSize = 50
      for (let i = 0; i < entriesToInsert.length; i += batchSize) {
        const batch = entriesToInsert.slice(i, i + batchSize)
        
        const { error: upsertError } = await supabase
          .from("budget")
          .upsert(batch, {
            onConflict: "product_name,country_code,year",
          })

        if (upsertError) {
          throw upsertError
        }

        setProgress({ current: Math.min(i + batchSize, entriesToInsert.length), total: entriesToInsert.length })
      }

      alert(`✅ Importación exitosa: ${budgetEntries.length} registros procesados`)
      onClose()
      setFile(null)
      setProgress({ current: 0, total: 0 })
      
      // Recargar la página para ver los nuevos datos
      window.location.reload()
    } catch (error: any) {
      console.error("Error importing budget:", error)
      setError(error.message || "Error al importar. Ver consola para detalles.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogClose onClose={onClose} />
        <DialogHeader>
          <DialogTitle>Importar Proyección de Ventas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Seleccionar archivo Excel
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={importing}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                disabled:opacity-50"
            />
          </div>

          {file && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-700">
                📄 {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 p-3 rounded-md">
              <p className="text-sm text-red-700">❌ {error}</p>
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Importando... {progress.current} / {progress.total}
              </p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!file || importing}>
              <Upload className="w-4 h-4 mr-2" />
              {importing ? "Importando..." : "Importar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

