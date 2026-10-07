<script setup lang="ts">
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { useSettingsStore } from '@/stores/settings'
import { SKILL_NAME, SKILL_VERSION } from '@/skills'

const router = useRouter()
const settings = useSettingsStore()
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="我" :back="false" />

    <div class="scroll-area min-h-0 flex-1 pb-6">
      <!-- 头部 -->
      <div class="flex items-center gap-4 bg-wx-panel px-4 py-5">
        <span
          class="flex h-16 w-16 items-center justify-center rounded-lg bg-wx-brand text-[24px] text-white"
        >
          {{ (settings.persona.nickname || '我').slice(0, 1) }}
        </span>
        <div class="min-w-0">
          <p class="truncate text-[18px] font-medium">
            {{ settings.persona.nickname || '未设置昵称' }}
          </p>
          <p class="mt-1 truncate text-[13px] text-wx-sub">
            {{ settings.persona.speechStyle || '还没填写说话风格' }}
          </p>
        </div>
      </div>

      <!-- 人设卡 -->
      <p class="px-4 pt-5 pb-2 text-[13px] text-wx-sub">我的人设卡</p>
      <div class="mx-4 rounded-lg bg-wx-other p-4 text-[13px] leading-relaxed">
        <p v-if="!settings.persona.traits && !settings.persona.boundaries" class="text-wx-sub">
          人设卡会作为 L3 层注入每一次请求，保证所有话术都是「你」在说。<br />
          填写入口在下一版本开放。
        </p>
        <dl v-else class="space-y-2">
          <div v-if="settings.persona.traits">
            <dt class="text-wx-sub">性格</dt>
            <dd>{{ settings.persona.traits }}</dd>
          </div>
          <div v-if="settings.persona.boundaries">
            <dt class="text-wx-sub">绝对底线</dt>
            <dd>{{ settings.persona.boundaries }}</dd>
          </div>
        </dl>
      </div>

      <!-- 设置入口 -->
      <div class="mt-5 overflow-hidden rounded-lg bg-wx-other">
        <button
          type="button"
          class="wx-divider relative flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-black/[0.04]"
          @click="router.push('/skill')"
        >
          <span>技能包</span>
          <span class="text-[13px] text-wx-sub">
            {{ SKILL_NAME }} v{{ SKILL_VERSION }} ›
          </span>
        </button>
        <button
          type="button"
          class="relative flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-black/[0.04]"
          @click="router.push('/settings')"
        >
          <span>设置</span>
          <span class="text-[13px]" :class="settings.isConfigured() ? 'text-wx-sub' : 'text-wx-danger'">
            {{ settings.isConfigured() ? '已配置 ›' : '未配置 API ›' }}
          </span>
        </button>
      </div>

      <p class="mt-6 px-8 text-center text-[11px] leading-relaxed text-wx-hint">
        本应用的目标是提升社交能力、学会真诚沟通、把握社交分寸，<br />
        而非教用户玩弄感情。请自行承担社交行为的全部责任。
      </p>
    </div>
  </div>
</template>
