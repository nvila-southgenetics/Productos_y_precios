"use client"

import { Select } from "@/components/ui/select"

interface CompanyFilterProps {
  companies: string[]
  selectedCompany: string
  onCompanyChange: (company: string) => void
}

export function CompanyFilter({
  companies,
  selectedCompany,
  onCompanyChange,
}: CompanyFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-white/90">Compañía</label>
      <Select
        value={selectedCompany}
        onChange={(e) => onCompanyChange(e.target.value)}
        className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="Todas las compañías" className="bg-blue-900 text-white">Todas las compañías</option>
        {companies.map((company) => (
          <option key={company} value={company} className="bg-blue-900 text-white">
            {company}
          </option>
        ))}
      </Select>
    </div>
  )
}



