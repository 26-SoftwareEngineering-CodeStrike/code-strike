<script setup lang="ts">
import { ref } from 'vue'
import { createStudentApiClient } from '../../api/client'
import { toStatePanel } from '../../api/error-presentation'
import CsHeader from '../../components/CsHeader.vue'

const api = createStudentApiClient()
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const errorTitle = ref('')
const errorMessage = ref('')
const usernameError = ref('')
const passwordError = ref('')

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/

function validate(): boolean {
  const name = username.value.trim()
  usernameError.value = ''
  passwordError.value = ''
  if (name.length < 3 || name.length > 64) {
    usernameError.value = 'Use 3 to 64 characters.'
  } else if (!USERNAME_PATTERN.test(name)) {
    usernameError.value = 'Use letters, numbers, dot, dash or underscore only.'
  }
  if (password.value.length < 10) {
    passwordError.value = 'Use at least 10 characters.'
  } else if (password.value.length > 128) {
    passwordError.value = 'Use at most 128 characters.'
  } else if (confirmPassword.value !== password.value) {
    passwordError.value = 'The two passwords do not match.'
  }
  return !usernameError.value && !passwordError.value
}

async function createAccount() {
  if (submitting.value) return
  if (!validate()) return
  errorTitle.value = ''
  errorMessage.value = ''
  submitting.value = true
  try {
    await api.register({ username: username.value.trim(), password: password.value })
    password.value = ''
    confirmPassword.value = ''
    uni.reLaunch({ url: '/pages/profile/index' })
  } catch (error) {
    const panel = toStatePanel(error)
    errorTitle.value = panel.title
    errorMessage.value = panel.message
  } finally {
    submitting.value = false
  }
}

function openLogin() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/auth/login' }) })
}
</script>

<template>
  <view class="page-shell">
    <CsHeader back eyebrow="Account" title="Create account" />
    <view class="content">
      <view class="intro">
        <text class="intro__title">Join CodeStrike</text>
        <text class="intro__copy">One account for competitions, teams and your private planner.</text>
      </view>

      <view class="form-card">
        <text class="form-heading">Your account</text>
        <text class="label">Username</text>
        <input v-model="username" class="input" maxlength="64" placeholder="e.g. orbit_captain" />
        <text v-if="usernameError" class="field-error">{{ usernameError }}</text>
        <text class="hint">3 to 64 characters. It is the public label on your posts and applications.</text>
        <text class="label field">Password</text>
        <input v-model="password" class="input" password maxlength="128" placeholder="At least 10 characters" />
        <text class="label field">Confirm password</text>
        <input v-model="confirmPassword" class="input" password maxlength="128" placeholder="Repeat your password" />
        <text v-if="passwordError" class="field-error">{{ passwordError }}</text>
        <button class="primary" :disabled="submitting" @click="createAccount">{{ submitting ? 'Creating…' : 'Create account' }}</button>
        <view class="switch-row">
          <text class="switch-row__copy">Already registered?</text>
          <button class="link" @click="openLogin">Sign in instead</button>
        </view>
      </view>

      <view class="notice">
        <text class="notice__title">About email recovery</text>
        <text class="notice__copy">Binding an email address for password recovery needs a working mail server and is delivered with a later sprint task. It is not required to sign in.</text>
      </view>

      <view v-if="errorMessage" class="feedback">
        <text class="feedback__title">{{ errorTitle || 'Registration failed' }}</text>
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
.form-card { margin-top: 14px; padding: 18px; background: #fff; border: 1px solid #dfe4ea; border-radius: 17px; }
.form-heading { margin-bottom: 16px; color: #14213d; font-size: 20px; font-weight: 750; }
.label { color: #475467; font-size: 14px; font-weight: 700; }.field { margin-top: 20px; }
.input { width: 100%; min-height: 46px; margin-top: 7px; padding: 12px 13px; color: #14213d; background: #f7f9fb; border: 1px solid #dfe4ea; border-radius: 11px; font-size: 15px; }
.hint { margin-top: 6px; color: #667085; font-size: 13px; line-height: 1.4; }
.field-error { margin-top: 10px; color: #a33b32; font-size: 13px; line-height: 1.4; }
.primary { width: 100%; min-height: 48px; margin: 20px 0 0; color: #fff; background: #2563eb; border-radius: 12px; font-size: 15px; font-weight: 700; }
.primary[disabled] { opacity: .55; }
.switch-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; }
.switch-row__copy { color: #667085; font-size: 13px; }
.link { min-height: 44px; margin: 0; padding: 0 6px; color: #2563eb; background: transparent; font-size: 13px; font-weight: 700; }
.notice { margin-top: 14px; padding: 14px 16px; color: #6f4a00; background: #fff8e7; border: 1px solid #f1dfae; border-radius: 14px; }
.notice__title { font-size: 15px; font-weight: 750; }.notice__copy { margin-top: 3px; font-size: 14px; line-height: 1.45; }
.feedback { margin-top: 14px; padding: 15px; color: #8a3c34; background: #fff0ec; border: 1px solid #f1d1ca; border-radius: 14px; }
.feedback__title { font-size: 15px; font-weight: 750; }.feedback__copy { margin-top: 4px; font-size: 14px; line-height: 1.5; }
@media(min-width:680px){.content{padding:28px 40px 48px;}}
</style>
