<template>
  <div class="header">
    <div class="title">Dungeon Editor</div>

    <div class="actions">
    <input
        v-model="mapName"
        class="name-input"
        placeholder="Map name..."
    />

    <button @click="newFile">
        <img :src="newIcon" />
    </button>

    <button @click="openFile">
        <img :src="openIcon" />
    </button>

    <button @click="saveFile">
        <img :src="saveIcon" />
    </button>

    <button @click="openExportDialog">
        <img :src="exportIcon" />
    </button>

    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      @change="handleFile"
      hidden
    />
  </div>

  <dialog ref="exportDialog">
  <h3>Export SVG</h3>

  <label>
    <input
      type="radio"
      v-model="exportMode"
      value="walls"
    />
    Do not include icons
  </label>

  <label>
    <input
      type="radio"
      v-model="exportMode"
      value="all"
    />
    Include icons
  </label>

  <div class="export-colors">
    <label>
      Wall / line color
      <input
        type="color"
        v-model="lineColor"
      />
    </label>

    <label>
      Walkable area color
      <input
        type="color"
        v-model="fillColor"
      />
    </label>
  </div>

  <div class="dialog-actions">
    <button @click="closeExportDialog">Cancel</button>
    <button @click="exportSvg">Export</button>
  </div>
</dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import newIcon from '@/assets/newfile.svg?url'
import openIcon from '@/assets/open.svg?url'
import saveIcon from '@/assets/save.svg?url'
import exportIcon from '@/assets/export.svg?url'

const lineColor = ref('#000000')
const fillColor = ref('#f0f8ff')

const mapName = ref('New Map')

const props = defineProps<{
  exportMap: () => string
  importMap: (json: string) => void
  newMap: () => void
  exportSvg: (
    includeIcons: boolean,
    lineColor: string,
    fillColor: string
  ) => string
}>()

const exportDialog = ref<HTMLDialogElement | null>(null)
const exportMode = ref<'walls' | 'all'>('all')

function openExportDialog() {
  exportDialog.value?.showModal()
}

function closeExportDialog() {
  exportDialog.value?.close()
}

function exportSvg() {
  try {
    const svg = props.exportSvg(
      exportMode.value === 'all',
      lineColor.value,
      fillColor.value
    )

    const blob = new Blob([svg], {
      type: 'image/svg+xml;charset=utf-8'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `${mapName.value || 'dungeon-map'}.svg`
    a.click()

    setTimeout(() => URL.revokeObjectURL(url), 1000)
    closeExportDialog()
  } catch (error) {
    console.error('Failed to export SVG', error)
    alert('Could not export SVG')
  }
}

const fileInput = ref<HTMLInputElement | null>(null)

function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== 'string') return

    try {
      const data = JSON.parse(reader.result)
      props.importMap(reader.result)
      mapName.value = file.name.replace(/\.json$/i, '')
    } catch (error) {
      console.error('Failed to open map:', error)
    }
  }
  reader.readAsText(file)
}

function newFile() {
  const confirmed = window.confirm(
    'Create a new map? The current map will be cleared.'
  )
  if (confirmed) {
    props.newMap()
    mapName.value = 'New Map'
  }
  else {
    return
  }
}

function openFile() {
  if (!fileInput.value) return
  fileInput.value.value = ''
  fileInput.value.click()
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

dialog {
  border: 1px solid #555;
  border-radius: 8px;
  background: #222;
  color: white;
  padding: 24px;
  min-width: 300px;
}

dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
}

dialog label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.dialog-actions button {
  width: auto;
  height: auto;
  min-width: 80px;
  padding: 8px 16px;
  white-space: nowrap;
  color: aliceblue;
}

.export-colors {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}

.export-colors label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.export-colors input[type="color"] {
  width: 48px;
  height: 32px;
  cursor: pointer;
}

.dialog-actions button {
  width: auto;
  height: auto;
  min-width: 80px;
  padding: 8px 16px;
  white-space: nowrap;
}
</style>