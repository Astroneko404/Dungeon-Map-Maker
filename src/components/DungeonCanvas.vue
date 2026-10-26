<template>
  <div @click="contextMenu.visible = false"></div>
  <canvas 
  ref="canvas" 
  :width="canvasWidth" 
  :height="canvasHeight"
  style="background-color: #d3d8dd;"
  @click="handleClick"
  @contextmenu.prevent.stop="openContextMenu"
  @wheel="handleWheel"
  @mousedown="handleMouseDown"
  @mousemove="handleMouseMove"
  @mouseup="handleMouseUp"
  @mouseleave="handleMouseUp"
  />
  <ContextMenu
    v-if="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :can-remove-column="cols > 1"
    :can-remove-row="rows > 1"
    @select="resizeMap"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed, nextTick } from 'vue'
import ContextMenu from './ContextMenu.vue'
import type { ResizeAction } from './ContextMenu.vue'
import doorClosedIcon from '@/assets/legend/doorclosed.svg?url'
import downStairIcon from '@/assets/legend/downstair.svg?url'
import upStairIcon from '@/assets/legend/upstair.svg?url'
import doorClosedSvg from '@/assets/legend/doorclosed.svg?raw'
import downStairSvg from '@/assets/legend/downstair.svg?raw'
import upStairSvg from '@/assets/legend/upstair.svg?raw'
defineExpose({
  newMap,
  exportMap,
  importMap,
  exportSVG
})

//////////////////////////
// Constants and Types
//////////////////////////
const rows = ref(20)
const cols = ref(20)
const tileSize = 32
const axisPadding = 24
const zoomMin = 0.7
const zoomMax = 2.0
const canvasWidth = computed(
  () => cols.value * tileSize + axisPadding * 2
)
const canvasHeight = computed(
  () => rows.value * tileSize + axisPadding * 2
)
const axisOffsetX = axisPadding
const axisOffsetY = axisPadding
const N = 1 as const
const E = 2 as const
const S = 4 as const
const W = 8 as const
const props = defineProps<{
  tool: 'wall' | 'door' | 'downstair' | 'upstair' | 'walkable'
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
  walkable: boolean
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

const grid: Cell[][] = Array.from({ length: rows.value }, () =>
  Array.from({ length: cols.value }, (): Cell => ({
    walls: 0,
    doors: 0,
    upstair: 0,
    downstair: 0,
    walkable: false
  }))
)

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0
})

onMounted(() => {
  if (!canvas.value) return
  const context = canvas.value.getContext('2d')
  if (!context) return

  ctx = context

  window.addEventListener('pointerdown', handleGlobalPointerDown)
  resizeCanvasBackingStore()
  loadAutoSave()
  draw()
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
})

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
    case "walkable":
      grid[y]![x]!.walkable = !grid[y]![x]!.walkable
      break
  }
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

function clearEdge(x: number, y: number, edge: Edge) {
  const cell = grid[y]![x]!

  cell.walls &= ~edge

  const neighbor = getNeighbor(x, y, edge)
  if (!neighbor) return

  const { nx, ny, opposite } = neighbor
  const nCell = grid[ny]![nx]!

  nCell.walls &= ~opposite
}

function createEmptyCell(): Cell {
  return {
    walls: 0,
    doors: 0,
    upstair: 0,
    downstair: 0,
    walkable: false
  }
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

  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Grid & Objects
  ctx.save()
  ctx.translate(offset.value.x, offset.value.y)
  ctx.scale(scale.value, scale.value)
  ctx.translate(axisOffsetX, axisOffsetY)
  drawGrid()

  for (let y = 0; y < rows.value; y++) {
    for (let x = 0; x < cols.value; x++) {
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
  for (let x = 0; x < cols.value; x++) {
    const centerX =
      (x * tileSize + tileSize / 2 + axisOffsetX) * scale.value +
      offset.value.x

    if (centerX < 0 || centerX > canvasWidth.value) continue

    // Labels
    ctx.fillText(String(x), centerX, padding)
    ctx.fillText(String(x), centerX, canvasHeight.value - padding)
  }

  // Vertical separators (edges)
  for (let x = 0; x <= cols.value; x++) {
    const edgeX =
      (x * tileSize + axisOffsetX) * scale.value + offset.value.x

    if (edgeX < 0 || edgeX > canvasWidth.value) continue

    // Top ticks
    ctx.beginPath()
    ctx.moveTo(edgeX, padding - tickSize)
    ctx.lineTo(edgeX, padding + tickSize)
    ctx.stroke()

    // Bottom ticks
    ctx.beginPath()
    ctx.moveTo(edgeX, canvasHeight.value - padding - tickSize)
    ctx.lineTo(edgeX, canvasHeight.value - padding + tickSize)
    ctx.stroke()
  }

  // --- Y AXIS ---
  for (let y = 0; y < rows.value; y++) {
    const centerY =
      (y * tileSize + tileSize / 2 + axisOffsetY) * scale.value +
      offset.value.y

    if (centerY < 0 || centerY > canvasHeight.value) continue

    const displayY = rows.value - 1 - y

    // Labels
    ctx.fillText(String(displayY), padding, centerY)
    ctx.fillText(String(displayY), canvasWidth.value - padding, centerY)
  }

  // Horizontal separators (edges)
  for (let y = 0; y <= rows.value; y++) {
    const edgeY =
      (y * tileSize + axisOffsetY) * scale.value + offset.value.y

    if (edgeY < 0 || edgeY > canvasHeight.value) continue

    // Left ticks
    ctx.beginPath()
    ctx.moveTo(padding - tickSize, edgeY)
    ctx.lineTo(padding + tickSize, edgeY)
    ctx.stroke()

    // Right ticks
    ctx.beginPath()
    ctx.moveTo(canvasWidth.value - padding - tickSize, edgeY)
    ctx.lineTo(canvasWidth.value - padding + tickSize, edgeY)
    ctx.stroke()
  }
}

function drawGrid(): void {
  if (!ctx) return

  ctx.strokeStyle = '#bbb'
  ctx.lineWidth = 1
  for (let y = 0; y < rows.value; y++) {
    for (let x = 0; x < cols.value; x++) {
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

  if (cell.walkable) {
  ctx.fillStyle = 'aliceblue'
  ctx.fillRect(
    x * tileSize,
    y * tileSize,
    tileSize,
    tileSize
  )
}

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

  const x = canvasWidth.value - boxWidth - padding
  const y = canvasHeight.value - boxHeight - padding

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

function embedSvgIcon(
  svgText: string,
  x: number,
  y: number,
  color: string,
  padding = 3
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid SVG icon')
  }

  const svg = doc.documentElement
  const viewBox = svg.getAttribute('viewBox') ?? '0 0 512 512'
  const values = viewBox.split(/[\s,]+/).map(Number)

  const width = values[2]!
  const height = values[3]!
  const available = tileSize - padding * 2
  const factor = Math.min(available / width, available / height)

  const iconWidth = width * factor
  const iconHeight = height * factor

  svg.setAttribute('x', String(x + (tileSize - iconWidth) / 2))
  svg.setAttribute('y', String(y + (tileSize - iconHeight) / 2))
  svg.setAttribute('width', String(iconWidth))
  svg.setAttribute('height', String(iconHeight))

  svg.querySelectorAll('*').forEach(element => {
    if (element.hasAttribute('fill')) {
      const fill = element.getAttribute('fill')
      if (fill !== 'none') {
        element.setAttribute('fill', color)
      }
    }

    if (element.hasAttribute('stroke')) {
      const stroke = element.getAttribute('stroke')
      if (stroke !== 'none') {
        element.setAttribute('stroke', color)
      }
    }
  })

  svg.setAttribute('fill', color)
  svg.setAttribute('stroke', color)

  return new XMLSerializer().serializeToString(svg)
}

function exportMap(): string {
  return JSON.stringify(grid)
}

function exportSVG(
  includeIcon: boolean,
  includeTitle: boolean,
  mapTitle: string,
  lineColor: string,
  fillColor: string
): string {
  const mapWidth = cols.value * tileSize
  const mapHeight = rows.value * tileSize
  const elements: string[] = []

  const showTitle = includeTitle && mapTitle.length > 0
  const titleHeight = showTitle ? 60 : 0
  const svgHeight = mapHeight + titleHeight

  const walkableCells: string[] = []
  const walls: string[] = []
  const icons: string[] = []
  const seen = new Set<string>()

  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`

  const addWall = (
    key: string,
    x1: number, y1: number,
    x2: number, y2: number
  ) => {
    if (seen.has(key)) return
    seen.add(key)
    walls.push(line(x1, y1, x2, y2))
  }

  for (let y = 0; y < rows.value; y++) {
    for (let x = 0; x < cols.value; x++) {
      const cell = grid[y]![x]!
      const px = x * tileSize
      const py = y * tileSize

      // Walkable area
      if (cell.walkable) {
        walkableCells.push(
          `<rect x="${px}" y="${py}" ` +
          `width="${tileSize}" height="${tileSize}" />`
        )
      }

      // Walls
      if (cell.walls & N)
        addWall(`h-${x}-${y}`, px, py, px + tileSize, py)

      if (cell.walls & S)
        addWall(`h-${x}-${y + 1}`, px, py + tileSize, px + tileSize, py + tileSize)

      if (cell.walls & W)
        addWall(`v-${x}-${y}`, px, py, px, py + tileSize)

      if (cell.walls & E)
        addWall(`v-${x + 1}-${y}`, px + tileSize, py, px + tileSize, py + tileSize)

      // Icons
      if (includeIcon) {
        if (cell.doors) {
          icons.push(
            embedSvgIcon(doorClosedSvg, px, py, lineColor)
          )
        }
        if (cell.upstair) {
          icons.push(
            embedSvgIcon(upStairSvg, px, py, lineColor)
          )
        }
        if (cell.downstair) {
          icons.push(
            embedSvgIcon(downStairSvg, px, py, lineColor)
          )
        }
      }
    }
  }

  // Walkable areas (bottom layer)
  elements.push(
    `<g id="walkable" fill="${fillColor}" stroke="none">`,
    ...walkableCells,
    `</g>`
  )

  // Walls (middle layer)
  elements.push(
    `<g id="walls" fill="none" stroke="${lineColor}" stroke-width="2">`,
    ...walls,
    `</g>`
  )

  // Icons (top layer)
  if (includeIcon) {
    elements.push(
      `<g id="icons">`,
      ...icons,
      `</g>`
    )
  }

  const escapeXml = (text: string) =>
    text.replace(/[&<>"']/g, char => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
      }
      return entities[char] ?? char
    })

  const titleElement = showTitle
    ? `<text x="${mapWidth / 2}" y="38"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="24"
        font-weight="bold"
        fill="${lineColor}">${escapeXml(mapTitle)}</text>`
    : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${mapWidth}" height="${svgHeight}"`,
    ` viewBox="0 0 ${mapWidth} ${svgHeight}">`,
    titleElement,
    `<g transform="translate(0, ${titleHeight})">`,
    ...elements,
    `</g>`,
    `</svg>`
  ].join('\n')
}

function getNeighbor(
  x: number,
  y: number,
  edge: Edge
): { nx: number; ny: number; opposite: Edge } | null {
  if (edge === N && y > 0) return { nx: x, ny: y - 1, opposite: S }
  if (edge === E && x < cols.value - 1) return { nx: x + 1, ny: y, opposite: W }
  if (edge === S && y < rows.value - 1) return { nx: x, ny: y + 1, opposite: N }
  if (edge === W && x > 0) return { nx: x - 1, ny: y, opposite: E }

  return null
}

function handleClick(e: MouseEvent): void {
  if (hasDragged) return
  if (!canvas.value) return
  if (contextMenu.visible) {
    contextMenu.visible = false
    return
  }

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
    if (nx < 0 || ny < 0 || nx >= cols.value || ny >= rows.value) return

    applyTool(nx, ny, ne)
    draw()
    return
  }
  
  // Find closest cell
  if (
    tool === "door" || 
    tool === "upstair" || 
    tool === "downstair" || 
    tool === "walkable"
  ) {
    if (
      gridX < 0 ||
      gridY < 0 ||
      gridX >= cols.value ||
      gridY >= rows.value
    ) {
      return
    }

    applyTool(gridX, gridY)
    draw()
    return
  }
  
}

function handleGlobalPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return

  const target = event.target
  if (!(target instanceof Node)) return

  // Execute context menu actions
  if (target instanceof Element && target.closest('.context-menu')) {
    return
  }
  if (target === canvas.value) {
    return
  }
  contextMenu.visible = false
}

function handleMouseDown(event: MouseEvent) {
  if (event.button === 0 && contextMenu.visible) {
    return
  }
  isDragging.value = true
  hasDragged = false
  lastMouse = { x: event.clientX, y: event.clientY }
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

function handleWheel(event: WheelEvent) {
  event.preventDefault()

  const zoomFactor = 1.1
  const rect = canvas.value!.getBoundingClientRect()

  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const worldBefore = screenToWorld(mouseX, mouseY)
  let newScale = scale.value

  if (event.deltaY < 0) {
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

function importMap(json: string): void {
  try {
    const data: unknown = JSON.parse(json)
    if (
      !Array.isArray(data) || data.length === 0 ||
      !Array.isArray(data[0]) || data[0].length === 0 ||
      !data.every(row => Array.isArray(row) && row.length === data[0].length)
    ) {
      throw new Error('Map must be a non-empty rectangular grid')
    }

    const importedGrid: Cell[][] = data.map((row: unknown[]) =>
      row.map((src: unknown) => {
        if (!src || typeof src !== 'object') {
          throw new Error('Invalid map cell')
        }
        const cell = src as Partial<Cell>
        return {
          walls: cell.walls ?? 0,
          doors: cell.doors ?? 0,
          upstair: cell.upstair ?? 0,
          downstair: cell.downstair ?? 0,
          walkable: cell.walkable ?? false
        }
      })
    )

    grid.splice(0, grid.length, ...importedGrid)
    rows.value = importedGrid.length
    cols.value = importedGrid[0]!.length
    nextTick(() => {
      resizeCanvasBackingStore()
      draw()
    })
  } catch (e) {
    console.error('Invalid map JSON', e)
  }
}

function loadAutoSave(): void {
  const json = localStorage.getItem(AUTOSAVE_KEY)

  if (!json) return

  importMap(json)
}

function line(x1: number, y1: number, x2: number, y2: number): void {
  if (!ctx) return

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function openContextMenu(e: MouseEvent): void {
  contextMenu.x = Math.min(e.clientX, window.innerWidth - 240)
  contextMenu.y = Math.min(e.clientY, window.innerHeight - 330)
  contextMenu.visible = true
}

function newMap(): void {
  rows.value = 20
  cols.value = 20
  grid.splice(0, grid.length, ...Array.from(
    { length: rows.value },
    () => Array.from({ length: cols.value }, createEmptyCell)
  ))
  localStorage.removeItem(AUTOSAVE_KEY)
  nextTick(() => {
    resizeCanvasBackingStore()
    draw()
  })
}

function normalizeEdge(x: number, y: number, edge: Edge) {
  if (edge === W) return { x: x - 1, y, edge: E }
  if (edge === N) return { x, y: y - 1, edge: S }
  return { x, y, edge }
}

function resizeCanvasBackingStore(): void {
  if (!canvas.value || !ctx) return
  const dpr = window.devicePixelRatio || 1
  canvas.value.width = Math.round(canvasWidth.value * dpr)
  canvas.value.height = Math.round(canvasHeight.value * dpr)
  canvas.value.style.width = `${canvasWidth.value}px`
  canvas.value.style.height = `${canvasHeight.value}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
}

function resizeMap(action: ResizeAction): void {
  contextMenu.visible = false

  switch (action) {
    case 'add-left':
      grid.forEach(row => row.unshift(createEmptyCell()))
      cols.value++
      break

    case 'add-right':
      grid.forEach(row => row.push(createEmptyCell()))
      cols.value++
      break

    case 'add-top':
      grid.unshift(
        Array.from({ length: cols.value }, createEmptyCell)
      )
      rows.value++
      break

    case 'add-bottom':
      grid.push(
        Array.from({ length: cols.value }, createEmptyCell)
      )
      rows.value++
      break

    case 'remove-left':
      if (cols.value <= 1) return
      grid.forEach(row => row.shift())
      cols.value--
      break

    case 'remove-right':
      if (cols.value <= 1) return
      grid.forEach(row => row.pop())
      cols.value--
      break

    case 'remove-top':
      if (rows.value <= 1) return
      grid.shift()
      rows.value--
      break

    case 'remove-bottom':
      if (rows.value <= 1) return
      grid.pop()
      rows.value--
      break
  }

  nextTick(() => {
    resizeCanvasBackingStore()
    draw()
  })
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