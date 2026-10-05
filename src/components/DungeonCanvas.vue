<template>
  <canvas 
  ref="canvas" 
  :width="canvasSize" 
  :height="canvasSize"
  style="background-color: aliceblue;"
  @click="handleClick"
  @wheel="handleWheel"
  @mousedown="handleMouseDown"
  @mousemove="handleMouseMove"
  @mouseup="handleMouseUp"
  @mouseleave="handleMouseUp"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import doorClosedIcon from '@/assets/legend/doorclosed.svg?url'
import downStairIcon from '@/assets/legend/downstair.svg?url'
import upStairIcon from '@/assets/legend/upstair.svg?url'
defineExpose({
  exportMap,
  importMap
})

//////////////////////////
// Constants and Types
//////////////////////////
const size = 20 // Default 20
const tileSize = 32
const axisPadding = 24
const zoomMin = 0.7
const zoomMax = 2.0
const canvasSize = size * tileSize + axisPadding * 2
const axisOffsetX = axisPadding
const axisOffsetY = axisPadding
const N = 1 as const
const E = 2 as const
const S = 4 as const
const W = 8 as const
const props = defineProps<{
  tool: 'wall' | 'door' | 'downstair' | 'upstair'
}>()
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const showZoomIndicator = ref(false)
let lastMouse = { x: 0, y: 0 }
let hasDragged = false
let zoomTimeout: number | null = null

type Edge = typeof N | typeof E | typeof S | typeof W
type Cell = {
  walls: number             // bitmask (N,E,S,W)
  doors: number             // 0: No door | 1: Door closed
  upstair: number           // 0: No upstair | 1: Upstair
  downstair: number         // 0: No downstair | 1: Downstair
}

const AUTOSAVE_KEY = 'map-autosave'

//////////////////////////
// Image Assets
//////////////////////////
const doorImg = new Image()
doorImg.onload = () => {
  draw()
}
doorImg.onerror = (e) => {
  console.error('Failed to load Door SVG', e)
}
doorImg.crossOrigin = 'anonymous'
doorImg.src = doorClosedIcon

const downStairImg = new Image()
downStairImg.onload = () => {
  draw()
}
downStairImg.onerror = (e) => {
  console.error('Failed to load Down Stair SVG', e)
}
downStairImg.crossOrigin = 'anonymous'
downStairImg.src = downStairIcon

const upStairImg = new Image()
upStairImg.onload = () => {
  draw()
}
upStairImg.onerror = (e) => {
  console.error('Failed to load Up Stair SVG', e)
}
upStairImg.crossOrigin = 'anonymous'
upStairImg.src = upStairIcon

//////////////////////////
// State
//////////////////////////
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const grid: Cell[][] = Array.from({ length: size }, () =>
  Array.from({ length: size }, (): Cell => ({
    walls: 0,
    doors: 0,
    upstair: 0,
    downstair: 0
  }))
)

onMounted(() => {
  if (!canvas.value) return
  const context = canvas.value.getContext('2d')
  if (!context) return

  ctx = context

  const dpr = window.devicePixelRatio || 1
  canvas.value.width = canvasSize * dpr
  canvas.value.height = canvasSize * dpr
  canvas.value.style.width = `${canvasSize}px`
  canvas.value.style.height = `${canvasSize}px`
  
  ctx.scale(dpr, dpr)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  loadAutoSave()
  draw()
})

function importMap(json: string): void {
  try {
    const data = JSON.parse(json)

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const src = data[y]?.[x]
        if (!src) continue

        grid[y]![x]!.walls = src.walls ?? 0
        grid[y]![x]!.doors = src.doors ?? 0
        grid[y]![x]!.upstair = src.upstair ?? 0
        grid[y]![x]!.downstair = src.downstair ?? 0
      }
    }

    draw()
  } catch (e) {
    console.error('Invalid map JSON', e)
  }
}

function applyTool(x: number, y: number, edge?: Edge): void {
  const tool = props.tool

  switch (tool) {
    case 'wall':
      if (edge != undefined) {
        toggleWall(x, y, edge)
      }
      break
    case 'door':
      toggleCellObject(x, y, 'door')
      break
    case 'upstair':
      toggleCellObject(x, y, 'upstair')
      break
    case 'downstair':
      toggleCellObject(x, y, 'downstair')
      break
  }
  // if (tool === 'wall' && edge != undefined) {
  //   toggleWall(x, y, edge)
  //   return
  // }

  // if (tool === 'door') {
  //   toggleCellObject(x, y, 'door')
  //   return
  // }

}

function autoSave(): void {
  try {
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify(grid)
    )
  } catch (e) {
    console.error('Failed to auto-save map', e)
  }
}

function loadAutoSave(): void {
  const json = localStorage.getItem(AUTOSAVE_KEY)

  if (!json) return

  importMap(json)
}

function clearEdge(x: number, y: number, edge: Edge) {
  const cell = grid[y]![x]!

  cell.walls &= ~edge

  const neighbor = getNeighbor(x, y, edge)
  if (!neighbor) return

  const { nx, ny, opposite } = neighbor
  const nCell = grid[ny]![nx]!

  nCell.walls &= ~opposite
}

function dashedLine(x1: number, y1: number, x2: number, y2: number): void {
  if (!ctx) return

  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
}

function draw(): void {
  if (!ctx) return

  ctx.clearRect(0, 0, canvasSize, canvasSize)

  // Grid & Objects
  ctx.save()
  ctx.translate(offset.value.x, offset.value.y)
  ctx.scale(scale.value, scale.value)
  ctx.translate(axisOffsetX, axisOffsetY)
  drawGrid()

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      drawContents(x, y, grid[y]![x]!)
    }
  }

  ctx.restore()

  // Axis
  ctx.save()
  drawAxes()

  ctx.restore()

  if (showZoomIndicator.value) {
    drawZoomIndicator()
  }

  autoSave()
}

function drawAxes(): void {
  if (!ctx) return

  const padding = 12
  const tickSize = 6

  ctx.fillStyle = '#555'
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1

  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // --- X AXIS ---
  for (let x = 0; x < size; x++) {
    const centerX =
      (x * tileSize + tileSize / 2 + axisOffsetX) * scale.value +
      offset.value.x

    if (centerX < 0 || centerX > canvasSize) continue

    // Labels
    ctx.fillText(String(x), centerX, padding)
    ctx.fillText(String(x), centerX, canvasSize - padding)
  }

  // Vertical separators (edges)
  for (let x = 0; x <= size; x++) {
    const edgeX =
      (x * tileSize + axisOffsetX) * scale.value + offset.value.x

    if (edgeX < 0 || edgeX > canvasSize) continue

    // Top ticks
    ctx.beginPath()
    ctx.moveTo(edgeX, padding - tickSize)
    ctx.lineTo(edgeX, padding + tickSize)
    ctx.stroke()

    // Bottom ticks
    ctx.beginPath()
    ctx.moveTo(edgeX, canvasSize - padding - tickSize)
    ctx.lineTo(edgeX, canvasSize - padding + tickSize)
    ctx.stroke()
  }

  // --- Y AXIS ---
  for (let y = 0; y < size; y++) {
    const centerY =
      (y * tileSize + tileSize / 2 + axisOffsetY) * scale.value +
      offset.value.y

    if (centerY < 0 || centerY > canvasSize) continue

    const displayY = size - 1 - y

    // Labels
    ctx.fillText(String(displayY), padding, centerY)
    ctx.fillText(String(displayY), canvasSize - padding, centerY)
  }

  // Horizontal separators (edges)
  for (let y = 0; y <= size; y++) {
    const edgeY =
      (y * tileSize + axisOffsetY) * scale.value + offset.value.y

    if (edgeY < 0 || edgeY > canvasSize) continue

    // Left ticks
    ctx.beginPath()
    ctx.moveTo(padding - tickSize, edgeY)
    ctx.lineTo(padding + tickSize, edgeY)
    ctx.stroke()

    // Right ticks
    ctx.beginPath()
    ctx.moveTo(canvasSize - padding - tickSize, edgeY)
    ctx.lineTo(canvasSize - padding + tickSize, edgeY)
    ctx.stroke()
  }
}

function drawGrid(): void {
  if (!ctx) return

  ctx.strokeStyle = '#bbb'
  ctx.lineWidth = 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x * tileSize
      const py = y * tileSize
      dashedLine(px, py, px + tileSize, py) // N
      dashedLine(px + tileSize, py, px + tileSize, py + tileSize) // E
      dashedLine(px, py + tileSize, px + tileSize, py + tileSize) // S
      dashedLine(px, py, px, py + tileSize) // W
    }
  }
}

function drawContents(x: number, y: number, cell: Cell): void {
  if (!ctx) return

  const px = x * tileSize
  const py = y * tileSize

  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2

  // Walls
  if (cell.walls & N) line(px, py, px + tileSize, py)
  if (cell.walls & E) line(px + tileSize, py, px + tileSize, py + tileSize)
  if (cell.walls & S) line(px, py + tileSize, px + tileSize, py + tileSize)
  if (cell.walls & W) line(px, py, px, py + tileSize)

  // Doors
  if (cell.doors) {
    drawCellContent(x, y, doorImg)
  }

  if (cell.upstair) {
    drawCellContent(x, y, upStairImg)
  }

  if (cell.downstair) {
    drawCellContent(x, y, downStairImg)
  }
}

function drawCellContent(x: number, y: number, img: HTMLImageElement, padding = 3): void {
  if (!ctx || !img.complete) return

  const px = x * tileSize
  const py = y * tileSize

  const availableSize = tileSize - padding * 2

  const scale = Math.min(
    availableSize / img.naturalWidth,
    availableSize / img.naturalHeight
  )

  const width = img.naturalWidth * scale
  const height = img.naturalHeight * scale

  const drawX = px + (tileSize - width) / 2
  const drawY = py + (tileSize - height) / 2

  ctx.drawImage(
    img,
    drawX,
    drawY,
    width,
    height
  )
}

function drawZoomIndicator(): void {
  if (!ctx) return

  const padding = 8
  const boxWidth = 80
  const boxHeight = 24

  const x = canvasSize - boxWidth - padding
  const y = canvasSize - boxHeight - padding

  // Background
  ctx.fillStyle = 'white'
  ctx.fillRect(x, y, boxWidth, boxHeight)

  // Border
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, boxWidth, boxHeight)

  // Text
  ctx.fillStyle = 'black'
  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const percent = Math.round(scale.value * 100)
  ctx.fillText(`${percent}%`, x + boxWidth / 2, y + boxHeight / 2)
}

function exportMap(): string {
  return JSON.stringify(grid)
}

function getNeighbor(
  x: number,
  y: number,
  edge: Edge
): { nx: number; ny: number; opposite: Edge } | null {
  if (edge === N && y > 0) return { nx: x, ny: y - 1, opposite: S }
  if (edge === E && x < size - 1) return { nx: x + 1, ny: y, opposite: W }
  if (edge === S && y < size - 1) return { nx: x, ny: y + 1, opposite: N }
  if (edge === W && x > 0) return { nx: x - 1, ny: y, opposite: E }

  return null
}

function handleClick(e: MouseEvent): void {
  if (hasDragged) return
  if (!canvas.value) return

  const rect = canvas.value.getBoundingClientRect()

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // const x = e.clientX - rect.left - axisOffsetX
  // const y = e.clientY - rect.top - axisOffsetY
  const { x, y } = screenToWorld(mouseX, mouseY)

  const gridX = Math.floor(x / tileSize)
  const gridY = Math.floor(y / tileSize)

  const tool = props.tool

  // Find closest edge
  if (tool === "wall") {
    const localX = x % tileSize
    const localY = y % tileSize

    const distances = [
      { edge: N, value: localY },
      { edge: S, value: tileSize - localY },
      { edge: W, value: localX },
      { edge: E, value: tileSize - localX }
    ]

    const closest = distances.reduce((a, b) =>
      a.value < b.value ? a : b
    )

    const margin = tileSize * 0.25

    if (closest.value > margin) return
    let { x: nx, y: ny, edge: ne } = normalizeEdge(gridX, gridY, closest.edge)
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) return

    applyTool(nx, ny, ne)
    draw()
    return
  }
  
  // Find closest cell
  if (tool === "door" || tool === "upstair" || tool === "downstair") {
    if (
      gridX < 0 ||
      gridY < 0 ||
      gridX >= size ||
      gridY >= size
    ) {
      return
    }

    applyTool(gridX, gridY)
    draw()
    return
  }
  
}

function handleMouseDown(e: MouseEvent) {
  isDragging.value = true
  hasDragged = false
  lastMouse = { x: e.clientX, y: e.clientY }
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return

  const dx = e.clientX - lastMouse.x
  const dy = e.clientY - lastMouse.y

  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    hasDragged = true
  }

  offset.value.x += dx
  offset.value.y += dy

  lastMouse = { x: e.clientX, y: e.clientY }

  draw()
}

function handleMouseUp() {
  isDragging.value = false
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()

  const zoomFactor = 1.1
  const rect = canvas.value!.getBoundingClientRect()

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const worldBefore = screenToWorld(mouseX, mouseY)
  let newScale = scale.value

  if (e.deltaY < 0) {
    newScale *= zoomFactor
  } else {
    newScale /= zoomFactor
  }
  newScale = Math.min(zoomMax, Math.max(zoomMin, newScale))
  if (newScale == scale.value) return
  scale.value = newScale

  showZoomIndicator.value = true
  if (zoomTimeout) {
    clearTimeout(zoomTimeout)
  }
  zoomTimeout = window.setTimeout(() => {
  showZoomIndicator.value = false
  draw()
}, 800)

  const worldAfter = screenToWorld(mouseX, mouseY)

  // keep mouse position stable
  offset.value.x += (worldAfter.x - worldBefore.x) * scale.value
  offset.value.y += (worldAfter.y - worldBefore.y) * scale.value

  draw()
}

function line(x1: number, y1: number, x2: number, y2: number): void {
  if (!ctx) return

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function normalizeEdge(x: number, y: number, edge: Edge) {
  if (edge === W) return { x: x - 1, y, edge: E }
  if (edge === N) return { x, y: y - 1, edge: S }
  return { x, y, edge }
}

function screenToWorld(mx: number, my: number) {
  const x = (mx - offset.value.x) / scale.value - axisOffsetX
  const y = (my - offset.value.y) / scale.value - axisOffsetY
  return { x, y }
}

function toggleCellObject(
  x: number, 
  y: number, 
  object: "door" | "upstair" | "downstair"): void {
    const cell = grid[y]![x]!
    switch (object) {
      case "door":
        cell.doors = 1 - cell.doors
        break
      case "upstair":
        cell.upstair = 1 - cell.upstair
        break
      case "downstair":
        cell.downstair = 1 - cell.downstair
        break
    }
}

function toggleWall(x: number, y: number, edge: Edge): void {
  const cell = grid[y]![x]!

  if (!(cell.walls & edge)) {
    clearEdge(x, y, edge)
    cell.walls |= edge
  }
  else {
    cell.walls &= ~edge
  }

  const neighbor = getNeighbor(x, y, edge)
  if (!neighbor) return

  const { nx, ny, opposite } = neighbor
  const neighborCell = grid[ny]![nx]!

  if (cell.walls & edge) {
    neighborCell.walls |= opposite
  } else {
    neighborCell.walls &= ~opposite
  }
}


</script>

<style scoped>
canvas {
  background-color: aliceblue;
}
</style>