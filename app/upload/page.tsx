"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/lib/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import useUpload from "@/utils/useUpload";
import { Receipt, Upload, FileText, Check, X, ArrowLeft, Menu, Clock, Zap, Brain, FileSearch, CheckCircle, AlertCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// TypeScript interfaces
interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface ExtractedData {
  merchant_name: string;
  amount: string | number;
  category: string;
  receipt_date: string;
  confidence?: string;
  date_source?: string;
  extraction_notes?: string;
  currency?: string;
}

type DragEvent = React.DragEvent<HTMLDivElement>;
type InputEvent = React.ChangeEvent<HTMLInputElement>;

export default function UploadPage() {
  return (
    <AuthGuard>
      <UploadContent />
    </AuthGuard>
  );
}

function UploadContent() {
  const { user, isLoading: userLoading } = useAuth();
  const queryClient = useQueryClient();
  const [upload, { loading: uploadLoading }] = useUpload();

  // Read teamId from URL
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const teamIdParam = searchParams?.get('teamId');
  const teamId = teamIdParam ? parseInt(teamIdParam) : undefined;

  // Fetch user categories
  const { data: userCategories = [] } = useQuery({
    queryKey: ["user-categories", teamId],
    queryFn: async () => {
      const response = await axios.get(`/api/categories${teamId ? `?teamId=${teamId}` : ""}`);
      return response.data.categories;
    },
    enabled: !!user,
  });

  // State management
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // State for async processing
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState("Uploading receipt...");
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>("");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [emailNotificationSent, setEmailNotificationSent] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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
      // Don't fail the whole process if email fails
    },
  });

  // OCR processing mutation
  const ocrMutation = useMutation({
    mutationFn: async ({ fileUrl, filename }: { fileUrl: string; filename: string }) => {
      const response = await axios.post("/api/ocr", {
        file_url: fileUrl,
        filename,
        teamId,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      const { filename } = variables;
      setReceiptId(data.receipt_id);
      setProcessingStatus("processing");
      setProcessingProgress(10);
      setProcessingStage("Queuing receipt for processing...");
      setStartTime(new Date());
      setEmailNotificationSent(false);
      // Start polling for status
      pollReceiptStatus(data.receipt_id, filename);
    },
    onError: (err: Error | unknown) => {
      console.error("OCR error:", err);
      setError("Failed to queue receipt for processing. You can enter the details manually.");

      // Send failure email notification
      if (uploadedFile && !emailNotificationSent) {
        emailMutation.mutate({
          type: 'processing_failed',
          data: {
            fileName: uploadedFile.name,
            errorMessage: "Failed to queue receipt for processing",
          }
        });
      }

      // Set default data for manual entry
      const defaultData: ExtractedData = {
        merchant_name: "",
        amount: "",
        category: "Other",
        receipt_date: new Date().toISOString().split("T")[0],
      };
      setExtractedData(defaultData);
      setEditedData(defaultData);
    },
  });

  // Poll receipt status
  const pollReceiptStatus = async (id: number, filename: string) => {
    let pollCount = 0;
    const maxPolls = 60; // 2 minutes / 2 seconds = 60 polls max

    // Progress simulation stages with icons
    const stages = [
      { progress: 20, stage: "Queuing receipt for processing...", icon: Clock },
      { progress: 40, stage: "Analyzing receipt image...", icon: FileSearch },
      { progress: 60, stage: "Extracting text and data...", icon: Brain },
      { progress: 80, stage: "Identifying merchant and items...", icon: Receipt },
      { progress: 95, stage: "Finalizing results...", icon: Zap },
    ];

    const pollInterval = setInterval(async () => {
      pollCount++;

      // Update estimated time remaining
      if (startTime) {
        const remainingPolls = maxPolls - pollCount;
        const estimatedRemainingSeconds = remainingPolls * 2; // 2 seconds per poll
        const minutes = Math.floor(estimatedRemainingSeconds / 60);
        const seconds = estimatedRemainingSeconds % 60;
        setEstimatedTimeRemaining(
          estimatedRemainingSeconds > 60
            ? `~${minutes}m ${seconds}s remaining`
            : `${seconds}s remaining`
        );
      }

      // Update progress based on poll count
      if (pollCount <= stages.length) {
        const currentStage = stages[Math.min(pollCount - 1, stages.length - 1)];
        setProcessingProgress(currentStage.progress);
        setProcessingStage(currentStage.stage);
      } else {
        // Gradually increase progress after initial stages
        const additionalProgress = Math.min(95, 80 + (pollCount - stages.length) * 2);
        setProcessingProgress(additionalProgress);
        setProcessingStage("Processing receipt...");
      }

      try {
        const response = await axios.get(`/api/ocr/status/${id}`);
        const { status, data } = response.data;

        setProcessingStatus(status);

        if (status === "completed" && data) {
          clearInterval(pollInterval);
          setProcessingProgress(100);
          setProcessingStage("Processing complete!");
          setEstimatedTimeRemaining("");

          // Send email notification if not already sent
          if (!emailNotificationSent) {
            emailMutation.mutate({
              type: 'processing_complete',
              data: {
                merchantName: data.merchant_name,
                amount: parseFloat(data.amount),
                category: data.category,
                receiptDate: data.receipt_date,
                fileName: filename,
              }
            });
            setEmailNotificationSent(true);
          }

          // Show data instantly without delay
          const extractedData: ExtractedData = {
            merchant_name: data.merchant_name,
            amount: data.amount,
            category: data.category,
            receipt_date: data.receipt_date,
            confidence: data.confidence,
            currency: data.currency,
            extraction_notes: data.notes,
          };
          setExtractedData(extractedData);
          setEditedData(extractedData);
          setProcessingStatus(null);
        } else if (status === "failed") {
          clearInterval(pollInterval);
          setProcessingProgress(100);
          setEstimatedTimeRemaining("");
          setProcessingStage("Processing failed");

          // Send failure email notification
          if (!emailNotificationSent) {
            emailMutation.mutate({
              type: 'processing_failed',
              data: {
                fileName: filename,
                errorMessage: "OCR processing failed",
              }
            });
            setEmailNotificationSent(true);
          }

          setError("OCR processing failed. You can enter the details manually.");
          setProcessingStatus(null);
          // Set default data for manual entry
          const defaultData: ExtractedData = {
            merchant_name: "",
            amount: "",
            category: "Other",
            receipt_date: new Date().toISOString().split("T")[0],
          };
          setExtractedData(defaultData);
          setEditedData(defaultData);
        } else if (status === "pending" && !data) {
          // Status is pending, continue polling - don't clear interval
          // Update stage to show we're waiting in queue
          if (pollCount > 3) {
            setProcessingStage("Waiting in queue...");
          }
        }
      } catch (error) {
        console.error("Status polling error:", error);
        // Don't clear interval on error, keep trying
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setProcessingProgress(100);
          setEstimatedTimeRemaining("");
          setProcessingStage("Processing timeout");
          setError("Failed to check processing status. You can enter the details manually.");
          setProcessingStatus(null);
          const defaultData: ExtractedData = {
            merchant_name: "",
            amount: "",
            category: "Other",
            receipt_date: new Date().toISOString().split("T")[0],
          };
          setExtractedData(defaultData);
          setEditedData(defaultData);
        }
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (processingStatus === "processing" || processingStatus === "pending") {
        setProcessingProgress(100);
        setEstimatedTimeRemaining("");
        setProcessingStage("Processing timeout");
        setError("Processing is taking longer than expected. You can enter the details manually.");
        setProcessingStatus(null);
        const defaultData: ExtractedData = {
          merchant_name: "",
          amount: "",
          category: "Other",
          receipt_date: new Date().toISOString().split("T")[0],
        };
        setExtractedData(defaultData);
        setEditedData(defaultData);
      }
    }, 120000);
  };


  // Receipt saving mutation
  const saveReceiptMutation = useMutation({
    mutationFn: async (receiptData: {
      file_url: string;
      merchant_name: string;
      receipt_date: string;
      amount: number;
      category: string;
      currency: string;
      teamId?: number;
    }) => {
      const response = await axios.post("/api/receipts", receiptData);
      return response.data;
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["receipts"] }); // This might need to invalidate team receipts too if query key differs
      // Reset form after 2 seconds
      setTimeout(() => {
        setUploadedFile(null);
        setExtractedData(null);
        setEditedData(null);
        setSuccess(false);
      }, 2000);
    },
    onError: (err: Error | unknown) => {
      console.error("Save error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save receipt";
      setError(errorMessage);
    },
  });

  // File upload handler
  const handleFileUpload = async (file: File) => {
    try {
      setError(null);
      setSuccess(false);
      setExtractedData(null);
      setEditedData(null);

      // Show progress bar immediately
      setProcessingProgress(5);
      setProcessingStage("Uploading receipt...");
      setProcessingStatus("uploading");

      // Set a temporary uploaded file state to show progress bar
      setUploadedFile({
        url: "",
        name: file.name,
        type: file.type,
        size: file.size,
      });

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf"
      ];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Please upload a JPEG, PNG, or PDF file");
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size must be less than 10MB");
      }

      // Update progress during upload
      setProcessingProgress(30);
      setProcessingStage("Uploading file to server...");

      // Upload file using the updated useUpload hook
      const uploadResult = await upload({ file });
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      // Update progress after upload completes
      setProcessingProgress(50);
      setProcessingStage("File uploaded, preparing for AI processing...");

      setUploadedFile({
        url: uploadResult.url,
        name: file.name,
        type: file.type,
        size: file.size,
      });

      // Process with OCR
      await ocrMutation.mutateAsync({
        fileUrl: uploadResult.url,
        filename: file.name,
      });
    } catch (err) {
      console.error("File upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload file");
      setProcessingStatus(null);
      setProcessingProgress(0);
      setUploadedFile(null);
    }
  };

  // Event handlers with proper TypeScript types
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: InputEvent) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  }, []);

  // Save receipt handler
  const handleSaveReceipt = async () => {
    try {
      setError(null);

      if (!uploadedFile || !editedData) {
        throw new Error("Missing required data");
      }

      // Validate required fields
      if (!editedData.merchant_name?.trim()) {
        throw new Error("Merchant name is required");
      }

      const amount = parseFloat(String(editedData.amount));
      if (!editedData.amount || amount <= 0) {
        throw new Error("Valid amount is required");
      }

      if (!editedData.receipt_date) {
        throw new Error("Receipt date is required");
      }

      if (!editedData.category) {
        throw new Error("Category is required");
      }

      await saveReceiptMutation.mutateAsync({
        file_url: uploadedFile.url,
        merchant_name: editedData.merchant_name,
        receipt_date: editedData.receipt_date,
        amount,
        category: editedData.category,
        currency: editedData.currency!,
        teamId,
      });
    } catch (err) {
      console.error("Save error:", err);
      // Error is handled by the mutation's onError callback
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setEditedData(null);
    setError(null);
    setSuccess(false);
    setProcessingProgress(0);
    setProcessingStage("Uploading receipt...");
    setProcessingStatus(null);
    setReceiptId(null);
    setEstimatedTimeRemaining("");
    setStartTime(null);
    setEmailNotificationSent(false);
  };

  // Loading states
  const isOcrLoading = ocrMutation.isPending;
  const isSaveLoading = saveReceiptMutation.isPending;

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // This component is now protected by AuthGuard, so we don't need this check
  // If we reach here, the user is authenticated

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
                  Upload Receipt
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  Upload and process your receipt
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
          {success ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-200 text-center">
              <div className="w-20 h-20 bg-linear-to-br from-[#10B981] to-[#059669] rounded-full flex items-center justify-center mx-auto mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                <Check size={36} className="text-white relative z-10" />
              </div>

              <h2
                className="text-2xl font-bold text-gray-900 mb-3"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                🎉 Receipt Saved Successfully!
              </h2>

              <p className="text-gray-600 mb-4">
                Your receipt has been processed and added to your dashboard.
              </p>

              {emailNotificationSent && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium mb-6">
                  <CheckCircle size={16} />
                  <span>Email notification sent!</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Upload Another Receipt
                </button>
                <Link
                  href="/dashboard"
                  className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={18} />
                  View Dashboard
                </Link>
              </div>
            </div>
          ) : !uploadedFile ? (
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
                  onChange={handleFileSelect}
                  disabled={uploadLoading}
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
                    ? "📋 Drop your receipt here"
                    : "📤 Upload your receipt"}
                </h3>

                <div className="text-gray-600 mb-6 space-y-2">
                  <p className="flex items-center justify-center gap-2">
                    <span className="text-[#2E86DE]">✨</span>
                    Drag and drop your receipt or click to browse files
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports JPEG, PNG, and PDF files up to 10MB
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
                  {uploadLoading ? "Uploading..." : "Choose File"}
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
            /* Processing and Review */
            <div className="space-y-6">
              {/* File Preview */}
              <div className="bg-white rounded-3xl p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Uploaded File
                </h2>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2E86DE]/20 bg-opacity-10 rounded-2xl flex items-center justify-center">
                    <FileText size={20} className="text-[#2E86DE]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {uploadedFile.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={resetUpload}
                    className="text-gray-500 hover:text-gray-700 p-2"
                    title="Remove file"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Upload & OCR Processing */}
              {(isOcrLoading || processingStatus === "processing" || processingStatus === "uploading" || processingStatus === "pending") && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200">
                  <div className="text-center mb-6">
                    {/* Animated Processing Icon */}
                    <div className="w-20 h-20 bg-linear-to-br from-[#2E86DE]/20 to-[#2574C7]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                      <Receipt size={36} className="text-[#2E86DE] relative z-10 animate-pulse" />

                      {/* Floating particles */}
                      {processingProgress > 0 && (
                        <>
                          <div className="absolute top-2 right-3 w-1 h-1 bg-[#2E86DE] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="absolute top-4 left-3 w-1 h-1 bg-[#2574C7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          <div className="absolute bottom-3 right-4 w-1 h-1 bg-[#2E86DE] rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                          <div className="absolute bottom-2 left-2 w-1 h-1 bg-[#2574C7] rounded-full animate-bounce" style={{ animationDelay: '900ms' }}></div>
                        </>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {processingStatus === "uploading" ? "Uploading Receipt" : processingStatus === "pending" ? "Waiting in Queue" : "AI Processing in Progress"}
                    </h3>

                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-[#2E86DE] rounded-full animate-pulse"></div>
                      <p className="text-gray-600 font-medium">
                        {processingStage}
                      </p>
                    </div>

                    {estimatedTimeRemaining && (
                      <div className="flex items-center justify-center gap-1 text-sm text-[#2E86DE] font-medium mb-2">
                        <Clock size={16} />
                        <span>{estimatedTimeRemaining}</span>
                      </div>
                    )}

                    {receiptId && (
                      <p className="text-xs text-gray-500 mt-2">
                        Receipt ID: {receiptId}
                      </p>
                    )}
                  </div>

                  {/* Enhanced Progress Bar */}
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

                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                        <div
                          className="bg-linear-to-r from-[#2E86DE] via-[#2574C7] to-[#1E5AA8] h-4 rounded-full transition-all duration-700 ease-out flex items-center justify-end relative overflow-hidden"
                          style={{ width: `${processingProgress}%` }}
                        >
                          {/* Animated shimmer effect */}
                          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>

                          {/* Progress indicator */}
                          {processingProgress > 10 && (
                            <div className="w-3 h-3 bg-white rounded-full shadow-lg animate-pulse mr-1"></div>
                          )}
                        </div>
                      </div>

                      {/* Progress ticks */}
                      <div className="absolute top-0 left-0 w-full h-4 flex justify-between px-1 pointer-events-none">
                        {[20, 40, 60, 80, 95].map((tick) => (
                          <div
                            key={tick}
                            className={`w-0.5 h-4 ${processingProgress >= tick ? 'bg-white/60' : 'bg-gray-300'
                              } transition-colors duration-300`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Processing Steps Indicator */}
                  <div className="mt-8">
                    <div className="grid grid-cols-5 gap-2 sm:gap-4">
                      {[
                        { threshold: 20, label: "Queuing", icon: Clock },
                        { threshold: 40, label: "Analyzing", icon: FileSearch },
                        { threshold: 60, label: "Extracting", icon: Brain },
                        { threshold: 80, label: "Identifying", icon: Receipt },
                        { threshold: 95, label: "Finalizing", icon: Zap },
                      ].map(({ threshold, label, icon: Icon }) => {
                        const isActive = processingProgress >= threshold;
                        const isCurrent = processingProgress >= threshold - 20 && processingProgress < threshold + 20;

                        return (
                          <div key={threshold} className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all duration-300 ${isActive
                              ? 'bg-[#2E86DE] text-white shadow-lg'
                              : isCurrent
                                ? 'bg-[#2E86DE]/20 text-[#2E86DE] animate-pulse'
                                : 'bg-gray-200 text-gray-400'
                              }`}>
                              <Icon size={18} />
                            </div>
                            <span className={`text-xs font-medium text-center transition-colors duration-300 ${isActive ? 'text-[#2E86DE]' : 'text-gray-500'
                              }`}>
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Additional Status Info */}
                  {processingStatus === "failed" && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle size={20} />
                        <span className="font-medium">Processing failed</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Data Form */}
              {extractedData && editedData && (
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#10B981]/20 rounded-xl flex items-center justify-center">
                      <CheckCircle size={20} className="text-[#10B981]" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Review & Edit Details
                    </h2>
                  </div>

                  {/* Actual Form */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Merchant Name
                        </label>
                        <input
                          type="text"
                          value={editedData.merchant_name || ""}
                          onChange={(e) =>
                            setEditedData((prev) => ({
                              ...prev!,
                              merchant_name: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                          placeholder="Enter merchant name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={String(editedData.amount || "")}
                          onChange={(e) =>
                            setEditedData((prev) => ({
                              ...prev!,
                              amount: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={editedData.receipt_date || ""}
                          onChange={(e) =>
                            setEditedData((prev) => ({
                              ...prev!,
                              receipt_date: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category
                        </label>
                        <select
                          value={editedData.category || "Other"}
                          onChange={(e) =>
                            setEditedData((prev) => ({
                              ...prev!,
                              category: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                        >
                          <option value="Meals">Meals</option>
                          <option value="Travel">Travel</option>
                          <option value="Supplies">Supplies</option>
                          <option value="Other">Other</option>
                          {userCategories.map((cat: any) => (
                            <option key={cat.id} value={cat.title}>
                              {cat.title}
                            </option>
                          ))}
                          {/* If detected category is not in the list, show it anyway so it's visible */}
                          {editedData.category &&
                            !["Meals", "Travel", "Supplies", "Other"].includes(editedData.category) &&
                            !userCategories.find((cat: any) => cat.title === editedData.category) && (
                              <option value={editedData.category}>{editedData.category}</option>
                            )}
                        </select>
                      </div>
                    </div>

                    {error && (
                      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                        <div className="flex items-center gap-2 text-red-600">
                          <X size={20} />
                          <span className="font-medium">{error}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={handleSaveReceipt}
                        disabled={
                          isSaveLoading ||
                          !editedData.merchant_name ||
                          !editedData.amount
                        }
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors disabled:opacity-50"
                      >
                        <Check size={18} />
                        {isSaveLoading ? "Saving..." : "Save Receipt"}
                      </button>

                      <button
                        onClick={resetUpload}
                        className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-2xl transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
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