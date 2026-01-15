export interface BudgetEntry {
  id: string
  country: string
  country_code: string
  product_name: string
  year: number
  jan: number
  feb: number
  mar: number
  apr: number
  may: number
  jun: number
  jul: number
  aug: number
  sep: number
  oct: number
  nov: number
  dec: number
  total_units: number
  created_at: Date
  updated_at: Date
}

const COUNTRY_CODES: Record<string, string> = {
  'Chile': 'CL',
  'Uruguay': 'UY',
  'Argentina': 'AR',
  'México': 'MX',
  'Mexico': 'MX',
  'Colombia': 'CO',
  'Perú': 'PE',
  'Peru': 'PE',
  'Bolivia': 'BO',
  'Trinidad y Tobago': 'TT',
  'Bahamas': 'BS',
  'Barbados': 'BB',
  'Bermuda': 'BM',
  'Cayman Islands': 'KY',
}

export function parseExcelToBudget(file: File): Promise<BudgetEntry[]> {
  return new Promise(async (resolve, reject) => {
    // Cargar xlsx dinámicamente (solo en cliente)
    if (typeof window === 'undefined') {
      reject(new Error('Esta función solo puede ejecutarse en el cliente'))
      return
    }

    const XLSXModule = await import('xlsx')
    const XLSX = XLSXModule.default || XLSXModule

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('No se pudo leer el archivo'))
          return
        }

        const workbook = XLSX.read(data, { type: 'binary' })
        const worksheet = workbook.Sheets['Data'] || workbook.Sheets[workbook.SheetNames[0]]

        if (!worksheet) {
          reject(new Error('No se encontró la hoja "Data" en el archivo'))
          return
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null })

        const budgetEntries: BudgetEntry[] = []
        let currentCountry = ''
        let currentCountryCode = ''

        // Detectar índices de columnas de meses (buscar en las primeras filas)
        let janIdx = -1, febIdx = -1, marIdx = -1, aprIdx = -1, mayIdx = -1
        let junIdx = -1, julIdx = -1, augIdx = -1, sepIdx = -1, octIdx = -1, novIdx = -1, decIdx = -1

        // Buscar headers en las primeras 5 filas
        for (let headerRow = 0; headerRow < Math.min(5, jsonData.length); headerRow++) {
          const row = jsonData[headerRow] as any[]
          if (!row) continue

          for (let j = 0; j < row.length; j++) {
            const cell = row[j]?.toString().toUpperCase().trim()
            if (!cell) continue

            if ((cell === 'ENE' || cell === 'JAN' || cell === 'ENERO') && janIdx === -1) janIdx = j
            if ((cell === 'FEB' || cell === 'FEBRERO') && febIdx === -1) febIdx = j
            if ((cell === 'MAR' || cell === 'MARZO') && marIdx === -1) marIdx = j
            if ((cell === 'ABR' || cell === 'APR' || cell === 'ABRIL') && aprIdx === -1) aprIdx = j
            if ((cell === 'MAY' || cell === 'MAYO') && mayIdx === -1) mayIdx = j
            if ((cell === 'JUN' || cell === 'JUNIO') && junIdx === -1) junIdx = j
            if ((cell === 'JUL' || cell === 'JULIO') && julIdx === -1) julIdx = j
            if ((cell === 'AGO' || cell === 'AUG' || cell === 'AGOSTO') && augIdx === -1) augIdx = j
            if ((cell === 'SET' || cell === 'SEP' || cell === 'SEPT' || cell === 'SEPTIEMBRE') && sepIdx === -1) sepIdx = j
            if ((cell === 'OCT' || cell === 'OCTUBRE') && octIdx === -1) octIdx = j
            if ((cell === 'NOV' || cell === 'NOVIEMBRE') && novIdx === -1) novIdx = j
            if ((cell === 'DIC' || cell === 'DEC' || cell === 'DICIEMBRE') && decIdx === -1) decIdx = j
          }

          // Si encontramos todos los meses, salir
          if (janIdx !== -1 && febIdx !== -1 && marIdx !== -1 && aprIdx !== -1 && 
              mayIdx !== -1 && junIdx !== -1 && julIdx !== -1 && augIdx !== -1 && 
              sepIdx !== -1 && octIdx !== -1 && novIdx !== -1 && decIdx !== -1) {
            break
          }
        }

        // Si no encontramos headers, usar índices por defecto (asumiendo estructura estándar)
        // Columna 0: Country/Producto, Columnas 1-12: Meses
        if (janIdx === -1) {
          janIdx = 1
          febIdx = 2
          marIdx = 3
          aprIdx = 4
          mayIdx = 5
          junIdx = 6
          julIdx = 7
          augIdx = 8
          sepIdx = 9
          octIdx = 10
          novIdx = 11
          decIdx = 12
        }

        // Iterar sobre las filas
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]

          // Saltar filas vacías
          if (!row || row.length === 0) continue

          const firstCell = row[0]?.toString().trim()
          if (!firstCell) continue

          // Detectar si es un header de país
          if (COUNTRY_CODES[firstCell]) {
            currentCountry = firstCell
            currentCountryCode = COUNTRY_CODES[firstCell]
            continue
          }

          // Si no hay país actual, saltar
          if (!currentCountry) continue

          // Saltar si parece ser un header de columna
          if (firstCell.toUpperCase() === 'COUNTRY' || 
              firstCell.toUpperCase() === 'PAÍS' ||
              firstCell.toUpperCase() === 'PRUEBA' ||
              firstCell.toUpperCase().includes('PLAN') ||
              firstCell.toUpperCase().includes('OUTLOOK')) {
            continue
          }

          // Extraer cantidades mensuales
          const jan = parseFloat(row[janIdx]?.toString() || '0') || 0
          const feb = parseFloat(row[febIdx]?.toString() || '0') || 0
          const mar = parseFloat(row[marIdx]?.toString() || '0') || 0
          const apr = parseFloat(row[aprIdx]?.toString() || '0') || 0
          const may = parseFloat(row[mayIdx]?.toString() || '0') || 0
          const jun = parseFloat(row[junIdx]?.toString() || '0') || 0
          const jul = parseFloat(row[julIdx]?.toString() || '0') || 0
          const aug = parseFloat(row[augIdx]?.toString() || '0') || 0
          const sep = parseFloat(row[sepIdx]?.toString() || '0') || 0
          const oct = parseFloat(row[octIdx]?.toString() || '0') || 0
          const nov = parseFloat(row[novIdx]?.toString() || '0') || 0
          const dec = parseFloat(row[decIdx]?.toString() || '0') || 0

          const totalUnits = jan + feb + mar + apr + may + jun + jul + aug + sep + oct + nov + dec

          // Solo agregar si hay al menos un valor > 0 y el nombre del producto es válido
          if (totalUnits > 0 && firstCell && firstCell.length > 0) {
            budgetEntries.push({
              id: crypto.randomUUID(),
              country: currentCountry,
              country_code: currentCountryCode,
              product_name: firstCell,
              year: 2026,
              jan,
              feb,
              mar,
              apr,
              may,
              jun,
              jul,
              aug,
              sep,
              oct,
              nov,
              dec,
              total_units: totalUnits,
              created_at: new Date(),
              updated_at: new Date(),
            })
          }
        }

        resolve(budgetEntries)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Error reading file'))
    reader.readAsBinaryString(file)
  })
}

