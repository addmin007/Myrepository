// src/components/ParamForm.tsx
// 气体条件 + 结构特征参数输入表单
import { useForm } from 'react-hook-form'
import type { PredictFormData, PredictMode } from '../api/client'

interface Props {
  mode: PredictMode
  onSubmit: (data: PredictFormData) => void
  loading: boolean
  cifFile: File | null
}

const GAS_OPTIONS = ['CH4', 'CO2', 'N2', 'H2']

const DEFAULT_PRESSURE_POINTS = '1, 5, 10, 20, 35, 50, 65, 100'

function Field({ label, unit, reg, err, step = 'any' }: {
  label: string; unit?: string; reg: any; err?: any; step?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{unit && <span className="text-slate-400 ml-1">({unit})</span>}
      </label>
      <input
        {...reg}
        step={step}
        type="number"
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400
          ${err ? 'border-red-400' : 'border-slate-300'}`}
      />
      {err && <p className="text-red-500 text-xs mt-0.5">{err.message}</p>}
    </div>
  )
}

export default function ParamForm({ mode, onSubmit, loading, cifFile }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    defaultValues: {
      gas: 'CH4', temperature_K: 298, pressure_bar: 65,
      pressure_points: DEFAULT_PRESSURE_POINTS,
      lcd: 8.5, pld: 5.2, lfpd: 7.1,
      density: 0.65, asa_m2cm3: 1200, asa_m2g: 1850,
      void_fraction: 0.72, pv_cm3g: '',
    }
  })

  const submit = (raw: any) => {
    if (!cifFile) return
    const base: PredictFormData = {
      cifFile,
      gas: raw.gas,
      temperature_K: Number(raw.temperature_K),
      lcd: Number(raw.lcd), pld: Number(raw.pld), lfpd: Number(raw.lfpd),
      density: Number(raw.density), asa_m2cm3: Number(raw.asa_m2cm3),
      asa_m2g: Number(raw.asa_m2g), void_fraction: Number(raw.void_fraction),
      pv_cm3g: raw.pv_cm3g !== '' ? Number(raw.pv_cm3g) : undefined,
    }
    if (mode === 'single') {
      base.pressure_bar = Number(raw.pressure_bar)
    } else {
      base.pressure_points_bar = raw.pressure_points
        .split(',').map((s: string) => Number(s.trim())).filter(Number.isFinite)
    }
    onSubmit(base)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {/* 气体 + 温度 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">气体种类</label>
          <select {...register('gas')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {GAS_OPTIONS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <Field label="温度" unit="K" reg={register('temperature_K', { required: true, min: 1 })} err={errors.temperature_K} />
      </div>

      {/* 压力 */}
      {mode === 'single' ? (
        <Field label="压力" unit="bar" reg={register('pressure_bar', { required: true, min: 0.001 })} err={errors.pressure_bar} />
      ) : (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            压力点列表 <span className="text-slate-400">(bar，逗号分隔)</span>
          </label>
          <input {...register('pressure_points')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="1, 5, 10, 20, 35, 50, 65, 100" />
        </div>
      )}

      {/* 结构特征 */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
          MOF 结构特征（来自 Zeo++ 等工具）
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="LCD" unit="Å" reg={register('lcd', { required: true })} err={errors.lcd} />
          <Field label="PLD" unit="Å" reg={register('pld', { required: true })} err={errors.pld} />
          <Field label="LFPD" unit="Å" reg={register('lfpd', { required: true })} err={errors.lfpd} />
          <Field label="密度" unit="g/cm³" reg={register('density', { required: true, min: 0.001 })} err={errors.density} />
          <Field label="ASA" unit="m²/cm³" reg={register('asa_m2cm3', { required: true })} err={errors.asa_m2cm3} />
          <Field label="ASA" unit="m²/g" reg={register('asa_m2g', { required: true })} err={errors.asa_m2g} />
          <Field label="空隙率" unit="0-1" reg={register('void_fraction', { required: true, min: 0, max: 1 })} err={errors.void_fraction} />
          <Field label="孔体积（可选）" unit="cm³/g" reg={register('pv_cm3g')} err={errors.pv_cm3g} />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !cifFile}
        className={`w-full py-3 rounded-xl font-semibold text-white transition-all
          ${loading || !cifFile
            ? 'bg-slate-300 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
      >
        {loading ? '推理中…' : '开始预测'}
      </button>
    </form>
  )
}
