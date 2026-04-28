'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useStep1StateMachine } from './useStep1StateMachine';

interface UseProductPlacementsParams {
  sessionId: string;
  userId: string;
  initialPlacements: any;
  initialPlacementsConfirmed: boolean;
  step1MachineTransitions: ReturnType<typeof useStep1StateMachine>['transitions'];
}

export function useProductPlacements({
  sessionId,
  userId,
  initialPlacements,
  initialPlacementsConfirmed,
  step1MachineTransitions,
}: UseProductPlacementsParams) {
  const [placements, setPlacements] = useState<any>(initialPlacements);
  const [placementsConfirmed, setPlacementsConfirmed] = useState<boolean>(initialPlacementsConfirmed);
  const [userPlacements, setUserPlacements] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementNotes, setPlacementNotes] = useState<string>('');
  const [uploadsLoaded, setUploadsLoaded] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserPlacements = async () => {
      try {
        const response = await fetch('/api/profile/placements');
        if (response.ok) {
          const data = await response.json();
          setUserPlacements(data.placements);
        }
      } catch (error) {
        console.error('Failed to fetch user profile placements:', error);
      }
    };
    fetchUserPlacements();
  }, []);

  useEffect(() => {
    const loadUploads = async () => {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('storage_path')
        .eq('session_id', sessionId);

      if (!error && data) {
        const paths = data.map((d: any) => d.storage_path).filter(Boolean);
        if (paths.length) {
          setUploadedFiles(paths);
          setUploadsLoaded(true);
          return;
        }
      }

      const { data: sourceSession } = await supabase
        .from('product_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('placements_confirmed', true)
        .not('placements', 'is', null)
        .neq('id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sourceSession?.id) {
        const { data: sourceDocs } = await supabase
          .from('uploaded_documents')
          .select('storage_path,file_name,file_type,file_size')
          .eq('session_id', sourceSession.id)
          .order('created_at', { ascending: false });

        if (sourceDocs && sourceDocs.length > 0) {
          const insertRows = sourceDocs.map((doc: any) => ({
            user_id: userId,
            session_id: sessionId,
            step_number: 1,
            file_name: doc.file_name,
            storage_path: doc.storage_path,
            file_type: doc.file_type,
            file_size: doc.file_size,
          }));
          await supabase.from('uploaded_documents').insert(insertRows);
          const paths = sourceDocs.map((doc: any) => doc.storage_path).filter(Boolean);
          if (paths.length) setUploadedFiles(paths);
        }
      }

      setUploadsLoaded(true);
    };
    loadUploads();
  }, [sessionId, userId]);

  const formatPlacementsForChat = (pl: any) => {
    if (!pl) return 'No placements extracted yet.';
    const astro = pl.astrology || {};
    const hd = pl.human_design || {};
    const astroLines = [
      `Sun: ${astro.sun || 'UNKNOWN'}`,
      `Moon: ${astro.moon || 'UNKNOWN'}`,
      `Rising: ${astro.rising || 'UNKNOWN'}`,
      `Mercury: ${astro.mercury || 'UNKNOWN'}`,
      `Venus: ${astro.venus || 'UNKNOWN'}`,
      `Mars: ${astro.mars || 'UNKNOWN'}`,
      `Jupiter: ${astro.jupiter || 'UNKNOWN'}`,
      `Saturn: ${astro.saturn || 'UNKNOWN'}`,
      `Uranus: ${astro.uranus || 'UNKNOWN'}`,
      `Neptune: ${astro.neptune || 'UNKNOWN'}`,
      `Pluto: ${astro.pluto || 'UNKNOWN'}`,
      `Houses: ${astro.houses || 'UNKNOWN'}`,
    ];
    const hdLines = [
      `Type: ${hd.type || 'UNKNOWN'}`,
      `Strategy: ${hd.strategy || 'UNKNOWN'}`,
      `Authority: ${hd.authority || 'UNKNOWN'}`,
      `Profile: ${hd.profile || 'UNKNOWN'}`,
      `Centers: ${hd.centers || 'UNKNOWN'}`,
      `Gifts: ${hd.gifts || 'UNKNOWN'}`,
    ];
    return `Astrology:\n${astroLines.join('\n')}\n\nHuman Design:\n${hdLines.join('\n')}`;
  };

  const handleFileUpload = async (files: File[]) => {
    setUploadError(null);
    const uploadedUrls: string[] = [];

    if (placementsConfirmed) {
      setPlacementsConfirmed(false);
      await supabase
        .from('product_sessions')
        .update({ placements_confirmed: false })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .throwOnError();
    }

    for (const file of files) {
      const fileName = `${userId}/${sessionId}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, file);

      if (!error && data) {
        await supabase.from('uploaded_documents').insert({
          user_id: userId,
          session_id: sessionId,
          step_number: 1,
          file_name: file.name,
          storage_path: data.path,
          file_type: file.type,
          file_size: file.size,
        });
        uploadedUrls.push(data.path);
      } else if (error) {
        console.error('File upload error', error);
        const detail = (error as any)?.message || 'Unknown storage error';
        setUploadError(`Upload failed: ${detail}. Ensure bucket "user-uploads" exists and storage policies allow inserts for authenticated users.`);
        return;
      }
    }

    setUploadedFiles((prev) => [...prev, ...uploadedUrls]);
  };

  const handleRemoveFile = async (path: string) => {
    setUploadedFiles((prev) => prev.filter((p) => p !== path));
    await supabase
      .from('uploaded_documents')
      .delete()
      .eq('session_id', sessionId)
      .eq('storage_path', path);
  };

  const handleExtractPlacements = async () => {
    if (uploadedFiles.length === 0) {
      setUploadError('Please attach at least one file to continue.');
      return;
    }

    setPlacementsError(null);
    setIsExtracting(true);
    step1MachineTransitions.uploadComplete();

    try {
      const response = await fetch('/api/products/extract-placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, storagePaths: uploadedFiles }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Extraction failed');
      }

      const responseData = await response.json();
      const { placements: extracted } = responseData;
      setPlacements(extracted);
      step1MachineTransitions.extractionComplete();
    } catch (err: any) {
      setPlacementsError(err?.message || 'Failed to extract placements. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  return {
    placements,
    setPlacements,
    placementsConfirmed,
    setPlacementsConfirmed,
    userPlacements,
    setUserPlacements,
    isExtracting,
    placementsError,
    setPlacementsError,
    placementNotes,
    setPlacementNotes,
    uploadsLoaded,
    uploadedFiles,
    setUploadedFiles,
    uploadError,
    setUploadError,
    handleFileUpload,
    handleRemoveFile,
    handleExtractPlacements,
    formatPlacementsForChat,
  };
}
