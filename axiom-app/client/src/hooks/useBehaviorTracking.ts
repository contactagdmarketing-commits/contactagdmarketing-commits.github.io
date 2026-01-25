import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';

interface TrackingEvent {
  eventType: 'page_view' | 'scroll' | 'message_sent' | 'bloc_completed' | 'page_left' | 'time_spent';
  eventData?: Record<string, any>;
}

export function useBehaviorTracking(sessionId: string) {
  const startTimeRef = useRef<number>(Date.now());
  const lastScrollRef = useRef<number>(0);
  const trackingMutationRef = useRef<any>(null);

  useEffect(() => {
    // Track page view
    const trackEvent = async (event: TrackingEvent) => {
      try {
        // We would call a tRPC mutation here to track the event
        // For now, we'll just log it
        console.log('Tracking event:', event);
      } catch (error) {
        console.error('Error tracking event:', error);
      }
    };

    // Track scroll depth
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollRef.current > 1000) {
        lastScrollRef.current = now;
        const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        trackEvent({
          eventType: 'scroll',
          eventData: { scrollPercentage: Math.round(scrollPercentage) },
        });
      }
    };

    // Track page leave
    const handleBeforeUnload = () => {
      const timeSpent = Date.now() - startTimeRef.current;
      trackEvent({
        eventType: 'page_left',
        eventData: { timeSpent },
      });
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Track initial page view
    trackEvent({ eventType: 'page_view' });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId]);

  return {
    trackEvent: async (eventType: TrackingEvent['eventType'], eventData?: Record<string, any>) => {
      console.log('Custom tracking:', { eventType, eventData });
    },
  };
}
