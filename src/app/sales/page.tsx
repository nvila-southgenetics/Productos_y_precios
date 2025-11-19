'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { PnLExcelPreview } from '@/components/PnLExcelPreview'
import * as XLSX from 'xlsx'

/**
 * Página de importación y visualización de archivos Excel P&L
 * Permite subir un archivo Excel y mostrar su contenido en una tabla HTML
 */
export default function SalesPage() {
  const [tableData, setTableData] = useState<Array<Array<string | number | null>>>([])
  const [error, setError] = useState<string>('')

  /**
   * Handler EXACTO que funciona con el archivo real
   * Probado contra el Excel "Para importacion P&L web.xlsx"
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const result = evt.target?.result
        if (!result) {
          throw new Error("Archivo vacío o ilegible")
        }

        // Asegurarse de que es un ArrayBuffer
        let arrayBuffer: ArrayBuffer
        if (result instanceof ArrayBuffer) {
          arrayBuffer = result
        } else {
          throw new Error("Error al leer el archivo: formato no válido")
        }

        // Leer el workbook
        const workbook = XLSX.read(arrayBuffer, { 
          type: "array",
          cellDates: false,
          cellNF: false,
          cellText: false
        })

        // Verificar que el workbook se leyó correctamente
        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("El archivo Excel no contiene hojas válidas")
        }

        // Buscar específicamente la hoja "Hoja 1", o usar la primera si no existe
        let sheetName = "Hoja 1"
        if (!workbook.SheetNames.includes("Hoja 1")) {
          // Si no existe "Hoja 1", usar la primera hoja disponible
          sheetName = workbook.SheetNames[0]
          console.log(`Hoja "Hoja 1" no encontrada. Usando: ${sheetName}`)
        }

        const sheet = workbook.Sheets[sheetName]
        if (!sheet) {
          throw new Error(`No se pudo acceder a la hoja "${sheetName}"`)
        }

        // Convertir a JSON manteniendo todas las celdas
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: "",
          blankrows: true
        }) as Array<Array<any>>

        // Verificar que se obtuvieron datos
        if (!rows || rows.length === 0) {
          throw new Error("El archivo Excel está vacío o no contiene datos")
        }

        // Normalizar las filas para que todas tengan la misma cantidad de columnas
        const maxColumns = Math.max(...rows.map(row => Array.isArray(row) ? row.length : 0), 0)
        
        if (maxColumns === 0) {
          throw new Error("No se encontraron columnas en el archivo Excel")
        }

        const normalizedRows = rows.map(row => {
          if (!Array.isArray(row)) {
            return Array(maxColumns).fill("")
          }
          const normalized = [...row]
          while (normalized.length < maxColumns) {
            normalized.push("")
          }
          return normalized
        })

        setTableData(normalizedRows)
        setError("")
        console.log(`Archivo cargado exitosamente: ${normalizedRows.length} filas, ${maxColumns} columnas`)
      } catch (err: any) {
        console.error("Error leyendo Excel:", err)
        const errorMessage = err?.message || "Error desconocido al leer el archivo Excel"
        setError(`Error: ${errorMessage}. Asegúrate de que el archivo sea un Excel válido (.xlsx)`)
      }
    }

    reader.onerror = () => {
      setError("Error al leer el archivo. Intenta nuevamente.")
    }

    // 👇 MUY IMPORTANTE: ArrayBuffer, NO BinaryString
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              Importar Archivo P&L
            </CardTitle>
            <CardDescription>
              Sube un archivo Excel (.xlsx) para visualizar su contenido en una tabla
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label htmlFor="excel-upload" className="cursor-pointer">
                  <Button asChild variant="outline" className="flex items-center gap-2">
                    <span>
                      <Upload className="w-4 h-4" />
                      Seleccionar archivo Excel
                    </span>
                  </Button>
                </label>
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {tableData.length > 0 && (
                  <span className="text-sm text-gray-600">
                    Archivo cargado: {tableData.length} filas
                  </span>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Componente que muestra la tabla del Excel */}
        {tableData.length > 0 && (
          <PnLExcelPreview data={tableData} />
        )}
      </div>
    </div>
  )
}

