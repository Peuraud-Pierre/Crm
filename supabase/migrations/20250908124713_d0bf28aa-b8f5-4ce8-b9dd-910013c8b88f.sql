-- Create roles table
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles
CREATE POLICY "Users can view all roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "SuperAdmin and Admin can create roles" ON public.roles FOR INSERT WITH CHECK (true);
CREATE POLICY "SuperAdmin and Admin can update roles" ON public.roles FOR UPDATE USING (true);
CREATE POLICY "SuperAdmin and Admin can delete roles" ON public.roles FOR DELETE USING (true);

-- Create RLS policies for services
CREATE POLICY "Users can view all services" ON public.services FOR SELECT USING (true);
CREATE POLICY "SuperAdmin and Admin can create services" ON public.services FOR INSERT WITH CHECK (true);
CREATE POLICY "SuperAdmin and Admin can update services" ON public.services FOR UPDATE USING (true);
CREATE POLICY "SuperAdmin and Admin can delete services" ON public.services FOR DELETE USING (true);

-- Add role_id and service_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role_id UUID REFERENCES public.roles(id),
ADD COLUMN service_id UUID REFERENCES public.services(id);

-- Create triggers for updated_at columns
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default roles
INSERT INTO public.roles (nom, permissions) VALUES 
  ('SuperAdmin', '{"dashboard": true, "content": true, "messages": true, "tickets": true, "ping_pong": true, "users": true, "settings": true, "security": true, "roles_services": true}'),
  ('Admin', '{"dashboard": true, "content": true, "messages": true, "tickets": true, "ping_pong": true, "users": true, "settings": true, "security": false, "roles_services": true}'),
  ('Employé', '{"dashboard": true, "content": false, "messages": true, "tickets": true, "ping_pong": true, "users": false, "settings": false, "security": false, "roles_services": false}');

-- Insert default services
INSERT INTO public.services (nom, permissions) VALUES 
  ('IT', '{"dashboard": true, "content": true, "messages": true, "tickets": true, "ping_pong": true, "users": true, "settings": true, "security": true, "roles_services": true}'),
  ('RH', '{"dashboard": true, "content": false, "messages": true, "tickets": true, "ping_pong": true, "users": true, "settings": false, "security": false, "roles_services": false}'),
  ('Marketing', '{"dashboard": true, "content": true, "messages": true, "tickets": true, "ping_pong": true, "users": false, "settings": false, "security": false, "roles_services": false}'),
  ('Comptabilité', '{"dashboard": true, "content": false, "messages": true, "tickets": true, "ping_pong": true, "users": false, "settings": false, "security": false, "roles_services": false}');