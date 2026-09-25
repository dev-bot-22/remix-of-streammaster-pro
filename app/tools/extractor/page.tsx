'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import "../../globals.css";

interface ExtractedData {
  vid: string;
  rawUrl: string;
  hlsUrl: string;
  dashUrl: string;
}

export default function ExtractorPage() {
  const [batchId, setBatchId] = useState('');
  const [lectureId, setLectureId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractedData | null>(null);

  const handleExtract = async () => {
    if (!batchId.trim() || !lectureId.trim()) {
      toast.error('Both Batch ID and Lecture ID are required.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/public/get-info?batchId=${encodeURIComponent(batchId.trim())}&lectureId=${encodeURIComponent(lectureId.trim())}`);
      const json = await res.json();

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || 'Failed to extract video information.');
      }

      const url = json.data.url || '';
      const match = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      const vid = match ? match[1] : '';

      setResult({
        vid,
        rawUrl: url,
        hlsUrl: vid ? `https://stream.pimaxer.in/${vid}/master.m3u8` : url,
        dashUrl: vid ? `https://stream.pimaxer.in/${vid}/master.mpd` : url,
      });

      toast.success('Successfully extracted video details!');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during extraction.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Stream Extractor
          </h1>
          <p className="text-sm text-neutral-400">
            Enter Batch ID and Lecture/Child ID to extract direct, playable stream URLs.
          </p>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Batch ID</label>
            <Input 
              placeholder="e.g., 6779345c20fa0756e4a7fd08" 
              value={batchId} 
              onChange={(e) => setBatchId(e.target.value)}
              className="bg-neutral-950 border-neutral-800 focus:border-indigo-500 text-neutral-100"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Lecture / Child ID</label>
            <Input 
              placeholder="e.g., 6a43b88f1d77602b1c4bdc3c" 
              value={lectureId} 
              onChange={(e) => setLectureId(e.target.value)}
              className="bg-neutral-950 border-neutral-800 focus:border-indigo-500 text-neutral-100"
            />
          </div>

          <Button 
            onClick={handleExtract} 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? 'Extracting...' : 'Extract Video Details'}
          </Button>
        </div>

        {/* Result Area */}
        {result && (
          <div className="mt-8 border-t border-neutral-800 pt-6 space-y-4 animate-in fade-in duration-300">
            <h2 className="text-lg font-bold text-neutral-200">Extracted Stream Details</h2>
            
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
              
              {/* VID */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/50 pb-3">
                <div>
                  <span className="text-xs font-semibold text-neutral-500 uppercase">Video ID (VID)</span>
                  <p className="font-mono text-sm text-neutral-300 select-all">{result.vid || 'N/A'}</p>
                </div>
                {result.vid && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCopy(result.vid, 'Video ID')}
                    className="border-neutral-800 hover:bg-neutral-900 text-xs"
                  >
                    Copy VID
                  </Button>
                )}
              </div>

              {/* HLS URL */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/50 pb-3">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-neutral-500 uppercase">HLS Playable URL</span>
                  <p className="font-mono text-sm text-neutral-300 truncate select-all">{result.hlsUrl}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCopy(result.hlsUrl, 'HLS URL')}
                    className="border-neutral-800 hover:bg-neutral-900 text-xs"
                  >
                    Copy Link
                  </Button>
                </div>
              </div>

              {/* DASH URL */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/50 pb-3">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-neutral-500 uppercase">DASH Playable URL</span>
                  <p className="font-mono text-sm text-neutral-300 truncate select-all">{result.dashUrl}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCopy(result.dashUrl, 'DASH URL')}
                    className="border-neutral-800 hover:bg-neutral-900 text-xs"
                  >
                    Copy Link
                  </Button>
                </div>
              </div>

              {/* Raw CDN URL */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-neutral-500 uppercase">Raw CDN Source URL</span>
                  <p className="font-mono text-sm text-neutral-300 truncate select-all">{result.rawUrl}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleCopy(result.rawUrl, 'Raw CDN URL')}
                  className="border-neutral-800 hover:bg-neutral-900 text-xs"
                >
                  Copy Link
                </Button>
              </div>

            </div>

            {/* Play Button */}
            <Button 
              onClick={() => window.open(`/watch?batchId=${encodeURIComponent(batchId.trim())}&ChildId=${encodeURIComponent(lectureId.trim())}&Type=penpencilvdo&isLocked=false`, '_blank')}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-3 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20"
            >
              Play Video in Watch Player
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
