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
  AlertCircle
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

  useEffect(() => {
    checkUser();
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
        } else if (data?.user) {
          setUser(data.user);
          fetchData();
        }
      } else {
        const { data, error } = await insforge.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthError(error.message || 'Invalid email or password.');
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
      const { data: keywordsData, error: kwError } = await insforge.database
        .from('monitored_keywords')
        .select('*')
        .order('created_at', { ascending: false });

      if (keywordsData) setKeywords(keywordsData as MonitoredKeyword[]);

      // 2. Fetch leads
      // PostgREST join syntax to embed scraped_posts and monitored_keywords
      const { data: leadsData, error: lError } = await insforge.database
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
      const { data, error } = await insforge.database
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
        // Optimistic local update
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

  // Filter logic
  const filteredLeads = leads.filter(lead => {
    const post = lead.scraped_posts;
    const matchPlatform = platformFilter === 'all' || post.platform === platformFilter;
    const matchStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchPlatform && matchStatus;
  });

  if (loading && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-slate-400 font-medium">Loading LeadScout.ai...</p>
        </div>
      </div>
    );
  }

  // Auth Screen
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-indigo-600/20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-purple-600/20 blur-3xl"></div>
          
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white mb-4">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">
              LeadScout.ai
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Social Listening & AI Lead Prospecting
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleAuth}>
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{authError}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError('');
                }}
                className="text-sm font-medium text-slate-400 hover:text-white transition"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard Screen
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 text-white">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            LeadScout.ai
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button
            onClick={() => setActiveTab('leads')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'leads'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 border border-transparent'
            }`}
          >
            <Compass className="h-5 w-5" />
            Prospect Leads
          </button>
          
          <button
            onClick={() => setActiveTab('keywords')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'keywords'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 border border-transparent'
            }`}
          >
            <Search className="h-5 w-5" />
            Monitor Keywords
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'analytics'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 border border-transparent'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            Performance Insights
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3 mb-4 overflow-hidden">
            <div className="h-9 w-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium truncate">Logged in as</p>
              <p className="text-sm text-slate-200 font-semibold truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-slate-800 rounded-lg text-sm font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-900/20 backdrop-blur-md">
          <h1 className="text-xl font-bold tracking-tight text-white capitalize">
            {activeTab === 'leads' ? 'Lead Prospecting' : activeTab === 'keywords' ? 'Monitored Keywords' : 'Performance Insights'}
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="flex items-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-medium transition text-slate-300"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
          
          {/* VIEW: LEADS */}
          {activeTab === 'leads' && (
            <div className="space-y-6">
              
              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row gap-4 bg-slate-900/30 p-4 border border-slate-850 rounded-2xl">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Filter Platform
                  </label>
                  <div className="flex gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                    {(['all', 'reddit', 'twitter'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPlatformFilter(p)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition ${
                          platformFilter === p
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Filter Status
                  </label>
                  <div className="flex gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                    {(['all', 'new', 'drafted', 'sent', 'ignored'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition ${
                          statusFilter === s
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Leads list */}
              {filteredLeads.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
                  <MessageSquare className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-300">No leads found</h3>
                  <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                    Configure your monitored keywords and run the Python worker command to capture qualified social leads.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {filteredLeads.map(lead => {
                    const post = lead.scraped_posts;
                    const keyword = lead.monitored_keywords;
                    
                    // Score styling
                    const scoreColor = lead.intent_score >= 80 
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : lead.intent_score >= 50
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-slate-400 bg-slate-500/10 border-slate-500/20';

                    return (
                      <div 
                        key={lead.id} 
                        className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden transition hover:border-slate-700/80 group"
                      >
                        {/* Header metadata */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              post.platform === 'twitter' 
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                                : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                            }`}>
                              {post.platform}
                            </span>
                            <span className="text-slate-500 text-xs font-medium">
                              Keyword: <strong className="text-slate-300">{keyword?.keyword || 'N/A'}</strong>
                            </span>
                            <span className="text-slate-500 text-xs">
                              • Scraped {new Date(post.scraped_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${scoreColor}`}>
                              <Award className="h-3.5 w-3.5" />
                              Intent: {lead.intent_score}/100
                            </div>

                            <select
                              value={lead.status}
                              onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as any)}
                              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium px-2.5 py-1.5 focus:outline-none"
                            >
                              <option value="new">New</option>
                              <option value="drafted">Drafted</option>
                              <option value="sent">Sent</option>
                              <option value="ignored">Ignored</option>
                            </select>
                          </div>
                        </div>

                        {/* Title and Post Content */}
                        <div className="mb-4">
                          {post.title && (
                            <h3 className="text-base font-bold text-white mb-2 leading-tight">
                              {post.title}
                            </h3>
                          )}
                          <p className="text-slate-350 text-sm whitespace-pre-wrap line-clamp-3 bg-slate-950/40 p-3 rounded-lg border border-slate-850/50">
                            {post.content}
                          </p>
                        </div>

                        {/* AI Qualification Reasoning */}
                        {lead.reasoning && (
                          <div className="mb-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              AI Qualifying Analysis
                            </h4>
                            <p className="text-slate-300 text-xs font-medium italic">
                              "{lead.reasoning}"
                            </p>
                          </div>
                        )}

                        {/* AI Draft Response */}
                        {lead.draft_reply && (
                          <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-4 relative">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                              Draft Reply Proposal
                            </h4>
                            <p className="text-slate-300 text-xs whitespace-pre-wrap pb-10">
                              {lead.draft_reply}
                            </p>
                            
                            <div className="absolute bottom-3 right-3 flex gap-2">
                              <button
                                onClick={() => copyToClipboard(lead.draft_reply || '', lead.id)}
                                className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-indigo-400 text-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                              >
                                {copiedId === lead.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-green-400" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy
                                  </>
                                )}
                              </button>

                              <a
                                href={post.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-indigo-400 text-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Go to Post
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: KEYWORDS */}
          {activeTab === 'keywords' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Form */}
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-6 self-start">
                <h2 className="text-lg font-bold text-white">Add Monitored Keyword</h2>
                
                <form onSubmit={handleAddKeyword} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                      Search Keyword or Phrase
                    </label>
                    <input
                      type="text"
                      required
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. recommend a calendar app"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                      Platforms to Scrape
                    </label>
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-3 text-slate-300 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={redditChecked}
                          onChange={(e) => setRedditChecked(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                        />
                        Reddit searches
                      </label>
                      <label className="flex items-center gap-3 text-slate-300 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={twitterChecked}
                          onChange={(e) => setTwitterChecked(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                        />
                        Twitter / X posts
                      </label>
                    </div>
                  </div>

                  {keywordError && (
                    <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{keywordError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 py-2.5 border border-transparent rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition shadow-lg shadow-indigo-600/10"
                  >
                    <Plus className="h-4 w-4" />
                    Save Keyword
                  </button>
                </form>
              </div>

              {/* Right Column: List */}
              <div className="lg:col-span-2 space-y-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Active Monitoring List
                  <span className="text-xs font-normal text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                    {keywords.length} monitored
                  </span>
                </h2>

                {keywords.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
                    <Search className="h-10 w-10 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">No active monitoring keywords configured.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {keywords.map(kw => (
                      <div 
                        key={kw.id} 
                        className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex items-center justify-between gap-4 transition hover:border-slate-700/80"
                      >
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate mb-1.5">
                            {kw.keyword}
                          </h3>
                          <div className="flex gap-1.5 flex-wrap">
                            {kw.platforms.map(p => (
                              <span key={p} className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded uppercase tracking-wider">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteKeyword(kw.id)}
                          className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* VIEW: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              
              {/* Summary stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Leads</span>
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                      <Compass className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{leads.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Qualified leads captured</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">High Intent (80+)</span>
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">
                    {leads.filter(l => l.intent_score >= 80).length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Direct buy indicator targets</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pending Review</span>
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">
                    {leads.filter(l => l.status === 'new').length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Unprocessed new drafts</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Average Score</span>
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">
                    {leads.length > 0 
                      ? Math.round(leads.reduce((acc, l) => acc + l.intent_score, 0) / leads.length)
                      : 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Overall intent quality rating</p>
                </div>

              </div>

              {/* Status and source analytics split blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Source Split */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 block">Platform Channels Distribution</h3>
                  <div className="space-y-4">
                    {['reddit', 'twitter'].map(channel => {
                      const count = leads.filter(l => l.scraped_posts.platform === channel).length;
                      const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
                      return (
                        <div key={channel}>
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span className="capitalize text-slate-300">{channel}</span>
                            <span className="text-slate-400">{count} ({Math.round(pct)}%)</span>
                          </div>
                          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                            <div 
                              className={`h-full rounded-full ${channel === 'reddit' ? 'bg-orange-500' : 'bg-sky-400'}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Split */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 block">Lead Conversion Funnel</h3>
                  <div className="space-y-4">
                    {['new', 'drafted', 'sent', 'ignored'].map(status => {
                      const count = leads.filter(l => l.status === status).length;
                      const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span className="capitalize text-slate-300">{status}</span>
                            <span className="text-slate-400">{count} ({Math.round(pct)}%)</span>
                          </div>
                          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                            <div 
                              className="h-full rounded-full bg-indigo-500"
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
          )}

        </div>
      </main>

    </div>
  );
}
