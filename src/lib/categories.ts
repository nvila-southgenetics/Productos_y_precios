// Categorías de productos y sus nombres asociados
export const PRODUCT_CATEGORIES = {
  'Todos': null,
  'Alergia': [
    'ImmunoCAP ISAC'
  ],
  'Carrier': [
    'Carrier gen específico',
    'Cgt Exome',
    'Unity Carrier',
    'Vista Carrier 1200',
    'Vista Carrier 1200 - 2 pax',
    'Vista Targeted Carrier',
    'Vista Targeted Carrier - 2 pax',
    'Invitae X Frágil',
    'Vista Targeted Carrier172 genes',
    'CARRIER 172',
    'CARRIER 172 PAREJA',
    'Carrier Gen Específico'
  ],
  'Ginecología': [
    'Adicional',
    '[Agregado] Adicional',
    'Unity BPS',
    '[Unity BPS] Unity BPS',
    'Claritest',
    'EndomeTRIO',
    'ErComplete',
    'ErPeak',
    'ERPeak',
    'Genome IEE',
    'ENDOMETRIO EMMA'
  ],
  'Prenatales': [
    'MaterniT Genome',
    'MaterniT21',
    'MaterniT21 Plus',
    'MaterniT21+ESS (gemelar)',
    'MaterniT21+ESS',
    'MyPrenatal Básico',
    'MyPrenatal GenomeScreen',
    'Nifty',
    'Nifty Pro',
    'Unity',
    'Unity Complete',
    'MATERNIT 21 + SCA',
    'Maternit 21 plus',
    'MATERNIT GENOME',
    'PATERNIDAD PRE*Paternidad Prenatal',
    'Paternidad Prenatal + adicional',
    'Paternidad Prenatal BGI',
    'Paternidad Prenatal DDC',
    'Paternidad Prenatal',
    'Paternidad Post Natal'
  ],
  'Oncología': [
    'CellSearch CTC',
    '[CellSearch CTC] CellSearch CTC',
    'CellSearch CTC-ER',
    '[CellSearch CTC-ER] CellSearch CTC-ER',
    'CellSearch CTC-HER2',
    '[CellSearch CTC-HER2] CellSearch CTC-HER2',
    'Oncotype Dx Mama',
    '[Oncotype Dx Mama] Oncotype Dx Mama',
    'Tempus XT + XR Tejido',
    '[XT + XR] Tempus XT + XR Tejido',
    'Color Hereditary Cancer',
    'Color Panel Mama Extendido',
    'Invitae Canceres Heredit Comunes',
    'Invitae Cánceres Hereditarios Comunes',
    'Invitae Exome',
    'Invitae Multi-Cancer Panel',
    'Invitae Panel Ca Mama y Ginecologico',
    'Invitae Panel Ca Prostata',
    'Invitae Test Familiar',
    'Mayo Clinic ONCOLOGY',
    'Odx Multifocales',
    'ODX Falp',
    'Panel Genetico Invitae',
    'Reference Laboratory',
    'SENTIS Pancreatic Cancer Medication Guidance',
    'SENTIS™ Lung Cancer Panel (Tissue, 20 genes)',
    'Sentis Cancer + Discovery (B)',
    'Sentis Cancer + Discovery (T)',
    'Sentis Panel Cáncer Hereditario',
    'Tempus ADDs ON',
    'SENTIS™ Colorectal Cancer Panel (Tissue, 23 genes)',
    'Tempus xT Heme',
    'Sentis HRD + Sentis Cáncer (T)',
    'SENTIS MULTI CANCER B',
    'Panel Cáncer Hereditario Extendido',
    'Panel Invitae Cáncer Próstata',
    'Decision DX - UM'
  ],
  'Endocrinología': [
    'MirThype Target',
    '[MirThype Target] MirThype Target',
    'mirTHYpe FULL',
    '[mirTHYpe FULL] mirTHYpe FULL',
    'mirTHYpe preOp',
    '[mirTHYpe preOp] mirTHYpe preOp',
    'Afirma GSC',
    'Afirma Xpression Atlas'
  ],
  'Urología': [
    'Cxbladder',
    '[Cxbladder] Cxbladder',
    'Genomic Prostate Score',
    '[Genomic Prostate Score (GPS)] Genomic Prostate Score',
    'Genomic Prostate Score (GPS)',
    'SelectMDX',
    '[SelectMDX] SelectMDX',
    '4Kscore',
    'Confirm MDX',
    'Decipher',
    'DECIPHER',
    'Panel Invitae Cáncer de Próstata'
  ],
  'Otros': [
    'Genomind Professional PGx',
    '[Genomind Professional PGx] Genomind Professional PGx',
    'Exome proband only',
    'Healthy Weight',
    'Metabolic Newborn Screening Confirmation Panel',
    'Screening Neonatal',
    '02PULDEN-0017',
    '01SANCOR-0011',
    '01SANCOR-0012',
    '01SANCOR-0013'
  ],
  'Anualidades': [
    'Células Madres 10 años',
    'SCU 1A + Segmento',
    'SCU 10A + Segmento',
    'SCU 5A + Segmento',
    'Almacenamiento SCU Nuevos Procesamientos',
    '[SCU] 10A - SANCOR'
  ]
} as const

export type CategoryName = keyof typeof PRODUCT_CATEGORIES

// Función helper para determinar la categoría de un producto basado en su nombre
export function getCategoryFromProductName(productName: string): CategoryName | null {
  const nameUpper = productName.toUpperCase()
  
  // Buscar en cada categoría (excepto "Todos")
  for (const [category, products] of Object.entries(PRODUCT_CATEGORIES)) {
    if (category === 'Todos') continue
    
    if (products) {
      for (const product of products) {
        if (nameUpper.includes(product.toUpperCase())) {
          return category as CategoryName
        }
      }
    }
  }
  
  return null
}

// Función para obtener todos los nombres de categorías
export function getCategoryNames(): CategoryName[] {
  return Object.keys(PRODUCT_CATEGORIES) as CategoryName[]
}

// Mapeo de productos a tipos de muestra
// Nota: Un producto puede tener múltiples tipos, se almacenan como string separado por comas
export const PRODUCT_TYPES: Record<string, string[]> = {
  // Pruebas con tipos específicos según la lista proporcionada
  'ImmunoCAP ISAC': ['Sangre'],
  'Carrier gen específico': ['Sangre'],
  'Cgt Exome': ['Sangre'],
  'Unity Carrier': ['Sangre'],
  'Vista Carrier 1200': ['Sangre'],
  'Vista Carrier 1200 - 2 pax': ['Sangre'],
  'Vista Targeted Carrier': ['Sangre'],
  'Vista Targeted Carrier - 2 pax': ['Sangre'],
  'Invitae X Frágil': ['Sangre'],
  'Vista Targeted Carrier172 genes': ['Sangre'],
  'EndomeTRIO': ['Biopsia endometrial'],
  'ErComplete': ['Biopsia endometrial'],
  'ErPeak': ['Biopsia endometrial'],
  'MaterniT Genome': ['Sangre'],
  'MaterniT21': ['Sangre'],
  'MaterniT21 Plus': ['Sangre'],
  'Nifty': ['Sangre'],
  'Nifty Pro': ['Sangre'],
  'Unity': ['Sangre'],
  'Unity Complete': ['Sangre'],
  '[CellSearch CTC] CellSearch CTC': ['Sangre'],
  'CellSearch CTC': ['Sangre'],
  '[CellSearch CTC-ER] CellSearch CTC-ER': ['Sangre'],
  'CellSearch CTC-ER': ['Sangre'],
  '[CellSearch CTC-HER2] CellSearch CTC-HER2': ['Sangre'],
  'CellSearch CTC-HER2': ['Sangre'],
  'Invitae Canceres Heredit Comunes': ['Sangre'],
  'Invitae Cánceres Hereditarios Comunes': ['Sangre'],
  'Invitae Exome': ['Sangre'],
  'Invitae Multi-Cancer Panel': ['Sangre'],
  'Invitae Panel Ca Mama y Ginecologico': ['Sangre'],
  'Invitae Panel Ca Prostata': ['Sangre'],
  'Invitae Panel Ca Próstata': ['Sangre'],
  'Invitae Test Familiar': ['Sangre'],
  '[Oncotype Dx Mama] Oncotype Dx Mama': ['Corte de Tejido'],
  'Oncotype Dx Mama': ['Corte de Tejido'],
  'Panel Genetico Invitae': ['Sangre'],
  'SENTIS Pancreatic Cancer Medication Guidance': ['Sangre', 'Corte de Tejido'],
  'SENTIS™ Lung Cancer Panel (Tissue, 20 genes)': ['Sangre', 'Corte de Tejido'],
  'Sentis Cancer + Discovery (B)': ['Sangre'],
  'Sentis Cancer + Discovery (T)': ['Sangre', 'Corte de Tejido'],
  'Sentis Panel Cáncer Hereditario': ['Sangre'],
  'Tempus ADDs ON': [],
  '[XT + XR] Tempus XT + XR Tejido': ['Sangre', 'Corte de Tejido'],
  'Tempus XT + XR Tejido': ['Sangre', 'Corte de Tejido'],
  'SENTIS™ Colorectal Cancer Panel (Tissue, 23 genes)': ['Sangre', 'Corte de Tejido'],
  'Exome proband only': ['Sangre'],
  '[Genomind Professional PGx] Genomind Professional PGx': ['Hisopado bucal'],
  'Genomind Professional PGx': ['Hisopado bucal'],
  'Metabolic Newborn Screening Confirmation Panel': ['Sangre'],
  'Paternidad Prenatal BGI': ['Sangre'],
  'Paternidad Prenatal DDC': ['Sangre'],
  'Screening Neonatal': [],
  '4Kscore': ['Sangre'],
  'Confirm MDX': ['Corte de Tejido'],
  '[Cxbladder] Cxbladder': ['Orina'],
  'Cxbladder': ['Orina'],
  'Decipher': [],
  'DECIPHER': [],
  '[Genomic Prostate Score (GPS)] Genomic Prostate Score': ['Corte de Tejido'],
  'Genomic Prostate Score (GPS)': ['Corte de Tejido'],
  '[SelectMDX] SelectMDX': ['Orina'],
  'SelectMDX': ['Orina'],
  'Afirma GSC': ['Punción'],
  'Afirma Xpression Atlas': ['Punción'],
  '[MirThype Target] MirThype Target': ['Corte de Tejido'],
  'MirThype Target': ['Corte de Tejido'],
  '[mirTHYpe FULL] mirTHYpe FULL': ['Corte de Tejido'],
  'mirTHYpe FULL': ['Corte de Tejido'],
  '[mirTHYpe preOp] mirTHYpe preOp': ['Corte de Tejido'],
  'mirTHYpe preOp': ['Corte de Tejido'],
  // Variaciones y nombres alternativos
  'ENDOMETRIO EMMA': ['Biopsia endometrial'],
  'CARRIER 172': ['Sangre'],
  'CARRIER 172 PAREJA': ['Sangre'],
  'Carrier Gen Específico': ['Sangre'],
  'ODX Falp': ['Corte de Tejido'],
  'Tempus xT Heme': ['Sangre'],
  'Sentis HRD + Sentis Cáncer (T)': ['Sangre', 'Corte de Tejido'],
  'Decision DX - UM': ['Corte de Tejido'],
  'SENTIS MULTI CANCER B': ['Sangre'],
  'Panel Cáncer Hereditario Extendido': ['Sangre'],
  'Panel Invitae Cáncer Próstata': ['Sangre'],
  'Panel Invitae Cáncer de Próstata': ['Sangre'],
  'MATERNIT 21 + SCA': ['Sangre'],
  'Maternit 21 plus': ['Sangre'],
  'MATERNIT GENOME': ['Sangre'],
  'PATERNIDAD PRE*Paternidad Prenatal': ['Sangre'],
  'Paternidad Post Natal': ['Sangre'],
  'Paternidad Prenatal': ['Sangre']
} as const

// Función helper para determinar el tipo de un producto basado en su nombre
// Retorna un string con los tipos separados por comas, o null si no se encuentra
export function getTypeFromProductName(productName: string): string | null {
  const nameUpper = productName.toUpperCase().trim()
  
  // Buscar coincidencia exacta primero
  for (const [product, types] of Object.entries(PRODUCT_TYPES)) {
    if (nameUpper === product.toUpperCase().trim()) {
      return types.length > 0 ? types.join(', ') : null
    }
  }
  
  // Buscar coincidencia parcial (el nombre del producto contiene el nombre del mapeo)
  for (const [product, types] of Object.entries(PRODUCT_TYPES)) {
    const productUpper = product.toUpperCase().trim()
    // Buscar si el nombre del producto contiene el nombre del mapeo o viceversa
    if (nameUpper.includes(productUpper) || productUpper.includes(nameUpper)) {
      return types.length > 0 ? types.join(', ') : null
    }
  }
  
  return null
}

