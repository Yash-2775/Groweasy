'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Settings,
  Sun,
  Moon,
  Download,
  Trash2,
  Play,
  ArrowRight,
  ChevronRight,
  Info,
  Lock,
  Database,
  Sparkles,
  Search,
  Check,
  AlertCircle
} from 'lucide-react';
import { parseCSVClient } from '../utils/csvParser';

// Sample CRM Fields for visual reference
const CRM_FIELDS_REFERENCE = [
  { field: 'created_at', desc: 'Lead creation date (JS convertible)' },
  { field: 'name', desc: 'Lead full name' },
  { field: 'email', desc: 'Primary email' },
  { field: 'country_code', desc: 'Country code (e.g., +91)' },
  { field: 'mobile_without_country_code', desc: 'Clean phone number' },
  { field: 'company', desc: 'Company name' },
  { field: 'city', desc: 'City' },
  { field: 'state', desc: 'State' },
  { field: 'country', desc: 'Country' },
  { field: 'lead_owner', desc: 'Lead owner / email' },
  { field: 'crm_status', desc: 'Status (GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, etc.)' },
  { field: 'crm_note', desc: 'Notes, Remarks, Extra Phone/Emails' },
  { field: 'data_source', desc: 'Source (leads_on_demand, meridian_tower, etc.)' },
  { field: 'possession_time', desc: 'Property possession timeframe' },
  { field: 'description', desc: 'Additional descriptions' }
];

// Sample CSV templates for instant user testing
const SAMPLE_TEMPLATES = {
  facebook: {
    name: 'Facebook Lead Ads (Messy Headers).csv',
    content: `id,created_time,full_name,email_address,phone_number,company_name,work_city,status,source_name
1,2026-05-13T14:20:48Z,John Doe,john.doe@example.com,+91 98765 43210,GrowEasy,Mumbai,good lead,Facebook Ads
2,2026-05-13T14:25:30Z,Sarah Johnson,sarah.johnson@example.com,,Tech Solutions,Bangalore,no response,Facebook Ads
3,2026-05-13T14:30:15Z,Rajesh Patel,rajesh.patel@example.com,+919876543212,Startup Inc,Delhi,not interested,Facebook Ads
4,,Priya Singh,priya.singh@example.com;priya.work@example.com,+919876543213,Enterprise Corp,Pune,won,Facebook Ads
5,2026-05-13T14:40:00Z,No Contacts,,,,,good,Facebook Ads`
  },
  google: {
    name: 'Google Ads Lead Export (Custom Columns).csv',
    content: `Google_ID,G_Date,Client_Name,Mail_ID,Contact_Info,Business,Loc_State,Loc_Country,Notes,Campaign
101,2026-05-14 09:15:22,David Lee,david.lee@gmail.com,+1-555-0199,Lee Consultants,California,USA,Looking for property,Search_Campaign
102,2026-05-14 10:20:00,Emily Brown,emily.b@outlook.com;emily.personal@outlook.com,+44 7911 123456,,London,UK,Busy - call tomorrow,Display_Campaign
103,2026-05-14 11:35:44,Michael Chang,michael.c@tech.io,+8613912345678,Chang Corp,Beijing,China,Wants Sarjapur Plots,Search_Campaign
104,2026-05-14 12:40:10,Invalid User,,,Fake Co,Texas,USA,,Search_Campaign`
  },
  excel: {
    name: 'Marketing Leads Excel Sheet (Semi-structured).csv',
    content: `Timestamp;Name;Email;Phone;Company;City;Owner;Lead Stage;Data Source;Notes
13/05/2026 15:10;Aarav Sharma;aarav.sharma@groweasy.com;+91 98765 43220;Sharma & Sons;Pune;test@gmail.com;Follow Up Required;eden_park;Wants 3BHK flat
13/05/2026 15:20;Neha Gupta;neha.g@gmail.com;+91 98765 43221;Gupta Retail;Delhi;test@gmail.com;No Response;varah_swamy;Out of budget
13/05/2026 15:30;Vikram Singh;vikram.s@outlook.com;+91 98765 43222;Singh Logistics;Mumbai;test@gmail.com;Closed Won;leads_on_demand;Deal completed!
13/05/2026 15:40;Missing Info;;;;;;;;`
  }
};

export default function HomePage() {
  // Navigation & Step Control
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeTab, setActiveTab] = useState<'success' | 'skipped'>('success');

  // Application Settings
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backendUrl, setBackendUrl] = useState('http://localhost:5000/api');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [batchSize, setBatchSize] = useState(25);

  // File & CSV States
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvRawData, setCsvRawData] = useState<string[][]>([]);
  const [previewPage, setPreviewPage] = useState(1);
  const previewRowsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');

  // AI Extraction Progress States
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Results States
  const [extractedLeads, setExtractedLeads] = useState<any[]>([]);
  const [skippedLeads, setSkippedLeads] = useState<any[]>([]);
  const [totalImported, setTotalImported] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [importSummary, setImportSummary] = useState({ successRate: 0, timeTaken: 0 });

  // UI refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load configuration and theme from LocalStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedApiKey = localStorage.getItem('gemini_api_key') || '';
    setGeminiApiKey(savedApiKey);

    const savedBackendUrl = localStorage.getItem('backend_url') || 'http://localhost:5000/api';
    setBackendUrl(savedBackendUrl);

    const savedBatchSize = Number(localStorage.getItem('batch_size')) || 25;
    setBatchSize(savedBatchSize);
  }, []);

  // Theme Toggler
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Save Settings Handler
  const handleSaveSettings = (key: string, url: string, size: number) => {
    setGeminiApiKey(key);
    localStorage.setItem('gemini_api_key', key);

    setBackendUrl(url);
    localStorage.setItem('backend_url', url);

    setBatchSize(size);
    localStorage.setItem('batch_size', size.toString());

    setIsSettingsOpen(false);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Format file size helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Process selected file client-side
  const processSelectedFile = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      alert('Invalid file format. Please upload a valid CSV file.');
      return;
    }

    setFileName(file.name);
    setFileSize(formatBytes(file.size));

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSVClient(text);
      
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setCsvRawData(parsed.rawData);
      setPreviewPage(1);
      
      // Advance to Preview Step
      setCurrentStep(2);
    };
    reader.onerror = () => {
      alert('Error reading file.');
    };
    reader.readAsText(file);
  };

  // Load a sample template
  const loadTemplate = (key: 'facebook' | 'google' | 'excel') => {
    const template = SAMPLE_TEMPLATES[key];
    setFileName(template.name);
    setFileSize('Template File');
    
    const parsed = parseCSVClient(template.content);
    setCsvHeaders(parsed.headers);
    setCsvRows(parsed.rows);
    setCsvRawData(parsed.rawData);
    setPreviewPage(1);
    
    setCurrentStep(2);
  };

  // Reset/Clear file state
  const resetImporter = () => {
    setFileName('');
    setFileSize('');
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvRawData([]);
    setExtractedLeads([]);
    setSkippedLeads([]);
    setTotalImported(0);
    setTotalSkipped(0);
    setPreviewPage(1);
    setCurrentStep(1);
  };

  // Run AI Batch Extraction
  const startAiExtraction = async () => {
    if (!geminiApiKey) {
      setIsSettingsOpen(true);
      alert('Please configure your Gemini API Key in the settings panel first!');
      return;
    }

    setCurrentStep(3);
    setIsProcessing(true);
    setCurrentBatch(0);
    setElapsedTime(0);
    setProgressPercent(0);

    const controller = new AbortController();
    setAbortController(controller);

    // Group rows into batches
    const totalRowsCount = csvRows.length;
    const batches: any[][] = [];
    for (let i = 0; i < totalRowsCount; i += batchSize) {
      batches.push(csvRows.slice(i, i + batchSize));
    }
    
    setTotalBatches(batches.length);

    // Start Timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    const allExtractedLeads: any[] = [];
    const allSkippedLeads: any[] = [];
    let completedBatches = 0;

    try {
      // Process batches sequentially to respect rate limits and allow easy cancel
      for (let i = 0; i < batches.length; i++) {
        if (controller.signal.aborted) break;
        
        setCurrentBatch(i + 1);
        const currentBatchRows = batches[i];
        
        // Retries setup
        let attempts = 0;
        let success = false;
        let batchResultData: any = null;
        let lastErrorMsg = '';

        while (attempts < 3 && !success && !controller.signal.aborted) {
          try {
            const response = await fetch(`${backendUrl}/extract`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-gemini-api-key': geminiApiKey
              },
              body: JSON.stringify({
                rows: currentBatchRows,
                headers: csvHeaders
              }),
              signal: controller.signal
            });

            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.message || errData.error || 'Server error');
            }

            batchResultData = await response.json();
            success = true;
          } catch (err: any) {
            attempts++;
            lastErrorMsg = err.message || err;
            console.warn(`Batch ${i + 1} attempt ${attempts} failed: ${lastErrorMsg}`);
            if (attempts < 3) {
              // Wait 2 seconds before retry
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        if (success && batchResultData) {
          // Accumulate results
          allExtractedLeads.push(...(batchResultData.leads || []));
          
          // Adjust skipped indices to absolute CSV row index
          const batchOffset = i * batchSize;
          const mappedSkipped = (batchResultData.skipped || []).map((skip: any) => ({
            ...skip,
            rowIndex: batchOffset + skip.rowIndex
          }));
          allSkippedLeads.push(...mappedSkipped);
        } else {
          // If a batch completely fails all retries, record all its rows as failed/skipped
          const batchOffset = i * batchSize;
          const failedRows = currentBatchRows.map((row, idx) => ({
            rowIndex: batchOffset + idx + 2, // +2 for header and 1-index
            rowData: row,
            reason: `AI Extraction Failed: ${lastErrorMsg}`
          }));
          allSkippedLeads.push(...failedRows);
        }

        completedBatches++;
        setProgressPercent(Math.round((completedBatches / batches.length) * 100));
      }

      // Finish Processing
      if (timerRef.current) clearInterval(timerRef.current);
      setIsProcessing(false);

      if (!controller.signal.aborted) {
        // Update final state
        setExtractedLeads(allExtractedLeads);
        setSkippedLeads(allSkippedLeads);
        setTotalImported(allExtractedLeads.length);
        setTotalSkipped(allSkippedLeads.length);
        
        const successRate = totalRowsCount > 0 ? Math.round((allExtractedLeads.length / totalRowsCount) * 100) : 0;
        setImportSummary({
          successRate,
          timeTaken: elapsedTime
        });

        // Set active tab based on results
        setActiveTab(allExtractedLeads.length > 0 ? 'success' : 'skipped');

        // Move to Done Step
        setCurrentStep(4);
      }

    } catch (error: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsProcessing(false);
      if (error.name !== 'AbortError') {
        alert(`Extraction encountered a fatal error: ${error.message}`);
        setCurrentStep(2); // Fallback to preview
      }
    }
  };

  // Cancel running AI process
  const cancelAiExtraction = () => {
    if (abortController) {
      abortController.abort();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsProcessing(false);
    alert('AI Import cancelled by user.');
    setCurrentStep(2); // return to preview
  };

  // Format date helper
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Filter preview rows by search term
  const filteredRows = csvRows.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Calculate paginated index ranges
  const previewPageCount = Math.ceil(filteredRows.length / previewRowsPerPage);
  const paginatedRows = filteredRows.slice(
    (previewPage - 1) * previewRowsPerPage,
    previewPage * previewRowsPerPage
  );

  // Convert array of objects to downloadable CSV
  const downloadCleanCSV = (data: any[], type: 'success' | 'skipped') => {
    if (data.length === 0) return;

    let csvContent = "";
    let headers: string[] = [];

    if (type === 'success') {
      headers = [
        'created_at', 'name', 'email', 'country_code', 'mobile_without_country_code',
        'company', 'city', 'state', 'country', 'lead_owner', 'crm_status',
        'crm_note', 'data_source', 'possession_time', 'description'
      ];
      csvContent += headers.join(',') + '\n';
      
      data.forEach(row => {
        const line = headers.map(header => {
          let val = row[header] !== undefined ? row[header] : '';
          // Wrap values containing commas or quotes in double quotes
          val = String(val).replace(/"/g, '""'); // escape quotes
          if (val.includes(',') || val.includes('\n') || val.includes('"')) {
            val = `"${val}"`;
          }
          return val;
        });
        csvContent += line.join(',') + '\n';
      });
    } else {
      // Skipped Leads Export
      // Get all headers from original rows
      const originalKeys = Object.keys(data[0]?.rowData || {});
      headers = ['Row Number', 'Skip Reason', ...originalKeys];
      csvContent += headers.join(',') + '\n';

      data.forEach(row => {
        const line = [
          row.rowIndex,
          `"${String(row.reason).replace(/"/g, '""')}"`,
          ...originalKeys.map(k => {
            let val = row.rowData[k] !== undefined ? row.rowData[k] : '';
            val = String(val).replace(/"/g, '""');
            if (val.includes(',') || val.includes('\n') || val.includes('"')) {
              val = `"${val}"`;
            }
            return val;
          })
        ];
        csvContent += line.join(',') + '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `groweasy_${type}_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <header className="app-header">
        <div className="app-header-container">
          <div className="logo">
            <Sparkles size={26} className="logo-icon" />
            <span>GrowEasy Importer</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Quick API Key Badge indicator */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '99px',
                background: geminiApiKey ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${geminiApiKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                fontSize: '0.75rem',
                color: geminiApiKey ? 'var(--success)' : 'var(--danger)',
                cursor: 'pointer'
              }}
              onClick={() => setIsSettingsOpen(true)}
            >
              {geminiApiKey ? <Check size={12} /> : <AlertCircle size={12} />}
              <span>{geminiApiKey ? 'Gemini Connected' : 'Gemini Key Missing'}</span>
            </div>

            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', borderRadius: '50%' }}
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button 
              className="btn btn-secondary"
              onClick={() => setIsSettingsOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Step Indicator Visualizer */}
        <div className="steps-container glass-card" style={{ padding: '1.25rem 2rem', marginBottom: 0 }}>
          <div className="steps-line"></div>
          <div 
            className="steps-line-progress" 
            style={{ 
              width: `${
                currentStep === 1 ? '12.5%' : 
                currentStep === 2 ? '37.5%' : 
                currentStep === 3 ? '62.5%' : '87.5%'
              }`
            }}
          ></div>
          
          <div className={`step-node ${currentStep >= 1 ? (currentStep > 1 ? 'completed' : 'active') : ''}`}>
            <div className="step-circle">{currentStep > 1 ? <Check size={18} /> : '1'}</div>
            <div className="step-label">Upload CSV</div>
          </div>
          <div className={`step-node ${currentStep >= 2 ? (currentStep > 2 ? 'completed' : 'active') : ''}`}>
            <div className="step-circle">{currentStep > 2 ? <Check size={18} /> : '2'}</div>
            <div className="step-label">Preview & Map</div>
          </div>
          <div className={`step-node ${currentStep >= 3 ? (currentStep > 3 ? 'completed' : 'active') : ''}`}>
            <div className="step-circle">{currentStep > 3 ? <Check size={18} /> : '3'}</div>
            <div className="step-label">AI Processing</div>
          </div>
          <div className={`step-node ${currentStep >= 4 ? 'active' : ''}`}>
            <div className="step-circle">4</div>
            <div className="step-label">Review CRM</div>
          </div>
        </div>

        {/* Dynamic Step Panels */}
        <div style={{ flex: 1 }}>

          {/* STEP 1: Upload View */}
          {currentStep === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                  Intelligent CSV Lead Importer
                </h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
                  Upload sheets from Facebook Ads, Google Ads, Real Estate platforms, or custom formats. Our system utilizes AI to automatically identify, normalize, and map customer data into standard CRM fields.
                </p>

                <div 
                  className={`dropzone ${isDragActive ? 'drag-active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".csv"
                    onChange={handleFileChange}
                  />
                  <div className="dropzone-icon">
                    <UploadCloud size={32} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Drag & Drop your CSV file here</h3>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    or click to browse from your computer (CSV files only, up to 10MB)
                  </p>
                  <button className="btn btn-primary">Select CSV File</button>
                </div>
              </div>

              {/* Instant Templates Section */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-secondary)' }} />
                  <span>Don't have a CSV handy? Test with sample mock exports:</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  <div 
                    className="glass-card" 
                    style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                    onClick={() => loadTemplate('facebook')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem' }}>Facebook Lead Export</strong>
                      <span className="badge badge-source">Messy Headers</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Contains non-standard headers like `full_name`, `email_address`, and multiple phone layouts.
                    </p>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', alignSelf: 'flex-start', fontSize: '0.8rem' }}>
                      Load Template
                    </button>
                  </div>

                  <div 
                    className="glass-card" 
                    style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                    onClick={() => loadTemplate('google')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem' }}>Google Ads Export</strong>
                      <span className="badge badge-source">Custom Fields</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Uses custom titles like `Client_Name`, `Mail_ID`, `Business` and comma-separated multiple emails.
                    </p>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', alignSelf: 'flex-start', fontSize: '0.8rem' }}>
                      Load Template
                    </button>
                  </div>

                  <div 
                    className="glass-card" 
                    style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                    onClick={() => loadTemplate('excel')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem' }}>Excel Sales CSV</strong>
                      <span className="badge badge-source">Semicolon Delimited</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Uses semicolon `;` delimiters, custom lead stages (e.g. Follow Up, Closed Won) and missing entries.
                    </p>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', alignSelf: 'flex-start', fontSize: '0.8rem' }}>
                      Load Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Configure */}
          {currentStep === 2 && (
            <div className="animate-fade-in grid-main">
              {/* Left Column: Table and Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
                        <span>CSV Data Preview</span>
                      </h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        File: <strong>{fileName}</strong> ({fileSize}) &bull; Total Rows: <strong>{csvRows.length}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-tertiary)' }} />
                      <input 
                        type="text" 
                        placeholder="Search rows..." 
                        className="input-field"
                        style={{ paddingLeft: '2.25rem', width: '220px', fontSize: '0.85rem', height: '36px' }}
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setPreviewPage(1);
                        }}
                      />
                      <button className="btn btn-secondary" onClick={resetImporter} style={{ height: '36px', fontSize: '0.85rem' }}>
                        <Trash2 size={14} />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>

                  {/* Responsive Table for preview */}
                  {filteredRows.length > 0 ? (
                    <>
                      <div className="table-wrapper">
                        <table className="table-container">
                          <thead>
                            <tr>
                              <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                              {csvHeaders.map((header, idx) => (
                                <th key={idx}>{header || `Column ${idx + 1}`}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRows.map((row, rIdx) => {
                              const absoluteIndex = (previewPage - 1) * previewRowsPerPage + rIdx + 1;
                              return (
                                <tr key={rIdx}>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-tertiary)' }}>
                                    {absoluteIndex}
                                  </td>
                                  {csvHeaders.map((header, hIdx) => (
                                    <td key={hIdx} title={String(row[header] || '')}>
                                      {String(row[header] || '')}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span>
                          Showing {(previewPage - 1) * previewRowsPerPage + 1} to {Math.min(previewPage * previewRowsPerPage, filteredRows.length)} of {filteredRows.length} entries
                        </span>
                        
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                            disabled={previewPage === 1}
                            onClick={() => setPreviewPage(p => Math.max(p - 1, 1))}
                          >
                            Prev
                          </button>
                          {Array.from({ length: Math.min(5, previewPageCount) }, (_, idx) => {
                            // Display page numbers centered around current page
                            let pageNum = idx + 1;
                            if (previewPage > 3 && previewPageCount > 5) {
                              pageNum = previewPage - 3 + idx;
                              if (pageNum + (4 - idx) > previewPageCount) {
                                pageNum = previewPageCount - 4 + idx;
                              }
                            }
                            return (
                              <button 
                                key={idx}
                                className={`btn ${previewPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', minWidth: '32px' }}
                                onClick={() => setPreviewPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                            disabled={previewPage === previewPageCount}
                            onClick={() => setPreviewPage(p => Math.min(p + 1, previewPageCount))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-tertiary)' }}>
                      No matching records found.
                    </div>
                  )}
                </div>

                {/* Import Confirmation Actions */}
                <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Ready to batch import <strong>{csvRows.length}</strong> rows using AI. Batch size configured to <strong>{batchSize}</strong> (<strong>{Math.ceil(csvRows.length / batchSize)}</strong> API requests).
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={resetImporter}>
                      Cancel & Reset
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={startAiExtraction}
                      style={{ fontSize: '1rem', padding: '0.8rem 2rem' }}
                    >
                      <Sparkles size={18} />
                      <span>Confirm & Map via AI</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: CRM Reference Schema */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'fit-content' }}>
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <Database size={16} style={{ color: 'var(--accent-secondary)' }} />
                  <span>Target CRM Fields</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  The AI will intelligently scan your columns and map data to these predefined fields:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.4rem' }}>
                  {CRM_FIELDS_REFERENCE.map((ref, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {ref.field}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {ref.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Processing Extraction */}
          {currentStep === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
              <div className="glass-card glass-card-glow" style={{ width: '100%', maxWidth: '600px', textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 1.5rem' }}>
                  {/* Glowing spinner background */}
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: 0, left: 0, right: 0, bottom: 0, 
                      borderRadius: '50%', 
                      border: '3px solid var(--border-color)',
                    }}
                  ></div>
                  <div 
                    className="animate-spin"
                    style={{ 
                      position: 'absolute', 
                      top: 0, left: 0, right: 0, bottom: 0, 
                      borderRadius: '50%', 
                      border: '3px solid transparent',
                      borderTopColor: 'var(--accent-primary)',
                      borderRightColor: 'var(--accent-secondary)',
                    }}
                  ></div>
                  <Sparkles 
                    size={28} 
                    style={{ 
                      position: 'absolute', 
                      top: '26px', left: '26px', 
                      color: 'var(--accent-primary)',
                      animation: 'pulse 1.5s infinite alternate' 
                    }} 
                  />
                </div>

                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>AI Lead Mapping in Progress...</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                  Processing batch <strong>{currentBatch}</strong> of <strong>{totalBatches}</strong> &bull; Row count: {csvRows.length}
                </p>

                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '1rem 0', marginBottom: '2rem' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{progressPercent}%</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completed</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{formatTime(elapsedTime)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Time Elapsed</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                      {totalBatches > 0 ? `${currentBatch}/${totalBatches}` : '0/0'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Batches Done</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Lock size={12} />
                    <span>Processing securely on Gemini 1.5 Flash</span>
                  </div>
                  <button className="btn btn-danger" onClick={cancelAiExtraction} style={{ marginTop: '0.5rem' }}>
                    Cancel Import
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review CRM results */}
          {currentStep === 4 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Stats dashboard */}
              <div className="stats-grid">
                <div className="glass-card stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
                    <Database size={24} />
                  </div>
                  <div>
                    <div className="stat-value">{csvRows.length}</div>
                    <div className="stat-label">Total Rows Processed</div>
                  </div>
                </div>

                <div className="glass-card stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{totalImported}</div>
                    <div className="stat-label">Successfully Imported</div>
                  </div>
                </div>

                <div className="glass-card stat-card">
                  <div className="stat-icon" style={{ background: totalSkipped > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.05)', color: totalSkipped > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: totalSkipped > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{totalSkipped}</div>
                    <div className="stat-label">Skipped Records</div>
                  </div>
                </div>

                <div className="glass-card stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-secondary)' }}>
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <div className="stat-value">{importSummary.successRate}%</div>
                    <div className="stat-label">Success Extraction Rate</div>
                  </div>
                </div>
              </div>

              {/* Action Banner */}
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', padding: '1.25rem 1.75rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)', borderColor: 'rgba(99,102,241,0.2)' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} style={{ color: 'var(--accent-secondary)' }} />
                    <span>AI Mapping Complete!</span>
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Processed in {formatTime(importSummary.timeTaken)} &bull; Leads mapped, validated, and normalized to GrowEasy CRM format.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {totalImported > 0 && (
                    <button 
                      className="btn btn-primary" 
                      onClick={() => downloadCleanCSV(extractedLeads, 'success')}
                    >
                      <Download size={16} />
                      <span>Download Clean CRM CSV</span>
                    </button>
                  )}
                  {totalSkipped > 0 && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => downloadCleanCSV(skippedLeads, 'skipped')}
                    >
                      <Download size={16} />
                      <span>Download Skipped Records</span>
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={resetImporter}>
                    Import New File
                  </button>
                </div>
              </div>

              {/* Tabs Controller */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem', paddingBottom: '1px' }}>
                <button 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: activeTab === 'success' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === 'success' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    padding: '0.75rem 0.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setActiveTab('success')}
                >
                  <CheckCircle2 size={16} />
                  <span>Extracted Leads ({totalImported})</span>
                </button>

                <button 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: activeTab === 'skipped' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === 'skipped' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    padding: '0.75rem 0.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setActiveTab('skipped')}
                >
                  <AlertTriangle size={16} />
                  <span>Skipped Records ({totalSkipped})</span>
                </button>
              </div>

              {/* Tabs Panel */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                
                {/* SUCCESS TAB */}
                {activeTab === 'success' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {extractedLeads.length > 0 ? (
                      <div className="table-wrapper">
                        <table className="table-container">
                          <thead>
                            <tr>
                              <th>created_at</th>
                              <th>name</th>
                              <th>email</th>
                              <th>phone</th>
                              <th>company</th>
                              <th>status</th>
                              <th>source</th>
                              <th>location</th>
                              <th>owner</th>
                              <th>possession</th>
                              <th>crm_note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {extractedLeads.map((lead, idx) => (
                              <tr key={idx}>
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{lead.created_at || '-'}</td>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.name}</td>
                                <td title={lead.email}>{lead.email || '-'}</td>
                                <td>
                                  {lead.country_code || lead.mobile_without_country_code ? (
                                    <span>
                                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginRight: '2px' }}>{lead.country_code}</span>
                                      <span>{lead.mobile_without_country_code}</span>
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>{lead.company || '-'}</td>
                                <td>
                                  <span className={`badge ${
                                    lead.crm_status === 'GOOD_LEAD_FOLLOW_UP' ? 'badge-status-good' :
                                    lead.crm_status === 'DID_NOT_CONNECT' ? 'badge-status-did-not-connect' :
                                    lead.crm_status === 'BAD_LEAD' ? 'badge-status-bad' :
                                    lead.crm_status === 'SALE_DONE' ? 'badge-status-sale-done' : ''
                                  }`}>
                                    {lead.crm_status || 'GOOD_LEAD_FOLLOW_UP'}
                                  </span>
                                </td>
                                <td>
                                  {lead.data_source ? (
                                    <span className="badge badge-source">{lead.data_source}</span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>
                                  {[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || '-'}
                                </td>
                                <td>{lead.lead_owner || '-'}</td>
                                <td>{lead.possession_time || '-'}</td>
                                <td title={lead.crm_note} style={{ maxWidth: '250px' }}>{lead.crm_note || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                        No leads extracted.
                      </div>
                    )}
                  </div>
                )}

                {/* SKIPPED TAB */}
                {activeTab === 'skipped' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {skippedLeads.length > 0 ? (
                      <div className="table-wrapper">
                        <table className="table-container">
                          <thead>
                            <tr>
                              <th style={{ width: '80px', textAlign: 'center' }}>Row #</th>
                              <th>Reason</th>
                              {csvHeaders.slice(0, 5).map((h, i) => (
                                <th key={i}>{h}</th>
                              ))}
                              {csvHeaders.length > 5 && <th>Other Details</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {skippedLeads.map((skip, idx) => (
                              <tr key={idx}>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{skip.rowIndex}</td>
                                <td style={{ color: 'var(--danger)', fontWeight: 500, whiteSpace: 'normal', minWidth: '220px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <AlertCircle size={14} />
                                    <span>{skip.reason}</span>
                                  </div>
                                </td>
                                {csvHeaders.slice(0, 5).map((h, i) => (
                                  <td key={i} title={String(skip.rowData[h] || '')}>
                                    {String(skip.rowData[h] || '')}
                                  </td>
                                ))}
                                {csvHeaders.length > 5 && (
                                  <td style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }} title={
                                    csvHeaders.slice(5).map(h => `${h}: ${skip.rowData[h] || ''}`).join(', ')
                                  }>
                                    {csvHeaders.slice(5).map(h => `${h}: ${skip.rowData[h] || ''}`).slice(0, 2).join(', ')}
                                    {csvHeaders.length > 7 && '...'}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                        No records were skipped. 100% Import efficiency!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
        GrowEasy AI CSV Lead Importer &bull; Designed with Vanilla CSS & Next.js &bull; Powered by Gemini
      </footer>

      {/* Settings Panel Drawer */}
      <div className={`drawer-overlay ${isSettingsOpen ? 'open' : ''}`} onClick={() => setIsSettingsOpen(false)}>
        <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} />
              <span>Import Config</span>
            </h3>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setIsSettingsOpen(false)}>
              Close
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Gemini API Key */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Gemini API Key</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-tertiary)' }}>Stored locally</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" 
                  placeholder="Enter API Key (AIzaSy...)" 
                  className="input-field" 
                  style={{ paddingRight: '2.5rem' }}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
                <Lock size={14} style={{ position: 'absolute', right: '12px', top: '13px', color: 'var(--text-tertiary)' }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
                Create a free API key at the <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Google AI Studio</a>. This is stored directly in your browser's local storage and is never saved on the server.
              </p>
            </div>

            {/* Backend URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Backend API URL</label>
              <input 
                type="text" 
                placeholder="http://localhost:5000/api" 
                className="input-field" 
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
              />
            </div>

            {/* Batch Size */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <span>AI Batch Size</span>
                <span>{batchSize} rows/batch</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="100" 
                step="5"
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Larger batches speed up imports, but smaller batches are less likely to hit rate limits or response truncation. Recommended: 20-30 rows.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => handleSaveSettings(geminiApiKey, backendUrl, batchSize)}
              style={{ width: '100%' }}
            >
              Save Configuration
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setIsSettingsOpen(false)}
              style={{ width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
