import { useState } from 'react';
import AppHeader from "@/components/AppHeader";
import ErrorManager from "@/components/ErrorManager";
import { useErrorManager } from "@/hooks/useErrorManager";
import Img2ImgTab from "@/components/Img2ImgTab";

const Img2ImgPage = () => {
  const { errors, addError, clearError, clearAllErrors } = useErrorManager();

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
              <h1 className="text-3xl font-bold text-white mb-2">Image to Image</h1>
              <p className="text-gray-300">Transform existing images with AI-powered modifications and style transfers.</p>
            </div>

            <Img2ImgTab onError={addError} />
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

export default Img2ImgPage;