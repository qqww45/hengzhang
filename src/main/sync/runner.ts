import { BrowserWindow } from 'electron'
import { getDb } from '../db'
import { getKingdee } from '../kingdee/client'
import { tryAcquire, release } from '../businessLock'
import type { SyncEntity, SyncProgress, SyncStartInput } from '../../shared/types'

function emit(progress: SyncProgress) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('sync:progress', progress)
  }
}

function nowIso() {
  return new Date().toISOString()
}

async function syncCustomers(sinceDate: string): Promise<SyncProgress> {
  const client = getKingdee()
  const db = getDb()
  const started = nowIso()
  db.prepare(
    `INSERT INTO sync_run(entity, status, row_count, message, started_at) VALUES(?,?,?,?,?)`
  ).run('customer', 'running', 0, '', started)

  try {
    const fieldKeys = 'FCUSTID,FNumber,FName,FADDRESS,FForbidStatus'
    let start = 0
    let total = 0
    const upsert = db.prepare(`
      INSERT INTO customer(fid, fnumber, fname, address, disabled, sync_at)
      VALUES(@fid, @fnumber, @fname, @address, @disabled, @sync_at)
      ON CONFLICT(fid) DO UPDATE SET
        fnumber=excluded.fnumber,
        fname=excluded.fname,
        address=excluded.address,
        disabled=excluded.disabled,
        sync_at=excluded.sync_at
    `)

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await client.executeBillQuery({
        FormId: 'BD_Customer',
        FieldKeys: fieldKeys,
        FilterString: sinceDate ? '' : '',
        StartRow: start,
        Limit: 2000
      })
      const tx = db.transaction((batch: unknown[][]) => {
        for (const r of batch) {
          upsert.run({
            fid: Number(r[0]),
            fnumber: String(r[1] ?? ''),
            fname: String(r[2] ?? ''),
            address: String(r[3] ?? ''),
            disabled: String(r[4] ?? '') === 'B' ? 1 : 0,
            sync_at: nowIso()
          })
        }
      })
      tx(rows)
      total += rows.length
      if (rows.length < 2000) break
      start += 2000
    }

    const finished = nowIso()
    db.prepare(
      `UPDATE sync_run SET status=?, row_count=?, message=?, finished_at=? WHERE entity=? AND started_at=?`
    ).run('success', total, 'ok', finished, 'customer', started)

    return {
      entity: 'customer',
      status: 'success',
      rowCount: total,
      message: `客户 ${total} 条`,
      finishedAt: finished
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status: SyncProgress['status'] =
      /权限|permission|denied|无权限/i.test(msg) ? 'skipped_no_perm' : 'failed'
    db.prepare(
      `UPDATE sync_run SET status=?, message=?, finished_at=? WHERE entity=? AND started_at=?`
    ).run(status, msg, nowIso(), 'customer', started)
    return { entity: 'customer', status, rowCount: 0, message: msg, finishedAt: nowIso() }
  }
}

/** 出库/订单完整字段以 M0 映射为准；此处先落可运行骨架，用保守 FieldKeys */
async function syncOutbound(sinceDate: string): Promise<SyncProgress> {
  const client = getKingdee()
  const db = getDb()
  const started = nowIso()
  db.prepare(
    `INSERT INTO sync_run(entity, status, row_count, message, started_at) VALUES(?,?,?,?,?)`
  ).run('outbound', 'running', 0, '', started)

  try {
    const filter = sinceDate ? `FDate>='${sinceDate}'` : ''
    const fieldKeys =
      'FID,FBillNo,FDate,FCustomerID,FCustomerID.FName,FDocumentStatus,FCancelStatus'
    let start = 0
    let total = 0
    const upsert = db.prepare(`
      INSERT INTO outbound(fid, fbillno, fdate, customer_fid, customer_name, amount_cents, status, cancelled, sync_at)
      VALUES(@fid, @fbillno, @fdate, @customer_fid, @customer_name, 0, @status, @cancelled, @sync_at)
      ON CONFLICT(fid) DO UPDATE SET
        fbillno=excluded.fbillno,
        fdate=excluded.fdate,
        customer_fid=excluded.customer_fid,
        customer_name=excluded.customer_name,
        status=excluded.status,
        cancelled=excluded.cancelled,
        sync_at=excluded.sync_at
    `)

    while (true) {
      const rows = await client.executeBillQuery({
        FormId: 'SAL_OUTSTOCK',
        FieldKeys: fieldKeys,
        FilterString: filter,
        OrderString: 'FDate ASC',
        StartRow: start,
        Limit: 2000
      })
      const tx = db.transaction((batch: unknown[][]) => {
        for (const r of batch) {
          upsert.run({
            fid: Number(r[0]),
            fbillno: String(r[1] ?? ''),
            fdate: String(r[2] ?? '').slice(0, 10),
            customer_fid: Number(r[3] ?? 0),
            customer_name: String(r[4] ?? ''),
            status: String(r[5] ?? ''),
            cancelled: String(r[6] ?? '') === 'B' ? 1 : 0,
            sync_at: nowIso()
          })
        }
      })
      tx(rows)
      total += rows.length
      if (rows.length < 2000) break
      start += 2000
    }

    const finished = nowIso()
    db.prepare(
      `UPDATE sync_run SET status=?, row_count=?, message=?, finished_at=? WHERE entity=? AND started_at=?`
    ).run('success', total, '头表已同步；分录字段待 M0 映射补齐', finished, 'outbound', started)

    return {
      entity: 'outbound',
      status: 'success',
      rowCount: total,
      message: `出库头 ${total} 条（明细行待映射）`,
      finishedAt: finished
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status: SyncProgress['status'] =
      /权限|permission|denied|无权限/i.test(msg) ? 'skipped_no_perm' : 'failed'
    db.prepare(
      `UPDATE sync_run SET status=?, message=?, finished_at=? WHERE entity=? AND started_at=?`
    ).run(status, msg, nowIso(), 'outbound', started)
    return { entity: 'outbound', status, rowCount: 0, message: msg, finishedAt: nowIso() }
  }
}

async function syncSaleOrders(sinceDate: string): Promise<SyncProgress> {
  const client = getKingdee()
  const db = getDb()
  const started = nowIso()
  db.prepare(
    `INSERT INTO sync_run(entity, status, row_count, message, started_at) VALUES(?,?,?,?,?)`
  ).run('sale_order', 'running', 0, '', started)

  try {
    const filter = sinceDate ? `FDate>='${sinceDate}'` : ''
    const fieldKeys = 'FID,FBillNo,FDate,FCustId,FCustId.FName,FDocumentStatus'
    let start = 0
    let total = 0
    const upsert = db.prepare(`
      INSERT INTO sale_order(fid, fbillno, fdate, customer_fid, customer_name, amount_cents, status, sync_at)
      VALUES(@fid, @fbillno, @fdate, @customer_fid, @customer_name, 0, @status, @sync_at)
      ON CONFLICT(fid) DO UPDATE SET
        fbillno=excluded.fbillno,
        fdate=excluded.fdate,
        customer_fid=excluded.customer_fid,
        customer_name=excluded.customer_name,
        status=excluded.status,
        sync_at=excluded.sync_at
    `)

    while (true) {
      const rows = await client.executeBillQuery({
        FormId: 'SAL_SaleOrder',
        FieldKeys: fieldKeys,
        FilterString: filter,
        OrderString: 'FDate ASC',
        StartRow: start,
        Limit: 2000
      })
      const tx = db.transaction((batch: unknown[][]) => {
        for (const r of batch) {
          upsert.run({
            fid: Number(r[0]),
            fbillno: String(r[1] ?? ''),
            fdate: String(r[2] ?? '').slice(0, 10),
            customer_fid: Number(r[3] ?? 0),
            customer_name: String(r[4] ?? ''),
            status: String(r[5] ?? ''),
            sync_at: nowIso()
          })
        }
      })
      tx(rows)
      total += rows.length
      if (rows.length < 2000) break
      start += 2000
    }

    const finished = nowIso()
    db.prepare(
      `UPDATE sync_run SET status=?, row_count=?, message=?, finished_at=? WHERE entity=? AND started_at=?`
    ).run('success', total, 'ok', finished, 'sale_order', started)

    return {
      entity: 'sale_order',
      status: 'success',
      rowCount: total,
      message: `订单头 ${total} 条`,
      finishedAt: finished
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status: SyncProgress['status'] =
      /权限|permission|denied|无权限/i.test(msg) ? 'skipped_no_perm' : 'failed'
    db.prepare(
      `UPDATE sync_run SET status=?, message=?, finished_at=? WHERE entity=? AND started_at=?`
    ).run(status, msg, nowIso(), 'sale_order', started)
    return { entity: 'sale_order', status, rowCount: 0, message: msg, finishedAt: nowIso() }
  }
}

export async function runSync(input: SyncStartInput): Promise<SyncProgress[]> {
  if (!tryAcquire('sync')) {
    throw new Error('已有同步或其它任务进行中')
  }
  const results: SyncProgress[] = []
  try {
    const login = await getKingdee().login()
    if (!login.ok) throw new Error(login.message)

    const order: SyncEntity[] = ['customer', 'sale_order', 'outbound']
    for (const entity of order) {
      emit({ entity, status: 'running', rowCount: 0, message: '同步中…' })
      let progress: SyncProgress
      if (entity === 'customer') progress = await syncCustomers(input.sinceDate)
      else if (entity === 'sale_order') progress = await syncSaleOrders(input.sinceDate)
      else progress = await syncOutbound(input.sinceDate)
      results.push(progress)
      emit(progress)
    }
    return results
  } finally {
    release('sync')
  }
}

export function listCustomers() {
  const db = getDb()
  return db
    .prepare(
      `SELECT fid, fnumber, fname, address FROM customer WHERE disabled = 0 ORDER BY fname COLLATE NOCASE`
    )
    .all()
}
