<template>
  <div class="header">
    <div class="title">Dungeon Editor</div>

    <div class="actions">
    <input
        v-model="mapName"
        class="name-input"
        placeholder="Map name..."
    />

    <button 
      @click="newFile"
      title="Create a new map"
    >
        <img :src="newIcon" />
    </button>

    <button 
      @click="openFile"
      title="Open an existing map"
    >
        <img :src="openIcon" />
    </button>

    <button 
      @click="saveFile"
      title="Save a local copy of the map (JSON)"
    >
        <img :src="saveIcon" />
    </button>

    <button 
      @click="openExportDialog"
      title="Export the current map as an image"
    >
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
    <h3>Export Image</h3>

    <div class="export-tabs">
      <button
        :class="{ active: exportTab === 'svg' }"
        @click="exportTab = 'svg'"
      >
        SVG
      </button>

      <button
        :class="{ active: exportTab === 'raster' }"
        @click="exportTab = 'raster'"
      >
        PNG / JPEG
      </button>
    </div>

    <template v-if="exportTab === 'svg'">
      <div class="export-section">
      <h4>Layout</h4>
      <label>
        <input type="checkbox" v-model="includeIcon" />
        Include icons
      </label>
      <label>
        <input type="checkbox" v-model="includeTitle" />
        Include the title
      </label>
    </div>
    <hr class="export-divider" />

    <div class="export-section">
      <h4>Colors</h4>

      <div class="export-colors">
        <label>
          Wall / line color
          <input type="color" v-model="lineColor" />
        </label>

        <label>
          Walkable area color
          <input type="color" v-model="fillColor" />
        </label>
      </div>
    </div>
    </template>
    
    <template v-else>
    <div class="export-section">
      <h4>Image Format</h4>

      <label>
        <input
          type="radio"
          value="png"
          v-model="imageFormat"
        />
        PNG
      </label>

      <label>
        <input
          type="radio"
          value="jpeg"
          v-model="imageFormat"
        />
        JPEG
      </label>
    </div>
  </template>

    <div class="dialog-actions">
      <button @click="closeExportDialog">Cancel</button>
      <button @click="exportImage">Export</button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import newIcon from '@/assets/newfile.svg?url'
import openIcon from '@/assets/open.svg?url'
import saveIcon from '@/assets/save.svg?url'
import exportIcon from '@/assets/export.svg?url'

const exportTab = ref<'svg' | 'raster'>('svg')
const imageFormat = ref<'png' | 'jpeg'>('png')

const backgroundColor = ref('#d3d8dd')
const lineColor = ref('#000000')
const fillColor = ref('#f0f8ff')

const mapName = ref('New Map')

const props = defineProps<{
  exportMap: () => string
  importMap: (json: string) => void
  newMap: () => void
  exportSvg: (
    includeIcon: boolean,
    includeTitle: boolean,
    mapTitle: string,
    lineColor: string,
    fillColor: string
  ) => string
  exportImage: (
    format: "png" | "jpeg"
  ) => string
}>()

const exportDialog = ref<HTMLDialogElement | null>(null)
const includeIcon = ref(true)
const includeTitle = ref(true)

function openExportDialog() {
  exportDialog.value?.showModal()
}

function closeExportDialog() {
  exportDialog.value?.close()
}

function exportImage() {
  if (exportTab.value === 'svg') {
    exportSvg()
  } else {
    exportRasterImage()
  }
}

function exportRasterImage() {
  try {
    const dataUrl = props.exportImage(
      imageFormat.value
    )

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${mapName.value || 'dungeon-map'}.${imageFormat.value}`
    a.click()

    closeExportDialog()
  } catch (error) {
    console.error('Failed to export image', error)
    alert('Could not export image')
  }
}

function exportSvg() {
  try {
    const svg = props.exportSvg(
      includeIcon.value,
      includeTitle.value,
      mapName.value.trim(),
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

.export-divider {
  border: none;
  border-top: 1px solid #555;
  margin: 12px 0;
}

.export-dialog {
  min-width: 340px;
}

.export-dialog h3 {
  margin: 0 0 16px;
}

.export-section {
  padding: 14px 0;
  /* border-top: 1px solid #444; */
}

.export-section h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.export-section label {
  margin: 8px 0;
}

.export-section input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #8caaff;
}

.export-tabs {
  display: flex;
  gap: 8px;
  margin: 16px 0;
  border-bottom: 1px solid #555;
}

.export-tabs button {
  width: auto;
  height: auto;
  flex: 1;
  padding: 10px 16px;
  color: #aaa;
  background: transparent;
  border-radius: 0;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}

.export-tabs button:hover {
  color: white;
  background: #333;
}

.export-tabs button.active {
  color: white;
  border-bottom-color: aliceblue;
}
</style>