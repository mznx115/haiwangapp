<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import ReplyCard from '@/components/ReplyCard.vue'
import ContextPanel from '@/components/ContextPanel.vue'
import { useProfilesStore } from '@/stores/profiles'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import { STAGE_META } from '@/core/stage'
import { checkInputSafety } from '@/core/safety'

const route = useRoute()
const router = useRouter()
const profiles = useProfilesStore()
const settings = useSettingsStore()
const chat = useChatStore()

const profileId = computed(() => String(route.params.profileId ?? ''))
const profile = computed(() => profiles.byId(profileId.value))
const stage = computed(() => (profile.value ? STAGE_META[profile.value.stage] : undefined))
const messages = computed(() => chat.list(profileId.value))
const generating = computed(() => chat.isGenerating(profileId.value))
const error = computed(() => chat.errorOf(profileId.value))
const meta = computed(() => chat.metaOf(profileId.value))

const draft = ref('')
const extra = ref('')
const activeChip = ref<string | null>(null)
const inputHint = ref<string[]>([])
const scrollEl = ref<HTMLElement | null>(null)

const QUICK_CHIPS = [
  { label: '线上初识', value: '这是线上刚认识，还在破冰阶段，要低压、不刻意。' },
  { label: '线下见面', value: '线下刚见过面，想自然地延续话题。' },
  { label: '冷场救场', value: '刚刚聊死了/冷场了，需要救场并自然转移话题。' },
  { label: '对方冷淡', value: '对方最近回复很敷衍（短、慢、不提问），请给出后撤/止损方案。' },
  { label: '想升温', value: '想在这个阶段适度升温，但不要用力过猛。' },
  { label: '被拒绝了', value: '对方已经明确拒绝了我，我需要体面收尾的话术。' },
  { label: '约见面', value: '想约 TA 出来见面，需要一个低压力、容易答应的邀约。' },
]

function toggleChip(label: string, value: string) {
  if (activeChip.value === label) {
    activeChip.value = null
    extra.value = ''
  } else {
    activeChip.value = label
    extra.value = value
  }
}

async function onGenerate() {
  if (!draft.value.trim() || generating.value) return
  const text = draft.value
  draft.value = ''
  await chat.generate(profileId.value, text, extra.value)
}

function onCancel() {
  chat.cancel(profileId.value)
}

function onClear() {
  if (window.confirm(`确定清空与「${profile.value?.name ?? ''}」的全部记录？该操作仅影响这一个对象。`)) {
    chat.clear(profileId.value)
  }
}

function scrollToBottom(smooth = false) {
  void nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  })
}

watch(
  () => [messages.value.length, messages.value[messages.value.length - 1]?.content.length ?? 0],
  () => scrollToBottom(),
  { immediate: true },
)

watch(draft, (v) => {
  inputHint.value = checkInputSafety(v)
})

function onKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + Enter 快捷发送
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void onGenerate()
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <template v-if="profile">
      <NavBar :title="profile.name" :dot-color="profile.themeColor" :subtitle="stage?.label" />

      <!-- 防串号视觉锚点：常驻，且颜色跟随对象 -->
      <div
        class="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 text-[11px] leading-tight"
        :style="{ backgroundColor: `${profile.themeColor}14`, color: profile.themeColor }"
      >
        <span class="truncate">
          正在为「{{ profile.name }}」生成 · {{ stage?.label }}
        </span>
        <button
          type="button"
          class="shrink-0 rounded px-1.5 py-0.5 text-[10px] active:bg-black/5"
          :style="{ color: profile.themeColor }"
          @click="onClear"
        >
          清空
        </button>
      </div>

      <!-- 消息流 -->
      <div ref="scrollEl" class="scroll-area min-h-0 flex-1 px-3 py-3">
        <!-- 空态 -->
        <div v-if="messages.length === 0" class="mx-auto mt-8 max-w-sm">
          <div class="rounded-lg bg-white p-4 text-[13px] leading-relaxed text-wx-sub shadow-sm">
            <p class="mb-2 text-[14px] font-medium text-wx-text">怎么用</p>
            <ol class="list-decimal space-y-1 pl-5">
              <li>把 TA 发来的消息粘贴到下边（也可以是你自己想说的话）</li>
              <li>点「生成」，会按 {{ stage?.label }} 阶段给出 3 条话术</li>
              <li>每条都带适用场景和风险提示，点「复制」直接发</li>
            </ol>
            <p class="mt-3 rounded bg-black/[0.03] p-2 text-[12px]">
              <span class="text-wx-hint">本阶段策略：</span>{{ stage?.hint }}
            </p>
          </div>
        </div>

        <!-- 消息 -->
        <div v-for="m in messages" :key="m.id" class="mb-3">
          <!-- 我输入的原文 -->
          <div v-if="m.role === 'user'" class="flex justify-end">
            <div class="max-w-[85%] rounded-lg bg-wx-me px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {{ m.content }}
            </div>
          </div>

          <!-- AI 输出 -->
          <div v-else class="flex flex-col gap-2">
            <!-- 结构化话术卡片 -->
            <template v-if="m.answer">
              <div
                v-if="m.answer.analysis"
                class="rounded-lg bg-white/80 px-3 py-2 text-[13px] leading-relaxed text-wx-sub shadow-sm"
              >
                <span class="text-wx-hint">判断：</span>{{ m.answer.analysis }}
              </div>

              <ReplyCard
                v-for="(card, i) in m.answer.replies"
                :key="i"
                :card="card"
                :index="i"
                :profile-name="profile.name"
              />

              <div
                v-if="m.answer.nextStep"
                class="rounded-lg bg-white/80 px-3 py-2 text-[13px] leading-relaxed text-wx-sub shadow-sm"
              >
                <span class="text-wx-hint">节奏建议：</span>{{ m.answer.nextStep }}
              </div>

              <ul
                v-if="m.answer.warnings.length"
                class="space-y-1 rounded-lg bg-[#fff7e6] px-3 py-2 text-[12px] leading-snug text-[#b06b00]"
              >
                <li v-for="(w, i) in m.answer.warnings" :key="i">⚠ {{ w }}</li>
              </ul>
            </template>

            <!-- 降级：模型没按 JSON 返回，直接渲染原文 -->
            <template v-else-if="m.content">
              <div class="max-w-[92%] rounded-lg bg-white px-3 py-2 shadow-sm">
                <p
                  v-if="m.rawFallback"
                  class="mb-1.5 text-[11px] text-[#b06b00]"
                >
                  模型未按结构化格式返回，已按原文展示（可重试一次）
                </p>
                <p class="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{{ m.content }}</p>
              </div>
              <ul
                v-if="m.safety?.length"
                class="space-y-1 rounded-lg bg-[#fff7e6] px-3 py-2 text-[12px] leading-snug text-[#b06b00]"
              >
                <li v-for="(w, i) in m.safety" :key="i">⚠ {{ w }}</li>
              </ul>
            </template>

            <!-- 流式中 -->
            <div
              v-else-if="generating"
              class="flex w-fit items-center gap-1.5 rounded-lg bg-white px-3 py-2 shadow-sm"
            >
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-wx-hint [animation-delay:0ms]" />
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-wx-hint [animation-delay:120ms]" />
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-wx-hint [animation-delay:240ms]" />
              <span class="ml-1 text-[12px] text-wx-hint">正在按 skill 生成话术…</span>
            </div>
          </div>
        </div>

        <!-- 错误 -->
        <div v-if="error" class="rounded-lg border border-wx-danger/30 bg-[#fef0f0] p-3">
          <p class="text-[13px] font-medium text-wx-danger">{{ error.title }}</p>
          <p class="mt-1 text-[12px] leading-snug break-words text-[#8a3b3b]">{{ error.detail }}</p>
          <p v-if="error.hint" class="mt-1.5 text-[12px] leading-snug text-[#a06060]">{{ error.hint }}</p>
          <button
            type="button"
            class="mt-2 rounded-md bg-wx-danger px-3 py-1 text-[12px] text-white active:opacity-80"
            @click="router.push('/settings')"
          >
            去检查设置
          </button>
        </div>
      </div>

      <!-- 上下文用量 -->
      <ContextPanel v-if="meta" :meta="meta" :model="settings.settings.model" />

      <!-- 输入区 -->
      <div class="safe-bottom shrink-0 border-t border-wx-line bg-[#f7f7f7] px-3 pt-2 pb-2">
        <div class="scroll-area mb-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            v-for="chip in QUICK_CHIPS"
            :key="chip.label"
            type="button"
            class="shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors"
            :class="
              activeChip === chip.label
                ? 'border-wx-brand bg-wx-brand/10 text-wx-brand'
                : 'border-wx-line bg-white text-wx-sub'
            "
            @click="toggleChip(chip.label, chip.value)"
          >
            {{ chip.label }}
          </button>
        </div>

        <ul v-if="inputHint.length" class="mb-1.5 space-y-0.5">
          <li v-for="(h, i) in inputHint" :key="i" class="text-[11px] leading-snug text-[#b06b00]">⚠ {{ h }}</li>
        </ul>

        <div class="flex items-end gap-2">
          <textarea
            v-model="draft"
            rows="2"
            placeholder="粘贴 TA 的消息，或写下你想说的话…（Ctrl+Enter 生成）"
            class="max-h-32 min-h-[44px] flex-1 resize-none rounded-md bg-white px-3 py-2 text-[15px] leading-relaxed outline-none placeholder:text-wx-hint"
            @keydown="onKeydown"
          />
          <button
            v-if="generating"
            type="button"
            class="h-9 shrink-0 rounded-md border border-wx-line bg-white px-3 text-[14px] text-wx-sub active:bg-black/5"
            @click="onCancel"
          >
            取消
          </button>
          <button
            v-else
            type="button"
            class="h-9 shrink-0 rounded-md px-4 text-[14px] text-white transition-opacity"
            :class="draft.trim() ? 'bg-wx-brand active:opacity-80' : 'bg-wx-brand/40'"
            :disabled="!draft.trim()"
            @click="onGenerate"
          >
            生成
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <NavBar title="对象不存在" />
      <div class="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <p class="text-[14px] text-wx-sub">该聊天对象不存在或已被删除。</p>
        <button
          type="button"
          class="rounded-md bg-wx-brand px-4 py-2 text-[14px] text-white active:opacity-80"
          @click="router.replace('/profiles')"
        >
          返回对象列表
        </button>
      </div>
    </template>
  </div>
</template>
