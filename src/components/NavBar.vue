<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  title: string
  /**
   * 是否显示返回箭头。不传时按路由自动判断：
   * 底部 tab 的顶层页（/profiles、/favorites、/me）不带返回，
   * 其余所有路由一律带返回。只有需要打破这条规则时才显式传值。
   */
  back?: boolean
  /** 右侧插槽色点（防串号视觉锚点） */
  dotColor?: string
  /** 副标题，如关系阶段 */
  subtitle?: string
}>()

const route = useRoute()
const router = useRouter()
const showBack = computed(() => props.back ?? route.meta.tab !== true)

function onBack() {
  if (window.history.length > 1) router.back()
  else void router.replace('/profiles')
}
</script>

<template>
  <header class="safe-top shrink-0 border-b border-wx-line bg-[#f7f7f7]/95 backdrop-blur-md">
    <div class="relative flex h-11 items-center justify-center px-14">
      <button
        v-if="showBack"
        type="button"
        class="absolute left-2 flex h-8 w-8 items-center justify-center rounded-full active:bg-black/5"
        aria-label="返回"
        @click="onBack"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <div class="flex min-w-0 items-center gap-1.5">
        <span
          v-if="dotColor"
          class="h-2 w-2 shrink-0 rounded-full"
          :style="{ backgroundColor: dotColor }"
        />
        <span class="truncate text-[16px] font-medium">{{ title }}</span>
      </div>

      <div class="absolute right-2 flex items-center gap-1.5">
        <slot name="right">
          <span
            v-if="subtitle"
            class="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-wx-sub"
          >
            {{ subtitle }}
          </span>
        </slot>
      </div>
    </div>
  </header>
</template>
