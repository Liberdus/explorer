/**
 * Export test data to JSON/CSV for CLI load testing tools
 */

import * as fs from 'fs'
import * as path from 'path'
import { collectTestData } from './data-collector'

interface ExportedTestData {
  accountIds: string[]
  txIds: string[]
  receiptIds: string[]
  cycleNumbers: number[]
  cycleMarkers: string[]
}

async function exportTestData(): Promise<void> {
  const sampleSize = parseInt(process.argv[2]) || 100000
  const outputDir = path.join(__dirname, '../../benchmark-data')

  console.log(`Exporting ${sampleSize} test data samples...\n`)

  // Collect data
  const testData = await collectTestData(sampleSize)

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Export as JSON
  const jsonData: ExportedTestData = {
    accountIds: testData.accountIds,
    txIds: testData.txIds,
    receiptIds: testData.receiptIds,
    cycleNumbers: testData.cycleNumbers,
    cycleMarkers: testData.cycleMarkers,
  }

  const jsonPath = path.join(outputDir, 'test-data.json')
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2))
  console.log(`\n✓ JSON exported to: ${jsonPath}`)

  // Export as CSV for Artillery
  const accountsCsv = path.join(outputDir, 'accounts.csv')
  const accountsCsvContent = ['accountId', ...testData.accountIds].join('\n')
  fs.writeFileSync(accountsCsv, accountsCsvContent)
  console.log(`✓ Accounts CSV: ${accountsCsv}`)

  const txsCsv = path.join(outputDir, 'transactions.csv')
  const txsCsvContent = ['txId', ...testData.txIds].join('\n')
  fs.writeFileSync(txsCsv, txsCsvContent)
  console.log(`✓ Transactions CSV: ${txsCsv}`)

  const receiptsCsv = path.join(outputDir, 'receipts.csv')
  const receiptsCsvContent = ['receiptId', ...testData.receiptIds].join('\n')
  fs.writeFileSync(receiptsCsv, receiptsCsvContent)
  console.log(`✓ Receipts CSV: ${receiptsCsv}`)

  const cyclesCsv = path.join(outputDir, 'cycles.csv')
  const cyclesCsvContent = ['cycleNumber', ...testData.cycleNumbers].join('\n')
  fs.writeFileSync(cyclesCsv, cyclesCsvContent)
  console.log(`✓ Cycles CSV: ${cyclesCsv}`)

  // Export combined CSV with all data
  const combinedCsv = path.join(outputDir, 'combined.csv')
  const maxLength = Math.max(
    testData.accountIds.length,
    testData.txIds.length,
    testData.receiptIds.length,
    testData.cycleNumbers.length
  )

  const rows = ['accountId,txId,receiptId,cycleNumber']
  for (let i = 0; i < maxLength; i++) {
    rows.push(
      [
        testData.accountIds[i] || '',
        testData.txIds[i] || '',
        testData.receiptIds[i] || '',
        testData.cycleNumbers[i] || '',
      ].join(',')
    )
  }
  fs.writeFileSync(combinedCsv, rows.join('\n'))
  console.log(`✓ Combined CSV: ${combinedCsv}`)

  console.log('\n' + '='.repeat(60))
  console.log('Export Summary:')
  console.log('='.repeat(60))
  console.log(`Total accounts:     ${testData.accountIds.length}`)
  console.log(`Total transactions: ${testData.txIds.length}`)
  console.log(`Total receipts:     ${testData.receiptIds.length}`)
  console.log(`Total cycles:       ${testData.cycleNumbers.length}`)
  console.log(`\nOutput directory:   ${outputDir}`)
  console.log('\nUse these files with:')
  console.log('  - Artillery: artillery run benchmark/artillery-*.yml')
  console.log('  - autocannon: See benchmark/autocannon-cli.sh')
  console.log('='.repeat(60))

  process.exit(0)
}

exportTestData().catch(error => {
  console.error('Export failed:', error)
  process.exit(1)
})
