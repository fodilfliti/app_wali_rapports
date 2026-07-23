/** Workflow tree types — Wilaya live map; Direction scaffold (Phase P6). */

export type WorkflowLevelKind = 'create' | 'validate' | 'final_validate';

export type WorkflowLevel = {
  kind: WorkflowLevelKind;
  /** Stable id for config / bypass rules (e.g. chef bypass). */
  id: string;
  labelKey?: string;
  /** Account role that acts at this level (Wilaya mapping). */
  actorRole?: 'OFFICE_USER' | 'CHEF_CABINET' | 'WALI';
};

export type WorkflowTree = {
  id: string;
  labelKey?: string;
  levels: WorkflowLevel[];
};

/** Office → Chef → Wali (existing Wilaya statuses). */
export const WILAYA_DEFAULT_TREE: WorkflowTree = {
  id: 'wilaya_default',
  labelKey: 'workflowWilayaDefault',
  levels: [
    { id: 'office_create', kind: 'create', labelKey: 'workflowLevelCreate', actorRole: 'OFFICE_USER' },
    { id: 'chef_validate', kind: 'validate', labelKey: 'workflowLevelValidate', actorRole: 'CHEF_CABINET' },
    { id: 'wali_final', kind: 'final_validate', labelKey: 'workflowLevelFinalValidate', actorRole: 'WALI' },
  ],
};

/** Direction example — 3 levels (create → validate → final_validate). */
export const DIRECTION_EXAMPLE_3_LEVEL: WorkflowTree = {
  id: 'direction_3_level',
  labelKey: 'workflowDirection3Level',
  levels: [
    { id: 'dir_create', kind: 'create', labelKey: 'workflowLevelCreate' },
    { id: 'dir_validate', kind: 'validate', labelKey: 'workflowLevelValidate' },
    { id: 'dir_final', kind: 'final_validate', labelKey: 'workflowLevelFinalValidate' },
  ],
};

/** Direction example — 2 levels (create → final_validate, chef bypass). */
export const DIRECTION_EXAMPLE_2_LEVEL: WorkflowTree = {
  id: 'direction_2_level',
  labelKey: 'workflowDirection2Level',
  levels: [
    { id: 'dir_create', kind: 'create', labelKey: 'workflowLevelCreate' },
    { id: 'dir_final', kind: 'final_validate', labelKey: 'workflowLevelFinalValidate' },
  ],
};
