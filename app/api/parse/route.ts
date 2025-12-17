Now update app/api/parse/route.ts - this is the big one.
Go to: https://github.com/JFSharpe/maine-school-import/blob/main/app/api/parse/route.ts
Click the pencil icon to edit, then select all and replace with this code:
typescriptimport { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const EPS_CATEGORIES: Record<string, string> = {
  'regularInstruction': 'Regular Instruction',
  'specialEducation': 'Special Education',
  'careerTechnical': 'Career & Technical Education',
  'otherInstruction': 'Other Instruction',
  'studentStaffSupport': 'Student & Staff Support',
  'systemAdmin': 'System Administration',
  'schoolAdmin': 'School Administration',
  'transportation': 'Transportation & Buses',
  'facilitiesMaint': 'Facilities Maintenance',
  'debtService': 'Debt Service',
  'allOther': 'All Other Expenditures',
}

const FUNCTION_CODES: Record<string, string> = {
  '1000': 'Instruction',
  '2120': 'Guidance Services',
  '2130': 'Health Services',
  '2220': 'Library/Media Services',
  '2310': 'Board of Education',
  '2320': 'Executive Administration',
  '2400': 'School Administration',
  '2600': 'Operations & Maintenance',
  '2700': 'Transportation',
  '5100': 'Debt Service',
}

const FUNCTION_TO_EPS: Record<string, string> = {
  '1000': 'regularInstruction',
  '2120': 'studentStaffSupport',
  '2130': 'studentStaffSupport',
  '2220': 'studentStaffSupport',
  '2310': 'systemAdmin',
  '2320': 'systemAdmin',
  '2400': 'schoolAdmin',
  '2600': 'facilitiesMaint',
  '2700': 'transportation',
  '5100': 'debtService',
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const reportType = formData.get('reportType') as string || 'auto'
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const arrayBuffer = await file.arrayBuffer()
    
    let result

    if (fileName.endsWith('.pdf')) {
      result = await parseED279PDF(arrayBuffer)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      if (reportType === 'trio' || detectTrioReport(workbook)) {
        result = parseTrioReport(workbook)
      } else if (reportType === 'staffing' || detectStaffingReport(workbook)) {
        result = parseStaffingReport(workbook)
      } else {
        result = parseTrioReport(workbook)
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file type. Please upload an Excel (.xlsx, .xls) or PDF file.',
      })
    }

    if (!result.success) {
      return NextResponse.json(result)
    }

    return NextResponse.json({ success: true, data: result.data })

  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse file',
    }, { status: 500 })
  }
}

async function parseED279PDF(arrayBuffer: ArrayBuffer): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const buffer = Buffer.from(arrayBuffer)
    const pdfData = await pdfParse(buffer)
    const text = pdfData.text

    let district = 'Unknown'
    const districtMatch = text.match(/ORG ID\s*:\s*\d+\s+([A-Za-z\-\s]+(?:CSD|SAD|RSU|School Department|Schools?))/i)
    if (districtMatch) district = districtMatch[1].trim()

    let fiscalYear = 'Unknown'
    const fyMatch = text.match(/(\d{4})\s*-\s*(\d{4})/)
    if (fyMatch) fiscalYear = `FY${fyMatch[1].slice(-2)}-${fyMatch[2].slice(-2)}`

    let generatedDate = 'Unknown'
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
    if (dateMatch) generatedDate = dateMatch[1]

    let totalPupils = 0
    const pupilsMatch = text.match(/Total\s+(\d+\.?\d*)\s+100\.00%/)
    if (pupilsMatch) totalPupils = parseFloat(pupilsMatch[1]) || 0

    let epsRateK8 = 0, epsRate912 = 0
    const ratesMatch = text.match(/Calculated EPS Rates Per Pupil[:\s]*=?\s*(\d{1,2},?\d{3})\s+(\d{1,2},?\d{3})/)
    if (ratesMatch) {
      epsRateK8 = parseFloat(ratesMatch[1].replace(',', '')) || 0
      epsRate912 = parseFloat(ratesMatch[2].replace(',', '')) || 0
    }

    let operatingAllocation = 0
    const operatingMatch = text.match(/Operating Allocation Totals?\s*=?\s*\$?([\d,]+\.?\d*)/i)
    if (operatingMatch) operatingAllocation = parseFloat(operatingMatch[1].replace(/,/g, '')) || 0

    let specialEdAllocation = 0
    const specEdMatch = text.match(/Special Education\s*-\s*EPS Allocation[\s\S]*?=?\s*\$?([\d,]+\.?\d*)/i)
    if (specEdMatch) specialEdAllocation = parseFloat(specEdMatch[1].replace(/,/g, '')) || 0

    let specialEdHighCost = 0
    const highCostMatch = text.match(/Special Education\s*-\s*High-Cost[\s\S]*?=?\s*\$?([\d,]+\.?\d*)/i)
    if (highCostMatch) specialEdHighCost = parseFloat(highCostMatch[1].replace(/,/g, '')) || 0

    let transportationAllocation = 0
    const transportMatch = text.match(/Transportation Operating\s*-\s*EPS Allocation[\s\S]*?=?\s*\$?([\d,]+\.?\d*)/i)
    if (transportMatch) transportationAllocation = parseFloat(transportMatch[1].replace(/,/g, '')) || 0

    let teacherRetirement = 0
    const retirementMatch = text.match(/Teacher Retirement Amount[\s\S]*?\$?([\d,]+\.?\d*)/i)
    if (retirementMatch) teacherRetirement = parseFloat(retirementMatch[1].replace(/,/g, '')) || 0

    let giftedTalented = 0
    const giftedMatch = text.match(/Gifted & Talented[\s\S]*?=\s*\$?([\d,]+\.?\d*)/i)
    if (giftedMatch) giftedTalented = parseFloat(giftedMatch[1].replace(/,/g, '')) || 0

    let totalAllocation = 0
    const totalAllocMatch = text.match(/100%\s*EPS\s*Allocation\s*\$?([\d,]+\.?\d*)/i)
    if (totalAllocMatch) totalAllocation = parseFloat(totalAllocMatch[1].replace(/,/g, '')) || 0

    let debtService = 0
    const debtMatch = text.match(/Total Debt Service Allocation\s*=\s*\$?([\d,]+\.?\d*)/i)
    if (debtMatch) debtService = parseFloat(debtMatch[1].replace(/,/g, '')) || 0

    let stateContribution = 0
    const stateMatch = text.match(/Adjusted State Contribution\s*\$?([\d,]+\.?\d*)/i)
    if (stateMatch) stateContribution = parseFloat(stateMatch[1].replace(/,/g, '')) || 0

    let localSharePct = 0, stateSharePct = 0
    const pctMatch = text.match(/After Adjustments\s*:\s*Local Share %\s*=\s*([\d.]+)\s*%\s*State Share %\s*=\s*([\d.]+)\s*%/i)
    if (pctMatch) {
      localSharePct = parseFloat(pctMatch[1]) || 0
      stateSharePct = parseFloat(pctMatch[2]) || 0
    }

    let millExpectation = 0
    const millMatch = text.match(/Mill\s*Expectation\s*\n?\s*([\d.]+)/i)
    if (millMatch) millExpectation = parseFloat(millMatch[1]) || 0

    const localContribution = totalAllocation - stateContribution

    const summary = [
      { category: 'Operating Allocation (Basic EPS)', epsAllocation: operatingAllocation, percentOfTotal: totalAllocation > 0 ? (operatingAllocation / totalAllocation) * 100 : 0 },
      { category: 'Special Education - EPS', epsAllocation: specialEdAllocation, percentOfTotal: totalAllocation > 0 ? (specialEdAllocation / totalAllocation) * 100 : 0 },
      { category: 'Special Education - High Cost', epsAllocation: specialEdHighCost, percentOfTotal: totalAllocation > 0 ? (specialEdHighCost / totalAllocation) * 100 : 0 },
      { category: 'Transportation', epsAllocation: transportationAllocation, percentOfTotal: totalAllocation > 0 ? (transportationAllocation / totalAllocation) * 100 : 0 },
      { category: 'Teacher Retirement', epsAllocation: teacherRetirement, percentOfTotal: totalAllocation > 0 ? (teacherRetirement / totalAllocation) * 100 : 0 },
      { category: 'Gifted & Talented', epsAllocation: giftedTalented, percentOfTotal: totalAllocation > 0 ? (giftedTalented / totalAllocation) * 100 : 0 },
      { category: 'Debt Service', epsAllocation: debtService, percentOfTotal: totalAllocation > 0 ? (debtService / totalAllocation) * 100 : 0 },
    ].filter(row => row.epsAllocation > 0)

    return {
      success: true,
      data: {
        reportType: 'ED279 - EPS State Funding Calculation',
        district,
        fiscalYear,
        generatedDate,
        ed279: {
          totalAllocation,
          operatingAllocation,
          specialEdAllocation,
          specialEdHighCost,
          transportationAllocation,
          teacherRetirement,
          giftedTalented,
          debtService,
          localShare: localContribution,
          stateShare: stateContribution,
          localSharePct,
          stateSharePct,
          pupilCount: totalPupils,
          epsRateK8,
          epsRate912,
          millExpectation,
          perPupilAllocation: totalPupils > 0 ? totalAllocation / totalPupils : 0,
        },
        summary,
        details: [],
        totals: { budget: totalAllocation, actual: 0, encumbered: 0, available: totalAllocation },
      },
    }
  } catch (error) {
    console.error('ED279 PDF parse error:', error)
    return { success: false, error: 'Failed to parse ED279 PDF.' }
  }
}

function detectTrioReport(workbook: XLSX.WorkBook): boolean {
  return workbook.SheetNames.includes('Summary') && workbook.SheetNames.includes('Detail')
}

function detectStaffingReport(workbook: XLSX.WorkBook): boolean {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 })
  const text = data.flat().join(' ').toLowerCase()
  return text.includes('fte') || text.includes('staffing') || text.includes('position')
}

function parseTrioReport(workbook: XLSX.WorkBook) {
  let reportType = 'Trio Financial Report'
  let district = 'Unknown'
  let fiscalYear = 'Unknown'
  let generatedDate = 'Unknown'
  const summary: any[] = []
  const details: any[] = []

  const sheetNames = workbook.SheetNames

  if (sheetNames.includes('Summary') && sheetNames.includes('Detail')) {
    const summarySheet = workbook.Sheets['Summary']
    const summaryData = XLSX.utils.sheet_to_json<string[]>(summarySheet, { header: 1 })
    
    reportType = 'Comparative Financial Statement'
    if (summaryData[0] && summaryData[0][0]) district = String(summaryData[0][0]).trim()

    for (const row of summaryData) {
      const rowStr = row.join(' ')
      const fyMatch = rowStr.match(/FY(\d{2})-(\d{2})/i)
      if (fyMatch) fiscalYear = `FY${fyMatch[1]}-${fyMatch[2]}`
      const dateMatch = rowStr.match(/Created On:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
      if (dateMatch) generatedDate = dateMatch[1]
    }

    let foundHeader = false
    for (const row of summaryData) {
      if (!row || row.length < 5) continue
      const firstCell = String(row[0] || '').trim()
      if (firstCell === 'Budget Category') { foundHeader = true; continue }
      if (!foundHeader) continue
      
      const categoryMatch = firstCell.match(/^(\d{2})\s+(.+)/)
      if (categoryMatch) {
        const budget = parseNumber(row[1])
        const actual = parseNumber(row[2])
        const encumbered = parseNumber(row[3])
        const available = parseNumber(row[4])
        if (budget < 0) continue
        summary.push({ category: firstCell, budget, actual, encumbered, available, percentSpent: budget > 0 ? (actual / budget) * 100 : 0 })
      }
    }

    const detailSheet = workbook.Sheets['Detail']
    const detailData = XLSX.utils.sheet_to_json<string[]>(detailSheet, { header: 1 })

    let headerRowIndex = -1
    for (let i = 0; i < detailData.length; i++) {
      if (detailData[i]?.some(cell => String(cell).includes('Account Code'))) { headerRowIndex = i; break }
    }

    if (headerRowIndex >= 0) {
      for (let i = headerRowIndex + 1; i < detailData.length; i++) {
        const row = detailData[i]
        if (!row || row.length < 6) continue
        const accountCode = String(row[0] || '').trim()
        if (!accountCode.match(/^\d{4}-\d{4}-\d{4}-\d{4}-\d{3}$/)) continue

        const parts = accountCode.split('-')
        details.push({
          accountCode,
          description: String(row[1] || '').trim(),
          fund: parts[0], program: parts[1], function: parts[2], object: parts[3], location: parts[4],
          budget: parseNumber(row[2]),
          actual: parseNumber(row[3]),
          encumbered: parseNumber(row[4]),
          available: parseNumber(row[5]),
          percentSpent: parseNumber(row[2]) > 0 ? (parseNumber(row[3]) / parseNumber(row[2])) * 100 : 0,
          epsCategory: FUNCTION_TO_EPS[parts[2]] || 'allOther',
        })
      }
    }
  }

  if (summary.length === 0 && details.length > 0) {
    const byFunction: Record<string, { budget: number, actual: number, encumbered: number }> = {}
    for (const row of details.filter(d => d.budget > 0)) {
      if (!byFunction[row.function]) byFunction[row.function] = { budget: 0, actual: 0, encumbered: 0 }
      byFunction[row.function].budget += row.budget
      byFunction[row.function].actual += row.actual
      byFunction[row.function].encumbered += row.encumbered
    }
    for (const [func, totals] of Object.entries(byFunction)) {
      summary.push({
        category: `${func} - ${FUNCTION_CODES[func] || 'Function ' + func}`,
        budget: totals.budget, actual: totals.actual, encumbered: totals.encumbered,
        available: totals.budget - totals.actual - totals.encumbered,
        percentSpent: totals.budget > 0 ? (totals.actual / totals.budget) * 100 : 0,
      })
    }
    summary.sort((a, b) => b.budget - a.budget)
  }

  const expenditureDetails = details.filter(d => d.budget > 0)
  const totals = {
    budget: expenditureDetails.reduce((sum, d) => sum + d.budget, 0),
    actual: expenditureDetails.reduce((sum, d) => sum + d.actual, 0),
    encumbered: expenditureDetails.reduce((sum, d) => sum + d.encumbered, 0),
    available: expenditureDetails.reduce((sum, d) => sum + d.available, 0),
  }

  const epsSummary: Record<string, { budget: number, actual: number }> = {}
  for (const row of expenditureDetails) {
    const cat = row.epsCategory || 'allOther'
    if (!epsSummary[cat]) epsSummary[cat] = { budget: 0, actual: 0 }
    epsSummary[cat].budget += row.budget
    epsSummary[cat].actual += row.actual
  }

  return { success: true, data: { reportType, district, fiscalYear, generatedDate, summary, details, totals, epsSummary } }
}

function parseStaffingReport(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  
  let district = 'Unknown', fiscalYear = 'Unknown'
  const staffing: any[] = []
  let headerRow = -1, headers: string[] = []
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row) continue
    const rowText = row.map(c => String(c || '').toLowerCase()).join(' ')
    if (rowText.includes('position') || rowText.includes('fte')) { headerRow = i; headers = row.map(c => String(c || '').trim()); break }
  }
  
  if (headerRow >= 0) {
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length < 2) continue
      const record: any = {}
      for (let j = 0; j < headers.length; j++) record[headers[j]] = row[j]
      if (Object.values(record).some(v => v !== undefined && v !== '')) staffing.push(record)
    }
  }
  
  let totalFTE = 0
  for (const record of staffing) {
    const fteKey = Object.keys(record).find(k => k.toLowerCase().includes('fte'))
    if (fteKey) totalFTE += parseNumber(record[fteKey])
  }

  return { success: true, data: { reportType: 'Staffing Report', district, fiscalYear, generatedDate: new Date().toLocaleDateString(), staffing, totalFTE, positionCount: staffing.length, summary: [], details: [], totals: { budget: 0, actual: 0, encumbered: 0, available: 0 } } }
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value.replace(/[$,]/g, '').trim()) || 0
  return 0
}
