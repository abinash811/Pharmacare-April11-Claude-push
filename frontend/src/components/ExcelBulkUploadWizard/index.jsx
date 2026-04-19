import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { FileSpreadsheet, ArrowLeft, ArrowRight, Eye, Download, FileCheck, RefreshCw, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';
import StepIndicator from './StepIndicator';
import FileUploadZone from './FileUploadZone';
import ColumnMapping from './ColumnMapping';
import ValidationPreview from './ValidationPreview';
import ImportProgress from './ImportProgress';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ExcelBulkUploadWizard({ isOpen, onClose, onImportComplete }) {
  const [currentStep, setCurrentStep]         = useState(0);
  const [isLoading, setIsLoading]             = useState(false);
  const [jobId, setJobId]                     = useState(null);
  const [fileInfo, setFileInfo]               = useState(null);
  const [mapping, setMapping]                 = useState({});
  const [validationResults, setValidationResults] = useState(null);
  const [importProgress, setImportProgress]   = useState(null);
  const [importStatus, setImportStatus]       = useState(null);

  const steps      = ['Upload File', 'Map Columns', 'Preview & Validate', 'Import'];
  const pollingRef = useRef(null);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleFileSelect = async (file) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post(`${API}/inventory/bulk-upload/parse`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setJobId(response.data.job_id);
      setFileInfo({
        filename:       response.data.filename,
        totalRows:      response.data.total_rows,
        columns:        response.data.columns,
        sampleData:     response.data.sample_data,
        autoMappings:   response.data.auto_mappings,
        requiredFields: response.data.required_fields,
        optionalFields: response.data.optional_fields,
      });
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
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const validateMapping = async () => {
    const missingRequired = fileInfo.requiredFields.filter((f) => !mapping[f]);
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.join(', ')}`);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post(`${API}/inventory/bulk-upload/validate`, {
        job_id: jobId, column_mapping: mapping,
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
    if (!validationResults?.can_import) { toast.error('No valid rows to import'); return; }
    setIsLoading(true);
    setCurrentStep(3);
    try {
      await api.post(`${API}/inventory/bulk-upload/import`, {
        job_id: jobId, import_valid_only: importValidOnly,
      });
      setImportStatus('importing');
      pollingRef.current = setInterval(async () => {
        try {
          const prog = await api.get(`${API}/inventory/bulk-upload/progress/${jobId}`);
          setImportProgress(prog.data.import_progress);
          setImportStatus(prog.data.status);
          if (prog.data.status === 'completed') {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            toast.success('Import completed successfully!');
          }
        } catch { /* polling errors are non-fatal */ }
      }, 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
      setImportStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadErrorReport = async () => {
    try {
      const response = await api.get(`${API}/inventory/bulk-upload/error-report/${jobId}`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `validation_report_${jobId.substring(0, 8)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Error report downloaded');
    } catch { toast.error('Failed to download error report'); }
  };

  const handleComplete = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    onImportComplete?.();
    onClose();
  };

  const resetWizard = () => {
    setCurrentStep(0); setJobId(null); setFileInfo(null); setMapping({});
    setValidationResults(null); setImportProgress(null); setImportStatus(null);
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 gap-0 sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col [&>button]:hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-brand to-brand-dark rounded-t-lg">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-white" strokeWidth={1.5} />
            <h2 className="text-xl font-semibold text-white">Excel Bulk Upload</h2>
          </div>
          <AppButton
            variant="ghost"
            iconOnly
            icon={<X className="w-5 h-5 text-white/80" strokeWidth={1.5} />}
            onClick={onClose}
            aria-label="Close"
            data-testid="close-wizard-btn"
            className="hover:text-white hover:bg-white/10"
          />
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-6">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {currentStep === 0 && (
            <FileUploadZone onFileSelect={handleFileSelect} isLoading={isLoading} />
          )}
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
          {currentStep === 2 && validationResults && (
            <ValidationPreview
              validationResults={validationResults.preview_results}
              totalRows={validationResults.total_rows}
              validCount={validationResults.valid_count}
              errorCount={validationResults.error_count}
              warningCount={validationResults.warning_count}
            />
          )}
          {currentStep === 3 && (
            <ImportProgress progress={importProgress} status={importStatus} onComplete={handleComplete} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div>
            {currentStep > 0 && currentStep < 3 && (
              <AppButton
                variant="ghost"
                icon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />}
                onClick={() => setCurrentStep((prev) => prev - 1)}
                disabled={isLoading}
                data-testid="back-btn"
              >
                Back
              </AppButton>
            )}
            {currentStep === 0 && (
              <AppButton
                variant="ghost"
                icon={<RefreshCw className="w-4 h-4" strokeWidth={1.5} />}
                onClick={resetWizard}
                data-testid="reset-btn"
              >
                Reset
              </AppButton>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 1 && (
              <AppButton
                onClick={validateMapping}
                disabled={isLoading}
                icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                data-testid="validate-btn"
              >
                Validate Data
                <ArrowRight className="w-4 h-4 ml-1" strokeWidth={1.5} />
              </AppButton>
            )}

            {currentStep === 2 && (
              <>
                {validationResults?.error_count > 0 && (
                  <AppButton
                    variant="outline"
                    icon={<Download className="w-4 h-4" strokeWidth={1.5} />}
                    onClick={downloadErrorReport}
                    data-testid="download-report-btn"
                  >
                    Download Report
                  </AppButton>
                )}
                <AppButton
                  onClick={() => startImport(true)}
                  disabled={isLoading || !validationResults?.can_import}
                  icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <FileCheck className="w-4 h-4" strokeWidth={1.5} />}
                  data-testid="start-import-btn"
                >
                  Import {validationResults?.valid_count || 0} Valid Rows
                </AppButton>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
