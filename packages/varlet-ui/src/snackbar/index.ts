import { h, reactive, TransitionGroup, App, Component } from 'vue'
import VarSnackbarCore from './core.vue'
import VarSnackbar from './Snackbar.vue'
import { mountInstance } from '../utils/components'
import { isPlainObject, toNumber } from '../utils/shared'
import context from '../context'

export type SnackbarType = 'success' | 'warning' | 'info' | 'error' | 'loading'

export const SNACKBAR_TYPE: Array<SnackbarType> = ['loading', 'success', 'warning', 'info', 'error']

interface SnackbarHandel {
  clear: () => void
}

interface SnackbarOptions {
  type?: SnackbarType
  content?: string
  position?: 'top' | 'center' | 'bottom'
  loadingType?: string
  loadingSize?: string
  teleport?: string
  lockScroll?: boolean
  contentClass?: string
  duration?: number
  vertical?: boolean
  show?: boolean
  forbidClick?: boolean
  onOpen?: () => void
  onClose?: () => void
  onOpened?: () => void
  onClosed?: () => void
}

interface UniqSnackbarOptions {
  id: number
  reactiveSnackOptions: SnackbarOptions
  _update?: string
  animationEnd?: boolean
}

interface Snackbar {
  (options: SnackbarOptions): SnackbarHandel

  install(app: App): void

  allowMultiple(bool: boolean): void

  success(options: SnackbarOptions | string): SnackbarHandel

  warning(options: SnackbarOptions | string): SnackbarHandel

  info(options: SnackbarOptions | string): SnackbarHandel

  error(options: SnackbarOptions | string): SnackbarHandel

  loading(options: SnackbarOptions | string): SnackbarHandel

  clear(): void

  isAllowMultiple: boolean

  Component: Component
}

let sid = 0
let isMount = false
let unmount: () => void
let uniqSnackbarOptions: Array<UniqSnackbarOptions> = reactive<UniqSnackbarOptions[]>([])

const transitionGroupProps: any = {
  name: 'var-snackbar-fade',
  tag: 'div',
  class: 'var-transition-group',
  afterEnter: 'onOpened',
  afterLeave: 'onClosed',
}

const TransitionGroupHost = {
  setup() {
    return () => {
      const getOption = ({ id, reactiveSnackOptions, _update }: UniqSnackbarOptions) => ({
        ...reactiveSnackOptions,
        ...{
          key: id,
          'data-id': id,
          style: {
            position: 'relative',
            top: getTop(reactiveSnackOptions.position),
          },
          _update,
          'onUpdate:show': (value: boolean) => {
            reactiveSnackOptions.show = value
          },
        },
      })

      const snackbarList = uniqSnackbarOptions.map((option: UniqSnackbarOptions) => {
        if (option.reactiveSnackOptions.forbidClick) {
          const transitionGroupEl = document.querySelector('.var-transition-group')
          ;(transitionGroupEl as HTMLElement).classList.add('var-pointer-auto')
        }

        if (Snackbar.isAllowMultiple) option.reactiveSnackOptions.position = 'top'

        return h(VarSnackbarCore, getOption(option))
      })

      return h(
        TransitionGroup,
        {
          ...transitionGroupProps,
          ...{
            style: {
              zIndex: context.zIndex,
            },
          },
          onAfterEnter: opened,
          onAfterLeave: removeUniqOption,
        },
        // remove [Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance
        () => snackbarList
      )
    }
  },
}

const Snackbar: Snackbar = <Snackbar>function (options: SnackbarOptions | string): SnackbarHandel {
  const snackOptions: SnackbarOptions = isPlainObject(options) ? options : { content: options }
  const reactiveSnackOptions: SnackbarOptions = reactive<SnackbarOptions>(snackOptions)
  reactiveSnackOptions.show = true

  if (!isMount) {
    isMount = true
    unmount = mountInstance(TransitionGroupHost).unmountInstance
  }

  const { length } = uniqSnackbarOptions
  const uniqSnackbarOptionItem: UniqSnackbarOptions = {
    id: sid++,
    reactiveSnackOptions,
  }

  if (length === 0 || Snackbar.isAllowMultiple) {
    addUniqOption(uniqSnackbarOptionItem)
  } else {
    const _update = `update-${sid}`
    updateUniqOption(reactiveSnackOptions, _update)
  }

  return {
    clear() {
      if (!Snackbar.isAllowMultiple && uniqSnackbarOptions.length) {
        uniqSnackbarOptions[0].reactiveSnackOptions.show = false
      } else {
        reactiveSnackOptions.show = false
      }
    },
  }
}

SNACKBAR_TYPE.forEach((type) => {
  Snackbar[type] = (options: SnackbarOptions | string): SnackbarHandel => {
    if (typeof options === 'string') {
      options = {
        content: options,
        type,
      }
    } else {
      options.type = type
    }
    return Snackbar(options)
  }
})

Snackbar.install = function (app: App) {
  app.component(VarSnackbar.name, VarSnackbar)
}

Snackbar.allowMultiple = function (bool = false) {
  if (bool !== Snackbar.isAllowMultiple) {
    uniqSnackbarOptions.forEach((option: UniqSnackbarOptions) => {
      option.reactiveSnackOptions.show = false
    })

    this.isAllowMultiple = bool
  }
}

Snackbar.clear = function () {
  uniqSnackbarOptions.forEach((option: UniqSnackbarOptions) => {
    option.reactiveSnackOptions.show = false
  })
}

Snackbar.isAllowMultiple = false

Snackbar.Component = VarSnackbar

function opened(element: HTMLElement): void {
  const id = element.getAttribute('data-id')
  const option = uniqSnackbarOptions.find((option) => option.id === toNumber(id))
  if (option) option.reactiveSnackOptions.onOpened?.()
}

function removeUniqOption(element: HTMLElement): void {
  element.parentElement && element.parentElement.classList.remove('var-pointer-auto')
  const id = element.getAttribute('data-id')

  const option = uniqSnackbarOptions.find((option) => option.id === toNumber(id))
  if (option) {
    option.animationEnd = true
    option.reactiveSnackOptions.onClosed?.()
  }

  const isAllAnimationEnd = uniqSnackbarOptions.every((option) => option.animationEnd)

  if (isAllAnimationEnd) {
    unmount?.()
    uniqSnackbarOptions = reactive<UniqSnackbarOptions[]>([])
    isMount = false
  }
}

function addUniqOption(uniqSnackbarOptionItem: UniqSnackbarOptions) {
  uniqSnackbarOptions.push(uniqSnackbarOptionItem)
}

function updateUniqOption(reactiveSnackOptions: SnackbarOptions, _update: string) {
  const [firstOption] = uniqSnackbarOptions

  firstOption.reactiveSnackOptions = {
    ...firstOption.reactiveSnackOptions,
    ...reactiveSnackOptions,
  }

  firstOption._update = _update
}

function getTop(position = 'top'): string {
  if (position === 'center') return '45%'

  if (position === 'bottom') return '90%'

  return '5%'
}

export default Snackbar
