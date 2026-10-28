<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // Assignment 4 remains deterministic Mock mode. No account or backend is connected.
})
</script>

<style>
page {
  min-height: 100%;
  background: #f5f7fa;
  color: #14213d;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.5;
}
view, text, button, input, scroll-view { box-sizing: border-box; }
button, input { font: inherit; }
button { min-height: 44px; transition: transform .16s ease, background-color .16s ease, opacity .16s ease; }
button:active { transform: scale(.985); }
button::after { border: 0; }
.page-shell { min-height: 100vh; min-height: 100dvh; background: #f5f7fa; }
@media (min-width: 680px) {
  page { background: #edf1f5; }
  .page-shell { max-width: 1120px; margin: 0 auto; border-right: 1px solid #dfe4ea; border-left: 1px solid #dfe4ea; }
}
</style>
