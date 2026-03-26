<template>
  <div class="header">
    <div class="title">Dungeon Editor</div>

    <div class="actions">
    <!-- Map Name -->
    <input
        v-model="mapName"
        class="name-input"
        placeholder="Map name..."
    />

    <!-- Open -->
    <button @click="triggerFile">
        <img :src="openIcon" />
    </button>

    <!-- Save -->
    <button @click="saveFile">
        <img :src="saveIcon" />
    </button>
    </div>

    <!-- hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      @change="handleFile"
      hidden
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import openIcon from '@/assets/open.svg?url'
import saveIcon from '@/assets/save.svg?url'

const mapName = ref('New Map')

const props = defineProps<{
  exportMap: () => string
  importMap: (json: string) => void
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function triggerFile() {
  fileInput.value?.click()
}

function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      props.importMap(reader.result)
    }
  }
  reader.readAsText(file)
}

function saveFile() {
  const data = props.exportMap()

  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${mapName.value || 'dungeon-map'}.json`
  a.click()

  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.header {
  height: 48px;
  background: #222;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #444;
}
.title {
  font-size: 14px;
  font-weight: bold;
}
.actions {
  display: flex;
  gap: 8px;
}
button {
  width: 32px;
  height: 32px;
  background: #333;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
button:hover {
  background: #444;
}
img {
  width: 18px;
  height: 18px;
  filter: invert(1); /* makes black SVG white */
}
.name-input {
  height: 28px;
  background: #111;
  border: 1px solid #444;
  color: white;
  border-radius: 4px;
  padding: 0 8px;
  outline: none;
}
.name-input::placeholder {
  color: #888;
}
</style>