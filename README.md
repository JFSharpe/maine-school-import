# Maine School Financial Import Tool

A comprehensive tool for importing and parsing Maine school district financial data from various sources.

## Supported Report Types

### ED279 / EPS Allocation Reports
- State Essential Programs and Services (EPS) allocation data
- Local and state share breakdowns
- Per-pupil allocation calculations
- Mil rate and valuation data

### Trio Financial Reports
- Comparative Financial Statements
- Budget vs Actual reports
- Line-item detail with account codes
- Auto-mapping to EPS categories

### Staffing Reports
- Position and FTE data
- Employee listings
- Staffing summaries

## Features

- **Auto-Detection**: Automatically identifies report type based on content
- **EPS Category Mapping**: Maps Trio function codes to ED279 categories
- **Visual Dashboard**: Clear summary with status indicators
- **Export to JSON**: For direct import into Maine School Budget Analysis Tool

## Account Code Structure

Maine schools use the standard accounting format:

```
Fund-Program-Function-Object-Location
1000-1100-1000-1010-010
```

| Segment | Description |
|---------|-------------|
| Fund | 1000 = General Fund |
| Program | 1100 = Elementary, 1200 = Secondary, etc. |
| Function | 1000 = Instruction, 2700 = Transportation, etc. |
| Object | 1010 = Teacher Salaries, 2110 = Health Insurance, etc. |
| Location | 010 = School site, 000 = District-wide |

## EPS Category Mapping

| Function Codes | EPS Category |
|---------------|--------------|
| 1000 | Regular Instruction |
| 2110-2230 | Student & Staff Support |
| 2310-2330, 2500 | System Administration |
| 2400 | School Administration |
| 2600-2690 | Facilities Maintenance |
| 2700-2750 | Transportation |
| 5100 | Debt Service |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in Vercel
3. Deploy

### Local Development

```bash
npm install
npm run dev
```

## Integration

The JSON export format is designed for direct import into the Maine School Budget Analysis Tool, enabling:

- ED279 vs Actual budget comparison
- EPS allocation analysis
- Spending trend tracking
- Cross-district benchmarking

## Maine School Board Academy

This tool is part of the Maine School Board Academy's suite of financial oversight tools, designed to help school board members:

- Eliminate manual data entry
- Import data directly from Trio exports
- Compare budgets to state EPS allocations
- Track spending throughout the year

## Future Enhancements

- Direct integration with Maine School Budget Analysis Tool
- Additional report format support
- Automated ED279 data retrieval from Maine DOE
- Multi-year trend analysis
