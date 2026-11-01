import doorIcon from '@/assets/legend/door_dungeon.svg?url'
import upStairIcon from '@/assets/legend/upstair.svg?url'
import downStairIcon from '@/assets/legend/downstair.svg?url'
import eventIcon from '@/assets/legend/event.svg?url'
import treasureIcon from '@/assets/legend/treasure.svg?url'
import pitIcon from '@/assets/legend/pit.svg?url'

import doorSvg from '@/assets/legend/doorclosed.svg?raw'
import upStairSvg from '@/assets/legend/upstair.svg?raw'
import downStairSvg from '@/assets/legend/downstair.svg?raw'
import eventSvg from '@/assets/legend/event.svg?raw'
import treasureSvg from '@/assets/legend/treasure.svg?raw'
import pitSvg from '@/assets/legend/pit.svg?raw'

export const CELL_OBJECT_CONFIG = {
  walkable: {
    label: 'Walkable Area',
    icon: null,
    svg: null,
    color: "aliceblue"
  },
  door: {
    label: 'Door',
    icon: doorIcon,
    svg: doorSvg
  },
  upstair: {
    label: 'Stairs - Up',
    icon: upStairIcon,
    svg: upStairSvg
  },
  downstair: {
    label: 'Stairs - Down',
    icon: downStairIcon,
    svg: downStairSvg
  },
  event: {
    label: 'Event',
    icon: eventIcon,
    svg: eventSvg
  },
  treasure: {
    label: 'Treasure',
    icon: treasureIcon,
    svg: treasureSvg
  },
  poison: {
    label: 'Poison Area',
    icon: null,
    svg: null,
    color: "darkgreen"
  },
  pit: {
    label: 'Pit',
    icon: pitIcon,
    svg: pitSvg
  }
} as const

export type CellObject = keyof typeof CELL_OBJECT_CONFIG
export type Tool = 'wall' | CellObject
export const CELL_OBJECTS = Object.keys(
  CELL_OBJECT_CONFIG
) as CellObject[]


export function isCellObject(value: string): value is CellObject {
  return (CELL_OBJECTS as readonly string[]).includes(value)
}

export function getCellObjectColor(object: CellObject): string | undefined {
  const config = CELL_OBJECT_CONFIG[object]
  return 'color' in config ? config.color : undefined
}