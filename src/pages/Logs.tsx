import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CronLog } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function duration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

const STATUS_COLOR: Record<string, string> = {
  succeeded: 'bg-green-500/15 text-green-700 dark:text-green-400',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-400',
  starting: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
}

export default function Logs() {
  const [logs, setLogs] = useState<CronLog[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await (supabase as never as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: CronLog[] | null }> })
      .rpc('get_cron_logs', { p_limit: 200 })
    setLogs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 2_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="size-5 text-primary" />
          <h1 className="text-lg font-bold">Cron Logs</h1>
          <Badge variant="secondary" className="text-xs">{logs.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {logs.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-12">Belum ada cron log. Tunggu 1 menit setelah cron dijadwalkan.</p>
      )}

      <div className="space-y-2">
        {logs.map(log => (
          <Card key={log.runid} className="py-0">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <Badge className={`shrink-0 text-[11px] font-medium border-0 ${STATUS_COLOR[log.status] ?? 'bg-muted text-muted-foreground'}`}>
                {log.status}
              </Badge>
              <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
                {log.return_message || '—'}
              </span>
              <span className="shrink-0 text-xs font-mono text-muted-foreground">{duration(log.start_time, log.end_time)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatTime(log.start_time)}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
