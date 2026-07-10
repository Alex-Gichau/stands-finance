import mongoose, { Schema, Document } from 'mongoose';

// 1. AuditLog
/** AuditLog interface definition */
export interface IAuditLog extends Document {
  id?: number;
  action: string;
  details: string;
  performedBy: string;
  timestamp: Date;
  groupId?: string;
  metadata?: any;
}
/** AuditLog Schema definition for MongoDB */
const AuditLogSchema = new Schema<IAuditLog>({
  action: { type: String, required: true, index: true },
  details: { type: String, required: true },
  performedBy: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  groupId: { type: String },
  metadata: { type: Schema.Types.Mixed },
});
export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

// 2. Alert
/** Alert interface definition */
export interface IAlert extends Document {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  targetRole?: string;
}
/** Alert Schema definition for MongoDB */
const AlertSchema = new Schema<IAlert>({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true },
  severity: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  targetRole: { type: String },
});
export const Alert = mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema);

// 3. FiscalYear
/** FiscalYear interface definition */
export interface IFiscalYear extends Document {
  id: string;
  year: number;
  label: string;
  status: string;
  createdAt: Date;
  notes?: string;
}
/** FiscalYear Schema definition for MongoDB */
const FiscalYearSchema = new Schema<IFiscalYear>({
  id: { type: String, required: true, unique: true, index: true },
  year: { type: Number, required: true },
  label: { type: String, required: true },
  status: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  notes: { type: String },
});
export const FiscalYear = mongoose.models.FiscalYear || mongoose.model<IFiscalYear>('FiscalYear', FiscalYearSchema);

// 4. Transaction
export interface ITransaction extends Document {
  id: string;
  externalRef?: string;
  sourceSystem: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  category: string;
  timestamp: Date;
  performedBy: string;
  metadata?: any;
}
const TransactionSchema = new Schema<ITransaction>({
  id: { type: String, required: true, unique: true, index: true },
  externalRef: { type: String },
  sourceSystem: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true },
  status: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  performedBy: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
});
export const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);

// 5. Forecast
export interface IForecast extends Document {
  month: string;
  projected: number;
  actual: number;
}
const ForecastSchema = new Schema<IForecast>({
  month: { type: String, required: true, unique: true, index: true },
  projected: { type: Number, required: true },
  actual: { type: Number, required: true },
});
export const Forecast = mongoose.models.Forecast || mongoose.model<IForecast>('Forecast', ForecastSchema);

// 6. Report
export interface IReport extends Document {
  id: string;
  title: string;
  description: string;
  generatedBy: string;
  generatedById: string;
  timestamp: Date;
  period: string;
  stats: any;
  filters: any;
  itemCount: number;
}
const ReportSchema = new Schema<IReport>({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  generatedBy: { type: String, required: true },
  generatedById: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  period: { type: String, required: true },
  stats: { type: Schema.Types.Mixed, required: true },
  filters: { type: Schema.Types.Mixed, required: true },
  itemCount: { type: Number, required: true },
});
export const Report = mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);

// 7. Permission
export interface IPermission extends Document {
  id: string;
  role: string;
  access: any;
  actions: any;
}
const PermissionSchema = new Schema<IPermission>({
  id: { type: String, required: true, unique: true, index: true },
  role: { type: String, required: true, unique: true, index: true },
  access: { type: Schema.Types.Mixed, required: true },
  actions: { type: Schema.Types.Mixed, required: true },
});
export const Permission = mongoose.models.Permission || mongoose.model<IPermission>('Permission', PermissionSchema);

// 8. Threshold
export interface IThreshold extends Document {
  id: string;
  type: string;
  threshold: number;
  isEnabled: boolean;
  notifyEmail: boolean;
}
const ThresholdSchema = new Schema<IThreshold>({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true },
  threshold: { type: Number, required: true },
  isEnabled: { type: Boolean, default: true },
  notifyEmail: { type: Boolean, default: false },
});
export const Threshold = mongoose.models.Threshold || mongoose.model<IThreshold>('Threshold', ThresholdSchema);

// 9. ChurchGroup
export interface IChurchGroup extends Document {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}
const ChurchGroupSchema = new Schema<IChurchGroup>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});
export const ChurchGroup = mongoose.models.ChurchGroup || mongoose.model<IChurchGroup>('ChurchGroup', ChurchGroupSchema);

// 10. LedgerBook
export interface ILedgerBook extends Document {
  id: string;
  ministryId?: string;
  ministryName: string;
  bookName?: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  creatorName?: string;
  budgetLimit: number;
  spentAmount: number;
  notes?: string;
  status: string;
}
const LedgerBookSchema = new Schema<ILedgerBook>({
  id: { type: String, required: true, unique: true, index: true },
  ministryId: { type: String },
  ministryName: { type: String, required: true },
  bookName: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  creatorName: { type: String },
  budgetLimit: { type: Number, required: true },
  spentAmount: { type: Number, default: 0 },
  notes: { type: String },
  status: { type: String, default: 'ACTIVE' },
});
export const LedgerBook = mongoose.models.LedgerBook || mongoose.model<ILedgerBook>('LedgerBook', LedgerBookSchema);

// 11. SupplementaryBudget
export interface ISupplementaryBudget extends Document {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  role: string;
  projectId: string;
  projectName: string;
  amount: number;
  justification: string;
  submittedAt: Date;
  status: string;
}
const SupplementaryBudgetSchema = new Schema<ISupplementaryBudget>({
  id: { type: String, required: true, unique: true, index: true },
  requesterId: { type: String, required: true },
  requesterName: { type: String, required: true },
  requesterEmail: { type: String, required: true },
  role: { type: String, required: true },
  projectId: { type: String, required: true },
  projectName: { type: String, required: true },
  amount: { type: Number, required: true },
  justification: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'PENDING' },
});
export const SupplementaryBudget = mongoose.models.SupplementaryBudget || mongoose.model<ISupplementaryBudget>('SupplementaryBudget', SupplementaryBudgetSchema);

// 12. Vendor
export interface IVendor extends Document {
  id: string;
  name: string;
  contact?: string;
  location?: string;
  offerings?: string;
  createdAt: Date;
  addedBy: string;
  status: string;
}
const VendorSchema = new Schema<IVendor>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  contact: { type: String },
  location: { type: String },
  offerings: { type: String },
  createdAt: { type: Date, default: Date.now },
  addedBy: { type: String, required: true },
  status: { type: String, default: 'PENDING' },
});
export const Vendor = mongoose.models.Vendor || mongoose.model<IVendor>('Vendor', VendorSchema);
