'use client'

import { Card, CardContent } from '@/components/ui/card'

/**
 * Componente que renderiza una tabla HTML a partir de los datos del Excel
 * Mantiene la estructura exacta del Excel: mismas filas, columnas y valores
 */
interface PnLExcelPreviewProps {
  data: Array<Array<string | number | null>>
}

export function PnLExcelPreview({ data }: PnLExcelPreviewProps) {
  if (!data || data.length === 0) {
    return null
  }

  // Las primeras dos filas se consideran encabezados
  const headerRows = data.slice(0, 2)
  const bodyRows = data.slice(2)

  // Determinar el número máximo de columnas
  const maxColumns = Math.max(...data.map(row => row.length))

  /**
   * Formatea el valor de una celda para mostrarlo
   * - null o undefined → cadena vacía
   * - números → se muestran tal cual
   * - strings → se muestran tal cual
   */
  const formatCellValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) {
      return ''
    }
    if (typeof value === 'number') {
      return value.toString()
    }
    return String(value)
  }

  /**
   * Determina si una celda debe tener estilo de encabezado
   * Las primeras dos filas son encabezados
   */
  const isHeaderCell = (rowIndex: number): boolean => {
    return rowIndex < 2
  }

  /**
   * Determina si una celda debe tener estilo especial
   * - Primera columna (índice 0): puede tener estilo especial
   * - Celdas de encabezado: fondo gris
   */
  const getCellClassName = (rowIndex: number, colIndex: number): string => {
    const baseClasses = 'px-3 py-2 border border-gray-300 text-sm whitespace-nowrap'
    
    // Primera columna: fondo ligeramente diferente y texto alineado a la izquierda
    if (colIndex === 0) {
      const headerClass = isHeaderCell(rowIndex) ? 'bg-gray-200' : 'bg-gray-50'
      return `${baseClasses} ${headerClass} font-medium min-w-[200px] text-left`
    }
    
    // Filas de encabezado (primera y segunda fila)
    if (isHeaderCell(rowIndex)) {
      return `${baseClasses} bg-gray-100 font-semibold text-center`
    }
    
    // Celdas de datos normales: números alineados a la derecha
    return `${baseClasses} bg-white text-right`
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[80vh] overflow-y-auto relative">
          <table className="border-collapse w-full min-w-full">
            {/* Encabezados: primeras dos filas */}
            <thead className="sticky top-0 z-20 bg-white">
              {headerRows.map((row, rowIndex) => (
                <tr key={`header-${rowIndex}`}>
                  {Array.from({ length: maxColumns }).map((_, colIndex) => {
                    const cellValue = row[colIndex] ?? null
                    return (
                      <th
                        key={`header-${rowIndex}-${colIndex}`}
                        className={getCellClassName(rowIndex, colIndex)}
                        style={colIndex === 0 ? { position: 'sticky', left: 0, zIndex: 21 } : {}}
                      >
                        {formatCellValue(cellValue)}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>

            {/* Cuerpo de la tabla: resto de filas */}
            <tbody>
              {bodyRows.map((row, rowIndex) => {
                // El índice real en los datos es rowIndex + 2 (porque saltamos las 2 primeras)
                const actualRowIndex = rowIndex + 2
                return (
                  <tr key={`row-${actualRowIndex}`} className="hover:bg-gray-50">
                    {Array.from({ length: maxColumns }).map((_, colIndex) => {
                      const cellValue = row[colIndex] ?? null
                      const isNumeric = typeof cellValue === 'number' || 
                                       (typeof cellValue === 'string' && 
                                        cellValue !== '' && 
                                        !isNaN(Number(cellValue)) && 
                                        cellValue.trim() !== '')

                      return (
                        <td
                          key={`cell-${actualRowIndex}-${colIndex}`}
                          className={getCellClassName(actualRowIndex, colIndex)}
                          style={colIndex === 0 ? { position: 'sticky', left: 0, zIndex: 10 } : {}}
                        >
                          {isNumeric && colIndex > 0 ? (
                            <span className="font-mono">
                              {formatCellValue(cellValue)}
                            </span>
                          ) : (
                            formatCellValue(cellValue)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

