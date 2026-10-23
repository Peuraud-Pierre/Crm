-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Employé' CHECK (role IN ('SuperAdmin', 'Admin', 'Market', 'Compta', 'Employé')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  avatar_url TEXT,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT messages_target_check CHECK (
    (recipient_id IS NOT NULL AND group_id IS NULL) OR 
    (recipient_id IS NULL AND group_id IS NOT NULL)
  )
);

-- Create content_generation table
CREATE TABLE public.content_generation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  instagram_post TEXT,
  tiktok_post TEXT,
  linkedin_post TEXT,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create kpis table
CREATE TABLE public.kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  previous_value NUMERIC NOT NULL DEFAULT 0,
  change_percentage NUMERIC NOT NULL DEFAULT 0,
  period TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for groups
CREATE POLICY "Users can view all groups" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group creators can update their groups" ON public.groups FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for messages
CREATE POLICY "Users can view their messages" ON public.messages 
FOR SELECT USING (
  auth.uid() = sender_id OR 
  auth.uid() = recipient_id OR
  group_id IN (SELECT id FROM public.groups WHERE true)
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for content_generation
CREATE POLICY "Users can view their own content" ON public.content_generation FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create content" ON public.content_generation FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their content" ON public.content_generation FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for kpis (admins only for now, will adjust based on roles)
CREATE POLICY "All authenticated users can view KPIs" ON public.kpis FOR SELECT USING (auth.role() = 'authenticated');

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'Employé')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
-- Sample profiles (these will be created when users sign up)
-- We'll create them manually for demo purposes
INSERT INTO public.profiles (user_id, email, full_name, role, status, last_login) VALUES
  (gen_random_uuid(), 'admin@example.com', 'Jean Dupont', 'SuperAdmin', 'active', now() - interval '1 hour'),
  (gen_random_uuid(), 'manager@example.com', 'Marie Martin', 'Admin', 'active', now() - interval '2 hours'),
  (gen_random_uuid(), 'marketing@example.com', 'Alex Durand', 'Market', 'active', now() - interval '3 hours'),
  (gen_random_uuid(), 'comptable@example.com', 'Sophie Bernard', 'Compta', 'active', now() - interval '1 day'),
  (gen_random_uuid(), 'employe1@example.com', 'Luc Moreau', 'Employé', 'active', now() - interval '2 days'),
  (gen_random_uuid(), 'employe2@example.com', 'Julie Petit', 'Employé', 'inactive', now() - interval '1 week'),
  (gen_random_uuid(), 'newuser@example.com', 'Thomas Roux', 'Employé', 'pending', null);

-- Sample groups
INSERT INTO public.groups (name, description, created_by) VALUES
  ('Équipe Marketing', 'Discussions marketing et promotions', (SELECT user_id FROM public.profiles WHERE email = 'marketing@example.com' LIMIT 1)),
  ('Support Technique', 'Entraide technique', (SELECT user_id FROM public.profiles WHERE email = 'admin@example.com' LIMIT 1)),
  ('Général', 'Discussions générales de l''équipe', (SELECT user_id FROM public.profiles WHERE email = 'admin@example.com' LIMIT 1));

-- Sample messages
INSERT INTO public.messages (content, sender_id, group_id) VALUES
  ('Bonjour à tous ! Comment ça va ?', (SELECT user_id FROM public.profiles WHERE email = 'admin@example.com' LIMIT 1), (SELECT id FROM public.groups WHERE name = 'Général' LIMIT 1)),
  ('Très bien merci ! Et toi ?', (SELECT user_id FROM public.profiles WHERE email = 'marketing@example.com' LIMIT 1), (SELECT id FROM public.groups WHERE name = 'Général' LIMIT 1)),
  ('On a besoin d''aide sur le nouveau projet', (SELECT user_id FROM public.profiles WHERE email = 'employe1@example.com' LIMIT 1), (SELECT id FROM public.groups WHERE name = 'Support Technique' LIMIT 1));

-- Sample direct messages
INSERT INTO public.messages (content, sender_id, recipient_id) VALUES
  ('Salut ! Tu peux m''aider sur ce dossier ?', (SELECT user_id FROM public.profiles WHERE email = 'employe1@example.com' LIMIT 1), (SELECT user_id FROM public.profiles WHERE email = 'admin@example.com' LIMIT 1)),
  ('Bien sûr ! De quoi as-tu besoin ?', (SELECT user_id FROM public.profiles WHERE email = 'admin@example.com' LIMIT 1), (SELECT user_id FROM public.profiles WHERE email = 'employe1@example.com' LIMIT 1));

-- Sample KPIs
INSERT INTO public.kpis (name, value, previous_value, change_percentage, period, category) VALUES
  ('Utilisateurs actifs', 1247, 1180, 5.68, 'Mensuel', 'Engagement'),
  ('Revenus', 45600, 42300, 7.80, 'Mensuel', 'Financier'),
  ('Conversions', 89, 76, 17.11, 'Hebdomadaire', 'Marketing'),
  ('Satisfaction client', 4.2, 3.9, 7.69, 'Mensuel', 'Qualité');