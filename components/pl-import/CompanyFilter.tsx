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
      <label className="text-sm font-medium">Compañía</label>
      <Select
        value={selectedCompany}
        onChange={(e) => onCompanyChange(e.target.value)}
        className="w-full"
      >
        {companies.map((company) => (
          <option key={company} value={company}>
            {company}
          </option>
        ))}
      </Select>
    </div>
  )
}



