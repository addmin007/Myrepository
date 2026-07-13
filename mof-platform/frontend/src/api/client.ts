// src/api/client.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30_000,
})

export interface SubmitResponse {
  task_id: string
  status: string
  message: string
}

export interface IsothermPoint {
  pressure_bar: number
  uptake_mol_kg: number
  uptake_cm3_cm3: number
  model_used: string
}

export interface TaskResult {
  type: 'single' | 'isotherm'
  // single
  uptake_mol_kg?: number
  uptake_cm3_cm3?: number
  pressure_bar?: number
  temperature_K?: number
  gas?: string
  model_used?: string
  elapsed_ms?: number
  n_atoms?: number
  // isotherm
  isotherm?: IsothermPoint[]
}

export interface TaskStatusResponse {
  task_id: string
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE'
  result?: TaskResult
  error?: string
  progress?: number
}

export type PredictMode = 'single' | 'isotherm'

export interface PredictFormData {
  cifFile: File
  gas: string
  temperature_K: number
  pressure_bar?: number
  pressure_points_bar?: number[]
  lcd: number
  pld: number
  lfpd: number
  density: number
  asa_m2cm3: number
  asa_m2g: number
  void_fraction: number
  pv_cm3g?: number
}

export async function submitPredict(data: PredictFormData, mode: PredictMode): Promise<SubmitResponse> {
  const form = new FormData()
  form.append('cif_file', data.cifFile)
  form.append('gas', data.gas)
  form.append('temperature_K', String(data.temperature_K))
  form.append('lcd', String(data.lcd))
  form.append('pld', String(data.pld))
  form.append('lfpd', String(data.lfpd))
  form.append('density', String(data.density))
  form.append('asa_m2cm3', String(data.asa_m2cm3))
  form.append('asa_m2g', String(data.asa_m2g))
  form.append('void_fraction', String(data.void_fraction))
  if (data.pv_cm3g != null) form.append('pv_cm3g', String(data.pv_cm3g))

  if (mode === 'single') {
    form.append('pressure_bar', String(data.pressure_bar ?? 65))
    const res = await api.post<SubmitResponse>('/predict/submit', form)
    return res.data
  } else {
    const points = data.pressure_points_bar ?? [1, 5, 10, 20, 35, 50, 65, 100]
    form.append('pressure_points_json', JSON.stringify({ points }))
    const res = await api.post<SubmitResponse>('/predict/isotherm', form)
    return res.data
  }
}

export async function pollStatus(taskId: string): Promise<TaskStatusResponse> {
  const res = await api.get<TaskStatusResponse>(`/predict/status/${taskId}`)
  return res.data
}
