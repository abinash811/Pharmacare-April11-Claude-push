import React from 'react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => { if (!isLoading) await onConfirm?.(); };
  const handleClose   = ()       => { if (!isLoading) onClose?.(); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={handleClose}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading} data-testid="confirm-dialog-cancel">
            {cancelLabel}
          </Button>
          <Button variant={isDestructive ? 'destructive' : 'default'} onClick={handleConfirm} disabled={isLoading} data-testid="confirm-dialog-confirm">
            {isLoading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  itemName?: string;
  isLoading?: boolean;
}

export function DeleteConfirmDialog({ open, onClose, onConfirm, itemName = 'this item', isLoading = false }: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open} onClose={onClose} onConfirm={onConfirm}
      title="Delete Confirmation"
      description={`Are you sure you want to delete ${itemName}? This action cannot be undone.`}
      confirmLabel="Delete" isDestructive isLoading={isLoading}
    />
  );
}

export interface DiscardConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function DiscardConfirmDialog({ open, onClose, onConfirm, isLoading = false }: DiscardConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open} onClose={onClose} onConfirm={onConfirm}
      title="Discard Changes?"
      description="You have unsaved changes. Are you sure you want to discard them?"
      confirmLabel="Discard" isDestructive isLoading={isLoading}
    />
  );
}
