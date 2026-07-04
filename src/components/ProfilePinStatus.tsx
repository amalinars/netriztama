import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Copy, CheckCircle2, Pencil, RefreshCw, Zap, XCircle, ChevronRight, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

type Props = {
  profile: Pick<Profile, 'id' | 'name' | 'pin' | 'old_pin' | 'pin_change_pending'>
  account?: { name: string; password?: string | null } | null
  onChanged?: () => void | Promise<void>
  compact?: boolean
}

type Step = { label: string; status: 'running' | 'done' | 'error' }

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success('PIN disalin') }
  catch { toast.error('Gagal menyalin') }
}

export default function ProfilePinStatus({ profile, account, onChanged, compact }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile.pin ?? '')
  const [automating, setAutomating] = useState(false)

  const [logOpen, setLogOpen] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [logStatus, setLogStatus] = useState<'running' | 'ok' | 'error'>('running')
  const [logError, setLogError] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)

  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [snapshotUrl, setSnapshotUrl] = useState('')
  const [snapshotError, setSnapshotError] = useState(false)
  const [isErrorSnapshot, setIsErrorSnapshot] = useState(false)
  const [hasErrorSnapshot, setHasErrorSnapshot] = useState(false)

  async function checkErrorSnapshot() {
    const apiUrl = import.meta.env.VITE_AUTOMATION_API_URL || 'http://localhost:4000'
    try {
      const res = await fetch(`${apiUrl}/snapshots/${profile.id}_error.png`, { method: 'HEAD' })
      setHasErrorSnapshot(res.ok)
    } catch {
      setHasErrorSnapshot(false)
    }
  }

  useEffect(() => {
    checkErrorSnapshot()
  }, [profile.id])

  function openSnapshot(isError = false) {
    const apiUrl = import.meta.env.VITE_AUTOMATION_API_URL || 'http://localhost:4000'
    const name = isError ? `${profile.id}_error` : profile.id
    setSnapshotUrl(`${apiUrl}/snapshots/${name}.png?t=${Date.now()}`)
    setIsErrorSnapshot(isError)
    setSnapshotError(false)
    setSnapshotOpen(true)
  }

  useEffect(() => setDraft(profile.pin ?? ''), [profile.pin])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logLines])

  function upsertStep(label: string, status: Step['status']) {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.label === label)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { label, status }
        return next
      }
      return [...prev, { label, status }]
    })
  }

  async function savePendingPin() {
    if (!/^\d{4}$/.test(draft)) return
    const newPin = draft.trim()
    const currentNetflixPin = profile.pin_change_pending ? profile.old_pin : profile.pin
    const isDifferentFromNetflix = newPin !== (currentNetflixPin ?? '')

    const { error } = await supabase.from('profiles').update({
      pin: newPin,
      old_pin: isDifferentFromNetflix ? currentNetflixPin : null,
      pin_change_pending: isDifferentFromNetflix,
    } as never).eq('id', profile.id)

    if (error) { toast.error(error.message); return }
    toast.success('PIN baru diupdate')
    setEditing(false)
    onChanged?.()
  }

  async function confirmChanged() {
    const { error } = await supabase.from('profiles').update({ old_pin: null, pin_change_pending: false, pin_changed_at: new Date().toISOString() } as never).eq('id', profile.id)
    if (error) {
      toast.error(error.message)
      throw new Error(error.message)
    }
    toast.success('PIN Netflix sudah valid')
    setHasErrorSnapshot(false)
    onChanged?.()
  }

  async function autoChange() {
    if (!account?.name || !account?.password) { toast.error('Data akun tidak tersedia untuk otomasi'); return }
    if (!profile.old_pin || !profile.pin) { toast.error('PIN tidak lengkap untuk otomasi'); return }
    const apiUrl = import.meta.env.VITE_AUTOMATION_API_URL
    if (!apiUrl) { toast.error('VITE_AUTOMATION_API_URL belum dikonfigurasi'); return }

    setLogLines([])
    setSteps([])
    setLogError('')
    setLogStatus('running')
    setLogOpen(true)
    setAutomating(true)

    try {
      const res = await fetch(`${apiUrl}/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.name,
          password: account.password,
          profileName: profile.name,
          profileId: profile.id,
          oldPin: profile.old_pin,
          newPin: profile.pin,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setLogStatus('error')
        setLogError(data.error ?? `HTTP ${res.status}`)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('>>STEP:')) {
            upsertStep(line.slice(7).trim(), 'running')
          } else if (line.startsWith('>>DONE:')) {
            upsertStep(line.slice(7).trim(), 'done')
          } else if (line.startsWith('__DONE__:')) {
            const payload = line.slice(9)
            if (payload === 'ok') {
              // Ensure all previous steps are marked as done
              setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'done' } : s))
              upsertStep('Update database', 'running')
              try {
                await confirmChanged()
                upsertStep('Update database', 'done')
                setLogStatus('ok')
              } catch (err: any) {
                upsertStep('Update database', 'error')
                setLogStatus('error')
                setLogError(err.message || 'Gagal mengupdate database')
              }
            } else {
              setLogStatus('error')
              setLogError(payload.replace(/^error:/, ''))
              // Mark all running steps as error
              setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
            }
          } else if (line.trim()) {
            setLogLines(prev => [...prev, line])
          }
        }
      }
      if (buffer.trim() && !buffer.startsWith('>>') && !buffer.startsWith('__DONE__')) {
        setLogLines(prev => [...prev, buffer])
      }
    } catch {
      setLogStatus('error')
      setLogError('Server otomasi tidak dapat dijangkau. Pastikan npm run server sudah berjalan.')
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
    } finally {
      setAutomating(false)
      checkErrorSnapshot()
    }
  }

  return (
    <>
      <Dialog
        open={logOpen}
        onOpenChange={(open: boolean) => { if (!open && logStatus !== 'running') setLogOpen(false) }}
      >
        <DialogContent className={logStatus === 'error' ? "max-w-xl" : "max-w-md"} showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Ganti PIN — {profile.name}</DialogTitle>
          </DialogHeader>

          {/* Step list */}
          <div className="space-y-3 py-1 min-h-[100px]">
            {steps.length === 0 && logStatus === 'running' ? (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin shrink-0" />
                <span>Memulai...</span>
              </div>
            ) : steps.map(step => (
              <div key={step.label} className="flex items-center gap-3 text-sm">
                {step.status === 'running' && <RefreshCw className="size-4 animate-spin text-primary shrink-0" />}
                {step.status === 'done' && <CheckCircle2 className="size-4 text-green-500 shrink-0" />}
                {step.status === 'error' && <XCircle className="size-4 text-destructive shrink-0" />}
                <span className={
                  step.status === 'done' ? 'text-muted-foreground' :
                    step.status === 'running' ? 'font-medium' :
                      'text-destructive'
                }>
                  {step.label}
                </span>
              </div>
            ))}

            {logStatus === 'error' && steps.length > 0 && (
              <p className="text-xs text-destructive pl-7 break-all">{logError}</p>
            )}
          </div>

          {/* Collapsible raw logs */}
          {logLines.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground select-none">
                <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                Detail log ({logLines.length} baris)
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100">
                {logLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </details>
          )}

          {/* Status bar */}
          <div className="flex items-center gap-2 text-sm min-h-5">
            {logStatus === 'running' && (
              <><RefreshCw className="size-4 animate-spin text-primary shrink-0" />
                <span className="text-muted-foreground">Sedang berjalan...</span></>
            )}
            {logStatus === 'ok' && (
              <><CheckCircle2 className="size-4 text-green-500 shrink-0" />
                <span className="text-green-600 dark:text-green-400 font-medium">PIN berhasil diganti!</span></>
            )}
            {logStatus === 'error' && steps.length === 0 && (
              <><XCircle className="size-4 text-destructive shrink-0" />
                <span className="text-destructive text-xs break-all">{logError}</span></>
            )}
          </div>

          {logStatus === 'error' && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Camera className="size-3.5" />
                <span>Snapshot Error:</span>
              </div>
              <div className="border rounded bg-zinc-950 p-2 overflow-hidden flex justify-center items-center">
                <img
                  src={`${import.meta.env.VITE_AUTOMATION_API_URL || 'http://localhost:4000'}/snapshots/${profile.id}_error.png?t=${Date.now()}`}
                  alt="Error Snapshot"
                  className="max-h-72 w-full object-contain rounded"
                  onError={(e) => {
                    const imgEl = e.target as HTMLElement;
                    imgEl.style.display = 'none';
                    const parent = imgEl.parentElement;
                    if (parent) {
                      parent.style.display = 'none';
                      const prevSibling = parent.previousElementSibling as HTMLElement;
                      if (prevSibling) prevSibling.style.display = 'none';
                    }
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogOpen(false)}
              disabled={logStatus === 'running'}
            >
              {logStatus === 'running' ? 'Mohon tunggu...' : 'Tutup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isErrorSnapshot ? 'Snapshot Error Netflix' : 'Snapshot Netflix'} — {profile.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center min-h-[300px] border rounded-lg bg-zinc-950 p-2 overflow-hidden">
            {snapshotError ? (
              <div className="text-center p-6 flex flex-col items-center justify-center">
                <Camera className="size-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {isErrorSnapshot ? 'Belum ada snapshot error untuk profil ini.' : 'Belum ada snapshot untuk profil ini.'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                  {isErrorSnapshot
                    ? 'Snapshot error dibuat secara otomatis jika terjadi kegagalan saat Ganti Otomatis.'
                    : 'Snapshot akan dibuat secara otomatis saat berhasil mengubah PIN lewat Ganti Otomatis.'}
                </p>
              </div>
            ) : (
              <img
                src={snapshotUrl}
                alt={isErrorSnapshot ? `Snapshot Error ${profile.name}` : `Snapshot PIN ${profile.name}`}
                className="max-h-[60vh] object-contain rounded"
                onError={() => setSnapshotError(true)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapshotOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!profile.pin && (
        <span className="text-sm text-amber-600 dark:text-amber-400">PIN: belum di-set</span>
      )}

      {profile.pin && profile.pin_change_pending && (
        <div className={compact ? 'flex flex-wrap items-center gap-1.5 text-xs' : 'flex flex-wrap items-center gap-2'}>
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Belum diganti di Netflix</Badge>
          <span className="tabular-nums text-muted-foreground">{profile.old_pin ?? '----'} → </span>
          {editing ? (
            <span className="inline-flex items-center gap-1">
              <Input value={draft} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} inputMode="numeric" pattern="[0-9]{4}" className="h-7 w-16 px-2 text-xs font-semibold tabular-nums" />
              <Button variant="ghost" size="icon-xs" onClick={savePendingPin} title="Simpan PIN baru"><CheckCircle2 className="size-3" /></Button>
            </span>
          ) : (
            <b className="text-foreground tabular-nums">{profile.pin}</b>
          )}
          <Button variant="ghost" size="icon-xs" onClick={() => setEditing(!editing)} title="Edit PIN baru"><Pencil className="size-3" /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => copyText(profile.pin!)} title="Copy PIN baru"><Copy className="size-3" /></Button>
          <Button variant="outline" size="sm" onClick={confirmChanged} disabled={automating} className="h-7 gap-1 text-xs"><CheckCircle2 className="size-3" /> Sudah diganti</Button>
          {account?.name && account?.password && (
            <Button variant="outline" size="sm" onClick={autoChange} disabled={automating} className="h-7 gap-1 text-xs">
              {automating ? <><RefreshCw className="size-3 animate-spin" /> Mengganti...</> : <><Zap className="size-3" /> Ganti Otomatis</>}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openSnapshot(false)} className="h-7 gap-1 text-xs"><Camera className="size-3" /> Snapshot</Button>
          {hasErrorSnapshot && (
            <Button variant="outline" size="sm" onClick={() => openSnapshot(true)} className="h-7 gap-1 text-xs border-destructive text-destructive hover:bg-destructive/10"><XCircle className="size-3" /> Snapshot Error</Button>
          )}
        </div>
      )}

      {profile.pin && !profile.pin_change_pending && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">PIN: {profile.pin}</span>
          <Button variant="ghost" size="icon-xs" onClick={() => copyText(profile.pin!)} title="Copy PIN"><Copy className="size-3" /></Button>
          <Button variant="outline" size="sm" onClick={() => openSnapshot(false)} className="h-7 gap-1 text-xs"><Camera className="size-3" /> Snapshot</Button>
          {hasErrorSnapshot && (
            <Button variant="outline" size="sm" onClick={() => openSnapshot(true)} className="h-7 gap-1 text-xs border-destructive text-destructive hover:bg-destructive/10"><XCircle className="size-3" /> Snapshot Error</Button>
          )}
        </div>
      )}
    </>
  )
}
