import { useState, useCallback } from 'react';

export type DrawingMode = 'upload' | 'edit' | null;

export const useDrawing = () => {
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(null);
  const [drawnGpxContent, setDrawnGpxContent] = useState('');
  const [previousGpxContent, setPreviousGpxContent] = useState('');
  const [editDrawnGpxContent, setEditDrawnGpxContent] = useState('');
  const [editPreviousGpxContent, setEditPreviousGpxContent] = useState('');

  const startDrawing = useCallback((mode: 'upload' | 'edit') => {
    if (mode === 'upload') {
      setPreviousGpxContent(drawnGpxContent);
    } else {
      setEditPreviousGpxContent(editDrawnGpxContent);
    }
    setIsDrawingActive(true);
    setDrawingMode(mode);
  }, [drawnGpxContent, editDrawnGpxContent]);

  const completeDrawing = useCallback((gpxContent: string) => {
    if (drawingMode === 'edit') {
      setEditDrawnGpxContent(gpxContent);
    } else {
      setDrawnGpxContent(gpxContent);
    }
    setIsDrawingActive(false);
    setDrawingMode(null);
  }, [drawingMode]);

  const cancelDrawing = useCallback(() => {
    setIsDrawingActive(false);
    setDrawingMode(null);
  }, []);

  const clearDrawnContent = useCallback((mode: 'upload' | 'edit') => {
    if (mode === 'upload') {
      setDrawnGpxContent('');
    } else {
      setEditDrawnGpxContent('');
    }
  }, []);

  const getGpxContent = useCallback((mode: 'upload' | 'edit') => {
    return mode === 'upload' ? drawnGpxContent : editDrawnGpxContent;
  }, [drawnGpxContent, editDrawnGpxContent]);

  const getPreviousGpxContent = useCallback((mode: 'upload' | 'edit') => {
    return mode === 'upload' ? previousGpxContent : editPreviousGpxContent;
  }, [previousGpxContent, editPreviousGpxContent]);

  return {
    isDrawingActive,
    drawingMode,
    startDrawing,
    completeDrawing,
    cancelDrawing,
    clearDrawnContent,
    getGpxContent,
    getPreviousGpxContent
  };
};