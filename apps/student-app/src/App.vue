<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // Assignment 4 remains deterministic Mock mode. No account or backend is connected.
})
</script>

<style>
page {
  min-height: 100%;
  background: #f2f5f8;
  color: #0a1830;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
view, text, button, input, scroll-view { box-sizing: border-box; }
button { font-family: inherit; }
button::after { border: 0; }
.page-shell { min-height: 100vh; background: #f2f5f8; }
@media (min-width: 680px) {
  page { background: #e9eef3; }
  .page-shell { max-width: 1120px; margin: 0 auto; box-shadow: 0 0 80px rgba(10,24,48,.12); }
}
</style>
