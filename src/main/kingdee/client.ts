import { getFullAuth } from '../configStore'

type Json = unknown

export class KingdeeClient {
  private cookies = new Map<string, string>()
  private base = ''

  private cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  private absorbSetCookie(res: Response) {
    const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] }
    const list =
      typeof anyHeaders.getSetCookie === 'function'
        ? anyHeaders.getSetCookie()
        : (() => {
            const single = res.headers.get('set-cookie')
            return single ? [single] : []
          })()
    for (const raw of list) {
      const part = raw.split(';')[0]
      const eq = part.indexOf('=')
      if (eq > 0) this.cookies.set(part.slice(0, eq), part.slice(eq + 1))
    }
  }

  async login(): Promise<{ ok: boolean; message: string }> {
    const auth = getFullAuth()
    if (!auth.serverUrl || !auth.acctId || !auth.username || !auth.password) {
      return { ok: false, message: '请先完整填写服务器、账套、账号与密码' }
    }
    this.base = auth.serverUrl.replace(/\/+$/, '')
    this.cookies.clear()
    const url = `${this.base}/K3Cloud/Kingdee.BOS.WebApi.ServicesStub.AuthService.ValidateUser.common.kdsvc`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: [auth.acctId, auth.username, auth.password, auth.language]
        })
      })
      this.absorbSetCookie(res)
      const data = (await res.json()) as { LoginResultType?: number; Message?: string }
      if (data.LoginResultType === 1) {
        return { ok: true, message: '登录成功' }
      }
      return { ok: false, message: data.Message || `登录失败（LoginResultType=${data.LoginResultType}）` }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }

  async executeBillQuery(payload: {
    FormId: string
    FieldKeys: string
    FilterString?: string
    OrderString?: string
    StartRow?: number
    Limit?: number
  }): Promise<Json[][]> {
    const url = `${this.base}/K3Cloud/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.cookieHeader()
      },
      body: JSON.stringify({
        data: {
          FormId: payload.FormId,
          FieldKeys: payload.FieldKeys,
          FilterString: payload.FilterString || '',
          OrderString: payload.OrderString || '',
          StartRow: payload.StartRow ?? 0,
          Limit: payload.Limit ?? 2000
        }
      })
    })
    this.absorbSetCookie(res)
    const data = await res.json()
    if (!Array.isArray(data)) {
      const msg =
        typeof data === 'object' && data && 'Result' in (data as object)
          ? JSON.stringify(data)
          : String(data)
      throw new Error(`查询返回异常: ${msg}`)
    }
    return data as Json[][]
  }

  async probeOutboundSample(): Promise<{ ok: boolean; message: string }> {
    try {
      const rows = await this.executeBillQuery({
        FormId: 'SAL_OUTSTOCK',
        FieldKeys: 'FID,FBillNo,FDate',
        OrderString: 'FDate DESC',
        StartRow: 0,
        Limit: 1
      })
      if (!rows.length) {
        return { ok: true, message: '登录成功，但未查到销售出库单（请确认权限或账套数据）' }
      }
      return { ok: true, message: `连通正常，样例出库单：${rows[0]?.[1] ?? rows[0]?.[0]}` }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }
}

let singleton: KingdeeClient | null = null

export function getKingdee(): KingdeeClient {
  if (!singleton) singleton = new KingdeeClient()
  return singleton
}
