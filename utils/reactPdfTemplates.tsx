import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from '@react-pdf/renderer';

export interface ReportMeta {
  report_id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  currency?: string;
  locale?: string;
}

export interface Submitter {
  name: string;
  email: string;
  title?: string;
  employee_id?: string;
  department?: string;
}

export interface Recipient {
  company_name: string;
  approver_name: string;
  approver_email: string;
  address_lines?: string[];
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

export interface Summary {
  total_reimbursable: number;
  non_reimbursable: number;
  per_diem_days?: number;
  totals_by_category?: CategoryTotal[];
}

export interface LineItem {
  date: string;
  merchant: string;
  category: string;
  notes?: string;
  amount: number;
  converted_amount?: number;
  file_url?: string;
  policy_flag?: boolean;
}

export interface Branding {
  template?: string;
}

export interface Appendix {
  include_receipt_gallery?: boolean;
}

export interface Policy {
  notes?: string[];
}

export interface Signoff {
  submitter_signature_text?: string;
}

export interface ExpenseReportData {
  reportMeta: ReportMeta;
  submitter: Submitter;
  recipient: Recipient;
  branding?: Branding;
  summary?: Summary;
  line_items?: LineItem[];
  policy?: Policy;
  appendix?: Appendix;
  signoff?: Signoff;
}

// Improved professional styles with better typography
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
  },
  
  // Header - clear and prominent
  header: {
    marginBottom: 25,
    paddingBottom: 20,
    borderBottom: '3px solid #2563eb',
  },
  
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  
  reportSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 'normal',
  },
  
  metaSection: {
    alignItems: 'flex-end',
  },
  
  metaRow: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 3,
  },
  
  metaLabel: {
    fontWeight: 'bold',
    color: '#374151',
  },
  
  // Info section - clean grid
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 30,
  },
  
  infoBlock: {
    flex: 1,
  },
  
  infoHeading: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  
  infoText: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  
  infoTextBold: {
    fontWeight: 'bold',
    color: '#111827',
  },
  
  // Summary - prominent display
  summaryBox: {
    backgroundColor: '#f8fafc',
    padding: 20,
    marginBottom: 25,
    borderRadius: 6,
    border: '1px solid #e2e8f0',
  },
  
  summaryGrid: {
    flexDirection: 'row',
    gap: 25,
  },
  
  summaryItem: {
    flex: 1,
  },
  
  summaryLabel: {
    fontSize: 9,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    letterSpacing: -0.5,
  },
  
  summaryValueLarge: {
    fontSize: 24,
  },
  
  // Table - clean and readable
  tableSection: {
    marginBottom: 20,
  },
  
  tableTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: '10 8',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  
  tableRow: {
    flexDirection: 'row',
    padding: '10 8',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  
  tableCell: {
    fontSize: 9,
    color: '#1f2937',
    lineHeight: 1.4,
  },
  
  // Column widths - optimized
  colDate: { 
    width: '12%',
  },
  colMerchant: { 
    width: '20%',
  },
  colCategory: { 
    width: '12%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  colNotes: { 
    width: '20%',
  },
  colAmount: { 
    width: '18%', 
    textAlign: 'right',
  },
  colReceipt: {
    width: '18%',
    textAlign: 'center',
  },
  
  merchantName: {
    fontWeight: 'bold',
    color: '#111827',
  },
  
  categoryBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '4 10',
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  
  amountValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#059669',
  },
  
  // Category summary
  categorySection: {
    marginTop: 25,
    marginBottom: 20,
  },
  
  categorySectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  categoryTable: {
    maxWidth: '50%',
  },
  
  categoryRow: {
    flexDirection: 'row',
    padding: '8 0',
    borderBottom: '1px solid #e5e7eb',
  },
  
  categoryName: {
    flex: 1,
    fontSize: 10,
    color: '#1f2937',
  },
  
  categoryAmount: {
    width: '40%',
    textAlign: 'right',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  
  totalRow: {
    flexDirection: 'row',
    padding: '12 0 8 0',
    marginTop: 4,
    borderTop: '2px solid #1e293b',
  },
  
  totalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  
  totalAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTop: '1px solid #e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9ca3af',
  },
});

// Utility functions
function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Invalid Date';
  }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Main PDF component - professional and clear
export const ReimburseMePDFDocument: React.FC<{ data: ExpenseReportData }> = ({ data }) => {
  const {
    reportMeta,
    submitter,
    recipient,
    summary,
    line_items = [],
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.companyName}>{recipient.company_name}</Text>
              <Text style={styles.reportSubtitle}>Expense Reimbursement Report</Text>
            </View>
            <View style={styles.metaSection}>
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Report ID:</Text> {reportMeta.report_id}
              </Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Period:</Text> {formatDate(reportMeta.period_start)} - {formatDate(reportMeta.period_end)}
              </Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Generated:</Text> {formatDate(reportMeta.generated_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoHeading}>Submitted By</Text>
            <Text style={[styles.infoText, styles.infoTextBold]}>{submitter.name}</Text>
            <Text style={styles.infoText}>{submitter.email}</Text>
            {submitter.department && (
              <Text style={styles.infoText}>{submitter.department}</Text>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoHeading}>Approver</Text>
            <Text style={[styles.infoText, styles.infoTextBold]}>{recipient.approver_name}</Text>
            <Text style={styles.infoText}>{recipient.approver_email}</Text>
          </View>
        </View>

        {/* Summary Box */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={[styles.summaryValue, styles.summaryValueLarge]}>
                ${formatCurrency(summary?.total_reimbursable || 0)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Items</Text>
              <Text style={styles.summaryValue}>{line_items.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Currency</Text>
              <Text style={styles.summaryValue}>{reportMeta.currency || 'USD'}</Text>
            </View>
          </View>
        </View>

        {/* Expense Items Table */}
        <View style={styles.tableSection}>
          <Text style={styles.tableTitle}>Expense Details</Text>
          
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.colMerchant]}>Merchant</Text>
            <Text style={[styles.tableHeaderCell, styles.colCategory]}>Category</Text>
            <Text style={[styles.tableHeaderCell, styles.colNotes]}>Notes</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
            <Text style={[styles.tableHeaderCell, styles.colReceipt]}>Receipt</Text>
          </View>

          {line_items.map((item, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colDate]}>
                {formatDate(item.date)}
              </Text>
              <Text style={[styles.tableCell, styles.colMerchant, styles.merchantName]}>
                {item.merchant}
              </Text>
              <View style={styles.colCategory}>
                <Text style={styles.categoryBadge}>{item.category}</Text>
              </View>
              <Text style={[styles.tableCell, styles.colNotes]}>
                {item.notes || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.colAmount, styles.amountValue]}>
                ${formatCurrency(item.converted_amount || item.amount)}
              </Text>
              <View style={styles.colReceipt}>
                {item.file_url ? (
                  <Link src={item.file_url} style={{ color: '#2563eb', fontSize: 8, textDecoration: 'underline' }}>
                    View Receipt
                  </Link>
                ) : (
                  <Text style={{ color: '#9ca3af', fontSize: 8 }}>N/A</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Category Summary */}
        {summary?.totals_by_category && summary.totals_by_category.length > 0 && (
          <View style={styles.categorySection}>
            <Text style={styles.categorySectionTitle}>Category Summary</Text>
            <View style={styles.categoryTable}>
              {summary.totals_by_category.map((cat, idx, arr) => (
                <View 
                  key={idx} 
                  style={[
                    styles.categoryRow, 
                    idx === arr.length - 1 ? { borderBottom: 'none' } : {}
                  ]}
                >
                  <Text style={styles.categoryName}>{cat.category}</Text>
                  <Text style={styles.categoryAmount}>${formatCurrency(cat.amount)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={[styles.categoryName, styles.totalLabel]}>Total</Text>
                <Text style={[styles.categoryAmount, styles.totalAmount]}>
                  ${formatCurrency(summary.total_reimbursable)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>ReimburseMe © {new Date().getFullYear()}</Text>
          <Text>Page 1</Text>
        </View>
      </Page>
    </Document>
  );
};
