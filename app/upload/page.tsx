"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/lib/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import useUpload from "@/utils/useUpload";
import { Receipt, Upload, FileText, Check, X, ArrowLeft, Menu } from "lucide-react";
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
  const { isLoading: userLoading } = useAuth();
  const queryClient = useQueryClient();
  const [upload, { loading: uploadLoading }] = useUpload();
  
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

  // OCR processing mutation
  const ocrMutation = useMutation({
    mutationFn: async ({ fileUrl, filename }: { fileUrl: string; filename: string }) => {
      const response = await axios.post("/api/ocr", {
        file_url: fileUrl,
        filename,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setReceiptId(data.receipt_id);
      setProcessingStatus("processing");
      setProcessingProgress(10);
      setProcessingStage("Queuing receipt for processing...");
      // Start polling for status
      pollReceiptStatus(data.receipt_id);
    },
    onError: (err: Error | unknown) => {
      console.error("OCR error:", err);
      setError("Failed to queue receipt for processing. You can enter the details manually.");
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
  const pollReceiptStatus = async (id: number) => {
    let pollCount = 0;
    const maxPolls = 60; // 2 minutes / 2 seconds = 60 polls max
    
    // Progress simulation stages
    const stages = [
      { progress: 20, stage: "Analyzing receipt image..." },
      { progress: 40, stage: "Extracting text and data..." },
      { progress: 60, stage: "Identifying merchant and items..." },
      { progress: 80, stage: "Validating extracted information..." },
      { progress: 95, stage: "Finalizing results..." },
    ];

    const pollInterval = setInterval(async () => {
      pollCount++;
      
      // Update progress based on poll count
      if (pollCount <= stages.length) {
        const currentStage = stages[Math.min(pollCount - 1, stages.length - 1)];
        setProcessingProgress(currentStage.progress);
        setProcessingStage(currentStage.stage);
      } else {
        // Gradually increase progress after initial stages
        const additionalProgress = Math.min(95, 80 + (pollCount - stages.length) * 2);
        setProcessingProgress(additionalProgress);
      }

      try {
        const response = await axios.get(`/api/ocr/status/${id}`);
        const { status, data } = response.data;

        setProcessingStatus(status);

        if (status === "completed" && data) {
          clearInterval(pollInterval);
          setProcessingProgress(100);
          setProcessingStage("Processing complete!");
          setTimeout(() => {
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
          }, 500);
        } else if (status === "failed") {
          clearInterval(pollInterval);
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
        }
      } catch (error) {
        console.error("Status polling error:", error);
        // Don't clear interval on error, keep trying
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
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
      if (processingStatus === "processing") {
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
    }) => {
      const response = await axios.post("/api/receipts", receiptData);
      return response.data;
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
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

      console.log("Attempting to save receipt with data:", {
        file_url: uploadedFile.url,
        merchant_name: editedData.merchant_name,
        receipt_date: editedData.receipt_date,
        amount,
        category: editedData.category,
      });

      await saveReceiptMutation.mutateAsync({
        file_url: uploadedFile.url,
        merchant_name: editedData.merchant_name,
        receipt_date: editedData.receipt_date,
        amount,
        category: editedData.category,
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
              <div className="w-16 h-16 bg-[#10B981] rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-white" />
              </div>
              <h2
                className="text-2xl font-bold text-gray-900 mb-2"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                Receipt Saved Successfully!
              </h2>
              <p className="text-gray-600 mb-6">
                Your receipt has been processed and added to your dashboard.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                >
                  Upload Another Receipt
                </button>
                <Link
                  href="/dashboard"
                  className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-2xl transition-colors"
                >
                  View Dashboard
                </Link>
              </div>
            </div>
          ) : !uploadedFile ? (
            /* Upload Zone */
            <div className="bg-white rounded-3xl p-8 border border-gray-200">
              <div
                className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-colors ${
                  dragActive
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

                <div className="w-16 h-16 bg-[#2E86DE]/20 bg-opacity-10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload size={32} className="text-[#2E86DE]" />
                </div>

                <h3
                  className="text-xl font-semibold text-gray-900 mb-2"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  {dragActive
                    ? "Drop your receipt here"
                    : "Upload your receipt"}
                </h3>

                <p className="text-gray-600 mb-6">
                  Drag and drop your receipt or click to browse files
                  <br />
                  Supports JPEG, PNG, and PDF files up to 10MB
                </p>

                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors cursor-pointer"
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
              {(isOcrLoading || processingStatus === "processing" || processingStatus === "uploading") && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-[#2E86DE]/20 bg-opacity-10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Receipt size={32} className="text-[#2E86DE] animate-pulse" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Processing Receipt with AI
                    </h3>
                    <p className="text-gray-600 mb-1">
                      {processingStage}
                    </p>
                    {receiptId && (
                      <p className="text-sm text-gray-500 mt-2">
                        Receipt ID: {receiptId}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Progress</span>
                      <span className="text-[#2E86DE] font-semibold">{processingProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-linear-to-r from-[#2E86DE] to-[#2574C7] h-3 rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                        style={{ width: `${processingProgress}%` }}
                      >
                        {processingProgress > 15 && (
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Processing Steps Indicator */}
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${processingProgress >= 20 ? 'bg-[#2E86DE]' : 'bg-gray-300'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${processingProgress >= 40 ? 'bg-[#2E86DE]' : 'bg-gray-300'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${processingProgress >= 60 ? 'bg-[#2E86DE]' : 'bg-gray-300'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${processingProgress >= 80 ? 'bg-[#2E86DE]' : 'bg-gray-300'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${processingProgress >= 95 ? 'bg-[#2E86DE]' : 'bg-gray-300'}`}></div>
                  </div>
                </div>
              )}

              {/* Extracted Data Form */}
              {extractedData && editedData && (
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Review & Edit Details
                  </h2>

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

                  <div className="mt-8 flex gap-4">
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
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}