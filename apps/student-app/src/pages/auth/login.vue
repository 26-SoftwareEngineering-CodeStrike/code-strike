<script setup lang="ts">
import { ref } from 'vue'
import { createStudentApiClient } from '../../api/client'
import { toStatePanel } from '../../api/error-presentation'
import { sessionUser } from '../../api/session'
import CsHeader from '../../components/CsHeader.vue'

const api = createStudentApiClient()
const username = ref('')
const password = ref('')
const submitting = ref(false)
const errorTitle = ref('')
const errorMessage = ref('')
const fieldError = ref('')

async function signIn() {
  if (submitting.value) return
  const name = username.value.trim()
  if (!name) {
    fieldError.value = 'Enter your username.'
    return
  }
  if (!password.value) {
    fieldError.value = 'Enter your password.'
    return
  }
  fieldError.value = ''
  errorTitle.value = ''
  errorMessage.value = ''
  submitting.value = true
  try {
    await api.login({ username: name, password: password.value })
    password.value = ''
    uni.reLaunch({ url: '/pages/profile/index' })
  } catch (error) {
    const panel = toStatePanel(error)
    errorTitle.value = panel.title
    errorMessage.value = panel.message
  } finally {
    submitting.value = false
  }
}

function openRegister() {
  uni.navigateTo({ url: '/pages/auth/register' })
}

function openProfile() {
  uni.reLaunch({ url: '/pages/profile/index' })
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Account" title="Sign in" />
    <view class="content">
      <view class="intro">
        <text class="intro__title">Welcome back</text>
        <text class="intro__copy">Sign in to reach your teams, planner and profile.</text>
      </view>

      <view v-if="sessionUser" class="notice notice--ready">
        <text class="notice__title">Already signed in</text>
        <text class="notice__copy">You are signed in as {{ sessionUser.username }}.</text>
        <button class="secondary" @click="openProfile">Open my profile</button>
      </view>

      <view class="form-card">
        <text class="form-heading">Your account</text>
        <text class="label">Username</text>
        <input v-model="username" class="input" maxlength="64" placeholder="e.g. orbit_captain" />
        <text class="label field">Password</text>
        <input v-model="password" class="input" password maxlength="128" placeholder="Your password" />
        <text class="hint">Use the username you registered with.</text>
        <text v-if="fieldError" class="field-error">{{ fieldError }}</text>
        <button class="primary" :disabled="submitting" @click="signIn">{{ submitting ? 'Signing in…' : 'Sign in' }}</button>
        <view class="switch-row">
          <text class="switch-row__copy">New to CodeStrike?</text>
          <button class="link" @click="openRegister">Create an account</button>
        </view>
      </view>

      <view v-if="errorMessage" class="feedback">
        <text class="feedback__title">{{ errorTitle || 'Sign in failed' }}</text>
        <text class="feedback__copy">{{ errorMessage }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.content { max-width: 560px; margin: 0 auto; padding: 20px 16px 40px; }
.intro__title,.intro__copy,.form-heading,.label,.hint,.field-error,.feedback__title,.feedback__copy,.notice__title,.notice__copy { display: block; }
.intro__title { color: #14213d; font-size: 26px; font-weight: 780; line-height: 1.2; }
.intro__copy { margin-top: 6px; color: #667085; font-size: 15px; line-height: 1.5; }
.notice { margin-top: 14px; padding: 14px 16px; color: #075b49; background: #edf8f4; border: 1px solid #cbe9df; border-radius: 14px; }
.notice__title { font-size: 15px; font-weight: 750; }.notice__copy { margin-top: 3px; font-size: 14px; line-height: 1.45; }
.form-card { margin-top: 14px; padding: 18px; background: #fff; border: 1px solid #dfe4ea; border-radius: 17px; }
.form-heading { margin-bottom: 16px; color: #14213d; font-size: 20px; font-weight: 750; }
.label { color: #475467; font-size: 14px; font-weight: 700; }.field { margin-top: 20px; }
.input { width: 100%; min-height: 46px; margin-top: 7px; padding: 12px 13px; color: #14213d; background: #f7f9fb; border: 1px solid #dfe4ea; border-radius: 11px; font-size: 15px; }
.hint { margin-top: 6px; color: #667085; font-size: 13px; line-height: 1.4; }
.field-error { margin-top: 10px; color: #a33b32; font-size: 13px; line-height: 1.4; }
.primary { width: 100%; min-height: 48px; margin: 20px 0 0; color: #fff; background: #2563eb; border-radius: 12px; font-size: 15px; font-weight: 700; }
.primary[disabled] { opacity: .55; }
.secondary { min-height: 44px; margin: 12px 0 0; padding: 0 14px; color: #2563eb; background: #eaf1ff; border: 1px solid #bcd0f2; border-radius: 10px; font-size: 14px; font-weight: 700; }
.switch-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; }
.switch-row__copy { color: #667085; font-size: 13px; }
.link { min-height: 44px; margin: 0; padding: 0 6px; color: #2563eb; background: transparent; font-size: 13px; font-weight: 700; }
.feedback { margin-top: 14px; padding: 15px; color: #8a3c34; background: #fff0ec; border: 1px solid #f1d1ca; border-radius: 14px; }
.feedback__title { font-size: 15px; font-weight: 750; }.feedback__copy { margin-top: 4px; font-size: 14px; line-height: 1.5; }
@media(min-width:680px){.content{padding:28px 40px 48px;}}
</style>
