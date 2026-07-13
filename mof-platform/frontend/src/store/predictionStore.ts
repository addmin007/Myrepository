// src/store/predictionStore.ts  — Zustand global state
import { create } from 'zustand'
import type { TaskResult, PredictMode } from '../api/client'

interface PredictionState {
  taskId: string | null
  status: 'idle' | 'pending' | 'running' | 'done' | 'error'
  progress: number
  result: TaskResult | null
  error: string | null
  mode: PredictMode

  setTaskId: (id: string) => void
  setStatus: (s: PredictionState['status']) => void
  setProgress: (p: number) => void
  setResult: (r: TaskResult) => void
  setError: (e: string) => void
  setMode: (m: PredictMode) => void
  reset: () => void
}

export const usePredictionStore = create<PredictionState>((set) => ({
  taskId: null,
  status: 'idle',
  progress: 0,
  result: null,
  error: null,
  mode: 'isotherm',

  setTaskId: (id) => set({ taskId: id }),
  setStatus: (s) => set({ status: s }),
  setProgress: (p) => set({ progress: p }),
  setResult: (r) => set({ result: r, status: 'done' }),
  setError: (e) => set({ error: e, status: 'error' }),
  setMode: (m) => set({ mode: m }),
  reset: () => set({ taskId: null, status: 'idle', progress: 0, result: null, error: null }),
}))
