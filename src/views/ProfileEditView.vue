<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { useProfilesStore, type ProfileDraft } from '@/stores/profiles'
import { useChatStore } from '@/stores/chat'
import { AVATAR_COLORS, STAGE_META, STAGE_ORDER, pickAvatarColor } from '@/core/stage'
import type { RelationStage } from '@/types'

const route = useRoute()
const router = useRouter()
const profiles = useProfilesStore()
const chat = useChatStore()

const editingId = computed(() => (route.params.id ? String(route.params.id) : null))
const isNew = computed(() => editingId.value === null)
const existing = computed(() => (editingId.value ? profiles.byId(editingId.value) : undefined))

if (editingId.value && !existing.value) {
  void router.replace('/profiles')
}

const form = ref<ProfileDraft>({
  name: existing.value?.name ?? '',
  source: existing.value?.source ?? '',
  stage: existing.value?.stage ?? 'stranger',
  themeColor: existing.value?.themeColor ?? AVATAR_COLORS[0],
  likes: existing.value?.likes ?? '',
  dislikes: existing.value?.dislikes ?? '',
  notes: existing.value?.notes ?? '',
  chatWindow: existing.value?.chatWindow ?? '',
})

/** 昵称改动时自动跟随取色，除非用户已经手动选过 */
const colorTouched = ref(Boolean(existing.value))
function onNameInput() {
  if (!colorTouched.value) form.value.themeColor = pickAvatarColor(form.value.name || 'x')
}

function pickColor(c: string) {
  colorTouched.value = true
  form.value.themeColor = c
}

function setStage(s: RelationStage) {
  form.value.stage = s
}

const canSave = computed(() => form.value.name.trim().length > 0)
const saved = ref(false)

function onSave() {
  if (!canSave.value) return
  const payload: ProfileDraft = { ...form.value, name: form.value.name.trim() }
  if (editingId.value) {
    profiles.update(editingId.value, payload)
    saved.value = true
    window.setTimeout(() => (saved.value = false), 1200)
  } else {
    const created = profiles.create(payload)
    void router.replace(`/chat/${created.id}`)
  }
}

function onDelete() {
  if (!editingId.value || !existing.value) return
  const name = existing.value.name
  if (!window.confirm(`删除「${name}」？该对象的档案与全部聊天记录都会被清除，无法恢复。`)) return
  chat.dropProfile(editingId.value)
  profiles.remove(editingId.value)
  void router.replace('/profiles')
}

function onArchive() {
  if (!editingId.value || !existing.value) return
  if (existing.value.archived) profiles.unarchive(editingId.value)
  else profiles.archive(editingId.value)
  void router.replace('/profiles')
}

const STAGE_HINTS = STAGE_ORDER.map((s) => ({ key: s, ...STAGE_META[s] }))
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar :title="isNew ? '添加对象' : '编辑档案'">
      <template #right>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-[14px] transition-opacity"
          :class="canSave ? 'text-wx-brand active:opacity-60' : 'text-wx-hint'"
          :disabled="!canSave"
          @click="onSave"
        >
          {{ saved ? '已保存' : '保存' }}
        </button>
      </template>
    </NavBar>

    <div class="scroll-area min-h-0 flex-1 pb-8">
      <!-- 预览 -->
      <div class="flex items-center gap-3 bg-wx-panel px-4 py-4">
        <span
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-[20px] font-medium text-white"
          :style="{ backgroundColor: form.themeColor }"
        >
          {{ (form.name || '?').slice(0, 1) }}
        </span>
        <input
          v-model="form.name"
          placeholder="给 TA 起个代号（必填）"
          class="min-w-0 flex-1 bg-transparent text-[18px] outline-none placeholder:text-wx-hint"
          @input="onNameInput"
        />
      </div>

      <!-- 主题色 -->
      <div class="mt-3 bg-wx-other px-4 py-3">
        <p class="mb-2 text-[12px] text-wx-sub">
          主题色（会话页顶部色条与头像用它，用来一眼确认「现在是谁」）
        </p>
        <div class="flex flex-wrap gap-2.5">
          <button
            v-for="c in AVATAR_COLORS"
            :key="c"
            type="button"
            class="h-7 w-7 rounded-full transition-transform"
            :class="form.themeColor === c ? 'ring-2 ring-offset-2 ring-wx-brand scale-110' : ''"
            :style="{ backgroundColor: c }"
            :aria-label="c"
            @click="pickColor(c)"
          />
        </div>
      </div>

      <!-- 关系阶段 -->
      <p class="px-4 pt-5 pb-2 text-[13px] text-wx-sub">关系阶段（决定话术尺度）</p>
      <div class="mx-4 [&>*+*]:mt-2">
        <button
          v-for="s in STAGE_HINTS"
          :key="s.key"
          type="button"
          class="flex w-full items-start gap-3 rounded-lg bg-wx-other px-4 py-3 text-left transition-colors"
          :class="form.stage === s.key ? 'ring-1 ring-inset' : ''"
          :style="form.stage === s.key ? { boxShadow: `inset 0 0 0 1px ${s.color}` } : {}"
          @click="setStage(s.key)"
        >
          <span
            class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: s.color }"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-[15px]" :style="form.stage === s.key ? { color: s.color } : {}">
              {{ s.label }}
            </span>
            <span class="mt-0.5 block text-[12px] leading-snug text-wx-sub">{{ s.hint }}</span>
          </span>
        </button>
      </div>

      <!-- 档案细节 -->
      <p class="px-4 pt-5 pb-2 text-[13px] text-wx-sub">档案细节（会作为 L4 层注入）</p>
      <div class="mx-4 overflow-hidden rounded-lg bg-wx-other">
        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">认识渠道</span>
          <input
            v-model="form.source"
            placeholder="社交软件 / 线下活动 / 朋友介绍…"
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-wx-hint"
          />
        </label>

        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">TA 的喜好</span>
          <textarea
            v-model="form.likes"
            rows="2"
            placeholder="喜欢什么、最近在忙什么、在意什么"
            class="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-wx-hint"
          />
        </label>

        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">TA 的禁忌（绝对不能碰）</span>
          <textarea
            v-model="form.dislikes"
            rows="2"
            placeholder="讨厌被追问、不喜欢被开某个玩笑…"
            class="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-wx-hint"
          />
        </label>

        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">关键信息与进度</span>
          <textarea
            v-model="form.notes"
            rows="3"
            placeholder="聊到哪了、约过没有、下次可以聊什么"
            class="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-wx-hint"
          />
        </label>

        <label class="relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">常聊时段（多线时间分区用）</span>
          <input
            v-model="form.chatWindow"
            placeholder="例如 晚上 21:00-23:00"
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-wx-hint"
          />
        </label>
      </div>

      <!-- 危险操作 -->
      <template v-if="!isNew">
        <div class="mx-4 mt-5 overflow-hidden rounded-lg bg-wx-other">
          <button
            type="button"
            class="wx-divider relative w-full px-4 py-3.5 text-left text-[15px] active:bg-black/[0.04]"
            @click="onArchive"
          >
            {{ existing?.archived ? '取消归档' : '归档（不删除记录）' }}
          </button>
          <button
            type="button"
            class="relative w-full px-4 py-3.5 text-left text-[15px] text-wx-danger active:bg-black/[0.04]"
            @click="onDelete"
          >
            删除该对象及其全部记录
          </button>
        </div>
      </template>

      <p class="mt-5 px-8 text-center text-[11px] leading-relaxed text-wx-hint">
        档案只存在本机。每个对象的档案与会话互相隔离，<br />
        生成话术时物理上取不到其他对象的数据。
      </p>
    </div>
  </div>
</template>
