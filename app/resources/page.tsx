'use client';

import { useState, useEffect } from 'react';
import { Resource, fallbackResources, categories, types } from './data';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { FiRefreshCw } from 'react-icons/fi';

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>(() => {
    // Try to get cached resources on initial load
    if (typeof window !== 'undefined') {
      const cachedResources = localStorage.getItem('github_resources_cache');
      return cachedResources ? JSON.parse(cachedResources) : fallbackResources;
    }
    return fallbackResources;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);

  useEffect(() => {
    async function loadResources() {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/resources');
        if (!response.ok) {
          throw new Error('Failed to fetch resources');
        }
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setResources(data);
          // Cache resources in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('github_resources_cache', JSON.stringify(data));
          }
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Failed to load resources:', error);
        // We'll already have fallback or cached resources from initial state
        setError('Failed to load fresh resources. Showing cached or fallback data.');
      } finally {
        // Add a minimum loading time
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      }
    }

    loadResources();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch('/api/resources', { 
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch resources');
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setResources(data);
        // Cache resources in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('github_resources_cache', JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Failed to refresh resources:', error);
      setError('Failed to refresh resources. Showing cached or fallback data.');
      
      // Check if it's a rate limit error and set retry timer
      if (error instanceof Error && error.message.includes('rate limit')) {
        const resetTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        startCountdown(resetTime);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const startCountdown = (resetTime: Date) => {
    const updateCountdown = () => {
      const now = new Date();
      const timeLeft = resetTime.getTime() - now.getTime();
      
      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        setRetryIn(timeLeft);
        setError(`Rate limit exceeded. Retry in ${hours}h ${minutes}m ${seconds}s`);
        
        const timer = setTimeout(updateCountdown, 1000);
        return () => clearTimeout(timer);
      } else {
        setRetryIn(null);
        setError(null);
      }
    };

    updateCountdown();
  };

  // Filter resources based on search and filters
  const filteredResources = resources.filter((resource) => {
    const matchesSearch = searchQuery === '' ||
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === '' || resource.category === selectedCategory;
    const matchesType = selectedType === '' || resource.type === selectedType;

    return matchesSearch && matchesCategory && matchesType;
  });

  // Pagination
  const itemsPerPage = 50;  
  const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResources = filteredResources.slice(startIndex, startIndex + itemsPerPage);

  if (isLoading) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-7xl mx-auto">
          <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-4xl font-bold">Loading Resources...</h1>
              <div className="animate-spin">
                <FiRefreshCw className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">Open Source Resources</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing || !!retryIn}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              <FiRefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
            <p>{error}</p>
          </div>
        )}
        <p className="text-muted-foreground mb-8">
          {filteredResources.length} resources available
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <input
            type="text"
            placeholder="Search resources..."
            className="px-4 py-2 border rounded-lg"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            className="px-4 py-2 border rounded-lg"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            className="px-4 py-2 border rounded-lg"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Types</option>
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {paginatedResources.map((resource) => (
            <div 
              key={resource.id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="inline-block px-2 py-1 text-xs rounded-full bg-primary/10">
                  {resource.type}
                </span>
                <span className="text-sm text-muted-foreground">
                  {resource.category}
                </span>
              </div>

              <h3 className="text-xl font-semibold mb-2">{resource.title}</h3>
              <p className="text-muted-foreground mb-4">{resource.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {resource.tags.map((tag) => (
                  <span 
                    key={tag}
                    className="px-2 py-1 text-xs rounded-full bg-secondary/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <Link
                href={resource.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full px-4 py-2 border rounded-md hover:bg-primary/5"
              >
                Access Resource
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
