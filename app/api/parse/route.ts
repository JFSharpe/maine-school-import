import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Maine EPS cost categories (from ED279)
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

// Maine standard function codes
const FUNCTION_CODES: Record<string, string> = {
  '1000': 'Instruction',
  '2110': 'Attendance/Social Work',
  '2120': 'Guidance Services',
  '2130': 'Health Services',
  '2140': 'Psychological Services',
  '2150': 'Speech Pathology',
  '2160': 'Other Student Support',
  '2170': 'Student Support - Other',
  '2190': 'Other Support Services',
  '2210': 'Improvement of Instruction',
  '2213': 'Instructional Staff Training',
  '2220': 'Library/Media Services',
  '2230': 'Technology',
  '2310': 'Board of Education',
  '2320': 'Executive Administration',
  '2330': 'Special Programs Admin',
  '2400': 'School Administration',
  '2500': 'Business Services',
  '2600': 'Operations & Maintenance',
  '2610': 'Building Operations',
  '2620': 'Building Maintenance',
  '2660': 'Security Services',
  '2690': 'Other O&M',
  '2700': 'Transportation',
  '2750': 'Transportation - Other',
  '3100': 'Food Services',
  '5100': 'Debt Service',
  '5200': 'Fund Transfers',
}

// Function to map Trio function codes to EPS categories
const FUNCTION_TO_EPS: Record<string, string> = {
  '1000': 'regularInstruction',
  '2110': 'studentStaffSupport',
  '2120': 'studentStaffSupport',
  '2130': 'studentStaffSupport',
  '2140': 'studentStaffSupport',
  '2150': 'studentStaffSupport',
  '2160': 'studentStaffSupport',
  '2170': 'studentStaffSupport',
  '2190': 'studentStaffSupport',
  '2210': 'studentStaffSupport',
  '2213': 'studentStaffSupport',
  '2220': 'studentStaffSupport',
  '2230': 'studentStaffSupport',
  '2310': 'systemAdmin',
  '2320': 'systemAdmin',
  '2330': 'systemAdmin',
  '2400': 'schoolAdmin',
  '2500': 'systemAdmin',
  '2600': 'facilitiesMaint',
  '2610': 'facilitiesMaint',
  '2620': 'facilitiesMaint',
  '2660': 'facilitiesMaint',
  '2690': 'facilitiesMaint',
  '2700': 'transportation',
  '2750': 'transportation',
  '3100': 'allOther',
  '5100': 'debtService',
  '5200': 'allOther',
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const reportType = formData.get('reportType') as string || 'auto'
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    const sheetNames = workbook.SheetNames
    console.log('Sheet names:', sheetNames)
    console.log('Report type hint:', reportType)

    // Detect and parse based on report type
    let result
    
    if (reportType === 'ed279' || detectED279(workbook)) {
      result = parseED279(workbook)
    } else if (reportType === 'trio' || detectTrioReport(workbook)) {
      result = parseTrioReport(workbook)
    } else if (reportType === 'staffing' || detectStaffingReport(workbook)) {
      result = parseStaffingReport(workbook)
    } else {
      // Try auto-detection
      if (sheetNames.some(s => s.toLowerCase().includes('ed279') || s.toLowerCase().includes('subsidy'))) {
        result = parseED279(workbook)
      } else if (sheetNames.includes('Summary') && sheetNames.includes('Detail')) {
        result = parseTrioReport(workbook)
      } else {
        result = parseTrioReport(workbook) // Default to Trio format
      }
    }

    if (!result.success) {
      return NextResponse.json(result)
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })

  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse file',
    }, { status: 500 })
  }
}

function detectED279(workbook: XLSX.WorkBook): boolean {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 })
  const text = data.flat().join(' ').toLowerCase()
  
  return text.includes('ed279') || 
         text.includes('essential programs and services') ||
         text.includes('eps allocation') ||
         text.includes('state subsidy') ||
         text.includes('operating allocation')
}

function detectTrioReport(workbook: XLSX.WorkBook): boolean {
  const sheetNames = workbook.SheetNames
  return sheetNames.includes('Summary') && sheetNames.includes('Detail')
}

function detectStaffingReport(workbook: XLSX.WorkBook): boolean {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 })
  const text = data.flat().join(' ').toLowerCase()
  
  return text.includes('fte') || 
         text.includes('staffing') ||
         text.includes('position') ||
         text.includes('employee')
}

function parseED279(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  
  let district = 'Unknown'
  let fiscalYear = 'Unknown'
  let generatedDate = new Date().toLocaleDateString()
  
  // ED279 category allocations
  const allocations: Record<string, number> = {
    regularInstruction: 0,
    specialEducation: 0,
    careerTechnical: 0,
    otherInstruction: 0,
    studentStaffSupport: 0,
    systemAdmin: 0,
    schoolAdmin: 0,
    transportation: 0,
    facilitiesMaint: 0,
    debtService: 0,
    allOther: 0,
  }
  
  // Additional ED279 data
  let totalAllocation = 0
  let localShare = 0
  let stateShare = 0
  let pupilCount = 0
  let milRate = 0
  let adjustedValuation = 0
  
  // Parse ED279 data
  // Look for key patterns in the data
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row) continue
    
    const rowText = row.map(c => String(c || '')).join(' ')
    const rowLower = rowText.toLowerCase()
    
    // Extract district name (usually in header)
    if (i < 5 && district === 'Unknown') {
      for (const cell of row) {
        const cellStr = String(cell || '').trim()
        if (cellStr.length > 10 && !cellStr.match(/^(FY|ED279|Date|Page|Essential)/i)) {
          // Check if it looks like a district name
          if (cellStr.match(/(school|district|rsu|sad|csd|department|unit)/i)) {
            district = cellStr
            break
          }
        }
      }
    }
    
    // Extract fiscal year
    const fyMatch = rowText.match(/FY\s*(\d{2,4})[-\/]?(\d{2,4})?/i) || 
                    rowText.match(/(\d{4})[-\/](\d{2,4})/i)
    if (fyMatch && fiscalYear === 'Unknown') {
      if (fyMatch[2]) {
        fiscalYear = `FY${fyMatch[1].slice(-2)}-${fyMatch[2].slice(-2)}`
      } else {
        fiscalYear = `FY${fyMatch[1]}`
      }
    }
    
    // Look for allocation amounts by category
    // Regular Instruction / Basic Allocation
    if (rowLower.includes('regular') && rowLower.includes('instruction') ||
        rowLower.includes('basic') && rowLower.includes('allocation')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.regularInstruction = amount
    }
    
    // Special Education
    if (rowLower.includes('special') && rowLower.includes('education')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.specialEducation = amount
    }
    
    // Career & Technical Education / CTE
    if (rowLower.includes('career') || rowLower.includes('cte') || 
        rowLower.includes('vocational') || rowLower.includes('technical education')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.careerTechnical = amount
    }
    
    // Transportation
    if (rowLower.includes('transport') && !rowLower.includes('total')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.transportation = amount
    }
    
    // System Administration / Central Office
    if ((rowLower.includes('system') && rowLower.includes('admin')) ||
        rowLower.includes('central office') || rowLower.includes('superintendent')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.systemAdmin = amount
    }
    
    // School Administration
    if (rowLower.includes('school') && rowLower.includes('admin') && 
        !rowLower.includes('system')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.schoolAdmin = amount
    }
    
    // Facilities / Operations & Maintenance
    if (rowLower.includes('facilities') || rowLower.includes('maintenance') ||
        rowLower.includes('operations') || rowLower.includes('o&m')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.facilitiesMaint = amount
    }
    
    // Student & Staff Support / Guidance / Support Services
    if ((rowLower.includes('student') && rowLower.includes('support')) ||
        rowLower.includes('guidance') || rowLower.includes('staff support') ||
        rowLower.includes('support services')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.studentStaffSupport = amount
    }
    
    // Debt Service
    if (rowLower.includes('debt') && rowLower.includes('service')) {
      const amount = findAmountInRow(row)
      if (amount > 0) allocations.debtService = amount
    }
    
    // Total Allocation / Operating Allocation
    if ((rowLower.includes('total') && rowLower.includes('allocation')) ||
        rowLower.includes('operating allocation') ||
        rowLower.includes('total eps')) {
      const amount = findAmountInRow(row)
      if (amount > 0) totalAllocation = amount
    }
    
    // Local Share / Required Local Contribution
    if (rowLower.includes('local') && (rowLower.includes('share') || rowLower.includes('contribution'))) {
      const amount = findAmountInRow(row)
      if (amount > 0) localShare = amount
    }
    
    // State Share / State Subsidy
    if (rowLower.includes('state') && (rowLower.includes('share') || rowLower.includes('subsidy'))) {
      const amount = findAmountInRow(row)
      if (amount > 0) stateShare = amount
    }
    
    // Pupil Count
    if (rowLower.includes('pupil') && (rowLower.includes('count') || rowLower.includes('enrollment'))) {
      const num = findNumberInRow(row)
      if (num > 0 && num < 50000) pupilCount = num
    }
    
    // Mil Rate
    if (rowLower.includes('mil') && rowLower.includes('rate')) {
      const num = findNumberInRow(row)
      if (num > 0 && num < 100) milRate = num
    }
    
    // State Valuation
    if (rowLower.includes('valuation') || rowLower.includes('assessed')) {
      const amount = findAmountInRow(row)
      if (amount > 1000000) adjustedValuation = amount
    }
  }
  
  // Calculate total if not found
  if (totalAllocation === 0) {
    totalAllocation = Object.values(allocations).reduce((sum, val) => sum + val, 0)
  }
  
  // Build summary rows from allocations
  const summary = Object.entries(allocations)
    .filter(([_, amount]) => amount > 0)
    .map(([key, amount]) => ({
      category: EPS_CATEGORIES[key] || key,
      epsAllocation: amount,
      percentOfTotal: totalAllocation > 0 ? (amount / totalAllocation) * 100 : 0,
    }))
    .sort((a, b) => b.epsAllocation - a.epsAllocation)

  return {
    success: true,
    data: {
      reportType: 'ED279 - EPS Allocation',
      district,
      fiscalYear,
      generatedDate,
      ed279: {
        allocations,
        totalAllocation,
        localShare,
        stateShare,
        pupilCount,
        milRate,
        adjustedValuation,
        perPupilAllocation: pupilCount > 0 ? totalAllocation / pupilCount : 0,
      },
      summary,
      details: [],
      totals: {
        budget: totalAllocation,
        actual: 0,
        encumbered: 0,
        available: totalAllocation,
      },
    },
  }
}

function parseTrioReport(workbook: XLSX.WorkBook) {
  let reportType = 'Trio Financial Report'
  let district = 'Unknown'
  let fiscalYear = 'Unknown'
  let generatedDate = 'Unknown'
  const summary: any[] = []
  const details: any[] = []

  const sheetNames = workbook.SheetNames

  // Try Comparative Financial Statement format first
  if (sheetNames.includes('Summary') && sheetNames.includes('Detail')) {
    // Parse Summary sheet for metadata
    const summarySheet = workbook.Sheets['Summary']
    const summaryData = XLSX.utils.sheet_to_json<string[]>(summarySheet, { header: 1 })
    
    reportType = 'Comparative Financial Statement'
    
    // Extract district name from first cell
    if (summaryData[0] && summaryData[0][0]) {
      district = String(summaryData[0][0]).trim()
    }

    // Extract metadata from the description row
    for (const row of summaryData) {
      const rowStr = row.join(' ')
      
      const fyMatch = rowStr.match(/FY(\d{2})-(\d{2})/i)
      if (fyMatch) {
        fiscalYear = `FY${fyMatch[1]}-${fyMatch[2]}`
      }
      
      const dateMatch = rowStr.match(/Created On:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
      if (dateMatch) {
        generatedDate = dateMatch[1]
      }
    }

    // Parse Summary rows
    let foundHeader = false
    for (const row of summaryData) {
      if (!row || row.length < 5) continue
      
      const firstCell = String(row[0] || '').trim()
      
      if (firstCell === 'Budget Category') {
        foundHeader = true
        continue
      }
      
      if (!foundHeader) continue
      
      const categoryMatch = firstCell.match(/^(\d{2})\s+(.+)/)
      if (categoryMatch) {
        const budget = parseNumber(row[1])
        const actual = parseNumber(row[2])
        const encumbered = parseNumber(row[3])
        const available = parseNumber(row[4])
        
        if (budget < 0) continue // Skip revenue rows
        
        summary.push({
          category: firstCell,
          budget,
          actual,
          encumbered,
          available,
          percentSpent: budget > 0 ? (actual / budget) * 100 : 0,
        })
      }
    }

    // Parse Detail sheet
    const detailSheet = workbook.Sheets['Detail']
    const detailData = XLSX.utils.sheet_to_json<string[]>(detailSheet, { header: 1 })

    let headerRowIndex = -1
    for (let i = 0; i < detailData.length; i++) {
      const row = detailData[i]
      if (row && row.some(cell => String(cell).includes('Account Code'))) {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex >= 0) {
      for (let i = headerRowIndex + 1; i < detailData.length; i++) {
        const row = detailData[i]
        if (!row || row.length < 6) continue

        const accountCode = String(row[0] || '').trim()
        
        if (!accountCode.match(/^\d{4}-\d{4}-\d{4}-\d{4}-\d{3}$/)) continue

        const parts = accountCode.split('-')
        const budget = parseNumber(row[2])
        const actual = parseNumber(row[3])
        const encumbered = parseNumber(row[4])
        const available = parseNumber(row[5])

        details.push({
          accountCode,
          description: String(row[1] || '').trim(),
          fund: parts[0],
          program: parts[1],
          function: parts[2],
          object: parts[3],
          location: parts[4],
          budget,
          actual,
          encumbered,
          available,
          percentSpent: budget > 0 ? (actual / budget) * 100 : 0,
          epsCategory: FUNCTION_TO_EPS[parts[2]] || 'allOther',
        })
      }
    }
  } else {
    // Try generic format
    const sheet = workbook.Sheets[sheetNames[0]]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i]
      if (!row) continue
      
      const rowStr = row.join(' ')
      
      if (district === 'Unknown' && row[0] && String(row[0]).length > 3) {
        const firstCell = String(row[0]).trim()
        if (!firstCell.match(/^(FY|Cycle|Account|Budget)/i)) {
          district = firstCell
        }
      }
      
      const fyMatch = rowStr.match(/FY\s*(\d{2})-(\d{2})/i)
      if (fyMatch && fiscalYear === 'Unknown') {
        fiscalYear = `FY${fyMatch[1]}-${fyMatch[2]}`
      }
    }

    for (const row of data) {
      if (!row || row.length < 3) continue
      
      const firstCell = String(row[0] || '').trim()
      
      if (firstCell.match(/^\d{4}-\d{4}-\d{4}-\d{4}-\d{3}$/)) {
        const parts = firstCell.split('-')
        const numbers = row.slice(1).map(parseNumber).filter(n => !isNaN(n))
        
        if (numbers.length >= 2) {
          const budget = numbers[0] || 0
          const actual = numbers[1] || 0
          const encumbered = numbers[2] || 0
          const available = numbers[3] || (budget - actual - encumbered)

          details.push({
            accountCode: firstCell,
            description: String(row[1] || '').trim(),
            fund: parts[0],
            program: parts[1],
            function: parts[2],
            object: parts[3],
            location: parts[4],
            budget,
            actual,
            encumbered,
            available,
            percentSpent: budget > 0 ? (actual / budget) * 100 : 0,
            epsCategory: FUNCTION_TO_EPS[parts[2]] || 'allOther',
          })
        }
      }
    }
  }

  // Generate summary from details if not available
  if (summary.length === 0 && details.length > 0) {
    const byFunction: Record<string, { budget: number, actual: number, encumbered: number }> = {}
    
    for (const row of details.filter(d => d.budget > 0)) {
      const func = row.function
      if (!byFunction[func]) {
        byFunction[func] = { budget: 0, actual: 0, encumbered: 0 }
      }
      byFunction[func].budget += row.budget
      byFunction[func].actual += row.actual
      byFunction[func].encumbered += row.encumbered
    }

    for (const [func, totals] of Object.entries(byFunction)) {
      const available = totals.budget - totals.actual - totals.encumbered
      const functionName = FUNCTION_CODES[func] || `Function ${func}`
      
      summary.push({
        category: `${func} - ${functionName}`,
        budget: totals.budget,
        actual: totals.actual,
        encumbered: totals.encumbered,
        available,
        percentSpent: totals.budget > 0 ? (totals.actual / totals.budget) * 100 : 0,
      })
    }
    
    summary.sort((a, b) => b.budget - a.budget)
  }

  // Calculate totals
  const expenditureDetails = details.filter(d => d.budget > 0)
  const totals = {
    budget: expenditureDetails.reduce((sum, d) => sum + d.budget, 0),
    actual: expenditureDetails.reduce((sum, d) => sum + d.actual, 0),
    encumbered: expenditureDetails.reduce((sum, d) => sum + d.encumbered, 0),
    available: expenditureDetails.reduce((sum, d) => sum + d.available, 0),
  }

  // Generate EPS category mapping from details
  const epsSummary: Record<string, { budget: number, actual: number }> = {}
  for (const row of expenditureDetails) {
    const category = row.epsCategory || 'allOther'
    if (!epsSummary[category]) {
      epsSummary[category] = { budget: 0, actual: 0 }
    }
    epsSummary[category].budget += row.budget
    epsSummary[category].actual += row.actual
  }

  return {
    success: true,
    data: {
      reportType,
      district,
      fiscalYear,
      generatedDate,
      summary,
      details,
      totals,
      epsSummary,
    },
  }
}

function parseStaffingReport(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  
  let district = 'Unknown'
  let fiscalYear = 'Unknown'
  
  const staffing: any[] = []
  
  // Find header row
  let headerRow = -1
  let headers: string[] = []
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row) continue
    
    const rowText = row.map(c => String(c || '').toLowerCase()).join(' ')
    
    if (rowText.includes('position') || rowText.includes('fte') || rowText.includes('employee')) {
      headerRow = i
      headers = row.map(c => String(c || '').trim())
      break
    }
    
    // Extract district/year from early rows
    if (i < 5) {
      const firstCell = String(row[0] || '').trim()
      if (firstCell.length > 10 && district === 'Unknown') {
        if (firstCell.match(/(school|district|rsu|sad|csd)/i)) {
          district = firstCell
        }
      }
      
      const rowStr = row.join(' ')
      const fyMatch = rowStr.match(/FY\s*(\d{2})-(\d{2})/i)
      if (fyMatch && fiscalYear === 'Unknown') {
        fiscalYear = `FY${fyMatch[1]}-${fyMatch[2]}`
      }
    }
  }
  
  // Parse staffing rows
  if (headerRow >= 0) {
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length < 2) continue
      
      const record: any = {}
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = row[j]
      }
      
      if (Object.values(record).some(v => v !== undefined && v !== '')) {
        staffing.push(record)
      }
    }
  }
  
  // Calculate FTE totals
  let totalFTE = 0
  for (const record of staffing) {
    const fteKey = Object.keys(record).find(k => k.toLowerCase().includes('fte'))
    if (fteKey) {
      const fte = parseNumber(record[fteKey])
      if (!isNaN(fte)) totalFTE += fte
    }
  }

  return {
    success: true,
    data: {
      reportType: 'Staffing Report',
      district,
      fiscalYear,
      generatedDate: new Date().toLocaleDateString(),
      staffing,
      totalFTE,
      positionCount: staffing.length,
      summary: [],
      details: [],
      totals: { budget: 0, actual: 0, encumbered: 0, available: 0 },
    },
  }
}

function findAmountInRow(row: any[]): number {
  for (let i = row.length - 1; i >= 0; i--) {
    const val = row[i]
    if (val === null || val === undefined) continue
    
    const num = parseNumber(val)
    if (num > 1000) { // Assume budget amounts are > $1000
      return num
    }
  }
  return 0
}

function findNumberInRow(row: any[]): number {
  for (let i = row.length - 1; i >= 0; i--) {
    const val = row[i]
    if (val === null || val === undefined) continue
    
    const num = parseNumber(val)
    if (num > 0) {
      return num
    }
  }
  return 0
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '').trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }
  return 0
}
