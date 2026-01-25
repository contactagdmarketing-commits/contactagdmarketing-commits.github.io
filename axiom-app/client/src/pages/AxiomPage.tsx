import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Mail, User } from 'lucide-react';
import ChatBox from '@/components/ChatBox';
import { trpc } from '@/lib/trpc';
import { nanoid } from 'nanoid';

export default function AxiomPage() {
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [phase, setPhase] = useState<'axiom' | 'matching' | 'completed'>('axiom');

  const initSessionMutation = trpc.axiom.initSession.useMutation();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('sessionId');
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsInitializing(true);
    try {
      const response = await initSessionMutation.mutateAsync({
        email: email.trim(),
        name: name.trim() || undefined,
      });

      setSessionId(response.sessionId);
      window.history.pushState({}, '', `?sessionId=${response.sessionId}`);
    } catch (error) {
      console.error('Error initializing session:', error);
      alert('Erreur lors de l\'initialisation de la session');
    } finally {
      setIsInitializing(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <span className="text-2xl font-bold text-primary">AXIOM</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenue</h1>
            <p className="text-slate-600">Commençons votre profil professionnel</p>
          </div>

          <form onSubmit={handleStartSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Mail className="inline mr-2" size={16} />
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                disabled={isInitializing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <User className="inline mr-2" size={16} />
                Nom (optionnel)
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                disabled={isInitializing}
              />
            </div>

            <Button
              type="submit"
              disabled={isInitializing || !email.trim()}
              className="w-full bg-primary hover:bg-primary/90 text-white"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Initialisation...
                </>
              ) : (
                'Commencer le profil'
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-xs text-slate-600">
              <strong>À propos d'AXIOM :</strong> Ce questionnaire interactif vous permettra de mieux comprendre votre fonctionnement professionnel et votre alignement avec nos opportunités.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto h-screen flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AXIOM</h1>
              <p className="text-sm text-slate-600">
                {phase === 'axiom' && 'Questionnaire de profilage'}
                {phase === 'matching' && 'Analyse de matching'}
                {phase === 'completed' && 'Profil complété'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Session ID</p>
              <p className="text-xs font-mono text-slate-700">{sessionId.substring(0, 8)}...</p>
            </div>
          </div>
        </div>

        {/* Chat Box */}
        <div className="flex-1 min-h-0">
          <ChatBox
            sessionId={sessionId}
            phase={phase}
            onPhaseChange={setPhase}
          />
        </div>
      </div>
    </div>
  );
}
