-- Create monitored_keywords table
CREATE TABLE public.monitored_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL CHECK (char_length(keyword) > 0),
    platforms TEXT[] DEFAULT '{reddit, twitter}' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for monitored_keywords
ALTER TABLE public.monitored_keywords ENABLE ROW LEVEL SECURITY;

-- monitored_keywords RLS Policies
CREATE POLICY "Users can insert their own keywords" ON public.monitored_keywords
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own keywords" ON public.monitored_keywords
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own keywords" ON public.monitored_keywords
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keywords" ON public.monitored_keywords
    FOR DELETE USING (auth.uid() = user_id);


-- Create scraped_posts table (global cache, read-only to public users, full read/write for worker/authenticated users)
CREATE TABLE public.scraped_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    url TEXT NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    post_created_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT scraped_posts_platform_external_id_key UNIQUE (platform, external_id)
);

-- Enable RLS on scraped_posts
ALTER TABLE public.scraped_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scraped posts" ON public.scraped_posts
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert scraped posts" ON public.scraped_posts
    FOR INSERT WITH CHECK (true);


-- Create leads table
CREATE TABLE public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword_id UUID NOT NULL REFERENCES public.monitored_keywords(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.scraped_posts(id) ON DELETE CASCADE,
    intent_score INTEGER NOT NULL CHECK (intent_score BETWEEN 0 AND 100),
    reasoning TEXT,
    draft_reply TEXT,
    status TEXT DEFAULT 'new' NOT NULL CHECK (status IN ('new', 'drafted', 'sent', 'ignored')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- leads RLS Policies
CREATE POLICY "Users can insert their own leads" ON public.leads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own leads" ON public.leads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" ON public.leads
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" ON public.leads
    FOR DELETE USING (auth.uid() = user_id);


-- Set up trigger to automatically update updated_at on public.leads
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Grants
GRANT ALL ON public.monitored_keywords TO authenticated;
GRANT ALL ON public.scraped_posts TO authenticated;
GRANT ALL ON public.leads TO authenticated;
