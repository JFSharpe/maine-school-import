'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, BarChart3, DollarSign, Users, TrendingUp, FileText, PieChart, Building2 } from 'lucide-react'

interface ParsedData {
  reportType: string
  district: string
  fiscalYear: string
  generatedDate: string
  summary: SummaryRow[]
  details: DetailRow[]
  totals: {
    budget: number
    actual: number
    encumbered: number
    available: number
  }
  ed279?: ED279Data
  epsSummary?: Record<string, { budget: number; actual: number }>
  staffing?: any[]
  totalFTE?: number
  positionCount?: number
}

interface ED279Data {
  allocations: Record<string, number>
  totalAllocation: number
  localShare: number
  stateShare: number
  pupilCount: number
  milRate: number
  adjustedValuation: number
  perPupilAllocation: number
}

interface SummaryRow {
  category: string
  budget?: number
  actual?: number
  encumbered?: number
  available?: number
  percentSpent?: number
  epsAllocation?: number
  percentOfTotal?: number
}

interface DetailRow {
  accountCode: string
  description: string
  fund: string
  program: string
  function: string
  object: string
  location: string
  budget: number
  actual: number
  encumbered: number
  available: number
  percentSpent: number
  epsCategory?: string
}

const REPORT_TYPES = [
  { id: 'auto', name: 'Auto-Detect', description: 'Automatically detect report type', icon: FileSpreadsheet },
  { id: 'ed279', name: 'ED279 / EPS Allocation', description: 'State subsidy and EPS data', icon: Building2 },
  { id: 'trio', name: 'Trio Budget Report', description: 'Comparative Financial Statement', icon: BarChart3 },
  { id: 'staffing', name: 'Staffing Report', description: 'FTE and position data', icon: Users },
]

const EPS_CATEGORY_NAMES: Record<string, string> = {
  regularInstruction: 'Regular Instruction',
  specialEducation: 'Special Education',
  careerTechnical: 'Career & Technical Education',
  otherInstruction: 'Other Instruction',
  studentStaffSupport: 'Student & Staff Support',
  systemAdmin: 'System Administration',
  schoolAdmin: 'School Administration',
  transportation: 'Transportation & Buses',
  facilitiesMaint: 'Facilities Maintenance',
  debtService: 'Debt Service',
  allOther: 'All Other Expenditures',
}

export default function MaineSchoolImport() {
  const [file, setFile] = useState<File | null>(null)
  const [reportType, setReportType] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ParsedData | null>(null)
  const [activeTab, setActiveTab] = useState<string>('summary')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile)
      setError(null)
      setData(null)
    } else {
      setError('Please upload an Excel file (.xlsx or .xls)')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setData(null)
    }
  }

  const parseFile = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('reportType', reportType)

      const response = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setData(result.data)
        // Set appropriate default tab based on report type
        if (result.data.ed279) {
          setActiveTab('ed279')
        } else if (result.data.staffing && result.data.staffing.length > 0) {
          setActiveTab('staffing')
        } else {
          setActiveTab('summary')
        }
      } else {
        setError(result.error || 'Failed to parse file')
      }
    } catch (err) {
      setError('Failed to parse file. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const exportJSON = () => {
    if (!data) return
    
    const exportData = {
      metadata: {
        district: data.district,
        fiscalYear: data.fiscalYear,
        reportType: data.reportType,
        generatedDate: data.generatedDate,
        exportedAt: new Date().toISOString(),
        exportedFrom: 'Maine School Financial Import Tool',
      },
      ed279: data.ed279 || null,
      summary: data.summary,
      details: data.details,
      totals: data.totals,
      epsSummary: data.epsSummary || null,
      staffing: data.staffing || null,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.district.replace(/\s+/g, '_')}_${data.fiscalYear}_import.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const getStatusColor = (percentSpent: number, available: number) => {
    if (available < 0) return 'text-red-400'
    if (percentSpent > 90) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getStatusIcon = (percentSpent: number, available: number) => {
    if (available < 0) return <AlertCircle className="w-4 h-4 text-red-400" />
    if (percentSpent > 90) return <AlertCircle className="w-4 h-4 text-yellow-400" />
    return <CheckCircle className="w-4 h-4 text-green-400" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold text-cyan-400">Maine School Financial Import</h1>
              <p className="text-slate-400 text-sm">Maine School Board Academy • Import ED279, Trio, & Staffing Reports</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Section */}
        {!data && (
          <div className="mb-8">
            <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4 mb-6">
              <p className="text-cyan-300">
                <strong className="text-cyan-400">Supported Reports:</strong> ED279/EPS Allocations, 
                Trio Comparative Financial Statements, Budget vs Actual reports, and Staffing reports. 
                Export from your software and upload the Excel file.
              </p>
            </div>

            {/* Report Type Selection */}
            <div className="mb-6">
              <label className="block text-slate-300 font-medium mb-3">Report Type</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {REPORT_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => setReportType(type.id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        reportType === type.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${reportType === type.id ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <p className={`font-medium ${reportType === type.id ? 'text-cyan-400' : 'text-slate-300'}`}>
                        {type.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{type.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-cyan-500/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-lg text-slate-300 mb-2">Drop your Excel file here</p>
              <p className="text-slate-500">or click to browse</p>
              <input
                id="fileInput"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {file && (
              <div className="mt-4 flex items-center justify-between bg-slate-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
                  <div>
                    <p className="text-slate-200 font-medium">{file.name}</p>
                    <p className="text-slate-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={parseFile}
                  disabled={loading}
                  className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4" />
                      Import Data
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {data && (
          <div>
            {/* District Header */}
            <div className="bg-slate-800 rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-cyan-500/20 text-cyan-400 text-xs font-medium px-2 py-1 rounded">
                      {data.reportType}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{data.district}</h2>
                  <p className="text-slate-400">{data.fiscalYear}</p>
                  <p className="text-slate-500 text-sm">Generated: {data.generatedDate}</p>
                </div>
                <button
                  onClick={() => {
                    setData(null)
                    setFile(null)
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Upload New File
                </button>
              </div>

              {/* Stats Grid - Different based on report type */}
              {data.ed279 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Total EPS Allocation</span>
                    </div>
                    <p className="text-xl font-bold text-white">{formatCurrency(data.ed279.totalAllocation)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <Building2 className="w-4 h-4" />
                      <span className="text-sm">State Share</span>
                    </div>
                    <p className="text-xl font-bold text-cyan-400">{formatCurrency(data.ed279.stateShare)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">Local Share</span>
                    </div>
                    <p className="text-xl font-bold text-yellow-400">{formatCurrency(data.ed279.localShare)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Per Pupil</span>
                    </div>
                    <p className="text-xl font-bold text-green-400">
                      {data.ed279.pupilCount > 0 ? formatCurrency(data.ed279.perPupilAllocation) : 'N/A'}
                    </p>
                  </div>
                </div>
              ) : data.staffing && data.staffing.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Total Positions</span>
                    </div>
                    <p className="text-xl font-bold text-white">{data.positionCount}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-sm">Total FTE</span>
                    </div>
                    <p className="text-xl font-bold text-cyan-400">{data.totalFTE?.toFixed(2)}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Total Budget</span>
                    </div>
                    <p className="text-xl font-bold text-white">{formatCurrency(data.totals.budget)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">YTD Actual</span>
                    </div>
                    <p className="text-xl font-bold text-cyan-400">{formatCurrency(data.totals.actual)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Encumbered</span>
                    </div>
                    <p className="text-xl font-bold text-yellow-400">{formatCurrency(data.totals.encumbered)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-sm">Available</span>
                    </div>
                    <p className={`text-xl font-bold ${data.totals.available >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(data.totals.available)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.ed279 && (
                <button
                  onClick={() => setActiveTab('ed279')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'ed279'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ED279 Allocations
                </button>
              )}
              {data.summary.length > 0 && (
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'summary'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Summary
                </button>
              )}
              {data.details.length > 0 && (
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'details'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Line Items ({data.details.length})
                </button>
              )}
              {data.epsSummary && Object.keys(data.epsSummary).length > 0 && (
                <button
                  onClick={() => setActiveTab('epsMapping')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'epsMapping'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  EPS Mapping
                </button>
              )}
              {data.staffing && data.staffing.length > 0 && (
                <button
                  onClick={() => setActiveTab('staffing')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'staffing'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Staffing ({data.staffing.length})
                </button>
              )}
              <button
                onClick={() => setActiveTab('export')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'export'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Export
              </button>
            </div>

            {/* ED279 Tab */}
            {activeTab === 'ed279' && data.ed279 && (
              <div className="space-y-6">
                {/* ED279 Summary Cards */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Funding Sources</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">State Share</span>
                        <span className="text-cyan-400 font-medium">{formatCurrency(data.ed279.stateShare)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Local Share</span>
                        <span className="text-yellow-400 font-medium">{formatCurrency(data.ed279.localShare)}</span>
                      </div>
                      <div className="border-t border-slate-700 pt-3 flex justify-between">
                        <span className="text-white font-medium">Total Allocation</span>
                        <span className="text-white font-bold">{formatCurrency(data.ed279.totalAllocation)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Enrollment & Valuation</h3>
                    <div className="space-y-3">
                      {data.ed279.pupilCount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pupil Count</span>
                          <span className="text-white font-medium">{formatNumber(data.ed279.pupilCount)}</span>
                        </div>
                      )}
                      {data.ed279.perPupilAllocation > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Per Pupil</span>
                          <span className="text-green-400 font-medium">{formatCurrency(data.ed279.perPupilAllocation)}</span>
                        </div>
                      )}
                      {data.ed279.milRate > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Mil Rate</span>
                          <span className="text-white font-medium">{data.ed279.milRate.toFixed(2)}</span>
                        </div>
                      )}
                      {data.ed279.adjustedValuation > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">State Valuation</span>
                          <span className="text-white font-medium">{formatCurrency(data.ed279.adjustedValuation)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">State vs Local Split</h3>
                    <div className="relative pt-4">
                      {data.ed279.totalAllocation > 0 && (
                        <>
                          <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
                            <div 
                              className="bg-cyan-500"
                              style={{ width: `${(data.ed279.stateShare / data.ed279.totalAllocation) * 100}%` }}
                            />
                            <div 
                              className="bg-yellow-500"
                              style={{ width: `${(data.ed279.localShare / data.ed279.totalAllocation) * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-2 text-sm">
                            <span className="text-cyan-400">
                              State: {((data.ed279.stateShare / data.ed279.totalAllocation) * 100).toFixed(1)}%
                            </span>
                            <span className="text-yellow-400">
                              Local: {((data.ed279.localShare / data.ed279.totalAllocation) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* EPS Category Allocations */}
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">EPS Category Allocations</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700">
                        <tr>
                          <th className="text-left text-slate-300 font-medium px-4 py-3">Category</th>
                          <th className="text-right text-slate-300 font-medium px-4 py-3">EPS Allocation</th>
                          <th className="text-right text-slate-300 font-medium px-4 py-3">% of Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {data.summary.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3 text-white font-medium">{row.category}</td>
                            <td className="px-4 py-3 text-right text-cyan-400 font-medium">
                              {formatCurrency(row.epsAllocation || 0)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              {(row.percentOfTotal || 0).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && data.summary.length > 0 && (
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="text-left text-slate-300 font-medium px-4 py-3">Category</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Budget</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Actual</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Encumbered</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Available</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">% Spent</th>
                        <th className="text-center text-slate-300 font-medium px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {data.summary.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/50">
                          <td className="px-4 py-3 text-white font-medium">{row.category}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(row.budget || 0)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(row.actual || 0)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(row.encumbered || 0)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${getStatusColor(row.percentSpent || 0, row.available || 0)}`}>
                            {formatCurrency(row.available || 0)}
                          </td>
                          <td className={`px-4 py-3 text-right ${getStatusColor(row.percentSpent || 0, row.available || 0)}`}>
                            {(row.percentSpent || 0).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusIcon(row.percentSpent || 0, row.available || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Details Tab */}
            {activeTab === 'details' && data.details.length > 0 && (
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full">
                    <thead className="bg-slate-700 sticky top-0">
                      <tr>
                        <th className="text-left text-slate-300 font-medium px-4 py-3">Account Code</th>
                        <th className="text-left text-slate-300 font-medium px-4 py-3">Description</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Budget</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Actual</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Available</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {data.details.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/50">
                          <td className="px-4 py-2 text-cyan-400 font-mono text-sm">{row.accountCode}</td>
                          <td className="px-4 py-2 text-slate-300 text-sm">{row.description}</td>
                          <td className="px-4 py-2 text-right text-slate-300 text-sm">{formatCurrency(row.budget)}</td>
                          <td className="px-4 py-2 text-right text-slate-300 text-sm">{formatCurrency(row.actual)}</td>
                          <td className={`px-4 py-2 text-right text-sm ${getStatusColor(row.percentSpent, row.available)}`}>
                            {formatCurrency(row.available)}
                          </td>
                          <td className={`px-4 py-2 text-right text-sm ${getStatusColor(row.percentSpent, row.available)}`}>
                            {row.percentSpent.toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.details.length > 100 && (
                  <div className="bg-slate-700/50 px-4 py-2 text-slate-400 text-sm text-center">
                    Showing first 100 of {data.details.length} line items. Export for full data.
                  </div>
                )}
              </div>
            )}

            {/* EPS Mapping Tab */}
            {activeTab === 'epsMapping' && data.epsSummary && (
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">Budget Mapped to EPS Categories</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Actual budget amounts mapped to ED279/EPS categories for comparison
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="text-left text-slate-300 font-medium px-4 py-3">EPS Category</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Budgeted</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">YTD Actual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {Object.entries(data.epsSummary)
                        .sort(([, a], [, b]) => b.budget - a.budget)
                        .map(([category, values]) => (
                          <tr key={category} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3 text-white font-medium">
                              {EPS_CATEGORY_NAMES[category] || category}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300">
                              {formatCurrency(values.budget)}
                            </td>
                            <td className="px-4 py-3 text-right text-cyan-400">
                              {formatCurrency(values.actual)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Staffing Tab */}
            {activeTab === 'staffing' && data.staffing && data.staffing.length > 0 && (
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full">
                    <thead className="bg-slate-700 sticky top-0">
                      <tr>
                        {Object.keys(data.staffing[0]).slice(0, 6).map((key) => (
                          <th key={key} className="text-left text-slate-300 font-medium px-4 py-3">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {data.staffing.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/50">
                          {Object.values(row).slice(0, 6).map((val, i) => (
                            <td key={i} className="px-4 py-2 text-slate-300 text-sm">
                              {String(val || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="bg-slate-800 rounded-xl p-8">
                <h3 className="text-xl font-bold text-white mb-4">Export Options</h3>
                <p className="text-slate-400 mb-6">
                  Export this data for import into the Maine School Budget Analysis Tool.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={exportJSON}
                    className="flex items-center gap-3 bg-slate-700 hover:bg-slate-600 rounded-lg p-4 transition-colors text-left"
                  >
                    <Download className="w-8 h-8 text-cyan-400" />
                    <div>
                      <p className="text-white font-medium">Export as JSON</p>
                      <p className="text-slate-400 text-sm">For import into Budget Analysis Tool</p>
                    </div>
                  </button>
                  
                  <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-4 opacity-50 cursor-not-allowed">
                    <Download className="w-8 h-8 text-slate-500" />
                    <div>
                      <p className="text-slate-400 font-medium">Direct Import</p>
                      <p className="text-slate-500 text-sm">Coming soon - direct integration</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Data Summary</h4>
                  <pre className="text-xs text-slate-400 overflow-auto max-h-48 bg-slate-900 rounded p-3">
{JSON.stringify({
  district: data.district,
  fiscalYear: data.fiscalYear,
  reportType: data.reportType,
  hasED279: !!data.ed279,
  hasBudgetData: data.details.length > 0,
  hasStaffing: data.staffing && data.staffing.length > 0,
  summaryCategories: data.summary.length,
  detailLineItems: data.details.length,
  totals: data.totals,
}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          Maine School Board Academy • Financial Import Tool v1.0 • Import ED279, Trio & Staffing Data
        </div>
      </footer>
    </div>
  )
}
