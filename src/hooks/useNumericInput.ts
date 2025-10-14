import { useState, useCallback, useEffect } from 'react'

export function useNumericInput(initialValue: number | undefined = undefined) {
  const [stringValue, setStringValue] = useState<string>(
    initialValue !== undefined ? initialValue.toString() : ''
  )

  const updateValue = useCallback((newStringValue: string, skipConversion = false) => {
    setStringValue(newStringValue)
  }, [])

  const getNumericValue = useCallback((): number | undefined => {
    if (stringValue === '' || stringValue === '-') {
      return undefined
    }
    
    // Permitir números con decimales, negativos, etc.
    const numValue = parseFloat(stringValue)
    return isNaN(numValue) ? undefined : numValue
  }, [stringValue])

  const getDisplayValue = useCallback((decimals: number = 2): string => {
    const numValue = getNumericValue()
    if (numValue === undefined) return ''
    
    return numValue.toFixed(decimals)
  }, [getNumericValue])

  const setValueFromNumber = useCallback((numValue: number | undefined, decimals: number = 2) => {
    if (numValue === undefined) {
      setStringValue('')
    } else {
      setStringValue(numValue.toFixed(decimals))
    }
  }, [])

  return {
    stringValue,
    updateValue,
    getNumericValue,
    getDisplayValue,
    setValueFromNumber
  }
}
