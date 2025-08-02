import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BACKEND_COMFYUI_URL } from '@/config/backend_comfyui';

type WorkflowJSON1 = Record<string, any>;
type WorkflowJSON2 = Record<string, any>;
const WORKFLOW_JSON_1: WorkflowJSON1 = {};
export const ComfyUITab = () => {
  const [destinationImage, setDestinationImage] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const [maskImage, setMaskImage] = useState<File | null>(null);
  const [objectImage, setObjectImage] = useState<File | null>(null);
  const [selectedAccessory, setSelectedAccessory] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('Status: Waiting for input...');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Canvas editing state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [brushType, setBrushType] = useState<'round' | 'square'>('round');
  const [brushColor, setBrushColor] = useState<'black' | 'white'>('black');
  const [brushSize, setBrushSize] = useState(10);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editedImageData, setEditedImageData] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);

  const updateStatus = useCallback((message: string, isError = false) => {
    console.log(message);
    setStatus(message);
    if (isError) {
      toast.error(message);
    }
  }, []);

  const uploadImage = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('overwrite', 'true');
    formData.append('type', 'input');

    updateStatus(`Uploading ${file.name}...`);
    const response = await fetch(`${BACKEND_COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
    return response.json();
  }, [updateStatus]);

  const getModifiedWorkflow = useCallback((workflow: any, destinationImageName: string, objectImageName: string, maskImageName: string | null) => {
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));

    // Different node titles based on selected accessory
    const destinationNodeTitle = selectedAccessory === 'watch' ? "Insert hand" : "Other insert";
    const objectNodeTitle = selectedAccessory === 'watch' ? "Insert object" : "Other insert object";
    const maskNodeTitle = selectedAccessory === 'watch' ? "Insert Mask" : "Load Other Mask";
    let destinationNodeId, objectNodeId, maskNodeId;
    for (const id in updatedWorkflow) {
      if (updatedWorkflow[id]._meta?.title === destinationNodeTitle) destinationNodeId = id;
      if (updatedWorkflow[id]._meta?.title === objectNodeTitle) objectNodeId = id;
      if (updatedWorkflow[id]._meta?.title == maskNodeTitle) maskNodeId = id;
    }

    if (destinationNodeId) updatedWorkflow[destinationNodeId].inputs.image = destinationImageName;
    if (objectNodeId) updatedWorkflow[objectNodeId].inputs.image = objectImageName;
    if (maskNodeId && maskImageName) {
      updatedWorkflow[maskNodeId].inputs.image = maskImageName;
    }
    return updatedWorkflow;
  }, [selectedAccessory]);

  const queuePrompt = useCallback((clientId: string, workflowObject: any) => {
    const payload = {
      client_id: clientId,
      prompt: workflowObject,
    };

    updateStatus('Queueing prompt...');
    return fetch(`${BACKEND_COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }, [updateStatus]);

  const startGeneration = useCallback(async () => {
    if (!destinationImage || !objectImage) {
      updateStatus('Error: Please select both a destination and object image.', true);
      return;
    }
    const logImageDimensions = async () => {
      console.log("🔍 Checking dimensions of images to be uploaded...");

      const getImageDimensions = (file: File) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            resolve({
              "Image Type": file.name.startsWith('mask_') ? 'Mask' : (file === destinationImage ? 'Destination' : 'Object'),
              "File Name": file.name,
              "Width": img.width,
              "Height": img.height,
              "Dimensions": `${img.width} x ${img.height}`,
            });
            // Clean up the object URL to prevent memory leaks
            URL.revokeObjectURL(img.src);
          };
          img.onerror = (err) => reject(err);
          img.src = URL.createObjectURL(file);
        });
      };

      try {
        const promises = [];
        if (destinationImage) promises.push(getImageDimensions(destinationImage));
        if (objectImage) promises.push(getImageDimensions(objectImage));
        if (maskImage) promises.push(getImageDimensions(maskImage));

        const dimensions = await Promise.all(promises);
        console.table(dimensions);
      } catch (e) {
        console.error("Could not read image dimensions for debugging.", e);
      }
    };
    await logImageDimensions();
    setIsGenerating(true);
    setResultImage(null); // Reset previous result
    setProgress(0);

    try {
      // *** NEW: Upload the mask image first if it exists ***
      let maskFileInfo = null;
      if (maskImage) {
        updateStatus(`Uploading mask...`);
        maskFileInfo = await uploadImage(maskImage);
      }

      const destFileInfo = await uploadImage(destinationImage);
      const objFileInfo = await uploadImage(objectImage);
      updateStatus('Uploads complete. Preparing workflow...');

      const selectedWorkflow = selectedAccessory === 'watch' ? WORKFLOW_JSON_1 : WORKFLOW_JSON_2;

      // *** MODIFIED: Pass the mask filename to the workflow function ***
      const modifiedWorkflow = getModifiedWorkflow(
        selectedWorkflow,
        destFileInfo.name,
        objFileInfo.name,
        maskFileInfo ? maskFileInfo.name : null
      );

      const clientId = Math.random().toString(36).substring(7);
      const wsUrl = BACKEND_COMFYUI_URL.replace(/^http/, 'ws');
      // ... rest of the try block
      const ws = new WebSocket(`${wsUrl}/ws?clientId=${clientId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        queuePrompt(clientId, modifiedWorkflow);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'executed') {
            const executedNodeId = data.data.node;

            // Dynamically find the ID of the node titled "Final Image"
            const currentWorkflow = selectedAccessory === 'watch' ? WORKFLOW_JSON_1 : WORKFLOW_JSON_2;
            const finalNodeId = Object.keys(currentWorkflow).find(
              id => (currentWorkflow as any)[id]._meta?.title === 'Final Output'
            );

            // Check if the executed node is our final target node
            if (executedNodeId === finalNodeId) {
              const output = data.data?.output;

              if (output && output.images && output.images.length > 0) {
                // SUCCESS!
                updateStatus('Execution complete! Fetching image...');
                const finalImage = output.images[0];
                const imageUrl = `${BACKEND_COMFYUI_URL}/view?filename=${encodeURIComponent(finalImage.filename)}&subfolder=${encodeURIComponent(finalImage.subfolder)}&type=${finalImage.type}`;

                setResultImage(imageUrl);
                updateStatus('Done!');
                setProgress(100);
                toast.success("Image generated successfully!");
              } else {
                // This case should ideally not be hit with the new logic
                updateStatus(`Error: Final node ${finalNodeId} executed, but no image was found in the output.`, true);
                console.error("The final data packet was received but could not be parsed correctly:", data);
              }

              ws.close(); // Close the connection after getting the result
            }
          } else if (data.type === 'progress') {
            const { value, max } = data.data;
            const progressValue = Math.round((value / max) * 100);
            setProgress(progressValue);
            updateStatus(`Generating... ${progressValue}%`);
          } else if (data.type === 'execution_error') {
            updateStatus(`Server Error: ${JSON.stringify(data.data)}`, true);
          }
        } catch (e) {
          console.error("Error processing WebSocket message:", e);
          console.error("The problematic raw message was:", event.data);
        }
      };

      ws.onclose = () => {
        setIsGenerating(false);
      };

      ws.onerror = (err) => {
        updateStatus('WebSocket error. Check console for details.', true);
        console.error('WebSocket Error:', err);
        setIsGenerating(false);
      };

    } catch (error: any) {
      updateStatus(`An error occurred: ${error.message}`, true);
      console.error(error);
      setIsGenerating(false);
      setProgress(0);
    }
  }, [destinationImage, objectImage, maskImage, selectedAccessory, uploadImage, getModifiedWorkflow, queuePrompt, updateStatus]);

  // Canvas setup and drawing functions
  const setupCanvas = useCallback((image: HTMLImageElement) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const MAX_CANVAS_DIMENSION = 4096;
    let drawWidth = image.width;
    let drawHeight = image.height;

    if (drawWidth > MAX_CANVAS_DIMENSION || drawHeight > MAX_CANVAS_DIMENSION) {
      toast.info(`Image is very large, downscaling for editor performance...`);
      const ratio = Math.min(MAX_CANVAS_DIMENSION / drawWidth, MAX_CANVAS_DIMENSION / drawHeight);
      drawWidth = Math.floor(drawWidth * ratio);
      drawHeight = Math.floor(drawHeight * ratio);
    }
    
    // --- NEW: Store the calculated canvas dimensions in state ---
    setCanvasSize({ width: drawWidth, height: drawHeight });

    canvas.width = drawWidth;
    canvas.height = drawHeight;

    context.drawImage(image, 0, 0, drawWidth, drawHeight);

    contextRef.current = context;
    originalImageRef.current = image;
  }, []);

  const handleDestinationImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create a canvas to draw the image, which strips EXIF data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          toast.error("Could not process image.");
          return;
        }

        // The browser reads EXIF for .width and .height, so the orientation is correct here
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Create a new file from the canvas blob
        canvas.toBlob((blob) => {
          if (blob) {
            const sanitizedFile = new File([blob], file.name.replace(/(\.[\w\d_-]+)$/i, '.png'), {
              type: 'image/png',
            });

            // Set the new, sanitized file as the destination image
            setDestinationImage(sanitizedFile);
            setMaskImage(null);
            setEditedImageData(null);

            toast.success("Image processed and ready.");
          }
        }, 'image/png');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const openEditor = useCallback(() => {
    if (!destinationImage) {
      toast.error('Please select a destination image first');
      return;
    }

    setIsEditorOpen(true);

    // Small delay to ensure dialog is open and canvas is rendered
    setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        setupCanvas(img);
      };
      img.onerror = () => {
        toast.error('Failed to load image for editing');
      };
      img.src = URL.createObjectURL(destinationImage);
    }, 100);
  }, [destinationImage, setupCanvas]);

  const getBrushPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    // This calculates the correct mouse position relative to the canvas,
    // accounting for any scaling or resizing of the canvas element in the CSS.
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current || !originalImageRef.current) return;

    const context = contextRef.current;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // --- FIX: Add a guard to prevent division by zero ---
    // This stops the function if the canvas has no rendered size yet.
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    // --- End of Fix ---

    const scale = canvas.width / rect.width;
    const scaledBrushSize = brushSize * scale;

    const { x, y } = getBrushPosition(e);

    if (brushColor === 'white') { // Erase logic
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = '#000';

      context.beginPath();
      if (brushType === 'round') {
        context.arc(x, y, scaledBrushSize / 2, 0, 2 * Math.PI);
      } else {
        context.rect(x - scaledBrushSize / 2, y - scaledBrushSize / 2, scaledBrushSize, scaledBrushSize);
      }
      context.fill();

    } else { // Restore logic
      context.globalCompositeOperation = 'source-over';

      context.save();
      context.beginPath();
      if (brushType === 'round') {
        context.arc(x, y, scaledBrushSize / 2, 0, 2 * Math.PI);
      } else {
        context.rect(x - scaledBrushSize / 2, y - scaledBrushSize / 2, scaledBrushSize, scaledBrushSize);
      }
      context.clip();
      context.drawImage(originalImageRef.current, 0, 0);
      context.restore();
    }
  }, [isDrawing, brushColor, brushSize, brushType, getBrushPosition]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!contextRef.current) return;
    setIsDrawing(true);
    draw(e);
  }, [draw]);


  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    // IMPORTANT: Reset composite operation to default after drawing is finished.
    if (contextRef.current) {
      contextRef.current.globalCompositeOperation = 'source-over';
    }
    contextRef.current?.beginPath();
  }, []);

  const resetCanvas = useCallback(() => {
    if (!originalImageRef.current) return;
    setupCanvas(originalImageRef.current);
  }, [setupCanvas]);

  const saveEditedImage = useCallback(() => {
    if (!canvasRef.current || !originalImageRef.current || !destinationImage) {
      toast.error("Cannot save, required image data is missing.");
      return;
    }

    // For the UI preview, we still want to show the version with transparency
    const previewDataUrl = canvasRef.current.toDataURL('image/png');
    // Make sure you have a state setter like setEditedImageData or setEditedImageDataUrl
    // For this example, I'll assume it's called setEditedImageData
    if (typeof setEditedImageData !== 'undefined') {
      setEditedImageData(previewDataUrl);
    }


    // --- Start of Final, Pixel-by-Pixel Saving Logic ---

    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) {
      toast.error("Could not create mask canvas.");
      return;
    }

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    maskCanvas.width = width;
    maskCanvas.height = height;

    const editedCtx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!editedCtx) return;
    const editedImageData = editedCtx.getImageData(0, 0, width, height);
    const editedData = editedImageData.data;

    const maskOutputImageData = maskCtx.createImageData(width, height);
    const maskData = maskOutputImageData.data;

    for (let i = 0; i < editedData.length; i += 4) {
      // If the pixel in the edited canvas is transparent, it's the masked area.
      // In our mask file, the masked area should be WHITE.
      if (editedData[i + 3] < 128) {
        maskData[i] = 255; maskData[i + 1] = 255; maskData[i + 2] = 255; maskData[i + 3] = 255;
      } else {
        maskData[i] = 0; maskData[i + 1] = 0; maskData[i + 2] = 0; maskData[i + 3] = 255;
      }
    }

    maskCtx.putImageData(maskOutputImageData, 0, 0);

    maskCanvas.toBlob((blob) => {
      if (blob) {
        const maskFile = new File([blob], `mask_${destinationImage.name.replace(/(\.[\w\d_-]+)$/i, '.png')}`, { type: 'image/png' });
        setMaskImage(maskFile);
        toast.success('Mask created successfully!');
        setIsEditorOpen(false);
      } else {
        toast.error('Failed to create mask file.');
      }
    }, 'image/png');
  }, [destinationImage]);

  const getCursorStyle = useCallback(() => {
    const size = Math.max(brushSize, 8);
    let cursorSvg;

    if (brushType === 'square') {
      // --- NEW: Generate an SVG for a square cursor ---
      cursorSvg = `url("data:image/svg+xml,%3csvg width='${size}' height='${size}' xmlns='http://www.w3.org/2000/svg'%3e%3crect x='1' y='1' width='${size - 2}' height='${size - 2}' fill='none' stroke='%23000' stroke-width='1'/%3e%3c/svg%3e") ${size / 2} ${size / 2}, crosshair`;
    } else {
      // Default to the round cursor
      cursorSvg = `url("data:image/svg+xml,%3csvg width='${size}' height='${size}' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 1}' fill='none' stroke='%23000' stroke-width='1'/%3e%3c/svg%3e") ${size / 2} ${size / 2}, crosshair`;
    }

    return {
      cursor: cursorSvg
    };
    // --- FIX: Add brushType to the dependency array ---
  }, [brushSize, brushType]);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const scrollDelta = e.deltaY > 0 ? -0.15 : 0.15; // Zoom out on scroll down, in on up

    // --- FIX #2: Dynamically calculate max zoom to prevent crashes ---
    const maxDim = Math.max(canvasSize.width, canvasSize.height);
    // Keep the effective rendered size below a safe browser limit (e.g., 8192px)
    const maxZoom = maxDim > 0 ? Math.max(1.0, 8192 / maxDim) : 3; // Default max 3x zoom

    const newZoom = Math.max(0.2, Math.min(maxZoom, zoom + scrollDelta));

    const canvasContainer = e.currentTarget;
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // --- FIX #1: Corrected formula for centered zoom ---
    const newOffsetX = mouseX - (mouseX - offset.x) * (newZoom / zoom);
    const newOffsetY = mouseY - (mouseY - offset.y) * (newZoom / zoom);

    setZoom(newZoom);
    setOffset({ x: newOffsetX, y: newOffsetY });

  }, [zoom, offset, canvasSize]); // Update dependencies

  const panStart = useCallback((e: React.MouseEvent) => {
    // Pan starts on middle mouse button click
    if (e.button !== 1) return;
    e.preventDefault();
    isPanning.current = true;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, []);

  const panMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
  }, []);

  const panEnd = useCallback((e: React.MouseEvent) => {
    isPanning.current = false;
    (e.currentTarget as HTMLElement).style.cursor = 'default';
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div className="space-y-6">
      {/* Accessory Selection at the top */}
      <Card className="bg-slate-00/50 border-slate-700">
        <CardContent className="p-6">
          <div>
            <Label htmlFor="accessory-select" className="text-white font-medium">
              Select Accessory Type
            </Label>
            <select
              id="accessory-select"
              value={selectedAccessory}
              onChange={(e) => setSelectedAccessory(e.target.value)}
              className="mt-2 w-full px-3 py-2 bg-[#A3E635]/80 hover:bg-green-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">--Select an accessory--</option>
              <option value="watch">Watch</option>
              <option value="cap">Cap</option>
              <option value="bracelet">Bracelet</option>
            </select>
            <p className="text-sm text-white mt-1">
              {selectedAccessory === 'watch'
                ? 'Using specialized watch insertion workflow'
                : 'Using general accessory insertion workflow'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* --- RESPONSIVE Three column layout: Stacks on mobile, horizontal on desktop --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Destination Image */}
        <Card className="bg-slate-00/50 border-slate-700 flex flex-col">
          <CardContent className="p-6 space-y-4 flex-grow flex flex-col">
            <div>
              <Label htmlFor="destination-image" className="text-foreground font-medium">
                {selectedAccessory === 'watch' ? 'Hand Image (with mask)' : 'Destination Image (with mask)'}
              </Label>
              <Input
                id="destination-image"
                type="file"
                accept="image/*"
                onChange={handleDestinationImageChange}
                className="mt-2 bg-[#A3E635]/80 hover:bg-green-700 border-border/20"
              />
              <p className="text-sm text-foreground/60 mt-1">
                {selectedAccessory === 'watch'
                  ? 'Upload an image of a hand where you want to place the watch'
                  : `Upload an image where you want to place the ${selectedAccessory}`}
              </p>
            </div>

            {destinationImage && (
              <div className="space-y-4 mt-auto">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      onClick={openEditor}
                      variant="default"
                      size="sm"
                    >
                      Edit Mask
                    </Button>
                  </div>
                </div>

                {/* --- RESPONSIVE Image Preview Container --- */}
                <div className="relative w-full h-72 lg:h-96 bg-black/20 rounded-lg flex items-center justify-center">
                  <img
                    src={editedImageData || URL.createObjectURL(destinationImage)}
                    alt="Destination"
                    className="max-w-full max-h-full object-contain"
                  />
                  {editedImageData && (
                    <div className="absolute top-2 left-2 bg-green-500/80 text-white px-2 py-1 rounded text-xs">
                      Edited
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Middle column - Object Image */}
        <Card className="bg-slate-00/50 border-slate-700 flex flex-col">
          <CardContent className="p-6 space-y-4 flex-grow flex flex-col">
            <div>
              <Label htmlFor="object-image" className="text-foreground font-medium">
                {selectedAccessory.charAt(0).toUpperCase() + selectedAccessory.slice(1)} to Insert
              </Label>
              <Input
                id="object-image"
                type="file"
                accept="image/*"
                onChange={(e) => setObjectImage(e.target.files?.[0] || null)}
                className="mt-2 bg-[#A3E635]/80 hover:bg-green-700 border-border/20"
              />
              <p className="text-sm text-foreground/60 mt-1">
                Upload an image of the {selectedAccessory} you want to insert
              </p>
            </div>
            
            {objectImage && (
              <div className="relative mt-auto w-full h-72 lg:h-96 bg-black/20 rounded-lg flex items-center justify-center">
                <img
                  src={URL.createObjectURL(objectImage)}
                  alt="Object Preview"
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-blue-500/80 text-white px-2 py-1 rounded text-xs font-medium">
                  Object Preview
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column - Result */}
        <Card className="bg-slate-00/50 border-slate-700 flex flex-col">
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex-1 flex flex-col">
              <Label className="text-foreground font-medium mb-4">Result</Label>
              <div className="relative w-full h-72 lg:h-96 bg-black/20 rounded-lg flex items-center justify-center flex-grow">
                {resultImage ? (
                  <img
                    src={resultImage}
                    alt="Generated"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-foreground/60">
                    <p>Generated image</p>
                    <p>will appear here</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <div className="text-sm text-foreground/80 font-mono whitespace-pre-wrap bg-muted/20 px-3 py-1 rounded-md border border-border/20 h-16 overflow-y-auto">
                {status}
              </div>
              {progress > 0 && (
                <div className="w-full bg-muted/20 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              <Button
    onClick={startGeneration}
    disabled={isGenerating || !destinationImage || !objectImage}
    className={`w-full py-3 text-white font-medium
      transition-all duration-300 hover:scale-105 active:scale-95
      relative flex items-center justify-center
      ${isGenerating
        ? 'bg-[#A3E635]/90'
        : 'bg-[#A3E635]/80 hover:bg-green-700'
      }
    `}
>
    {isGenerating ? (
        <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
            <span className="animate-pulse">Processing...</span>
        </>
    ) : (
        'Generate Image'
    )}
</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image Editor Modal (No changes needed here, it's already responsive) */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Image Mask</DialogTitle>
          </DialogHeader>
          <div className="flex-grow flex flex-col space-y-4 min-h-0">
            {/* Editor Controls */}
            <div className="flex flex-wrap items-center gap-4 p-2 bg-muted/20 rounded-lg border border-border/20">
              <div className="flex gap-2">
                <Button variant={brushType === 'round' ? 'default' : 'outline'} size="sm" onClick={() => setBrushType('round')}>Round</Button>
                <Button variant={brushType === 'square' ? 'default' : 'outline'} size="sm" onClick={() => setBrushType('square')}>Square</Button>
              </div>
              <div className="flex gap-2">
                <Button variant={brushColor === 'black' ? 'default' : 'outline'} size="sm" onClick={() => setBrushColor('black')}>Erase</Button>
                <Button variant={brushColor === 'white' ? 'default' : 'outline'} size="sm" onClick={() => setBrushColor('white')}>Mask</Button>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Brush Size: {brushSize}px</Label>
                <div className="w-32"><Slider value={[brushSize]} onValueChange={(value) => setBrushSize(value[0])} max={50} min={1} step={1} /></div>
                <Input type="number" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} min={1} max={50} className="w-20 h-8" />
              </div>
              <Button onClick={resetCanvas} variant="outline" size="sm">Reset Mask</Button>
              <Button onClick={resetView} variant="outline" size="sm">Reset View</Button>
            </div>
            
            {/* Canvas Container */}
            <div className="w-full flex-grow relative bg-muted/10 rounded-lg" style={{ overflow: 'hidden', cursor: 'default' }} onWheel={handleWheel} onMouseDown={panStart} onMouseMove={panMove} onMouseUp={panEnd} onMouseLeave={panEnd}>
              <div className="absolute inset-0 flex items-center justify-center p-2">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  className="border border-border/20"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    ...getCursorStyle()
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
              <Button onClick={saveEditedImage} className="bg-green-600 hover:bg-green-700">Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
