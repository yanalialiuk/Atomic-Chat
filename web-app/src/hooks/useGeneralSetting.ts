import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { localStorageKey } from '@/constants/localStorage'
import { ExtensionManager } from '@/lib/extension'
export type ReasoningBudgetLevel =
  | 'off'
  | 'low'
  | 'medium'
  | 'high'
  | 'unlimited'

/**
 * Reasoning toggle, tri-state (follows Jan):
 *  - `off`  → explicitly tell the provider NOT to think (enable_thinking=false…)
 *  - `on`   → explicitly tell the provider TO think (enable_thinking=true…)
 *  - `auto` → send nothing; let the model/template decide (its own default)
 *
 * The old binary `disableReasoning` couldn't request thinking when on — it only
 * sent a flag when off — so providers whose template defaults thinking off
 * (e.g. NVIDIA NIM serving Gemma) produced no reasoning. `on` now forces it.
 */
export type ReasoningMode = 'auto' | 'on' | 'off'

/**
 * Longest-edge cap (in pixels) applied to images before they are sent to the
 * model. Large images otherwise flood the context window. `0` disables
 * downscaling. Default keeps quality high while taming 4K photos/screenshots.
 */
export const DEFAULT_MAX_IMAGE_SIZE_PX = 2048

type GeneralSettingState = {
  currentLanguage: Language
  spellCheckChatInput: boolean
  tokenCounterCompact: boolean
  reasoningMode: ReasoningMode
  reasoningBudget: ReasoningBudgetLevel
  preloadModelOnStartup: boolean
  maxImageSizePx: number
  huggingfaceToken?: string
  scanLocalModels: boolean
  localScanFolders: string[]
  // Drives the "New" pill on the Integrations nav item — cleared on first visit.
  integrationsBadgeSeen: boolean
  markIntegrationsBadgeSeen: () => void
  setHuggingfaceToken: (token: string) => void
  setSpellCheckChatInput: (value: boolean) => void
  setTokenCounterCompact: (value: boolean) => void
  setReasoningMode: (value: ReasoningMode) => void
  setReasoningBudget: (value: ReasoningBudgetLevel) => void
  setPreloadModelOnStartup: (value: boolean) => void
  setMaxImageSizePx: (value: number) => void
  setCurrentLanguage: (value: Language) => void
  setScanLocalModels: (value: boolean) => void
  addLocalScanFolder: (folder: string) => void
  removeLocalScanFolder: (folder: string) => void
}

export const useGeneralSetting = create<GeneralSettingState>()(
  persist(
    (set) => ({
      currentLanguage: 'en',
      spellCheckChatInput: true,
      tokenCounterCompact: true,
      reasoningMode: 'auto',
      reasoningBudget: 'medium',
      preloadModelOnStartup: true,
      maxImageSizePx: DEFAULT_MAX_IMAGE_SIZE_PX,
      huggingfaceToken: undefined,
      scanLocalModels: true,
      localScanFolders: [],
      integrationsBadgeSeen: false,
      markIntegrationsBadgeSeen: () =>
        set((state) =>
          state.integrationsBadgeSeen ? state : { integrationsBadgeSeen: true }
        ),
      setSpellCheckChatInput: (value) => set({ spellCheckChatInput: value }),
      setTokenCounterCompact: (value) => set({ tokenCounterCompact: value }),
      setReasoningMode: (value) => set({ reasoningMode: value }),
      setReasoningBudget: (value) => set({ reasoningBudget: value }),
      setPreloadModelOnStartup: (value) => set({ preloadModelOnStartup: value }),
      setMaxImageSizePx: (value) =>
        set({ maxImageSizePx: Number.isFinite(value) && value > 0 ? value : 0 }),
      setCurrentLanguage: (value) => set({ currentLanguage: value }),
      setScanLocalModels: (value) => set({ scanLocalModels: value }),
      addLocalScanFolder: (folder) =>
        set((state) => {
          const trimmed = folder.trim()
          if (!trimmed || state.localScanFolders.includes(trimmed)) return state
          return { localScanFolders: [...state.localScanFolders, trimmed] }
        }),
      removeLocalScanFolder: (folder) =>
        set((state) => ({
          localScanFolders: state.localScanFolders.filter((f) => f !== folder),
        })),
      setHuggingfaceToken: (token) => {
        set({ huggingfaceToken: token })
        ExtensionManager.getInstance()
          .getByName('@janhq/download-extension')
          ?.getSettings()
          .then((settings) => {
            if (settings) {
              const newSettings = settings.map((e) => {
                if (e.key === 'hf-token') {
                  e.controllerProps.value = token
                }
                return e
              })
              ExtensionManager.getInstance()
                .getByName('@janhq/download-extension')
                ?.updateSettings(newSettings)
            }
          })
      },
    }),
    {
      name: localStorageKey.settingGeneral,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // v0 → v1: the binary `disableReasoning` became the tri-state
      // `reasoningMode`. Preserve the user's existing choice: true → 'off',
      // false → 'on'. New installs default to 'auto' (model decides).
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>
        if (
          version < 1 &&
          typeof state.disableReasoning === 'boolean' &&
          state.reasoningMode === undefined
        ) {
          state.reasoningMode = state.disableReasoning ? 'off' : 'on'
        }
        delete state.disableReasoning
        return state as unknown as GeneralSettingState
      },
    }
  )
)
