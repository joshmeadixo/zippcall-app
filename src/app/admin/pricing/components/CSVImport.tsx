'use client';

import React, { useState } from 'react';
import { Button, Alert, Card, CardHeader, CardContent, Typography, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { getAdminAuthHeader } from '@/lib/admin/auth-utils';

export function CSVImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    successCount?: number;
    errorCount?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const authHeader = await getAdminAuthHeader();
      
      const response = await fetch('/api/admin/pricing/csv-import', {
        method: 'POST',
        headers: {
          'Authorization': authHeader
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: data.success,
          message: data.message,
          count: data.count,
          successCount: data.successCount,
          errorCount: data.errorCount
        });
      } else {
        setError(data.error || 'Failed to import pricing data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardHeader title="Import Pricing from CSV" />
      <CardContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          Upload a CSV file with Twilio pricing data. The file should include columns for country name, 
          country code, and price. All prices should be in USD.
        </Typography>
        
        <Typography variant="body2" paragraph>
          <strong>Instructions:</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" component="ol" sx={{ pl: 2 }}>
          <li>Download the International Termination Rate Sheet CSV from the Twilio Console</li>
          <li>Ensure the CSV has columns for country name, country code, and price</li>
          <li>Upload the file below</li>
        </Typography>
        
        <input
          accept=".csv"
          style={{ display: 'none' }}
          id="csv-file-upload"
          type="file"
          onChange={handleFileChange}
        />
        <label htmlFor="csv-file-upload">
          <Button
            variant="outlined"
            component="span"
            startIcon={<UploadFileIcon />}
            sx={{ mr: 2, mb: 2 }}
          >
            Select CSV File
          </Button>
        </label>
        
        {file && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Selected file: {file.name}
          </Typography>
        )}
        
        <Button
          variant="contained"
          color="primary"
          disabled={!file || isLoading}
          onClick={handleUpload}
          sx={{ mb: 2 }}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Upload and Import'}
        </Button>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        
        {result && (
          <Alert severity={result.success ? "success" : "warning"} sx={{ mt: 2 }}>
            <Typography variant="body2">{result.message}</Typography>
            {result.count !== undefined && (
              <Typography variant="body2">
                Total countries: {result.count}
                {result.successCount !== undefined && ` (Success: ${result.successCount}`}
                {result.errorCount !== undefined && `, Errors: ${result.errorCount})`}
              </Typography>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 