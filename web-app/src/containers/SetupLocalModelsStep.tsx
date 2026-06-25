import { useTranslation } from '@/i18n/react-i18next-compat'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ModelSourceBadge } from '@/components/ModelSourceBadge'
import { ModelLogo } from '@/containers/ModelLogo'
import HeaderPage from './HeaderPage'
import type { LocalModelCandidate } from '@/services/models/localScan'

function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / 1024 ** 2
  return `${Math.max(1, Math.round(mb))} MB`
}

// Same canon as Hub's FormatBadge (GGUF orange, MLX slate); LoRA gets its own tint.
function FormatBadge({ format }: { format: LocalModelCandidate['format'] }) {
  const base =
    'inline-block rounded-[6px] border px-2 py-0.5 text-[10px] font-extrabold uppercase leading-tight tracking-wider'
  const color =
    format === 'mlx'
      ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200'
      : format === 'adapter'
        ? 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/45 dark:text-purple-200'
        : 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/45 dark:text-orange-200'

  const label =
    format === 'mlx' ? 'MLX' : format === 'adapter' ? 'LoRA' : 'GGUF'

  return <span className={cn(base, color)}>{label}</span>
}

type Props = {
  candidates: LocalModelCandidate[]
  importingId: string | null
  onRun: (candidate: LocalModelCandidate) => void
  onSkip: () => void
}

/**
 * Onboarding step listing models already on disk (Ollama / LM Studio / HF cache
 * / Unsloth) for one-click import — no re-download. Cards mirror the Hub design
 * so the flow feels of-a-piece. Renders as a full-screen overlay (above the
 * sidebar). LoRA adapters appear disabled since they need a base model first.
 */
function SetupLocalModelsStep({
  candidates,
  importingId,
  onRun,
  onSkip,
}: Props) {
  const { t } = useTranslation()

  const count = candidates.length
  const title =
    count === 1
      ? t('setup:localStep.titleOne')
      : t('setup:localStep.titleOther', { count })
  const description =
    count === 1
      ? t('setup:localStep.descriptionOne')
      : t('setup:localStep.descriptionOther')

  return (
    <div className="bg-neutral-50 dark:bg-background fixed inset-0 z-[60] flex flex-col overflow-hidden">
      <HeaderPage hideControls />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="pointer-events-auto mx-auto my-auto flex w-full max-w-[760px] flex-col px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-7 shrink-0 text-center">
            <h1 className="font-studio text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="text-muted-foreground mx-auto mt-3 max-w-[34rem] text-sm leading-relaxed sm:text-base">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {candidates.map((cand) => {
              const size = formatSize(cand.sizeBytes)
              const isImporting = importingId === cand.id
              const disabled = !cand.runnable || importingId !== null

              return (
                <div
                  key={cand.id}
                  className="bg-card rounded-2xl border border-border px-[18px] py-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <ModelLogo name={cand.displayName} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <h2
                        className="text-foreground truncate text-base font-semibold"
                        title={cand.path}
                      >
                        {cand.displayName}
                      </h2>
                      <div className="mt-1 flex min-h-[18px] flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-foreground/70">
                        <ModelSourceBadge source={cand.source} />
                        {size && <span>{size}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <FormatBadge format={cand.format} />
                      {!cand.runnable && (
                        <span className="text-xs text-muted-foreground">
                          {t('setup:localStep.requiresBaseModel')}
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant={cand.runnable ? 'default' : 'secondary'}
                      disabled={disabled}
                      onClick={() => onRun(cand)}
                      className="shrink-0"
                    >
                      {isImporting
                        ? t('setup:localStep.running')
                        : t('setup:localStep.run')}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onSkip}
              disabled={importingId !== null}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
            >
              {t('setup:localStep.browseInstead')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupLocalModelsStep
