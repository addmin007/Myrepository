// src/components/ProgressBar.tsx
interface Props { progress: number; status: string }

export default function ProgressBar({ progress, status }: Props) {
  const labels: Record<string, string> = {
    pending: '等待 Worker 处理…',
    running: `推理中 ${progress}%`,
    done:    '完成',
    error:   '失败',
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{labels[status] ?? status}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
