import { create } from 'zustand'

type ModelLoadState = {
  modelLoadError?: string | ErrorObject
  setModelLoadError: (error: string | ErrorObject | undefined) => void
  // Onboarding turns this on so a failed auto-start can't pop a crash toast over the setup screen.
  suppressErrorToast: boolean
  setSuppressErrorToast: (value: boolean) => void
}

export const useModelLoad = create<ModelLoadState>()((set) => ({
  modelLoadError: undefined,
  setModelLoadError: (error) => set({ modelLoadError: error }),
  suppressErrorToast: false,
  setSuppressErrorToast: (value) => set({ suppressErrorToast: value }),
}))
