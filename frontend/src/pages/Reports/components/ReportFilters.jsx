/**
 * ReportFilters — date range / expiry days filter + action buttons.
 * Props:
 *   activeReport  {string}
 *   dateRange     {{ from: string, to: string }}
 *   expiryDays    {number}
 *   hasData       {boolean}
 *   onDateChange  {(range) => void}
 *   onExpiryChange {(days: number) => void}
 *   onRefresh     {() => void}
 *   onExportCSV   {() => void}
 *   onExportExcel {() => void}
 */
import React from 'react';
import { RefreshCw, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function ReportFilters({
  activeReport, dateRange, expiryDays, hasData,
  onDateChange, onExpiryChange, onRefresh, onExportCSV, onExportExcel,
}) {
  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {activeReport === 'sales' && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">From:</label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => onDateChange({ ...dateRange, from: e.target.value })}
                  className="w-40"
                  data-testid="date-from"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">To:</label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => onDateChange({ ...dateRange, to: e.target.value })}
                  className="w-40"
                  data-testid="date-to"
                />
              </div>
            </>
          )}

          {activeReport === 'expiry' && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Expiring in:</label>
              <select
                value={expiryDays}
                onChange={(e) => onExpiryChange(parseInt(e.target.value))}
                className="px-3 py-2 border rounded-lg"
                data-testid="expiry-days"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>6 months</option>
              </select>
            </div>
          )}

          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button onClick={onExportCSV} variant="outline" disabled={!hasData} data-testid="export-csv-btn">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>

          <Button onClick={onExportExcel} variant="outline" disabled={!hasData} data-testid="export-excel-btn">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
