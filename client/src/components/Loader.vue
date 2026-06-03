<template>
  <div v-if="active" class="loader-wrapper">
    <div class="loader">
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
    <p>{{ message }}</p>
  </div>
</template>

<script lang="ts">
export default {
  name: 'Loader',
  props: {
    active: Boolean,
    message: String,
  },
};
</script>

<style scoped>
p {
  font-size: 14px;
  font-weight: 400;
  margin-top: 16px;
  letter-spacing: 2px;
  color: var(--text-secondary);
  font-family: var(--font-sans);
}

.loader-wrapper {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loader {
  display: inline-block;
  position: relative;
  width: 64px;
  height: 64px;
}

.loader div {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 48px;
  height: 48px;
  margin: 8px;
  border: 3px solid var(--accent-gold);
  border-radius: 50%;
  animation: loader 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: var(--accent-gold) transparent transparent transparent;
}

.loader div:nth-child(1) { animation-delay: -0.45s; }
.loader div:nth-child(2) { animation-delay: -0.3s; }
.loader div:nth-child(3) { animation-delay: -0.15s; }

@keyframes loader {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
