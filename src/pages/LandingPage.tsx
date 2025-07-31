import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, Palette, Image, Shirt } from "lucide-react";
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const [scrollY, setScrollY] = useState(0);
  const [isCollageSticky, setIsCollageSticky] = useState(false);
  const [visibleImages, setVisibleImages] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      
      // Collage section starts at 600px
      const collageStartThreshold = 600;
      const collageEndThreshold = collageStartThreshold + 1200; // Give enough time for all images
      
      if (currentScrollY >= collageStartThreshold && currentScrollY < collageEndThreshold && visibleImages < 6) {
        setIsCollageSticky(true);
        // Prevent further scrolling
        window.scrollTo(0, collageStartThreshold);
        // Show images based on time elapsed in sticky mode
        const timeInSticky = Date.now() % 3000; // Reset every 3 seconds for demo
        const newVisibleImages = Math.min(6, Math.floor(timeInSticky / 500) + 1);
        setVisibleImages(newVisibleImages);
      } else if (visibleImages >= 6 && currentScrollY >= collageStartThreshold) {
        setIsCollageSticky(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    // Auto-progress images when sticky
    let interval: NodeJS.Timeout;
    if (isCollageSticky && visibleImages < 6) {
      interval = setInterval(() => {
        setVisibleImages(prev => {
          if (prev < 6) {
            return prev + 1;
          } else {
            setIsCollageSticky(false);
            return prev;
          }
        });
      }, 500); // Show one image every 500ms
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (interval) clearInterval(interval);
    };
  }, [isCollageSticky, visibleImages]);

  const navigateToTab = (tab: string) => {
    navigate(`/${tab}`);
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Spline Background */}
      <div className="fixed inset-0 z-0">
        <iframe 
          src='https://my.spline.design/dotwaves-FR8HGbfFmjLusADTS6cmnWBP/' 
          frameBorder='0' 
          width='100%' 
          height='100%'
          className="pointer-events-none"
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">🎨EdiGen AI</h1>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => navigate('/app')}
          className="bg-white/10 text-white border-white/20 hover:bg-white/20"
        >
          Launch App
        </Button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div 
          className="text-center max-w-4xl mx-auto"
          style={{
            transform: `translateY(${scrollY * 0.1}px)`,
            opacity: Math.max(0, 1 - scrollY / 800)
          }}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            The Future of Smart AI
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Image Generation is here.
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            We integrate AI-powered image generation into powerful tools for creative professionals, 
            artists, and innovators across diverse sectors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/app')}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm"
            >
              Explore Projects <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="bg-transparent border-white/30 text-white hover:bg-white/10"
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>

      {/* Image Collage Section */}
      <section 
        className={`relative z-10 ${isCollageSticky ? 'h-screen flex items-center' : 'py-20'} px-6`}
        style={{
          position: isCollageSticky ? 'sticky' : 'relative',
          top: isCollageSticky ? 0 : 'auto'
        }}
      >
        <div className="max-w-6xl mx-auto w-full">
          <h2 
            className="text-4xl font-bold text-white text-center mb-16"
            style={{
              opacity: isCollageSticky ? 1 : Math.min(1, Math.max(0, (scrollY - 400) / 400))
            }}
          >
            Powered by Advanced AI Models
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center justify-items-center">
            {[1, 2, 3, 4, 5, 6].map((index) => {
              const isVisible = index <= visibleImages;
              
              return (
                <div
                  key={index}
                  className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg backdrop-blur-sm border border-white/10 w-full max-w-xs"
                  style={{
                    transform: `translateY(${isVisible ? 0 : 50}px) scale(${isVisible ? 1 : 0.8})`,
                    opacity: isVisible ? 1 : 0,
                    transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                      <Image className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Tools Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 
            className="text-4xl font-bold text-white text-center mb-4"
            style={{
              opacity: visibleImages >= 6 ? 1 : 0,
              transition: 'opacity 0.6s ease-in-out'
            }}
          >
            AI Image Generation Applications
          </h2>
          <p 
            className="text-gray-300 text-center mb-16 max-w-3xl mx-auto"
            style={{
              opacity: visibleImages >= 6 ? 1 : 0,
              transition: 'opacity 0.6s ease-in-out 0.2s'
            }}
          >
            Our AI technology transforms ordinary prompts into extraordinary visuals that enhance 
            creativity, productivity, and innovation across diverse applications.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Palette,
                title: "Text to Image",
                description: "Generate stunning images from text prompts with advanced AI models and creative control.",
                tab: "txt2img"
              },
              {
                icon: Image,
                title: "Image to Image",
                description: "Transform existing images with AI-powered modifications and style transfers.",
                tab: "img2img"
              },
              {
                icon: Zap,
                title: "Inpainting",
                description: "Intelligently fill, edit, and enhance specific regions of your images with precision.",
                tab: "inpainting"
              },
              {
                icon: Shirt,
                title: "Try On",
                description: "Virtual try-on technology that brings fashion and e-commerce to life.",
                tab: "tryon"
              }
            ].map((item, index) => {
              const isCardVisible = visibleImages >= 6;
              const cardDelay = index * 0.2; // Stagger the cards
              
              return (
                <Card
                  key={item.title}
                  className="bg-black/40 border-white/10 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 cursor-pointer group"
                  style={{
                    transform: `translateY(${isCardVisible ? 0 : 30}px)`,
                    opacity: isCardVisible ? 1 : 0,
                    transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${cardDelay}s`
                  }}
                  onClick={() => navigateToTab(item.tab)}
                >
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-gray-300 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                 </CardContent>
               </Card>
              );
             })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6">
        <div 
          className="max-w-4xl mx-auto text-center"
          style={{
            opacity: Math.min(1, Math.max(0, (scrollY - 1800) / 400))
          }}
        >
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Create Something Amazing?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of creators using AI to bring their imagination to life.
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/app')}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600"
          >
            Start Creating Now <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
