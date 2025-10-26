// PDF and Excel report generation utilities
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Extend jsPDF type for autoTable
interface AutoTableOptions {
  head?: Array<Array<string>>;
  body?: Array<Array<string | number>>;
  startY?: number;
  styles?: Record<string, unknown>;
  headStyles?: Record<string, unknown>;
  columnStyles?: Record<number, Record<string, unknown>>;
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
  }
}

export interface ReportData {
  title: string;
  date: Date;
  summary: {
    totalDevices: number;
    inspected: number;
    pending: number;
    urgent: number;
  };
  devices: Array<Record<string, unknown>>;
  inspector?: string;
  organization?: string;
}

export class ReportGenerator {
  // Generate PDF report
  static async generatePDF(data: ReportData): Promise<void> {
    const doc = new jsPDF();
    
    // Add Korean font support (would need to add actual font file)
    // doc.addFont('NanumGothic.ttf', 'NanumGothic', 'normal');
    // doc.setFont('NanumGothic');
    
    // Header
    doc.setFontSize(20);
    doc.text('AED 점검 보고서', 105, 20, { align: 'center' });
    
    // Date and info
    doc.setFontSize(12);
    doc.text(`보고서 생성일: ${data.date.toLocaleDateString('ko-KR')}`, 20, 35);
    if (data.inspector) {
      doc.text(`점검자: ${data.inspector}`, 20, 42);
    }
    if (data.organization) {
      doc.text(`소속: ${data.organization}`, 20, 49);
    }
    
    // Summary section
    doc.setFontSize(14);
    doc.text('요약', 20, 65);
    doc.setFontSize(10);
    doc.text(`총 AED 수: ${data.summary.totalDevices}대`, 30, 75);
    doc.text(`점검 완료: ${data.summary.inspected}대`, 30, 82);
    doc.text(`미점검: ${data.summary.pending}대`, 30, 89);
    doc.text(`긴급 조치 필요: ${data.summary.urgent}대`, 30, 96);
    
    // Completion rate
    const completionRate = (data.summary.inspected / data.summary.totalDevices * 100).toFixed(1);
    doc.setFontSize(12);
    doc.text(`점검률: ${completionRate}%`, 30, 106);
    
    // Device list table
    const tableData = data.devices.map(device => [
      String(device.id || ''),
      String(device.name || ''),
      String(device.location || ''),
      String(device.priority || ''),
      String(device.lastCheck || ''),
      String(device.batteryExpiry || ''),
      String(device.padExpiry || '')
    ]);
    
    doc.autoTable({
      head: [['ID', '기기명', '위치', '우선순위', '최근점검', '배터리만료', '패드만료']],
      body: tableData,
      startY: 120,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [34, 197, 94] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 }
      }
    });
    
    // Add page numbers
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(`${i} / ${pageCount}`, 105, 290, { align: 'center' });
    }
    
    // Save PDF
    doc.save(`AED_점검보고서_${data.date.toISOString().split('T')[0]}.pdf`);
  }
  
  // Generate Excel report
  static async generateExcel(data: ReportData): Promise<void> {
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['AED 점검 보고서'],
      [],
      ['생성일', data.date.toLocaleDateString('ko-KR')],
      ['점검자', data.inspector || '-'],
      ['소속', data.organization || '-'],
      [],
      ['요약 정보'],
      ['총 AED 수', data.summary.totalDevices],
      ['점검 완료', data.summary.inspected],
      ['미점검', data.summary.pending],
      ['긴급 조치 필요', data.summary.urgent],
      ['점검률', `${(data.summary.inspected / data.summary.totalDevices * 100).toFixed(1)}%`]
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, '요약');
    
    // Device list sheet
    const deviceHeaders = [
      'ID', '기기명', '위치', '우선순위', '최근점검일', 
      '배터리만료', '패드만료', '모델명', '제조사', '일련번호',
      '설치기관', '설치일자', '관리책임자', '연락처', '비고'
    ];
    
    const deviceData = data.devices.map(device => [
      String(device.id || ''),
      String(device.name || ''),
      String(device.location || ''),
      String(device.priority || ''),
      String(device.lastCheck || ''),
      String(device.batteryExpiry || ''),
      String(device.padExpiry || ''),
      String(device.modelName || ''),
      String(device.manufacturer || ''),
      String(device.serialNumber || ''),
      String(device.installationOrg || ''),
      String(device.installDate || ''),
      String(device.manager || ''),
      String(device.contact || ''),
      String(device.notes || '')
    ]);
    
    deviceData.unshift(deviceHeaders);
    const deviceSheet = XLSX.utils.aoa_to_sheet(deviceData);
    
    // Set column widths
    const columnWidths = [
      { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
    ];
    deviceSheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(wb, deviceSheet, 'AED 목록');
    
    // Statistics sheet
    const statsData = [
      ['통계 분석'],
      [],
      ['우선순위별 현황'],
      ['긴급', data.devices.filter(d => d.priority === 'urgent').length],
      ['주의', data.devices.filter(d => d.priority === 'warning').length],
      ['정상', data.devices.filter(d => d.priority === 'normal').length],
      [],
      ['만료 예정 현황'],
      ['30일 이내 배터리 만료', data.devices.filter(d => {
        if (!d.batteryExpiry) return false;
        const days = Math.ceil((new Date(String(d.batteryExpiry)).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days <= 30 && days > 0;
      }).length],
      ['30일 이내 패드 만료', data.devices.filter(d => {
        if (!d.padExpiry) return false;
        const days = Math.ceil((new Date(String(d.padExpiry)).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days <= 30 && days > 0;
      }).length]
    ];
    
    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, statsSheet, '통계');
    
    // Save Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const excelBlob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    saveAs(excelBlob, `AED_점검보고서_${data.date.toISOString().split('T')[0]}.xlsx`);
  }
  
  // Generate monthly report
  static async generateMonthlyReport(year: number, month: number, devices: Array<Record<string, unknown>>): Promise<void> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    // Filter devices inspected in the given month
    const monthlyDevices = devices.filter(device => {
      if (!device.lastCheck) return false;
      const checkDate = new Date(String(device.lastCheck));
      return checkDate >= startDate && checkDate <= endDate;
    });
    
    const reportData: ReportData = {
      title: `${year}년 ${month}월 AED 점검 보고서`,
      date: new Date(),
      summary: {
        totalDevices: devices.length,
        inspected: monthlyDevices.length,
        pending: devices.length - monthlyDevices.length,
        urgent: devices.filter(d => d.priority === 'urgent').length
      },
      devices: monthlyDevices
    };
    
    // Generate both PDF and Excel
    await this.generatePDF(reportData);
    await this.generateExcel(reportData);
  }
}