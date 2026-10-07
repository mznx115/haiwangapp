<script setup lang="ts">
import { ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useSettingsStore } from '@/stores/settings'
import { listModels, testConnection } from '@/core/api/client'
import { describeError } from '@/core/api/errors'

const settings = useSettingsStore()
const saved = ref(false)

const testing = ref(false)
const fetching = ref(false)
const testResult = ref<{ ok: boolean; title: string; lines: string[] } | null>(null)
const fetchedModels = ref<string[]>([])

const presetModels = [
  'deepseek-chat',
  'deepseek-reasoner',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'qwen-plus',
  'glm-4-plus',
]

function onSave() {
  saved.value = true
  window.setTimeout(() => (saved.value = false), 1500)
}

function onReset() {
  settings.reset()
  testResult.value = null
  fetchedModels.value = []
}

/** 测试连接：优先 /v1/models，不可用则退回一次最小对话 */
async function onTest() {
  if (testing.value) return
  testing.value = true
  testResult.value = null
  try {
    const r = await testConnection(
      { baseUrl: settings.normalizedBaseUrl(), apiKey: settings.settings.apiKey },
      settings.settings.model,
    )
    fetchedModels.value = r.models
    testResult.value = {
      ok: true,
      title: '连接成功',
      lines: [r.message, r.via === 'models' ? '探测方式：GET /v1/models' : '探测方式：POST /v1/chat/completions'],
    }
  } catch (err) {
    const f = describeError(err)
    testResult.value = {
      ok: false,
      title: f.title,
      lines: [f.detail, f.hint].filter(Boolean),
    }
  } finally {
    testing.value = false
  }
}

/** 仅拉取模型列表 */
async function onFetchModels() {
  if (fetching.value) return
  fetching.value = true
  try {
    fetchedModels.value = await listModels({
      baseUrl: settings.normalizedBaseUrl(),
      apiKey: settings.settings.apiKey,
    })
    if (fetchedModels.value.length === 0) {
      testResult.value = { ok: false, title: '没有拿到模型', lines: ['/v1/models 返回了空列表。'] }
    } else if (!settings.settings.model) {
      settings.settings.model = fetchedModels.value[0]
    }
  } catch (err) {
    const f = describeError(err)
    testResult.value = { ok: false, title: f.title, lines: [f.detail, f.hint].filter(Boolean) }
  } finally {
    fetching.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="设置" />

    <div class="scroll-area min-h-0 flex-1 pb-8">
      <p class="px-4 pt-5 pb-2 text-[13px] text-wx-sub">接口</p>
      <div class="mx-4 overflow-hidden rounded-lg bg-wx-other">
        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">Base URL（OpenAI 兼容）</span>
          <input
            v-model="settings.settings.baseUrl"
            type="url"
            inputmode="url"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="http://175.178.98.241:30888/v1"
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-wx-hint"
          />
        </label>

        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">API Key</span>
          <input
            v-model="settings.settings.apiKey"
            type="password"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="sk-..."
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-wx-hint"
          />
        </label>

        <label class="relative block px-4 py-3">
          <span class="mb-1 flex items-center justify-between text-[12px] text-wx-sub">
            <span>模型</span>
            <button
              type="button"
              class="text-[11px] text-[#576b95] active:opacity-60"
              @click="onFetchModels"
            >
              {{ fetching ? '拉取中…' : '从 /v1/models 拉取' }}
            </button>
          </span>
          <input
            v-model="settings.settings.model"
            list="model-options"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="手动填写，或点右上角拉取"
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-wx-hint"
          />
          <datalist id="model-options">
            <option v-for="m in (fetchedModels.length ? fetchedModels : presetModels)" :key="m" :value="m" />
          </datalist>
        </label>
      </div>

      <!-- 测试连接 -->
      <div class="mt-3 flex gap-3 px-4">
        <button
          type="button"
          class="flex-1 rounded-md border border-wx-line bg-white py-2 text-[14px] text-wx-text active:bg-black/5 disabled:opacity-50"
          :disabled="testing"
          @click="onTest"
        >
          {{ testing ? '正在测试…' : '测试连接' }}
        </button>
      </div>

      <div
        v-if="testResult"
        class="mx-4 mt-3 rounded-lg p-3 text-[12px] leading-snug"
        :class="testResult.ok ? 'bg-wx-brand/10 text-[#0a7a3d]' : 'bg-[#fef0f0] text-[#8a3b3b]'"
      >
        <p class="mb-1 text-[13px] font-medium">
          {{ testResult.ok ? '✓ ' : '✕ ' }}{{ testResult.title }}
        </p>
        <p v-for="(line, i) in testResult.lines" :key="i" class="mt-1 break-words">{{ line }}</p>
      </div>

      <div
        v-if="fetchedModels.length"
        class="mx-4 mt-3 rounded-lg bg-wx-other p-3 text-[12px] text-wx-sub"
      >
        <p class="mb-1.5 text-wx-hint">网关可用模型（{{ fetchedModels.length }}）</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="m in fetchedModels.slice(0, 60)"
            :key="m"
            type="button"
            class="rounded border px-1.5 py-0.5 text-[11px]"
            :class="
              settings.settings.model === m
                ? 'border-wx-brand bg-wx-brand/10 text-wx-brand'
                : 'border-wx-line text-wx-sub'
            "
            @click="settings.settings.model = m"
          >
            {{ m }}
          </button>
        </div>
      </div>

      <p class="px-4 pt-5 pb-2 text-[13px] text-wx-sub">生成参数</p>
      <div class="mx-4 overflow-hidden rounded-lg bg-wx-other">
        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-2 flex items-center justify-between text-[12px] text-wx-sub">
            <span>温度 temperature</span>
            <span class="text-wx-text">{{ settings.settings.temperature.toFixed(1) }}</span>
          </span>
          <input
            v-model.number="settings.settings.temperature"
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            class="w-full accent-wx-brand"
          />
        </label>

        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">最大输出 tokens</span>
          <input
            v-model.number="settings.settings.maxTokens"
            type="number"
            min="128"
            max="8192"
            step="128"
            class="w-full bg-transparent text-[14px] outline-none"
          />
        </label>

        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">
            模型上下文窗口（用于 L5 记忆层 token 预算）
          </span>
          <input
            v-model.number="settings.settings.contextWindow"
            type="number"
            min="4096"
            max="1048576"
            step="4096"
            class="w-full bg-transparent text-[14px] outline-none"
          />
        </label>

        <label class="relative flex items-center justify-between px-4 py-3">
          <span class="text-[14px]">流式输出</span>
          <input
            v-model="settings.settings.stream"
            type="checkbox"
            class="h-5 w-5 accent-wx-brand"
          />
        </label>
      </div>

      <p class="px-4 pt-5 pb-2 text-[13px] text-wx-sub">技能包</p>
      <div class="mx-4 overflow-hidden rounded-lg bg-wx-other">
        <div class="px-4 py-3 text-[13px] leading-relaxed text-wx-sub">
          <p>调用 API 时会自动按六层结构注入 haiwang.skill（角色 / 知识 / 人设 / 对象档案 / 会话记忆 / 任务指令）。</p>
          <p class="mt-2 text-[12px] text-wx-hint">
            当前版本已完成技能包内联（离线可用），上下文组装在 M2 接入。
          </p>
        </div>
      </div>

      <div class="mt-6 flex gap-3 px-4">
        <button
          type="button"
          class="flex-1 rounded-md bg-wx-brand py-2.5 text-[15px] text-white active:opacity-80"
          @click="onSave"
        >
          {{ saved ? '已保存' : '保存' }}
        </button>
        <button
          type="button"
          class="rounded-md border border-wx-line bg-white px-5 py-2.5 text-[15px] text-wx-sub active:bg-black/5"
          @click="onReset"
        >
          重置
        </button>
      </div>

      <p class="mt-4 px-8 text-center text-[11px] leading-relaxed text-wx-hint">
        设置改动即时保存到本机。API Key 在 M4 会迁移到 Android Keystore 加密存储。<br />
        当前接口为明文 HTTP，建议尽快在服务端启用 HTTPS。
      </p>
    </div>
  </div>
</template>
