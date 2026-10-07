<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ReplyCard } from '@/types'
import { copyText } from '@/core/clipboard'

const props = defineProps<{
  card: ReplyCard
  index: number
  /** 当前对象名，复制反馈里带上，避免串号时复制错 */
  profileName: string
}>()

const ACCENTS = ['#4C8DFF', '#FF6B81', '#FFA940', '#9254DE']
const accent = computed(() => ACCENTS[props.index % ACCENTS.length])

const copied = ref(false)
const failed = ref(false)

async function onCopy() {
  const ok = await copyText(props.card.text)
  if (ok) {
    copied.value = true
    failed.value = false
    window.setTimeout(() => (copied.value = false), 1800)
  } else {
    failed.value = true
    window.setTimeout(() => (failed.value = false), 2200)
  }
}
</script>

<template>
  <article
    class="overflow-hidden rounded-lg bg-white shadow-sm"
    :style="{ borderLeft: `3px solid ${accent}` }"
  >
    <header class="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
      <span
        class="rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-[16px]"
        :style="{ color: accent, backgroundColor: `${accent}1a` }"
      >
        {{ card.style }}
      </span>

      <button
        type="button"
        class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors"
        :class="copied ? 'bg-wx-brand/10 text-wx-brand' : 'text-[#576b95] active:bg-black/5'"
        @click="onCopy"
      >
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.9"
          stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </svg>
        <span v-if="copied">已复制 · 发给{{ profileName }}</span>
        <span v-else-if="failed">复制失败，请手动选择</span>
        <span v-else>复制</span>
      </button>
    </header>

    <p class="select-text px-3 pb-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-wx-text">
      {{ card.text }}
    </p>

    <footer v-if="card.scenario || card.risk" class="space-y-1 bg-black/[0.025] px-3 py-2">
      <p v-if="card.scenario" class="text-[12px] leading-snug text-wx-sub">
        <span class="text-wx-hint">适用场景：</span>{{ card.scenario }}
      </p>
      <p v-if="card.risk" class="text-[12px] leading-snug text-[#b06b00]">
        <span class="opacity-70">风险提示：</span>{{ card.risk }}
      </p>
    </footer>
  </article>
</template>
