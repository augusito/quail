import ExcelJS from 'exceljs'

export type ExportColumn<T> = {
  header: string
  get: (doc: T) => unknown
  width?: number
}

export async function buildWorkbookBuffer<T>(
  sheetName: string,
  columns: ExportColumn<T>[],
  docs: T[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31)) // Excel's sheet-name length limit

  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width ?? 24,
  }))
  sheet.getRow(1).font = { bold: true }

  for (const doc of docs) {
    sheet.addRow(Object.fromEntries(columns.map((column) => [column.header, column.get(doc) ?? ''])))
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
