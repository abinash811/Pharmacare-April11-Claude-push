import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { AppButton } from '@/components/shared';
import api from '@/lib/axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FileUploadZone({ onFileSelect, isLoading }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) onFileSelect(e.dataTransfer.files[0]);
  }, [onFileSelect]);

  const handleFileInput = (e) => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]); };

  const downloadTemplate = async () => {
    try {
      const response = await api.get(`${API}/inventory/bulk-upload/template`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', 'inventory_upload_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch { toast.error('Failed to download template'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AppButton variant="ghost" icon={<Download className="w-4 h-4" strokeWidth={1.5} />} onClick={downloadTemplate} data-testid="download-template-btn">
          Download Sample Template
        </AppButton>
      </div>
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${isDragging ? 'border-brand bg-blue-50' : 'border-gray-300 hover:border-brand hover:bg-gray-50'}`}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="file-upload-zone"
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" data-testid="file-input" />
        {isLoading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-brand animate-spin" />
            <p className="mt-4 text-gray-600">Parsing file...</p>
          </div>
        ) : (
          <>
            <FileSpreadsheet className={`w-16 h-16 mx-auto ${isDragging ? 'text-brand' : 'text-gray-400'}`} strokeWidth={1.5} />
            <p className="mt-4 text-lg font-medium text-gray-700">{isDragging ? 'Drop your file here' : 'Drag & drop your Excel file here'}</p>
            <p className="mt-2 text-sm text-gray-500">or click to browse</p>
            <p className="mt-4 text-xs text-gray-400">Supported formats: .xlsx, .xls (Max 5,000 rows)</p>
          </>
        )}
      </div>
    </div>
  );
}
