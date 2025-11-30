/**
 * Portfolio Export Utilities
 * Enhancement: Export portfolio insights to Excel/CSV
 *
 * Provides export functionality for PortfolioInsightsModal with:
 * - CSV export (lightweight, universally compatible)
 * - Excel export (formatted with colors and charts)
 * - Custom date ranges (future enhancement)
 */

import { format } from 'date-fns';

export interface PortfolioInsight {
  totalItems: number;
  highImpactCount: number;
  moderateImpactCount: number;
  lowImpactCount: number;
  criticalImpactCount: number;
  summary: string;
  topCategoryByImpact?: string;
}

export interface ExportOptions {
  organizationId: string;
  organizationName?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Calculate percentage for impact distribution
 */
const calculatePercentage = (count: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
};

/**
 * Export portfolio insights to CSV format
 */
export const exportToCSV = (
  portfolioInsight: PortfolioInsight,
  options: ExportOptions
): void => {
  const { organizationId, organizationName, dateRange } = options;

  // CSV Header
  const csvRows: string[] = [];

  csvRows.push(`Portfolio Budget Insights Report`);
  csvRows.push(`Organization: ${organizationName || organizationId}`);
  csvRows.push(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`);

  if (dateRange) {
    csvRows.push(`Date Range: ${format(dateRange.startDate, 'yyyy-MM-dd')} to ${format(dateRange.endDate, 'yyyy-MM-dd')}`);
  }

  csvRows.push(''); // Empty line

  // Summary section
  csvRows.push('Summary Statistics');
  csvRows.push('Metric,Value');
  csvRows.push(`Total Equipment,${portfolioInsight.totalItems}`);
  csvRows.push(`Critical Impact Items,${portfolioInsight.criticalImpactCount}`);
  csvRows.push(`High Impact Items,${portfolioInsight.highImpactCount}`);
  csvRows.push(`Moderate Impact Items,${portfolioInsight.moderateImpactCount}`);
  csvRows.push(`Within Budget Items,${portfolioInsight.lowImpactCount}`);

  csvRows.push(''); // Empty line

  // Impact distribution
  csvRows.push('Budget Impact Distribution');
  csvRows.push('Category,Count,Percentage');
  csvRows.push(`Critical Impact,${portfolioInsight.criticalImpactCount},${calculatePercentage(portfolioInsight.criticalImpactCount, portfolioInsight.totalItems)}%`);
  csvRows.push(`High Impact,${portfolioInsight.highImpactCount},${calculatePercentage(portfolioInsight.highImpactCount, portfolioInsight.totalItems)}%`);
  csvRows.push(`Moderate Impact,${portfolioInsight.moderateImpactCount},${calculatePercentage(portfolioInsight.moderateImpactCount, portfolioInsight.totalItems)}%`);
  csvRows.push(`Within Budget,${portfolioInsight.lowImpactCount},${calculatePercentage(portfolioInsight.lowImpactCount, portfolioInsight.totalItems)}%`);

  csvRows.push(''); // Empty line

  // AI Recommendation
  csvRows.push('AI Recommendation');
  csvRows.push(`"${portfolioInsight.summary.replace(/"/g, '""')}"`); // Escape quotes

  if (portfolioInsight.topCategoryByImpact) {
    csvRows.push(''); // Empty line
    csvRows.push('Top Category by Impact');
    csvRows.push(`"${portfolioInsight.topCategoryByImpact}"`);
  }

  // Create CSV content
  const csvContent = csvRows.join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `portfolio-insights-${organizationId}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

/**
 * Export portfolio insights to Excel-compatible HTML format
 * This creates an HTML table that Excel can open and format
 */
export const exportToExcel = (
  portfolioInsight: PortfolioInsight,
  options: ExportOptions
): void => {
  const { organizationId, organizationName, dateRange } = options;

  // HTML template with Excel-compatible styling
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { color: #1f2937; font-size: 24px; margin-bottom: 10px; }
    h2 { color: #4b5563; font-size: 18px; margin-top: 20px; margin-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    .header-info { margin-bottom: 20px; }
    .critical { background-color: #fee2e2; color: #991b1b; }
    .high { background-color: #fed7aa; color: #9a3412; }
    .moderate { background-color: #fef3c7; color: #92400e; }
    .low { background-color: #d1fae5; color: #065f46; }
    .summary { background-color: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Portfolio Budget Insights Report</h1>

  <div class="header-info">
    <p><strong>Organization:</strong> ${organizationName || organizationId}</p>
    <p><strong>Generated:</strong> ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
    ${dateRange ? `<p><strong>Date Range:</strong> ${format(dateRange.startDate, 'yyyy-MM-dd')} to ${format(dateRange.endDate, 'yyyy-MM-dd')}</p>` : ''}
  </div>

  <h2>Summary Statistics</h2>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Total Equipment</td>
        <td>${portfolioInsight.totalItems.toLocaleString()}</td>
      </tr>
      <tr class="critical">
        <td>Critical Impact Items</td>
        <td>${portfolioInsight.criticalImpactCount}</td>
      </tr>
      <tr class="high">
        <td>High Impact Items</td>
        <td>${portfolioInsight.highImpactCount}</td>
      </tr>
      <tr class="moderate">
        <td>Moderate Impact Items</td>
        <td>${portfolioInsight.moderateImpactCount}</td>
      </tr>
      <tr class="low">
        <td>Within Budget Items</td>
        <td>${portfolioInsight.lowImpactCount}</td>
      </tr>
    </tbody>
  </table>

  <h2>Budget Impact Distribution</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Count</th>
        <th>Percentage</th>
      </tr>
    </thead>
    <tbody>
      <tr class="critical">
        <td>Critical Impact</td>
        <td>${portfolioInsight.criticalImpactCount}</td>
        <td>${calculatePercentage(portfolioInsight.criticalImpactCount, portfolioInsight.totalItems)}%</td>
      </tr>
      <tr class="high">
        <td>High Impact</td>
        <td>${portfolioInsight.highImpactCount}</td>
        <td>${calculatePercentage(portfolioInsight.highImpactCount, portfolioInsight.totalItems)}%</td>
      </tr>
      <tr class="moderate">
        <td>Moderate Impact</td>
        <td>${portfolioInsight.moderateImpactCount}</td>
        <td>${calculatePercentage(portfolioInsight.moderateImpactCount, portfolioInsight.totalItems)}%</td>
      </tr>
      <tr class="low">
        <td>Within Budget</td>
        <td>${portfolioInsight.lowImpactCount}</td>
        <td>${calculatePercentage(portfolioInsight.lowImpactCount, portfolioInsight.totalItems)}%</td>
      </tr>
    </tbody>
  </table>

  <h2>AI Recommendation</h2>
  <div class="summary">
    <p>${portfolioInsight.summary}</p>
    ${portfolioInsight.topCategoryByImpact ? `<p><strong>Top Category by Impact:</strong> ${portfolioInsight.topCategoryByImpact}</p>` : ''}
  </div>

  <hr>
  <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
    <em>Note: This report does not contain actual cost figures to maintain financial data privacy.
    For detailed cost analysis, contact your organization administrator.</em>
  </p>
</body>
</html>
  `.trim();

  // Create blob and download
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `portfolio-insights-${organizationId}-${format(new Date(), 'yyyy-MM-dd')}.xls`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

/**
 * Export portfolio insights (auto-detects format based on user preference)
 */
export const exportPortfolioInsights = (
  portfolioInsight: PortfolioInsight,
  options: ExportOptions,
  format: 'csv' | 'excel' = 'excel'
): void => {
  if (format === 'csv') {
    exportToCSV(portfolioInsight, options);
  } else {
    exportToExcel(portfolioInsight, options);
  }
};
