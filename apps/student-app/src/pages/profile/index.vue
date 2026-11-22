<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import type { ProfileDto, SkillDto } from '@codestrike/contracts'
import { createStudentApiClient } from '../../api/client'
import { toStatePanel } from '../../api/error-presentation'
import { sessionUser } from '../../api/session'
import CsBottomNav from '../../components/CsBottomNav.vue'
import CsHeader from '../../components/CsHeader.vue'
import StatePanel from '../../components/StatePanel.vue'

const api = createStudentApiClient()
const loading = ref(true)
const saving = ref(false)
const errorTitle = ref('')
const errorMessage = ref('')
const notice = ref('')
const noticeFailed = ref(false)
const profile = ref<ProfileDto | null>(null)
const catalog = ref<SkillDto[]>([])
const selectedSkillIds = ref<string[]>([])

const name = ref('')
const college = ref('')
const major = ref('')
const academicYear = ref('')
const sex = ref('')
const briefCv = ref('')
const wechatId = ref('')
const qqId = ref('')
const mbti = ref('')
const hobbies = ref('')

const MISSING_LABELS: Record<string, string> = {
  name: 'Name',
  college: 'College',
  major: 'Major',
  academicYear: 'Academic year',
  sex: 'Sex',
  briefCv: 'Brief CV',
  skills: 'Skill tags',
  contact: 'Contact (WeChat or QQ)',
}

const missingLabels = computed(() =>
  (profile.value?.missingFields ?? []).map((field) => MISSING_LABELS[field] ?? field),
)
const signedIn = computed(() => sessionUser.value !== null)

onShow(load)

async function load() {
  loading.value = true
  errorTitle.value = ''
  errorMessage.value = ''
  try {
    await api.restoreSession()
    if (!sessionUser.value) {
      profile.value = null
      return
    }
    const [ownProfile, skills] = await Promise.all([api.getProfile(), api.listSkills()])
    catalog.value = skills
    applyProfile(ownProfile)
  } catch (error) {
    const panel = toStatePanel(error)
    errorTitle.value = panel.title
    errorMessage.value = panel.message
  } finally {
    loading.value = false
  }
}

function applyProfile(value: ProfileDto) {
  profile.value = value
  name.value = value.name ?? ''
  college.value = value.college ?? ''
  major.value = value.major ?? ''
  academicYear.value = value.academicYear ?? ''
  sex.value = value.sex ?? ''
  briefCv.value = value.briefCv ?? ''
  wechatId.value = value.wechatId ?? ''
  qqId.value = value.qqId ?? ''
  mbti.value = value.mbti ?? ''
  hobbies.value = value.hobbies ?? ''
  selectedSkillIds.value = [...value.skillIds]
}

function toggleSkill(id: string) {
  selectedSkillIds.value = selectedSkillIds.value.includes(id)
    ? selectedSkillIds.value.filter((item) => item !== id)
    : [...selectedSkillIds.value, id]
}

async function save() {
  if (saving.value) return
  saving.value = true
  errorTitle.value = ''
  errorMessage.value = ''
  notice.value = ''
  noticeFailed.value = false
  try {
    await api.saveProfile({
      name: name.value.trim(),
      college: college.value.trim(),
      major: major.value.trim(),
      academicYear: academicYear.value.trim(),
      sex: sex.value.trim(),
      briefCv: briefCv.value.trim(),
      wechatId: wechatId.value.trim(),
      qqId: qqId.value.trim(),
      mbti: mbti.value.trim(),
      hobbies: hobbies.value.trim(),
      skillIds: selectedSkillIds.value,
    })
    const saved = await api.getProfile()
    applyProfile(saved)
    notice.value = saved.complete
      ? 'Profile saved. Every required field is present.'
      : 'Profile saved. Some required fields are still missing.'
    noticeFailed.value = !saved.complete
  } catch (error) {
    const panel = toStatePanel(error)
    errorTitle.value = panel.title
    errorMessage.value = panel.message
    noticeFailed.value = true
  } finally {
    saving.value = false
  }
}

async function signOut() {
  try {
    await api.logout()
  } catch (error) {
    const panel = toStatePanel(error)
    errorTitle.value = panel.title
    errorMessage.value = panel.message
  }
  profile.value = null
  uni.reLaunch({ url: '/pages/auth/login' })
}

function openLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}
function openRegister() {
  uni.navigateTo({ url: '/pages/auth/register' })
}
</script>

<template>
  <view class="page-shell">
    <CsHeader eyebrow="Account" title="My profile" />
    <view class="content">
      <StatePanel v-if="loading" title="Loading your profile" message="Reading your account from CodeStrike." />

      <template v-else-if="!signedIn">
        <view class="intro">
          <text class="intro__title">Sign in to continue</text>
          <text class="intro__copy">Your profile, planner and team memberships belong to one account.</text>
        </view>
        <view class="form-card">
          <text class="form-heading">Account</text>
          <text class="copy">Sign in with the username you registered, or create a new account to join a competition.</text>
          <button class="primary" @click="openLogin">Sign in</button>
          <button class="secondary" @click="openRegister">Create an account</button>
        </view>
      </template>

      <template v-else>
        <view class="identity">
          <view class="identity__mark"><text>CS</text></view>
          <view class="identity__copy">
            <text class="identity__name">{{ sessionUser?.username }}</text>
            <text class="identity__role">{{ sessionUser?.role }} account</text>
          </view>
        </view>

        <view v-if="profile && !profile.complete" class="notice">
          <text class="notice__title">Profile is not complete yet</text>
          <text class="notice__copy">Add {{ missingLabels.join(', ') }} to unlock applications, posts and team creation.</text>
        </view>
        <view v-else-if="profile" class="notice notice--ready">
          <text class="notice__title">Profile is complete</text>
          <text class="notice__copy">You can apply to teams, post in communities and create a team.</text>
        </view>

        <view v-if="errorMessage" class="feedback">
          <text class="feedback__title">{{ errorTitle || 'Something went wrong' }}</text>
          <text class="feedback__copy">{{ errorMessage }}</text>
        </view>
        <view v-if="notice" class="feedback" :class="{ success: !noticeFailed }">
          <text class="feedback__copy">{{ notice }}</text>
        </view>

        <view class="form-card">
          <text class="form-heading">Your details</text>
          <text class="label">Name</text>
          <input v-model="name" class="input" maxlength="100" placeholder="Your real name" />
          <text class="label field">College</text>
          <input v-model="college" class="input" maxlength="200" placeholder="Your college or school" />
          <text class="label field">Major</text>
          <input v-model="major" class="input" maxlength="200" placeholder="Your major" />
          <text class="label field">Academic year</text>
          <input v-model="academicYear" class="input" maxlength="40" placeholder="e.g. 2026" />
          <text class="label field">Sex</text>
          <input v-model="sex" class="input" maxlength="30" placeholder="Optional for your cohort" />
          <text class="label field">Brief CV</text>
          <textarea v-model="briefCv" class="textarea" maxlength="2000" placeholder="A short introduction a captain can read." />
          <text class="label field">WeChat ID</text>
          <input v-model="wechatId" class="input" maxlength="100" placeholder="Needed with a QQ ID for contact" />
          <text class="label field">QQ ID</text>
          <input v-model="qqId" class="input" maxlength="100" placeholder="Needed with a WeChat ID for contact" />
          <text class="label field">MBTI</text>
          <input v-model="mbti" class="input" maxlength="4" placeholder="Optional, for example INFJ" />
          <text class="label field">Hobbies</text>
          <input v-model="hobbies" class="input" maxlength="200" placeholder="Optional" />
        </view>

        <view class="form-card">
          <text class="form-heading">Skill tags</text>
          <text class="copy">Pick tags from the catalog the administrators maintain. New tags are added by the team.</text>
          <view v-if="catalog.length === 0" class="empty">
            <text class="empty__title">The catalog is empty</text>
            <text class="empty__copy">No skill tags are published yet. Ask an administrator to add the first one.</text>
          </view>
          <view v-else class="skills">
            <button v-for="skill in catalog" :key="skill.id" :class="{ active: selectedSkillIds.includes(skill.id) }" @click="toggleSkill(skill.id)">{{ skill.name }}</button>
          </view>
          <text v-if="selectedSkillIds.length > 0" class="hint">{{ selectedSkillIds.length }} selected</text>
        </view>

        <view class="actions">
          <button class="primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save profile' }}</button>
          <button class="secondary" @click="signOut">Sign out</button>
        </view>
      </template>
    </view>
    <CsBottomNav active="Me" />
  </view>
</template>

<style scoped>
.content { max-width: 620px; margin: 0 auto; padding: 20px 16px; padding-bottom: calc(128px + constant(safe-area-inset-bottom)); padding-bottom: calc(128px + env(safe-area-inset-bottom)); }
.intro__title,.intro__copy,.form-heading,.label,.hint,.copy,.feedback__title,.feedback__copy,.notice__title,.notice__copy,.empty__title,.empty__copy { display: block; }
.intro__title { color: #14213d; font-size: 26px; font-weight: 780; line-height: 1.2; }
.intro__copy { margin-top: 6px; color: #667085; font-size: 15px; line-height: 1.5; }
.identity { display: flex; align-items: center; gap: 12px; padding: 16px; background: #fff; border: 1px solid #dfe4ea; border-radius: 17px; }
.identity__mark { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: 0 0 auto; color: #14213d; background: #c9f43d; border-radius: 13px; font-size: 13px; font-weight: 800; }
.identity__copy { min-width: 0; }
.identity__name { display: block; overflow: hidden; color: #14213d; font-size: 19px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.identity__role { display: block; margin-top: 2px; color: #667085; font-size: 13px; }
.notice { margin-top: 14px; padding: 14px 16px; color: #6f4a00; background: #fff8e7; border: 1px solid #f1dfae; border-radius: 14px; }
.notice--ready { color: #075b49; background: #edf8f4; border-color: #cbe9df; }
.notice__title { font-size: 15px; font-weight: 750; }.notice__copy { margin-top: 3px; font-size: 14px; line-height: 1.45; }
.form-card { margin-top: 14px; padding: 18px; background: #fff; border: 1px solid #dfe4ea; border-radius: 17px; }
.form-heading { margin-bottom: 12px; color: #14213d; font-size: 20px; font-weight: 750; }
.copy { color: #667085; font-size: 14px; line-height: 1.5; }
.label { color: #475467; font-size: 14px; font-weight: 700; }.field { margin-top: 20px; }
.input { width: 100%; min-height: 46px; margin-top: 7px; padding: 12px 13px; color: #14213d; background: #f7f9fb; border: 1px solid #dfe4ea; border-radius: 11px; font-size: 15px; }
.textarea { width: 100%; min-height: 96px; margin-top: 7px; padding: 12px 13px; color: #14213d; background: #f7f9fb; border: 1px solid #dfe4ea; border-radius: 11px; font-size: 15px; line-height: 1.5; }
.hint { margin-top: 9px; color: #667085; font-size: 13px; line-height: 1.4; }
.skills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.skills button { min-height: 40px; margin: 0; padding: 0 11px; color: #475467; background: #eef3f8; border: 1px solid transparent; border-radius: 9px; font-size: 13px; }
.skills button.active { color: #1d4ed8; background: #eaf1ff; border-color: #bcd0f2; font-weight: 700; }
.empty { margin-top: 12px; padding: 14px; background: #f7f9fb; border: 1px dashed #dfe4ea; border-radius: 12px; }
.empty__title { color: #344054; font-size: 14px; font-weight: 700; }.empty__copy { margin-top: 3px; color: #667085; font-size: 13px; line-height: 1.45; }
.actions { margin-top: 16px; }
.primary { width: 100%; min-height: 48px; margin: 0; color: #fff; background: #2563eb; border-radius: 12px; font-size: 15px; font-weight: 700; }
.primary[disabled] { opacity: .55; }
.secondary { width: 100%; min-height: 48px; margin: 10px 0 0; color: #344054; background: #fff; border: 1px solid #dfe4ea; border-radius: 12px; font-size: 15px; font-weight: 700; }
.feedback { margin-top: 14px; padding: 15px; color: #8a3c34; background: #fff0ec; border: 1px solid #f1d1ca; border-radius: 14px; }
.feedback.success { color: #126b57; background: #edf8f4; border-color: #cbe9df; }
.feedback__title { font-size: 15px; font-weight: 750; }.feedback__copy { font-size: 14px; line-height: 1.5; }
@media(min-width:680px){.content{padding:28px 40px calc(138px + env(safe-area-inset-bottom));}}
</style>
