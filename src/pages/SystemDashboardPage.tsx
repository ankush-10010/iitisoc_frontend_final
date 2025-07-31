import AppHeader from "@/components/AppHeader";
import SystemDashboard from "@/components/SystemDashboard";

const SystemDashboardPage = () => {
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
              <h1 className="text-3xl font-bold text-white mb-2">System Dashboard</h1>
              <p className="text-gray-300">Monitor real-time system performance, GPU usage, and resource utilization.</p>
            </div>

            <SystemDashboard />
          </div>
        </div>
      </div>
    </>
  );
};

export default SystemDashboardPage;