import { useState } from 'react';
import AppHeader from "@/components/AppHeader";
import ErrorManager from "@/components/ErrorManager";
import { useErrorManager } from "@/hooks/useErrorManager";

const TryOnPage = () => {
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
              <h1 className="text-3xl font-bold text-white mb-2">Virtual Try On</h1>
              <p className="text-gray-300">Virtual try-on technology that brings fashion and e-commerce to life.</p>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-lg p-8 backdrop-blur-sm">
              <div className="text-center text-white">
                <h3 className="text-xl font-semibold mb-4">Try On Feature Coming Soon</h3>
                <p className="text-gray-300 mb-6">
                  We're working on implementing advanced virtual try-on technology. 
                  This feature will allow you to virtually try on clothing and accessories using AI.
                </p>
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">👕</span>
                </div>
              </div>
            </div>
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

export default TryOnPage;