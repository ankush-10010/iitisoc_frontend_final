import { useState } from 'react';
import AppHeader from "@/components/AppHeader";
import ErrorManager from "@/components/ErrorManager";
import { useErrorManager } from "@/hooks/useErrorManager";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import PlaygroundContent from "@/components/PlaygroundContent";

const Txt2ImgPage = () => {
  const { errors, addError, clearError, clearAllErrors } = useErrorManager();
  const {
    prompt,
    isGenerating,
    generatedImage,
    showSuccess,
    width,
    height,
    numInferenceSteps,
    guidanceScale,
    controlImage,
    loraScales,
    setPrompt,
    setWidth,
    setHeight,
    setNumInferenceSteps,
    setGuidanceScale,
    setControlImage,
    setLoraScales,
    handleGenerate,
    handleImageLoad,
    handleImageError
  } = useImageGeneration();

  const onGenerate = (selectedModel?: string) => {
    handleGenerate(addError, selectedModel);
  };

  return (
    <>
      {/* Background Spline 3D iframe */}
      <div className="fixed inset-0 z-0">
        <iframe 
          src='https://my.spline.design/dotwaves-FR8HGbfFmjLusADTS6cmnWBP/' 
          frameBorder='0' 
          width='100%' 
          height='100%'
          className="pointer-events-none"
        />
      </div>
      
      <div className="min-h-screen bg-transparent relative z-10">
        <div className="container mx-auto p-4">
          <AppHeader />

          <div className="w-full">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white mb-2">Text to Image</h1>
              <p className="text-gray-300">Generate stunning images from text prompts with advanced AI models and creative control.</p>
            </div>

            <PlaygroundContent
              prompt={prompt}
              onPromptChange={setPrompt}
              controlImage={controlImage}
              onControlImageChange={setControlImage}
              width={width}
              height={height}
              numInferenceSteps={numInferenceSteps}
              guidanceScale={guidanceScale}
              loraScales={loraScales}
              onWidthChange={setWidth}
              onHeightChange={setHeight}
              onStepsChange={setNumInferenceSteps}
              onGuidanceScaleChange={setGuidanceScale}
              onLoraScalesChange={setLoraScales}
              isGenerating={isGenerating}
              generatedImage={generatedImage}
              showSuccess={showSuccess}
              onGenerate={onGenerate}
              onImageLoad={handleImageLoad}
              onImageError={handleImageError}
              onError={addError}
            />
          </div>
        </div>

        <ErrorManager
          errors={errors}
          onClearError={clearError}
          onClearAll={clearAllErrors}
        />
      </div>
    </>
  );
};

export default Txt2ImgPage;