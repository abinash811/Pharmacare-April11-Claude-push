import React from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * TableActions - Action button group for table rows
 * Matches the Customers page design reference
 * 
 * @param {Object} props
 * @param {Function} props.onView - View action handler (optional - shows eye icon in Steel Blue)
 * @param {Function} props.onEdit - Edit action handler (optional - shows pencil icon in gray)
 * @param {Function} props.onDelete - Delete action handler (optional - shows trash icon in red)
 * @param {string} props.className - Optional additional classes
 */
export function TableActions({ onView, onEdit, onDelete, className = '' }) {
  return (
    <div className={`flex items-center justify-end gap-1 ${className}`} data-testid="table-actions">
      {onView && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onView}
          className="p-1.5 h-auto hover:bg-blue-50"
          data-testid="action-view"
        >
          <Eye className="w-4 h-4 text-blue-600" />
        </Button>
      )}
      {onEdit && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onEdit}
          className="p-1.5 h-auto hover:bg-gray-100"
          data-testid="action-edit"
        >
          <Edit className="w-4 h-4 text-gray-600" />
        </Button>
      )}
      {onDelete && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDelete}
          className="p-1.5 h-auto hover:bg-red-50"
          data-testid="action-delete"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      )}
    </div>
  );
}
