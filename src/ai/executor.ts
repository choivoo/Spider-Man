import type { ActionCommand, ActionContext } from './actions'

/** Bridge between the AI layer and the character state machine (registered by the character module). */
export interface World {
  context(): Omit<ActionContext, 'allowActions' | 'now'>
  run(cmds: ActionCommand[]): void
}
let world: World | null = null
export const setWorld = (w: World | null) => { world = w }
export const getWorld = () => world
