export type SyncEntity =
  | 'customer'
  | 'sale_order'
  | 'outbound'
  | 'return'
  | 'payment'
  | 'invoice'

export type SyncRunStatus = 'running' | 'success' | 'failed' | 'skipped_no_perm'

export interface AppConfigPublic {
  serverUrl: string
  acctId: string
  username: string
  hasPassword: boolean
  companyName: string
  companyShortName: string
  companyAddress: string
  companyPhone: string
  preparerName: string
  language: number
}

export interface AppConfigSaveInput {
  serverUrl: string
  acctId: string
  username: string
  password?: string
  clearPassword?: boolean
  companyName: string
  companyShortName: string
  companyAddress: string
  companyPhone: string
  preparerName: string
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  kickedHint?: boolean
}

export interface SyncProgress {
  entity: SyncEntity
  status: SyncRunStatus
  rowCount: number
  message: string
  finishedAt?: string
}

export interface SyncStartInput {
  sinceDate: string
}

export interface CustomerOption {
  fid: number
  fnumber: string
  fname: string
  address?: string
}

export interface StatementPreviewQuery {
  customerFid: number
  fromMonth: string
  toMonth: string
}

export interface StatementLine {
  date: string
  deliveryNo: string
  purchaseOrderNo: string
  salesOrderNo: string
  materialNumber: string
  materialName: string
  unit: string
  qty: number
  price: number
  amount: number
  remark?: string
  remark2?: string
  source: 'kingdee' | 'manual'
}

export interface MonthFooter {
  month: string
  statementAmount: number
  paidAmount: number
  unpaidAmount: number
  invoicedAmount: number
  uninvoicedAmount: number
  note?: string
  paidSource: 'manual' | 'kingdee_hint'
  invoicedSource: 'manual' | 'kingdee_hint'
}

export interface StatementSheet {
  monthLabel: string
  monthKey: string
  lines: StatementLine[]
  totalAmount: number
  footer: MonthFooter
  cumulative: MonthFooter[]
}

export interface StatementDTO {
  companyName: string
  companyAddress: string
  companyPhone: string
  customerName: string
  customerAddress: string
  preparerName: string
  sheets: StatementSheet[]
}

export interface UpdateStatus {
  checking: boolean
  available: boolean
  version?: string
  releaseNotes?: string
  downloading: boolean
  progress?: number
  error?: string
}

export interface AppInfo {
  version: string
  productName: string
  userDataPath: string
}
