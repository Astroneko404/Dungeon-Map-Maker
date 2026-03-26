<template>
  <canvas 
  ref="canvas" 
  :width="canvasSize" 
  :height="canvasSize"
  style="background-color: aliceblue;"
  @click="handleClick"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import oneWayDoorUrl from '@/assets/legend/onewaydoor.svg?url'
import doorUrl from '@/assets/legend/door.svg?url'

//////////////////////////
// Constants and Types
//////////////////////////
const N = 1 as const
const E = 2 as const
const S = 4 as const
const W = 8 as const
const props = defineProps<{
  tool: 'wall' | 'door' | 'dooroneway'
}>()

type Edge = typeof N | typeof E | typeof S | typeof W
type Cell = {
  walls: number
  oneWayDoors: Partial<Record<Edge, Edge>> 
  doors: Partial<Record<Edge, boolean>>
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
const size = 20 // Default 20
const tileSize = 32
const canvasSize = size * tileSize

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const grid: Cell[][] = Array.from({ length: size }, () =>
  Array.from({ length: size }, (): Cell => ({
    walls: 0,
    oneWayDoors: {},
    doors: {}
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

function clearEdge(x: number, y: number, edge: Edge) {
  const cell = grid[y]![x]!

  // clear current
  cell.walls &= ~edge
  delete cell.doors[edge]
  delete cell.oneWayDoors[edge]

  // clear neighbor
  const neighbor = getNeighbor(x, y, edge)
  if (!neighbor) return

  const { nx, ny, opposite } = neighbor
  const neighborCell = grid[ny]![nx]!

  neighborCell.walls &= ~opposite
  delete neighborCell.doors[opposite]
  delete neighborCell.oneWayDoors[opposite]
}

function cycleOneWayDoor(x: number, y: number, edge: Edge): void {
  const cell = grid[y]![x]!
  const current = cell.oneWayDoors[edge]

  let next: Edge | undefined

  // Horizontal edges: S → N → remove
  if (edge === N || edge === S) {
    if (!current) next = S
    else if (current === S) next = N
    else next = undefined
  } 
  // Vertical edges: E → W → remove
  else {
    if (!current) next = E
    else if (current === E) next = W
    else next = undefined
  }

  // If removing (toggle off)
  if (!next) {
    delete cell.oneWayDoors[edge]

    const neighbor = getNeighbor(x, y, edge)
    if (neighbor) {
      const { nx, ny, opposite } = neighbor
      delete grid[ny]![nx]!.oneWayDoors[opposite]
    }
  return
  }

  if (!current) {
    clearEdge(x, y, edge)
  }

  cell.oneWayDoors[edge] = next
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
  drawGrid();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      drawContent(x, y, grid[y]![x]!)
    }
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
  if (cell.doors?.[N]) drawDoor(x, y, N)
  if (cell.doors?.[E]) drawDoor(x, y, E)
  if (cell.doors?.[S]) drawDoor(x, y, S)
  if (cell.doors?.[W]) drawDoor(x, y, W)

  // One-way Doors
  const dir = cell.oneWayDoors?.[N]
  if (dir) drawOneWayDoor(x, y, N, dir)
  const dirE = cell.oneWayDoors?.[E]
  if (dirE) drawOneWayDoor(x, y, E, dirE)
  const dirS = cell.oneWayDoors?.[S]
  if (dirS) drawOneWayDoor(x, y, S, dirS)
  const dirW = cell.oneWayDoors?.[W]
  if (dirW) drawOneWayDoor(x, y, W, dirW)
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

function handleClick(e: MouseEvent): void {
  if (!canvas.value) return

  const rect = canvas.value.getBoundingClientRect()

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

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

function toggleDoor(x: number, y: number, edge: Edge): void {
  const cell = grid[y]![x]!
  
  if (cell.doors[edge]) {
    clearEdge(x, y, edge)
    return
  }

  clearEdge(x, y, edge)
  cell.doors[edge] = true
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