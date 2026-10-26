<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/ui/PageHeader.vue'
import HzField from '../components/ui/HzField.vue'
import HzButton from '../components/ui/HzButton.vue'

const router = useRouter()
const saving = ref(false)
const testing = ref(false)
const toast = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
const hasPassword = ref(false)

const form = reactive({
  serverUrl: '',
  acctId: '',
  username: '',
  password: '',
  companyName: '',
  companyShortName: '',
  companyAddress: '',
  companyPhone: '',
  preparerName: ''
})

onMounted(async () => {
  const cfg = await window.hengzhang.getConfig()
  form.serverUrl = cfg.serverUrl
  form.acctId = cfg.acctId
  form.username = cfg.username
  form.companyName = cfg.companyName
  form.companyShortName = cfg.companyShortName
  form.companyAddress = cfg.companyAddress
  form.companyPhone = cfg.companyPhone
  form.preparerName = cfg.preparerName
  hasPassword.value = cfg.hasPassword
})

async function save() {
  saving.value = true
  toast.value = null
  try {
    const cfg = await window.hengzhang.saveConfig({
      ...form,
      password: form.password || undefined
    })
    hasPassword.value = cfg.hasPassword
    form.password = ''
    toast.value = { type: 'ok', text: '配置已保存到本机（密码经系统加密）' }
  } catch (e) {
    toast.value = { type: 'err', text: e instanceof Error ? e.message : String(e) }
  } finally {
    saving.value = false
  }
}

async function test() {
  testing.value = true
  toast.value = null
  try {
    if (form.password || !hasPassword.value) {
      await window.hengzhang.saveConfig({
        ...form,
        password: form.password || undefined
      })
      form.password = ''
      hasPassword.value = true
    }
    const res = await window.hengzhang.testConnection()
    toast.value = { type: res.ok ? 'ok' : 'err', text: res.message }
    if (res.ok) setTimeout(() => router.push('/sync'), 500)
  } catch (e) {
    toast.value = { type: 'err', text: e instanceof Error ? e.message : String(e) }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Step 01 · Connect"
      title="连接金蝶云"
      subtitle="填写公有云 WebAPI 基址与数据中心内码。首次可由实施协助填写；测通后进入同步。"
    >
      <HzButton variant="ghost" :loading="saving" @click="save">保存</HzButton>
      <HzButton :loading="testing" @click="test">测试连接</HzButton>
    </PageHeader>

    <div class="grid">
      <div class="panel rise" style="animation-delay: 0.05s">
        <div class="panel-title">金蝶连接</div>
        <div class="fields">
          <HzField label="服务器地址" hint="例：https://xxx.kingdee.com — 以 M0 抓包为准">
            <input v-model="form.serverUrl" placeholder="https://" spellcheck="false" />
          </HzField>
          <div class="two">
            <HzField label="acctID / 数据中心内码">
              <input v-model="form.acctId" placeholder="数据中心内码" spellcheck="false" />
            </HzField>
            <HzField label="账号">
              <input v-model="form.username" autocomplete="username" />
            </HzField>
          </div>
          <HzField
            label="密码"
            :hint="hasPassword ? '已保存加密密码；留空则保持不变' : '密码仅存本机当前 Windows 用户'"
          >
            <input
              v-model="form.password"
              type="password"
              :placeholder="hasPassword ? '••••••••' : '请输入密码'"
              autocomplete="current-password"
            />
          </HzField>
        </div>
      </div>

      <div class="panel rise" style="animation-delay: 0.12s">
        <div class="panel-title">本公司信息（对账单页眉）</div>
        <div class="fields">
          <HzField label="公司全称">
            <input v-model="form.companyName" />
          </HzField>
          <div class="two">
            <HzField label="简称（文件名）">
              <input v-model="form.companyShortName" />
            </HzField>
            <HzField label="制单人">
              <input v-model="form.preparerName" />
            </HzField>
          </div>
          <HzField label="公司地址">
            <textarea v-model="form.companyAddress" />
          </HzField>
          <HzField label="联系人电话">
            <input v-model="form.companyPhone" />
          </HzField>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast" :class="toast.type">{{ toast.text }}</div>

    <aside class="tips rise" style="animation-delay: 0.18s">
      <div class="tips-title">连接说明</div>
      <ol>
        <li>登录界面第一项「数据中心」对应本页的 acctID（内码，不是公司中文名）。</li>
        <li>测连前建议先退出金蝶客户端，避免同账号会话互踢。</li>
        <li>本工具只读查询，不会改写金蝶单据。</li>
      </ol>
    </aside>
  </section>
</template>

<style scoped>
.page {
  max-width: 1080px;
}

.grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
}

.panel {
  background: var(--bg-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 20px;
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow);
}

.panel-title {
  font-weight: 700;
  margin-bottom: 16px;
  font-size: 15px;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.toast {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
  border: 1px solid var(--line);
}
.toast.ok {
  background: rgba(61, 220, 151, 0.1);
  border-color: rgba(61, 220, 151, 0.28);
  color: #b6f5d4;
}
.toast.err {
  background: rgba(255, 107, 122, 0.1);
  border-color: rgba(255, 107, 122, 0.28);
  color: #ffc2c9;
}

.tips {
  margin-top: 16px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--line-strong);
  background: rgba(255, 255, 255, 0.02);
}

.tips-title {
  font-weight: 600;
  margin-bottom: 8px;
}

ol {
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
  line-height: 1.7;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
