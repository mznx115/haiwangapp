<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { useSettingsStore } from '@/stores/settings'
import { SKILL_NAME, SKILL_VERSION } from '@/skills'

const router = useRouter()
const settings = useSettingsStore()

const editing = ref(false)
const draft = ref({ ...settings.persona })

function startEdit() {
  draft.value = { ...settings.persona }
  editing.value = true
}

function save() {
  settings.persona = { ...draft.value }
  editing.value = false
}

function cancel() {
  editing.value = false
}

const hasInfo = computed(
  () =>
    settings.persona.nickname ||
    settings.persona.age ||
    settings.persona.traits ||
    settings.persona.speechStyle ||
    settings.persona.boundaries,
)
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="我" :back="false">
      <template #right>
        <button
          v-if="!editing"
          type="button"
          class="rounded-md px-3 py-1 text-[14px] text-[#576b95] active:opacity-60"
          @click="startEdit"
        >
          编辑
        </button>
        <template v-else>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-[14px] text-wx-sub active:opacity-60"
            @click="cancel"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-[14px] text-wx-brand active:opacity-60"
            @click="save"
          >
            完成
          </button>
        </template>
      </template>
    </NavBar>

    <div class="scroll-area min-h-0 flex-1 pb-6">
      <!-- 头部 -->
      <div class="flex items-center gap-4 bg-wx-panel px-4 py-5">
        <span
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-wx-brand text-[24px] text-white"
        >
          {{ (settings.persona.nickname || '我').slice(0, 1) }}
        </span>
        <div class="min-w-0 flex-1">
          <input
            v-if="editing"
            v-model="draft.nickname"
            placeholder="我的昵称 / 代号"
            class="w-full bg-transparent text-[18px] outline-none placeholder:text-wx-hint"
          />
          <p v-else class="truncate text-[18px] font-medium">
            {{ settings.persona.nickname || '未设置昵称' }}
          </p>
          <p class="mt-1 truncate text-[13px] text-wx-sub">
            {{ settings.persona.speechStyle || '还没填写说话风格' }}
          </p>
        </div>
      </div>

      <!-- 人设卡 -->
      <p class="flex items-center justify-between px-4 pt-5 pb-2 text-[13px] text-wx-sub">
        <span>我的人设卡（注入为 L3 层）</span>
        <span v-if="!editing" class="text-[11px] text-wx-hint">所有话术都会符合这个人设</span>
      </p>

      <div v-if="!editing" class="mx-4 rounded-lg bg-wx-other p-4 text-[13px] leading-relaxed">
        <p v-if="!hasInfo" class="text-wx-sub">
          还没填写。人设卡会作为 L3 层注入每一次请求，
          保证生成的话术都是「你」在说，而不是一个通用 AI 的口吻。
        </p>
        <dl v-else class="space-y-2.5">
          <div v-if="settings.persona.age">
            <dt class="text-wx-hint">年龄</dt>
            <dd>{{ settings.persona.age }}</dd>
          </div>
          <div v-if="settings.persona.traits">
            <dt class="text-wx-hint">性格</dt>
            <dd>{{ settings.persona.traits }}</dd>
          </div>
          <div v-if="settings.persona.speechStyle">
            <dt class="text-wx-hint">说话风格</dt>
            <dd>{{ settings.persona.speechStyle }}</dd>
          </div>
          <div v-if="settings.persona.boundaries">
            <dt class="text-wx-hint">绝对底线</dt>
            <dd>{{ settings.persona.boundaries }}</dd>
          </div>
        </dl>
      </div>

      <div v-else class="mx-4 overflow-hidden rounded-lg bg-wx-other">
        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">年龄 / 身份</span>
          <input
            v-model="draft.age"
            placeholder="例如 28 岁，做产品的"
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-wx-hint"
          />
        </label>
        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">性格</span>
          <textarea
            v-model="draft.traits"
            rows="2"
            placeholder="例如 慢热但真诚、有点冷幽默、不油腻"
            class="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-wx-hint"
          />
        </label>
        <label class="wx-divider relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">说话风格</span>
          <textarea
            v-model="draft.speechStyle"
            rows="2"
            placeholder="例如 短句为主、少用表情、不说土味情话"
            class="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-wx-hint"
          />
        </label>
        <label class="relative block px-4 py-3">
          <span class="mb-1 block text-[12px] text-wx-sub">绝对底线</span>
          <textarea
            v-model="draft.boundaries"
            rows="2"
            placeholder="例如 不撒谎、不隐瞒、不脚踏多条船"
            class="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-wx-hint"
          />
        </label>
      </div>

      <!-- 设置入口 -->
      <div class="mt-5 overflow-hidden rounded-lg bg-wx-other">
        <button
          type="button"
          class="wx-divider relative flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-black/[0.04]"
          @click="router.push('/skill')"
        >
          <span>技能包</span>
          <span class="text-[13px] text-wx-sub">{{ SKILL_NAME }} v{{ SKILL_VERSION }} ›</span>
        </button>
        <button
          type="button"
          class="relative flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-black/[0.04]"
          @click="router.push('/settings')"
        >
          <span>设置</span>
          <span
            class="text-[13px]"
            :class="settings.isConfigured() ? 'text-wx-sub' : 'text-wx-danger'"
          >
            {{ settings.isConfigured() ? '已配置 ›' : '未配置 API ›' }}
          </span>
        </button>
      </div>

      <p class="mt-6 px-8 text-center text-[11px] leading-relaxed text-wx-hint">
        本应用的目标是提升社交能力、学会真诚沟通、把握社交分寸，<br />
        而非教用户玩弄感情。请自行承担社交行为的全部后果。
      </p>
    </div>
  </div>
</template>
