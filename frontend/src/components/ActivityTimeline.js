import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, User, FileText, DollarSign, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ActivityTimeline({ entityType, entityId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (entityType && entityId) {
      fetchAuditLogs();
    }
  }, [entityType, entityId]);

  const fetchAuditLogs = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/audit-logs/entity/${entityType}/${entityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Failed to load activity history');
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'create':
        return <FileText className="w-4 h-4 text-green-600" />;
      case 'update':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'delete':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'status_change':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 border-green-200';
      case 'update':
        return 'bg-blue-100 border-blue-200';
      case 'delete':
        return 'bg-red-100 border-red-200';
      case 'status_change':
        return 'bg-orange-100 border-orange-200';
      default:
        return 'bg-gray-100 border-gray-200';
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getActionDescription = (log) => {
    switch (log.action) {
      case 'create':
        return `Created ${log.entity_type}`;
      case 'update':
        return `Updated ${log.entity_type}`;
      case 'delete':
        return `Deleted ${log.entity_type}`;
      case 'status_change':
        if (log.old_value?.status && log.new_value?.status) {
          return `Status changed from "${log.old_value.status}" to "${log.new_value.status}"`;
        }
        return 'Status changed';
      default:
        return log.action;
    }
  };

  const renderChanges = (log) => {
    if (!log.changes) return null;

    return (
      <div className="mt-2 text-xs space-y-1">
        {Object.entries(log.changes).map(([key, change]) => (
          <div key={key} className="flex gap-2">
            <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
            <span className="text-gray-500">{JSON.stringify(change.old)}</span>
            <span>→</span>
            <span className="text-gray-900">{JSON.stringify(change.new)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-sm text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-sm text-gray-500">No activity recorded</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Activity History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log, index) => (
            <div key={log.id} className="relative">
              {/* Timeline line */}
              {index < logs.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
              )}
              
              {/* Activity item */}
              <div className="flex gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)}
                </div>
                
                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{getActionDescription(log)}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                          <User className="w-3 h-3" />
                          <span>{log.performed_by_name}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(log.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Show reason if exists */}
                    {log.reason && (
                      <div className="mt-2 text-xs">
                        <span className="font-medium">Reason:</span> {log.reason}
                      </div>
                    )}
                    
                    {/* Show changes */}
                    {renderChanges(log)}
                    
                    {/* Show key details for create action */}
                    {log.action === 'create' && log.new_value && (
                      <div className="mt-2 text-xs space-y-1">
                        {log.new_value.bill_number && (
                          <div><span className="font-medium">Bill No:</span> {log.new_value.bill_number}</div>
                        )}
                        {log.new_value.total_amount !== undefined && (
                          <div><span className="font-medium">Amount:</span> ₹{log.new_value.total_amount}</div>
                        )}
                        {log.new_value.status && (
                          <div><span className="font-medium">Status:</span> {log.new_value.status}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
