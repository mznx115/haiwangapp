<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { useProfilesStore } from '@/stores/profiles'
import { STAGE_META } from '@/core/stage'
import type { Profile } from '@/types'

const router = useRouter()
const store = useProfilesStore()

const list = computed(() => store.activeProfiles)

function open(p: Profile) {
  void router.push(`/chat/${p.id}`)
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="海王" :back="false" />

    <div class="scroll-area min-h-0 flex-1">
      <!-- 首次使用引导 -->
      <div v-if="list.length === 0" class="px-8 py-20 text-center">
        <p class="text-[15px] font-medium text-wx-text">还没有聊天对象</p>
        <p class="mt-2 text-[13px] leading-relaxed text-wx-sub">
          每个对象拥有独立档案与独立会话，互相不可见。<br />
          这是「不串号」的根本保证。
        </p>
        <button
          type="button"
          class="mt-6 rounded-md bg-wx-brand px-5 py-2 text-[14px] text-white active:opacity-80"
          @click="store.createDemo()"
        >
          添加一个对象
        </button>
      </div>

      <!-- 会话列表 -->
      <ul v-else class="bg-wx-panel">
        <li v-for="p in list" :key="p.id">
          <button
            type="button"
            class="relative flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.04]"
            @click="open(p)"
          >
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-[18px] font-medium text-white"
              :style="{ backgroundColor: p.themeColor }"
            >
              {{ p.name.slice(0, 1) }}
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex items-baseline gap-2">
                <span class="truncate text-[16px] text-wx-text">{{ p.name }}</span>
                <span
                  class="shrink-0 rounded-sm px-1 py-px text-[10px] leading-[14px]"
                  :style="{
                    color: STAGE_META[p.stage].color,
                    backgroundColor: `${STAGE_META[p.stage].color}1a`,
                  }"
                >
                  {{ STAGE_META[p.stage].label }}
                </span>
              </span>
              <span class="mt-0.5 block truncate text-[13px] text-wx-sub">
                {{ p.notes || p.source || '还没有记录' }}
              </span>
            </span>

            <span class="shrink-0 self-start pt-1 text-[11px] text-wx-hint">
              {{ relTime(p.updatedAt) }}
            </span>
          </button>
        </li>
      </ul>

      <p v-if="list.length > 0" class="px-4 py-6 text-center text-[12px] text-wx-hint">
        长按对象可编辑档案与关系阶段（下一版本开放）
      </p>
    </div>
  </div>
</template>
