<script setup lang="ts">
import { computed, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { haiwangSkill, SKILL_SOURCE } from '@/skills'

type Tab = 'skill' | 'knowledge' | 'prompt'
const tab = ref<Tab>('skill')

const tabs: { key: Tab; label: string }[] = [
  { key: 'skill', label: '角色设定' },
  { key: 'knowledge', label: '知识库' },
  { key: 'prompt', label: '任务指令' },
]

const content = computed(() => {
  if (tab.value === 'skill') return haiwangSkill.skill
  if (tab.value === 'knowledge') return haiwangSkill.knowledge
  return haiwangSkill.prompt
})

const charCount = computed(() => content.value.length)
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="技能包" />

    <div class="scroll-area min-h-0 flex-1 pb-8">
      <!-- 元信息 -->
      <div class="mx-4 mt-4 rounded-lg bg-wx-other p-4">
        <p class="text-[16px] font-medium">{{ haiwangSkill.meta.name }}.skill</p>
        <p class="mt-1 text-[13px] text-wx-sub">{{ haiwangSkill.meta.description }}</p>
        <dl class="mt-3 grid grid-cols-2 gap-y-1.5 text-[12px]">
          <dt class="text-wx-sub">版本</dt>
          <dd class="text-right">v{{ haiwangSkill.meta.version }}</dd>
          <dt class="text-wx-sub">作者</dt>
          <dd class="text-right">{{ haiwangSkill.meta.author }}</dd>
          <dt class="text-wx-sub">触发词</dt>
          <dd class="text-right">{{ haiwangSkill.meta.trigger }}</dd>
          <dt class="text-wx-sub">来源</dt>
          <dd class="truncate text-right text-[11px]">{{ SKILL_SOURCE }}</dd>
        </dl>
        <p class="mt-3 text-[11px] leading-relaxed text-wx-hint">
          已内联进 App，完全离线可用，运行时不访问 GitHub。
        </p>
      </div>

      <!-- 分段切换 -->
      <div class="mx-4 mt-4 flex rounded-lg bg-black/[0.05] p-0.5">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="flex-1 rounded-md py-1.5 text-[13px] transition-colors"
          :class="tab === t.key ? 'bg-white text-wx-text shadow-sm' : 'text-wx-sub'"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- 原文 -->
      <div class="mx-4 mt-3 rounded-lg bg-wx-other p-4">
        <pre class="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed">{{ content }}</pre>
      </div>

      <p class="mt-3 px-4 text-center text-[11px] text-wx-hint">
        共 {{ charCount }} 字符 · 注入时作为 L{{ tab === 'skill' ? '1' : tab === 'knowledge' ? '2' : '6' }} 层
      </p>
    </div>
  </div>
</template>
