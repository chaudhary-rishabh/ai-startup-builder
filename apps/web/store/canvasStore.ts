'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface CanvasScreen {
  screenName: string
  html: string
  route: string
  generatedAt: string
}

interface CanvasState {
  screens: CanvasScreen[]
  selectedScreen: string | null
  addScreen: (screen: CanvasScreen) => void
  removeScreen: (screenName: string) => void
  setSelectedScreen: (name: string | null) => void
  clearScreens: () => void
}

export const useCanvasStore = create<CanvasState>()(
  immer((set) => ({
    screens: [],
    selectedScreen: null,
    addScreen: () => {
      void set
    },
    removeScreen: () => {
      void set
    },
    setSelectedScreen: () => {
      void set
    },
    clearScreens: () => {
      void set
    },
  })),
)
