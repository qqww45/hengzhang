# 衡账

金蝶云·星空独立对账桌面工具（Windows）。方案见 `金蝶星空-独立对账桌面工具-方案说明.md`。

## 设计

- 产品名：**衡账**
- 视觉方向：精密台账（深石墨壳 + 青绿强调 + Syne / Noto Sans SC / IBM Plex Mono）
- 主路径：连接 → 同步 → 对账导出 → 自动更新

## 开发

```bash
npm install
npm run rebuild
npm run dev
```

## M0 探针

```bash
set HZ_SERVER=https://你的金蝶云域名
set HZ_ACCT=数据中心内码
set HZ_USER=账号
set HZ_PASS=密码
npm run m0
```

## 打包

先在 `package.json` → `build.publish` 填好 GitHub `owner` / `repo`，再：

```bash
npm run dist
```

公开仓 Releases + `latest.yml`；安装包为 NSIS，数据在 `%LOCALAPPDATA%\衡账\`。
