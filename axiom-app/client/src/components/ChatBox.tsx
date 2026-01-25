import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Send, ChevronRight } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBoxProps {
  sessionId: string;
  phase: 'axiom' | 'matching' | 'completed';
  onPhaseChange?: (phase: 'axiom' | 'matching' | 'completed') => void;
}

export default function ChatBox({ sessionId, phase, onPhaseChange }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(phase);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessionData, isLoading: isSessionLoading } = trpc.axiom.getSession.useQuery({ sessionId });
  const sendMessageMutation = trpc.axiom.sendMessage.useMutation();
  const nextBlocMutation = trpc.axiom.nextBloc.useMutation();
  const generateSynthesisMutation = trpc.axiom.generateSynthesis.useMutation();

  useEffect(() => {
    if (sessionData?.history) {
      setMessages(sessionData.history);
      scrollToBottom();
    }
  }, [sessionData]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMessageMutation.mutateAsync({
        sessionId,
        message: input,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Une erreur est survenue. Veuillez réessayer.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextBloc = async () => {
    setIsLoading(true);
    try {
      const response = await nextBlocMutation.mutateAsync({ sessionId });

      const hasBloc = 'blocNum' in response;
      if (!hasBloc) {
        setCurrentPhase('matching');
        onPhaseChange?.('matching');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: (response as any).synthesis,
        }, {
          role: 'assistant',
          content: (response as any).matchingResult,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: (response as any).blocMessage,
        }]);
      }
    } catch (error) {
      console.error('Error moving to next bloc:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-white rounded-br-none'
                  : 'bg-slate-100 text-slate-900 rounded-bl-none'
              }`}
            >
              {message.role === 'assistant' ? (
                <Streamdown>{message.content}</Streamdown>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-900 px-4 py-3 rounded-lg rounded-bl-none">
              <Loader2 className="animate-spin" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 p-4 bg-white">
        {currentPhase === 'completed' ? (
          <div className="text-center py-4">
            <p className="text-slate-600 mb-4">Profil complété ! Merci d'avoir participé.</p>
            <Button variant="outline" size="sm">
              Télécharger mon profil
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Tapez votre réponse..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Send size={18} />
              </Button>
            </div>

            {currentPhase === 'axiom' && (
              <Button
                onClick={handleNextBloc}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                <ChevronRight size={18} className="mr-2" />
                Bloc suivant
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
