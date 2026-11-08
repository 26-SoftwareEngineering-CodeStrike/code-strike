<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // Phase 1 deliberately starts in deterministic Mock mode.
})
</script>

<style>
page {
  min-height: 100%;
  background: #f4f7fb;
  color: #172033;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button::after { border: 0; }
</style>
