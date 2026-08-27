export type ConfirmDialogActionAppearance =
  | "primary"
  | "primary-outlined"
  | "secondary"
  | "secondary-outlined"
  | "danger"
  | "danger-outlined"
  | "warning"
  | "warning-outlined";

export interface ConfirmDialogAction {
  readonly label: string;
  readonly appearance: ConfirmDialogActionAppearance;
}

export interface ConfirmDialogActions {
  readonly leading?: ConfirmDialogAction;
  readonly cancel: ConfirmDialogAction;
  readonly confirm: ConfirmDialogAction;
}
