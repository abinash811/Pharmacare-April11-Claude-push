import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

/**
 * ConfirmDialog - Reusable confirmation dialog
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {function} props.onClose - Called when dialog should close
 * @param {function} props.onConfirm - Called when confirm button is clicked
 * @param {string} props.title - Dialog title
 * @param {string} props.description - Dialog description/message
 * @param {string} props.confirmLabel - Label for confirm button (default: "Confirm")
 * @param {string} props.cancelLabel - Label for cancel button (default: "Cancel")
 * @param {boolean} props.isDestructive - If true, confirm button is red (default: false)
 * @param {boolean} props.isLoading - If true, shows spinner and disables buttons (default: false)
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) {
  const handleConfirm = async () => {
    if (isLoading) return;
    await onConfirm?.();
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={handleClose}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading}
            data-testid="confirm-dialog-confirm"
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * DeleteConfirmDialog - Pre-configured for delete actions
 */
export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  itemName = 'this item',
  isLoading = false,
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Confirmation"
      description={`Are you sure you want to delete ${itemName}? This action cannot be undone.`}
      confirmLabel="Delete"
      isDestructive={true}
      isLoading={isLoading}
    />
  );
}

/**
 * DiscardConfirmDialog - Pre-configured for discard changes
 */
export function DiscardConfirmDialog({
  open,
  onClose,
  onConfirm,
  isLoading = false,
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Discard Changes?"
      description="You have unsaved changes. Are you sure you want to discard them?"
      confirmLabel="Discard"
      isDestructive={true}
      isLoading={isLoading}
    />
  );
}
