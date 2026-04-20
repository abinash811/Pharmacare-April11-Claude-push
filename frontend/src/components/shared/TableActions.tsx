import React from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

export interface TableActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function TableActions({ onView, onEdit, onDelete, className = '' }: TableActionsProps) {
  return (
    <div className={`flex items-center justify-end gap-1 ${className}`} data-testid="table-actions">
      {onView && (
        <Button variant="ghost" size="sm" onClick={onView} className="p-1.5 h-auto hover:bg-blue-50" data-testid="action-view">
          <Eye className="w-4 h-4 text-blue-600" />
        </Button>
      )}
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit} className="p-1.5 h-auto hover:bg-gray-100" data-testid="action-edit">
          <Edit className="w-4 h-4 text-gray-600" />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="sm" onClick={onDelete} className="p-1.5 h-auto hover:bg-red-50" data-testid="action-delete">
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      )}
    </div>
  );
}
