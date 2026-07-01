'use client';

import { useState, useEffect } from 'react';
import { insforge } from './insforge';
import { 
  Key, 
  Search, 
  Plus, 
  Trash2, 
  RefreshCw, 
  LogOut, 
  TrendingUp, 
  Award, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Compass,
  AlertCircle,
  ChevronRight,
  Monitor
} from 'lucide-react';

interface ScrapedPost {
  id: string;
  platform: string;
  external_id: string;
  title: string | null;
  content: string;
  author: string;
  url: string;
  scraped_at: string;
  post_created_at: string | null;
}

interface MonitoredKeyword {
  id: string;
  user_id: string;
  keyword: string;
  platforms: string[];
  created_at: string;
}

interface Lead {
  id: string;
  user_id: string;
  keyword_id: string;
  post_id: string;
  intent_score: number;
  reasoning: string | null;
  draft_reply: string | null;
  status: 'new' | 'drafted' | 'sent' | 'ignored';
  created_at: string;
  updated_at: string;
  scraped_posts: ScrapedPost;
  monitored_keywords: MonitoredKeyword;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Dashboard views: 'leads' | 'keywords' | 'analytics'
  const [activeTab, setActiveTab] = useState<'leads' | 'keywords' | 'analytics'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [keywords, setKeywords] = useState<MonitoredKeyword[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<'all' | 'reddit' | 'twitter'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'drafted' | 'sent' | 'ignored'>('all');

  // New keyword form
  const [newKeyword, setNewKeyword] = useState('');
  const [redditChecked, setRedditChecked] = useState(true);
  const [twitterChecked, setTwitterChecked] = useState(true);
  const [keywordError, setKeywordError] = useState('');

  // Copy state mapping
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stagger mounting effect
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    checkUser();
    // Enable mounting animation
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  async function checkUser() {
    try {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (data?.user) {
        setUser(data.user);
        fetchData();
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error checking user:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    
    try {
      if (isSignUp) {
        const { data, error } = await insforge.auth.signUp({ email, password });
        if (error) {
          setAuthError(error.message || 'Signup failed.');
        } else if (data?.requireEmailVerification) {
          setShowOtpInput(true);
        } else if (data?.user) {
          setUser(data.user);
          fetchData();
        }
      } else {
        const { data, error } = await insforge.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.statusCode === 403 || error.message?.toLowerCase().includes('confirm') || error.message?.toLowerCase().includes('verify')) {
            setShowOtpInput(true);
            setAuthError('Email not verified yet. Please enter the verification OTP sent to your email.');
          } else {
            setAuthError(error.message || 'Invalid email or password.');
          }
        } else if (data?.user) {
          setUser(data.user);
          fetchData();
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setVerifyingOtp(true);
    
    try {
      const { data, error } = await insforge.auth.verifyEmail({
        email,
        otp: otpCode.trim()
      });
      
      if (error) {
        setAuthError(error.message || 'Verification failed. Please check the code.');
      } else if (data?.user) {
        setUser(data.user);
        setShowOtpInput(false);
        setOtpCode('');
        fetchData();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Verification error.');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleResendOtp() {
    setAuthError('');
    try {
      const { error } = await insforge.auth.resendVerificationEmail({
        email,
        redirectTo: window.location.origin
      });
      if (error) {
        setAuthError(error.message);
      } else {
        alert('Verification OTP code has been resent to your email.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to resend code.');
    }
  }

  async function handleSignOut() {
    setLoading(true);
    try {
      await insforge.auth.signOut();
      setUser(null);
      setLeads([]);
      setKeywords([]);
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData() {
    setRefreshing(true);
    try {
      // 1. Fetch keywords
      const { data: keywordsData } = await insforge.database
        .from('monitored_keywords')
        .select('*')
        .order('created_at', { ascending: false });

      if (keywordsData) setKeywords(keywordsData as MonitoredKeyword[]);

      // 2. Fetch leads
      const { data: leadsData } = await insforge.database
        .from('leads')
        .select('*, scraped_posts(*), monitored_keywords(*)')
        .order('created_at', { ascending: false });

      if (leadsData) setLeads(leadsData as unknown as Lead[]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    setKeywordError('');
    if (!newKeyword.trim()) return;

    const platforms = [];
    if (redditChecked) platforms.push('reddit');
    if (twitterChecked) platforms.push('twitter');

    if (platforms.length === 0) {
      setKeywordError('Please select at least one platform.');
      return;
    }

    try {
      const { error } = await insforge.database
        .from('monitored_keywords')
        .insert([{
          user_id: user.id,
          keyword: newKeyword.trim(),
          platforms
        }]);

      if (error) {
        setKeywordError(error.message);
      } else {
        setNewKeyword('');
        fetchData();
      }
    } catch (err: any) {
      setKeywordError(err.message);
    }
  }

  async function handleDeleteKeyword(id: string) {
    try {
      const { error } = await insforge.database
        .from('monitored_keywords')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Failed to delete keyword: ' + error.message);
      } else {
        fetchData();
      }
    } catch (err) {
      console.error('Error deleting keyword:', err);
    }
  }

  async function handleUpdateLeadStatus(id: string, status: 'new' | 'drafted' | 'sent' | 'ignored') {
    try {
      const { error } = await insforge.database
        .from('leads')
        .update({ status })
        .eq('id', id);

      if (error) {
        alert('Failed to update status: ' + error.message);
      } else {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLeads = leads.filter(lead => {
    const post = lead.scraped_posts;
    const matchPlatform = platformFilter === 'all' || post.platform === platformFilter;
    const matchStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchPlatform && matchStatus;
  });

  if (loading && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505] text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="h-10 w-10 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
          <p className="text-neutral-450 text-[10px] font-bold tracking-[0.25em] uppercase">Initializing LeadScout</p>
        </div>
      </div>
    );
  }

  // AUTH SCREENS: LOGIN, SIGNUP, OTP
  if (!user) {
    if (showOtpInput) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#030303] px-4 py-12 select-none relative overflow-hidden font-sans">
          {/* Mesh Orb Gradients */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 left-1/3 h-[250px] w-[250px] rounded-full bg-purple-600/10 blur-[90px] pointer-events-none"></div>

          {/* Double-Bezel Card Wrapper with Spring Entrance */}
          <div className={`w-full max-w-md bg-[#0a0a0c]/80 border border-white/5 p-2 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            mounted ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0'
          }`}>
            <div className="bg-[#070709] border border-white/5 p-8 rounded-[calc(2.5rem-0.5rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] space-y-6">
              
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-white/5 border border-white/10 text-white mb-5">
                  <Key className="h-4.5 w-4.5" strokeWidth={1.2} />
                </div>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-0.5 text-[9px] uppercase tracking-[0.2em] font-bold text-indigo-400 mb-2.5">
                  Security Code
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight text-white">
                  Verify Your Identity
                </h2>
                <p className="mt-2.5 text-xs text-neutral-400 leading-relaxed">
                  We've sent a 6-digit verification code to <span className="text-neutral-250 font-medium">{email}</span>.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleVerifyOtp}>
                <div>
                  <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block mb-2">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 text-white rounded-xl px-4 py-3 text-center tracking-[0.25em] text-xl font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-[border-color,background-color] duration-200"
                    placeholder="123456"
                  />
                </div>

                {authError && (
                  <div className="flex items-center gap-2.5 text-red-400 text-xs bg-red-500/5 border border-red-500/10 p-3.5 rounded-xl">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" strokeWidth={1.2} />
                    <p className="font-medium">{authError}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Premium Spring Press Button */}
                  <button
                    type="submit"
                    disabled={verifyingOtp}
                    className="group w-full flex justify-between items-center py-2.5 pl-5 pr-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 active:scale-[0.97] hover:scale-[1.01] transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg shadow-indigo-500/10 disabled:opacity-50"
                  >
                    <span>{verifyingOtp ? 'Verifying Code...' : 'Verify & Continue'}</span>
                    <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                      <ChevronRight className="h-4 w-4" strokeWidth={1.2} />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="w-full text-center py-2 text-xs font-semibold text-neutral-450 hover:text-white transition-colors duration-150"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="text-center pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOtpInput(false);
                      setAuthError('');
                    }}
                    className="text-xs font-medium text-neutral-400 hover:text-white transition-colors duration-150"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030303] px-4 py-12 relative overflow-hidden font-sans select-none">
        {/* Mesh Background Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 left-1/3 h-[250px] w-[250px] rounded-full bg-purple-600/10 blur-[90px] pointer-events-none"></div>

        {/* Double-Bezel Card Wrapper with Spring Entrance */}
        <div className={`w-full max-w-md bg-[#0a0a0c]/80 border border-white/5 p-2 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          mounted ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0'
        }`}>
          <div className="bg-[#070709] border border-white/5 p-8 rounded-[calc(2.5rem-0.5rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] space-y-6">
            
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center h-11 w-11 rounded-full bg-white/5 border border-white/10 text-white mb-5">
                <Sparkles className="h-4.5 w-4.5" strokeWidth={1.2} />
              </div>
              <span className="rounded-full bg-white/5 border border-white/10 px-3 py-0.5 text-[9px] uppercase tracking-[0.2em] font-bold text-neutral-400 mb-2.5">
                Social Intelligence
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                LeadScout.ai
              </h2>
              <p className="mt-2 text-xs text-neutral-450 leading-relaxed">
                Connect and scan Reddit & Twitter feeds for direct intent customers.
              </p>
            </div>
            
            <form className="space-y-4" onSubmit={handleAuth}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-[border-color,background-color] duration-200"
                    placeholder="name@company.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-[border-color,background-color] duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {authError && (
                <div className="flex items-center gap-2.5 text-red-400 text-xs bg-red-500/5 border border-red-500/10 p-3.5 rounded-xl">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" strokeWidth={1.2} />
                  <p className="font-medium">{authError}</p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="group w-full flex justify-between items-center py-2.5 pl-5 pr-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 active:scale-[0.97] hover:scale-[1.01] transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg shadow-indigo-500/10 disabled:opacity-50"
                >
                  <span>{loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                    <ChevronRight className="h-4 w-4" strokeWidth={1.2} />
                  </div>
                </button>
              </div>

              <div className="text-center pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError('');
                  }}
                  className="text-xs font-medium text-neutral-450 hover:text-white transition-colors duration-150"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD LAYOUT
  return (
    <div className="flex min-h-screen bg-[#050507] text-slate-100 font-sans select-none relative overflow-hidden">
      {/* Background Mesh Gradient Orbs */}
      <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-indigo-600/[0.03] blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-purple-600/[0.03] blur-[120px] pointer-events-none"></div>

      {/* Sidebar Panel */}
      <aside className="w-68 border-r border-white/5 bg-[#0a0a0c]/60 backdrop-blur-2xl flex flex-col shrink-0 relative z-10">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/10">
            <Sparkles className="h-4.5 w-4.5" strokeWidth={1.2} />
          </div>
          <span className="font-extrabold text-sm uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
            LeadScout.ai
          </span>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-1.5">
          <button
            onClick={() => setActiveTab('leads')}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-[background-color,border-color,color] duration-150 ease-out ${
              activeTab === 'leads'
                ? 'bg-white/[0.04] text-white border border-white/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]'
                : 'text-neutral-400 hover:bg-white/[0.02] hover:text-white border border-transparent'
            }`}
          >
            <Compass className="h-4.5 w-4.5" strokeWidth={1.2} />
            Prospect Leads
          </button>
          
          <button
            onClick={() => setActiveTab('keywords')}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-[background-color,border-color,color] duration-150 ease-out ${
              activeTab === 'keywords'
                ? 'bg-white/[0.04] text-white border border-white/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]'
                : 'text-neutral-400 hover:bg-white/[0.02] hover:text-white border border-transparent'
            }`}
          >
            <Search className="h-4.5 w-4.5" strokeWidth={1.2} />
            Monitor Keywords
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-[background-color,border-color,color] duration-150 ease-out ${
              activeTab === 'analytics'
                ? 'bg-white/[0.04] text-white border border-white/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]'
                : 'text-neutral-400 hover:bg-white/[0.02] hover:text-white border border-transparent'
            }`}
          >
            <TrendingUp className="h-4.5 w-4.5" strokeWidth={1.2} />
            Performance Insights
          </button>
        </nav>

        {/* User Account Capsule */}
        <div className="p-4 border-t border-white/5 bg-[#070709]/80">
          <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl mb-4 overflow-hidden shadow-inner">
            <div className="h-8.5 w-8.5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-extrabold shadow-sm shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-wider truncate">Operator Account</p>
              <p className="text-xs text-neutral-250 font-semibold truncate leading-tight">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-white/5 hover:border-red-500/10 rounded-xl text-xs font-bold text-neutral-450 hover:text-red-400 hover:bg-red-500/5 transition-[background-color,border-color,color] duration-150 active:scale-[0.97] ease-out"
          >
            <LogOut className="h-4.5 w-4.5" strokeWidth={1.2} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        
        {/* Header Block */}
        <header className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-[#0a0a0c]/20 backdrop-blur-md">
          <h1 className="text-sm font-extrabold uppercase tracking-widest text-white">
            {activeTab === 'leads' ? 'Prospect Leads Feed' : activeTab === 'keywords' ? 'Monitored Keywords' : 'Performance Insights'}
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="flex items-center gap-2 py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-xs font-bold transition-[background-color,color] duration-150 active:scale-[0.97] ease-out text-neutral-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.2} />
              {refreshing ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>
        </header>

        {/* Content View container */}
        <div className="p-8 max-w-6xl w-full mx-auto space-y-10 min-h-[calc(100vh-4rem)] flex flex-col justify-start">
          
          {/* VIEW: LEADS */}
          {activeTab === 'leads' && (
            <div className="space-y-8">
              
              {/* Asymmetric Filter Grid */}
              <div className="grid grid-cols-12 gap-6 bg-[#0a0a0c]/50 p-6 border border-white/5 rounded-3xl backdrop-blur-md">
                
                <div className="col-span-12 md:col-span-6 space-y-2">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Platform Scope
                  </span>
                  <div className="flex bg-black p-1 border border-white/5 rounded-full w-max">
                    {(['all', 'reddit', 'twitter'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPlatformFilter(p)}
                        className={`text-[10px] font-bold px-4 py-2 rounded-full uppercase tracking-wider transition-[background-color,color] duration-150 active:scale-[0.97] ease-out ${
                          platformFilter === p
                            ? 'bg-white/10 text-white border border-white/5 shadow-md'
                            : 'text-neutral-450 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6 space-y-2">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Lead Phase
                  </span>
                  <div className="flex bg-black p-1 border border-white/5 rounded-full w-max flex-wrap gap-0.5">
                    {(['all', 'new', 'drafted', 'sent', 'ignored'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`text-[10px] font-bold px-4 py-2 rounded-full uppercase tracking-wider transition-[background-color,color] duration-150 active:scale-[0.97] ease-out ${
                          statusFilter === s
                            ? 'bg-white/10 text-white border border-white/5 shadow-md'
                            : 'text-neutral-450 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Bento Grid Leads List */}
              {filteredLeads.length === 0 ? (
                <div className="text-center py-28 bg-[#0a0a0c]/20 border border-dashed border-white/5 rounded-[2.5rem] space-y-4">
                  <MessageSquare className="h-10 w-10 text-neutral-500 mx-auto" strokeWidth={1} />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Empty Leads List</h3>
                    <p className="text-xs text-neutral-450 max-w-sm mx-auto leading-relaxed">
                      Configure your active monitoring keywords and run the Python worker command to capture qualified customer leads.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {filteredLeads.map((lead, index) => {
                    const post = lead.scraped_posts;
                    const keyword = lead.monitored_keywords;
                    
                    const scoreColor = lead.intent_score >= 80 
                      ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10'
                      : lead.intent_score >= 50
                      ? 'text-amber-400 bg-amber-500/5 border-amber-500/10'
                      : 'text-neutral-400 bg-neutral-500/5 border-neutral-500/10';

                    return (
                      <div 
                        key={lead.id} 
                        style={{ animationDelay: `${index * 40}ms` }}
                        className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2.2rem] shadow-2xl backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-white/10 animate-fade-up"
                      >
                        <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2.2rem-0.5rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] space-y-5">
                          
                          {/* Row metadata header */}
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                              <span className={`text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
                                post.platform === 'twitter' 
                                  ? 'bg-sky-500/5 text-sky-400 border border-sky-500/10' 
                                  : 'bg-orange-500/5 text-orange-400 border border-orange-500/10'
                              }`}>
                                {post.platform}
                              </span>
                              <span className="text-neutral-450 text-[10px] font-semibold uppercase tracking-wider">
                                Keyword: <strong className="text-neutral-250">{keyword?.keyword || 'N/A'}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${scoreColor}`}>
                                <Award className="h-3.5 w-3.5" strokeWidth={1.2} />
                                Intent: {lead.intent_score}/100
                              </div>

                              <select
                                value={lead.status}
                                onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as any)}
                                className="bg-[#0a0a0c] border border-white/5 text-neutral-300 rounded-full text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="new">New</option>
                                <option value="drafted">Drafted</option>
                                <option value="sent">Sent</option>
                                <option value="ignored">Ignored</option>
                              </select>
                            </div>
                          </div>

                          {/* Post contents */}
                          <div className="space-y-2">
                            {post.title && (
                              <h3 className="text-sm font-extrabold text-white leading-tight">
                                {post.title}
                              </h3>
                            )}
                            <p className="text-neutral-350 text-xs whitespace-pre-wrap leading-relaxed bg-[#0a0a0c]/50 p-4 rounded-xl border border-white/5 shadow-inner">
                              {post.content}
                            </p>
                          </div>

                          {/* AI reasoning analysis */}
                          {lead.reasoning && (
                            <div className="bg-indigo-500/[0.02] border border-indigo-500/10 rounded-xl p-4 flex items-start gap-3">
                              <div className="h-6 w-6 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-400" strokeWidth={1.2} />
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                                  AI Qualification Reasoning
                                </h4>
                                <p className="text-neutral-300 text-xs italic">
                                  "{lead.reasoning}"
                                </p>
                              </div>
                            </div>
                          )}

                          {/* AI reply proposal & CTA buttons */}
                          {lead.draft_reply && (
                            <div className="bg-[#050507]/80 border border-white/5 rounded-xl p-5 relative space-y-4">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-neutral-450" strokeWidth={1.2} />
                                <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                                  Draft Response Proposal
                                </h4>
                              </div>
                              <p className="text-neutral-350 text-xs whitespace-pre-wrap leading-relaxed pb-8">
                                {lead.draft_reply}
                              </p>
                              
                              <div className="absolute bottom-4 right-4 flex gap-2">
                                <button
                                  onClick={() => copyToClipboard(lead.draft_reply || '', lead.id)}
                                  className="flex items-center gap-1.5 bg-[#0a0a0c] border border-white/5 hover:border-white/10 text-neutral-400 hover:text-white rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] ease-out shadow-sm"
                                >
                                  {copiedId === lead.id ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-green-400" strokeWidth={1.2} />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" strokeWidth={1.2} />
                                      Copy Draft
                                    </>
                                  )}
                                </button>

                                <a
                                  href={post.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 bg-[#0a0a0c] border border-white/5 hover:border-white/10 text-neutral-400 hover:text-white rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] ease-out shadow-sm"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.2} />
                                  Open Post
                                </a>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: KEYWORDS */}
          {activeTab === 'keywords' && (
            <div className="grid grid-cols-12 gap-8">
              
              {/* Left Form Panel */}
              <div className="col-span-12 lg:col-span-4 bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2.2rem] shadow-2xl backdrop-blur-md self-start animate-fade-up">
                <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2.2rem-0.5rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] space-y-6">
                  
                  <h2 className="text-sm font-extrabold uppercase tracking-widest text-white">Add Keyword</h2>
                  
                  <form onSubmit={handleAddKeyword} className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block mb-2">
                        Query Word or Phrase
                      </label>
                      <input
                        type="text"
                        required
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/5 text-white rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                        placeholder="e.g. recommend a calendar app"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block mb-2">
                        Scraping Channels
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 text-neutral-350 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={redditChecked}
                            onChange={(e) => setRedditChecked(e.target.checked)}
                            className="h-4 w-4 rounded border-white/10 bg-[#0a0a0c] text-indigo-600 focus:ring-indigo-500"
                          />
                          Reddit Scraper
                        </label>
                        <label className="flex items-center gap-3 text-neutral-350 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={twitterChecked}
                            onChange={(e) => setTwitterChecked(e.target.checked)}
                            className="h-4 w-4 rounded border-white/10 bg-[#0a0a0c] text-indigo-600 focus:ring-indigo-500"
                          />
                          Twitter / X Scraper
                        </label>
                      </div>
                    </div>

                    {keywordError && (
                      <div className="text-red-400 text-xs bg-red-500/5 border border-red-500/10 p-3.5 rounded-xl flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-450" strokeWidth={1.2} />
                        <span>{keywordError}</span>
                      </div>
                    )}

                    {/* Premium Spring Press Button */}
                    <button
                      type="submit"
                      className="group w-full flex justify-between items-center py-2 pl-4 pr-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 active:scale-[0.97] hover:scale-[1.01] transition-all duration-150 ease-out shadow-lg shadow-indigo-500/10"
                    >
                      <span>Create Monitor</span>
                      <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                        <Plus className="h-4 w-4" strokeWidth={1.2} />
                      </div>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Keywords List */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                  Active Keywords
                  <span className="text-[10px] font-bold text-neutral-450 bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full">
                    {keywords.length} active
                  </span>
                </h2>

                {keywords.length === 0 ? (
                  <div className="text-center py-20 bg-[#0a0a0c]/20 border border-dashed border-white/5 rounded-[2rem] animate-fade-up">
                    <Search className="h-8 w-8 text-neutral-500 mx-auto mb-3" strokeWidth={1} />
                    <p className="text-xs text-neutral-450">No active keywords monitored yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {keywords.map((kw, index) => (
                      <div 
                        key={kw.id} 
                        style={{ animationDelay: `${index * 40}ms` }}
                        className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2rem] shadow-2xl backdrop-blur-md flex items-center justify-between animate-fade-up"
                      >
                        <div className="bg-[#070709] border border-white/5 p-5 rounded-[calc(2rem-0.5rem)] w-full flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-white truncate mb-2">
                              {kw.keyword}
                            </h3>
                            <div className="flex gap-1.5 flex-wrap">
                              {kw.platforms.map(p => (
                                <span key={p} className="text-[9px] font-bold text-neutral-400 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteKeyword(kw.id)}
                            className="p-2.5 border border-white/5 rounded-full text-neutral-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all duration-200 active:scale-[0.97] ease-out shrink-0"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.2} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* VIEW: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-fade-up">
              
              {/* Stat grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2rem] shadow-2xl backdrop-blur-md flex">
                  <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2rem-0.5rem)] w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Total Leads</span>
                      <div className="p-2 bg-indigo-500/5 rounded-lg text-indigo-400 border border-indigo-500/10">
                        <Compass className="h-4.5 w-4.5" strokeWidth={1.2} />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-white tracking-tight">{leads.length}</p>
                      <p className="text-[10px] text-neutral-450 mt-1 uppercase tracking-wide">Captured Leads</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2rem] shadow-2xl backdrop-blur-md flex">
                  <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2rem-0.5rem)] w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">High Intent (80+)</span>
                      <div className="p-2 bg-emerald-500/5 rounded-lg text-emerald-400 border border-emerald-500/10">
                        <CheckCircle className="h-4.5 w-4.5" strokeWidth={1.2} />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-white tracking-tight">
                        {leads.filter(l => l.intent_score >= 80).length}
                      </p>
                      <p className="text-[10px] text-neutral-450 mt-1 uppercase tracking-wide">Buy signals</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2rem] shadow-2xl backdrop-blur-md flex">
                  <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2rem-0.5rem)] w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Pending Review</span>
                      <div className="p-2 bg-amber-500/5 rounded-lg text-amber-400 border border-amber-500/10">
                        <MessageSquare className="h-4.5 w-4.5" strokeWidth={1.2} />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-white tracking-tight">
                        {leads.filter(l => l.status === 'new').length}
                      </p>
                      <p className="text-[10px] text-neutral-450 mt-1 uppercase tracking-wide">New Inbox drafts</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2rem] shadow-2xl backdrop-blur-md flex">
                  <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2rem-0.5rem)] w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Average Score</span>
                      <div className="p-2 bg-purple-500/5 rounded-lg text-purple-400 border border-purple-500/10">
                        <TrendingUp className="h-4.5 w-4.5" strokeWidth={1.2} />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-white tracking-tight">
                        {leads.length > 0 
                          ? Math.round(leads.reduce((acc, l) => acc + l.intent_score, 0) / leads.length)
                          : 0}
                      </p>
                      <p className="text-[10px] text-neutral-450 mt-1 uppercase tracking-wide">Quality Index</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Progress bars split blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Source Split */}
                <div className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2rem] shadow-2xl backdrop-blur-md">
                  <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2rem-0.5rem)] space-y-5">
                    <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Platform Channels</h3>
                    <div className="space-y-4.5">
                      {['reddit', 'twitter'].map(channel => {
                        const count = leads.filter(l => l.scraped_posts.platform === channel).length;
                        const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
                        return (
                          <div key={channel} className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="capitalize text-neutral-350">{channel}</span>
                              <span className="text-neutral-400">{count} ({Math.round(pct)}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/[0.02] rounded-full overflow-hidden border border-white/5">
                              <div 
                                className={`h-full rounded-full ${channel === 'reddit' ? 'bg-orange-500/80' : 'bg-sky-400/80'}`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Status Split */}
                <div className="bg-[#0e0e11]/30 border border-white/5 p-2 rounded-[2rem] shadow-2xl backdrop-blur-md">
                  <div className="bg-[#070709] border border-white/5 p-6 rounded-[calc(2rem-0.5rem)] space-y-5">
                    <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Conversion Funnel</h3>
                    <div className="space-y-4.5">
                      {['new', 'drafted', 'sent', 'ignored'].map(status => {
                        const count = leads.filter(l => l.status === status).length;
                        const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
                        return (
                          <div key={status} className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="capitalize text-neutral-350">{status}</span>
                              <span className="text-neutral-400">{count} ({Math.round(pct)}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/[0.02] rounded-full overflow-hidden border border-white/5">
                              <div 
                                className="h-full rounded-full bg-indigo-500/80"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </main>

    </div>
  );
}
