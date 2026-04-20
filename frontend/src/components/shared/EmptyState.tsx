import React, { ElementType, ReactNode } from 'react';
import {
  Receipt, ShoppingCart, RotateCcw, Truck, Users, Package,
  Search, FileText, AlertCircle,
} from 'lucide-react';

export interface EmptyStateProps {
  icon?: ElementType;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon = FileText,
  title = 'No data found',
  description = 'Try adjusting your search or filters',
  action = null,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-medium text-gray-900 mb-1 text-center">{title}</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface ModuleEmptyStateProps {
  action?: ReactNode;
  filtered?: boolean;
}

export function BillingEmptyState({ action, filtered = false }: ModuleEmptyStateProps) {
  return (
    <EmptyState
      icon={Receipt}
      title={filtered ? 'No bills match your filters' : 'No bills yet'}
      description={filtered ? 'Try adjusting your search or date range' : 'Create your first bill to get started'}
      action={action}
    />
  );
}

export function PurchasesEmptyState({ action, filtered = false }: ModuleEmptyStateProps) {
  return (
    <EmptyState
      icon={ShoppingCart}
      title={filtered ? 'No purchases match your filters' : 'No purchases yet'}
      description={filtered ? 'Try adjusting your search or date range' : 'Record your first purchase to get started'}
      action={action}
    />
  );
}

export function SalesReturnsEmptyState({ action, filtered = false }: ModuleEmptyStateProps) {
  return (
    <EmptyState
      icon={RotateCcw}
      title={filtered ? 'No sales returns match your filters' : 'No sales returns yet'}
      description={filtered ? 'Try adjusting your search or date range' : 'Sales returns will appear here when processed'}
      action={action}
    />
  );
}

export function PurchaseReturnsEmptyState({ action, filtered = false }: ModuleEmptyStateProps) {
  return (
    <EmptyState
      icon={RotateCcw}
      title={filtered ? 'No purchase returns match your filters' : 'No purchase returns yet'}
      description={filtered ? 'Try adjusting your search or date range' : 'Purchase returns will appear here when processed'}
      action={action}
    />
  );
}

export function SuppliersEmptyState({ action, filtered = false }: ModuleEmptyStateProps) {
  return (
    <EmptyState
      icon={Truck}
      title={filtered ? 'No suppliers match your search' : 'No suppliers yet'}
      description={filtered ? 'Try a different search term' : 'Add your first supplier to get started'}
      action={action}
    />
  );
}

export function CustomersEmptyState({ action, filtered = false }: ModuleEmptyStateProps) {
  return (
    <EmptyState
      icon={Users}
      title={filtered ? 'No customers match your search' : 'No customers yet'}
      description={filtered ? 'Try a different search term' : 'Add your first customer to get started'}
      action={action}
    />
  );
}

export function InventoryEmptyState({ action, filtered = false }: ModuleEmptyStateProps) {
  return (
    <EmptyState
      icon={Package}
      title={filtered ? 'No medicines match your search' : 'No inventory yet'}
      description={filtered ? 'Try adjusting your search or filters' : 'Add stock to get started'}
      action={action}
    />
  );
}

export interface SearchEmptyStateProps {
  query?: string;
}

export function SearchEmptyState({ query = '' }: SearchEmptyStateProps) {
  return (
    <EmptyState
      icon={Search}
      title={query ? `No results for "${query}"` : 'No results found'}
      description="Try a different search term or check your spelling"
    />
  );
}

export interface ErrorEmptyStateProps {
  action?: ReactNode;
}

export function ErrorEmptyState({ action }: ErrorEmptyStateProps) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Something went wrong"
      description="We couldn't load the data. Please try again."
      action={action}
    />
  );
}
