import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TryOnPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the app with the tryon subtab
    navigate('/app?tab=playground&subtab=tryon');
  }, [navigate]);

  return null; // This component just redirects
};

export default TryOnPage;