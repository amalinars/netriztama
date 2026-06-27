import { useEffect, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PRESETS = ['08:00', '12:00', '13:00', '18:00', '20:00', '23:59']

function parseTime(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length < 4) return null
  const hour = digits.slice(0, 2)
  const minute = digits.slice(2, 4)
  if (Number(hour) > 23 || Number(minute) > 59) return null
  return `${hour}:${minute}`
}

function displayTime(value: string) {
  return value.replace(':', '.')
}

export default function LogoutTimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(displayTime(value))

  useEffect(() => setDraft(displayTime(value)), [value])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const nextDraft = e.target.value.replace(/[^\d.:]/g, '').slice(0, 5)
    setDraft(nextDraft)
    const next = parseTime(nextDraft)
    if (next) onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Jam Logout (WIB)</Label>
        <span className="text-xs text-muted-foreground">Ketik 1335 → 13.35</span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border bg-muted/30 p-3">
        <Input
          value={draft}
          onChange={handleChange}
          onBlur={() => setDraft(displayTime(value))}
          inputMode="numeric"
          placeholder="13.35"
          required
          className="h-12 text-center font-mono text-2xl font-bold tracking-tight tabular-nums"
        />
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">WIB</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {PRESETS.map(t => (
          <Button key={t} type="button" variant={value === t ? 'default' : 'outline'} size="sm" onClick={() => onChange(t)}>
            {displayTime(t)}
          </Button>
        ))}
      </div>
    </div>
  )
}
