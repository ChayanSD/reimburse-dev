"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/lib/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import useUpload from "@/utils/useUpload";
import {
  Receipt,
  Upload,
  X,
  ArrowLeft,
  Menu,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Download,
  CreditCard
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// TypeScript interfaces
interface UploadedFile {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  status: 'uploading' | 'uploaded' | 'processing' | 'completed' | 'failed';
  extractedData?: {
    merchant_name: string;
    amount: string | number;
    category: string;
    receipt_date: string;
    confidence?: string;
    currency?: string;
    extraction_notes?: string;
  };
}

interface BatchSession {
  id: number;
  sessionId: string;
  status: string;
  files: UploadedFile[];
  paymentId?: string;
  paidAt?: string;
}

type DragEvent = React.DragEvent<HTMLDivElement>;
type InputEvent = React.ChangeEvent<HTMLInputElement>;

export default function BatchUploadPage() {
  return (
    <AuthGuard>
      <BatchUploadContent />
    </AuthGuard>
  );
}

function BatchUploadContent() {
  const queryClient = useQueryClient();
  const { isLoading: userLoading } = useAuth();
  const [upload] = useUpload();

  // Get teamId from URL
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tid = urlParams.get('teamId');
    if (tid) setTeamId(tid);
  }, []);

  // State management
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [batchSession, setBatchSession] = useState<BatchSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  console.log(success);

  // Check URL parameters for payment status
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const paymentStatus = urlParams.get('payment');

    if (sessionId && paymentStatus === 'success') {
      // Payment successful, refresh batch session data and wait for payment confirmation
      pollBatchStatus(sessionId, true);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (sessionId && paymentStatus === 'cancelled') {
      setError('Payment was cancelled. You can try again.');
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('button[aria-label="Toggle menu"]')
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Email notification mutation
  const emailMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string; data: Record<string, unknown> }) => {
      const response = await axios.post("/api/notifications/email", {
        type,
        data,
      });
      return response.data;
    },
    onError: (err: Error | unknown) => {
      console.error("Email notification error:", err);
    },
  });

  // Batch OCR processing mutation
  const batchOcrMutation = useMutation({
    mutationFn: async ({ files }: { files: { url: string; name: string }[] }) => {
      const response = await axios.post("/api/ocr/batch", {
        files,
        teamId: teamId ? parseInt(teamId) : undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setBatchSession(data.batchSession);
      queryClient.invalidateQueries({ queryKey: ['batch-sessions'] });
      // Start polling for batch status
      pollBatchStatus(data.batchSession.sessionId);
    },
    onError: (err: Error | unknown) => {
      console.error("Batch OCR error:", err);
      setError("Failed to queue batch processing. Please try again.");
    },
  });

  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState("");
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Poll batch status
  const pollBatchStatus = async (sessionId: string, checkPayment = false) => {
    if (checkPayment) setWaitingForPayment(true);
    if (!startTime) setStartTime(new Date());

    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/ocr/batch/status/${sessionId}`);
        const { batchSession } = response.data;

        setBatchSession(batchSession);

        // Update progress and stages
        if (batchSession.status === "processing") {
          const totalFiles = batchSession.files.length;
          const completedFiles = batchSession.files.filter((f: any) => f.status === "completed" || f.status === "failed").length;

          // Calculate progress percentage
          const baseProgress = 10; // Start at 10%
          const workProgress = totalFiles > 0 ? (completedFiles / totalFiles) * 85 : 0;
          const currentProgress = Math.min(95, Math.floor(baseProgress + workProgress));
          setProcessingProgress(currentProgress);

          // Update stage based on progress
          if (currentProgress < 20) setProcessingStage("Queuing batch for processing...");
          else if (currentProgress < 50) setProcessingStage("Analyzing receipt images...");
          else if (currentProgress < 85) setProcessingStage("Extracting data and values...");
          else setProcessingStage("Finalizing results...");

          // Estimate time remaining
          const remainingFiles = totalFiles - completedFiles;
          if (remainingFiles > 0) {
            const secondsPerFile = 8; // Average processing time
            const totalSeconds = remainingFiles * secondsPerFile;
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            setEstimatedTimeRemaining(mins > 0 ? `~${mins}m ${secs}s remaining` : `~${secs}s remaining`);
          } else {
            setEstimatedTimeRemaining("");
          }
        }

        // If we are checking payment, we only stop when paidAt is truthy
        // If we only check processing, we stop when status is completed/failed
        const isProcessingFinished = batchSession.status === "completed" || batchSession.status === "failed";
        const isPaymentFinished = !checkPayment || batchSession.paidAt;

        if (isProcessingFinished && isPaymentFinished) {
          clearInterval(pollInterval);
          setWaitingForPayment(false);
          setProcessingProgress(100);
          setProcessingStage(batchSession.status === "completed" ? "Processing complete!" : "Processing failed");
          setEstimatedTimeRemaining("");

          if (batchSession.status === "completed") {
            // Send completion email
            emailMutation.mutate({
              type: 'batch_processing_complete',
              data: {
                fileCount: batchSession.files.length,
                sessionId: batchSession.sessionId,
              }
            });
          } else if (batchSession.status === "failed") {
            setError("Batch processing failed. Some files may need manual review.");
          }
        }
      } catch (error) {
        console.error("Batch status polling error:", error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setWaitingForPayment(false);
    }, 300000);
  };

  // Event handlers
  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileUploads(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileSelect = useCallback(async (e: InputEvent) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileUploads(Array.from(e.target.files));
    }
  }, []);

  // File upload handler for multiple files
  const handleFileUploads = async (files: File[]) => {
    try {
      setError(null);

      // Limit to 10 files
      if (files.length > 10) {
        throw new Error("Maximum 10 files allowed");
      }

      // Validate files
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
      const maxSize = 10 * 1024 * 1024; // 10MB

      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Invalid file type: ${file.name}. Only JPEG, PNG, and PDF files are allowed.`);
        }
        if (file.size > maxSize) {
          throw new Error(`File too large: ${file.name}. Maximum size is 10MB.`);
        }
      }

      // Create temporary file objects
      const tempFiles: UploadedFile[] = files.map((file, index) => ({
        id: `temp-${Date.now()}-${index}`,
        url: "",
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'uploading' as const,
      }));

      setUploadedFiles(tempFiles);

      // Upload files sequentially
      const uploadedFilesData: { url: string; name: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempFile = tempFiles[i];

        try {
          const uploadResult = await upload({ file });
          if (uploadResult.error) {
            throw new Error(uploadResult.error);
          }

          // Update file status
          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === tempFile.id
                ? { ...f, url: uploadResult.url, status: 'uploaded' as const }
                : f
            )
          );

          uploadedFilesData.push({
            url: uploadResult.url,
            name: file.name,
          });
        } catch (err) {
          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === tempFile.id
                ? { ...f, status: 'failed' as const }
                : f
            )
          );
          throw err;
        }
      }

      // Start batch OCR processing
      await batchOcrMutation.mutateAsync({ files: uploadedFilesData });

    } catch (err) {
      console.error("File upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload files");
    }
  };

  const resetUpload = () => {
    setUploadedFiles([]);
    setBatchSession(null);
    setError(null);
    setSuccess(false);
    setProcessingProgress(0);
    setProcessingStage("");
    setEstimatedTimeRemaining("");
    setStartTime(null);
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!batchSession) return;

    try {
      const response = await axios.post(`/api/exports/${format}`, {
        batchSessionId: batchSession.sessionId,
        teamId: teamId,
      }, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch-export-${batchSession.sessionId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      setError("Failed to export. Please ensure payment is completed.");
    }
  };

  const handlePayment = async () => {
    if (!batchSession) return;

    try {
      const response = await axios.post('/api/billing/export-checkout', {
        batchSessionId: batchSession.sessionId,
      });

      // Redirect to Stripe checkout
      window.location.href = response.data.url;
    } catch (err) {
      console.error("Payment error:", err);
      setError("Failed to initiate payment. Please try again.");
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="min-h-screen bg-[#F3F4F6]"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 relative">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-800 shrink-0"
              >
                <ArrowLeft size={20} />
              </Link>
              <Image
                src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/"
                alt="ReimburseMe Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
                width={40}
                height={40}
              />
              <div className="min-w-0 flex-1">
                <h1
                  className="text-lg sm:text-xl font-bold text-gray-900"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  Batch Upload
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  Upload up to 10 receipts for bulk processing
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <Link
              href="/dashboard"
              className="hidden sm:block text-gray-600 hover:text-gray-800 font-medium whitespace-nowrap"
            >
              Back to Dashboard
            </Link>

            {/* Mobile Burger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X size={24} />
              ) : (
                <Menu size={24} />
              )}
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div ref={mobileMenuRef} className="sm:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
              <div className="px-4 py-3">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium rounded-lg transition-colors"
                >
                  <ArrowLeft size={18} />
                  Back to Dashboard
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 py-8">
          {uploadedFiles.length === 0 ? (
            /* Upload Zone */
            <div className="bg-white rounded-3xl p-8 border border-gray-200">
              <div
                className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-colors ${dragActive
                  ? "border-[#2E86DE] bg-[#2E86DE] bg-opacity-5"
                  : "border-gray-300 hover:border-gray-400"
                  }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".jpg,.jpeg,.png,.pdf"
                  multiple
                  onChange={handleFileSelect}
                  disabled={batchOcrMutation.isPending}
                />

                <div className="relative">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-300 ${dragActive
                    ? 'bg-linear-to-br from-[#2E86DE] to-[#2574C7] shadow-lg transform scale-105'
                    : 'bg-[#2E86DE]/20'
                    }`}>
                    <Upload size={36} className={`transition-colors duration-300 ${dragActive ? 'text-white' : 'text-[#2E86DE]'
                      }`} />

                    {/* Floating upload particles when active */}
                    {dragActive && (
                      <>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-white/60 rounded-full animate-bounce"></div>
                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                        <div className="absolute top-1 -left-2 w-1 h-1 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                      </>
                    )}
                  </div>
                </div>

                <h3
                  className="text-xl font-semibold text-gray-900 mb-2"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  {dragActive
                    ? "📋 Drop your receipts here"
                    : "📤 Upload your receipts"}
                </h3>

                <div className="text-gray-600 mb-6 space-y-2">
                  <p className="flex items-center justify-center gap-2">
                    <span className="text-[#2E86DE]">✨</span>
                    Drag and drop up to 10 receipts or click to browse files
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports JPEG, PNG, and PDF files up to 10MB each
                  </p>
                </div>

                <label
                  htmlFor="file-upload"
                  className={`inline-flex items-center gap-2 px-8 py-3 font-medium rounded-2xl transition-all duration-300 cursor-pointer ${dragActive
                    ? 'bg-[#2574C7] text-white shadow-lg transform scale-105'
                    : 'bg-[#2E86DE] hover:bg-[#2574C7] text-white hover:shadow-md'
                    }`}
                >
                  <Upload size={18} />
                  {batchOcrMutation.isPending ? "Processing..." : "Choose Files"}
                </label>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-red-600">
                    <X size={20} />
                    <span className="font-medium">{error}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Processing and Results */
            <div className="space-y-6">
              {/* Files List */}
              <div className="bg-white rounded-3xl p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Uploaded Files ({uploadedFiles.length}/10)
                </h2>
                <div className="space-y-3">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${file.status === 'completed' ? 'bg-green-100' :
                        file.status === 'failed' ? 'bg-red-100' :
                          file.status === 'processing' ? 'bg-blue-100' :
                            'bg-gray-100'
                        }`}>
                        {file.status === 'completed' ? <CheckCircle size={16} className="text-green-600" /> :
                          file.status === 'failed' ? <AlertCircle size={16} className="text-red-600" /> :
                            file.status === 'processing' ? <Clock size={16} className="text-blue-600" /> :
                              <FileText size={16} className="text-gray-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-sm text-gray-600">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {file.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Batch Processing Status */}
              {(batchSession && batchSession.status !== 'completed' || waitingForPayment) && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-linear-to-br from-[#2E86DE]/20 to-[#2574C7]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                      {waitingForPayment ? (
                        <Clock size={36} className="text-[#2E86DE] animate-spin" />
                      ) : (
                        <Receipt size={36} className="text-[#2E86DE] relative z-10 animate-pulse" />
                      )}

                      {!waitingForPayment && processingProgress > 0 && (
                        <>
                          <div className="absolute top-2 right-3 w-1 h-1 bg-[#2E86DE] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="absolute top-4 left-3 w-1 h-1 bg-[#2574C7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          <div className="absolute bottom-3 right-4 w-1 h-1 bg-[#2E86DE] rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                        </>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {waitingForPayment ? 'Verifying Payment...' :
                        batchSession?.status === 'processing' ? 'AI Processing in Progress' : 'Preparing Batch'}
                    </h3>

                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className={`w-2 h-2 ${waitingForPayment ? 'bg-orange-500' : 'bg-[#2E86DE]'} rounded-full animate-pulse`}></div>
                      <p className="text-gray-600 font-medium">
                        {waitingForPayment ? 'Waiting for Stripe confirmation...' :
                          processingStage || `Processing ${batchSession?.files.filter(f => f.status === 'completed' || f.status === 'failed').length} of ${batchSession?.files.length} files`}
                      </p>
                    </div>

                    {!waitingForPayment && estimatedTimeRemaining && (
                      <div className="flex items-center justify-center gap-1 text-sm text-[#2E86DE] font-medium mb-4">
                        <Clock size={16} />
                        <span>{estimatedTimeRemaining}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {!waitingForPayment && batchSession?.status === 'processing' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Progress</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#2E86DE] font-semibold">{processingProgress}%</span>
                          {processingProgress < 100 && (
                            <div className="w-4 h-4 border-2 border-[#2E86DE] border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </div>
                      </div>
                      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-linear-to-r from-[#2E86DE] to-[#2574C7] transition-all duration-700 ease-out relative"
                          style={{ width: `${processingProgress}%` }}
                        >
                          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        <span>Queued</span>
                        <span>Processing</span>
                        <span>Complete</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Export Options */}
              {batchSession && batchSession.status === 'completed' && (
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={36} className="text-green-600" />
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Processing Complete!
                    </h3>

                    <p className="text-gray-600 mb-6">
                      All {batchSession.files.length} files have been processed successfully.
                    </p>

                    {batchSession.paidAt ? (
                      <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
                          <CheckCircle size={16} />
                          <span>Payment completed</span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <button
                            onClick={() => handleExport('csv')}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                          >
                            <Download size={18} />
                            Export CSV
                          </button>
                          <button
                            onClick={() => handleExport('pdf')}
                            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-2xl transition-colors"
                          >
                            <Download size={18} />
                            Export PDF
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <p className="text-blue-800 font-medium">Export Fee: $3.99</p>
                          <p className="text-blue-600 text-sm">One-time payment for CSV or PDF export</p>
                        </div>

                        <button
                          onClick={handlePayment}
                          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                        >
                          <CreditCard size={18} />
                          Pay $3.99 & Export
                        </button>
                      </div>
                    )}

                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <button
                        onClick={resetUpload}
                        className="text-gray-600 hover:text-gray-800 font-medium"
                      >
                        Upload New Batch
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle size={20} />
                    <span className="font-medium">{error}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}