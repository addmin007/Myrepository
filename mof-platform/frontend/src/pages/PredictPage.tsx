// src/pages/PredictPage.tsx  — 主页面
import { useState } from 'react'
import { Beaker, BarChart2, ArrowRight } from 'lucide-react'
import CifUploader from '../components/CifUploader'
import ParamForm from '../components/ParamForm'
import ResultPanel from '../components/ResultPanel'
import ProgressBar from '../components/ProgressBar'
import { submitPredict } from '../api/client'
import type { PredictFormData, PredictMode } from '../api/client'
import { usePredictionStore } from '../store/predictionStore'
import { usePolling } from '../hooks/usePolling'

export default function PredictPage() {
  const [cifFile, setCifFile] = useState<File | null>(null)
  const { mode, setMode, status, progress, result, error, reset,
          setTaskId, setStatus } = usePredictionStore()

  // 启动轮询
  usePolling()

  const isLoading = status === 'pending' || status === 'running'

  const handleSubmit = async (data: PredictFormData) => {
    reset()
    setStatus('pending')
    try {
      const resp = await submitPredict(data, mode)
      setTaskId(resp.task_id)
    } catch (e: any) {
      usePredictionStore.getState().setError(e?.response?.data?.detail ?? '提交失败')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶栏 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Beaker size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800">MOF 气体吸附预测</h1>
          <p className="text-xs text-slate-500">UniMOF v2 · 1-bar LoRA · 压力路由推理</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── 左栏：输入 ─────────────────────────────────────── */}
        <div className="space-y-6">
          {/* 模式切换 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">预测模式</p>
            <div className="flex gap-2">
              {(['single', 'isotherm'] as PredictMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all
                    ${mode === m
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {m === 'single' ? <><ArrowRight size={15} /> 单点预测</> : <><BarChart2 size={15} /> 等温线</>}
                </button>
              ))}
            </div>
          </div>

          {/* CIF 上传 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">上传 CIF 文件</p>
            <CifUploader onFile={setCifFile} file={cifFile} />
          </div>

          {/* 参数表单 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">推理参数</p>
            <ParamForm mode={mode} onSubmit={handleSubmit} loading={isLoading} cifFile={cifFile} />
          </div>
        </div>

        {/* ── 右栏：结果 ─────────────────────────────────────── */}
        <div className="space-y-4">
          {status === 'idle' && (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center h-64">
              <Beaker size={48} className="text-slate-200 mb-4" />
              <p className="text-slate-400 text-sm">上传 CIF 文件并填写参数，点击「开始预测」</p>
            </div>
          )}

          {(status === 'pending' || status === 'running') && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="font-semibold text-slate-700">
                  {status === 'pending' ? '等待 Worker 分配…' : 'AI 模型推理中…'}
                </p>
              </div>
              <ProgressBar progress={progress} status={status} />
              <p className="text-xs text-slate-400">CIF 解析 → 原子向量化 → 模型推理 → 结果反归一化</p>
            </div>
          )}

          {status === 'done' && result && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <ResultPanel result={result} />
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
              <p className="text-red-600 font-semibold">推理失败</p>
              <p className="text-red-500 text-sm mt-1">{error}</p>
              <button onClick={reset} className="mt-3 text-sm text-indigo-600 hover:underline">
                重新尝试
              </button>
            </div>
          )}

          {/* 架构说明 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">系统架构</p>
            <div className="space-y-2 text-xs text-slate-500">
              {[
                ['前端', 'React 18 + Vite + Zustand + Recharts'],
                ['API 网关', 'FastAPI + Pydantic v2'],
                ['异步推理', 'Celery + Redis（任务队列）'],
                ['压力路由', '≤2 bar → 1-bar LoRA · >2 bar → Tobacco v2'],
                ['加速', 'Apple MPS / CUDA fp16 自动切换'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-indigo-600 font-semibold w-20 shrink-0">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
