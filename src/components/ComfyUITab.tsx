import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BACKEND_COMFYUI_URL } from '@/config/backend_comfyui';

const WORKFLOW_JSON = {
  "1": { "inputs": { "image": "shoppingwatch.webp" }, "class_type": "LoadImage", "_meta": { "title": "Insert object" } },
  "2": { "inputs": { "image": "clipspace/clipspace-mask-260828.39999997616.png [input]" }, "class_type": "LoadImage", "_meta": { "title": "Insert hand" } },
  "5": { "inputs": { "image": ["40", 1] }, "class_type": "GetImageSize+", "_meta": { "title": "🔧 Get Image Size" } },
  "6": { "inputs": { "width": 16384, "height": ["5", 1], "interpolation": "lanczos", "method": "keep proportion", "condition": "always", "multiple_of": 0, "image": ["126", 0] }, "class_type": "ImageResize+", "_meta": { "title": "🔧 Image Resize" } },
  "7": { "inputs": { "direction": "right", "match_image_size": false, "image1": ["6", 0], "image2": ["40", 1] }, "class_type": "ImageConcanate", "_meta": { "title": "Image Concatenate" } },
  "8": { "inputs": { "images": ["7", 0] }, "class_type": "PreviewImage", "_meta": { "title": "Preview Image" } },
  "37": { "inputs": { "text": "a photograph of a watch on a hand with detailed text on watch" }, "class_type": "Text Multiline", "_meta": { "title": "Prompt 1" } },
  "38": { "inputs": { "text": "The hand is in a natural, elegant pose, with visible skin texture and subtle veins. The lighting is professional and studio-grade, creating soft shadows that define the contours of the watch and hand, highlighting reflections on metallic surfaces. Masterpiece, best quality, 8k UHD, sharp focus, extreme detail, super-resolution, professional studio photography." }, "class_type": "Text Multiline", "_meta": { "title": "Additional prompt" } }
};

export const ComfyUITab = () => {
  const [destinationImage, setDestinationImage] = useState<File | null>(null);
  const [objectImage, setObjectImage] = useState<File | null>(null);
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

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

  const getModifiedWorkflow = useCallback((workflow: any, destinationImageName: string, objectImageName: string) => {
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow));

    let destinationNodeId, objectNodeId;
    for (const id in updatedWorkflow) {
      if (updatedWorkflow[id]._meta?.title === "Insert hand") destinationNodeId = id;
      if (updatedWorkflow[id]._meta?.title === "Insert object") objectNodeId = id;
    }

    if (destinationNodeId) updatedWorkflow[destinationNodeId].inputs.image = destinationImageName;
    if (objectNodeId) updatedWorkflow[objectNodeId].inputs.image = objectImageName;

    return updatedWorkflow;
  }, []);

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
      updateStatus('Error: Please select both images.', true);
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const destFileInfo = await uploadImage(destinationImage);
      const objFileInfo = await uploadImage(objectImage);
      updateStatus('Uploads complete. Preparing workflow...');

      const modifiedWorkflow = getModifiedWorkflow(WORKFLOW_JSON, destFileInfo.name, objFileInfo.name);
      
      const clientId = Math.random().toString(36).substring(7);
      const wsUrl = BACKEND_COMFYUI_URL.replace('https', 'wss');
      const ws = new WebSocket(`${wsUrl}/ws?clientId=${clientId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        queuePrompt(clientId, modifiedWorkflow);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          const { value, max } = data.data;
          const progressPercent = ((value / max) * 100);
          setProgress(progressPercent);
          updateStatus(`Generating... ${progressPercent.toFixed(0)}%`);
        } else if (data.type === 'executed') {
          updateStatus('Execution complete! Fetching image...');
          const output = data.data.output;
          
          let finalImageNodeOutput = null;
          if (output.images && output.images.length > 0) {
            finalImageNodeOutput = output;
          } else {
            finalImageNodeOutput = output['8'] || output['7'] || Object.values(output).find((o: any) => o.images);
          }

          if (finalImageNodeOutput && finalImageNodeOutput.images && finalImageNodeOutput.images.length > 0) {
            const finalImage = finalImageNodeOutput.images[0]; 
            const imageUrl = `${BACKEND_COMFYUI_URL}/view?filename=${encodeURIComponent(finalImage.filename)}&subfolder=${encodeURIComponent(finalImage.subfolder)}&type=${finalImage.type}`;
            
            setResultImage(imageUrl);
            updateStatus('Done!');
            setProgress(100);
            toast.success('Image generated successfully!');
          } else {
            updateStatus('Error: Could not find final image in output.', true);
            console.log("Full output:", output);
          }
          ws.close();
        } else if (data.type === 'execution_error') {
          updateStatus(`Server Error: ${JSON.stringify(data.data)}`, true);
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
  }, [destinationImage, objectImage, uploadImage, getModifiedWorkflow, queuePrompt, updateStatus]);

  // Canvas setup and drawing functions
  const setupCanvas = useCallback((image: HTMLImageElement) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
    contextRef.current = context;
    originalImageRef.current = image;
  }, []);

  const handleDestinationImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setDestinationImage(file);
    setEditedImageData(null); // Reset edited data when new image is selected
  }, []);

  const openEditor = useCallback(() => {
    if (!destinationImage) return;
    
    const img = new Image();
    img.onload = () => {
      setupCanvas(img);
      setIsEditorOpen(true);
    };
    img.src = URL.createObjectURL(destinationImage);
  }, [destinationImage, setupCanvas]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!contextRef.current) return;
    setIsDrawing(true);
    draw(e);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const context = contextRef.current;
    
    if (brushColor === 'white') {
      // White brush creates a mask (white areas)
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = 'rgba(255, 255, 255, 0.8)';
    } else {
      // Black brush erases the mask
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = 'rgba(0, 0, 0, 1)';
    }
    
    if (brushType === 'round') {
      context.beginPath();
      context.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
      context.fill();
    } else {
      context.fillRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
    }
  }, [isDrawing, brushColor, brushType, brushSize]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const resetCanvas = useCallback(() => {
    if (!originalImageRef.current) return;
    setupCanvas(originalImageRef.current);
  }, [setupCanvas]);

  const saveEditedImage = useCallback(() => {
    if (!canvasRef.current) return;
    
    const editedData = canvasRef.current.toDataURL();
    setEditedImageData(editedData);
    
    // Convert canvas to blob and create a new File
    canvasRef.current.toBlob((blob) => {
      if (blob && destinationImage) {
        const editedFile = new File([blob], destinationImage.name, { type: 'image/png' });
        setDestinationImage(editedFile);
      }
    });
    
    setIsEditorOpen(false);
    toast.success('Image edited successfully!');
  }, [destinationImage]);

  // Custom cursor style based on brush size
  const getCursorStyle = useCallback(() => {
    const size = Math.max(brushSize, 8); // Minimum visible size
    return {
      cursor: `url("data:image/svg+xml,%3csvg width='${size}' height='${size}' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='${size/2}' cy='${size/2}' r='${size/2-1}' fill='none' stroke='%23000' stroke-width='1'/%3e%3c/svg%3e") ${size/2} ${size/2}, crosshair`
    };
  }, [brushSize]);

  return (
    <div className="flex gap-6">
      {/* Left side - Image inputs stacked vertically */}
      <div className="flex-1 space-y-6">
        <Card className="border-border/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="destination-image" className="text-foreground font-medium">
                Destination Image (with mask)
              </Label>
              <Input
                id="destination-image"
                type="file"
                accept="image/*"
                onChange={handleDestinationImageChange}
                className="mt-2 bg-background/50 border-border/20"
              />
            </div>
            
            {destinationImage && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    onClick={openEditor}
                    variant="default"
                    size="sm"
                  >
                    Edit Mask
                  </Button>
                </div>
                
                {/* Display the current image (edited or original) */}
                <div className="relative">
                  <img
                    src={editedImageData || URL.createObjectURL(destinationImage)}
                    alt="Destination"
                    className="max-w-full border border-border/20 rounded-lg"
                    style={{ maxHeight: '400px' }}
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

        <Card className="border-border/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="object-image" className="text-foreground font-medium">
                Object to Insert
              </Label>
              <Input
                id="object-image"
                type="file"
                accept="image/*"
                onChange={(e) => setObjectImage(e.target.files?.[0] || null)}
                className="mt-2 bg-background/50 border-border/20"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Result section */}
      <div className="flex-1">
        <Card className="border-border/20 bg-card/50 backdrop-blur-sm h-full">
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex-1">
              {resultImage ? (
                <img 
                  src={resultImage} 
                  alt="Generated" 
                  className="max-w-full rounded-lg border border-border/20 shadow-lg"
                />
              ) : (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-border/20 rounded-lg">
                  <p className="text-foreground/60">Generated image will appear here</p>
                </div>
              )}
            </div>
            
            <div className="space-y-4 mt-6">
              <div className="text-sm text-foreground/80 font-mono whitespace-pre-wrap bg-muted/20 p-3 rounded-md border border-border/20">
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
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? 'Processing...' : 'Generate Image'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image Editor Modal */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Image Mask</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Editor Controls */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/20 rounded-lg border border-border/20">
              <div className="flex gap-2">
                <Button
                  variant={brushType === 'round' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushType('round')}
                >
                  Round
                </Button>
                <Button
                  variant={brushType === 'square' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushType('square')}
                >
                  Square
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={brushColor === 'black' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushColor('black')}
                >
                  Black (Erase)
                </Button>
                <Button
                  variant={brushColor === 'white' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushColor('white')}
                >
                  White (Mask)
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-sm">Brush Size: {brushSize}px</Label>
                <div className="w-32">
                  <Slider
                    value={[brushSize]}
                    onValueChange={(value) => setBrushSize(value[0])}
                    max={50}
                    min={1}
                    step={1}
                  />
                </div>
                <Input
                  type="number"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  min={1}
                  max={50}
                  className="w-20 h-8"
                />
              </div>
              
              <Button onClick={resetCanvas} variant="outline" size="sm">
                Reset
              </Button>
            </div>

            {/* Canvas Container */}
            <div className="flex justify-center overflow-auto bg-muted/10 rounded-lg p-4">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="max-w-full border border-border/20 rounded-lg"
                style={{
                  maxHeight: '500px',
                  ...getCursorStyle()
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={saveEditedImage}
                className="bg-green-600 hover:bg-green-700"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};