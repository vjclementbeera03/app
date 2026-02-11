import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const About = () => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAboutContent();
  }, []);

  const fetchAboutContent = async () => {
    try {
      const response = await axios.get(`${API}/about`);
      setContent(response.data);
    } catch (error) {
      console.error('Failed to fetch about content:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="about-page">
      {/* Header Image */}
      <div 
        className="h-64 bg-cover bg-center relative"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1758275557233-773c6c03614e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTJ8MHwxfHNlYXJjaHwxfHxjb2xsZWdlJTIwc3R1ZGVudHMlMjBlYXRpbmclMjBmb29kJTIwaGFwcHklMjBncm91cHxlbnwwfHx8fDE3NzAyMjUzMTR8MA&ixlib=rb-4.1.0&q=85')`
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full flex items-center justify-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            About Us
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg" data-testid="about-content-card">
            <CardHeader>
              <CardTitle className="text-3xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {content?.title || 'About Our Shop'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: content?.content?.replace(/\n/g, '<br />') || 'Welcome to our food shop!' }}
                data-testid="about-content-text"
              />
            </CardContent>
          </Card>
        )}

        {/* Values Section */}
        <div className="mt-8 grid gap-4" data-testid="values-section">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <h3 className="font-bold text-xl mb-2 text-[#E23744]">Quality First</h3>
              <p className="text-gray-600">
                We use only the freshest ingredients to prepare delicious meals for our students.
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <h3 className="font-bold text-xl mb-2 text-[#239D60]">Hygiene Standards</h3>
              <p className="text-gray-600">
                Our kitchen maintains the highest hygiene standards with regular inspections.
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <h3 className="font-bold text-xl mb-2 text-[#F59E0B]">Student Community</h3>
              <p className="text-gray-600">
                Built by students, for students. We understand your needs and budget.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default About;