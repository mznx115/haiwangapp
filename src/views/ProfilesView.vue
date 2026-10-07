<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { useProfilesStore } from '@/stores/profiles'
import { useChatStore } from '@/stores/chat'
import { STAGE_META } from '@/core/stage'
import type { Profile } from '@/types'

const router = useRouter()
const store = useProfilesStore()
const chat = useChatStore()

const list = computed(() => store.activeProfiles)

function open(p: Profile) {
  void router.push(`/chat/${p.id}`)
}

function edit(p: Profile, e: Event) {
  e.stopPropagation()
  void router.push(`/profile/${p.id}/edit`)
}

/** 列表里显示最后一条真实消息，没有就退回档案备注 */
function preview(p: Profile): string {
  const msgs = chat.list(p.id)
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m.answer?.replies.length) {
      return `AI：${m.answer.replies[0].text}`
    }
    if (m.content) return `${m.role === 'user' ? '我' : 'AI'}：${m.content.replace(/\s+/g, ' ')}`
  }
  return p.notes || p.source || '还没有记录'
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

const totalMsgs = computed(() => chat.totalMessages)
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="海王" :back="false">
      <template #right>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full active:bg-black/5"
          aria-label="添加对象"
          @click="router.push('/profile/new')"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </template>
    </NavBar>

    <div class="scroll-area min-h-0 flex-1">
      <!-- 首次使用引导 -->
      <div v-if="list.length === 0" class="px-8 py-16 text-center">
        <p class="text-[15px] font-medium text-wx-text">还没有聊天对象</p>
        <p class="mt-2 text-[13px] leading-relaxed text-wx-sub">
          每个对象拥有独立档案与独立会话，互相不可见。<br />
          这是「不串号」的根本保证。
        </p>
        <button
          type="button"
          class="mt-6 rounded-md bg-wx-brand px-5 py-2 text-[14px] text-white active:opacity-80"
          @click="router.push('/profile/new')"
        >
          添加第一个对象
        </button>
      </div>

      <!-- 会话列表 -->
      <ul v-else class="bg-wx-panel">
        <li v-for="p in list" :key="p.id">
          <div
            class="relative flex items-center gap-3 px-4 py-3 active:bg-black/[0.04]"
            role="button"
            tabindex="0"
            @click="open(p)"
            @keydown.enter="open(p)"
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
              <span class="mt-0.5 block truncate text-[13px] text-wx-sub">{{ preview(p) }}</span>
            </span>

            <span class="flex shrink-0 flex-col items-end gap-1 self-start pt-1">
              <span class="text-[11px] text-wx-hint">{{ relTime(p.updatedAt) }}</span>
            </span>

            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-wx-hint active:bg-black/5"
              aria-label="编辑档案"
              @click="edit(p, $event)"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20z" />
                <path d="M14.5 6.5L17.5 9.5" />
              </svg>
            </button>
          </div>
        </li>
      </ul>

      <p v-if="list.length > 0" class="px-4 py-6 text-center text-[12px] leading-relaxed text-wx-hint">
        点对象进入会话，点铅笔编辑档案<br />
        本机已保存 {{ totalMsgs }} 条消息 · 全部只存在这台设备上
      </p>
    </div>
  </div>
</template>
