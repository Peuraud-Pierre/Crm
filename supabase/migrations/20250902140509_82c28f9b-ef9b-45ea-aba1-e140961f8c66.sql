-- Add sample data for testing (since the previous migration failed to insert data)
INSERT INTO public.profiles (user_id, email, full_name, role, status, last_login) VALUES
  (gen_random_uuid(), 'admin@example.com', 'Jean Dupont', 'SuperAdmin', 'active', now() - interval '1 hour'),
  (gen_random_uuid(), 'manager@example.com', 'Marie Martin', 'Admin', 'active', now() - interval '2 hours'),
  (gen_random_uuid(), 'marketing@example.com', 'Alex Durand', 'Market', 'active', now() - interval '3 hours'),
  (gen_random_uuid(), 'comptable@example.com', 'Sophie Bernard', 'Compta', 'active', now() - interval '1 day'),
  (gen_random_uuid(), 'employe1@example.com', 'Luc Moreau', 'Employé', 'active', now() - interval '2 days'),
  (gen_random_uuid(), 'employe2@example.com', 'Julie Petit', 'Employé', 'inactive', now() - interval '1 week'),
  (gen_random_uuid(), 'newuser@example.com', 'Thomas Roux', 'Employé', 'pending', null)
ON CONFLICT (user_id) DO NOTHING;