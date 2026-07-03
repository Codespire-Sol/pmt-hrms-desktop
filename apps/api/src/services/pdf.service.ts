/**
 * PDF Generation Service
 * Generates PDF reports using PDFKit
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface TableColumn {
  header: string;
  key: string;
  width?: number;
}

interface PdfOptions {
  title: string;
  subtitle?: string;
  generatedAt?: Date;
  projectName?: string;
}

interface PayslipLineItem {
  label: string;
  amount: number;
}

interface HrmsPayslipInput {
  employeeName: string;
  employeeId: string;
  designation?: string | null;
  department?: string | null;
  month: number;
  year: number;
  joiningDate?: Date | string | null;
  gross: number;
  deductions: number;
  net: number;
  companyName?: string;
  companyTagline?: string;
  companyAddress?: string;
  uan?: string | null;
  pfNo?: string | null;
  esiNo?: string | null;
  bankName?: string | null;
  accountNo?: string | null;
  totalWorkingDays?: number;
  leaves?: number;
  lopDays?: number;
  paidDays?: number;
  earningsBreakdown?: PayslipLineItem[];
  deductionsBreakdown?: PayslipLineItem[];
  generatedAt?: Date;
}

class PdfService {
  private readonly pageWidth = 595.28; // A4
  private readonly pageHeight = 841.89;
  private readonly margin = 50;

  /**
   * Generate a PDF document
   */
  async generatePdf(options: PdfOptions, sections: { title: string; content: any }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: this.margin,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.addHeader(doc, options);

      // Add sections
      sections.forEach((section, index) => {
        if (index > 0) {
          doc.moveDown(2);
        }
        this.addSection(doc, section.title, section.content);
      });

      // Footer with page numbers
      this.addFooter(doc);

      doc.end();
    });
  }

  /**
   * Generate sprint report PDF
   */
  async generateSprintReportPdf(report: any): Promise<Buffer> {
    const sections = [
      {
        title: 'Sprint Overview',
        content: {
          type: 'keyValue',
          data: [
            { key: 'Current Sprint', value: report.currentSprint?.name || 'N/A' },
            { key: 'Status', value: report.currentSprint?.status || 'N/A' },
            { key: 'Start Date', value: report.currentSprint?.startDate || 'N/A' },
            { key: 'End Date', value: report.currentSprint?.endDate || 'N/A' },
            { key: 'Total Issues', value: report.currentSprint?.totalIssues?.toString() || '0' },
            { key: 'Completed Issues', value: report.currentSprint?.completedIssues?.toString() || '0' },
            { key: 'Committed Points', value: report.currentSprint?.committedPoints?.toString() || '0' },
            { key: 'Completed Points', value: report.currentSprint?.completedPoints?.toString() || '0' },
          ],
        },
      },
      {
        title: 'Velocity History',
        content: {
          type: 'table',
          columns: [
            { header: 'Sprint', key: 'sprintName', width: 150 },
            { header: 'Committed', key: 'committed', width: 100 },
            { header: 'Completed', key: 'completed', width: 100 },
            { header: 'Velocity', key: 'velocity', width: 100 },
          ],
          data: report.velocityHistory || [],
        },
      },
    ];

    return this.generatePdf(
      {
        title: 'Sprint Report',
        subtitle: `Project: ${report.projectName || report.projectKey}`,
        projectName: report.projectName,
      },
      sections
    );
  }

  /**
   * Generate team workload PDF
   */
  async generateTeamWorkloadPdf(report: any): Promise<Buffer> {
    const sections = [
      {
        title: 'Summary',
        content: {
          type: 'keyValue',
          data: [
            { key: 'Total Team Members', value: report.members?.length?.toString() || '0' },
            { key: 'Period', value: `${report.startDate || 'All time'} - ${report.endDate || 'Present'}` },
          ],
        },
      },
      {
        title: 'Team Member Workload',
        content: {
          type: 'table',
          columns: [
            { header: 'Member', key: 'displayName', width: 150 },
            { header: 'Assigned', key: 'assigned', width: 80 },
            { header: 'Completed', key: 'completed', width: 80 },
            { header: 'In Progress', key: 'inProgress', width: 80 },
            { header: 'Hours Logged', key: 'hoursLogged', width: 80 },
          ],
          data: report.members || [],
        },
      },
    ];

    return this.generatePdf(
      {
        title: 'Team Workload Report',
        subtitle: `Project: ${report.projectName || 'All Projects'}`,
        projectName: report.projectName,
      },
      sections
    );
  }

  /**
   * Generate time tracking PDF
   */
  async generateTimeTrackingPdf(report: any): Promise<Buffer> {
    const sections = [
      {
        title: 'Summary',
        content: {
          type: 'keyValue',
          data: [
            { key: 'Total Hours', value: report.totalHours?.toFixed(2) || '0' },
            { key: 'Total Entries', value: report.recentLogs?.length?.toString() || '0' },
            { key: 'Period', value: `${report.startDate || 'All time'} - ${report.endDate || 'Present'}` },
          ],
        },
      },
      {
        title: 'Time Logs',
        content: {
          type: 'table',
          columns: [
            { header: 'Date', key: 'date', width: 100 },
            { header: 'Issue', key: 'issueKey', width: 80 },
            { header: 'Description', key: 'description', width: 180 },
            { header: 'Hours', key: 'hours', width: 60 },
          ],
          data: (report.recentLogs || []).map((log: any) => ({
            ...log,
            date: log.logDate ? new Date(log.logDate).toLocaleDateString() : 'N/A',
            hours: log.hours?.toFixed(2) || '0',
          })),
        },
      },
    ];

    return this.generatePdf(
      {
        title: 'Time Tracking Report',
        subtitle: `User: ${report.userName || 'Current User'}`,
      },
      sections
    );
  }

  /**
   * Generate issue distribution PDF
   */
  async generateIssueDistributionPdf(report: any): Promise<Buffer> {
    const sections = [
      {
        title: 'By Status',
        content: {
          type: 'table',
          columns: [
            { header: 'Status', key: 'name', width: 200 },
            { header: 'Count', key: 'count', width: 100 },
          ],
          data: report.byStatus || [],
        },
      },
      {
        title: 'By Priority',
        content: {
          type: 'table',
          columns: [
            { header: 'Priority', key: 'name', width: 200 },
            { header: 'Count', key: 'count', width: 100 },
          ],
          data: report.byPriority || [],
        },
      },
      {
        title: 'By Type',
        content: {
          type: 'table',
          columns: [
            { header: 'Type', key: 'name', width: 200 },
            { header: 'Count', key: 'count', width: 100 },
          ],
          data: report.byType || [],
        },
      },
      {
        title: 'By Assignee',
        content: {
          type: 'table',
          columns: [
            { header: 'Assignee', key: 'name', width: 200 },
            { header: 'Count', key: 'count', width: 100 },
          ],
          data: report.byAssignee || [],
        },
      },
    ];

    return this.generatePdf(
      {
        title: 'Issue Distribution Report',
        subtitle: `Project: ${report.projectName || 'All Projects'}`,
        projectName: report.projectName,
      },
      sections
    );
  }

  /**
   * Generate HRMS payslip PDF — professional salary slip layout.
   */
  async generateHrmsPayslipPdf(input: HrmsPayslipInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Color palette ──────────────────────────────────────────
      const BLUE       = '#1368FF';
      const DARK_BLUE  = '#0D1B5E';
      const LIGHT_BLUE = '#EFF6FF';
      const BORDER     = '#D1D5DB';
      const TEXT       = '#111827';
      const MUTED      = '#6B7280';
      const ROW_ALT    = '#F9FAFB';

      // ── Resolved input values ──────────────────────────────────
      const monthName      = new Date(input.year, input.month - 1, 1).toLocaleString('en-US', { month: 'long' });
      const payPeriodLabel = `${monthName} ${input.year}`;
      const generatedAt    = input.generatedAt || new Date();
      const companyName    = input.companyName  || 'Codespire';
      const _companyAddress = input.companyAddress || input.companyTagline || '';

      const gross     = this.normalizeAmount(input.gross);
      const deductions= this.normalizeAmount(input.deductions);
      const net       = this.normalizeAmount(input.net);
      const totalWorkingDays = Number.isFinite(input.totalWorkingDays as number)
        ? Math.max(0, Math.round(input.totalWorkingDays as number)) : 30;
      const leaves = Number.isFinite(input.leaves as number)
        ? Math.max(0, Math.round(input.leaves as number)) : 0;
      const lopDays = Number.isFinite(input.lopDays as number)
        ? Math.max(0, Math.round(input.lopDays as number)) : 0;
      const paidDays = Number.isFinite(input.paidDays as number)
        ? Math.max(0, Math.round(input.paidDays as number))
        : Math.max(0, totalWorkingDays - lopDays);

      const earnings = (input.earningsBreakdown || [])
        .filter((i) => i && i.label)
        .map((i) => ({ label: i.label, amount: this.normalizeAmount(i.amount) }));
      const deductionItems = (input.deductionsBreakdown || [])
        .filter((i) => i && i.label)
        .map((i) => ({ label: i.label, amount: this.normalizeAmount(i.amount) }));

      if (earnings.length === 0)          earnings.push({ label: 'Gross Wages', amount: gross });
      if (deductionItems.length === 0 && deductions > 0)
        deductionItems.push({ label: 'Other Deductions', amount: deductions });

      const totalEarnings   = earnings.reduce((s, r) => s + r.amount, 0) || gross;
      const totalDeductions = deductionItems.reduce((s, r) => s + r.amount, 0) || deductions;
      const rowCount = Math.max(4, earnings.length, deductionItems.length);
      const paddedEarnings    = Array.from({ length: rowCount }, (_, i) => earnings[i]      || null);
      const paddedDeductions  = Array.from({ length: rowCount }, (_, i) => deductionItems[i]|| null);

      // ── Layout constants ────────────────────────────────────────
      const SX = 35;                           // start X
      const SY = 28;                           // start Y
      const W  = this.pageWidth - SX * 2;     // content width ≈ 525

      const BLUE_BAND_H      = 8;
      const HEADER_H         = 82;
      const EMP_H            = 108;
      const WAGE_H           = 60;
      const BD_HEADER_H      = 26;
      const BD_ROW_H         = 21;
      const TOTALS_H         = 24;
      const NET_H            = 30;
      const FOOTER_H         = 34;
      const BD_H             = BD_HEADER_H + rowCount * BD_ROW_H + TOTALS_H + NET_H;
      const TOTAL_H          = BLUE_BAND_H + HEADER_H + EMP_H + WAGE_H + BD_H + FOOTER_H;

      // Computed Y positions
      const bandBottom  = SY + BLUE_BAND_H;
      const headerBottom= bandBottom + HEADER_H;
      const empBottom   = headerBottom + EMP_H;
      const wageBottom  = empBottom + WAGE_H;
      const bdBottom    = wageBottom + BD_H;
      const footerBottom= bdBottom + FOOTER_H;

      // Column splits for breakdown table
      const col1 = SX + W * 0.28;    // earnings amount col start
      const col2 = SX + W * 0.50;    // deductions label col start
      const col3 = SX + W * 0.76;    // deductions amount col start

      // ── Outer border ────────────────────────────────────────────
      doc.save().lineWidth(0.75).strokeColor(BORDER)
        .rect(SX, SY, W, TOTAL_H).stroke();

      // ── Blue accent band ─────────────────────────────────────────
      doc.rect(SX, SY, W, BLUE_BAND_H).fill(BLUE);

      // ── Header: light-blue background ────────────────────────────
      doc.rect(SX, bandBottom, W, HEADER_H).fill(LIGHT_BLUE);

      // ── Header: two clean halves (logo left | info right) ────────
      const LEFT_W  = Math.round(W * 0.52);   // logo occupies 52% of header
      const RIGHT_W = W - LEFT_W;

      // — LEFT: logo image only, no text overlay —
      const logoPath  = this.findLogoPath();
      const logoMaxW  = LEFT_W - 24;           // keep 12px padding each side
      const logoMaxH  = HEADER_H - 22;
      const logoYPos  = bandBottom + 11;

      if (logoPath) {
        try {
          doc.image(logoPath, SX + 12, logoYPos, { fit: [logoMaxW, logoMaxH] });
        } catch {
          // fallback: circle initial + plain name
          this.drawCompanyInitial(doc, SX + 14, logoYPos, companyName, BLUE);
          doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK_BLUE)
            .text(companyName, SX + 52, logoYPos + 6, { width: LEFT_W - 60 });
        }
      } else {
        this.drawCompanyInitial(doc, SX + 14, logoYPos, companyName, BLUE);
        doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK_BLUE)
          .text(companyName, SX + 52, logoYPos + 6, { width: LEFT_W - 60 });
      }

      // Vertical divider
      doc.moveTo(SX + LEFT_W, bandBottom + 10)
        .lineTo(SX + LEFT_W, headerBottom - 10)
        .lineWidth(0.5).strokeColor(BORDER).stroke();

      // — RIGHT: SALARY SLIP label + company name + pay info —
      const RX = SX + LEFT_W + 10;
      const RW = RIGHT_W - 14;

      doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE)
        .text('SALARY SLIP', RX, bandBottom + 10, { width: RW, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK_BLUE)
        .text(companyName, RX, bandBottom + 32, { width: RW, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor(TEXT)
        .text(`Pay Period: ${payPeriodLabel}`, RX, bandBottom + 46, { width: RW, align: 'right' });
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
        .text(`Gross Salary: ${this.formatCurrency(gross, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, RX, bandBottom + 60, { width: RW, align: 'right' });

      // ── Horizontal divider: header → employee details ─────────────
      doc.moveTo(SX, headerBottom).lineTo(SX + W, headerBottom).lineWidth(0.75).strokeColor(BORDER).stroke();

      // ── Employee details section (2-col grid) ────────────────────
      // Vertical divider
      doc.moveTo(SX + W / 2, headerBottom).lineTo(SX + W / 2, empBottom)
        .lineWidth(0.5).strokeColor(BORDER).stroke();

      const leftDetails = [
        { label: 'Employee ID',    value: input.employeeId || '-' },
        { label: 'Employee Name',  value: input.employeeName || '-' },
        { label: 'Designation',    value: input.designation || '-' },
        { label: 'Department',     value: input.department || '-' },
        { label: 'Date of Joining',value: this.formatDate(input.joiningDate) },
      ];
      const rightDetails = [
        { label: 'UAN',        value: input.uan || '-' },
        { label: 'PF No.',     value: input.pfNo || '-' },
        { label: 'ESI No.',    value: input.esiNo || '-' },
        { label: 'Bank',       value: input.bankName || '-' },
        { label: 'Account No.',value: input.accountNo || '-' },
      ];

      const detailRowH = 19;
      const detailLabelW = 100;

      doc.font('Helvetica').fontSize(9.5).fillColor(TEXT);
      leftDetails.forEach((row, idx) => {
        const y = headerBottom + 10 + idx * detailRowH;
        doc.font('Helvetica').fillColor(MUTED)
          .text(row.label, SX + 6, y, { width: detailLabelW, align: 'left' });
        doc.fillColor(TEXT)
          .text(': ' + row.value, SX + 6 + detailLabelW, y, { width: W / 2 - detailLabelW - 14, align: 'left' });
      });
      rightDetails.forEach((row, idx) => {
        const y = headerBottom + 10 + idx * detailRowH;
        const rx = SX + W / 2 + 6;
        doc.font('Helvetica').fillColor(MUTED)
          .text(row.label, rx, y, { width: 74, align: 'left' });
        doc.fillColor(TEXT)
          .text(': ' + row.value, rx + 74, y, { width: W / 2 - 84, align: 'left' });
      });

      // ── Wage summary section (4-col grid) ───────────────────────
      doc.moveTo(SX, empBottom).lineTo(SX + W, empBottom).lineWidth(0.75).strokeColor(BORDER).stroke();
      // Light grey background for wage row
      doc.rect(SX, empBottom, W, WAGE_H).fill('#F3F4F6');

      const wRowH = WAGE_H / 3;
      const wc1 = SX + W * 0.28;
      const wc2 = SX + W * 0.50;
      const wc3 = SX + W * 0.76;

      // Internal dividers
      [wc1, wc2, wc3].forEach((cx) => {
        doc.moveTo(cx, empBottom).lineTo(cx, wageBottom).lineWidth(0.4).strokeColor(BORDER).stroke();
      });
      [1, 2].forEach((n) => {
        doc.moveTo(SX, empBottom + n * wRowH).lineTo(SX + W, empBottom + n * wRowH)
          .lineWidth(0.4).strokeColor(BORDER).stroke();
      });

      const wageRows: Array<[string, string, string, string]> = [
        ['Gross Wages', this.formatCurrency(gross, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), '', ''],
        ['Total Working Days', String(totalWorkingDays), 'Leaves',   String(leaves)],
        ['LOP Days',           String(lopDays),           'Paid Days', String(paidDays)],
      ];
      wageRows.forEach((row, idx) => {
        const y = empBottom + idx * wRowH + 6;
        doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
          .text(row[0], SX + 6, y, { width: wc1 - SX - 10, align: 'left' });
        doc.font('Helvetica-Bold').fillColor(TEXT)
          .text(row[1], wc1 + 4, y, { width: wc2 - wc1 - 8, align: 'center' });
        doc.font('Helvetica').fillColor(MUTED)
          .text(row[2], wc2 + 6, y, { width: wc3 - wc2 - 10, align: 'left' });
        doc.font('Helvetica-Bold').fillColor(TEXT)
          .text(row[3], wc3 + 4, y, { width: SX + W - wc3 - 8, align: 'center' });
      });

      // ── Earnings / Deductions breakdown ─────────────────────────
      doc.moveTo(SX, wageBottom).lineTo(SX + W, wageBottom).lineWidth(0.75).strokeColor(BORDER).stroke();

      // Breakdown table header row (dark navy background)
      doc.rect(SX, wageBottom, W, BD_HEADER_H).fill(DARK_BLUE);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF');
      doc.text('EARNINGS', SX, wageBottom + 8, { width: col2 - SX, align: 'center' });
      doc.text('DEDUCTIONS', col2, wageBottom + 8, { width: SX + W - col2, align: 'center' });

      // Vertical dividers inside breakdown
      [col1, col2, col3].forEach((cx) => {
        doc.moveTo(cx, wageBottom).lineTo(cx, bdBottom - NET_H)
          .lineWidth(0.4).strokeColor(BORDER).stroke();
      });
      doc.moveTo(col3, bdBottom - NET_H).lineTo(col3, bdBottom)
        .lineWidth(0.4).strokeColor(BORDER).stroke();

      // Breakdown header bottom divider
      const bdHeaderBottom = wageBottom + BD_HEADER_H;
      doc.moveTo(SX, bdHeaderBottom).lineTo(SX + W, bdHeaderBottom).lineWidth(0.5).strokeColor(BORDER).stroke();

      // Data rows
      for (let i = 0; i < rowCount; i += 1) {
        const rowY   = bdHeaderBottom + i * BD_ROW_H;
        const rowBot = rowY + BD_ROW_H;

        // Alternate row background
        if (i % 2 === 0) {
          doc.rect(SX, rowY, col2 - SX, BD_ROW_H).fill(ROW_ALT);
          doc.rect(col2, rowY, SX + W - col2, BD_ROW_H).fill(ROW_ALT);
        }

        doc.moveTo(SX, rowBot).lineTo(SX + W, rowBot).lineWidth(0.3).strokeColor(BORDER).stroke();

        const earning   = paddedEarnings[i];
        const deduction = paddedDeductions[i];
        const textY     = rowY + 6;

        doc.font('Helvetica').fontSize(9).fillColor(TEXT)
          .text(earning?.label || '', SX + 5, textY, { width: col1 - SX - 8, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(earning ? TEXT : MUTED)
          .text(
            earning ? this.formatCurrency(earning.amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '',
            col1 + 2, textY, { width: col2 - col1 - 6, align: 'right' }
          );

        doc.font('Helvetica').fontSize(9).fillColor(TEXT)
          .text(deduction?.label || '', col2 + 5, textY, { width: col3 - col2 - 8, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(deduction ? DARK_BLUE : MUTED)
          .text(
            deduction ? this.formatCurrency(deduction.amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '',
            col3 + 2, textY, { width: SX + W - col3 - 6, align: 'right' }
          );
      }

      // ── Totals row ───────────────────────────────────────────────
      const totalsTop = bdHeaderBottom + rowCount * BD_ROW_H;
      doc.rect(SX, totalsTop, W, TOTALS_H).fill('#E5E7EB');
      doc.moveTo(SX, totalsTop).lineTo(SX + W, totalsTop).lineWidth(0.75).strokeColor(BORDER).stroke();
      doc.moveTo(SX, totalsTop + TOTALS_H).lineTo(SX + W, totalsTop + TOTALS_H).lineWidth(0.75).strokeColor(BORDER).stroke();
      [col1, col2, col3].forEach((cx) => {
        doc.moveTo(cx, totalsTop).lineTo(cx, totalsTop + TOTALS_H).lineWidth(0.4).strokeColor(BORDER).stroke();
      });

      const totTextY = totalsTop + 7;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK_BLUE);
      doc.text('Total Earnings', SX + 4, totTextY, { width: col1 - SX - 6, align: 'left' });
      doc.text(
        this.formatCurrency(totalEarnings, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        col1 + 2, totTextY, { width: col2 - col1 - 6, align: 'right' }
      );
      doc.text('Total Deductions', col2 + 4, totTextY, { width: col3 - col2 - 6, align: 'left' });
      doc.text(
        this.formatCurrency(totalDeductions, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        col3 + 2, totTextY, { width: SX + W - col3 - 6, align: 'right' }
      );

      // ── Net Salary row ───────────────────────────────────────────
      const netTop = totalsTop + TOTALS_H;
      doc.rect(SX, netTop, W, NET_H).fill(DARK_BLUE);
      doc.moveTo(SX, netTop + NET_H).lineTo(SX + W, netTop + NET_H).lineWidth(0.75).strokeColor(BORDER).stroke();
      doc.moveTo(col3, netTop).lineTo(col3, netTop + NET_H).lineWidth(0.4).strokeColor('#FFFFFF').stroke();

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF');
      doc.text('NET SALARY (Take Home)', SX + 6, netTop + 9, { width: col3 - SX - 10, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF');
      doc.text(
        this.formatCurrency(net, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        col3 + 4, netTop + 8, { width: SX + W - col3 - 8, align: 'right' }
      );

      // ── Footer ────────────────────────────────────────────────────
      const ftY = bdBottom;
      doc.moveTo(SX, ftY).lineTo(SX + W, ftY).lineWidth(0.5).strokeColor(BORDER).stroke();
      doc.rect(SX, ftY, W, FOOTER_H).fill('#F9FAFB');

      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
        .text(
          `Generated on: ${generatedAt.toLocaleDateString('en-GB')} at ${generatedAt.toLocaleTimeString('en-GB')}   |   This is a system-generated payslip and does not require a signature.`,
          SX + 8, ftY + 8, { width: W - 16, align: 'left' }
        );
      doc.font('Helvetica').fontSize(7).fillColor('#9CA3AF')
        .text(
          'Confidential — For the addressee only. Unauthorized reproduction is prohibited.',
          SX + 8, ftY + 20, { width: W - 16, align: 'left' }
        );

      doc.y = footerBottom - 4;
      doc.restore();
      doc.end();
    });
  }

  /** Try common paths to find the company logo. */
  private findLogoPath(): string | null {
    const candidates = [
      path.join(process.cwd(), '..', 'web', 'public', 'Logo.png'),
      path.join(process.cwd(), 'public', 'Logo.png'),
      path.join(__dirname, '..', '..', '..', 'web', 'public', 'Logo.png'),
      path.join(__dirname, '..', '..', '..', '..', 'web', 'public', 'Logo.png'),
    ];
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
    }
    return null;
  }

  /** Draw a styled company initial circle when logo is unavailable. */
  private drawCompanyInitial(
    doc: PDFKit.PDFDocument,
    x: number, y: number,
    name: string, color: string
  ) {
    const letter = (name[0] || 'C').toUpperCase();
    doc.circle(x + 20, y + 20, 20).fill(color);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF')
      .text(letter, x + 7, y + 11, { width: 28, align: 'center' });
  }

  private normalizeAmount(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  private formatDate(value?: Date | string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB');
  }

  private formatCurrency(
    amount: number,
    options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
  ): string {
    const minimumFractionDigits =
      options?.minimumFractionDigits !== undefined
        ? options.minimumFractionDigits
        : Number.isInteger(amount)
          ? 0
          : 2;
    const maximumFractionDigits =
      options?.maximumFractionDigits !== undefined
        ? options.maximumFractionDigits
        : minimumFractionDigits;

    return 'Rs.' + new Intl.NumberFormat('en-US', {
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(amount);
  }

  private addHeader(doc: PDFKit.PDFDocument, options: PdfOptions) {
    // Logo placeholder
    doc.fontSize(24).fillColor('#2563eb').text('ProjectFlow', { align: 'left' });

    doc.moveDown(0.5);

    // Title
    doc.fontSize(20).fillColor('#1f2937').text(options.title, { align: 'center' });

    if (options.subtitle) {
      doc.fontSize(12).fillColor('#6b7280').text(options.subtitle, { align: 'center' });
    }

    doc.moveDown(0.5);

    // Generated date
    const generatedAt = options.generatedAt || new Date();
    doc
      .fontSize(10)
      .fillColor('#9ca3af')
      .text(`Generated: ${generatedAt.toLocaleString()}`, { align: 'right' });

    doc.moveDown(1);

    // Divider
    doc
      .moveTo(this.margin, doc.y)
      .lineTo(this.pageWidth - this.margin, doc.y)
      .strokeColor('#e5e7eb')
      .stroke();

    doc.moveDown(1);
  }

  private addSection(doc: PDFKit.PDFDocument, title: string, content: any) {
    // Section title
    doc.fontSize(14).fillColor('#374151').text(title, { underline: true });
    doc.moveDown(0.5);

    if (content.type === 'keyValue') {
      this.addKeyValueContent(doc, content.data);
    } else if (content.type === 'table') {
      this.addTableContent(doc, content.columns, content.data);
    } else if (content.type === 'text') {
      doc.fontSize(10).fillColor('#4b5563').text(content.data);
    }
  }

  private addKeyValueContent(doc: PDFKit.PDFDocument, data: { key: string; value: string }[]) {
    data.forEach((item) => {
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`${item.key}: `, { continued: true })
        .fillColor('#1f2937')
        .text(item.value);
    });
  }

  private addTableContent(doc: PDFKit.PDFDocument, columns: TableColumn[], data: any[]) {
    if (!data || data.length === 0) {
      doc.fontSize(10).fillColor('#9ca3af').text('No data available');
      return;
    }

    const startX = this.margin;
    const tableWidth = this.pageWidth - 2 * this.margin;
    const defaultColumnWidth = tableWidth / columns.length;

    // Calculate column widths
    const colWidths = columns.map((col) => col.width || defaultColumnWidth);

    // Table header
    let xPos = startX;
    doc.fontSize(10).fillColor('#374151');

    columns.forEach((col, i) => {
      doc.text(col.header, xPos, doc.y, { width: colWidths[i], align: 'left' });
      xPos += colWidths[i];
    });

    doc.moveDown(0.3);

    // Header underline
    doc
      .moveTo(startX, doc.y)
      .lineTo(startX + tableWidth, doc.y)
      .strokeColor('#d1d5db')
      .stroke();

    doc.moveDown(0.3);

    // Table rows
    doc.fillColor('#4b5563');
    data.slice(0, 50).forEach((row, rowIndex) => {
      // Limit to 50 rows
      xPos = startX;

      // Check for page break
      if (doc.y > this.pageHeight - 100) {
        doc.addPage();
        doc.y = this.margin;
      }

      columns.forEach((col, i) => {
        const value = row[col.key]?.toString() || 'N/A';
        doc.text(value.substring(0, 50), xPos, doc.y, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      doc.moveDown(0.3);

      // Row separator
      if (rowIndex < data.length - 1) {
        doc
          .moveTo(startX, doc.y)
          .lineTo(startX + tableWidth, doc.y)
          .strokeColor('#f3f4f6')
          .stroke();
        doc.moveDown(0.2);
      }
    });

    if (data.length > 50) {
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#9ca3af').text(`... and ${data.length - 50} more rows`);
    }
  }

  private addFooter(doc: PDFKit.PDFDocument) {
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Footer line
      doc
        .moveTo(this.margin, this.pageHeight - 40)
        .lineTo(this.pageWidth - this.margin, this.pageHeight - 40)
        .strokeColor('#e5e7eb')
        .stroke();

      // Page number
      doc
        .fontSize(9)
        .fillColor('#9ca3af')
        .text(`Page ${i + 1} of ${pages.count}`, this.margin, this.pageHeight - 30, {
          align: 'center',
          width: this.pageWidth - 2 * this.margin,
        });
    }
  }
}

export const pdfService = new PdfService();
