import { memo } from 'react'
import { IconBulb, IconBulbOff } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useGeneralSetting,
  type ReasoningMode,
} from '@/hooks/useGeneralSetting'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { cn } from '@/lib/utils'

type ReasoningToggleProps = {
  className?: string
}

// Click cycles through the tri-state in this order.
const CYCLE: ReasoningMode[] = ['auto', 'on', 'off']

const ReasoningToggle = memo(function ReasoningToggle({
  className,
}: ReasoningToggleProps) {
  const { t } = useTranslation()

  const reasoningMode = useGeneralSetting((state) => state.reasoningMode)
  const setReasoningMode = useGeneralSetting((state) => state.setReasoningMode)

  const label =
    reasoningMode === 'on'
      ? t('common:reasoningToggleEnabled')
      : reasoningMode === 'off'
        ? t('common:reasoningToggleDisabled')
        : t('common:reasoningToggleAuto')

  // 'on' = solid highlight; 'auto' = subtle highlight (model decides);
  // 'off' = muted.
  const isOn = reasoningMode === 'on'
  const isAuto = reasoningMode === 'auto'

  const handleClick = () => {
    const next = CYCLE[(CYCLE.indexOf(reasoningMode) + 1) % CYCLE.length]
    setReasoningMode(next)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              isOn &&
                'bg-blue-500/10 text-blue-500 hover:bg-blue-500/15 hover:text-blue-500',
              isAuto && 'text-blue-500 hover:text-blue-500',
              className
            )}
            aria-label={label}
            aria-pressed={isOn}
            onClick={handleClick}
          >
            {reasoningMode === 'off' ? (
              <IconBulbOff size={18} className="text-muted-foreground" />
            ) : (
              <IconBulb size={18} className="text-blue-500" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

export default ReasoningToggle
