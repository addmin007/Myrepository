// src/components/ResultPanel.tsx
// 推理结果展示：单点结果卡片 + 等温线 Recharts 图表
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import type { TaskResult } from '../api/client'
import { CheckCircle, Cpu, Clock, Atom } from 'lucide-react'

interface Props { result: TaskResult }

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm border border-slate-100">
      <div className="text-indigo-500">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

export default function ResultPanel({ result }: Props) {
  if (result.type === 'single') {
    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex items-center gap-2 text-green-600 font-semibold">
          <CheckCircle size={20} /> 预测完成
        </div>
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-sm opacity-80">预测吸附量</p>
          <p className="text-5xl font-black mt-1">{result.uptake_mol_kg?.toFixed(3)}</p>
          <p className="text-sm opacity-70 mt-1">mol/kg</p>
          <p className="text-2xl font-semibold mt-3">{result.uptake_cm3_cm3?.toFixed(2)} cm³/cm³</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Cpu size={18} />}       label="使用模型"    value={result.model_used ?? '-'} />
          <StatCard icon={<Clock size={18} />}      label="推理耗时"    value={`${result.elapsed_ms?.toFixed(1)} ms`} />
          <StatCard icon={<Atom size={18} />}       label="原子数"      value={String(result.n_atoms ?? '-')} />
          <StatCard icon={<CheckCircle size={18} />} label="压力 / 温度" value={`${result.pressure_bar} bar / ${result.temperature_K} K`} />
        </div>
      </div>
    )
  }

  // 等温线
  const data = result.isotherm ?? []
  const maxUptake = Math.max(...data.map(d => d.uptake_mol_kg)) * 1.15
  const threshold = 2.0

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-green-600 font-semibold">
        <CheckCircle size={20} /> 等温线预测完成（{data.length} 个压力点）
      </div>

      {/* 等温线图 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-4">CH₄ 吸附等温线</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="pressure_bar"
              label={{ value: 'Pressure (bar)', position: 'insideBottom', offset: -2, fontSize: 12 }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[0, maxUptake]}
              label={{ value: 'Uptake (mol/kg)', angle: -90, position: 'insideLeft', fontSize: 12 }}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v: any) => [Number(v).toFixed(3), 'mol/kg']}
              labelFormatter={(l) => `${l} bar`}
            />
            <Legend verticalAlign="top" />
            <ReferenceLine x={threshold} stroke="#f59e0b" strokeDasharray="4 4"
              label={{ value: '2 bar', fill: '#f59e0b', fontSize: 11 }} />
            <Line
              type="monotone" dataKey="uptake_mol_kg" name="吸附量 (mol/kg)"
              stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 数据表 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">压力 (bar)</th>
              <th className="px-4 py-2 text-right">mol/kg</th>
              <th className="px-4 py-2 text-right">cm³/cm³</th>
              <th className="px-4 py-2 text-right">模型</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-1.5 font-mono">{row.pressure_bar}</td>
                <td className="px-4 py-1.5 text-right font-mono">{row.uptake_mol_kg.toFixed(4)}</td>
                <td className="px-4 py-1.5 text-right font-mono">{row.uptake_cm3_cm3.toFixed(4)}</td>
                <td className="px-4 py-1.5 text-right">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    row.model_used === '1bar_lora'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}>{row.model_used}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-400 text-right">
        推理耗时：{result.elapsed_ms?.toFixed(0)} ms · 原子数：{result.n_atoms}
      </div>
    </div>
  )
}
