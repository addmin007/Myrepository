// src/hooks/usePolling.ts
// 提交任务后轮询状态，直到 SUCCESS / FAILURE
import { useEffect, useRef } from 'react'
import { pollStatus } from '../api/client'
import { usePredictionStore } from '../store/predictionStore'

export function usePolling() {
  const { taskId, status, setStatus, setProgress, setResult, setError } = usePredictionStore()
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!taskId || (status !== 'pending' && status !== 'running')) return

    timer.current = setInterval(async () => {
      try {
        const data = await pollStatus(taskId)
        if (data.status === 'STARTED') {
          setStatus('running')
          setProgress(data.progress ?? 50)
        } else if (data.status === 'SUCCESS' && data.result) {
          clearInterval(timer.current!)
          setResult(data.result)
        } else if (data.status === 'FAILURE') {
          clearInterval(timer.current!)
          setError(data.error ?? '推理失败，请重试')
        }
      } catch {
        clearInterval(timer.current!)
        setError('网络错误，无法获取任务状态')
      }
    }, 1500)

    return () => { if (timer.current) clearInterval(timer.current) }
  }, [taskId, status])
}
