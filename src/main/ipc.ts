import { ipcMain, shell } from 'electron'
import { getPublicConfig, saveConfig } from './configStore'
import { getKingdee } from './kingdee/client'
import { getDb } from './db'
import { runSync, listCustomers } from './sync/runner'
import { buildStatement } from './domain/statement'
import { exportStatementXlsx } from './export/excel'
import {
  checkForUpdatesManual,
  downloadUpdate,
  getUpdateStatus,
  quitAndInstall
} from './updater'
import type { AppConfigSaveInput, StatementPreviewQuery, SyncStartInput } from '../shared/types'
import { app } from 'electron'
import { getUserRoots } from './paths'

export function registerIpc() {
  getDb()

  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    productName: '衡账',
    userDataPath: getUserRoots().root
  }))

  ipcMain.handle('config:get', () => getPublicConfig())
  ipcMain.handle('config:save', (_e, input: AppConfigSaveInput) => saveConfig(input))
  ipcMain.handle('config:test', async () => {
    const client = getKingdee()
    const login = await client.login()
    if (!login.ok) return { ok: false, message: login.message }
    const probe = await client.probeOutboundSample()
    return probe
  })

  ipcMain.handle('sync:run', async (_e, input: SyncStartInput) => runSync(input))
  ipcMain.handle('customers:list', () => listCustomers())

  ipcMain.handle('statement:preview', (_e, q: StatementPreviewQuery) =>
    buildStatement(q.customerFid, q.fromMonth, q.toMonth)
  )

  ipcMain.handle('export:xlsx', async (_e, q: StatementPreviewQuery) => {
    const dto = buildStatement(q.customerFid, q.fromMonth, q.toMonth)
    const path = await exportStatementXlsx(dto)
    return { path }
  })

  ipcMain.handle('shell:showItem', (_e, filePath: string) => shell.showItemInFolder(filePath))
  ipcMain.handle('shell:openPath', (_e, filePath: string) => shell.openPath(filePath))

  ipcMain.handle('updater:status', () => getUpdateStatus())
  ipcMain.handle('updater:check', () => checkForUpdatesManual())
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:install', () => {
    quitAndInstall()
  })
}
