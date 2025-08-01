import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from "@/components/AppHeader";
import ErrorManager from "@/components/ErrorManager";
import { useErrorManager } from "@/hooks/useErrorManager";
import { ComfyUITab } from "@/components/ComfyUITab";
import { Button } from "@/components/ui/button";
import { Monitor } from "lucide-react";

const TryOnPage = () => {
  const navigate = useNavigate();
  const { errors, addError, clearError, clearAllErrors } = useErrorManager();

  const handleSystemDashboard = () => {
    navigate('/systemdashboard');
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
        <AppHeader />
        <div className="container mx-auto p-4 pt-24">
          <div className="w-full">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">TryOn</h1>
                <p className="text-gray-300">Advanced AI-powered virtual try-on with ComfyUI integration.</p>
              </div>
              <Button
                onClick={handleSystemDashboard}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all bg-purple-600/20 text-purple-300 hover:bg-purple-600/30"
              >
                <Monitor className="w-4 h-4 mr-2" />
                System Dashboard
              </Button>
            </div>

            <ComfyUITab />
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