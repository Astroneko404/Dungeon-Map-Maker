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
import oneWayDoorUrl from '@/assets/legend/onewaydoor.svg?url'
import doorUrl from '@/assets/legend/door.svg?url'

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
const canvasSize = size * tileSize + axisPadding * 2
const axisOffsetX = axisPadding
const axisOffsetY = axisPadding
const N = 1 as const
const E = 2 as const
const S = 4 as const
const W = 8 as const
const props = defineProps<{
  tool: 'wall' | 'door' | 'dooroneway'
}>()
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
let lastMouse = { x: 0, y: 0 }
let hasDragged = false

type Edge = typeof N | typeof E | typeof S | typeof W
type Cell = {
  walls: number             // bitmask (N,E,S,W)
  doors: number             // bitmask (N,E,S,W)
  oneWayDoors: number       // bitmask (N,E,S,W)
  oneWayDoorsDir: number    // bitmask direction per edge
}

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
doorImg.src = doorUrl


const oneWayDoorImg = new Image()
oneWayDoorImg.onload = () => {
  draw()
}
oneWayDoorImg.onerror = (e) => {
  console.error('Failed to load OneWayDoor SVG', e)
}
oneWayDoorImg.crossOrigin = 'anonymous'
oneWayDoorImg.src = oneWayDoorUrl

//////////////////////////
// State
//////////////////////////
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const grid: Cell[][] = Array.from({ length: size }, () =>
  Array.from({ length: size }, (): Cell => ({
    walls: 0,
    doors: 0,
    oneWayDoors: 0,
    oneWayDoorsDir: 0
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

  oneWayDoorImg.onload = () => {
  console.log('SVG loaded OK')
  draw()
}

oneWayDoorImg.onerror = (e) => {
  console.error('SVG failed to load', e)
}
})

function exportMap(): string {
  return JSON.stringify(grid)
}

function importMap(json: string): void {
  try {
    const data = JSON.parse(json)

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const src = data[y]?.[x]
        if (!src) continue

        grid[y]![x]!.walls = src.walls ?? 0
        grid[y]![x]!.doors = src.doors ?? 0
        grid[y]![x]!.oneWayDoors = src.oneWayDoors ?? 0
        grid[y]![x]!.oneWayDoorsDir = src.oneWayDoorsDir ?? 0
      }
    }

    draw()
  } catch (e) {
    console.error('Invalid map JSON', e)
  }
}

function applyTool(x: number, y: number, edge: Edge): void {
  const tool = props.tool

  if (tool === 'wall') {
    toggleWall(x, y, edge)
    return
  }

  if (tool === 'door') {
    toggleDoor(x, y, edge)
    return
  }

  if (tool === 'dooroneway') {
    cycleOneWayDoor(x, y, edge)
    return
  }
}

function clearEdge(x: number, y: number, edge: Edge) {
  const cell = grid[y]![x]!

  cell.walls &= ~edge
  cell.doors &= ~edge
  cell.oneWayDoors &= ~edge
  cell.oneWayDoorsDir &= ~edge

  const neighbor = getNeighbor(x, y, edge)
  if (!neighbor) return

  const { nx, ny, opposite } = neighbor
  const nCell = grid[ny]![nx]!

  nCell.walls &= ~opposite
  nCell.doors &= ~opposite
  nCell.oneWayDoors &= ~opposite
  nCell.oneWayDoorsDir &= ~opposite
}

function cycleOneWayDoor(x: number, y: number, edge: Edge): void {
  const cell = grid[y]![x]!

  const hasDoor = cell.oneWayDoors & edge
  const currentDir = cell.oneWayDoorsDir & edge

  let nextDir: number = 0

  if (edge === N || edge === S) {
    if (!hasDoor) nextDir = S
    else if (currentDir === S) nextDir = N
    else nextDir = 0
  } else {
    if (!hasDoor) nextDir = E
    else if (currentDir === E) nextDir = W
    else nextDir = 0
  }

  // Remove
  if (!nextDir) {
    cell.oneWayDoors &= ~edge
    cell.oneWayDoorsDir &= ~edge
    return
  }

  if (!hasDoor) {
    clearEdge(x, y, edge)
  }

  cell.oneWayDoors |= edge

  // Clear old direction bit for this edge
  cell.oneWayDoorsDir &= ~edge

  // Set new direction
  cell.oneWayDoorsDir |= nextDir
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
      drawContent(x, y, grid[y]![x]!)
    }
  }

  ctx.restore()

  // Axis
  ctx.save()
  drawAxes()

  ctx.restore()
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

function drawContent(x: number, y: number, cell: Cell): void {
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
  if (cell.doors & N) drawDoor(x, y, N)
  if (cell.doors & E) drawDoor(x, y, E)
  if (cell.doors & S) drawDoor(x, y, S)
  if (cell.doors & W) drawDoor(x, y, W)

  // One-way Doors
  function getDir(cell: Cell, edge: Edge): Edge | null {
    const dir = cell.oneWayDoorsDir & (N | E | S | W)
    return dir ? (dir as Edge) : null
  }
  if (cell.oneWayDoors & N) drawOneWayDoor(x, y, N, getDir(cell, N)!)
  if (cell.oneWayDoors & E) drawOneWayDoor(x, y, E, getDir(cell, E)!)
  if (cell.oneWayDoors & S) drawOneWayDoor(x, y, S, getDir(cell, S)!)
  if (cell.oneWayDoors & W) drawOneWayDoor(x, y, W, getDir(cell, W)!)
}

function drawDoor(x: number, y: number, edge: Edge): void {
  if (!ctx || !doorImg.complete) return

  const px = x * tileSize
  const py = y * tileSize

  ctx.save()

  const isHorizontal = edge === N || edge === S

  // Door size
  const width = tileSize * 1.2
  const height = tileSize * 0.6

  // Draw edge & Move to edge center
  if (edge === N) {
    line(px, py, px + tileSize, py)
    ctx.translate(px + tileSize / 2, py)
  } 
  if (edge === S) {
    line(px, py + tileSize, px + tileSize, py + tileSize)
    ctx.translate(px + tileSize / 2, py + tileSize)
  }
  if (edge === E) {
    line(px + tileSize, py, px + tileSize, py + tileSize)
    ctx.translate(px + tileSize, py + tileSize / 2)
  }
  if (edge === W) {
    line(px, py, px, py + tileSize)
    ctx.translate(px, py + tileSize / 2)
  }

  // Rotate ONLY if vertical
  if (!isHorizontal) {
    ctx.rotate(Math.PI / 2)
  }

  // SVG original size
  const svgWidth = 40
  const svgHeight = 20

  const scaleX = width / svgWidth
  const scaleY = height / svgHeight

  // rectangle center in SVG space
  const anchorX = 20
  const anchorY = 5

  // Draw
  ctx.drawImage(
    doorImg,
    -anchorX * scaleX,
    -anchorY * scaleY,
    svgWidth * scaleX,
    svgHeight * scaleY
  )

  ctx.restore()
}

function drawOneWayDoor(x: number, y: number, edge: Edge, dir: Edge): void {
  if (!ctx || !oneWayDoorImg.complete) return

  const px = x * tileSize
  const py = y * tileSize

  ctx.save()

  // Draw edge & Move to edge center
  if (edge === N) {
    line(px, py, px + tileSize, py)
    ctx.translate(px + tileSize / 2, py)
  } 
  if (edge === S) {
    line(px, py + tileSize, px + tileSize, py + tileSize)
    ctx.translate(px + tileSize / 2, py + tileSize)
  }
  if (edge === E) {
    line(px + tileSize, py, px + tileSize, py + tileSize)
    ctx.translate(px + tileSize, py + tileSize / 2)
  }
  if (edge === W) {
    line(px, py, px, py + tileSize)
    ctx.translate(px, py + tileSize / 2)
  }

  // Rotate based on direction (SVG default = facing South)
  const rotationMap = {
    [N]: Math.PI,
    [S]: 0,
    [E]: Math.PI / 2,
    [W]: -Math.PI / 2
  }

  ctx.rotate(rotationMap[dir])

  // Scale to fit tile nicely
  const width = tileSize * 1.2
  const height = tileSize * 0.6

  const svgWidth = 40
  const svgHeight = 20

  // scale factors
  const scaleX = width / svgWidth
  const scaleY = height / svgHeight

  // rectangle center in SVG space
  const anchorX = 20
  const anchorY = 5

  ctx.drawImage(
    oneWayDoorImg,
    -anchorX * scaleX,
    -anchorY * scaleY,
    width,
    height
  )

  ctx.restore()
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

  const localX = x % tileSize
  const localY = y % tileSize

  const distances = [
  { edge: N, value: localY },
  { edge: S, value: tileSize - localY },
  { edge: W, value: localX },
  { edge: E, value: tileSize - localX }
]

  // Find closest edge
  const closest = distances.reduce((a, b) =>
    a.value < b.value ? a : b
  )

  const margin = tileSize * 0.25

  if (closest.value > margin) return

  const edge = closest.edge

  let { x: nx, y: ny, edge: ne } = normalizeEdge(gridX, gridY, edge)
  if (nx < 0 || ny < 0 || nx >= size || ny >= size) return

  applyTool(nx, ny, ne)
  draw()
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

  if (e.deltaY < 0) {
    scale.value *= zoomFactor
  } else {
    scale.value /= zoomFactor
  }

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

function toggleDoor(x: number, y: number, edge: Edge): void {
  const cell = grid[y]![x]!

  if (cell.doors & edge) {
    clearEdge(x, y, edge)
    return
  }

  clearEdge(x, y, edge)
  cell.doors |= edge
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