import React, { useState, useCallback, useEffect, useRef } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { 
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, AlertTriangle, 
  Download, ArrowRight, ArrowLeft, X, Loader2, MapPin, Eye, 
  FileCheck, RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Step indicator component
const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center justify-center mb-8">
    {steps.map((step, index) => (
      <React.Fragment key={index}>
        <div className="flex flex-col items-center">
          <div 
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              index < currentStep 
                ? 'bg-green-500 text-white' 
                : index === currentStep 
                  ? 'bg-brand text-white ring-4 ring-blue-200' 
                  : 'bg-gray-200 text-gray-500'
            }`}
          >
            {index < currentStep ? <CheckCircle className="w-5 h-5" /> : index + 1}
          </div>
          <span className={`text-xs mt-2 font-medium ${
            index === currentStep ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {step}
          </span>
        </div>
        {index < steps.length - 1 && (
          <div className={`w-16 h-1 mx-2 rounded ${
            index < currentStep ? 'bg-green-500' : 'bg-gray-200'
          }`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// Drag and drop upload component
const FileUploadZone = ({ onFileSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/inventory/bulk-upload/template`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory_upload_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
          data-testid="download-template-btn"
        >
          <Download className="w-4 h-4" />
          Download Sample Template
        </button>
      </div>
      
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="file-upload-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
          data-testid="file-input"
        />
        
        {isLoading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="mt-4 text-gray-600">Parsing file...</p>
          </div>
        ) : (
          <>
            <FileSpreadsheet className={`w-16 h-16 mx-auto ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="mt-4 text-lg font-medium text-gray-700">
              {isDragging ? 'Drop your file here' : 'Drag & drop your Excel file here'}
            </p>
            <p className="mt-2 text-sm text-gray-500">or click to browse</p>
            <p className="mt-4 text-xs text-gray-400">Supported formats: .xlsx, .xls (Max 5,000 rows)</p>
          </>
        )}
      </div>
    </div>
  );
};

// Column mapping component
const ColumnMapping = ({ fileColumns, autoMappings, requiredFields, optionalFields, onMappingChange, mapping }) => {
  const allFields = [
    ...requiredFields.map(f => ({ field: f, required: true })),
    ...optionalFields.map(f => ({ field: f, required: false }))
  ];

  const fieldLabels = {
    sku: 'SKU / Product Code',
    name: 'Product Name',
    price: 'MRP per Unit',
    quantity: 'Quantity (Packs)',
    expiry_date: 'Expiry Date',
    batch_number: 'Batch Number',
    brand: 'Brand / Manufacturer',
    category: 'Category',
    cost_price: 'Cost Price per Unit',
    gst_percent: 'GST %',
    hsn_code: 'HSN Code',
    units_per_pack: 'Units per Pack'
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Map Your Columns</p>
            <p className="text-sm text-blue-600 mt-1">
              Match your Excel columns to the system fields. Fields marked with * are required.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allFields.map(({ field, required }) => (
          <div key={field} className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              {fieldLabels[field] || field}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={mapping[field] || ''}
              onChange={(e) => onMappingChange(field, e.target.value)}
              className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                required && !mapping[field] ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              data-testid={`mapping-${field}`}
            >
              <option value="">-- Select Column --</option>
              {fileColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            {autoMappings[field] && mapping[field] === autoMappings[field] && (
              <span className="text-xs text-green-600 mt-1">Auto-detected</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Preview and validation component
const ValidationPreview = ({ validationResults, totalRows, validCount, errorCount, warningCount }) => {
  const [filter, setFilter] = useState('all');
  
  const filteredResults = validationResults?.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  }) || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'valid': return 'bg-green-50';
      case 'warning': return 'bg-yellow-50';
      case 'error': return 'bg-red-50';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            filter === 'valid' ? 'border-green-500 bg-green-50' : 'border-green-200 bg-green-50 hover:border-green-400'
          }`}
          onClick={() => setFilter(filter === 'valid' ? 'all' : 'valid')}
          data-testid="filter-valid"
        >
          <div className="flex items-center justify-between">
            <span className="text-green-800 font-medium">Valid</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700 mt-1">{validCount}</p>
        </div>
        
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            filter === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-yellow-200 bg-yellow-50 hover:border-yellow-400'
          }`}
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          data-testid="filter-warning"
        >
          <div className="flex items-center justify-between">
            <span className="text-yellow-800 font-medium">Warnings</span>
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{warningCount}</p>
        </div>
        
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            filter === 'error' ? 'border-red-500 bg-red-50' : 'border-red-200 bg-red-50 hover:border-red-400'
          }`}
          onClick={() => setFilter(filter === 'error' ? 'all' : 'error')}
          data-testid="filter-error"
        >
          <div className="flex items-center justify-between">
            <span className="text-red-800 font-medium">Errors</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{errorCount}</p>
        </div>
      </div>

      {/* Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Preview ({filter === 'all' ? 'All rows' : `${filter} only`})
          </span>
          <span className="text-xs text-gray-500">Showing first 10 rows</span>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Row</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Batch</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">MRP</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredResults.map((result, idx) => (
                <tr key={idx} className={getStatusBg(result.status)}>
                  <td className="px-4 py-2 text-gray-600">{result.row_number}</td>
                  <td className="px-4 py-2">{getStatusIcon(result.status)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{result.data?.sku || '-'}</td>
                  <td className="px-4 py-2">{result.data?.name || '-'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{result.data?.batch_number || '-'}</td>
                  <td className="px-4 py-2 text-right">{result.data?.quantity || '-'}</td>
                  <td className="px-4 py-2 text-right">{result.data?.price ? `₹${result.data.price}` : '-'}</td>
                  <td className="px-4 py-2">
                    {result.errors?.length > 0 && (
                      <span className="text-xs text-red-600">{result.errors.join('; ')}</span>
                    )}
                    {result.warnings?.length > 0 && (
                      <span className="text-xs text-yellow-600">{result.warnings.join('; ')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredResults.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No rows to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Import progress component
const ImportProgress = ({ progress, status, onComplete }) => {
  const percentage = progress?.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {status === 'importing' && (
        <div className="text-center py-8">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
          <p className="mt-4 text-lg font-medium text-gray-700">Importing inventory...</p>
          <p className="text-sm text-gray-500 mt-2">Please don't close this window</p>
        </div>
      )}

      {status === 'completed' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <p className="mt-4 text-lg font-medium text-green-700">Import Complete!</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
        <div 
          className="bg-brand h-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-700">{progress?.processed || 0}</p>
          <p className="text-sm text-gray-500">Processed</p>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-700">{progress?.success || 0}</p>
          <p className="text-sm text-green-600">Successful</p>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <p className="text-2xl font-bold text-red-700">{progress?.failed || 0}</p>
          <p className="text-sm text-red-600">Failed</p>
        </div>
      </div>

      {/* Error Details */}
      {progress?.errors?.length > 0 && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <p className="font-medium text-red-800 mb-2">Import Errors:</p>
          <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
            {progress.errors.map((err, idx) => (
              <li key={idx}>Row {err.row_number}: {err.error}</li>
            ))}
          </ul>
        </div>
      )}

      {status === 'completed' && (
        <div className="text-center">
          <button
            onClick={onComplete}
            className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-[#3a6fa0] transition-colors"
            data-testid="finish-import-btn"
          >
            Finish & Close
          </button>
        </div>
      )}
    </div>
  );
};

// Main Wizard Component
export default function ExcelBulkUploadWizard({ isOpen, onClose, onImportComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [mapping, setMapping] = useState({});
  const [validationResults, setValidationResults] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  
  const steps = ['Upload File', 'Map Columns', 'Preview & Validate', 'Import'];
  const pollingRef = useRef(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleFileSelect = async (file) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/inventory/bulk-upload/parse`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setJobId(response.data.job_id);
      setFileInfo({
        filename: response.data.filename,
        totalRows: response.data.total_rows,
        columns: response.data.columns,
        sampleData: response.data.sample_data,
        autoMappings: response.data.auto_mappings,
        requiredFields: response.data.required_fields,
        optionalFields: response.data.optional_fields
      });
      
      // Set auto-detected mappings
      setMapping(response.data.auto_mappings || {});
      
      toast.success(`File parsed: ${response.data.total_rows} rows found`);
      setCurrentStep(1);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to parse file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (field, value) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const validateMapping = async () => {
    // Check required fields
    const missingRequired = fileInfo.requiredFields.filter(f => !mapping[f]);
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.join(', ')}`);
      return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(`${API}/inventory/bulk-upload/validate`, {
        job_id: jobId,
        column_mapping: mapping
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setValidationResults(response.data);
      toast.success('Validation complete');
      setCurrentStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const startImport = async (importValidOnly = true) => {
    if (!validationResults?.can_import) {
      toast.error('No valid rows to import');
      return;
    }

    setIsLoading(true);
    setCurrentStep(3);
    const token = localStorage.getItem('token');

    try {
      await axios.post(`${API}/inventory/bulk-upload/import`, {
        job_id: jobId,
        import_valid_only: importValidOnly
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setImportStatus('importing');
      
      // Start polling for progress
      pollingRef.current = setInterval(async () => {
        try {
          const progressResponse = await axios.get(
            `${API}/inventory/bulk-upload/progress/${jobId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          setImportProgress(progressResponse.data.import_progress);
          setImportStatus(progressResponse.data.status);
          
          if (progressResponse.data.status === 'completed') {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            toast.success('Import completed successfully!');
          }
        } catch (error) {
          console.error('Progress polling error:', error);
        }
      }, 1000);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
      setImportStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadErrorReport = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(
        `${API}/inventory/bulk-upload/error-report/${jobId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `validation_report_${jobId.substring(0, 8)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Error report downloaded');
    } catch (error) {
      toast.error('Failed to download error report');
    }
  };

  const handleComplete = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    onImportComplete?.();
    onClose();
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setJobId(null);
    setFileInfo(null);
    setMapping({});
    setValidationResults(null);
    setImportProgress(null);
    setImportStatus(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Excel Bulk Upload</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            data-testid="close-wizard-btn"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-6">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: File Upload */}
          {currentStep === 0 && (
            <FileUploadZone onFileSelect={handleFileSelect} isLoading={isLoading} />
          )}

          {/* Step 2: Column Mapping */}
          {currentStep === 1 && fileInfo && (
            <ColumnMapping
              fileColumns={fileInfo.columns}
              autoMappings={fileInfo.autoMappings}
              requiredFields={fileInfo.requiredFields}
              optionalFields={fileInfo.optionalFields}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
          )}

          {/* Step 3: Preview & Validation */}
          {currentStep === 2 && validationResults && (
            <ValidationPreview
              validationResults={validationResults.preview_results}
              totalRows={validationResults.total_rows}
              validCount={validationResults.valid_count}
              errorCount={validationResults.error_count}
              warningCount={validationResults.warning_count}
            />
          )}

          {/* Step 4: Import Progress */}
          {currentStep === 3 && (
            <ImportProgress
              progress={importProgress}
              status={importStatus}
              onComplete={handleComplete}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div>
            {currentStep > 0 && currentStep < 3 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={isLoading}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {currentStep === 0 && (
              <button
                onClick={resetWizard}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
                data-testid="reset-btn"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Step 2: Proceed to validate */}
            {currentStep === 1 && (
              <button
                onClick={validateMapping}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg hover:bg-[#3a6fa0] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="validate-btn"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Validate Data
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Step 3: Download report & Start import */}
            {currentStep === 2 && (
              <>
                {validationResults?.error_count > 0 && (
                  <button
                    onClick={downloadErrorReport}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                    data-testid="download-report-btn"
                  >
                    <Download className="w-4 h-4" />
                    Download Report
                  </button>
                )}
                <button
                  onClick={() => startImport(true)}
                  disabled={isLoading || !validationResults?.can_import}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="start-import-btn"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                  Import {validationResults?.valid_count || 0} Valid Rows
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
