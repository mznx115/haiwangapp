<script setup lang="ts">
import { ref } from 'vue'
import type { LastMeta } from '@/stores/chat'

defineProps<{ meta: LastMeta; model: string }>()

const open = ref(false)
</script>

<template>
  <div class="mx-3 mb-1.5 overflow-hidden rounded-lg bg-white/70 text-[11px]">
    <button
      type="button"
      class="flex w-full items-center justify-between px-3 py-1.5 text-wx-sub"
      @click="open = !open"
    >
      <span>
        上下文 ≈ {{ meta.estimatedTokens }} tokens
        <span v-if="meta.recentTurns"> · 原文 {{ meta.recentTurns }} 轮</span>
        <span v-if="meta.summarizedCount"> · 压摘要 {{ meta.summarizedCount }} 条</span>
      </span>
      <span class="text-wx-hint">{{ open ? '收起' : '详情' }}</span>
    </button>

    <div v-if="open" class="border-t border-wx-line/70 px-3 py-2">
      <p class="mb-1.5 text-wx-hint">模型：{{ model || '未设置' }} · 解析策略：{{ meta.strategy }}</p>
      <p v-if="meta.transportNote" class="mb-1.5 text-[#b06b00]">{{ meta.transportNote }}</p>
      <ul class="[&>*+*]:mt-1">
        <li v-for="l in meta.layers" :key="l.id" class="flex items-baseline justify-between gap-2">
          <span class="truncate" :class="l.chars === 0 ? 'text-wx-hint' : 'text-wx-sub'">
            {{ l.id }} {{ l.name }}
            <span v-if="l.trimmed" class="text-[#b06b00]">（已裁剪）</span>
          </span>
          <span class="shrink-0 tabular-nums text-wx-hint">
            {{ l.chars === 0 ? '未启用' : `${l.tokens} tk` }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
