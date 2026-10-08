<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineProps<{
  title: string
  /** 右侧插槽色点（防串号视觉锚点） */
  dotColor?: string
  /** 副标题，如关系阶段 */
  subtitle?: string
}>()

const route = useRoute()
const router = useRouter()

/**
 * 返回箭头是否显示，规则只有一条：
 *   底部 tab 的顶层页（/profiles、/favorites、/me）无处可返回 → 不显示；
 *   其余所有路由 → 显示。
 * 由 router 的 meta.tab 统一驱动，页面不用各自配置，新增路由也不会漏。
 *
 * ⚠️ 不要再把它改回 `defineProps` 里的布尔开关（例如 `back?: boolean`）。
 * Vue 3 会把**缺省的 Boolean prop 强制成 false**，而不是 undefined ——
 * 见 @vue/runtime-core 的 resolvePropValue：
 *     if (isAbsent && !hasDefault) value = false
 * 于是 `props.back !== false` 和 `props.back ?? x` 都会恒为 false，
 * 表现就是"返回按钮死活不出现"，而且从模板上完全看不出原因。
 * 这就是它之前一直没渲染出来的真正原因。
 *
 * 如果以后确实需要在某个非 tab 路由上隐藏返回，请用语义安全的
 * `hideBack?: boolean`（缺省 false = 不隐藏，正好是想要的方向），
 * 而不是 `showBack?: boolean` 这种缺省会被强制成 false 的写法。
 */
const showBack = computed(() => route.meta.tab !== true)

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
