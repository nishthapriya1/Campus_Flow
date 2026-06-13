import React, { useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export const AdminPage = () => {
  const { addToast } = useToast();
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.txt'];

  const handleFileChange = (e) => {
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // 1. Client-side extension check
    const fileName = selectedFile.name.toLowerCase();
    const matchesExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

    if (!matchesExtension) {
      const errMsg = `Supported formats are PDF, PNG, JPG, JPEG, and TXT only.`;
      setError(errMsg);
      addToast(errMsg, 'error');
      setFile(null);
      e.target.value = '';
      return;
    }

    // 2. Client-side size check (10MB limit) (Requirement 1.3)
    if (selectedFile.size > 10 * 1024 * 1024) {
      const errMsg = 'File exceeds the 10 MB limit. Please select a smaller file.';
      setError(errMsg);
      addToast(errMsg, 'error');
      setFile(null);
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      const errMsg = 'Please select a file to upload.';
      setError(errMsg);
      addToast(errMsg, 'error');
      return;
    }

    setError(null);
    setSuccess(false);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await client.post('/notices', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      setSuccess(true);
      addToast('Notice document uploaded successfully!', 'success');
      setFile(null);
      // Reset input element
      const fileInput = document.getElementById('notice-file');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to upload notice file.';
      setError(errMsg);
      addToast(errMsg, 'error');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin notice Portal</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload official institutional notices for students. Supported types: PDF, PNG, JPG, TXT.
        </p>
      </div>

      <div className="glass-card p-6 sm:p-10 space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-3">
          Upload Notice Document
        </h2>

        {error && (
          <div className="bg-rose-950/30 border border-rose-800/80 text-rose-200 px-4 py-3 rounded-xl text-sm" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/30 border border-emerald-800/80 text-emerald-200 px-4 py-3 rounded-xl text-sm" role="alert">
            Notice document uploaded successfully! AI Summarization will be ready in ~30 seconds.
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="notice-file" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Notice File (Max 10 MB)
            </label>
            
            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-8 text-center bg-slate-950/20 hover:bg-slate-950/40 transition duration-200">
              <input
                id="notice-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              
              <label htmlFor="notice-file" className="cursor-pointer space-y-2 block">
                <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-slate-300 font-semibold text-sm">
                  {file ? file.name : 'Click to select or drag notice file'}
                </div>
                <div className="text-xs text-slate-500">
                  {file ? `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF, PNG, JPG, JPEG, or TXT (up to 10 MB)'}
                </div>
              </label>
            </div>
          </div>

          {/* Progress bar */}
          {uploadProgress > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>Uploading notice...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="submit"
              disabled={loading || !file}
              className="glass-btn-primary px-8"
            >
              {loading ? 'Uploading...' : 'Upload Attachment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPage;
