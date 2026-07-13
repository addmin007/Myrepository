// src/components/CifUploader.tsx
import { useCallback, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'

interface Props {
  onFile: (f: File) => void
  file: File | null
}

export default function CifUploader({ onFile, file }: Props) {
  const [drag, setDrag] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.cif')) onFile(f)
  }, [onFile])

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
        ${drag ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400'}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById('cif-input')?.click()}
    >
      <input
        id="cif-input" type="file" accept=".cif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <FileText className="text-indigo-600" size={28} />
          <div className="text-left">
            <p className="font-semibold text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            className="ml-4 text-slate-400 hover:text-red-500"
            onClick={(e) => { e.stopPropagation(); onFile(null as any) }}
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <Upload className="mx-auto mb-3 text-slate-400" size={36} />
          <p className="text-slate-600 font-medium">拖放 CIF 文件到此处，或点击选择</p>
          <p className="text-xs text-slate-400 mt-1">仅支持 .cif 格式，最大 20 MB</p>
        </>
      )}
    </div>
  )
}
